"""Build editable, source-traced field assets from official STEP tessellations.

Run with Blender --background --factory-startup --python-exit-code 1 --python.
The official STEP and manual remain untouched. Units in the .blend are metres.
"""

from pathlib import Path
import hashlib
import json
import math
import sys

import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / "materials/models/derived/inputs/rm2025-field"
OUTPUT = ROOT / "materials/models/derived/rm2025-field"
AUDIT = ROOT / "materials/documents/derived/audits/rm2025-field"
RENDERS = ROOT / "materials/images/derived/inputs/rm2025-field-renders"
SOURCE_CAD = "https://bbs.robomaster.com/article/372035?source=4"
SOURCE_MANUAL = "https://www.robomaster.com/zh-CN/resource/pages/announcement/1768"


def material(rgb, kind="cad"):
    key = kind + "_" + "_".join(f"{c:.4f}" for c in rgb)
    if key in bpy.data.materials:
        return bpy.data.materials[key]
    mat = bpy.data.materials.new(key)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*rgb, 1)
    shader.inputs["Roughness"].default_value = .56
    shader.inputs["Metallic"].default_value = .1
    if kind == "ore":
        shader.inputs["Roughness"].default_value = .78
        shader.inputs["Metallic"].default_value = 0
    if kind == "glass":
        shader.inputs["Base Color"].default_value = (.68, .83, .9, 1)
        shader.inputs["Transmission Weight"].default_value = .86
        shader.inputs["Roughness"].default_value = .13
        shader.inputs["IOR"].default_value = 1.46
    return mat


def object_bounds(objects):
    minima, maxima = [], []
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in objects:
        if obj.type != "MESH" or not len(obj.data.polygons):
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.data
        positions = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
        mesh.vertices.foreach_get("co", positions)
        matrix = np.array(obj.matrix_world, dtype=np.float64)
        world = positions.reshape((-1, 3)) @ matrix[:3, :3].T + matrix[:3, 3]
        minima.append(world.min(axis=0)); maxima.append(world.max(axis=0))
    return Vector(np.min(minima, axis=0)), Vector(np.max(maxima, axis=0))


def create_asset(config):
    raw = json.loads((WORK / f"{config['id']}.mesh.json").read_text(encoding="utf-8"))
    collection = bpy.data.collections.new(config["id"])
    bpy.context.scene.collection.children.link(collection)
    root = bpy.data.objects.new(config["id"].replace("-", "_"), None)
    collection.objects.link(root)
    root["source_cad"] = SOURCE_CAD
    root["source_step_sha256"] = config["source_step_sha256"]
    root["source_pdf_pages"] = config["source_pages"]
    root["units"] = "metres"
    root["origin_description"] = config["origin_description"]
    origin = Vector(config["origin_mm"]) / 1000
    basis = Matrix(config.get("basis", [[1, 0, 0], [0, 1, 0], [0, 0, 1]])).to_4x4()
    normalise = basis @ Matrix.Translation(-origin)
    cad_nodes = json.loads((AUDIT / "official-cad-index.json").read_text(encoding="utf-8"))["nodes"]

    def cad_matrix(node):
        result = Matrix([list(row) for row in node["transform_mm"]] + [[0, 0, 0, 1]])
        result.translation /= 1000
        return result

    assembly_ids = set()
    selected_roots = set(config["roots"])
    for occurrence in raw["instances"]:
        if occurrence["id"] in selected_roots:
            continue
        ancestor = occurrence["parent_id"]
        while ancestor is not None:
            assembly_ids.add(ancestor)
            if ancestor in selected_roots:
                break
            ancestor = cad_nodes[ancestor]["parent_id"]
    # A leaf selected on its own needs no unrelated field ancestors.
    if all(not cad_nodes[node_id]["children"] for node_id in selected_roots):
        assembly_ids.clear()
    assemblies = {}
    normalised_frames = {}
    for node_id in sorted(assembly_ids):
        node = cad_nodes[node_id]
        semantic_name = config.get("semantic_groups", {}).get(str(node_id), f"cad_{node_id:05d}_{node['definition_name']}")
        semantic_name = config["id"].replace("-", "_") + "__" + semantic_name
        obj = bpy.data.objects.new(semantic_name, None)
        collection.objects.link(obj)
        parent_id = node["parent_id"]
        obj.parent = assemblies.get(parent_id, root)
        frame = normalise @ cad_matrix(node)
        obj.matrix_local = normalised_frames.get(parent_id, Matrix.Identity(4)).inverted() @ frame
        obj["cad_node_id"] = node_id
        obj["cad_definition"] = node["definition_entry"]
        obj["cad_name"] = node["definition_name"]
        assemblies[node_id] = obj
        normalised_frames[node_id] = frame
    meshes = {}
    objects = []
    for occurrence in raw["instances"]:
        geometry_key = occurrence["definition_entry"]
        geometry = raw["geometries"][geometry_key]
        if not geometry["triangles"]:
            continue
        rgb = occurrence["color"] or [.32, .34, .36]
        is_gold_ore = config["id"] == "ore-gold" or "金矿石" in occurrence["path"]
        kind = "ore" if config["id"].startswith("ore-") or is_gold_ore else "cad"
        if occurrence["id"] in config.get("glass_nodes", []):
            kind = "glass"
        cache_key = (geometry_key, tuple(round(v, 5) for v in rgb), kind)
        if cache_key not in meshes:
            mesh = bpy.data.meshes.new(f"cad_{geometry_key}")
            mesh.from_pydata([[v / 1000 for v in position] for position in geometry["positions_mm"]], [], geometry["triangles"])
            mesh.update()
            material_map = {}
            for polygon, face_color in zip(mesh.polygons, geometry["face_colors"]):
                face_rgb = tuple(round(v, 5) for v in (face_color or rgb))
                if str(occurrence["id"]) in config.get("material_overrides", {}):
                    face_rgb = tuple(config["material_overrides"][str(occurrence["id"])])
                # The STEP uses a shared white ore solid. The latest manual
                # distinguishes the gold variant by yellow EVA, with black print.
                if is_gold_ore and min(face_rgb) > .75 and max(face_rgb) - min(face_rgb) < .025:
                    face_rgb = (.95, .72, .005)
                if face_rgb not in material_map:
                    material_map[face_rgb] = len(mesh.materials)
                    mesh.materials.append(material(face_rgb, kind))
                polygon.material_index = material_map[face_rgb]
            # STEP faces duplicate boundary vertices and often triangulate large
            # planar plates densely. Weld 0.0001 mm and dissolve near-coplanar
            # interiors while retaining material boundaries and source parts.
            bm = bmesh.new()
            bm.from_mesh(mesh)
            bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
            bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(.15), use_dissolve_boundaries=False, verts=list(bm.verts), edges=list(bm.edges), delimit={"MATERIAL"})
            bm.to_mesh(mesh)
            bm.free()
            mesh.update()
            meshes[cache_key] = mesh
        name = config.get("semantic_parts", {}).get(str(occurrence["id"]), f"cad_{occurrence['id']:05d}_{occurrence['definition_name']}")
        name = config["id"].replace("-", "_") + "__" + name
        obj = bpy.data.objects.new(name, meshes[cache_key])
        collection.objects.link(obj)
        obj.parent = assemblies.get(occurrence["parent_id"], root)
        transform = cad_matrix(occurrence)
        parent_frame = normalised_frames.get(occurrence["parent_id"], Matrix.Identity(4))
        obj.matrix_local = parent_frame.inverted() @ normalise @ transform
        obj["cad_node_id"] = occurrence["id"]
        obj["cad_definition"] = occurrence["definition_entry"]
        obj["cad_name"] = occurrence["definition_name"]
        objects.append(obj)
    bpy.context.view_layer.update()
    if config.get("clip"):
        for obj in list(objects):
            obj.data = obj.data.copy()
            bm = bmesh.new()
            bm.from_mesh(obj.data)
            inverse = obj.matrix_world.inverted()
            for axis, minimum, maximum in config["clip"]:
                for value, sign in ((minimum, -1), (maximum, 1)):
                    point = Vector((0, 0, 0)); point[axis] = value
                    normal = Vector((0, 0, 0)); normal[axis] = sign
                    local_point = inverse @ point
                    local_normal = obj.matrix_world.to_3x3().transposed() @ normal
                    geometry = list(bm.verts) + list(bm.edges) + list(bm.faces)
                    bmesh.ops.bisect_plane(bm, geom=geometry, dist=1e-7, plane_co=local_point, plane_no=local_normal, clear_outer=True, clear_inner=False)
            bm.to_mesh(obj.data); bm.free(); obj.data.update()
    for obj in objects:
        obj.data.calc_loop_triangles()
        count = len(obj.data.loop_triangles)
        if config["id"] in ("exchange-station", "exchange-slot") and count > 1800:
            modifier = obj.modifiers.new("web_detail_level", "DECIMATE")
            modifier.decimate_type = "COLLAPSE"
            modifier.ratio = .15 if config["id"] == "exchange-station" else .3
            modifier.use_collapse_triangulate = True
            obj["source_triangles"] = count
            obj["web_simplification_ratio"] = modifier.ratio
    bpy.context.view_layer.update()
    minimum, maximum = object_bounds(objects)
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for obj in objects + list(assemblies.values()):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    destination = OUTPUT / "models" / f"{config['id']}.glb"
    bpy.ops.export_scene.gltf(filepath=str(destination), export_format="GLB", use_selection=True, export_yup=True, export_extras=True, export_apply=True, export_cameras=False, export_lights=False)
    triangles = 0
    for obj in objects:
        evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        evaluated.data.calc_loop_triangles()
        triangles += len(evaluated.data.loop_triangles)
    result = {"id": config["id"], "file": f"models/{config['id']}.glb", "source_pages": config["source_pages"], "source_node_ids": [n["id"] for n in raw["instances"]], "origin_description": config["origin_description"], "bounds_blender_m": [list(minimum), list(maximum)], "dimensions_mm": [round((maximum[i] - minimum[i]) * 1000, 3) for i in range(3)], "triangles": triangles, "mesh_objects": len(objects), "bytes": destination.stat().st_size, "sha256": hashlib.sha256(destination.read_bytes()).hexdigest()}
    print(json.dumps(result, ensure_ascii=False), flush=True)
    return root, objects, result


def setup_camera(objects):
    minimum, maximum = object_bounds(objects)
    center = (minimum + maximum) / 2
    radius = (maximum - minimum).length / 2
    scene = bpy.context.scene
    camera = bpy.data.objects.get("asset_camera")
    if camera is None:
        camera = bpy.data.objects.new("asset_camera", bpy.data.cameras.new("asset_camera"))
        scene.collection.objects.link(camera)
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = max(radius * 2.35, .35)
    camera.location = center + Vector((1.1, -1.7, 1.15)).normalized() * max(radius * 4, 3)
    camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.clip_end = 200
    scene.camera = camera


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / "models").mkdir(exist_ok=True)
    AUDIT.mkdir(parents=True, exist_ok=True)
    RENDERS.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 12
    scene.cycles.use_denoising = True
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 3
    scene.render.resolution_x = 1100
    scene.render.resolution_y = 850
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.view_settings.view_transform = "AgX"
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs[0].default_value = (.18, .22, .28, 1)
    scene.world.node_tree.nodes["Background"].inputs[1].default_value = .65
    for name, location, energy, size in [("key", (4, -5, 7), 1300, 6), ("fill", (-4, -1, 4), 900, 5), ("rim", (1, 4, 6), 1500, 4)]:
        light = bpy.data.lights.new(name, "AREA"); light.energy = energy; light.shape = "DISK"; light.size = size
        obj = bpy.data.objects.new(name, light); scene.collection.objects.link(obj); obj.location = location
        obj.rotation_euler = (-obj.location).to_track_quat("-Z", "Y").to_euler()
    plan = json.loads((WORK / "asset-selection.json").read_text(encoding="utf-8"))
    built = [create_asset(config) for config in plan["assets"]]
    manifest = {"schema": 1, "units": "metres", "source_cad_url": SOURCE_CAD, "source_manual_url": SOURCE_MANUAL, "source_step_sha256": plan["source_step_sha256"], "assets": [record for root, objects, record in built], "scope": "Reusable field assets and local preview; no portfolio route or choreography changed"}
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    for root, objects, record in built:
        for other_root, other_objects, _ in built:
            for obj in other_objects:
                obj.hide_render = other_root != root
        setup_camera(objects)
        scene.render.filepath = str(RENDERS / f"{record['id']}.png")
        bpy.ops.render.render(write_still=True)
    finalize_existing()


def finalize_existing():
    """Recompute envelopes from actual evaluated vertices, then arrange the master."""
    manifest = json.loads((OUTPUT / "manifest.json").read_text(encoding="utf-8"))
    built = []
    for record in manifest["assets"]:
        root = bpy.data.objects[record["id"].replace("-", "_")]
        root.location = (0, 0, 0)
        objects = [obj for obj in bpy.data.collections[record["id"]].objects if obj.type == "MESH" and len(obj.data.polygons)]
        for obj in objects:
            obj.hide_render = False
        built.append((root, objects, record))
    bpy.context.view_layer.update()
    for root, objects, record in built:
        minimum, maximum = object_bounds(objects)
        record["bounds_blender_m"] = [list(minimum), list(maximum)]
        record["bounds_gltf_m"] = [[minimum.x, minimum.z, -maximum.y], [maximum.x, maximum.z, -minimum.y]]
        record["dimensions_mm"] = [round((maximum[i] - minimum[i]) * 1000, 3) for i in (0, 2, 1)]
        record["dimension_axes"] = "GLB X width, Y height, Z depth"
        record["measurement_method"] = "actual evaluated mesh vertices, not transformed object boxes"
        print(json.dumps({"id": record["id"], "dimensions_mm": record["dimensions_mm"]}, ensure_ascii=False), flush=True)
    manifest["slot_frame"] = {"origin": "entrance front surface centre", "outward_axis": "+Z", "up_axis": "+Y", "right_axis": "+X", "manual_to_gltf_metres": "(Y/1000, Z/1000, X/1000)", "rotation": "Ry(theta) * Rx(phi - 90deg) * Rz(alpha)", "ore_inserted_center_m": [0, -.0199, -.106], "ore_print_extrusion_mm": .2}
    manifest["editable_source"] = "../inputs/rm2025-field/rm2025-field-assets.blend"
    manifest["source_cad_rules_version"] = "2.0.0"
    manifest["manual_check_version"] = "2.1.0"
    manifest["geometry_processing"] = "Selected official solids; metric conversion; material-boundary-preserving cleanup; cropped highland context; non-destructive web-detail modifiers on station and slot"
    manifest["visual_adjustments"] = ["Gold ore body recolored from shared white STEP solid to manual yellow EVA", "Manual-identified transparent resource-island panels assigned glass material", "Cropped official 3 mm ground sheet displayed in neutral dark grey instead of the STEP region-marker blue", "R-indicator shell and diffuser recolored from STEP orange to manual dark shell and white diffuser"]
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    (AUDIT / "build-report.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    layout = {"exchange-station": (-2.4, -2.8), "gold-island": (-2.1, 1.7), "silver-island": (2.3, -1.8), "ore-gold": (1.6, .8), "ore-silver": (2.1, .8), "exchange-slot": (.5, -.1), "highland-crossing": (.7, 3.4)}
    for root, objects, record in built:
        minimum, maximum = object_bounds(objects)
        center = (minimum + maximum) / 2
        x, z = layout[record["id"]]
        root.location = (x - center.x, -z - center.y, -minimum.z)
        root["gallery_location"] = list(root.location)
        bpy.context.view_layer.update()
    all_objects = [obj for root, objects, record in built for obj in objects]
    setup_camera(all_objects)
    scene = bpy.context.scene
    scene.cycles.samples = 8
    scene.render.resolution_x = 1500
    scene.render.resolution_y = 1050
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(WORK / "rm2025-field-assets.blend"))
    scene.render.filepath = str(RENDERS / "overview.png")
    bpy.ops.render.render(write_still=True)


def update_ground_context():
    manifest = json.loads((OUTPUT / "manifest.json").read_text(encoding="utf-8"))
    plan = json.loads((WORK / "asset-selection.json").read_text(encoding="utf-8"))
    for config in plan["assets"]:
        if config["id"] not in ("silver-island", "highland-crossing"):
            continue
        collection = bpy.data.collections[config["id"]]
        for obj in list(collection.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(collection)
        root, objects, record = create_asset(config)
        for index, old in enumerate(manifest["assets"]):
            if old["id"] == config["id"]:
                manifest["assets"][index] = record
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    finalize_existing()


def update_indicator_materials():
    manifest = json.loads((OUTPUT / "manifest.json").read_text(encoding="utf-8"))
    collection = bpy.data.collections["exchange-station"]
    for obj in collection.objects:
        if obj.type != "MESH":
            continue
        node_id = obj.get("cad_node_id")
        if node_id in (814, 815, 816, 817):
            obj.data = obj.data.copy()
            obj.data.materials.clear()
            obj.data.materials.append(material((.82, .82, .82) if node_id == 816 else (.025, .028, .032)))
            for polygon in obj.data.polygons:
                polygon.material_index = 0
    root = bpy.data.objects["exchange_station"]
    root.location = (0, 0, 0)
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action="DESELECT")
    for obj in collection.objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    destination = OUTPUT / "models/exchange-station.glb"
    bpy.ops.export_scene.gltf(filepath=str(destination), export_format="GLB", use_selection=True, export_yup=True, export_extras=True, export_apply=True, export_cameras=False, export_lights=False)
    record = next(a for a in manifest["assets"] if a["id"] == "exchange-station")
    record["bytes"] = destination.stat().st_size
    record["sha256"] = hashlib.sha256(destination.read_bytes()).hexdigest()
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    finalize_existing()


if __name__ == "__main__":
    if "--update-indicator" in sys.argv:
        update_indicator_materials()
    elif "--update-ground" in sys.argv:
        update_ground_context()
    elif "--finalize-existing" in sys.argv:
        finalize_existing()
    else:
        main()
