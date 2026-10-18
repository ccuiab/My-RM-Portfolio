"""Inspect the official field STEP without changing it; preserve XCAF hierarchy.

Dependencies are deliberately local to tmp/rm2025-field-python:
    python -m pip install --target tmp/rm2025-field-python cadquery-ocp==8.0.1.1.0
All CAD caches and exports are derived materials. The source STEP is read-only.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
DEPS = ROOT / "tmp/rm2025-field-python"
sys.path.insert(0, str(DEPS))
DLL_HANDLES = [os.add_dll_directory(str(DEPS / name)) for name in ("cadquery_ocp.libs", "vtk.libs", "vtkmodules") if os.name == "nt" and (DEPS / name).is_dir()]

from OCP.Bnd import Bnd_Box
from OCP.BRepBndLib import BRepBndLib
from OCP.BinXCAFDrivers import BinXCAFDrivers
from OCP.collections import Sequence_TDF_Label
from OCP.IFSelect import IFSelect_RetDone
from OCP.Quantity import Quantity_Color
from OCP.STEPCAFControl import STEPCAFControl_Reader
from OCP.TCollection import TCollection_AsciiString, TCollection_ExtendedString
from OCP.TDataStd import TDataStd_Name
from OCP.TDF import TDF_AttributeIterator, TDF_Label, TDF_Tool
from OCP.TDocStd import TDocStd_Document
from OCP.TopLoc import TopLoc_Location
from OCP.XCAFApp import XCAFApp_Application
from OCP.XCAFDoc import XCAFDoc_ColorGen, XCAFDoc_ColorSurf, XCAFDoc_ColorTool, XCAFDoc_DocumentTool, XCAFDoc_ShapeTool

SOURCE = ROOT / "materials/models/source/robomaster/2025/RMUC 2025复活赛&全国赛_asm.stp"
WORK = ROOT / "materials/models/derived/inputs/rm2025-field"
AUDIT = ROOT / "materials/documents/derived/audits/rm2025-field"


def entry(label):
    result = TCollection_AsciiString()
    TDF_Tool.Entry_s(label, result)
    return result.ToCString()


def name(label):
    attributes = TDF_AttributeIterator(label)
    while attributes.More():
        attribute = attributes.Value()
        if isinstance(attribute, TDataStd_Name):
            return attribute.Get().ToExtString()
        attributes.Next()
    return entry(label)


def color(tool, labels):
    result = Quantity_Color()
    for label in labels:
        for kind in (XCAFDoc_ColorSurf, XCAFDoc_ColorGen):
            if XCAFDoc_ColorTool.GetColor_s(label, kind, result):
                return [result.Red(), result.Green(), result.Blue()]
    return None


def export_selected(doc, nodes, selection):
    """Tessellate selected official solids; keep definitions and occurrences apart."""
    from OCP.BRep import BRep_Tool
    from OCP.BRepMesh import BRepMesh_IncrementalMesh
    from OCP.TopAbs import TopAbs_FACE, TopAbs_REVERSED
    from OCP.TopExp import TopExp_Explorer
    from OCP.TopoDS import TopoDS

    shape_tool = XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())
    color_tool = XCAFDoc_DocumentTool.ColorTool_s(doc.Main())
    geometries = {}

    def get_label(label_entry):
        label = TDF_Label()
        TDF_Tool.Label_s(doc.GetData(), label_entry, label, False)
        if label.IsNull():
            raise RuntimeError(f"Unknown label {label_entry}")
        return label

    def descendants(node_id, excluded):
        if node_id in excluded:
            return []
        node = nodes[node_id]
        if not node["children"]:
            return [node_id]
        return [leaf for child in node["children"] for leaf in descendants(child, excluded)]

    def mesh(definition_entry):
        if definition_entry in geometries:
            return geometries[definition_entry]
        label = get_label(definition_entry)
        shape = XCAFDoc_ShapeTool.GetShape_s(label)
        operation = BRepMesh_IncrementalMesh(shape, .8, False, .25, False)
        if not operation.IsDone():
            raise RuntimeError(f"Tessellation failed: {definition_entry}")
        positions, triangles, face_colors = [], [], []
        faces = TopExp_Explorer(shape, TopAbs_FACE)
        while faces.More():
            face = TopoDS.Face(faces.Current())
            location = TopLoc_Location()
            triangulation = BRep_Tool.Triangulation_s(face, location)
            if triangulation is not None:
                offset = len(positions)
                for i in range(1, triangulation.NbNodes() + 1):
                    point = triangulation.Node(i).Transformed(location.Transformation())
                    positions.append([round(point.X(), 7), round(point.Y(), 7), round(point.Z(), 7)])
                face_color = Quantity_Color()
                rgb = None
                for kind in (XCAFDoc_ColorSurf, XCAFDoc_ColorGen):
                    if color_tool.GetColor(face, kind, face_color):
                        rgb = [face_color.Red(), face_color.Green(), face_color.Blue()]
                        break
                for i in range(1, triangulation.NbTriangles() + 1):
                    a, b, c = triangulation.Triangle(i).Get()
                    if face.Orientation() == TopAbs_REVERSED:
                        b, c = c, b
                    triangles.append([offset + a - 1, offset + b - 1, offset + c - 1])
                    face_colors.append(rgb)
            faces.Next()
        result = {"positions_mm": positions, "triangles": triangles, "face_colors": face_colors}
        geometries[definition_entry] = result
        return result

    for asset in selection["assets"]:
        excluded = set(asset.get("exclude", []))
        ids = sorted({leaf for root in asset["roots"] for leaf in descendants(root, excluded)})
        instances = []
        used_geometry = {}
        for node_id in ids:
            node = nodes[node_id]
            key = node["definition_entry"]
            used_geometry[key] = mesh(key)
            inherited_color = node["color"]
            ancestor = node["parent_id"]
            while inherited_color is None and ancestor is not None:
                inherited_color = nodes[ancestor]["color"]
                ancestor = nodes[ancestor]["parent_id"]
            instances.append({**node, "color": inherited_color})
        output = {"id": asset["id"], "selection": asset, "geometries": used_geometry, "instances": instances}
        path = WORK / f"{asset['id']}.mesh.json"
        path.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(json.dumps({"exported": asset["id"], "instances": len(instances), "definitions": len(used_geometry), "triangles": sum(len(used_geometry[n['definition_entry']]['triangles']) for n in instances)}, ensure_ascii=False), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE)
    parser.add_argument("--wait-for-selection", type=Path)
    parser.add_argument("--reimport", action="store_true")
    args = parser.parse_args()
    if args.source.suffix.lower() not in (".stp", ".step"):
        parser.error("Only a completed STEP file is accepted, never a .download file")
    if not args.source.is_file():
        parser.error(f"Completed official source is not available: {args.source}")
    digest_before = hashlib.sha256(args.source.read_bytes()).hexdigest()
    WORK.mkdir(parents=True, exist_ok=True)
    AUDIT.mkdir(parents=True, exist_ok=True)
    app = XCAFApp_Application.GetApplication_s()
    BinXCAFDrivers.DefineFormat_s(app)
    doc = TDocStd_Document(TCollection_ExtendedString("BinXCAF"))
    started = time.time()
    cache = WORK / "official-field.xbf"
    cache_metadata = WORK / "official-field-cache.json"
    valid_cache = cache.exists() and cache_metadata.exists() and json.loads(cache_metadata.read_text())["source_sha256"] == digest_before
    if valid_cache and not args.reimport:
        print("Opening the verified derived XCAF cache...", flush=True)
        status = app.Open(TCollection_ExtendedString(str(cache)), doc)
        if str(status) != "PCDM_ReaderStatus.PCDM_RS_OK":
            raise RuntimeError(f"XCAF cache open failed: {status}")
        doc = app.GetDocument(app.NbDocuments())
    else:
        doc = app.NewDocument(TCollection_ExtendedString("BinXCAF"), doc)[0]
        print("Reading the completed official STEP...", flush=True)
        reader = STEPCAFControl_Reader()
        reader.SetColorMode(True)
        reader.SetNameMode(True)
        reader.SetLayerMode(True)
        if reader.ReadFile(str(args.source)) != IFSelect_RetDone:
            raise RuntimeError("STEP ReadFile failed")
        print(f"ReadFile completed in {time.time() - started:.1f}s; transferring XCAF...", flush=True)
        if not reader.Transfer(doc):
            raise RuntimeError("STEP XCAF transfer failed")
        print("Saving verified intermediate CAD cache...", flush=True)
        status = app.SaveAs(doc, TCollection_ExtendedString(str(cache)))
        if str(status) != "PCDM_StoreStatus.PCDM_SS_OK":
            raise RuntimeError(f"XCAF cache save failed: {status}")
        cache_metadata.write_text(json.dumps({"source_sha256": digest_before, "bytes": cache.stat().st_size}), encoding="utf-8")
    shape_tool = XCAFDoc_DocumentTool.ShapeTool_s(doc.Main())
    color_tool = XCAFDoc_DocumentTool.ColorTool_s(doc.Main())
    roots = Sequence_TDF_Label()
    shape_tool.GetFreeShapes(roots)
    nodes = []

    def walk(occurrence, parent_location, parent_id=None, path=()):
        definition = occurrence
        location = parent_location
        if XCAFDoc_ShapeTool.IsReference_s(occurrence):
            definition = TDF_Label()
            XCAFDoc_ShapeTool.GetReferredShape_s(occurrence, definition)
            location = parent_location.Multiplied(XCAFDoc_ShapeTool.GetLocation_s(occurrence))
        node_id = len(nodes)
        transform = location.Transformation()
        node = {"id": node_id, "parent_id": parent_id, "name": name(occurrence), "definition_name": name(definition), "occurrence_entry": entry(occurrence), "definition_entry": entry(definition), "path": list(path) + [name(occurrence)], "transform_mm": [[transform.Value(i, j) for j in range(1, 5)] for i in range(1, 4)], "color": color(color_tool, [occurrence, definition]), "children": []}
        nodes.append(node)
        children = Sequence_TDF_Label()
        XCAFDoc_ShapeTool.GetComponents_s(definition, children, False)
        if children.Length():
            for i in range(1, children.Length() + 1):
                child_id = walk(children.Value(i), location, node_id, node["path"])
                node["children"].append(child_id)
            boxes = [nodes[i]["bounds_mm"] for i in node["children"] if nodes[i].get("bounds_mm")]
            if boxes:
                node["bounds_mm"] = [min(b[k] for b in boxes) for k in range(3)] + [max(b[k] for b in boxes) for k in range(3, 6)]
        else:
            shape = XCAFDoc_ShapeTool.GetShape_s(definition).Moved(location)
            box = Bnd_Box()
            # Conservative CAD bounds are sufficient for locating assemblies.
            # Exact mesh envelopes are recomputed on the exported assets.
            BRepBndLib.Add_s(shape, box, False)
            if not box.IsVoid():
                minimum, maximum = box.CornerMin(), box.CornerMax()
                node["bounds_mm"] = [minimum.X(), minimum.Y(), minimum.Z(), maximum.X(), maximum.Y(), maximum.Z()]
        if node.get("bounds_mm"):
            b = node["bounds_mm"]
            node["dimensions_mm"] = [round(b[i + 3] - b[i], 4) for i in range(3)]
            node["center_mm"] = [round((b[i + 3] + b[i]) / 2, 4) for i in range(3)]
        return node_id

    for i in range(1, roots.Length() + 1):
        walk(roots.Value(i), TopLoc_Location())
    digest_after = hashlib.sha256(args.source.read_bytes()).hexdigest()
    if digest_before != digest_after:
        raise RuntimeError("Source STEP hash changed")
    result = {"source": args.source.relative_to(ROOT).as_posix(), "sha256": digest_after, "coordinate_units": "mm", "bounds_method": "conservative BRepBndLib.Add; locator only, exported mesh envelopes checked separately", "nodes": nodes, "elapsed_seconds": round(time.time() - started, 2)}
    (AUDIT / "official-cad-index.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"node_count": len(nodes), "leaves": sum(not n["children"] for n in nodes), "elapsed_seconds": result["elapsed_seconds"]}, ensure_ascii=False), flush=True)
    for node in nodes:
        if len(node["path"]) <= 3:
            print(json.dumps({k: node.get(k) for k in ("id", "parent_id", "name", "dimensions_mm", "center_mm", "children")}, ensure_ascii=False), flush=True)
    if args.wait_for_selection:
        print(f"Ready for selection: {args.wait_for_selection}", flush=True)
        deadline = time.monotonic() + 2400
        while not args.wait_for_selection.is_file():
            if time.monotonic() > deadline:
                raise TimeoutError("No asset selection received within 40 minutes")
            time.sleep(1)
        selection = json.loads(args.wait_for_selection.read_text(encoding="utf-8"))
        export_selected(doc, nodes, selection)


if __name__ == "__main__":
    main()
