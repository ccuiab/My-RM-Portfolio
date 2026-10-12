"""Two-stage radial separation in the unmodified CAD assembly coordinate frame.

Group names come from CAD. This is a structural diagram, not a service sequence.
Complete motors and the hardware on each mounting body remain rigid bundles.
"""
import math
import re


def center(part):
    return [(a + b) / 2 for a, b in zip(part['bounds']['min'], part['bounds']['max'])]


def size(part):
    return math.sqrt(sum((b - a) ** 2 for a, b in zip(part['bounds']['min'], part['bounds']['max'])))


def hardware(part):
    return bool(re.search(r'垫|螺|卡簧|轴承|bearing|screw|nut|washer|DIN|ISO|^STD_|^AXK|^MR\d|^C-E', part['node_name'], re.I))


NAMES = {0: 'J0 / J0云台主体v2.2025.10.1 / 滑环模块.2025.10.1',
         1: 'J1.2025.10.1', 2: 'L2.2025.10.1', 3: 'J3.2025.10.1',
         4: 'L4.2025.10.1', 5: 'L6_v2.2025.10.1 / J7J8_差速器CNC',
         6: 'L6_v2.2025.10.1 / J8_末端轴cnc', 7: 'limitation.2025.10.1'}


def groups(parts):
    result = []
    for number in sorted({p['group'] for p in parts}):
        members = [p for p in parts if p['group'] == number]
        low = [min(p['bounds']['min'][i] for p in members) for i in range(3)]
        high = [max(p['bounds']['max'][i] for p in members) for i in range(3)]
        volume = sum(p.get('geometry_volume_m3', 0) for p in members)
        centroid = [sum(p.get('geometry_centroid_m', center(p))[i] * p.get('geometry_volume_m3', 0) for p in members) / volume for i in range(3)] if volume else [(a+b)/2 for a, b in zip(low, high)]
        result.append({'id': number, 'node_name': NAMES[number], 'bounds': {'min': low, 'max': high},
                       'center_m': centroid, 'offset_m': members[0]['group_offset_m'],
                       'source_node_count': sum(len(p['members']) for p in members),
                       'bundle_count': len(members)})
    return result


def plan(parts, joints):
    for part in parts:
        part['group'] = 7 if part['link'] == 'link_1_left' else 0 if part['link'] == 'link_base' else 5 if part['link'] == 'link_wheel' else int(part['link'].split('_')[-1])
        part['group_offset_m'] = [0., 0., 0.]
    axes = {joint['child_link']: joint['web_axis'] for joint in joints['joints']}
    overall = {'min': [min(p['bounds']['min'][i] for p in parts) for i in range(3)],
               'max': [max(p['bounds']['max'][i] for p in parts) for i in range(3)]}
    volume = sum(p.get('geometry_volume_m3', 0) for p in parts)
    origin = [sum(p.get('geometry_centroid_m', center(p))[i] * p.get('geometry_volume_m3', 0) for p in parts) / volume for i in range(3)] if volume else center({'bounds': overall})
    specs = groups(parts)
    directions, distances = [], []
    for group in specs:
        delta = [group['center_m'][i] - origin[i] for i in range(3)]
        # Amplify the narrow transverse dimension so the left-side drive reads as left.
        delta[0] *= 5
        length = math.sqrt(sum(v*v for v in delta))
        direction = [v / length for v in delta]
        directions.append(direction)
        distances.append(.015 + .10 * size({'bounds': group['bounds']}))
    # Increase separation only along outward rays until the group AABBs have a gap.
    for iteration in range(80):
        overlap = False
        for a in range(len(specs)):
            for b in range(a + 1, len(specs)):
                gap = max(max(specs[a]['bounds']['min'][i] + directions[a][i]*distances[a] - specs[b]['bounds']['max'][i] - directions[b][i]*distances[b],
                              specs[b]['bounds']['min'][i] + directions[b][i]*distances[b] - specs[a]['bounds']['max'][i] - directions[a][i]*distances[a]) for i in range(3))
                if gap < .008:
                    alignment = sum(directions[a][i]*directions[b][i] for i in range(3))
                    if alignment > .75:
                        # Neighboring distal links share a forward ray. Extend the farther
                        # group only; increasing both would keep their overlap and inflate the view.
                        outward_a = sum((specs[a]['center_m'][i]-origin[i])*directions[a][i] for i in range(3))
                        outward_b = sum((specs[b]['center_m'][i]-origin[i])*directions[b][i] for i in range(3))
                        distances[a if outward_a > outward_b else b] += .006
                    else:
                        distances[a] += .004
                        distances[b] += .004
                    overlap = True
        if not overlap:
            break
    for group, direction, distance in zip(specs, directions, distances):
        members = [p for p in parts if p['group'] == group['id']]
        translation = [v*distance for v in direction]
        anchors = [p for p in members if not hardware(p)]
        for part in members:
            local = [0., 0., 0.]
            dims = [b-a for a, b in zip(part['bounds']['min'], part['bounds']['max'])]
            delta = [center(part)[i]-group['center_m'][i] for i in range(3)]
            if not part['motor'] and not hardware(part) and '04C链节' not in part['node_name']:
                if part.get('material') == 'carbon' or min(dims) < .008:
                    axis = dims.index(min(dims))
                    local[axis] = math.copysign(.035, delta[axis]) if abs(delta[axis]) > .004 else 0.
                elif any(token in part['node_name'].lower() for token in ['gear', 'teeth', '同步轮', '轴cnc', '传动轴']):
                    axis = axes.get(part['link'], [1., 0., 0.])
                    projection = sum(delta[i]*axis[i] for i in range(3))
                    local = [v*math.copysign(.03, projection) for v in axis]
                else:
                    length = math.sqrt(sum(v*v for v in delta))
                    if length > .02:
                        local = [v/length*.018 for v in delta]
            part['local_offset_m'] = local
            # A close-up opens the mounting bodies further; complete motors retain
            # their original pose relative to the owning group at every detail level.
            part['detail_offset_m'] = [v * 3 for v in local]
            part['assembly_bundle'] = part['key']
        for part in members:
            if hardware(part) and not part['motor'] and anchors:
                position = center(part)
                def proximity(anchor):
                    box = anchor['bounds']
                    return sum(max(box['min'][i]-position[i], 0., position[i]-box['max'][i])**2 for i in range(3)) + .01*sum((center(anchor)[i]-position[i])**2 for i in range(3))
                host = min(anchors, key=proximity)
                part['local_offset_m'] = host['local_offset_m'][:]
                part['detail_offset_m'] = host['detail_offset_m'][:]
                part['assembly_bundle'] = host['key']
            part['group_offset_m'] = translation[:]
            part['explode_offset_m'] = [translation[i]+part['local_offset_m'][i] for i in range(3)]
