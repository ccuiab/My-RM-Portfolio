"""Shared explosion metadata in glTF's Y-up frame (metres).

Used by Blender export and the metadata-only updater. Geometry, CAD poses,
motor placement and the steering hierarchy are never changed here.
"""
DRIVE_LAYERS = {34: -.19, 35: .035, 37: .072, 39: .072, 40: .072, 38: .111,
                41: .16, 42: .19, 43: -.19, 44: .135,
                45: .23, 46: .23, 47: -.19, 31: .26}


def sensor_metadata(index):
    key = 'slip-ring' if index == 59 else 'optical-target' if index == 56 else 'optical-pcb' if 64 <= index <= 108 else None
    return {'web_sensor': key, 'web_structure': False} if key else {}


def explosion_metadata(index, pinion, wheel_axis):
    if pinion or index in (58, 61):
        return {'web_explode': [0, .14, 0], 'web_explode_group': 'steering', 'web_guide': True}
    if index == 62:
        return {'web_explode': [0, .065, 0], 'web_explode_group': 'steering', 'web_guide': True}
    if index in DRIVE_LAYERS:
        return {'web_explode': [v * DRIVE_LAYERS[index] for v in wheel_axis],
                'web_explode_group': 'drive', 'web_guide': index in (31, 34, 35, 38, 39)}
    # Keep the suspension on its actual supports, including rail/carriage pairs
    # and both gas-spring parts. The frame is ghosted by the viewer.
    return {'web_explode': [0, 0, 0], 'web_explode_group': 'fixed', 'web_guide': False}
