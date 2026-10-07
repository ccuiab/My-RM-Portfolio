// Dev helper: tile every image in a folder into one PNG for quick visual review.
// Usage: node scripts/contact-sheet.mjs <dir> <out.png>
import sharp from 'sharp';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const [dir = 'src/assets/img', out = 'output/contact-images.png'] = process.argv.slice(2);
const files = readdirSync(dir).filter((f) => /\.(webp|jpe?g|png)$/i.test(f));
const W = 300, H = 220, cols = 5, rows = Math.ceil(files.length / cols);

const comps = [];
for (const [i, f] of files.entries()) {
  const x = (i % cols) * W, y = Math.floor(i / cols) * H;
  const img = await sharp(join(dir, f))
    .flatten({ background: '#ff00ff' })
    .resize(W, H - 24, { fit: 'contain', background: '#333' })
    .png()
    .toBuffer();
  const label = Buffer.from(
    `<svg width="${W}" height="24"><rect width="100%" height="100%" fill="#000"/>` +
      `<text x="6" y="17" font-size="14" fill="#fff" font-family="Arial">${f}</text></svg>`,
  );
  comps.push({ input: img, left: x, top: y }, { input: label, left: x, top: y + H - 24 });
}

await sharp({ create: { width: W * cols, height: H * rows, channels: 3, background: '#111' } })
  .composite(comps)
  .png()
  .toFile(out);
console.log('wrote', out);
