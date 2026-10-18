"""Export source-derived mission context in one field frame; native CAD stays read-only.

Uses the uncut crossing meshes where available and reads the verified XCAF cache
for the remaining simple terrain. Only mission-field-context.json is written.
W metres = (-source Z, source Y, source X) / 1000, matching rule figure 4-4.
"""
from __future__ import annotations

import hashlib
import gzip
import json
import math
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "materials/models/derived/inputs/rm2025-field"
INDEX = ROOT / "materials/documents/derived/audits/rm2025-field/official-cad-index.json"
OUTPUT = ROOT / "materials/models/derived/rm2025-field/models/mission-field-context.json"
DEPS = ROOT / "tmp/rm2025-field-python"
sys.path.insert(0, str(DEPS))
DLL_HANDLES = [os.add_dll_directory(str(DEPS / name)) for name in
               ("cadquery_ocp.libs", "vtk.libs", "vtkmodules")
               if os.name == "nt" and (DEPS / name).is_dir()]

from OCP.BRep import BRep_Tool
from OCP.BRepMesh import BRepMesh_IncrementalMesh
from OCP.BinXCAFDrivers import BinXCAFDrivers
from OCP.Quantity import Quantity_Color
from OCP.TCollection import TCollection_ExtendedString
from OCP.TDF import TDF_Label, TDF_Tool
from OCP.TDocStd import TDocStd_Document
from OCP.TopAbs import TopAbs_FACE, TopAbs_REVERSED,TopAbs_EDGE
from OCP.BRepAdaptor import BRepAdaptor_Curve
from OCP.GeomAbs import GeomAbs_Line
from OCP.TopExp import TopExp_Explorer
from OCP.TopLoc import TopLoc_Location
from OCP.TopoDS import TopoDS
from OCP.XCAFApp import XCAFApp_Application
from OCP.XCAFDoc import (XCAFDoc_ColorGen, XCAFDoc_ColorSurf,
                        XCAFDoc_DocumentTool, XCAFDoc_ShapeTool)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    energy = '--energy' in sys.argv
    lights = '--lights' in sys.argv
    bases = '--bases' in sys.argv
    markings = '--markings' in sys.argv
    bump_arrows = '--bump-arrows' in sys.argv
    catalog = json.loads(INDEX.read_text(encoding="utf-8"))
    nodes = catalog["nodes"]
    raw_path = INPUT / "highland-crossing.mesh.json"
    raw = json.loads(raw_path.read_text(encoding="utf-8"))
    metadata = json.loads((INPUT / "official-field-cache.json").read_text(encoding="utf-8"))
    if metadata["source_sha256"] != catalog["sha256"]:
        raise RuntimeError("XCAF cache and official CAD index have different sources")
    if raw["selection"]["source_step_sha256"] != catalog["sha256"]:
        raise RuntimeError("Raw crossing mesh and CAD index have different sources")

    # Complete terrain bodies, never cropped for the former single-asset preview.
    selected = {5, 33, 53, 69, 71, 100, 101, 108, 109, 110, 111, 112,
                115, 119, 121, 130, 132, 592, 593, 594, 595, 1390, 1391}

    def leaves(index: int) -> list[int]:
        children = nodes[index]["children"]
        return [index] if not children else [leaf for child in children for leaf in leaves(child)]

    for root in (90, 1272, 765, 1281):
        selected.update(leaves(root))
    if energy:
        selected=set(leaves(2935))
    if lights:
        # Thin floor light paths confirmed against the existing official wide
        # and operator-POV clips. Broad blue floor solids and painted arrows
        # (8..19) are intentionally excluded.
        selected={3,4,22,23,24,25,26,27,28,29,30,34,38,39,40,41,42,43,44,45,46,49,50,51,52,127,128,1266,1267,1268,1269,1270,1271}
    if bases:
        selected=set(leaves(1392)+leaves(2264))
    if markings:
        selected={7,20,21,31,32,35,36,37,47,48,49,50,51,52,103,104,105,106,107,113,114,116,117,118,120,122,124,126,131,1266,1267,1268,1269,1270,1271}
        for root in [54,1197,1211,1295,1311]:selected.update(leaves(root))
    if bump_arrows:selected=set(range(8,20))

    raw_instances = {node["id"]: node for node in raw["instances"]}
    app = XCAFApp_Application.GetApplication_s()
    BinXCAFDrivers.DefineFormat_s(app)
    doc = TDocStd_Document(TCollection_ExtendedString("BinXCAF"))
    status = app.Open(TCollection_ExtendedString(str(INPUT / "official-field.xbf")), doc)
    if str(status) != "PCDM_ReaderStatus.PCDM_RS_OK":
        raise RuntimeError(f"Read-only XCAF open failed: {status}")
    doc = app.GetDocument(app.NbDocuments())
    color_tool = XCAFDoc_DocumentTool.ColorTool_s(doc.Main())
    geometry_cache: dict[str, dict] = {}

    def cached_mesh(entry: str) -> dict:
        if entry in geometry_cache:
            return geometry_cache[entry]
        label = TDF_Label()
        TDF_Tool.Label_s(doc.GetData(), entry, label, False)
        if label.IsNull():
            raise RuntimeError(f"Missing source label {entry}")
        shape = XCAFDoc_ShapeTool.GetShape_s(label)
        operation = BRepMesh_IncrementalMesh(shape, .8, False, .25, False)
        if not operation.IsDone():
            raise RuntimeError(f"Tessellation failed for {entry}")
        positions, triangles, colors = [], [], []
        faces = TopExp_Explorer(shape, TopAbs_FACE)
        while faces.More():
            face = TopoDS.Face(faces.Current())
            location = TopLoc_Location()
            triangulation = BRep_Tool.Triangulation_s(face, location)
            if triangulation is not None:
                offset = len(positions)
                for i in range(1, triangulation.NbNodes() + 1):
                    p = triangulation.Node(i).Transformed(location.Transformation())
                    positions.append([p.X(), p.Y(), p.Z()])
                rgb = None
                color = Quantity_Color()
                for kind in (XCAFDoc_ColorSurf, XCAFDoc_ColorGen):
                    if color_tool.GetColor(face, kind, color):
                        rgb = [color.Red(), color.Green(), color.Blue()]
                        break
                for i in range(1, triangulation.NbTriangles() + 1):
                    a, b, c = triangulation.Triangle(i).Get()
                    if face.Orientation() == TopAbs_REVERSED:
                        b, c = c, b
                    triangles.append([offset + a - 1, offset + b - 1, offset + c - 1])
                    colors.append(rgb)
            faces.Next()
        lines=[]
        if markings and not triangles:
            explorer=TopExp_Explorer(shape,TopAbs_EDGE)
            while explorer.More():
                curve=BRepAdaptor_Curve(TopoDS.Edge(explorer.Current()));a=curve.FirstParameter();b=curve.LastParameter()
                if math.isfinite(a) and math.isfinite(b):
                    count=1 if curve.GetType()==GeomAbs_Line else 16
                    for i in range(count):
                        for u in [a+(b-a)*i/count,a+(b-a)*(i+1)/count]:
                            p=curve.Value(u);lines.append([p.X(),p.Y(),p.Z()])
                explorer.Next()
        geometry_cache[entry] = {"positions_mm": positions, "triangles": triangles,
                                 "face_colors": colors,'lines_mm':lines}
        return geometry_cache[entry]

    meshes = []
    for source_id in sorted(selected):
        node = nodes[source_id]
        from_raw = source_id in raw_instances
        geometry = (raw["geometries"][node["definition_entry"]] if from_raw
                    else cached_mesh(node["definition_entry"]))
        transform = node["transform_mm"]
        if not geometry['triangles']:
            if not markings or not geometry.get('lines_mm'):continue
            lines=[]
            for point in geometry['lines_mm']:
                s=[sum(transform[row][col]*point[col] for col in range(3))+transform[row][3] for row in range(3)]
                lines.extend(round(value/1000,7) for value in [-s[2],s[1],s[0]])
            axes=[lines[k::3] for k in range(3)]
            meshes.append({'sourceId':source_id,'name':node['name'],'lines':lines,'positions':[],'indices':[],'bounds':{'min':[min(a)for a in axes],'max':[max(a)for a in axes]}})
            continue
        vertices = []
        for point in geometry["positions_mm"]:
            s = [sum(transform[row][col] * point[col] for col in range(3))
                 + transform[row][3] for row in range(3)]
            vertices.extend(round(value / 1000, 7) for value in (-s[2], s[1], s[0]))
        inherited = node["color"]
        parent = node["parent_id"]
        while inherited is None and parent is not None:
            inherited = nodes[parent]["color"]
            parent = nodes[parent]["parent_id"]
        palette, color_indices = [], []
        for color in geometry["face_colors"]:
            rgb = [round(float(x), 6) for x in (color or inherited or [.32, .34, .36])]
            if rgb not in palette:
                palette.append(rgb)
            color_indices.append(palette.index(rgb))
        axes = [vertices[axis::3] for axis in range(3)]
        meshes.append({"sourceId": source_id, "name": node["name"], "path": node["path"],
                       "definition": node["definition_entry"],
                       "readFrom": "uncropped crossing mesh" if from_raw else "read-only XCAF cache",
                       "positions": vertices,
                       "indices": [int(i) for triangle in geometry["triangles"] for i in triangle],
                       "colors": palette, "triangleColorIndices": color_indices,
                       "bounds": {"min": [min(axis) for axis in axes],
                                  "max": [max(axis) for axis in axes]}})
        if energy:
            ancestors=[];ancestor=source_id
            while ancestor is not None:
                ancestors.append(ancestor);ancestor=nodes[ancestor]['parent_id']
            red=next((x for x in [3107,3150,3193,3236,3279] if x in ancestors),None)
            blue=next((x for x in [3324,3367,3410,3453,3496] if x in ancestors),None)
            meshes[-1]['rotor']='red' if red else 'blue' if blue else None
            meshes[-1]['arm']=red or blue
            meshes[-1]['diffuser']=any('均光灯板' in nodes[x]['name'] for x in ancestors)
    triangles = sum(len(mesh["indices"]) // 3 for mesh in meshes)
    if triangles > (3000000 if energy or bases else 80000):
        raise RuntimeError(f"Unexpectedly heavy context: {triangles} triangles")
    for mesh in meshes:
        vertex_count = len(mesh["positions"]) // 3
        if not all(math.isfinite(value) for value in mesh["positions"]):
            raise RuntimeError(f"Nonfinite source vertices: {mesh['sourceId']}")
        if not all(0 <= i < vertex_count for i in mesh["indices"]):
            raise RuntimeError(f"Invalid source indices: {mesh['sourceId']}")
    result = {
        "schema": 1, "units": "metres", "frame": "W=(-source Z, source Y, source X)/1000",
        "sourceStepSha256": catalog["sha256"],
        "sourceIndex": str(INDEX.relative_to(ROOT)), "sourceIndexSha256": sha256(INDEX),
        "sourceRaw": str(raw_path.relative_to(ROOT)), "sourceRawSha256": sha256(raw_path),
        "sourceCache": str((INPUT / "official-field.xbf").relative_to(ROOT)),
        "sourceIds": [mesh["sourceId"] for mesh in meshes],
        "sourceRulesPages": [35, 37, 60, 61, 64],
        "note": "Exact selected CAD meshes without preview crop, decimation or invented slopes. "
                "Original face colors are retained as evidence, not automatic emissive flags. "
                "Detailed resource islands, ores and exchange stations remain separate runtime assets. "
                "The cache is read and tessellated in memory; it is never saved.",
        "anchors": {
            "blueBasePlatform": [11.5400164, .213, 0],
            "blueFortressPlatform": [7.4, .153, 0],
            "blueSilverOre3": [4.305, .103, 1.0549976],
            "blueSilverOre4": [4.305, .103, 1.3249976],
            "blueStepGround": [4.465, .003, 0],
            "blueStepLower": [4.465, .203, 0],
            "blueStepUpper": [4.0, .3028778, 0],
            "blueRampTop": [2.6807805, .3028776435, -2.4772025],
            "blueRampFoot": [3.4444675, 0, -2.8085745],
            "blueExchangeFront": [12.586, 0, -6.545]},
        "assetPlacement": {
            "silver-island": {"yawDegrees": 90, "translation": [4.305, 0, 0]},
            "highland-crossing": {"yawDegrees": 90, "translation": [4.305, 0, 0]},
            "gold-island": {"yawDegrees": -135, "translation": [0, .3, 0]},
            "exchange-station-blue-copy": {"yawDegrees": -90, "translation": [12.586, 0, -6.545]}},
        "triangleCount": triangles, "meshes": meshes}
    output=OUTPUT.with_name('mission-bump-arrows.json') if bump_arrows else OUTPUT.with_name('mission-field-markings.json') if markings else INPUT/'mission-bases.mesh.json' if bases else INPUT/'mission-energy.mesh.json' if energy else OUTPUT.with_name('mission-field-lights.json') if lights else OUTPUT
    if energy:
        result['rotationAxis']={'point':[-.000003874777567,2.29387750361,.00000003490473],'direction':[2**-.5,0,2**-.5]}
        result['sourceRulesPages']=[65,66,67]
        result['note']='Original complete two-sided energy mechanism, source assembly2935. Only the five fan arms on each side rotate around the core gearbox output axis; suspension, pillars and central housing remain fixed. Colour/light timing is an authored background state.'
    if lights:
        result['sourceRulesPages']=[35,37,60,61]
        result['note']='Actual thin source light paths and ramp joins, cross-checked against egg-steal-official.mp4@3s, egg-grab-official.mp4@4s, wr58-official.mp4@3s, egg-grab-pov.mp4@3s. Blue half uses pale cyan and red half warm white-yellow as visible in footage; never infer emission from broad CAD team-colour faces.'
    if bases:
        result['sourceRulesPages']=[40,41,42]
        result['note']='Complete source base assemblies1392 and2264 at their original world positions, including central armour, base shielding and detector hardware. Derived mesh only; original STEP/cache are never written.'
    if markings:
        result['sourceRulesPages']=[37,40,50,55,59,61,63,68,70]
        result['note']='Original thin printed polygons, glyphs and CAD wire paths for gain zones and field markings. Printed markings are non-emissive and distinct from actual lamps. Wire-only paths are retained rather than silently discarded by face tessellation.'
    if bump_arrows:
        result['sourceRulesPages']=[69]
        result['note']='Original arrow-shaped bump footprints. The mission terrain baker applies the rule69 nominal11mm raised profile, rather than treating these outlines as luminous paint.'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    if energy or bases:
        packed=OUTPUT.with_name('mission-bases.json.gz' if bases else 'mission-energy.json.gz')
        packed.write_bytes(gzip.compress(output.read_bytes(),compresslevel=9,mtime=0))
        print(json.dumps({'packed':str(packed),'bytes':packed.stat().st_size}),flush=True)
    print(json.dumps({"output": str(output), "meshes": len(meshes), "triangles": triangles,
                      "bytes": output.stat().st_size, "sourceIds": result["sourceIds"]}), flush=True)


if __name__ == "__main__":
    main()
