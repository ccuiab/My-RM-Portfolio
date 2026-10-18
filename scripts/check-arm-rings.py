"""Check full source arrays, not just fasteners that already have an owner."""
import json
import importlib.util
from pathlib import Path
m=json.loads(Path('materials/models/derived/web/arm-parts.json').read_text('utf8'))
def part(asset,index):return next(p for p in m['parts'] if any(s['asset']==asset and s['index']==index for s in p['members']))
expected={
 'J0_turntable':('engineer',[114,124,126,131,146,147,148,149,150,151,152,153]),
 'J0_outer':('engineer',[115,129,138,139,140,141,142,143,144,145]),
 'J2_round_head_face':('arm',[105,106,108,109,110,111,122,156]),
 'J2_cap_head_face':('arm',[107,112,113,115,116,125,146,155,157]),
 'J3_round_head_face':('arm',[41,42,43,50,58,59,62,64,68]),
 'J3_cap_head_face':('arm',[53,73,74,75,76,77,81,88]),
 'J2_output_flange':('arm',[133,145,148,149,150,151,152,153,154]),
 'J3_output_flange':('arm',[56,84,85,93,94,95,96,97,98]),
 'J4_output':('arm',[314,315,316,317,318,320,324,325]),
 'J4_input':('arm',[279,285,288,290,291,292]),
 'wheel_left':('arm',[733,737,743,758]),
 'wheel_right':('arm',[734,739,745,769]),
}
for name,(asset,indices) in expected.items():
 ps=[part(asset,i) for i in indices]
 assert all('fastener_ring' in p for p in ps),f'{name}: source screws are still merged into unrelated bodies.'
 assert len({p['fastener_ring']['id'] for p in ps})==1,f'{name}: one bolt circle splits into several groups.'
 assert len({tuple(p['detail_offset_m']) for p in ps})==1,f'{name}: different explosion vectors.'
 assert len({p['motion_group'] for p in ps})==1,f'{name}: mixed rigid-body ownership.'
 assert all(p['stage']==0 and not p['motor'] for p in ps)
for ring in m['bolt_circles']:
 ps=[p for p in m['parts'] if p.get('fastener_ring',{}).get('id')==ring['id']]
 assert len({tuple(p['detail_offset_m']) for p in ps})==1
 assert all(p['stage']==0 for p in ps)
assert all(p['detail_offset_m']==[0.,0.,0.] for p in m['parts'] if p['motor'])
assert part('arm',733)['motion_group']=='link_wheel'
assert all(part('arm',i)['motion_group']=='link_1' for i in [105,112])
assert all(part('arm',i)['motion_group']=='link_2' for i in [58,74,133])
assert part('arm',56)['motion_group']=='link_3'
assert part('arm',314)['motion_group']=='link_3'
spec=importlib.util.spec_from_file_location('policy',Path(__file__).with_name('arm-fastener-policy.py'));policy=importlib.util.module_from_spec(spec);spec.loader.exec_module(policy)
for n in m['source_nodes']:
 if policy.is_fastener(n):assert part(n['source_asset'],n['source_node_index'])['stage']==0,(n['source_asset'],n['source_node_index'])
assert part('arm',681)['stage']!=0,'Functional clamp spacer stays with the transmission.'
print(f'Bolt circles: {len(m["bolt_circles"])} source arrays, {len(expected)} regression arrays, CAD ownership and intact motors passed.')
