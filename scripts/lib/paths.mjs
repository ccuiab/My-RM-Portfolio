import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve from this module, so stable CLI wrappers also work outside the repo cwd.
export const ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const MATERIALS = join(ROOT, 'materials');
export const PUBLIC = join(ROOT, '.astro-public');
export const PUBLISH = join(ROOT, 'publish');
export const CURRENT = join(PUBLISH, 'current');
export const HISTORY = join(PUBLISH, 'history');
export const ARCHIVE_WORK = join(ROOT, '.archive-work');

// A descendant is required; the base itself and traversal outside it are refused.
export function within(base, ...parts) {
  const target = resolve(base, ...parts);
  const rel = relative(resolve(base), target);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`Unsafe workspace path: ${target}`);
  }
  return target;
}
