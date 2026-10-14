"""Validate the B-chapter geometry/provenance contract, not its visual readability.
Run `python scripts/check-arm-study.py`; visual QA is recorded separately.
"""
import json,math,hashlib,struct
from pathlib import Path
from collections import Counter
root=Path(__file__).resolve().parents[1]
m=json.loads((root/'materials/models/derived/web/arm-parts.json').read_text('utf8'))
assert m['schema_version']==6
checks={}
def check(name,condition,detail):
    checks[name]={'passed':bool(condition),'detail':detail}
    if not condition:raise AssertionError(f'{name}: {detail}')
expected={(n['source_asset'],n['source_node_index']) for n in m['source_nodes']}
counts=Counter((n['asset'],n['index']) for p in m['parts'] for n in p['members'])
check('source_coverage',set(counts)==expected,{'expected':len(expected),'retained':len(counts)})
check('no_unexplained_duplicate_sources',{k:v for k,v in counts.items() if v>1}=={('arm',502):6},'Only arm:502 is partitioned into its six disconnected physical bodies.')
partitions=m['coverage']['geometry_partitions'];faces=[f for p in partitions for f in p['face_indices']]
check('partition_face_conservation',len(faces)==len(set(faces))==partitions[0]['source_face_count'],'Every cleaned source face belongs to exactly one child; no cut geometry.')
motors=[p for p in m['parts'] if p['motor']]
check('intact_motor_instances',len(motors)==7 and all(p['detail_offset_m']==[0,0,0] for p in motors),{'count':len(motors),'keys':[p['key'] for p in motors]})
owner=lambda asset,index:next(p for p in m['parts'] if any(n['asset']==asset and n['index']==index for n in p['members']))
check('separate_wrist_motors',owner('arm',512)['key']!=owner('arm',596)['key'],'The two identically named MG4010 instances remain separate.')
wrist=[p for p in m['parts'] if p['group']==3]
check('intact_wrist_overview',len({tuple(p['group_offset_m']) for p in wrist})==1 and all(p['local_offset_m']==[0,0,0] for p in wrist),'Every J4-J6 body receives one identical overview translation.')
sideframes=[p for p in m['parts'] if any(n['asset']=='arm' and n['index']==502 for n in p['members'])]
check('opposed_wrist_covers',min(p['detail_offset_m'][0] for p in sideframes)<-.09 and max(p['detail_offset_m'][0] for p in sideframes)>.09,'Left/right frames open in opposite directions; cross braces open up/down.')
check('opposed_wrist_shaft_stacks',min(p['detail_offset_m'][0] for p in wrist if p['stage']==2)<-.08 and max(p['detail_offset_m'][0] for p in wrist if p['stage']==2)>.08,'The transverse drivetrain opens on both sides of its central carrier.')
norm=lambda v:math.sqrt(sum(x*x for x in v))
check('compact_budgets',max(norm(p['group_offset_m']) for p in m['parts'])<=.10 and max(norm(p['detail_offset_m']) for p in m['parts'])<=.14,{'max_group_m':max(norm(p['group_offset_m']) for p in m['parts']),'max_local_m':max(norm(p['detail_offset_m']) for p in m['parts'])})
check('axis_parallel_offsets',all(norm([p['detail_offset_m'][(k+1)%3]*p['assembly_axis'][(k+2)%3]-p['detail_offset_m'][(k+2)%3]*p['assembly_axis'][(k+1)%3] for k in range(3)])<1e-7 for p in m['parts']),'All display translations follow their declared source assembly axes.')
for group in [0,1]:
    chains=[p for p in m['parts'] if p['group']==group and p['node_name']=='04C链节']
    check(f'chain_loop_{group}',len(chains)==1 and len(chains[0]['members'])==82,{'source_links':len(chains[0]['members'])})
    nodes=[n for n in m['source_nodes'] if (n['source_asset'],n['source_node_index']) in {(s['asset'],s['index']) for s in chains[0]['members']}]
    centers=[[(a+b)/2 for a,b in zip(n['bounds']['min'],n['bounds']['max'])] for n in nodes]
    neighbors=[[j for j,c in enumerate(centers) if j!=i and norm([a-b for a,b in zip(c,p)])<.010] for i,p in enumerate(centers)]
    seen={0};todo=[0]
    while todo:
        for n in neighbors[todo.pop()]:
            if n not in seen:seen.add(n);todo.append(n)
    nearest=[sorted(norm([a-b for a,b in zip(c,p)]) for j,c in enumerate(centers) if i!=j) for i,p in enumerate(centers)]
    check(f'source_chain_continuity_{group}',len(seen)==82,{'connected':len(seen),'neighbor_degrees_within_10mm':dict(Counter(len(n) for n in neighbors)),'nearest_range_mm':[min(d[0] for d in nearest)*1000,max(d[0] for d in nearest)*1000],'second_neighbor_max_mm':max(d[1] for d in nearest)*1000,'note':'Source CAD loop closure is not a calibrated chain-pitch model; retained without relocating source links.'})
check('uwb_restoration',sum(830<=i<=845 for asset,i in counts if asset=='arm')==16,'All 16 source UWB subtree meshes are retained.')
keys={p['key'] for p in m['parts']}
for view in m['details']:
    check(f'detail_{view["id"]}_references',set(view['route_keys']+view['feature_keys'])<=set(view['part_keys'])<=keys and all(max(e)<len(view['route_keys']) for e in view['route_edges']),{'parts':len(view['part_keys']),'route_nodes':len(view['route_keys'])})
check('output_flange_fasteners',all(p['detail_offset_m']==next(h['detail_offset_m'] for h in m['parts'] if h['key']==p['mount_owner']) for p in m['parts'] if p.get('mount_owner')),'Fourteen explicitly mapped output-flange screws follow the mounting flange on both shoulder and elbow.')
for source in m['sources']:
    with (root/source['path']).open('rb') as f:digest=hashlib.file_digest(f,'sha256').hexdigest()
    check('source_hash_'+Path(source['path']).name,digest==source['sha256'],digest)
raw=(root/'materials/models/derived/web/arm-parts.glb').read_bytes();length=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+length]);exported={n.get('extras',{}).get('part_key') for n in g['nodes']}
check('glb_metadata_match',keys<=exported,{'metadata_parts':len(keys),'glb_parts':len(exported-{None}),'bytes':len(raw)})
by_key={p['key']:p for p in m['parts']};max_bound_error=0.
for node in g['nodes']:
    key=node.get('extras',{}).get('part_key')
    if not key:continue
    assert not any(k in node for k in ('matrix','translation','rotation','scale')), 'Model nodes must retain baked source coordinates.'
    accessors=[g['accessors'][p['attributes']['POSITION']] for p in g['meshes'][node['mesh']]['primitives']]
    for edge,fn in [('min',min),('max',max)]:
        for i in range(3):max_bound_error=max(max_bound_error,abs(fn(a[edge][i] for a in accessors)-by_key[key]['bounds'][edge][i]))
check('assembled_export_coordinates',max_bound_error<.0005,{'max_metadata_to_glb_bounds_delta_mm':max_bound_error*1000,'nodes':'Baked CAD coordinates; no per-node rest transformation.'})

check('uwb_bracket_restored',('arm',370) in expected and owner('arm',370)['motion_group']=='uwb','Source bracket 370 follows the UWB compensating branch.')
report=root/'materials/documents/derived/audits/arm-study-20261014';report.mkdir(parents=True,exist_ok=True)
(report/'geometry-checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2)+'\n','utf8')
print(json.dumps({'passed':len(checks),'sources':len(counts),'parts':len(keys),'motors':len(motors)},ensure_ascii=False))
