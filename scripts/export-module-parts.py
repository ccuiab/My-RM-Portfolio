"""Blender 5.1.1: read derived CAD exports, retain part pivots, export Draco GLBs.

Run from this worktree with Blender --background --python scripts/export-module-parts.py
-- --input-root <read-only materials/models/derived/inputs/module-models>.
Native CAD and input files are never saved. Only this worktree's web GLBs are written.
"""
import argparse
import hashlib
import json
import pathlib
import sys
import math
import copy
import struct
import tempfile
import bpy
import bmesh
from mathutils import Vector, Matrix

parser = argparse.ArgumentParser()
parser.add_argument('--input-root', required=True)
parser.add_argument('--full-input')
parser.add_argument('--audit')
parser.add_argument('--role', choices=['pump', 'swerve'])
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
root = pathlib.Path.cwd()
web = root / 'materials/models/derived/web'
audit = {'blender': bpy.app.version_string, 'units': 'metres', 'modules': {}}

def extract_module(source, target, root_index):
    """Read only referenced mesh buffers, including previously omitted gears."""
    with source.open('rb') as handle:
        handle.seek(12); length = struct.unpack('<I', handle.read(4))[0]; handle.read(4)
        data = json.loads(handle.read(length)); binary_start = 28 + length
        selected = []
        def visit(index):
            selected.append(index)
            for child in data['nodes'][index].get('children', []): visit(child)
        visit(root_index)
        node_map = {old: new for new, old in enumerate(selected)}
        out = {'asset': {'version': '2.0'}, 'scene': 0, 'scenes': [{'nodes': [0]}],
               'nodes': [], 'meshes': [], 'accessors': [], 'bufferViews': []}
        binary = bytearray(); view_map = {}; accessor_map = {}; mesh_map = {}
        def view(index):
            if index not in view_map:
                original = data['bufferViews'][index]
                while len(binary) % 4: binary.append(0)
                handle.seek(binary_start + original.get('byteOffset', 0))
                new = {**original, 'buffer': 0, 'byteOffset': len(binary)}
                binary.extend(handle.read(original['byteLength']))
                view_map[index] = len(out['bufferViews']); out['bufferViews'].append(new)
            return view_map[index]
        def accessor(index):
            if index not in accessor_map:
                new = copy.deepcopy(data['accessors'][index]); new['bufferView'] = view(new['bufferView'])
                accessor_map[index] = len(out['accessors']); out['accessors'].append(new)
            return accessor_map[index]
        for index in selected:
            node = copy.deepcopy(data['nodes'][index])
            if 'children' in node: node['children'] = [node_map[i] for i in node['children']]
            if index == root_index:
                for field in ('matrix', 'translation', 'rotation', 'scale'): node.pop(field, None)
            if 'mesh' in node:
                old = node['mesh']
                if old not in mesh_map:
                    mesh = copy.deepcopy(data['meshes'][old])
                    for primitive in mesh['primitives']:
                        primitive.pop('material', None)
                        primitive['indices'] = accessor(primitive['indices'])
                        primitive['attributes'] = {k: accessor(v) for k, v in primitive['attributes'].items()}
                    mesh_map[old] = len(out['meshes']); out['meshes'].append(mesh)
                node['mesh'] = mesh_map[old]
            out['nodes'].append(node)
        while len(binary) % 4: binary.append(0)
        out['buffers'] = [{'byteLength': len(binary)}]
        encoded = json.dumps(out, ensure_ascii=False, separators=(',', ':')).encode('utf8')
        encoded += b' ' * (-len(encoded) % 4)
        target.write_bytes(struct.pack('<III', 0x46546c67, 2, 28 + len(encoded) + len(binary)) +
                           struct.pack('<II', len(encoded), 0x4e4f534a) + encoded +
                           struct.pack('<II', len(binary), 0x004e4942) + binary)
def web_vector(v):
    return [v[0], v[2], -v[1]]

def palette():
    # The existing website's CAD palette; no additional accent colour.
    specs = {'alu_black': ([.042, .05, .06, 1], .72, .33),
             'alu_silver': ([.54, .58, .62, 1], .85, .29),
             'carbon': ([.018, .022, .028, 1], .18, .47),
             'print_black': ([.032, .036, .042, 1], 0, .68),
             'rubber': ([.023, .026, .031, 1], 0, .82)}
    result = {}
    for name, (color, metal, rough) in specs.items():
        mat = bpy.data.materials.new(name); mat.use_nodes = True; mat.diffuse_color = color
        bs = mat.node_tree.nodes.get('Principled BSDF')
        bs.inputs['Base Color'].default_value = color
        bs.inputs['Metallic'].default_value = metal
        bs.inputs['Roughness'].default_value = rough
        result[name] = mat
    return result

def material_class(source):
    name = source.split('/')[-1].lower()
    if '胎' in name or 'rubber' in name: return 'rubber'
    if '碳' in name: return 'carbon'
    if any(s in name for s in ('打印', '壳', '保护罩')): return 'print_black'
    if any(s in name for s in ('gear', 'teeth', '轴', 'bearing', '齿轮', '轴承', '50mm', '_pole', '活塞', '曲柄')): return 'alu_silver'
    return 'alu_black'

def count_cad_teeth(obj, world, axis):
    """Count clusters on the native tooth-tip circle, independent of the name."""
    axis = axis.normalized()
    u = axis.cross(Vector((0, 0, 1)))
    if u.length < .1: u = axis.cross(Vector((1, 0, 0)))
    u.normalize(); v = axis.cross(u)
    radial = [world @ p.co - world.translation for p in obj.data.vertices]
    radii = [(p - axis * p.dot(axis)).length for p in radial]
    maximum = max(radii)
    angles = sorted(set(round(math.atan2(p.dot(v), p.dot(u)) % (2 * math.pi), 6)
                        for p, radius in zip(radial, radii) if radius > maximum - .000005))
    gaps = [(angles[(i + 1) % len(angles)] - a) % (2 * math.pi) for i, a in enumerate(angles)]
    count = sum(gap > max(gaps) * .6 for gap in gaps)
    return {'teeth': count, 'tip_radius_mm': maximum * 1000,
            'tip_angles': len(angles), 'status': 'CAD count, awaiting user confirmation'}

for role in ('pump', 'swerve'):
    if args.role and args.role != role: continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    source = pathlib.Path(args.full_input) if args.full_input else pathlib.Path(args.input_root).parent / 'codex/engineer_tagged.glb'
    # Temporary small selection in this worktree, not a copy of the large input.
    with tempfile.TemporaryDirectory(prefix='.mech-export-', dir=root) as temporary:
        selected = pathlib.Path(temporary) / f'{role}.glb'
        extract_module(source, selected, 21 if role == 'swerve' else 1425)
        bpy.ops.import_scene.gltf(filepath=str(selected))
    materials = palette()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    excluded = []
    if role == 'swerve':
        # Control-board electronics do not explain either reduction path.
        # Keep suspension and mechanical homing hardware, grouped at assembly.
        for obj in list(meshes):
            idx = obj.get('source_node_index', -1)
            if idx == 50 or idx >= 64:
                excluded.append(obj.get('source_node_name', obj.name))
                meshes.remove(obj); bpy.data.objects.remove(obj, do_unlink=True)
    nodes = {o.get('source_node_index'): o for o in bpy.data.objects}
    orient = Matrix.Rotation(-math.pi / 2, 4, 'Z') if role == 'pump' else Matrix.Identity(4)
    worlds = {o: orient @ o.matrix_world for o in meshes}
    # Keep the existing centred web frames: swerve +Y up, pump +Z up.
    points = [worlds[o] @ v.co for o in meshes for v in o.data.vertices]
    minimum = Vector([min(p[i] for p in points) for i in range(3)])
    maximum = Vector([max(p[i] for p in points) for i in range(3)])
    centre = (minimum + maximum) / 2
    def pump_point(p): return web_vector(orient @ Vector((p[0], -p[2], p[1])) - centre)
    bearing_inner = None
    pinion = None
    if role == 'pump':
        # Node 1428 is the CAD's single wobble piston, including its rod.
        # Never cut or duplicate that geometry. The bearing's native inner-ring
        # triangles (r <= 7 mm) can follow the crank separately from its outer ring.
        bearing = nodes[1430]
        bearing_inner = bearing.copy(); bearing_inner.data = bearing.data.copy()
        bearing_inner.name = 'pump_bearing_inner_01430'
        bpy.context.collection.objects.link(bearing_inner)
        worlds[bearing_inner] = worlds[bearing].copy(); meshes.append(bearing_inner)
        bearing_center = worlds[bearing].translation
        axle = orient.to_3x3() @ Vector((0, 0, 1))
        for obj, keep_inner in ((bearing, False), (bearing_inner, True)):
            obj.data = obj.data.copy(); bm = bmesh.new(); bm.from_mesh(obj.data)
            def inner(face):
                radii = []
                for vertex in face.verts:
                    p = worlds[obj] @ vertex.co - bearing_center
                    radii.append((p - axle * p.dot(axle)).length)
                return max(radii) < .008
            remove = [face for face in bm.faces if inner(face) != keep_inner]
            bmesh.ops.delete(bm, geom=remove, context='FACES')
            bm.to_mesh(obj.data); bm.free()
    else:
        # The tagged assembly contains the steering motor and large gear, but
        # omits its external pinion. Reuse the native CAD pinion at node 35.
        # Measured shaft spacing 45.9 mm matches the CAD 17/136 pair (m=0.6).
        # This is a derived instance, never a newly invented tooth profile.
        source_pinion = nodes[35]
        counts = {'pinion': count_cad_teeth(source_pinion, worlds[source_pinion], worlds[source_pinion].to_3x3() @ Vector((0, 1, 0))),
                  'large': count_cad_teeth(nodes[58], worlds[nodes[58]], worlds[nodes[58]].to_3x3() @ Vector((1, 0, 0)))}
        if (counts['pinion']['teeth'], counts['large']['teeth']) != (17, 136):
            raise ValueError(f'Unexpected CAD tooth count: {counts}')
        pinion = source_pinion.copy(); pinion.data = source_pinion.data.copy()
        pinion.name = 'steering_pinion_from_00035'
        bpy.context.collection.objects.link(pinion); meshes.append(pinion)
        large_points = [worlds[nodes[58]] @ v.co for v in nodes[58].data.vertices]
        gear_height = (min(p.z for p in large_points) + max(p.z for p in large_points)) / 2
        pinion_points = [worlds[source_pinion] @ v.co for v in source_pinion.data.vertices]
        source_axis = (worlds[source_pinion].to_3x3() @ Vector((0, 1, 0))).normalized()
        depths = [(p - worlds[source_pinion].translation).dot(source_axis) for p in pinion_points]
        pinion_center = worlds[source_pinion].translation + source_axis * (min(depths) + max(depths)) / 2
        target = worlds[nodes[61]].translation.copy(); target.z = gear_height
        alignment = source_axis.rotation_difference(Vector((0, 0, 1))).to_matrix().to_4x4()
        worlds[pinion] = Matrix.Translation(target) @ alignment @ Matrix.Translation(-pinion_center) @ worlds[source_pinion]
        pinion['web_instance'] = 'steering-pinion'
        pinion['web_reconstruction'] = 'CAD node 35 instance; omitted steering pinion, positioned by measured motor axis and gear plane'
        pinion['web_motion'] = 'steering-pinion'
        pinion['web_axis'] = [0, 1, 0]
        pinion['web_gear_ratio'] = counts['large']['teeth'] / counts['pinion']['teeth']
        # Put the object origin at the shaft centre, without changing triangles.
        transform = worlds[pinion].copy()
        local_center = transform.inverted() @ target
        pinion.data.transform(Matrix.Translation(-local_center))
        transform.translation = target; worlds[pinion] = transform
    records = []
    steering = None
    if role == 'swerve':
        steering = bpy.data.objects.new('engineer_00022_steering', None)
        bpy.context.collection.objects.link(steering)
        steering.location = nodes[22].matrix_world.translation - centre
        steering['source_node_name'] = 'Swerve_inner.2025.10.1'
        steering['web_motion'] = 'steer'
        steering['web_axis'] = [0, 1, 0]
        bpy.context.view_layer.update()
    for obj in meshes:
        src = obj.get('source_node_name', obj.name)
        world = worlds[obj].copy()
        world.translation -= centre
        obj.parent = None
        obj.matrix_world = world
        if steering and obj != pinion and '/Swerve_inner.' in src:
            obj.parent = steering
            obj.matrix_parent_inverse = steering.matrix_world.inverted()
            obj.matrix_world = world
        # CAD triangle seams are welded, preserving each component boundary.
        obj.data = obj.data.copy()
        slots = max(1, len(obj.data.materials))
        obj.data.materials.clear()
        for _ in range(slots): obj.data.materials.append(materials[material_class(src)])
        bm = bmesh.new(); bm.from_mesh(obj.data)
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.0000005)
        bmesh.ops.dissolve_degenerate(bm, edges=list(bm.edges), dist=0.0000001)
        seen, duplicates = set(), []
        for face in bm.faces:
            key = frozenset(face.verts)
            if key in seen: duplicates.append(face)
            seen.add(key)
        bmesh.ops.delete(bm, geom=duplicates, context='FACES_ONLY')
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(obj.data); bm.free()
        bpy.context.view_layer.objects.active = obj
        triangles = sum(len(p.vertices) - 2 for p in obj.data.polygons)
        # Keep all CAD tooth flanks and circular edges; do not decimate them.
        bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True)
        try: bpy.ops.mesh.customdata_custom_splitnormals_clear()
        except RuntimeError: pass
        for p in obj.data.polygons: p.use_smooth = True
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(32), keep_sharp_edges=False)
        offset = Vector((0, 0, 0))
        idx = obj.get('source_node_index')
        obj['web_motor_intact'] = 'MOTOR_' in src or 'DJ_M3508' in src
        if role == 'pump':
            if idx == 1426:
                obj['web_motion'] = 'crank'
                obj['web_crank_origin'] = pump_point((-.0053492673, -.0082754344, .068))
                obj['web_big_end'] = pump_point((-.0049294434, .0037245655, .0709704831))
                obj['web_small_end'] = pump_point((-.0053492673, .0052245655, .024972396))
                obj['web_crank_axis'] = [0, 1, 0]
                obj['web_slider_axis'] = [1, 0, 0]
            elif idx == 1427:
                obj['web_shell'] = True
                # Measured end rings: both tubes leave the same native -Y side.
                # +native X is the upper tube in the chosen camera orientation.
                obj['web_ports'] = [pump_point((.004650733, -.031575434, .0095)),
                                    pump_point((-.015349267, -.031575434, .0095))]
                obj['web_port_axis'] = [0, -1, 0]
            elif idx == 1428:
                obj['web_motion'] = 'rod'
                obj['web_rigid_piston'] = True
            elif idx == 1430:
                obj['web_motion'] = 'bearing-inner' if obj == bearing_inner else 'bearing-outer'
        else:
            wheel_axis = (worlds[nodes[31]].to_3x3() @ Vector((0, 0, 1))).normalized()
            # Native rail/carriage origins verify the suspension sliding axis.
            # Keep all four rail/carriage pairs together as one explosion level.
            rail_axis = (worlds[nodes[25]].translation - worlds[nodes[24]].translation).normalized()
            rail_nodes = (24, 25, 26, 27, 28, 29, 49, 51)
            spring_nodes = (53, 54)
            layers = {35: .035, 37: .072, 39: .072, 40: .072, 38: .111,
                      41: .143, 42: -.037, 43: -.06, 44: -.087,
                      45: .168, 46: .168, 47: -.06, 31: .21}
            if idx in layers: offset = wheel_axis * layers[idx]
            elif idx in (58, 62): offset = Vector((0, 0, .10 if idx == 58 else .065))
            # Motor output points down. Move the complete motor farther up than
            # the pinion, so their relative separation extends along that shaft.
            elif idx == 61: offset = Vector((0, 0, .11))
            elif idx == 63: offset = Vector((0, 0, .17))
            if idx in rail_nodes:
                offset = rail_axis * -.095
                obj['web_suspension'] = 'rail'
            elif idx in spring_nodes:
                # Translate the original cylinder and rod by the same vector:
                # this is the complete CAD spring, never a cutaway or extension.
                offset = Vector((.115, 0, 0))
                obj['web_suspension'] = 'gas-spring'
            if obj == pinion: offset = Vector((0, 0, .07))
            if idx == 31:
                obj['web_motion'] = 'roll'
                obj['web_axis'] = web_vector(wheel_axis)
            if idx in (35, 37, 38, 39, 40): obj['web_transmission'] = 'drive-input' if idx == 35 else 'drive-output' if idx == 38 else 'drive-compound'
            if obj == pinion: obj['web_transmission'] = 'steering-input'
            if idx == 58: obj['web_transmission'] = 'steering-output'
            if idx in (35, 39, 38, 58, 25, 53): obj['web_guide'] = True
            obj['web_structure'] = obj != pinion and idx not in layers and idx not in (58, 62) + rail_nodes + spring_nodes and not obj['web_motor_intact']
            obj['web_explode'] = web_vector(offset)
        obj['web_motor_intact'] = 'MOTOR_' in src or 'DJ_M3508' in src
        # Keep original, auditable node names and component origins.
        records.append({'node': obj.name, 'source': src, 'source_index': idx,
                        'pivot': web_vector(world.translation),
                        'motion': obj.get('web_motion'), 'axis_local': list(obj.get('web_axis', [])),
                        'explode': list(obj.get('web_explode', [])),
                        'motor_intact': bool(obj['web_motor_intact'])})
        records[-1]['triangles'] = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    for obj in list(bpy.data.objects):
        if obj.type != 'MESH' and obj != steering:
            bpy.data.objects.remove(obj, do_unlink=True)
    output = web / f'engineer-{role}.glb'
    bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', export_extras=True,
                              export_draco_mesh_compression_enable=True,
                              export_draco_mesh_compression_level=6,
                              export_draco_position_quantization=16,
                              export_draco_normal_quantization=12,
                              export_yup=True)
    audit['modules'][role] = {'input': str(source),
                             'up': '+Z' if role == 'pump' else '+Y',
                             'output': output.name, 'output_sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
                             'source_centre': web_vector(centre), 'parts': records}
    audit['modules'][role]['excluded_electronics'] = excluded
    if role == 'swerve':
        audit['modules'][role]['steering_teeth'] = counts
        spacing = worlds[nodes[61]].translation - worlds[nodes[58]].translation
        audit['modules'][role]['steering_shaft_spacing_mm'] = math.hypot(spacing.x, spacing.y) * 1000
        audit['modules'][role]['pinion_provenance'] = pinion['web_reconstruction']
if args.audit: pathlib.Path(args.audit).write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
print(json.dumps({role: {'parts': len(data['parts']), 'triangles': sum(p['triangles'] for p in data['parts'])} for role, data in audit['modules'].items()}))
