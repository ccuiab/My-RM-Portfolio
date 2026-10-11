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

import bmesh
import bpy
from mathutils import Matrix, Vector

args = argparse.ArgumentParser()
args.add_argument('--source-root', type=pathlib.Path, required=True)
options = args.parse_args(sys.argv[sys.argv.index('--') + 1:])
root = pathlib.Path(__file__).resolve().parents[1]
source = options.source_root.resolve()
out = root / 'materials/models/derived/web'
work = root / 'tmp/arm-explode'
work.mkdir(parents=True, exist_ok=True)
audit = source / 'materials/documents/derived/audits/codex'
inputs = source / 'materials/models/derived/inputs/codex'
mapping = json.loads((audit / 'arm_source_mapping.json').read_text(encoding='utf8'))['kept']
joints = json.loads((root / 'materials/models/derived/web/arm-joints.json').read_text(encoding='utf8'))
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
for asset, filename in [('arm', 'arm_tagged.glb'), ('gimbal', 'base_tagged.glb')]:
    path = inputs / filename
    sources.append({'path': str(path.relative_to(source)), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    gltf, binary = read_glb(path)
    # Preserve original matrices/hierarchy but import only audited retained meshes.
    selected = {item['source_node_index'] for item in mapping if item['source_asset'] == asset}
    for node in gltf['nodes']:
        if node.get('extras', {}).get('source_node_index') not in selected:
            node.pop('mesh', None)
        node.pop('camera', None)
    filtered = work / f'{asset}-selected.glb'
    write_glb(filtered, gltf, binary)
    bpy.ops.import_scene.gltf(filepath=str(filtered))

palette = {}
for name, color, metal, rough in [
    ('alu_black', (.085, .095, .11, 1), .55, .4),
    ('alu_silver', (.54, .58, .62, 1), .65, .34),
    ('carbon', (.035, .042, .05, 1), .18, .47),
    ('print_black', (.045, .05, .06, 1), 0, .68),
    ('rubber', (.035, .04, .045, 1), 0, .82),
    ('misc', (.67, .69, .71, 1), .05, .57),
]:
    mat = bpy.data.materials.new(name)
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
    motor = None
    ancestor = obj
    while ancestor:
        if re.match(r'^(MG4010|MG8010|MG8016|M3508|M2006)', ancestor.get('source_node_name', '')):
            motor = ancestor
        ancestor = ancestor.parent
    name = item['source_node_name']
    # A toothed belt is one purchased part; CAD exported its individual teeth.
    belt = 'Synchronousbelt' in name
    key = motor.name if motor else f"belt_{item['link']}_{name.split('-')[0]}" if belt else obj.name
    group = groups.setdefault(key, {'objects': [], 'members': [], 'name': motor.get('source_node_name') if motor else name,
                                    'link': item['link'], 'motor': bool(motor), 'belt': belt})
    group['objects'].append(obj)
    group['members'].append({'asset': item['source_asset'], 'index': item['source_node_index'], 'node_name': name})
    world = obj.matrix_world.copy()
    obj.data = obj.data.copy()
    obj.parent = None
    obj.matrix_world = Matrix.Identity(4)
    obj.data.transform(world)
    if belt or any(s in name for s in ['聚氨酯轮', '吸盘', 'Synchronousbelt']):
        kind = 'rubber' if '吸盘' not in name else 'misc'
    elif any(s in name for s in ['交叉加固', '竖直加固', '碳']):
        kind = 'carbon'
    elif any(s in name for s in ['保护罩', '管夹', '图传', 'VT03']):
        kind = 'print_black'
    elif any(s.lower() in name.lower() for s in ['gear', 'teeth', '轴cnc', '传动轴', '轴承', '联轴器', 'RA6008', 'KSL', 'POC']):
        kind = 'alu_silver'
    else:
        kind = 'alu_black'
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
    # Weld CAD face seams before reducing; keep the outside silhouette.
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
    bm.to_mesh(obj.data)
    bm.free()
    count = triangles(obj)
    limit = 1800 if group['motor'] else 2200 if 'gear' in group['name'].lower() else 1400
    if count > limit:
        modifier = obj.modifiers.new('Web silhouette budget', 'DECIMATE')
        modifier.ratio = limit / count
        modifier.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    try:
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    except RuntimeError:
        pass
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35), keep_sharp_edges=False)
    for prop in list(obj.keys()):
        del obj[prop]
    obj['part_key'] = obj.name
    obj['node_name'] = group['name']
    obj['link'] = group['link']
    obj['motor'] = group['motor']
    parts.append({'key': obj.name, 'node_name': group['name'], 'link': group['link'], 'motor': group['motor'],
                  'members': group['members'], 'triangles': triangles(obj)})
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

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(out / 'arm-parts.glb'), export_format='GLB', use_selection=True,
                          export_yup=True, export_normals=True, export_apply=True, export_texcoords=False,
                          export_materials='EXPORT', export_cameras=False, export_lights=False, export_extras=True,
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
                          export_draco_position_quantization=14, export_draco_normal_quantization=10)
# Blender limits object-name bytes. Restore exact original names in the GLB JSON.
gltf, binary = read_glb(out / 'arm-parts.glb')
by_key = {p['key']: p for p in parts}
for node in gltf['nodes']:
    key = node.get('extras', {}).get('part_key')
    if key in by_key:
        node['name'] = by_key[key]['node_name']
write_glb(out / 'arm-parts.glb', gltf, binary)
meta = {'schema_version': 1, 'units': 'metres', 'coordinate_frame': joints['coordinate_frame'],
        'sources': sources, 'mapping_source': 'materials/documents/derived/audits/codex/arm_source_mapping.json',
        'joint_source': 'arm-joints.json', 'motor_policy': 'Complete source motor assemblies, stationary at CAD rest position.',
        'belt_policy': 'CAD tooth segments joined into one belt part per link and belt specification.',
        'explosion_policy': 'Straight translation along joint axes or orthogonal assembly directions; full endpoint clearance and no new AABB crossings for initially disjoint pairs.',
        'parts': parts, 'triangles': sum(p['triangles'] for p in parts),
        'draco_bytes': (out / 'arm-parts.glb').stat().st_size}
(out / 'arm-parts.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print('COMPLETE', len(parts), 'parts', meta['triangles'], 'triangles', meta['draco_bytes'], 'bytes', flush=True)
