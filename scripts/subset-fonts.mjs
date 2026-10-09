// Subset Smiley Sans (CJK display face) to the characters the site actually uses.
// Source text: every .astro / .ts file under src/. Output: src/assets/fonts/smiley-sans.woff2
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const root = fileURLToPath(new URL('..', import.meta.url));
const exts = new Set(['.astro', '.ts', '.md', '.mdx']);

async function walk(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) await walk(p, out);
    else if (exts.has(extname(entry.name))) out.push(p);
  }
  return out;
}

const files = await walk(join(root, 'src'));
const chars = new Set();
for (const f of files) {
  for (const ch of await readFile(f, 'utf8')) {
    const cp = ch.codePointAt(0);
    // printable ASCII + everything from General Punctuation upward (CJK, fullwidth punctuation)
    if ((cp >= 0x20 && cp <= 0x7e) || cp >= 0x2000) chars.add(ch);
  }
}

const font = await readFile(join(root, 'fonts-src', 'SmileySans-Oblique.ttf'));
const woff2 = await subsetFont(font, [...chars].join(''), { targetFormat: 'woff2' });
await mkdir(join(root, 'src', 'assets', 'fonts'), { recursive: true });
await writeFile(join(root, 'src', 'assets', 'fonts', 'smiley-sans.woff2'), woff2);
console.log(`smiley-sans.woff2: ${chars.size} chars, ${(woff2.length / 1024).toFixed(1)} KB`);
