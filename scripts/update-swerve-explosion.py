"""Update derived GLB extras without recompressing or touching mesh bytes.

Run from the repository root: python scripts/update-swerve-explosion.py
Regenerates the swerve audit from the actual GLB, keeping the pump record.
"""
import hashlib
import json
import pathlib
import struct
from swerve_explosion import explosion_metadata, sensor_metadata

root = pathlib.Path.cwd()
path = root / 'materials/models/derived/web/engineer-swerve.glb'
original = path.read_bytes()
length, kind = struct.unpack_from('<II', original, 12)
assert kind == 0x4E4F534A
document = json.loads(original[20:20 + length])
nodes = document['nodes']
wheel = next(n for n in nodes if n.get('extras', {}).get('source_node_index') == 31)
axis = wheel['extras']['web_axis']
for node in nodes:
    data = node.get('extras', {})
    if 'source_node_index' in data:
        data.update(explosion_metadata(data['source_node_index'], data.get('web_instance') == 'steering-pinion', axis))
        data.update(sensor_metadata(data['source_node_index']))
payload = json.dumps(document, ensure_ascii=True, separators=(',', ':')).encode()
payload += b' ' * (-len(payload) % 4)
tail = original[20 + length:]
result = struct.pack('<III', 0x46546C67, 2, 20 + len(payload) + len(tail)) + struct.pack('<II', len(payload), kind) + payload + tail
assert result[20 + len(payload):] == tail
path.write_bytes(result)

audit_path = path.with_name('engineer-modules.json')
audit = json.loads(audit_path.read_text(encoding='utf-8'))
module = audit['modules']['swerve']
previous = {part['node']: part for part in module['parts']}
parts = []
for node in nodes:
    data = node.get('extras', {})
    if 'source_node_index' not in data:
        continue
    part = {key: value for key, value in previous.get(node['name'], {}).items() if key not in ('pivot', 'source')}
    part.update(node=node['name'], source=data['source_node_name'], source_index=data['source_node_index'],
                local_translation=node.get('translation', [0, 0, 0]), motion=data.get('web_motion'),
                axis_local=data.get('web_axis', []), explode=data['web_explode'],
                explode_group=data['web_explode_group'], motor_intact=data.get('web_motor_intact', False))
    if data.get('web_sensor'):
        part['sensor'] = data['web_sensor']
    if 'mesh' in node:
        part['triangles'] = sum(document['accessors'][primitive['indices']]['count'] // 3 for primitive in document['meshes'][node['mesh']]['primitives'])
    if data.get('web_reconstruction'):
        part['reconstruction'] = data['web_reconstruction']
    parts.append(part)
module.update(parts=parts, output_sha256=hashlib.sha256(result).hexdigest(),
              explosion_policy='scripts/swerve_explosion.py',
              metadata_source='Actual GLB extras; translations are relative to the GLB parent, not world pivots.',
              geometry_buffer_sha256=hashlib.sha256(tail).hexdigest())
if any(part.get('sensor') == 'optical-pcb' for part in parts):
    module['optical_detection'] = {
        'source': 'materials/models/derived/inputs/codex/engineer_tagged.glb',
        'pcb_assembly_root': 64, 'pcb_anchor': 98, 'slip_ring': 59, 'cnc_target': 56,
        'identification': 'User identified the PCB and CNC aluminium optical-detection target on 2026-10-13. No individual sensor package, homing function or trigger angle inferred.'
    }
audit_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'parts': len(parts), 'mesh_bytes_unchanged': True, 'sha256': module['output_sha256']}))
