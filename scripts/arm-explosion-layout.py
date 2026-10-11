"""Deterministic clearance layout for straight-line CAD part separation.

Initially overlapping AABBs are assembly neighbours, not collision evidence.
Every other pair must remain disjoint throughout the full linear sweep.
"""
import math
import random
import numpy as np  # Included with Blender; the website needs no additional dependency.


def intersects(a, b, progress=0, padding=0):
    return all(a['bounds']['min'][i] + a['explode_offset_m'][i] * progress
               < b['bounds']['max'][i] + b['explode_offset_m'][i] * progress + padding
               and a['bounds']['max'][i] + a['explode_offset_m'][i] * progress
               > b['bounds']['min'][i] + b['explode_offset_m'][i] * progress - padding
               for i in range(3))


def crosses(a, b):
    if intersects(a, b, 0, -.0001):
        return False
    start, end = 0., 1.
    for i in range(3):
        amin, amax = a['bounds']['min'][i], a['bounds']['max'][i]
        bmin, bmax = b['bounds']['min'][i], b['bounds']['max'][i]
        speed = a['explode_offset_m'][i] - b['explode_offset_m'][i]
        if abs(speed) < 1e-10:
            if amax <= bmin + .0001 or amin >= bmax - .0001:
                return False
        else:
            first = (bmin + .0001 - amax) / speed
            last = (bmax - .0001 - amin) / speed
            start = max(start, min(first, last))
            end = min(end, max(first, last))
        if start >= end:
            return False
    return end > 0 and start < 1


def size(part):
    return math.sqrt(sum((part['bounds']['max'][i] - part['bounds']['min'][i]) ** 2 for i in range(3)))


def directions(part, axes):
    dims = [part['bounds']['max'][i] - part['bounds']['min'][i] for i in range(3)]
    normal = [int(i == dims.index(min(dims))) for i in range(3)]
    return [axes[part['link']], normal] + [[int(i == k) for i in range(3)] for k in range(3)]


def plan(parts, joints):
    axes = {joint['child_link']: joint['web_axis'] for joint in joints['joints']}
    count = len(parts)
    mins = np.array([part['bounds']['min'] for part in parts])
    maxs = np.array([part['bounds']['max'] for part in parts])
    sizes = np.linalg.norm(maxs - mins, axis=1)
    initial = np.all((mins[:, None, :] < maxs[None, :, :] - .0001)
                     & (maxs[:, None, :] > mins[None, :, :] + .0001), axis=2)
    fixed = [i for i, part in enumerate(parts) if part['motor'] or part['link'] == 'link_base']
    movable = [i for i in range(count) if i not in fixed]
    offsets = np.zeros((count, 3))

    def valid(index, candidates, other_indices):
        delta = candidates[:, None, :] - offsets[None, other_indices, :]
        endpoint = np.any(np.all((mins[index] + delta < maxs[other_indices] + .01)
                                 & (maxs[index] + delta > mins[other_indices] - .01), axis=2), axis=1)
        zero = np.abs(delta) < 1e-10
        denominator = np.where(zero, 1, delta)
        first = (mins[other_indices] + .0001 - maxs[index]) / denominator
        last = (maxs[other_indices] - .0001 - mins[index]) / denominator
        disjoint = (maxs[index] <= mins[other_indices] + .0001) | (mins[index] >= maxs[other_indices] - .0001)
        low = np.where(zero, np.where(disjoint, np.inf, -np.inf), np.minimum(first, last))
        high = np.where(zero, np.where(disjoint, -np.inf, np.inf), np.maximum(first, last))
        low = np.maximum(low.max(axis=2), 0)
        high = np.minimum(high.min(axis=2), 1)
        swept = np.any((low < high) & ~initial[index, other_indices], axis=1)
        return ~(endpoint | swept)

    def candidates_for(index, distances, prefer_axis=False):
        vectors, scores = [], []
        for rank, direction in enumerate(directions(parts[index], axes)):
            for sign in [1, -1]:
                vectors.extend(np.array(direction)[None, :] * sign * distances[:, None])
                scores.extend(distances + (rank * .025 if prefer_axis else 0))
        return np.array(vectors), np.array(scores)

    for attempt in range(100):
        order = sorted(movable, key=lambda index: -sizes[index])
        if attempt:
            random.Random(attempt).shuffle(order)
        placed = fixed[:]
        offsets[:] = 0
        for index in order:
            distances = np.arange(.07 + min(.22, sizes[index] * .45), .66, .035)
            vectors, scores = candidates_for(index, distances, True)
            available = valid(index, vectors, placed)
            if not available.any():
                break
            best = np.argmin(np.where(available, scores, np.inf))
            offsets[index] = vectors[best]
            placed.append(index)
        print('LAYOUT attempt', attempt, 'placed', len(placed), flush=True)
        if len(placed) == count:
            break
    else:
        raise RuntimeError('No straight-line clearance layout found')

    # Tighten the lanes without weakening either endpoint or sweep constraints.
    for iteration in range(6):
        changes = 0
        for index in sorted(movable, key=lambda index: -np.linalg.norm(offsets[index])):
            old_distance = np.linalg.norm(offsets[index])
            distances = np.arange(.05 + min(.16, sizes[index] * .35), old_distance - .002, .025)
            if not len(distances):
                continue
            vectors, scores = candidates_for(index, distances)
            available = valid(index, vectors, [other for other in range(count) if other != index])
            if available.any():
                best = np.argmin(np.where(available, scores, np.inf))
                offsets[index] = vectors[best]
                changes += 1
        print('LAYOUT compact', iteration, 'changes', changes, flush=True)
        if not changes:
            break
    for part, offset in zip(parts, offsets):
        part['explode_offset_m'] = offset.tolist()
