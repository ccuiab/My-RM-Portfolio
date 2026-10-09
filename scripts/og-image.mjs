// Build public/og.jpg (1200x630 share card) from the hero photo.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const W = 1200, H = 630;
const photo = await sharp(join(root, 'src/assets/img/eng-reach.webp'))
  .resize(W, H, { fit: 'cover', position: 'right' })
  .modulate({ saturation: 0.85 })
  .toBuffer();
const overlay = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#070d17" stop-opacity="0.96"/><stop offset="0.45" stop-color="#070d17" stop-opacity="0.75"/><stop offset="0.8" stop-color="#070d17" stop-opacity="0.05"/></linearGradient></defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect x="56" y="56" width="4" height="40" fill="#f2b53a"/>
  <text x="76" y="86" font-family="Consolas, monospace" font-size="22" fill="#f2b53a" letter-spacing="2">MECHANICAL LEAD // HKUST ENTERPRIZE</text>
  <text x="56" y="290" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-weight="700" font-size="128" fill="#e7eef6">崔楮焓</text>
  <text x="60" y="345" font-family="Segoe UI, sans-serif" font-size="34" fill="#9fb0c6" letter-spacing="3">Chuhan Cui</text>
  <text x="56" y="470" font-family="Consolas, monospace" font-size="72" fill="#f2b53a">5.8<tspan font-size="34" fill="#9fb0c6"> s</tspan></text>
  <text x="56" y="520" font-family="Microsoft YaHei, sans-serif" font-size="26" fill="#9fb0c6">RMUC 2025 四级矿兑换 · 工程全明星</text>
</svg>`);
await sharp(photo).composite([{ input: overlay }]).jpeg({ quality: 84, mozjpeg: true }).toFile(join(root, 'public/og.jpg'));
console.log('wrote public/og.jpg');
