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
check('j2_excludes_l2_skeleton',owner('arm',18)['key'] not in m['details'][8]['part_keys'],'L2 cross plate is not a shoulder bearing or flange.')
check('l2_all_eight_plates',all(owner('arm',i)['key'] in m['details'][9]['part_keys'] for i in range(11,19)),'Two vertical and six crosswise plates retained.')
check('j5_pulley_offsets_coplanar',owner('arm',680)['detail_offset_m']==owner('arm',683)['detail_offset_m']==owner('arm',691)['detail_offset_m'],'Threaded pulley is not a fastener; complete belt plane translates together.')
check('wheel_hub_screws_rotate',all(owner('arm',i)['motion_group']=='link_wheel' for i in [733,737,743,758]),'Wheel bolt circle follows the wheel rather than the stationary bearing.')
check('wrist_surface_materials',owner('arm',763)['surface_materials']==['aluminium'] and set(owner('arm',778)['surface_materials'])=={'aluminium','carbon'},'Metal cup guard; mixed metal/carbon carrier retains the source face materials.')
check('wrist_partition_materials',all(p['surface_materials']==['carbon'] for p in m['parts'] if any(n['asset']=='arm' and n['index']==502 for n in p['members'])),'All six partitioned side-frame bodies retain source carbon material.')
check('wrist_wheel_material_regions',all({'aluminium','rubber_dark','rubber_grey'}<=set(owner('arm',i)['surface_materials']) for i in [508,682]),'Rubber tread and metal hub remain separate surfaces within each rotating wheel.')
check('wrist_cup_and_bevel_materials',owner('arm',757)['surface_materials']==['rubber_grey'] and all(owner('arm',i)['surface_materials']==['polymer_white'] for i in [678,679]),'Dark rubber cup and nonmetallic white bevel gears match source material families.')
check('uwb_mount_retained',owner('arm',370)['stage']==2 and owner('arm',370)['detail_offset_m']==[0,0,0],'The arch-shaped UWB support/linked-stop plate stays assembled for the roller contact study.')
check('arch_linked_limit_plate',owner('arm',370)['motion_group']=='uwb','Report figure 19: the carbon arch limits the roller from three sides.')
check('no_chain_or_direct_drive_paths',all(not m['details'][i]['route_edges'] for i in [0,1,2,6,8]),'Only geared and belt paths are drawn.')
route=m['details'][5];edges={(route['route_keys'][a],route['route_keys'][b]) for a,b in route['route_edges']}
check('roll_branch_uses_adjacent_wheel_gear',(owner('arm',593)['key'],owner('arm',678)['key']) in edges and (owner('arm',684)['key'],owner('arm',678)['key']) not in edges,'The bevel drive is on the +X wheel branch; no path crosses from the opposite wheel output.')


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
check('output_flange_fasteners',all(owner('arm',i)['stage']==0 and norm(owner('arm',i)['detail_offset_m'])>0 for i in [58,59,64,68,74,76,81,105,110,111,112,115,116,157]),'Both output-flange screw arrays withdraw separately before their flanges open.')
for source in m['sources']:
    with (root/source['path']).open('rb') as f:digest=hashlib.file_digest(f,'sha256').hexdigest()
    check('source_hash_'+Path(source['path']).name,digest==source['sha256'],digest)
raw=(root/'materials/models/derived/web/arm-parts.glb').read_bytes();length=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+length]);exported={n.get('extras',{}).get('part_key') for n in g['nodes']}
check('glb_metadata_match',keys<=exported,{'metadata_parts':len(keys),'glb_parts':len(exported-{None}),'bytes':len(raw)})
for source_index in [502,508,682,757,778,678,679]:
    for p in [p for p in m['parts'] if any(n['asset']=='arm' and n['index']==source_index for n in p['members'])]:
        node=next(n for n in g['nodes'] if n.get('extras',{}).get('part_key')==p['key'])
        names={g['materials'][v['material']]['name'] for v in g['meshes'][node['mesh']]['primitives']}
        check('exported_materials_'+p['key'],names==set(p['surface_materials']),sorted(names))
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
report=root/'materials/documents/derived/audits/arm-study-20261016';report.mkdir(parents=True,exist_ok=True)
(report/'geometry-checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2)+'\n','utf8')
print(json.dumps({'passed':len(checks),'sources':len(counts),'parts':len(keys),'motors':len(motors)},ensure_ascii=False))
