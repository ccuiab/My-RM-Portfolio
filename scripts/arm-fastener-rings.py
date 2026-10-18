"""Preserve source bolt-circle arrays as independent axial display layers."""
import itertools
import json
import math
import pathlib
import re
from collections import Counter, defaultdict

import numpy as np


def hardware_kind(name):
    if re.search(r'垫|washer|shim', name, re.I): return 'washer'
    if re.search(r'螺母|nut', name, re.I): return 'nut'
    if re.search(r'卡簧|circlip', name, re.I): return 'retainer'
    return 'screw'


def source_head(vertices, axis_index, frame):
    """Use the actual head section, independent of screw length or source origin."""
    low, high = vertices.min(axis=0), vertices.max(axis=0)
    radial = [i for i in range(3) if i != axis_index]
    middle = (low + high) / 2
    radii = np.linalg.norm(vertices[:, radial] - middle[radial], axis=1)
    head = vertices[radii >= radii.max() * .86]
    point = middle.copy(); point[axis_index] = np.median(head[:, axis_index])
    delta = point[axis_index] - middle[axis_index]
    # Mixed round/cap heads have different mid-heights but share a seating face.
    point[axis_index] = head[:,axis_index].min() if delta >= 0 else head[:,axis_index].max()
    direction = frame[:3, axis_index] * (1 if delta >= 0 else -1)
    return (frame @ np.r_[point, 1])[:3].tolist(), (direction / np.linalg.norm(direction)).tolist()


def regular_circle(points):
    """Find a source array, allowing a missing screw without inventing one."""
    if len(points) < 3: return None
    best = None
    for indices in itertools.combinations(range(len(points)), 3):
        a, b, c = points[list(indices)]
        matrix = 2 * np.array([b-a, c-a])
        if abs(np.linalg.det(matrix)) < 1e-9: continue
        center = np.linalg.solve(matrix, np.array([b@b-a@a, c@c-a@a]))
        radius = np.linalg.norm(a-center)
        if not .004 <= radius <= .09: continue
        selected = np.flatnonzero(abs(np.linalg.norm(points-center, axis=1)-radius) < max(.00035, radius*.012))
        if len(selected) < 3: continue
        angles = np.sort(np.arctan2(*(points[selected]-center)[:, ::-1].T))
        gaps = np.diff(np.r_[angles, angles[0]+2*math.pi])
        if gaps.min() < .06: continue
        divisions = None
        for count in range(len(selected), min(24, len(selected)+4)+1):
            pitch = 2*math.pi/count
            steps = np.rint(gaps/pitch)
            if steps.min() >= 1 and steps.sum() == count and np.max(abs(gaps-steps*pitch)) < .035:
                if len(selected) != 3 or count == 3: divisions = count; break
        if divisions is None:
            # Source flanges can interleave two hole patterns. Keep those real
            # positions together rather than forcing them onto an ideal pitch.
            if len(selected)<4 or gaps.max()>2.1:continue
            divisions=0
        score = (len(selected), -divisions, -float(np.std(np.linalg.norm(points[selected]-center,axis=1))))
        if best is None or score > best[0]: best = score, selected, center, radius, divisions
    return best


def normalized_name(name):
    name=name.split('/')[-1]
    name=re.sub(r'\.2025\.10\.1','',name)
    return re.sub(r'-\d+$','',name).lower()


def native_mate_owner(circle,parts,source_nodes):
    """Resolve repeated screw prototypes through their actual CAD mate seeds."""
    source={(n['source_asset'],n['source_node_index']):n for n in source_nodes}
    records=[source.get((m['asset'],m['index'])) for p in circle for m in p['members']]
    records=[r for r in records if r and r['source_asset']=='arm']
    if not records:return None,[]
    path=pathlib.Path(__file__).resolve().parents[1]/'materials/documents/derived/audits/sw-probe/arm_mates.json'
    document=json.loads(path.read_text('utf-8-sig'))
    contexts={normalized_name(n) for r in records for n in r['source_hierarchy'][1:-1]}
    prototypes={normalized_name(r['source_node_name']) for r in records}
    relationships=[]
    for context,mates in [('',document['mates'])]+[(d['component'],d['mates']) for d in document['subassembly_docs']]:
        for mate in mates:
            owner=normalized_name(context or mate['Owner'])
            if mate.get('Suppressed') or owner not in contexts:continue
            entities=mate.get('Entities',[])
            if not any(normalized_name(e.get('Component','')) in prototypes for e in entities):continue
            for entity in entities:
                body=normalized_name(entity.get('Component',''))
                if body in prototypes:continue
                relationships.append((owner,body,mate['Name'],mate['Type']))
    if not relationships:return None,[]
    axis=np.array(circle[0]['assembly_axis']);axis/=np.linalg.norm(axis)
    # Use the real source screw axis instead of an inherited display-body axis.
    axis=np.array(circle[0]['fastener_axis']);axis/=np.linalg.norm(axis)
    outward=np.array(circle[0]['fastener_outward']);sign=1 if outward@axis>=0 else -1
    seating=np.mean([np.array(p['fastener_head_m'])@axis for p in circle])
    choices=[]
    for p in parts:
        evidence=[]
        for member in p['members']:
            record=source.get((member['asset'],member['index']))
            if not record:continue
            names={normalized_name(record['source_node_name'])}
            if p['motor']:names.update(normalized_name(s) for s in record['source_hierarchy'][:-1])
            hierarchy={normalized_name(s) for s in record['source_hierarchy'][1:-1]}
            evidence.extend((name,kind) for owner,body,name,kind in relationships if owner in hierarchy and body in names)
        if not evidence:continue
        corners=np.array(list(itertools.product(*zip(p['bounds']['min'],p['bounds']['max']))))
        projected=corners@axis;face=projected.max() if sign>0 else projected.min()
        gap=abs(seating-face)
        choices.append((gap,-sum(kind==0 for _,kind in evidence),p,evidence))
    if not choices:return None,[]
    gap,_,host,evidence=min(choices,key=lambda c:(c[0],c[1]))
    if gap>.012:return None,[]
    return host,sorted({name for name,_ in evidence})


def declared_rings(parts,source_nodes,declarations):
    lookup={(s['asset'],s['index']):p for p in parts for s in p['members']}
    result=[]
    for declaration in declarations:
        circle=[lookup[(s['asset'],s['index'])] for s in declaration['members']]
        circle=list({p['key']:p for p in circle}.values())
        axis=np.array(declaration['axis']);axis/=np.linalg.norm(axis)
        center=np.array(declaration['center_m'])
        for p in circle:
            delta=np.array(p['fastener_head_m'])-center
            assert abs(delta@axis)<.0008,(declaration['id'],'installation plane changed')
            assert abs(np.linalg.norm(delta-axis*(delta@axis))-declaration['radius_m'])<.0005,(declaration['id'],'source hole position changed')
        host,evidence=native_mate_owner(circle,parts,source_nodes)
        if host is None:
            host=next((lookup[(s['asset'],s['index'])] for s in declaration.get('preferred_owner_members',[]) if (s['asset'],s['index']) in lookup),None)
        sign=1 if np.mean([np.array(p['fastener_outward'])@axis for p in circle])>=0 else -1
        owner_offset=float(np.array(host['detail_offset_m'])@axis) if host else 0.
        offset=axis*float(np.clip(sign*(abs(owner_offset)+.030),-.138,.138))
        bundle_source=declaration['bundle_source'];bundle=lookup[(bundle_source['asset'],bundle_source['index'])]['key']
        ring={k:declaration[k] for k in ('id','kind','axis','center_m','radius_m','pitch_divisions','members')}
        ring.update(owner=host['key'] if host else None,owner_mates=evidence,withdraw_sign=sign,offset_m=offset.tolist(),
                    evidence='Audited source installation-face array; source hole positions preserved. Native CAD mate seed determines mounting ownership where available.')
        for p in circle:
            p.pop('mount_owner',None)
            p.update(assembly_bundle=bundle,fastener_ring=ring,stage=0,role='fastener-ring',detail_offset_m=offset.tolist(),assembly_axis=axis.tolist(),mount_evidence=ring['evidence'])
            if host:p['motion_group']=host['motion_group']
        result.append(ring)
    return result


def plan_rings(parts,source_nodes=()):
    manifest=pathlib.Path(__file__).resolve().parents[1]/'materials/models/derived/inputs/arm-bolt-circles.json'
    if manifest.exists():return declared_rings(parts,source_nodes,json.loads(manifest.read_text('utf8'))['circles'])
    candidates = defaultdict(list)
    by_key = {p['key']:p for p in parts}
    for p in parts:
        if p['motor'] or not re.search(r'螺钉|螺栓|螺母|screw|nut|washer|DIN|ISO|^STD_|垫片|卡簧', p['node_name'], re.I): continue
        axis = np.array(p['fastener_axis'], dtype=float); axis /= np.linalg.norm(axis)
        if axis[np.argmax(abs(axis))] < 0: axis = -axis
        anchor = np.array(p.get('fastener_head_m', [(a+b)/2 for a,b in zip(p['bounds']['min'],p['bounds']['max'])]))
        outward = np.array(p.get('fastener_outward', axis))
        key = (p['members'][0]['asset'],p['group'],hardware_kind(p['node_name']),tuple(np.round(axis,2)),1 if outward@axis >= 0 else -1)
        candidates[key].append((p,axis,anchor,outward))
    rings = []
    for key, entries in candidates.items():
        axis = entries[0][1]
        reference = np.eye(3)[np.argmin(abs(axis))]
        u = np.cross(axis,reference); u /= np.linalg.norm(u); v = np.cross(axis,u)
        planes = []
        for item in sorted(entries,key=lambda x:float(x[2]@axis)):
            z = float(item[2]@axis)
            if not planes or z-np.mean([float(x[2]@axis) for x in planes[-1]]) > .0007: planes.append([])
            planes[-1].append(item)
        for plane in planes:
            remaining = plane[:]
            while len(remaining) >= 3:
                xy = np.array([[x[2]@u,x[2]@v] for x in remaining])
                found = regular_circle(xy)
                if found is None: break
                _, selected, center, radius, divisions = found
                selected = set(selected.tolist()); circle = [x for i,x in enumerate(remaining) if i in selected]
                remaining = [x for i,x in enumerate(remaining) if i not in selected]
                ring_parts = [x[0] for x in circle]
                members = sorted((m for p in ring_parts for m in p['members']),key=lambda m:m['index'])
                ring_id = f"bolt-circle-{key[0]}-{members[0]['index']}"
                owners = Counter(p.get('fastener_ring',{}).get('owner') or p.get('mount_owner',p.get('assembly_bundle')) for p in ring_parts)
                owners = [(count,by_key[owner]) for owner,count in owners.items() if owner in by_key and by_key[owner] not in ring_parts]
                host = max(owners,key=lambda x:x[0])[1] if owners else None
                native_host,mates=native_mate_owner(ring_parts,parts,source_nodes)
                if native_host is not None:host=native_host
                direction = np.mean([x[3] for x in circle],axis=0)
                sign = 1 if direction@axis >= 0 else -1
                owner_offset = float(np.array(host['detail_offset_m'])@axis) if host else 0.
                # Withdraw towards the screw heads. A body opening the opposite
                # way must never overtake its already-withdrawn bolt circle.
                distance = float(np.clip(sign*(abs(owner_offset)+.030),-.138,.138))
                if abs(distance) < .025: distance = sign*.035
                bundle = ring_parts[0]['key']
                height = float(np.mean([x[2]@axis for x in circle]))
                ring = dict(id=ring_id,kind=key[2],axis=axis.tolist(),withdraw_sign=sign,center_m=(u*center[0]+v*center[1]+axis*height).tolist(),radius_m=float(radius),pitch_divisions=divisions,
                            members=members,owner=host['key'] if host else None,owner_mates=mates,offset_m=(axis*distance).tolist(),
                            evidence='Source screw-head plane, common cylinder axis and regular source hole positions; retain the source array, never redistribute individual screws.')
                for p in ring_parts:
                    p.pop('mount_owner',None)
                    p.update(assembly_bundle=bundle,fastener_ring=ring,stage=0,role='fastener-ring',detail_offset_m=ring['offset_m'][:],assembly_axis=axis.tolist(),mount_evidence=ring['evidence'])
                    if host: p['motion_group']=host['motion_group']
                rings.append(ring)
    return rings


def plan_single_fasteners(parts,source_nodes,is_fastener):
    """Keep noncircular fasteners separate too, using the real head/shaft axis."""
    source={(n['source_asset'],n['source_node_index']):n for n in source_nodes}
    for p in parts:
        if p['motor'] or p.get('fastener_ring'):continue
        if not any(is_fastener(source[(m['asset'],m['index'])]) for m in p['members']):continue
        axis=np.array(p['fastener_axis']);axis/=np.linalg.norm(axis)
        outward=np.array(p['fastener_outward']);sign=1 if outward@axis>=0 else -1
        p.pop('mount_owner',None)
        p.update(assembly_bundle=p['key'],stage=0,role='fastener',assembly_axis=axis.tolist(),
                 detail_offset_m=(axis*sign*.035).tolist(),
                 mount_evidence='Source cylinder axis and head side; independent withdrawal before the body opens.')
