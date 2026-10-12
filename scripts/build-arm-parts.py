"""Read archived CAD exports; write a Draco part model only inside this worktree.

Usage: blender --background --python scripts/build-arm-parts.py -- --source-root <repo>
The source repository and all CAD inputs are read-only. No .blend is saved.
"""
import argparse
import hashlib
import json
import math
import pathlib
import re
import struct
import sys
import importlib.util

import copy
import itertools
from collections import Counter
import numpy as np

args = argparse.ArgumentParser()
args.add_argument('--source-root', type=pathlib.Path, required=True)
args.add_argument('--audit-only', action='store_true', help='List missing source nodes without Blender; exit 1 until coverage is complete.')
options = args.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:])
root = pathlib.Path(__file__).resolve().parents[1]
source = options.source_root.resolve()
out = root / 'materials/models/derived/web'
work = root / 'tmp/arm-explode'
work.mkdir(parents=True, exist_ok=True)
audit = source / 'materials/documents/derived/audits/codex'
inputs = source / 'materials/models/derived/inputs/codex'
old_mapping = json.loads((audit / 'arm_source_mapping.json').read_text(encoding='utf8'))['kept']
joints = json.loads((root / 'materials/models/derived/web/arm-joints.json').read_text(encoding='utf8'))


class Cad:
    """Read only the JSON header and one mesh at a time, never a whole 300 MB buffer."""
    def __init__(self, asset, path):
        self.asset, self.path = asset, path
        with path.open('rb') as stream:
            stream.seek(12)
            length, kind = struct.unpack('<II', stream.read(8))
            assert kind == 0x4E4F534A
            self.data = json.loads(stream.read(length))
        self.binary_start = 28 + length
        self.parents = {child: i for i, node in enumerate(self.data['nodes']) for child in node.get('children', [])}
        self.world = {}
        self.stats = {}

    def name(self, i):
        return self.data['nodes'][i].get('extras', {}).get('source_node_name', '')

    def ancestry(self, i):
        chain = [i]
        while i in self.parents:
            i = self.parents[i]
            chain.append(i)
        return chain

    def matrix(self, i):
        if i in self.world:
            return self.world[i]
        node = self.data['nodes'][i]
        if 'matrix' in node:
            local = np.array(node['matrix']).reshape(4, 4).T
        else:
            x, y, z, w = node.get('rotation', [0, 0, 0, 1])
            rotation = np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
                                 [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
                                 [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])
            local = np.eye(4)
            local[:3, :3] = rotation @ np.diag(node.get('scale', [1, 1, 1]))
            local[:3, 3] = node.get('translation', [0, 0, 0])
        self.world[i] = (self.matrix(self.parents[i]) if i in self.parents else np.eye(4)) @ local
        return self.world[i]

    def bounds(self, i, transform=None):
        matrix = (np.eye(4) if transform is None else transform) @ self.matrix(i)
        corners = []
        for primitive in self.data['meshes'][self.data['nodes'][i]['mesh']]['primitives']:
            accessor = self.data['accessors'][primitive['attributes']['POSITION']]
            corners.extend((matrix @ np.array([*point, 1]))[:3] for point in itertools.product(*zip(accessor['min'], accessor['max'])))
        return {'min': np.min(corners, axis=0).tolist(), 'max': np.max(corners, axis=0).tolist()}

    def accessor(self, i, stream):
        a = self.data['accessors'][i]
        v = self.data['bufferViews'][a['bufferView']]
        dtype = np.dtype({5121: 'u1', 5123: '<u2', 5125: '<u4', 5126: '<f4'}[a['componentType']])
        columns = {'SCALAR': 1, 'VEC3': 3}[a['type']]
        stride = v.get('byteStride', dtype.itemsize * columns)
        stream.seek(self.binary_start + v.get('byteOffset', 0) + a.get('byteOffset', 0))
        raw = stream.read((a['count'] - 1) * stride + columns * dtype.itemsize)
        return np.ndarray((a['count'], columns), dtype=dtype, buffer=raw, strides=(stride, dtype.itemsize)).copy()

    def mesh_stats(self, i):
        if i in self.stats:
            return self.stats[i]
        volume, count = 0., 0
        moment = np.zeros(3)
        with self.path.open('rb') as stream:
            for primitive in self.data['meshes'][self.data['nodes'][i]['mesh']]['primitives']:
                vertices = self.accessor(primitive['attributes']['POSITION'], stream).astype(np.float64)
                indices = self.accessor(primitive['indices'], stream).reshape(-1, 3)
                tris = vertices[indices]
                # Signed triangle-mesh volume, meaningful for closed consistently wound CAD shells.
                signed = np.einsum('ij,ij->i', tris[:, 0], np.cross(tris[:, 1], tris[:, 2])) / 6
                primitive_volume = float(signed.sum())
                centroid = (signed[:, None] * tris.sum(axis=1) / 4).sum(axis=0) / primitive_volume if abs(primitive_volume) > 1e-18 else vertices.mean(axis=0)
                moment += centroid * abs(primitive_volume)
                volume += abs(primitive_volume)
                count += len(indices)
        centroid = (self.matrix(i) @ np.array([*(moment / volume if volume > 1e-18 else np.zeros(3)), 1]))[:3]
        result = {'triangles': count, 'mesh_volume_m3': volume * abs(float(np.linalg.det(self.matrix(i)[:3, :3]))), 'mesh_centroid_m': centroid.tolist()}
        self.stats[i] = result
        return result


arm = Cad('arm', inputs / 'arm_tagged.glb')
engineer = Cad('engineer', inputs / 'engineer_tagged.glb')
arm_root = next(i for i in range(len(engineer.data['nodes'])) if engineer.name(i) == 'Robotic arm_v2.2025.10.1')
gimbal_root = engineer.parents[arm_root]
engineer_to_arm = np.linalg.inv(engineer.matrix(arm_root))
arm_nodes = [i for i, n in enumerate(arm.data['nodes']) if 'mesh' in n]
engineer_arm = [i for i, n in enumerate(engineer.data['nodes']) if 'mesh' in n and arm_root in engineer.ancestry(i)]
known = {m['source_node_index']: m for m in old_mapping if m['source_asset'] == 'arm'}
arm_bounds = {i: arm.bounds(i) for i in arm_nodes}
center = lambda b: np.array([(a + c) / 2 for a, c in zip(b['min'], b['max'])])
known_by_branch = {}
for i in known:
    branch = arm.ancestry(i)[-2]
    known_by_branch.setdefault(branch, []).append(i)

def link_for(i):
    if i in known:
        return known[i]['link']
    chain = arm.ancestry(i)
    motor = next((k for k in reversed(chain) if re.match(r'^(MG4010|MG8010|MG8016|M3508|M2006)', arm.name(k))), None)
    if motor is not None:
        motor_links = [known[k]['link'] for k in known if motor in arm.ancestry(k)]
        if motor_links:
            return Counter(motor_links).most_common(1)[0][0]
    branch = chain[-2]
    if arm.name(branch) == 'limitation.2025.10.1':
        return 'link_1_left'
    # Fill the old rigid-link map using nearest retained mounting bodies within the CAD branch.
    anchors = known_by_branch.get(branch, list(known))
    return known[min(anchors, key=lambda k: float(np.linalg.norm(center(arm_bounds[k]) - center(arm_bounds[i]))))]['link']

mapping = [{'source_asset': 'arm', 'source_node_index': i, 'source_node_name': arm.name(i),
            'source_hierarchy': [arm.name(k) for k in arm.ancestry(i)], 'link': link_for(i)} for i in arm_nodes]
# Recover the complete J1 chain drive on the left of the arm, absent from the standalone arm export.
# The J0 turntable, its rear chain and chassis remain outside this presentation's arm boundary.
extra_nodes = []
excluded = []
for i, node in enumerate(engineer.data['nodes']):
    if 'mesh' not in node or gimbal_root not in engineer.ancestry(i) or arm_root in engineer.ancestry(i):
        continue
    name = engineer.name(i)
    box = engineer.bounds(i, engineer_to_arm)
    low, high = np.array(box['min']), np.array(box['max'])
    left_region = low[0] > -.195 and high[0] < .025 and low[2] > -.065 and high[2] < .18 and high[1] < -.015
    selected = left_region and not any(token in name for token in ['RM_主控', 'J0'])
    if selected:
        extra_nodes.append(i)
        is_mount = 'RA6008' in name or '30teeth_从动轮' in name or '6706' in name
        mapping.append({'source_asset': 'engineer', 'source_node_index': i, 'source_node_name': name,
                        'source_hierarchy': [engineer.name(k) for k in engineer.ancestry(i)],
                        'link': 'link_1' if is_mount else 'link_1_left'})
    else:
        excluded.append({'index': i, 'node_name': name, 'bounds': box, 'reason': 'Outside J1 arm drive boundary (J0 turntable/rear drive/chassis electronics or cup).'})

current = json.loads((out / 'arm-parts.json').read_text(encoding='utf8'))
present = {(m['asset'], m['index']) for part in current['parts'] for m in part['members']}
old_gimbal = {m['node_name'] for part in current['parts'] for m in part['members'] if m['asset'] == 'gimbal'}
comparison = []
for i in arm_nodes:
    name = arm.name(i)
    candidates = [k for k in engineer_arm if engineer.name(k).endswith('/' + name)]
    if not candidates:
        candidates = [k for k in engineer_arm if engineer.name(k).split('/')[-1] == name.split('/')[-1]]
    match = min(candidates, key=lambda k: float(np.linalg.norm(center(engineer.bounds(k, engineer_to_arm)) - center(arm_bounds[i])))) if candidates else None
    delta = max(abs(a - b) for edge in ['min', 'max'] for a, b in zip(arm_bounds[i][edge], engineer.bounds(match, engineer_to_arm)[edge])) if match is not None else None
    arm_stats, engineer_stats = arm.mesh_stats(i), engineer.mesh_stats(match) if match is not None else None
    volume_delta = abs(arm_stats['mesh_volume_m3'] - engineer_stats['mesh_volume_m3'] * abs(float(np.linalg.det(engineer_to_arm[:3, :3])))) if engineer_stats else None
    comparison.append({'arm_index': i, 'engineer_index': match, 'bounds_max_delta_m': delta,
                       'arm_mesh_volume_m3': arm_stats['mesh_volume_m3'], 'engineer_mesh_volume_m3': engineer_stats['mesh_volume_m3'] if engineer_stats else None,
                       'mesh_volume_delta_m3': volume_delta, 'triangles_match': engineer_stats is not None and arm_stats['triangles'] == engineer_stats['triangles']})
if len({c['engineer_index'] for c in comparison}) != len(arm_nodes) or any(c['bounds_max_delta_m'] is None or c['bounds_max_delta_m'] > .002 or not c['triangles_match'] or c['mesh_volume_delta_m3'] > 1e-8 for c in comparison):
    (work / 'source-comparison.json').write_text(json.dumps(comparison, indent=2), encoding='utf8')
    raise RuntimeError('Standalone arm and engineer subtree do not match; inspect source-comparison.json before exporting')

missing = []
restored = []
source_nodes = []
baseline = {(m['source_asset'], m['source_node_index']) for m in old_mapping}
baseline_gimbal_names = [m['source_node_name'] for m in old_mapping if m['source_asset'] == 'gimbal']
for item in mapping:
    asset, i = item['source_asset'], item['source_node_index']
    cad = arm if asset == 'arm' else engineer
    box = arm_bounds[i] if asset == 'arm' else engineer.bounds(i, engineer_to_arm)
    record = {**item, 'bounds': box, 'bbox_volume_m3': float(np.prod(np.array(box['max']) - np.array(box['min']))), **cad.mesh_stats(i)}
    if asset == 'engineer':
        record['mesh_volume_m3'] *= abs(float(np.linalg.det(engineer_to_arm[:3, :3])))
        record['mesh_centroid_m'] = (engineer_to_arm @ np.array([*record['mesh_centroid_m'], 1]))[:3].tolist()
    source_nodes.append(record)
    if (asset, i) not in baseline and not (asset == 'engineer' and any(item['source_node_name'] == n or item['source_node_name'].endswith('/' + n) for n in baseline_gimbal_names)):
        restored.append(record)
    if (asset, i) not in present and not (asset == 'engineer' and any(item['source_node_name'] == n or item['source_node_name'].endswith('/' + n) for n in old_gimbal)):
        missing.append(record)
coverage = {'arm_source_meshes': len(arm_nodes), 'engineer_arm_meshes': len(engineer_arm), 'matched_meshes': len(comparison),
            'max_source_bounds_delta_m': max(c['bounds_max_delta_m'] for c in comparison), 'j1_drive_source_meshes': len(extra_nodes),
            'missing_count': len(missing), 'missing_nodes': missing, 'restored_from_original_mapping_count': len(restored), 'restored_nodes': restored, 'source_comparison': comparison,
            'volume_method': 'Absolute signed triangle-mesh volume per source primitive; open or inconsistent shells are not physical mass/volume proof.',
            'excluded_engineer_nodes': excluded}
(work / 'coverage.json').write_text(json.dumps(coverage, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print('COVERAGE', len(arm_nodes), 'arm meshes;', len(extra_nodes), 'J1 drive meshes;', len(missing), 'missing', flush=True)
if options.audit_only:
    sys.exit(1 if missing else 0)

import bmesh
import bpy
from mathutils import Matrix, Vector
C = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))


def read_glb(path):
    data = path.read_bytes()
    length, kind = struct.unpack_from('<II', data, 12)
    assert kind == 0x4E4F534A
    return json.loads(data[20:20 + length]), data[28 + length:]


def write_glb(path, data, binary):
    encoded = json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode('utf8')
    encoded += b' ' * (-len(encoded) % 4)
    binary += b'\0' * (-len(binary) % 4)
    path.write_bytes(struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(binary))
                     + struct.pack('<II', len(encoded), 0x4E4F534A) + encoded
                     + struct.pack('<II', len(binary), 0x004E4942) + binary)


def triangles(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


bpy.ops.wm.read_factory_settings(use_empty=True)
sources = []
for asset, filename in [('arm', 'arm_tagged.glb'), ('engineer', 'engineer_tagged.glb')]:
    path = inputs / filename
    with path.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    sources.append({'path': str(path.relative_to(source)), 'sha256': digest})
    gltf, binary = read_glb(path)
    # Preserve original matrices/hierarchy but import only audited retained meshes.
    selected = {item['source_node_index'] for item in mapping if item['source_asset'] == asset}
    cad = arm if asset == 'arm' else engineer
    nodes = []
    for i, node in enumerate(gltf['nodes']):
        if node.get('extras', {}).get('source_node_index') not in selected:
            continue
        node = copy.deepcopy(node)
        for prop in ['children', 'rotation', 'translation', 'scale', 'camera']:
            node.pop(prop, None)
        world = (np.eye(4) if asset == 'arm' else engineer_to_arm) @ cad.matrix(i)
        node['matrix'] = world.T.reshape(-1).tolist()
        node['extras']['motor_assembly'] = next((cad.name(k) for k in reversed(cad.ancestry(i)) if re.match(r'^(MG4010|MG8010|MG8016|M3508|M2006)', cad.name(k))), '')
        nodes.append(node)
    gltf['nodes'] = nodes
    gltf['scenes'] = [{'nodes': list(range(len(nodes)))}]
    gltf['scene'] = 0
    filtered = work / f'{asset}-selected.glb'
    write_glb(filtered, gltf, binary)
    bpy.ops.import_scene.gltf(filepath=str(filtered))

palette = {}
for name, color, metal, rough in [
    ('aluminium', (.38, .42, .47, 1), .65, .42),
    ('motor', (.075, .085, .10, 1), .45, .4),
    ('carbon', (.025, .032, .04, 1), .05, .64),
    ('print_black', (.045, .05, .06, 1), 0, .68),
    ('rubber', (.035, .04, .045, 1), 0, .82),
    ('misc', (.67, .69, .71, 1), .05, .57),
]:
    mat = bpy.data.materials.new(name)
    # Blender 5.1 creates node materials by default; avoid its deprecated setter.
    if mat.node_tree is None:
        mat.use_nodes = True
    mat.diffuse_color = color
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = color
    shader.inputs['Metallic'].default_value = metal
    shader.inputs['Roughness'].default_value = rough
    palette[name] = mat

by_source = {(o.get('source_asset'), o.get('source_node_index')): o for o in bpy.context.scene.objects if o.type == 'MESH'}
groups = {}
for item in mapping:
    obj = by_source[(item['source_asset'], item['source_node_index'])]
    motor = obj.get('motor_assembly', '')
    name = item['source_node_name']
    # A toothed belt is one purchased part; CAD exported its individual teeth.
    belt = 'Synchronousbelt' in name
    chain = '04C链节' in name
    key = f"motor_{item['source_asset']}_{item['link']}_{motor}" if motor else f"belt_{item['link']}_{name.split('-')[0]}" if belt else f"chain_{item['link']}" if chain else obj.name
    group = groups.setdefault(key, {'objects': [], 'members': [], 'name': motor if motor else '04C链节' if chain else name,
                                    'link': item['link'], 'motor': bool(motor), 'belt': belt})
    group['objects'].append(obj)
    group['members'].append({'asset': item['source_asset'], 'index': item['source_node_index'], 'node_name': name})
    world = obj.matrix_world.copy()
    obj.data = obj.data.copy()
    obj.parent = None
    obj.matrix_world = Matrix.Identity(4)
    obj.data.transform(world)
    source_materials = [material.name for material in obj.data.materials if material]
    if motor:
        kind = 'motor'
    elif belt or any(s in name for s in ['聚氨酯轮', '吸盘', 'Synchronousbelt']):
        kind = 'rubber' if '吸盘' not in name else 'misc'
    elif any('carbonfiber' in material.lower() for material in source_materials) or any(s in name for s in ['交叉加固', '竖直加固', '碳']):
        kind = 'carbon'
    elif any(s in name for s in ['保护罩', '管夹', '图传', 'VT03']):
        kind = 'print_black'
    elif any(s.lower() in name.lower() for s in ['gear', 'teeth', '轴cnc', '传动轴', '轴承', '联轴器', 'RA6008', 'KSL', 'POC']):
        kind = 'aluminium'
    else:
        kind = 'aluminium'
    group['material'] = kind
    group.setdefault('source_materials', set()).update(source_materials)
    obj.data.materials.clear()
    obj.data.materials.append(palette[kind])
    for polygon in obj.data.polygons:
        polygon.material_index = 0

keep = {o for group in groups.values() for o in group['objects']}
for obj in list(bpy.context.scene.objects):
    if obj not in keep:
        bpy.data.objects.remove(obj, do_unlink=True)

parts = []
for index, (key, group) in enumerate(groups.items()):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in group['objects']:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = group['objects'][0]
    if len(group['objects']) > 1:
        bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = f'part_{index:03d}'
    # Clean CAD duplicates without collapsing motor, tooth or carbon surfaces.
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    before_faces = len(bm.faces)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-8)
    bm.verts.index_update()
    seen = set()
    duplicate_faces = []
    for face in bm.faces:
        signature = tuple(sorted(v.index for v in face.verts))
        if signature in seen or face.calc_area() < 1e-16:
            duplicate_faces.append(face)
        else:
            seen.add(signature)
    if duplicate_faces:
        bmesh.ops.delete(bm, geom=duplicate_faces, context='FACES_ONLY')
    bmesh.ops.dissolve_degenerate(bm, edges=list(bm.edges), dist=1e-8)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    removed = before_faces - len(bm.faces)
    bm.free()
    count = triangles(obj)
    protected = group['motor'] or group['material'] == 'carbon' or any(s in group['name'].lower() for s in ['gear', 'teeth', '同步轮'])
    # Preserve all structural and motor tessellation. Only sub-pixel screw thread detail is budgeted.
    thread = bool(re.search(r'螺|screw|nut|DIN', group['name'], re.I)) and not group['motor']
    limit = 600 if thread else count
    if not protected and count > limit:
        modifier = obj.modifiers.new('Web silhouette budget', 'DECIMATE')
        modifier.ratio = limit / count
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    try:
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    except RuntimeError:
        pass
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35), keep_sharp_edges=False)
    # Area weighting prevents small bevels from bending broad planar CAD faces.
    if not group['motor']:
        normal = obj.modifiers.new('CAD planar normals', 'WEIGHTED_NORMAL')
        normal.keep_sharp = True
        normal.weight = 50
        bpy.ops.object.modifier_apply(modifier=normal.name)
    for prop in list(obj.keys()):
        del obj[prop]
    obj['part_key'] = obj.name
    obj['node_name'] = group['name']
    obj['link'] = group['link']
    obj['motor'] = group['motor']
    records = [n for n in source_nodes if (n['source_asset'], n['source_node_index']) in {(m['asset'], m['index']) for m in group['members']}]
    geometric_volume = sum(n['mesh_volume_m3'] for n in records)
    geometric_center = [sum(n['mesh_centroid_m'][i] * n['mesh_volume_m3'] for n in records) / max(geometric_volume, 1e-20) for i in range(3)]
    parts.append({'key': obj.name, 'node_name': group['name'], 'link': group['link'], 'motor': group['motor'],
                  'geometry_volume_m3': geometric_volume, 'geometry_centroid_m': geometric_center,
                  'members': group['members'], 'material': group['material'], 'source_materials': sorted(group['source_materials']), 'source_triangles': count,
                  'removed_faces': removed, 'triangles': triangles(obj)})
    group['object'] = obj
    print('PART', index, 'triangles', triangles(obj), flush=True)

bpy.context.view_layer.update()
for part, group in zip(parts, groups.values()):
    points = [C.transposed() @ (group['object'].matrix_world @ Vector(corner)) for corner in group['object'].bound_box]
    part['bounds'] = {'min': [min(p[i] for p in points) for i in range(3)],
                      'max': [max(p[i] for p in points) for i in range(3)]}

spec = importlib.util.spec_from_file_location('arm_layout', pathlib.Path(__file__).with_name('arm-explosion-layout.py'))
layout = importlib.util.module_from_spec(spec)
spec.loader.exec_module(layout)
layout.plan(parts, joints)

# One draw per material in each mounting bundle; screws/bearings share their body's transform.
# Do not merge across moving bundles or across complete motors.
merge_groups = {}
by_object = {group['object'].name: group['object'] for group in groups.values()}
for part in parts:
    key = (part['group'], part['assembly_bundle'], part['material'])
    merge_groups.setdefault(key, []).append(part)
merged = []
for batch in merge_groups.values():
    host = next((p for p in batch if p['key'] == p['assembly_bundle']), batch[0])
    volume = sum(p['geometry_volume_m3'] for p in batch)
    centroid = [sum(p['geometry_centroid_m'][i]*p['geometry_volume_m3'] for p in batch) / max(volume, 1e-20) for i in range(3)]
    bpy.ops.object.select_all(action='DESELECT')
    for part in batch:
        by_object[part['key']].select_set(True)
    bpy.context.view_layer.objects.active = by_object[host['key']]
    if len(batch) > 1:
        bpy.ops.object.join()
    obj = bpy.context.object
    host['members'] = [m for part in batch for m in part['members']]
    host['source_triangles'] = sum(p['source_triangles'] for p in batch)
    host['removed_faces'] = sum(p['removed_faces'] for p in batch)
    host['triangles'] = triangles(obj)
    host['source_materials'] = sorted({m for p in batch for m in p['source_materials']})
    host['bounds'] = {'min': [min(p['bounds']['min'][i] for p in batch) for i in range(3)],
                      'max': [max(p['bounds']['max'][i] for p in batch) for i in range(3)]}
    host['geometry_volume_m3'] = volume
    host['geometry_centroid_m'] = centroid
    merged.append(host)
parts = merged
# Refit the same radial plan to the final rigid bundles, matching the runtime metadata exactly.
layout.plan(parts, joints)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(out / 'arm-parts.glb'), export_format='GLB', use_selection=True,
                          export_yup=True, export_normals=True, export_apply=True, export_texcoords=False,
                          export_materials='EXPORT', export_cameras=False, export_lights=False, export_extras=True,
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=10,
                          export_draco_position_quantization=12, export_draco_normal_quantization=8)
# Blender limits object-name bytes. Restore exact original names in the GLB JSON.
gltf, binary = read_glb(out / 'arm-parts.glb')
by_key = {p['key']: p for p in parts}
for node in gltf['nodes']:
    key = node.get('extras', {}).get('part_key')
    if key in by_key:
        node['name'] = by_key[key]['node_name']
write_glb(out / 'arm-parts.glb', gltf, binary)
coverage['missing_count_after_export'] = 0
meta = {'schema_version': 3, 'units': 'metres', 'coordinate_frame': joints['coordinate_frame'],
        'sources': sources, 'mapping_source': 'Complete arm_tagged subtree, old rigid-link map as mounting hints, and engineer_tagged J1 drive bounding region; no source mesh exclusions within the arm.',
        'joint_source': 'arm-joints.json', 'motor_policy': 'Complete source motor assemblies; rigid translation with the owning link, no internal separation.',
        'belt_policy': 'CAD tooth segments joined into one belt part per link and belt specification.',
        'explosion_policy': 'Two stages: radial CAD group separation about the complete arm volume-weighted geometric center, then small mounting-axis part offsets. Close in reverse stage order. Complete motors and mounting bundles remain rigid.',
        'quality_policy': {'position_bits': 12, 'normal_bits': 8, 'protected': 'Structural parts, motors, bearings, chains, gears and pulleys retain cleaned source tessellation. Screw/nut thread detail is limited to 600 triangles per source object.', 'normals': '35 degree smoothing; area-weighted planar normals except motors.', 'merge': 'Same material within rigid mounting bundles only.'},
        'groups': layout.groups(parts), 'coverage': coverage, 'source_nodes': source_nodes,
        'parts': parts, 'triangles': sum(p['triangles'] for p in parts),
        'draco_bytes': (out / 'arm-parts.glb').stat().st_size}
(out / 'arm-parts.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print('COMPLETE', len(parts), 'parts', meta['triangles'], 'triangles', meta['draco_bytes'], 'bytes', flush=True)
