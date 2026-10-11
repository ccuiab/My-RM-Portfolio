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
import bpy
import bmesh
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--input-root', required=True)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
root = pathlib.Path.cwd()
web = root / 'materials/models/derived/web'
audit = {'blender': bpy.app.version_string, 'units': 'metres', 'up': '+Y', 'modules': {}}
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
    if any(s in name for s in ('gear', 'teeth', '轴', 'bearing', '齿轮', '轴承', '50mm', '_pole')): return 'alu_silver'
    return 'alu_black'

for role in ('pump', 'swerve'):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    source = pathlib.Path(args.input_root) / f'engineer-{role}-raw.glb'
    bpy.ops.import_scene.gltf(filepath=str(source))
    materials = palette()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    # Match the previous web exports: identical Y-up axes, metres and centred bounds.
    points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
    minimum = Vector([min(p[i] for p in points) for i in range(3)])
    maximum = Vector([max(p[i] for p in points) for i in range(3)])
    centre = (minimum + maximum) / 2
    records = []
    steering = None
    if role == 'swerve':
        steering = bpy.data.objects.new('engineer_00022_steering', None)
        bpy.context.collection.objects.link(steering)
        steering.location = bpy.data.objects['engineer_00057'].matrix_world.translation - centre
        steering['source_node_name'] = 'Swerve_inner.2025.10.1'
        steering['web_motion'] = 'steer'
        steering['web_axis'] = [0, 1, 0]
        bpy.context.view_layer.update()
    for obj in meshes:
        src = obj.get('source_node_name', obj.name)
        world = obj.matrix_world.copy()
        world.translation -= centre
        obj.parent = None
        obj.matrix_world = world
        if steering and '/Swerve_inner.' in src:
            obj.parent = steering
            obj.matrix_parent_inverse = steering.matrix_world.inverted()
            obj.matrix_world = world
        # CAD triangle seams are welded, preserving each component boundary.
        obj.data = obj.data.copy()
        slots = max(1, len(obj.data.materials))
        obj.data.materials.clear()
        for _ in range(slots): obj.data.materials.append(materials[material_class(src)])
        bm = bmesh.new(); bm.from_mesh(obj.data)
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=0.000001)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(obj.data); bm.free()
        bpy.context.view_layer.objects.active = obj
        triangles = sum(len(p.vertices) - 2 for p in obj.data.polygons)
        if triangles > 3000:
            modifier = obj.modifiers.new('Web simplification', 'DECIMATE')
            modifier.ratio = 0.45 if role == 'swerve' else 0.65
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        try: bpy.ops.mesh.customdata_custom_splitnormals_clear()
        except RuntimeError: pass
        for p in obj.data.polygons: p.use_smooth = True
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35), keep_sharp_edges=False)
        offset = Vector((0, 0, 0))
        idx = obj.get('source_node_index')
        if role == 'pump':
            if idx == 1426:
                obj['web_motion'] = 'crank'
                obj['web_axis'] = web_vector((0, 1, 0))
            elif idx == 1427:
                obj['web_shell'] = True
                # Port endpoints on the head's two lateral openings. Visual flow only.
                obj['web_ports'] = [[-0.0248, -0.017, 0.006], [0.0248, -0.017, 0.006]]
            elif idx == 1428:
                obj['web_motion'] = 'piston'
                obj['web_axis'] = web_vector((0, 0, 1))
        else:
            if idx == 31:
                obj['web_motion'] = 'roll'
                obj['web_axis'] = web_vector((0, 0, 1))
                offset = world.to_quaternion() @ Vector((0, 0, 0.095))
            elif idx in (24, 28, 29, 51):
                offset = Vector((0.048 if world.translation.x >= 0 else -0.048, 0.02 if world.translation.y >= 0 else -0.02, 0))
            elif idx in (25, 26, 27, 49):
                offset = Vector((0.022 if world.translation.x >= 0 else -0.022, 0, 0))
            elif idx in (53, 54):
                offset = Vector((0.075, 0.025, 0.015))
            elif idx == 58:
                offset = Vector((0, 0, 0.080))
            elif idx == 57:
                offset = Vector((0, 0, 0.034))
            elif idx == 63:
                offset = Vector((-0.04, 0, 0.044))
            elif idx in (41, 42, 43, 44, 45, 47):
                offset = Vector((-0.048, -0.025, -0.032))
            elif idx in (48, 55):
                offset = Vector((0, 0, -0.025 if idx == 48 else 0.028))
            obj['web_explode'] = web_vector(offset)
        obj['web_motor_intact'] = 'MOTOR_' in src or 'DJ_M3508' in src
        # Keep original, auditable node names and component origins.
        records.append({'node': obj.name, 'source': src, 'source_index': idx,
                        'pivot': web_vector(world.translation),
                        'motion': obj.get('web_motion'), 'axis_local': list(obj.get('web_axis', [])),
                        'explode': list(obj.get('web_explode', [])),
                        'motor_intact': bool(obj['web_motor_intact'])})
    for obj in list(bpy.data.objects):
        if obj.type != 'MESH' and obj != steering:
            bpy.data.objects.remove(obj, do_unlink=True)
    output = web / f'engineer-{role}.glb'
    bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB', export_extras=True,
                              export_draco_mesh_compression_enable=True,
                              export_draco_mesh_compression_level=6,
                              export_draco_position_quantization=14,
                              export_draco_normal_quantization=10,
                              export_yup=True)
    audit['modules'][role] = {'input': 'materials/models/derived/inputs/module-models/' + source.name,
                             'input_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                             'output': output.name, 'output_sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
                             'source_centre': web_vector(centre), 'parts': records}
(web / 'engineer-modules.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
