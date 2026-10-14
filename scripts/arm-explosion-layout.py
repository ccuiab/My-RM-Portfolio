"""Assembly-axis storyboard in the unchanged source CAD frame.
Distances are display offsets, never hardware travel or an assembly procedure.
The source-node rules below are tied to the hashed inputs in arm-parts.json.
"""
import math
import re

X, Y = [1., 0., 0.], [0., 1., 0.]
NAMES = {0: 'J0', 1: 'J1 / J2', 2: 'L2 / J3', 3: 'J4 / J5 / J6', 4: 'UWB / linkage'}
OFFSETS = {0: [0., -.045, 0.], 1: [0., 0., .035], 2: [.075, .025, 0.], 3: [-.025, .045, .025], 4: [-.08, 0., 0.]}

def center(p):
    return [(a+b)/2 for a,b in zip(p['bounds']['min'],p['bounds']['max'])]

def ids(p, asset='arm'):
    return {m['index'] for m in p['members'] if m['asset']==asset}

def scaled(axis,d):
    return [v*d for v in axis]

def fastener(p):
    return not p['motor'] and bool(re.search(r'螺|screw|nut|washer|DIN|ISO|^STD_|垫片|卡簧',p['node_name'],re.I))

def groups(parts):
    result=[]
    for i in NAMES:
        ps=[p for p in parts if p['group']==i]
        low=[min(p['bounds']['min'][k] for p in ps) for k in range(3)]
        high=[max(p['bounds']['max'][k] for p in ps) for k in range(3)]
        result.append(dict(id=i,node_name=NAMES[i],bounds=dict(min=low,max=high),center_m=[(a+b)/2 for a,b in zip(low,high)],offset_m=OFFSETS[i],source_node_count=len({(m['asset'],m['index']) for p in ps for m in p['members']}),bundle_count=len(ps)))
    return result

def plan(parts,joints):
    axes={j['name']:j['web_axis'] for j in joints['joints']}
    wrist=axes['J5']; roll=axes['J6']; j4=axes['J4']
    for p in parts:
        a,e=ids(p),ids(p,'engineer'); n=p['node_name']; c=center(p)
        group=0 if p['link']=='link_base' else 4 if p['link']=='link_uwb' or (p['link']=='link_1_left' and a) else 1 if p['link'] in ('link_1','link_1_left') else 2 if p['link']=='link_2' else 3
        if a and min(a)<160 and p['link']=='link_3': group=2
        if a and max(a)<160 and p['link']=='link_2' and c[2]>.075: group=1
        axis,d,stage,role=X,0.,2,'structure'
        # Housing clears first; motors stay at their source locations within each total assembly.
        if group==0:
            axis=Y
            if 475 in e: d,stage,role=.135,1,'cover'
            elif 111 in e: d,role=.068,'outer-slip-ring'
            elif 120 in e: d,role=-.095,'inner-slip-ring'
            elif 119 in e: d=-.065
            elif 116 in e: d=.025
            elif 110 in e: d,role=-.035,'bearing'
            elif '04C' in n: d,role=-.015,'transmission'
        elif group in (1,2):
            if e:
                axis=Y
                if '04C' in n: d,role=-.03,'transmission'
                elif 'RA6008' in n or '6706' in n: d,role=-.055,'bearing'
                elif 'MGN7' in n or '限位' in n: d=-.018
            elif p.get('material')=='carbon' or any(s in n for s in ['底座','固定侧板','铝通30']):
                d,stage,role=(.060 if c[0]>(.0363 if group==2 else -.020) else -.055),1,'cover'
            elif '输出轴' in n: d,role=(.032 if c[0]>(.0445 if group==2 else -.020) else -.032),'shaft'
            elif 'bearing' in n.lower(): d,role=(.052 if c[0]>(.0445 if group==2 else -.020) else -.048),'bearing'
        elif group==4:
            # Keep the final 22T chain loop and long UWB boom legible as one route.
            if '04C' in n: d,role=-.02,'transmission'
            elif 'bearing' in n.lower(): d,role=-.044,'bearing'
            elif p['link']=='link_uwb': d=0.
            elif 370 in a: d,stage,role=-.045,1,'cover'
            elif 'limitation' in n: d,stage,role=-.065,1,'cover'
        else:
            # J4 lives partly in L3 in the CAD naming. Its output and both wrist axes
            # receive the SAME overview translation, including the universal shaft.
            wrist_part=any(i>=499 for i in a)
            if wrist_part:
                axis=wrist
                if '6mm_L6_侧板' in n:
                    # Six connected source bodies: left/right frame, paired guards,
                    # and top/bottom cross braces. Opposed bodies open both ways.
                    dims=[b-a for a,b in zip(p['bounds']['min'],p['bounds']['max'])]
                    if dims[0]>.07 and dims[1]<.015:
                        axis=[0.,.998448,-.055686];d=.075 if c[1]>.09 else -.075
                    else: d=.100 if c[0]>-.060 else -.100
                    stage,role=1,'cover'
                elif any(s in n for s in ['Base','baseCNC','角件']): d,stage,role=-.09,1,'cover'
                elif 'Synchronousbelt' in n or '5M21T' in n or '同步轮连接' in n: d,role=-.045,'belt'
                elif '聚氨酯轮' in n: d,role=(.090 if c[0]>-.04 else -.105),'wheel'
                elif p['link']=='link_6':
                    axis=roll; d,role=(.105 if '吸盘' in n else .064 if 'bevel' in n else .035),'roll'
                elif 'bevel' in n: d,role=.020,'bevel'
                elif 'gear' in n.lower(): d,role=(.045 if c[0]>-.04 else -.042),'gear'
                elif 'bearing' in n.lower(): d,role=(.066 if c[0]>-.04 else -.067),'bearing'
                elif '传动轴' in n or '轴承' in n: d,role=(.024 if c[0]>-.04 else -.024),'shaft'
                elif 'KSL' in n or 'POC' in n: d,role=-.022,'air'
            else:
                axis=j4
                if '侧板' in n: axis=X; d,stage,role=(.09 if c[0]>-.04 else -.09),1,'cover'
                elif '上板' in n or '下板' in n:
                    axis=[0.,.8498,.5271]; d,stage,role=(.07 if '上板' in n else -.065),1,'cover'
                elif '保护罩' in n: axis=j4; d,stage,role=-.06,1,'cover'
                elif '万向' in n or '8mm传动轴2' in n:
                    # Preserve the angled universal-joint spine; do not pretend it is coaxial.
                    role='universal'
                elif 'spur_gear' in n: d,role=.035,'gear'
                elif 'J5连接轴cnc1' in n: d,role=.057,'shaft'
                elif 'J5连接轴cnc2' in n: d,role=.080,'shaft'
                elif 'ES712' in n: d,role=-.027,'slip-ring'
                elif 'bearing' in n.lower(): d,role=.016,'bearing'
                elif '齿轮传动轴' in n: d,role=.014,'shaft'
        if p['motor']: d,role=0.,'motor'
        p.update(group=group,group_offset_m=OFFSETS[group][:],local_offset_m=[0.,0.,0.],detail_offset_m=scaled(axis,d),assembly_axis=axis[:],stage=stage,role=role,assembly_bundle=p['key'],mount_evidence='Named source assembly and verified joint axis; display spacing only.')
        p['explode_offset_m']=OFFSETS[group][:]
    # Fasteners follow a mounting body only when the source screw axis intersects
    # its expanded mounting envelope. Bearings are deliberately NOT fasteners.
    for p in parts:
        if not fastener(p): continue
        c=center(p); frame=p.get('source_frame'); candidates=[]
        for h in parts:
            if h is p or h['group']!=p['group'] or fastener(h) or h['motor'] or h['role'] in ('transmission','belt','wheel'): continue
            # Require the same source asset and local source assembly/link.
            if p['members'][0]['asset']!=h['members'][0]['asset'] or p['link']!=h['link']: continue
            gap=[max(h['bounds']['min'][k]-c[k],0.,c[k]-h['bounds']['max'][k]) for k in range(3)]
            if math.sqrt(sum(v*v for v in gap))>.018: continue
            direction=p.get('fastener_axis',[1.,0.,0.])
            enter,leave=-.030,.030
            for k in range(3):
                low,high=h['bounds']['min'][k]-.002,h['bounds']['max'][k]+.002
                if abs(direction[k])<1e-7:
                    if c[k]<low or c[k]>high:enter,leave=1.,0.;break
                else:
                    a,b=sorted(((low-c[k])/direction[k],(high-c[k])/direction[k]))
                    enter=max(enter,a);leave=min(leave,b)
            if enter>leave:continue
            # Small hardware must be near a body's physical surface, not merely its centre.
            score=sum(v*v for v in gap)+.002*sum((c[k]-center(h)[k])**2 for k in range(3))
            candidates.append((score,h))
        if candidates:
            h=min(candidates,key=lambda item:item[0])[1]
            for k in ('detail_offset_m','assembly_axis','stage','role'): p[k]=h[k]
            p['assembly_bundle']=h['key']; p['mount_evidence']='Same CAD link/asset, envelope gap <=18 mm, source cylinder-axis segment intersects mounting envelope (+2 mm tolerance); follows body.'
        else:
            p['detail_offset_m']=[0.,0.,0.];p['mount_evidence']='Unresolved mounting body: retained at assembled position, no inferred flight.'


    attach_output_screws(parts)
    assign_motion(parts)

def attach_output_screws(parts):
    """Explicit J2/J3 output-flange bolt circles in the source CAD.

    These screw axes are parallel to X at the flange's 42 mm bolt circle.
    Their heads extend just outside the body envelope, so the conservative
    automatic envelope test must not invent a different mounting owner.
    Keep separate draw objects (no retessellation), but use the flange transform.
    """
    mounts={99:[58,59,64,68,74,76,81],134:[105,110,111,112,115,116,157]}
    for owner_index,bolts in mounts.items():
        host=next(p for p in parts if owner_index in ids(p))
        for p in parts:
            if not ids(p).intersection(bolts):continue
            for key in ('detail_offset_m','assembly_axis','stage','role'):
                p[key]=host[key][:] if isinstance(host[key],list) else host[key]
            p['mount_owner']=host['key']
            p['mount_evidence']=f'Explicit source output flange arm:{owner_index}; X-parallel screw axes on the 42 mm bolt circle. Rigidly follows that flange.'


def assign_motion(parts):
    """Articulation follows exported CAD mates, not the display/explosion groups."""
    for p in parts:
        a,e=ids(p),ids(p,'engineer')
        motion=p['link']
        if e:
            motion='j0_carrier'
            if e.intersection({110,111,117,119,120}): motion='j0_fixed'
            elif e.intersection({1421,1424}): motion='j0_drive'
            elif e.intersection({1323,469}): motion='j1_drive'
            elif e.intersection({471,1326}): motion='link_1'
        elif p['link']=='link_uwb' or a.intersection({369,370}): motion='uwb'
        elif 368 in a: motion='link_1'
        elif p['link']=='link_1_left': motion='link_2'
        p['motion_group']=motion
    lookup={p['key']:p for p in parts}
    for p in parts:
        owner=p.get('mount_owner',p.get('assembly_bundle'))
        if owner in lookup and owner!=p['key']: p['motion_group']=lookup[owner]['motion_group']

def motion_contract(joints):
    return {
        'frame':'Baked source CAD coordinates. D_child = D_parent T(p) R(axis,q) T(-p).',
        'joints':[{'name':j['name'],'parent_link':j['parent_link'],'child_link':j['child_link'],'point_m':[v/1000 for v in j['axis_point_mm']],'axis':j['web_axis']} for j in joints['joints']],
        'j0_point_m':[-.0401346595,-.1074335389,-.0882369977],
        'j0_input_point_m':[-.0397539949,-.0779,-.2282364814],
        'j1_input_point_m':[-.13035185365404522,-.0898305410519242,-.008482003622834675],
        'uwb_point_m':[-.114732846080021,.147080404785463,-.167680158411443],
        'wheel_coupling':'q7 = q5 - q6; dependent branch, not an eighth independent axis.',
        'j0_evidence':'engineer_mates [0-2,30-31,299-305,1109-1110]; gimbal_mates [39-45]. Inner ring/slip-ring shells/central sprocket fixed. Outer ring/chassis/motor carrier rotates. Input sprocket and adapter counter-rotate in carrier frame.',
        'uwb_evidence':'sw-probe/arm_mates mates[12,14-16,19-21,271,275-276]. Upper 22T wheel and bracket counter-rotate by q2 about their own offset axis, not the J3 axis.',
        'limits':'Illustrative finite joint windows, not calibrated hardware limits. Chain circulation, bearing rollers, slip-ring internal rotors and detailed internal motor/gear dynamics are not simulated.'
    }

def details(parts,joints):
    def keys(asset,indices): return [p['key'] for p in parts if ids(p,asset)&set(indices)]
    def route(asset,indices):
        result=[]
        for i in indices:
            matches=keys(asset,[i])
            if matches and matches[0] not in result:result.append(matches[0])
        return result
    subsets=[lambda p:p['group']==0,
             lambda p:p['group']==1 and bool(ids(p,'engineer')),
             lambda p:p['group']==2 and any(40<=i<=104 for i in ids(p)),
             lambda p:p['group']==3 and not any(i>=499 for i in ids(p)),
             lambda p:p['group']==3 and any(i>=499 for i in ids(p)),
             lambda p:p['group']==3 and any(i>=499 for i in ids(p)),
             lambda p:p['group']==4]
    paths=[route('engineer',[472,1421,1410,117]),route('engineer',[476,1323,1324,471]),route('arm',[103,99,102]),
           route('arm',[186,306,300,299,268,272,348,271]),route('arm',[596,683,691,680,778]),
           route('arm',[512,507,505,762,696,684,682,678,679,592,757,500,593,508]),route('arm',[368,362,369,370])]
    feature_sources=[[('engineer',120),('engineer',111),('engineer',110)], [('engineer',476),('engineer',471)], [('arm',103),('arm',99)], [('arm',300),('arm',183),('arm',271)], [('arm',596),('arm',691),('arm',678)], [('arm',512),('arm',678),('arm',592)], [('arm',368),('arm',370),('arm',311)]]
    # A selected assembly-facing view and a small, one-way observation arc.
    primary=[[.8,-.55,-1.6],[-.65,.35,1.65],[-2,.4,.45],[1.25,.8,1.5],[-1.15,1.5,1.35],[1.2,.6,1.8],[-1.6,.45,1.4]]
    camera_paths=[[v,[v[0]+.10,v[1]+.06,v[2]-.08]] for v in primary]
    views=[]
    for i,select in enumerate(subsets):
        ps=[p for p in parts if select(p)]
        edges=([[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[2,11],[11,12],[12,13]] if i==5 else [[n,n+1] for n in range(len(paths[i])-1)])
        views.append(dict(feature_keys=[keys(asset,[index])[0] for asset,index in feature_sources[i]],route_edges=edges,id=i,group=[0,1,2,3,3,3,4][i],part_keys=[p['key'] for p in ps],route_keys=paths[i],camera=camera_paths[i][0],camera_path=camera_paths[i]))
    # Three motor routes share one wrist opening and a stable oblique top view.
    wrist=views[4]; wrist['route_variants']=[{'keys':paths[3],'edges':views[3]['route_edges']},{'keys':paths[4],'edges':views[4]['route_edges']},{'keys':paths[5],'edges':views[5]['route_edges']}]
    views.append(dict(id=7,group=3,part_keys=[p['key'] for p in parts if p['group']==3],route_keys=[],route_edges=[],feature_keys=[keys('arm',[i])[0] for i in [271,778,592]],camera=[1.2,.8,1.7],camera_path=[[1.2,.8,1.7]]))
    shoulder=[p for p in parts if p['group']==1 and ids(p)]
    shoulder_path=route('arm',[132,134,129,3])
    views.append(dict(id=8,group=1,part_keys=[p['key'] for p in shoulder],route_keys=shoulder_path,route_edges=[[i,i+1] for i in range(len(shoulder_path)-1)],feature_keys=[keys('arm',[i])[0] for i in [132,134]],camera=[2,.2,.3],camera_path=[[2,.4,.4],[2.08,.46,.3]]))
    views[6]['part_keys']=[p['key'] for p in parts if (p['group']==4 and not any(i>=830 for i in ids(p))) or 311 in ids(p)]
    return views
