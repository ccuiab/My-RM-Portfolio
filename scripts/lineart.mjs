// Generate amber edge-line versions of photos/renders for the "wireframe scan" reveal.
// Usage: node scripts/lineart.mjs → writes materials/images/derived/generated/<name>-lines.webp
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const AMBER = { r: 242, g: 181, b: 58 };

// blur suppresses texture noise; gain/cut set how many edges survive (tuned by eye)
const jobs = [
  { src: 'source/historical/eng-reach.webp', width: 1920, blur: 0.9, gain: 7, cut: 9 },
  { src: 'derived/inputs/site/hero-bot.webp', width: 1920, blur: 0.6, gain: 6, cut: 10 },
];

await mkdir(join(root, 'materials', 'images', 'derived', 'generated'), { recursive: true });

for (const job of jobs) {
  const input = join(root, 'materials', 'images', job.src);
  const { data, info } = await sharp(input)
    .flatten({ background: '#ffffff' })
    .resize({ width: job.width, withoutEnlargement: true })
    .greyscale()
    .blur(job.blur)
    // Laplacian edge magnitude
    .convolve({ width: 3, height: 3, kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1] })
    .linear(job.gain, -job.cut * job.gain)
    .extractChannel(0)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const out = join(root, 'materials', 'images', 'derived', 'generated', job.src.split('/').at(-1).replace(/\.[a-z]+$/, '') + '-lines.webp');
  await sharp({ create: { width: info.width, height: info.height, channels: 3, background: AMBER } })
    .joinChannel(data, { raw: { width: info.width, height: info.height, channels: 1 } })
    .webp({ quality: 82, alphaQuality: 90 })
    .toFile(out);
  console.log('wrote', out, `${info.width}x${info.height}`);
}
