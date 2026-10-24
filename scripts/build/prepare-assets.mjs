// Stage runtime files from the single materials library; Astro imports images/fonts directly.
import { cp, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT as root, PUBLIC as staging, within } from '../lib/paths.mjs';

within(root, staging);
await rm(staging, {recursive: true, force: true});
await mkdir(staging, {recursive: true});
for (const [source, target] of [
  ['src/static', '.'],
  ['materials/models/derived/web', 'models'],
  ['materials/videos/derived/web', 'video'],
  ['materials/images/derived/video-posters', 'video'],
  ['materials/images/derived/web', '.'],
]) {
  await cp(join(root, source), join(staging, target), {recursive: true});
}
console.log('Runtime assets staged from materials/ into .astro-public/');
