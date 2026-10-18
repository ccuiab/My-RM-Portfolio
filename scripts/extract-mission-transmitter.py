"""Restore the omitted VT03 from an archived GLB, without changing arm-parts.

The source CAD and its exports are read-only. The resulting mission-only mesh is
flattened into the same metre, +Y-up rest frame used by arm-parts.glb. Apply only
body * armMotionMatrices(...).get('link_3'); do not apply the CAD node transform
again. Two rear leads are hidden by whole original connected components. The
housing, fins, camera and short ports retain their original triangles/materials.
Use --include-rear-leads to restore the complete source device. Needs numpy.
"""
import argparse
import ast
import copy
import hashlib
import itertools
import json
import pathlib
import struct

import numpy as np

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--include-rear-leads', action='store_true')
options = parser.parse_args()
ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'materials/models/derived/inputs/codex/arm_tagged.glb'
OUTPUT = ROOT / 'materials/models/derived/web/mission-transmitter.glb'
tree = ast.parse((ROOT / 'scripts/build-arm-parts.py').read_text(encoding='utf8'))
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n, ast.ClassDef)
                             and n.name == 'Cad'], type_ignores=[]), '<Cad>', 'exec'))
cad = Cad('arm', SOURCE)
indices = [i for i in range(len(cad.data['nodes'])) if 'VT03' in cad.name(i)
           and 'mesh' in cad.data['nodes'][i]]
assert len(indices) == 1, f'Expected one complete VT03 source mesh, found {indices}'
source_node = indices[0]
mapping = json.loads((ROOT / 'materials/documents/derived/audits/codex/arm_source_mapping.json').read_text(encoding='utf8'))
mapped = [x for x in mapping['kept'] if x['source_asset'] == 'arm'
          and x['source_node_index'] == source_node]
assert len(mapped) == 1 and mapped[0]['link'] == 'link_3'
current = json.loads((ROOT / 'materials/models/derived/web/arm-parts.json').read_text(encoding='utf8'))
assert not any(x['source_asset'] == 'arm' and x['source_node_index'] == source_node
               for x in current['source_nodes']), 'VT03 is already included: avoid duplicate geometry'

def feature_components(positions, triangles):
    """Weld CAD seams at0.1 micrometre for connectivity, without moving vertices."""
    _, welded = np.unique(np.rint(positions / 1e-7).astype(np.int64), axis=0, return_inverse=True)
    parents = np.arange(int(welded.max()) + 1)

    def find(index):
        while parents[index] != index:
            parents[index] = parents[parents[index]]
            index = parents[index]
        return index

    for a, b, c in welded[triangles]:
        a, b, c = find(a), find(b), find(c)
        if a != b:
            parents[b] = a
        if a != c:
            parents[c] = a
    roots = np.array([find(i) for i in range(len(parents))])
    labels = roots[welded[triangles[:, 0]]]
    components = []
    for label in np.unique(labels):
        faces = np.flatnonzero(labels == label)
        points = positions[np.unique(triangles[faces])]
        low, high = points.min(axis=0), points.max(axis=0)
        components.append({'faces': faces, 'low': low, 'high': high,
                           'size': high - low, 'centre': points.mean(axis=0)})
    return components


source_primitives = []
all_positions, all_triangles, vertex_offset = [], [], 0
with SOURCE.open('rb') as stream:
    for primitive in cad.data['meshes'][cad.data['nodes'][source_node]['mesh']]['primitives']:
        positions = cad.accessor(primitive['attributes']['POSITION'], stream).astype(np.float64)
        normals = cad.accessor(primitive['attributes']['NORMAL'], stream).astype(np.float64)
        triangles = cad.accessor(primitive['indices'], stream).reshape(-1, 3).astype('<u4')
        source_primitives.append((primitive, positions, normals, triangles))
        all_positions.append(positions)
        all_triangles.append(triangles + vertex_offset)
        vertex_offset += len(positions)
native_positions, native_triangles = np.concatenate(all_positions), np.concatenate(all_triangles)
components = feature_components(native_positions, native_triangles)
# Two161mm cable solids plus their detached remote connector shells/lettering.
# Housing ends at nativeX29.66mm; fixed housing-side ports end at34.08mm.
long_leads = sorted((c for c in components if c['size'][0] > .15
                     and c['low'][0] > .02 and c['high'][0] > .18
                     and max(c['size'][1:]) < .012), key=lambda c: c['centre'][2])
assert len(long_leads) == 2 and long_leads[0]['centre'][2] < 0 < long_leads[1]['centre'][2]
matrix = cad.matrix(source_node)
excluded = np.zeros(len(native_triangles), dtype=bool)
hidden_features = []
for side, lead in zip(('negative_z', 'positive_z'), long_leads):
    selected = [lead]
    for component in components:
        if component is lead or component['low'][0] <= .15:
            continue
        if abs(component['centre'][2] - lead['centre'][2]) > .004:
            continue
        assert np.all(component['low'][1:] >= lead['low'][1:] - .0005)
        assert np.all(component['high'][1:] <= lead['high'][1:] + .0005)
        assert component['high'][0] <= lead['high'][0] + .008
        selected.append(component)
    faces = np.sort(np.concatenate([c['faces'] for c in selected]))
    points = native_positions[np.unique(native_triangles[faces])]
    world = points @ matrix[:3, :3].T + matrix[:3, 3]
    breaks = np.r_[0, np.flatnonzero(np.diff(faces) != 1) + 1, len(faces)]
    ranges = [[int(faces[a]), int(faces[b - 1]) + 1] for a, b in zip(breaks[:-1], breaks[1:])]
    assert not excluded[faces].any()
    excluded[faces] = True
    hidden_features.append({'name': 'rear_lead_' + side,
        'description': 'Long cable with remote connector/lettering; short housing-side connector retained.',
        'sourceComponentCount': len(selected), 'sourceFirstFaces': [int(c['faces'][0]) for c in selected],
        'triangles': len(faces), 'sourceFaceRangesExclusiveEnd': ranges,
        'nativeBoundsM': {'min': points.min(axis=0).tolist(), 'max': points.max(axis=0).tolist()},
        'armRestBoundsM': {'min': world.min(axis=0).tolist(), 'max': world.max(axis=0).tolist()}})
assert hidden_features[0]['triangles'] == hidden_features[1]['triangles'] == 38710
feature_mask = np.ones(len(native_triangles), dtype=bool) if options.include_rear_leads else ~excluded

payload = bytearray()
views, accessors, materials, primitives = [], [], [], []


def accessor(array, kind, component, target):
    array = np.ascontiguousarray(array)
    while len(payload) % 4:
        payload.append(0)
    view = len(views)
    views.append({'buffer': 0, 'byteOffset': len(payload), 'byteLength': array.nbytes,
                  'target': target})
    payload.extend(array.tobytes())
    record = {'bufferView': view, 'componentType': component,
              'count': len(array), 'type': kind}
    if kind == 'VEC3':
        record.update(min=array.min(axis=0).tolist(), max=array.max(axis=0).tolist())
    accessors.append(record)
    return len(accessors) - 1


normal_matrix = np.linalg.inv(matrix[:3, :3]).T
positions_out = []
triangle_offset = 0
for primitive, positions, normals, triangles in source_primitives:
    keep = feature_mask[triangle_offset:triangle_offset + len(triangles)]
    triangle_offset += len(triangles)
    triangles = triangles[keep]
    used, remap = np.unique(triangles, return_inverse=True)
    positions, normals = positions[used], normals[used]
    triangles = remap.reshape(-1, 3).astype('<u4')
    positions = positions @ matrix[:3, :3].T + matrix[:3, 3]
    normals = normals @ normal_matrix.T
    normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-15)
    if np.linalg.det(matrix[:3, :3]) < 0:
        triangles = triangles[:, [0, 2, 1]]
    positions_out.append(positions)
    material = copy.deepcopy(cad.data['materials'][primitive['material']])
    materials.append(material)
    primitives.append({'attributes': {
        'POSITION': accessor(positions.astype('<f4'), 'VEC3', 5126, 34962),
        'NORMAL': accessor(normals.astype('<f4'), 'VEC3', 5126, 34962)},
        'indices': accessor(triangles.reshape(-1), 'SCALAR', 5125, 34963),
        'material': len(materials) - 1, 'mode': 4})

extras = {'motion_group': 'link_3', 'part_key': 'mission-transmitter',
          'source_asset': 'arm', 'source_node_index': source_node,
          'source_node_name': cad.name(source_node),
          'hidden_features': [] if options.include_rear_leads else [f['name'] for f in hidden_features],
          'coordinate_frame': 'arm-parts rest frame, metre, right-handed +Y up; source world matrix already baked'}
model = {'asset': {'version': '2.0', 'generator': 'extract-mission-transmitter.py'},
         'scene': 0, 'scenes': [{'nodes': [0]}],
         'nodes': [{'name': 'mission-transmitter', 'mesh': 0, 'extras': extras}],
         'meshes': [{'name': 'VT03-original-CAD', 'primitives': primitives}],
         'materials': materials, 'buffers': [{'byteLength': len(payload)}],
         'bufferViews': views, 'accessors': accessors}
header = json.dumps(model, ensure_ascii=False, separators=(',', ':')).encode('utf8')
header += b' ' * (-len(header) % 4)
payload.extend(b'\0' * (-len(payload) % 4))
result = (struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(header) + 8 + len(payload))
          + struct.pack('<II', len(header), 0x4E4F534A) + header
          + struct.pack('<II', len(payload), 0x004E4942) + payload)
OUTPUT.write_bytes(result)

positions = np.concatenate(positions_out)
camera_axis = -matrix[:3, 0] / np.linalg.norm(matrix[:3, 0])
record = {'schema_version': 2, 'asset': str(OUTPUT.relative_to(ROOT)).replace('\\', '/'),
          'source': str(SOURCE.relative_to(ROOT)).replace('\\', '/'),
          'source_sha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
          'source_node_index': source_node, 'source_node_name': cad.name(source_node),
          'source_hierarchy': [cad.name(i) for i in cad.ancestry(source_node)],
          'motion_group': 'link_3', 'motion_evidence':
              'arm_source_mapping.json kept entry identifies source node 301 as link_3; it is a rigid part of L4 source assembly',
          'coordinate_frame': extras['coordinate_frame'],
          'runtime_matrix': "state.body * armMotionMatrices(meta.motion, q).get('link_3')",
          'rest_matrix': np.eye(4).reshape(-1).tolist(),
          'source_matrix_baked': matrix.tolist(),
          'geometry_policy': 'Original CAD tessellation/materials; two whole rear lead feature groups hidden by default. Housing, fins, lens, mounting ears and short housing-side ports unchanged. No proxy or decimation.',
          'sourceTriangles': len(native_triangles), 'triangles': int(feature_mask.sum()),
          'hiddenFeatures': [] if options.include_rear_leads else hidden_features,
          'featureIdentification': {'method': 'Source native-space connected components at0.1micrometre seam weld; exact original source-face exclusion, no plane crop.',
                                    'sourceComponents': len(components), 'longLeadCount': 2,
                                    'includeRearLeadsFlag': options.include_rear_leads},
          'cameraOpticalAxis': {'nativeAxis': [-1, 0, 0], 'armRestAxis': camera_axis.tolist(),
              'restPitchDegrees': float(np.degrees(np.arcsin(camera_axis[1]))),
              'evidence': 'Source301 front15mm lens component firstFace170393. Its447 near-axis front-face triangles, beginning170633, have area-weighted native normal[-.999999949,.000145222,.000000765]. Lens symmetry gives nominal native-X optical axis, opposite rear leads. This differs from tool suction normal.',
              'nativeLensBoundsM': {'min': [-.0439436622,.0046293335,-.0074996976], 'max': [-.0420174450,.0196293332,.0075003025]}},
          'primitive_count': len(primitives), 'materials': materials,
          'bounds_m': {'min': positions.min(axis=0).tolist(), 'max': positions.max(axis=0).tolist()},
          'omission_cause': 'build-arm-parts.py intentionally excludes sensor/transmitter names including VT03; arm-context excludes the complete arm subtree.',
          'existing_parts_retained': 'UWB支架、图传段碳纤管、图传段碳纤管2、RM_UWB、4mm_L4_图传支架板 already exist in arm-parts. This supplement adds only the VT03 source mesh.',
          'bytes': len(result), 'sha256': hashlib.sha256(result).hexdigest()}
OUTPUT.with_suffix('.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print(json.dumps({'asset': record['asset'], 'motion_group': record['motion_group'],
                  'triangles': record['triangles'], 'bytes': record['bytes'],
                  'bounds_m': record['bounds_m']}, ensure_ascii=False))
