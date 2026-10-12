"""Blender 5.1.1: render the native RM2024 launcher core, without saving .blend.

Run through render-launcher-core.ps1, which owns the shared heavy-operation lock.
The large read-only CAD export is streamed; only selected mesh buffers are imported.
Wheel, motor body/gearbox and shaft geometry keeps its native assembly pose.
Only the unrelated external M2006 cable is clipped in the temporary render mesh.
"""
import argparse
import copy
import hashlib
import json
import pathlib
import itertools
import struct
import sys
import tempfile

import bpy
import bmesh
from mathutils import Vector, Matrix, Quaternion
from bpy_extras.object_utils import world_to_camera_view

ROOT = pathlib.Path(__file__).resolve().parents[1]
CORE = {803, 804, 805, 806, 809, 810, 811, 812, 819, 820, 821, 822}
FRAME = {791, 796, 800, 801, 802, 807, 813, 814, 815, 816, 823, 830, 914, 916}
FUNCTIONAL = {808, 817, 831}
GUARDS = {771, 774, 777, 781, 915, 919, 923, 926, 927, 931, 946}
GHOST = {791, 796, 816, 914}
CANDIDATES = {
    'a': {'view': [1.3, -1.0, .35], 'frame_alpha': .30},
    'b': {'view': [1.3, -1.0, .60], 'frame_alpha': .24},
}


def selection_plan(data):
    """Wheel cage and its actual fittings, excluding the separate gimbal/electronics."""
    world, parents = {}, {}
    def visit(index, parent):
        node = data['nodes'][index]
        if 'matrix' in node:
            transform = Matrix([node['matrix'][i:i + 4] for i in range(0, 16, 4)]).transposed()
        else:
            x, y, z, w = node.get('rotation', [0, 0, 0, 1])
            transform = Matrix.LocRotScale(Vector(node.get('translation', [0, 0, 0])),
                                          Quaternion((w, x, y, z)), Vector(node.get('scale', [1, 1, 1])))
        world[index] = parent @ transform if index != 767 else Matrix.Identity(4)
        for child in node.get('children', []):
            parents[child] = index
            visit(child, world[index])
    visit(767, Matrix.Identity(4))
    selected = {767} | CORE | FRAME | FUNCTIONAL
    reasons = {}
    for index in world:
        node = data['nodes'][index]
        if index in selected or 'mesh' not in node:
            continue
        if index in GUARDS:
            reasons[index] = 'Occluding outer cover / side guard; not a load-bearing cage plate'
            continue
        leaf = node['name'].split('/')[-1]
        hardware = any(k in leaf for k in ('STD_', '衬套', 'MF', 'Pin_', '卡扣', '6416-', 'KL_hing', 'MSM-', 'copper_hexagonal'))
        if hardware:
            points = []
            for primitive in data['meshes'][node['mesh']]['primitives']:
                acc = data['accessors'][primitive['attributes']['POSITION']]
                points.extend(world[index] @ Vector(p) for p in itertools.product(*zip(acc['min'], acc['max'])))
            centre = Vector([(max(p[i] for p in points) + min(p[i] for p in points)) / 2 for i in range(3)])
            if -.105 <= -centre.z <= .090 and -.050 <= centre.y <= .087 and abs(centre.x) <= .110:
                selected.add(index)
                continue
            reasons[index] = 'Fitting on the separate rear gimbal or electronics, outside the launcher cage'
        else:
            reasons[index] = 'Separate gimbal, CV camera, electronics bay or transmitter; not the friction-wheel cage'
    for index in list(selected):
        while index in parents:
            index = parents[index]
            selected.add(index)
    return sorted(selected), [{'index': i, 'name': data['nodes'][i]['name'], 'reason': reason}
                              for i, reason in sorted(reasons.items()) if i not in selected]


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
        selected, hidden = selection_plan(data)
        node_map = {old: new for new, old in enumerate(selected)}
        out = {'asset': {'version': '2.0'}, 'scene': 0,
               'scenes': [{'nodes': [node_map[767]]}], 'nodes': [],
               'meshes': [], 'accessors': [], 'bufferViews': [],
               'materials': [], 'textures': [], 'images': [], 'samplers': []}
        binary = bytearray()
        views, accessors, meshes = {}, {}, {}
        material_map, texture_map, image_map, sampler_map = {}, {}, {}, {}

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

        def texture(index):
            if index not in texture_map:
                new = copy.deepcopy(data['textures'][index])
                source_image = new['source']
                if source_image not in image_map:
                    img = copy.deepcopy(data['images'][source_image])
                    img['bufferView'] = view(img['bufferView'])
                    image_map[source_image] = len(out['images'])
                    out['images'].append(img)
                new['source'] = image_map[source_image]
                if 'sampler' in new:
                    sampler = new['sampler']
                    if sampler not in sampler_map:
                        sampler_map[sampler] = len(out['samplers'])
                        out['samplers'].append(copy.deepcopy(data['samplers'][sampler]))
                    new['sampler'] = sampler_map[sampler]
                texture_map[index] = len(out['textures'])
                out['textures'].append(new)
            return texture_map[index]

        def source_material(index):
            if index not in material_map:
                new = copy.deepcopy(data['materials'][index])
                def rewrite(value):
                    if not isinstance(value, dict):
                        return
                    for key, item in value.items():
                        if key.endswith('Texture') and isinstance(item, dict):
                            item['index'] = texture(item['index'])
                        else:
                            rewrite(item)
                rewrite(new)
                material_map[index] = len(out['materials'])
                out['materials'].append(new)
            return material_map[index]

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
                        if 'material' in primitive:
                            primitive['material'] = source_material(primitive['material'])
                        primitive['indices'] = accessor(primitive['indices'])
                        primitive['attributes'] = {
                            k: accessor(v) for k, v in primitive['attributes'].items()
                            if k in ('POSITION', 'NORMAL', 'TEXCOORD_0')}
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
        return data, selected, len(binary), {'main': len(main), 'pre_acceleration': len(small)}, hidden


def material(name, color, metal, rough):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Metallic'].default_value = metal
    shader.inputs['Roughness'].default_value = rough
    return mat


def hide_external_cable(obj):
    """Hide only the cable outside the motor; body/gearbox/shaft remain whole."""
    before = len(obj.data.polygons)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    plane_co = obj.matrix_world.inverted() @ Vector((0, .065, 0))
    plane_no = (obj.matrix_world.to_3x3().transposed() @ Vector((0, 1, 0))).normalized()
    bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
                          plane_co=plane_co, plane_no=plane_no, clear_outer=True, clear_inner=False)
    bm.to_mesh(obj.data)
    bm.free()
    return {'index': 811, 'name': obj['source_node_name'], 'hidden': 'Only external cable/connector past Blender Y=0.065 m',
            'reason': 'Unrelated long cable obscures the wheel cage and distorts framing; motor body ends before Y=0.058 m',
            'faces_before': before, 'faces_after': len(obj.data.polygons)}


def presentation_materials(objects, alpha):
    """Native SW colours and weave; soften speculars rather than replacing the assembly palette."""
    for mat in list(bpy.data.materials):
        shader = mat.node_tree.nodes.get('Principled BSDF') if mat.use_nodes else None
        if not shader:
            continue
        shader.inputs['Roughness'].default_value = max(.5, shader.inputs['Roughness'].default_value)
        shader.inputs['Metallic'].default_value = min(.18, shader.inputs['Metallic'].default_value)
        if 'carbonfiberepoxy' in mat.name:
            base = shader.inputs['Base Color']
            if base.is_linked:
                original = base.links[0].from_socket
                tint = mat.node_tree.nodes.new('ShaderNodeMixRGB')
                tint.blend_type = 'MULTIPLY'
                tint.inputs[0].default_value = 1
                tint.inputs[2].default_value = (.14, .13, .16, 1)
                mat.node_tree.links.new(original, tint.inputs[1])
                mat.node_tree.links.new(tint.outputs[0], base)
            else:
                base.default_value = (.14, .13, .16, 1)
    rubber = material('launcher_rubber', (.033, .035, .044), 0, .8)
    motor = material('M2006_satin_motor', (.34, .37, .43), .18, .55)
    for obj in objects:
        index = obj['source_node_index']
        if index in (805, 810, 821):
            obj.data.materials.clear()
            obj.data.materials.append(rubber)
        elif index == 811:
            for slot in obj.material_slots:
                slot.material = motor
        if index in GHOST:
            for slot in obj.material_slots:
                ghost = slot.material.copy()
                ghost.name = f'frame_ghost_{index}_{alpha:.2f}'
                ghost.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value = alpha
                slot.material = ghost


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
        data, selected, buffer_bytes, counts, hidden = extract(source, selection)
        bpy.ops.import_scene.gltf(filepath=str(selection))
    objects = [o for o in bpy.data.objects if o.type == 'MESH']
    nodes = {o['source_node_index']: o for o in bpy.data.objects if 'source_node_index' in o}
    cable = hide_external_cable(nodes[811])
    audit = {'blender': bpy.app.version_string, 'source': str(source),
             'source_sha256': None, 'source_bytes': source.stat().st_size,
             'imported_buffer_bytes': buffer_bytes, 'selected_nodes': [],
             'wheel_count': counts,
             'hidden_nodes': hidden, 'hidden_cable': cable,
             'translucent_nodes': [{'index': i, 'name': data['nodes'][i]['name'], 'alpha': args.frame_alpha,
                                    'reason': 'Load-bearing frame preserved; translucency reveals the wheels behind it'} for i in sorted(GHOST)],
             'geometry': 'Native cage, guide, muzzle/speed module, fittings and wheel/motor assemblies; unchanged internal transforms',
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
    presentation_materials(objects, args.frame_alpha)
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
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.world = bpy.data.worlds.new('neutral_studio')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.78, .80, .85, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .65
    scene.render.use_freestyle = True
    lineset = bpy.context.view_layer.freestyle_settings.linesets[0]
    if lineset.linestyle is None:
        lineset.linestyle = bpy.data.linestyles.new('SolidWorks_edge_style')
    linestyle = lineset.linestyle
    linestyle.color = (.018, .021, .028)
    linestyle.thickness = 1.15
    audit['annotation'] = 'None; native muzzle and guide establish the longitudinal axis'
    points = [o.matrix_world @ p.co for o in objects for p in o.data.vertices]
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
    camera_data.ortho_scale *= max(max(abs((p.x - .5) * 2), abs((p.y - .5) * 2)) for p in normalized) * 1.09
    normalized = [world_to_camera_view(scene, camera, p) for p in points]
    bounds = [min(p.x for p in normalized), min(p.y for p in normalized),
              max(p.x for p in normalized), max(p.y for p in normalized)]
    if min(bounds[:2]) < .04 or max(bounds[2:]) > .96:
        raise RuntimeError(f'Framing would clip the native assembly: {bounds}')
    audit['normalized_projected_bounds'] = bounds
    def geometry_centre(index):
        obj = nodes[index]
        bounds = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
        return Vector([(max(p[i] for p in bounds) + min(p[i] for p in bounds)) / 2 for i in range(3)])
    muzzle = world_to_camera_view(scene, camera, geometry_centre(817))
    wheels = [world_to_camera_view(scene, camera, geometry_centre(i)) for i in (805, 821)]
    if muzzle.x >= min(p.x for p in wheels):
        raise RuntimeError('Reference direction mismatch: speed/muzzle module must project to the left of the wheels')
    audit['muzzle_left_of_wheels'] = True
    for name, offset, energy, size in (
            ('key', (1, -1, 2), 8, 1.3),
            ('fill', (-1.5, -.3, 1), 5, 1.4),
            ('rim', (.3, 1.3, 1.4), 6, 1.2)):
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
                  'samples': args.samples, 'candidate': args.candidate, 'frame_alpha': args.frame_alpha,
                  'camera_direction': list(direction),
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
    parser.add_argument('--width', type=int, default=2400)
    parser.add_argument('--height', type=int, default=1400)
    parser.add_argument('--samples', type=int, default=24)
    parser.add_argument('--candidate', choices=['a', 'b'], default='a')
    parser.add_argument('--view', nargs=3, type=float)
    parser.add_argument('--frame-alpha', type=float)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    args.view = args.view or CANDIDATES[args.candidate]['view']
    args.frame_alpha = args.frame_alpha if args.frame_alpha is not None else CANDIDATES[args.candidate]['frame_alpha']
    render(args)
