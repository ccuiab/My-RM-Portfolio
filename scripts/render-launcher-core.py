"""Blender 5.1.1: render the native RM2024 launcher core, without saving .blend.

Run through render-launcher-core.ps1, which owns the shared heavy-operation lock.
The large read-only CAD export is streamed; only selected mesh buffers are imported.
No wheel, motor, shaft or CAD geometry is split, moved or rebuilt.
"""
import argparse
import copy
import hashlib
import json
import pathlib
import struct
import sys
import tempfile

import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

ROOT = pathlib.Path(__file__).resolve().parents[1]
CORE = {803, 804, 805, 806, 809, 810, 811, 812, 819, 820, 821, 822}
# Native opposing support pins and bearings; integral motor shafts remain intact.
SUPPORT = {772, 773, 792, 797, 799, 818}


def extract(source, target):
    """Keep native local assembly transforms and only referenced uncompressed data."""
    with source.open('rb') as handle:
        magic, version, _ = struct.unpack('<III', handle.read(12))
        if magic != 0x46546C67 or version != 2:
            raise ValueError('Expected a GLB 2.0 input')
        length, kind = struct.unpack('<II', handle.read(8))
        if kind != 0x4E4F534A:
            raise ValueError('Expected the GLB JSON chunk first')
        data = json.loads(handle.read(length))
        binary_start = 28 + length
        if data['nodes'][767]['name'] != '发机_4310pitch':
            raise ValueError('Unexpected assembly: re-audit source node indices')
        descendants = []
        def visit(index):
            descendants.append(index)
            for child in data['nodes'][index].get('children', []):
                visit(child)
        visit(767)
        main = [i for i in descendants if data['nodes'][i]['name'] == 'Friction_wheel']
        small = [i for i in descendants if data['nodes'][i]['name'] == 'smallFriction_wheel']
        if main != [803, 819] or small != [809]:
            raise ValueError(f'Wheel assemblies changed: main={main}, small={small}; re-audit before rendering')
        selected = sorted({767} | CORE | SUPPORT)
        node_map = {old: new for new, old in enumerate(selected)}
        out = {'asset': {'version': '2.0'}, 'scene': 0,
               'scenes': [{'nodes': [node_map[767]]}], 'nodes': [],
               'meshes': [], 'accessors': [], 'bufferViews': [],
               'materials': copy.deepcopy(data.get('materials', []))}
        # No source images are copied. Retain the native CAD solid-colour materials.
        def remove_textures(value):
            if isinstance(value, dict):
                return {k: remove_textures(v) for k, v in value.items()
                        if not k.endswith('Texture') and k != 'extensions'}
            if isinstance(value, list):
                return [remove_textures(v) for v in value]
            return value
        out['materials'] = remove_textures(out['materials'])
        binary = bytearray()
        views, accessors, meshes = {}, {}, {}

        def view(index):
            if index not in views:
                original = data['bufferViews'][index]
                binary.extend(b'\0' * (-len(binary) % 4))
                handle.seek(binary_start + original.get('byteOffset', 0))
                copied = handle.read(original['byteLength'])
                if len(copied) != original['byteLength']:
                    raise ValueError('Incomplete mesh buffer')
                new = {**original, 'buffer': 0, 'byteOffset': len(binary)}
                binary.extend(copied)
                views[index] = len(out['bufferViews'])
                out['bufferViews'].append(new)
            return views[index]

        def accessor(index):
            if index not in accessors:
                new = copy.deepcopy(data['accessors'][index])
                new['bufferView'] = view(new['bufferView'])
                accessors[index] = len(out['accessors'])
                out['accessors'].append(new)
            return accessors[index]

        for index in selected:
            node = copy.deepcopy(data['nodes'][index])
            if 'children' in node:
                node['children'] = [node_map[c] for c in node['children'] if c in node_map]
            if index == 767:
                # Remove the whole vehicle's pose, never an internal part transform.
                for field in ('matrix', 'translation', 'rotation', 'scale'):
                    node.pop(field, None)
            node['extras'] = {**node.get('extras', {}), 'source_node_index': index,
                              'source_node_name': node['name']}
            if 'mesh' in node:
                original_mesh = node['mesh']
                if original_mesh not in meshes:
                    mesh = copy.deepcopy(data['meshes'][original_mesh])
                    for primitive in mesh['primitives']:
                        primitive['indices'] = accessor(primitive['indices'])
                        primitive['attributes'] = {
                            k: accessor(v) for k, v in primitive['attributes'].items()
                            if k in ('POSITION', 'NORMAL')}
                    meshes[original_mesh] = len(out['meshes'])
                    out['meshes'].append(mesh)
                node['mesh'] = meshes[original_mesh]
            out['nodes'].append(node)
        binary.extend(b'\0' * (-len(binary) % 4))
        out['buffers'] = [{'byteLength': len(binary)}]
        encoded = json.dumps(out, ensure_ascii=False, separators=(',', ':')).encode('utf8')
        encoded += b' ' * (-len(encoded) % 4)
        target.write_bytes(struct.pack('<III', 0x46546C67, 2, 28 + len(encoded) + len(binary)) +
                           struct.pack('<II', len(encoded), 0x4E4F534A) + encoded +
                           struct.pack('<II', len(binary), 0x004E4942) + binary)
        return data, selected, len(binary), {'main': len(main), 'pre_acceleration': len(small)}


def material(name, color, metal, rough):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Metallic'].default_value = metal
    shader.inputs['Roughness'].default_value = rough
    return mat


def trajectory(scene):
    """A presentation annotation, along the native barrel axis: Blender -Y."""
    amber = material('trajectory_annotation_amber', (.8879, .4621, .0423), .05, .45)
    shader = amber.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Emission Color'].default_value = (.8879, .4621, .0423, 1)
    shader.inputs['Emission Strength'].default_value = .25
    for start in (.018, .0, -.018, -.036, -.054):
        curve = bpy.data.curves.new('trajectory_dash', 'CURVE')
        curve.dimensions = '3D'
        curve.bevel_depth = .00065
        curve.bevel_resolution = 3
        spline = curve.splines.new('POLY')
        spline.points.add(1)
        spline.points[0].co = (0, start, 0, 1)
        spline.points[1].co = (0, start - .01, 0, 1)
        obj = bpy.data.objects.new('trajectory_annotation', curve)
        scene.collection.objects.link(obj)
        obj.data.materials.append(amber)
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=.003, radius2=0, depth=.01,
                                    location=(0, -.077, 0), rotation=(1.5707963267948966, 0, 0))
    bpy.context.object.name = 'trajectory_annotation_arrow'
    bpy.context.object.data.materials.append(amber)


def render(args):
    if bpy.app.version[:3] != (5, 1, 1):
        raise RuntimeError('This audited render requires Blender 5.1.1')
    source = pathlib.Path(args.input).resolve()
    output = pathlib.Path(args.output).resolve()
    if not output.is_relative_to(ROOT):
        raise ValueError('Image output must remain inside this worktree')
    if args.width < 1176 or args.height < 1337:
        raise ValueError('Do not downsize below the original 1176 x 1337 image')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    with tempfile.TemporaryDirectory(prefix='.launcher-render-', dir=ROOT) as temporary:
        selection = pathlib.Path(temporary) / 'core.glb'
        data, selected, buffer_bytes, counts = extract(source, selection)
        bpy.ops.import_scene.gltf(filepath=str(selection))
    objects = [o for o in bpy.data.objects if o.type == 'MESH']
    nodes = {o['source_node_index']: o for o in bpy.data.objects if 'source_node_index' in o}
    audit = {'blender': bpy.app.version_string, 'source': str(source),
             'source_sha256': None, 'source_bytes': source.stat().st_size,
             'imported_buffer_bytes': buffer_bytes, 'selected_nodes': [],
             'wheel_count': counts,
             'occluders': 'Omitted: side/top/bottom plates, guards, covers, electronics, barrel',
             'geometry': 'Native wheel/motor/pin/bearing meshes, unchanged internal transforms',
             'axis_frame': 'Local launcher frame, glTF Y-up converted to Blender Z-up',
             'animation': 'Static image; no animation cycle or changed WebGL code'}
    with source.open('rb') as handle:
        audit['source_sha256'] = hashlib.file_digest(handle, 'sha256').hexdigest()
    for index in selected:
        obj = nodes[index]
        item = {'index': index, 'name': data['nodes'][index]['name']}
        if obj.type == 'MESH':
            pts = [obj.matrix_world @ p.co for p in obj.data.vertices]
            item['world_bounds_m'] = [[min(p[i] for p in pts) for i in range(3)],
                                      [max(p[i] for p in pts) for i in range(3)]]
            item['vertices'] = len(obj.data.vertices)
            item['polygons'] = len(obj.data.polygons)
            item['materials'] = [m.name for m in obj.data.materials]
        item['assembly_origin_m'] = list(obj.matrix_world.translation)
        audit['selected_nodes'].append(item)
    # Rubber is neutral graphite; bright metal faces stay close to existing cutouts.
    rubber = material('launcher_graphite_rubber', (.045, .051, .062), 0, .7)
    silver = material('launcher_support_metal', (.57, .61, .65), .7, .28)
    motor = material('launcher_motor_body', (.055, .063, .077), .5, .36)
    # In this SolidWorks export, Hub is the outer tyre and Rubber is the metal
    # centre: verified by diameters, geometry and native generictwocolor vs
    # satinfinishaluminum materials. Do not infer physical identity from names.
    for obj in objects:
        index = obj['source_node_index']
        if index in (805, 810, 821):
            obj.data.materials.clear()
            obj.data.materials.append(rubber)
        elif index in SUPPORT or index in (804, 812, 820):
            obj.data.materials.clear()
            obj.data.materials.append(silver)
        elif index in (806, 811, 822):
            for slot in obj.material_slots:
                slot.material = silver if any(k in slot.material.name.lower() for k in ('steel', 'aluminum')) else motor
        for poly in obj.data.polygons:
            poly.use_smooth = True
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = args.samples
    scene.cycles.use_denoising = True
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 6
    scene.render.film_transparent = True
    scene.render.resolution_x = args.width
    scene.render.resolution_y = args.height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '8'
    scene.view_settings.view_transform = 'AgX'
    scene.world = bpy.data.worlds.new('neutral_studio')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.7, .75, .82, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .55
    trajectory(scene)
    audit['annotation'] = 'Amber dashed arrow, not a CAD part; direction follows barrel axis and small-to-main wheel placement (-Y Blender / +Z glTF launcher frame)'
    points = [o.matrix_world @ p.co for o in objects for p in o.data.vertices]
    points += [Vector((0, -.082, 0)), Vector((0, .018, 0))]
    centre = Vector([(max(p[i] for p in points) + min(p[i] for p in points)) / 2 for i in range(3)])
    direction = Vector(args.view).normalized()
    camera_data = bpy.data.cameras.new('core_three_quarter')
    camera_data.type = 'ORTHO'
    camera = bpy.data.objects.new('core_three_quarter', camera_data)
    scene.collection.objects.link(camera)
    camera.location = centre + direction * 1.1
    camera.rotation_euler = (-direction).to_track_quat('-Z', 'Y').to_euler()
    inverse_rotation = camera.rotation_euler.to_matrix().transposed()
    projected = [inverse_rotation @ (p - centre) for p in points]
    xlo, xhi = min(p.x for p in projected), max(p.x for p in projected)
    ylo, yhi = min(p.y for p in projected), max(p.y for p in projected)
    camera.location += camera.rotation_euler.to_matrix() @ Vector(((xlo + xhi) / 2, (ylo + yhi) / 2, 0))
    camera_data.ortho_scale = max(yhi - ylo, (xhi - xlo) * args.height / args.width) * 1.15
    camera_data.clip_start = .001
    camera_data.clip_end = 10
    scene.camera = camera
    bpy.context.view_layer.update()
    normalized = [world_to_camera_view(scene, camera, p) for p in points]
    camera_data.ortho_scale *= max(max(abs((p.x - .5) * 2), abs((p.y - .5) * 2)) for p in normalized) * 1.12
    normalized = [world_to_camera_view(scene, camera, p) for p in points]
    bounds = [min(p.x for p in normalized), min(p.y for p in normalized),
              max(p.x for p in normalized), max(p.y for p in normalized)]
    if min(bounds[:2]) < .04 or max(bounds[2:]) > .96:
        raise RuntimeError(f'Framing would clip the native assembly: {bounds}')
    audit['normalized_projected_bounds'] = bounds
    for name, offset, energy, size in (
            ('key', (1, -1, 2), 12, 1.1),
            ('fill', (-1.5, .3, 1), 8, 1.2),
            ('rim', (.3, 1.3, 1.4), 16, .9)):
        lamp = bpy.data.lights.new(name, 'AREA')
        lamp.energy = energy
        lamp.shape = 'DISK'
        lamp.size = size
        obj = bpy.data.objects.new(name, lamp)
        scene.collection.objects.link(obj)
        obj.location = centre + Vector(offset) * .55
        obj.rotation_euler = (centre - obj.location).to_track_quat('-Z', 'Y').to_euler()
    output.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(output)
    bpy.ops.render.render(write_still=True)
    audit.update({'image': str(output.relative_to(ROOT)), 'resolution': [args.width, args.height],
                  'samples': args.samples, 'camera_direction': list(direction),
                  'image_sha256': hashlib.sha256(output.read_bytes()).hexdigest()})
    if args.audit:
        pathlib.Path(args.audit).write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding='utf8')
    print(json.dumps({'image': str(output), 'wheels': audit['wheel_count'],
                      'mesh_objects': len(objects)}, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', default=str(ROOT / 'materials/images/derived/site/research-cutouts/hero-launcher-core.png'))
    parser.add_argument('--audit')
    parser.add_argument('--width', type=int, default=1800)
    parser.add_argument('--height', type=int, default=1400)
    parser.add_argument('--samples', type=int, default=48)
    parser.add_argument('--view', nargs=3, type=float, default=[1.2, 2.5, 1.5])
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    render(args)
