"""Extract only the eight real armour light strips from the derived CAD export."""
import ast
import hashlib
import json
import struct
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
tree = ast.parse((ROOT / 'scripts/build-arm-parts.py').read_text(encoding='utf8'))
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == 'Cad'], type_ignores=[]), '<Cad>', 'exec'))
source = ROOT / 'materials/models/derived/inputs/codex/engineer_tagged.glb'
cad = Cad('engineer', source)
frame = np.linalg.inv(cad.matrix(477))
lights = []
with source.open('rb') as stream:
    for index in [4, 9, 18, 263]:
        node = cad.data['nodes'][index]
        primitive = cad.data['meshes'][node['mesh']]['primitives'][2]
        assert primitive['material'] == 2
        positions = cad.accessor(primitive['attributes']['POSITION'], stream).astype(float)
        matrix = frame @ cad.matrix(index)
        positions = positions @ matrix[:3, :3].T + matrix[:3, 3]
        indices = cad.accessor(primitive['indices'], stream).reshape(-1).tolist()
        lights.append({'source_node': index, 'source_primitive': 2, 'host': 'chassis', 'positions': positions.round(8).tolist(), 'indices': indices})
    node = cad.data['nodes'][1422]
    primitive = cad.data['meshes'][node['mesh']]['primitives'][0]
    positions = cad.accessor(primitive['attributes']['POSITION'], stream).astype(float)
    faces = cad.accessor(primitive['indices'], stream).reshape(-1, 3)
    unique, inverse = np.unique(np.round(positions, 7), axis=0, return_inverse=True)
    parent = np.arange(len(unique))
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    for face in faces:
        a, b, c = [find(inverse[i]) for i in face]
        parent[b] = parent[c] = a
    groups = {}
    for face in faces:
        groups.setdefault(find(inverse[face[0]]), []).append(face)
    tubes = []
    for component in groups.values():
        component = np.array(component)
        ids = np.unique(component)
        bounds = np.ptp(positions[ids], axis=0)
        if bounds[0] > .270 and .024 < bounds[1] < .027:
            tubes.append((component, ids))
    assert len(tubes) == 1, 'The upper light diffuser must be unambiguous'
    component, ids = tubes[0]
    remap = {int(old): new for new, old in enumerate(ids)}
    tube = positions[ids]
    matrix = frame @ cad.matrix(1422)
    tube = tube @ matrix[:3, :3].T + matrix[:3, 3]
    lights.append({'source_node': 1422, 'source_primitive': 0, 'host': 'gimbal_context', 'selection': '272 mm connected diffuser tube, identified by geometry', 'positions': tube.round(8).tolist(), 'indices': [remap[int(i)] for i in component.flat]})
output = ROOT / 'materials/models/derived/inputs/engineer-mission'
output.mkdir(parents=True, exist_ok=True)
(output / 'blue-lights.json').write_text(json.dumps({'source': str(source.relative_to(ROOT)), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'frame': 'arm-context source metres', 'lights': lights}), encoding='utf8')
print('Extracted actual LED surfaces:', len(lights))
