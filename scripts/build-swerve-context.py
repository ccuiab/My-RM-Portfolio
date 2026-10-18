"""Derive the swerve story's full-detail vehicle from the B-chapter CAD source.

Run: blender --background --python scripts/build-swerve-context.py
Only derived web files are written. No decimation, no native CAD access.
The existing arm-parts.glb and engineer-swerve.glb are reused at runtime.
"""
import ast
import hashlib
import itertools
import json
import math
import pathlib
import re
import struct
import sys

import bpy
import numpy as np

root = pathlib.Path(__file__).resolve().parents[1]
web = root / 'materials/models/derived/web'
tree = ast.parse((root / 'scripts/build-arm-parts.py').read_text(encoding='utf8'))
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'Cad'], type_ignores=[]), '<Cad>', 'exec'))
source = root / 'materials/models/derived/inputs/codex/engineer_tagged.glb'
cad = Cad('engineer', source)
module = Cad('module', web / 'engineer-swerve.glb')
arm = json.loads((web / 'arm-parts.json').read_text(encoding='utf8'))
wheel_roots = [21, 174, 287, 375]
inner_roots = [22, 175, 337, 425]
tire_roots = [31, 189, 348, 438]
module_nodes = {n.get('extras', {}).get('source_node_index'): i for i, n in enumerate(module.data['nodes']) if n.get('extras', {}).get('source_node_index') is not None and n.get('extras', {}).get('web_instance') != 'steering-pinion'}
# Recover the actual web frame from retained part origins, not an old sidecar.
centres = [((np.linalg.inv(cad.matrix(21)) @ cad.matrix(i))[:3, 3] - module.matrix(module_nodes[i])[:3, 3]) for i in [31, 58, 61]]
centre = np.mean(centres, axis=0)
assert max(np.linalg.norm(c - centre) for c in centres) < 1e-6, 'Module frame mismatch'
shift = np.eye(4)
shift[:3, 3] = centre
module_to_engineer = cad.matrix(21) @ shift
engineer_to_module = np.linalg.inv(module_to_engineer)

excluded = {m['index'] for p in arm['parts'] for m in p['members'] if m['asset'] == 'engineer'}
excluded.update(n['source_node_index'] for n in arm['coverage'].get('omitted_fastener_sources', []) if n['source_asset'] == 'engineer')
batches = {}
# Two mounts use a different outer shell and motor mesh. Keep these actual
# source geometries instead of substituting the other pair's same-name parts.
unique_fixed_parts = {214: 1, 215: 1, 377: 3, 378: 3}
for i, node in enumerate(cad.data['nodes']):
    if 'mesh' not in node or i in excluded or 477 in cad.ancestry(i) or (any(w in cad.ancestry(i) for w in wheel_roots) and i not in unique_fixed_parts):
        continue
    name = cad.name(i)
    ancestry = ' '.join(cad.name(k) for k in cad.ancestry(i))
    materials = [cad.data.get('materials', [])[p['material']].get('name', '').lower() for p in cad.data['meshes'][node['mesh']]['primitives'] if 'material' in p]
    if re.search(r'MG[48]0|M3508|M2006|GM6020', ancestry): kind = 'motor'
    elif any('rubber' in m for m in materials) or any(s in name for s in ['聚氨酯', '包胶', '轮胎']): kind = 'rubber'
    elif any('carbon' in m for m in materials) or '碳' in name: kind = 'carbon'
    elif any(s in name for s in ['保护罩', '管夹', '电池', '电路', '遥控', '接收机']): kind = 'print_black'
    elif any('plastic' in m for m in materials): kind = 'print_black'
    else: kind = 'aluminium'
    batches.setdefault((kind, unique_fixed_parts.get(i, -1)), []).append(i)

bpy.ops.wm.read_factory_settings(use_empty=True)
palette = {}
for name, colour, metal, rough in [('aluminium', (.38, .42, .47, 1), .65, .42), ('motor', (.075, .085, .10, 1), .45, .4), ('carbon', (.025, .032, .04, 1), .05, .64), ('print_black', (.045, .05, .06, 1), 0, .68), ('rubber', (.035, .04, .045, 1), 0, .82)]:
    mat = bpy.data.materials.new(name)
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = colour
    shader.inputs['Metallic'].default_value = metal
    shader.inputs['Roughness'].default_value = rough
    palette[name] = mat
C = np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]])
records = []
metadata_only = '--metadata-only' in sys.argv
for (kind, fixed_wheel), ids in ([] if metadata_only else batches.items()):
    vertices, faces = [], []
    with source.open('rb') as stream:
        for i in ids:
            matrix = engineer_to_module @ cad.matrix(i)
            for primitive in cad.data['meshes'][cad.data['nodes'][i]['mesh']]['primitives']:
                v = cad.accessor(primitive['attributes']['POSITION'], stream).astype(np.float64)
                f = cad.accessor(primitive['indices'], stream).reshape(-1, 3)
                v = (v @ matrix[:3, :3].T + matrix[:3, 3]) @ C.T
                faces.extend((f + len(vertices)).tolist())
                vertices.extend(v.tolist())
    label = ('vehicle_' if fixed_wheel < 0 else f'wheel_{fixed_wheel}_fixed_') + kind
    mesh = bpy.data.meshes.new(label)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(label, mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    mesh.materials.append(palette[kind])
    for p in mesh.polygons: p.use_smooth = True
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(32), keep_sharp_edges=False)
    obj['swerve_context'] = True
    if fixed_wheel >= 0: obj['swerve_fixed_wheel'] = fixed_wheel
    obj.select_set(False)
    records.append({'material': kind, 'fixed_wheel': fixed_wheel, 'source_nodes': ids, 'source_triangles': len(faces), 'triangles': len(mesh.polygons)})
    print(kind, len(mesh.polygons), flush=True)

output = web / 'engineer-swerve-context.glb'
if metadata_only:
    records = json.loads((web / 'engineer-swerve-context.json').read_text(encoding='utf8'))['groups']
else:
    bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', export_yup=True, export_extras=True,
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
        export_draco_position_quantization=16, export_draco_normal_quantization=12)

def yaw(matrix): return math.atan2(matrix[0, 2], matrix[2, 2])
def normalise(angle): return (angle + math.pi) % (2 * math.pi) - math.pi
def subtree(index):
    return [i for i in range(len(cad.data['nodes'])) if index in cad.ancestry(i)]
def key(index): return cad.name(index).split('/', 1)[-1]
module_meshes = [(i, n) for i, n in enumerate(module.data['nodes']) if 'mesh' in n]
base_axis = np.array(next(n['extras']['web_axis'] for _, n in module_meshes if n.get('extras', {}).get('web_motion') == 'roll'))
wheels = []
for w, inner, tire in zip(wheel_roots, inner_roots, tire_roots):
    targets = {key(i): i for i in subtree(w) if 'mesh' in cad.data['nodes'][i]}
    part_matrices, matched_sources = {}, {}
    for i, node in module_meshes:
        data = node['extras']
        base_index = data['source_node_index']
        pinion = data.get('web_instance') == 'steering-pinion'
        # The four copies have different internal mounting positions, including
        # a 125 mm difference in inner/outer pivots. A rigid root copy is wrong.
        # Reuse mesh geometry, but retain every source part's own assembly frame.
        anchor = 61 if pinion else base_index
        target = targets[key(anchor)]
        change = engineer_to_module @ cad.matrix(target) @ np.linalg.inv(cad.matrix(anchor)) @ module_to_engineer
        matrix = change @ module.matrix(i)
        part_key = 'pinion' if pinion else str(base_index)
        part_matrices[part_key] = matrix.T.reshape(-1).tolist()
        matched_sources[part_key] = target
        if base_index == 31 and not pinion:
            axis = change[:3, :3] @ base_axis
            axis /= np.linalg.norm(axis)
    common_steer = normalise(math.atan2(base_axis[0], base_axis[2]) - math.atan2(axis[0], axis[2]))
    wheels.append({'source_root': w, 'inner_root': inner, 'tire_root': tire, 'matrix': np.eye(4).T.reshape(-1).tolist(),
                   'rest_steer': 0, 'common_steer': common_steer, 'roll_axis': axis.tolist(),
                   'steer_origin': (engineer_to_module @ cad.matrix(inner))[:3, 3].tolist(),
                   'part_matrices': part_matrices, 'matched_sources': matched_sources,
                   'source_tire_center': (engineer_to_module @ cad.matrix(tire))[:3, 3].tolist()})
info = {'schema_version': 1, 'source': str(source.relative_to(root)), 'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'module_sha256': hashlib.sha256((web / 'engineer-swerve.glb').read_bytes()).hexdigest(),
    'arm_sha256': hashlib.sha256((web / 'arm-parts.glb').read_bytes()).hexdigest(),
    'output_sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
    'decimated': False, 'position_quantisation_bits': 16, 'normal_quantisation_bits': 12,
    'groups': records, 'excluded_complete_wheel_roots': wheel_roots, 'unique_fixed_parts': unique_fixed_parts, 'wheels': wheels,
    'arm_to_module': (engineer_to_module @ cad.matrix(477)).T.reshape(-1).tolist(),
    'module_frame_error_m': max(float(np.linalg.norm(c - centre)) for c in centres),
    'geometry_policy': 'All retained source triangles; no decimation. Complete four wheel subtrees excluded; high-detail module instances and the existing B-chapter arm are loaded separately.'}
(web / 'engineer-swerve-context.json').write_text(json.dumps(info, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print(json.dumps({'triangles': sum(g['triangles'] for g in records), 'bytes': output.stat().st_size, 'frame_error_m': info['module_frame_error_m']}), flush=True)
