"""Ordered L1–L6 teaching layout, retaining each small part's assembly bundle.

This is a visual separation diagram, not a collision-free maintenance sequence.
Motors translate only with their rigid link, without internal separation.
"""
import math
import re


def center(part):
    return [(a + b) / 2 for a, b in zip(part['bounds']['min'], part['bounds']['max'])]


def size(part):
    return math.sqrt(sum((b - a) ** 2 for a, b in zip(part['bounds']['min'], part['bounds']['max'])))


def plan(parts, joints):
    # The wheel drive belongs to the L5 end assembly in the audited rigid-link map.
    for part in parts:
        part['group'] = 1 if part['link'] == 'link_base' else 5 if part['link'] == 'link_wheel' else int(part['link'].split('_')[-1])
    axes = {joint['child_link']: joint['web_axis'] for joint in joints['joints']}
    chain = [1., .06, -.22]
    norm = math.sqrt(sum(v * v for v in chain))
    chain = [v / norm for v in chain]
    groups = []
    for number in range(1, 7):
        members = [p for p in parts if p['group'] == number]
        lo = [min(p['bounds']['min'][i] for p in members) for i in range(3)]
        hi = [max(p['bounds']['max'][i] for p in members) for i in range(3)]
        groups.append({'members': members, 'center': [(a + b) / 2 for a, b in zip(lo, hi)],
                       'half_width': sum(abs(chain[i]) * (hi[i] - lo[i]) for i in range(3)) / 2})
    distance = 0
    origin = groups[0]['center']
    for index, group in enumerate(groups):
        if index:
            distance += groups[index - 1]['half_width'] + group['half_width'] + .09
        translation = [origin[i] + chain[i] * distance - group['center'][i] for i in range(3)]
        members = group['members']
        anchors = [p for p in members if not p['motor'] and size(p) >= .055]
        for part in members:
            local = [0., 0., 0.]
            name = part['node_name']
            dims = [b - a for a, b in zip(part['bounds']['min'], part['bounds']['max'])]
            if not part['motor'] and part['link'] != 'link_base':
                if part.get('material') == 'carbon':
                    axis = dims.index(min(dims))
                    delta = center(part)[axis] - group['center'][axis]
                    local[axis] = math.copysign(.028, delta) if abs(delta) > .004 else 0.
                elif any(token in name.lower() for token in ['gear', 'teeth', '同步轮']):
                    axis = axes.get(part['link'], [1., 0., 0.])
                    projection = sum((center(part)[i] - group['center'][i]) * axis[i] for i in range(3))
                    local = [v * math.copysign(.025, projection) for v in axis]
            part['local_offset_m'] = local
            part['assembly_bundle'] = part['key']
        for part in members:
            small = size(part) < .055 or bool(re.search(r'垫|螺|卡簧|DIN|ISO|^M\d', part['node_name'], re.I))
            if small and not part['motor'] and anchors:
                position = center(part)
                def proximity(anchor):
                    box = anchor['bounds']
                    return sum(max(box['min'][i] - position[i], 0., position[i] - box['max'][i]) ** 2 for i in range(3)) + .01 * sum((center(anchor)[i] - position[i]) ** 2 for i in range(3))
                host = min(anchors, key=proximity)
                part['local_offset_m'] = host['local_offset_m'][:]
                part['assembly_bundle'] = host['key']
            part['group_offset_m'] = translation[:]
            part['explode_offset_m'] = [translation[i] + part['local_offset_m'][i] for i in range(3)]
