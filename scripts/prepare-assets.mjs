// Stage runtime files from the single materials library; Astro imports images/fonts directly.
import { cp, mkdir, rm } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const staging = resolve(root, '.astro-public');
if (relative(root, staging) !== '.astro-public') throw new Error('Unexpected public staging path');
await rm(staging, {recursive: true, force: true});
await mkdir(staging, {recursive: true});
for (const [source, target] of [
  ['src/static', '.'],
  ['materials/models/web', 'models'],
  ['materials/videos/web', 'video'],
  ['materials/images/video-posters', 'video'],
  ['materials/images/web', '.'],
]) {
  await cp(join(root, source), join(staging, target), {recursive: true});
}
console.log('Runtime assets staged from materials/ into .astro-public/');
