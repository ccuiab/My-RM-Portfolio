"""Deterministic alpha reconstruction from aligned native SW white/black BMPs.

No generation, colour grading, threshold-based matte or per-image camera edits.
Run: python scripts/matte-sw-research.py WHITE.bmp BLACK.bmp OUTPUT.png
     --audit AUDIT.json [--crop X0 Y0 X1 Y1] [--size WIDTH HEIGHT]
An optional native all-opaque capture mask permits an independent interior check.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


def reconstruct(white, black):
    """SW screenshots are composited in their stored RGB space; keep that space."""
    white = np.asarray(white, dtype=np.float32) / 255
    black = np.asarray(black, dtype=np.float32) / 255
    if white.shape != black.shape or white.ndim != 3 or white.shape[2] != 3:
        raise ValueError('White and black captures must be matching RGB arrays')
    difference = white - black
    alpha = np.clip(1 - np.median(difference, axis=2), 0, 1)
    colour = np.divide(black, alpha[..., None], out=np.zeros_like(black),
                       where=alpha[..., None] > 0)
    # Store straight RGBA, as required by PNG. No threshold removes faint plates.
    rgba = np.concatenate((np.clip(colour, 0, 1), alpha[..., None]), axis=2)
    encoded = np.rint(rgba * 255).astype(np.uint8)
    encoded[encoded[..., 3] == 0, :3] = 0
    return encoded, difference


def distribution(values):
    if not values.size:
        return {'count': 0}
    return {'count': int(values.size), 'mean': float(values.mean()),
            'p50': float(np.percentile(values, 50)),
            'p95': float(np.percentile(values, 95)),
            'p99': float(np.percentile(values, 99)), 'max': float(values.max())}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('white', type=Path)
    parser.add_argument('black', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--audit', required=True, type=Path)
    parser.add_argument('--crop', nargs=4, type=int)
    parser.add_argument('--size', nargs=2, type=int)
    parser.add_argument('--opaque-mask', type=Path)
    args = parser.parse_args()
    white = Image.open(args.white).convert('RGB')
    black = Image.open(args.black).convert('RGB')
    rgba, difference = reconstruct(white, black)
    image = Image.fromarray(rgba)
    opaque = rgba[..., 3] >= 250
    # Erode five pixels so anti-aliasing and silhouettes do not bias this check.
    opaque = np.asarray(Image.fromarray(opaque.astype('uint8') * 255)
                        .filter(ImageFilter.MinFilter(11))) == 255
    mask_origin = 'alpha-derived proxy; not independent proof of opaque stability'
    if args.opaque_mask:
        mask = Image.open(args.opaque_mask).convert('L')
        if mask.size != white.size:
            raise ValueError('Independent opaque mask must match capture size')
        opaque = np.asarray(mask.filter(ImageFilter.MinFilter(11))) >= 250
        mask_origin = str(args.opaque_mask)
    abs_difference = np.abs(difference * 255)
    # Independent residual: a single alpha must explain all three RGB channels.
    alpha = rgba[..., 3].astype('float32') / 255
    predicted_white = rgba[..., :3].astype('float32') * alpha[..., None] + 255 * (1 - alpha[..., None])
    residual = np.abs(np.asarray(white, dtype='float32') - predicted_white)
    if args.crop:
        x0, y0, x1, y1 = args.crop
        if not (0 <= x0 < x1 <= image.width and 0 <= y0 < y1 <= image.height):
            raise ValueError('Crop must remain inside native capture')
        image = image.crop(tuple(args.crop))
    native_crop_size = list(image.size)
    if args.size:
        if any(v <= 0 for v in args.size):
            raise ValueError('Output dimensions must be positive')
        # Pillow converts RGBA to premultiplied RGBa for the Lanczos filter,
        # then converts back, avoiding coloured fringes on transparent edges.
        image = image.resize(tuple(args.size), Image.Resampling.LANCZOS)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    image.save(args.output, compress_level=9)
    audit = {
        'method': 'SolidWorks native dual-background difference matte; non-generative',
        'equations': 'alpha=clip(1-median((W-B)/255),0,1); RGB=clip(B/alpha,0,255)',
        'capture_size': list(white.size), 'crop': args.crop,
        'native_crop_size': native_crop_size, 'output_size': list(image.size),
        'resample': 'Lanczos in premultiplied alpha' if args.size else 'none',
        'opaque_mask_origin': mask_origin,
        'opaque_interior_abs_W_minus_B_8bit': distribution(abs_difference[opaque]),
        'channel_difference_spread_8bit': distribution(np.ptp(difference, axis=2) * 255),
        'white_reconstruction_error_8bit': distribution(residual),
        'negative_channel_difference_pixels': int(np.count_nonzero(np.any(difference < -1/255, axis=2))),
        'output_bytes': args.output.stat().st_size,
        'output_sha256': hashlib.sha256(args.output.read_bytes()).hexdigest(),
        'risk': 'Background-dependent reflections violate the compositing model. Inspect channel spread and independent opaque interiors; disable RealView, floor reflections, shadows and AO and recapture rather than repainting pixels.'
    }
    args.audit.parent.mkdir(parents=True, exist_ok=True)
    args.audit.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(audit, ensure_ascii=False))


if __name__ == '__main__':
    main()
