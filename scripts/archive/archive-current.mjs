// Every successful production build gets an immutable local release snapshot.
import { cp, mkdir, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { CURRENT as current, HISTORY as history, within } from '../lib/paths.mjs';
import { readSourceState } from '../lib/source-state.mjs';
import { refreshVersionIndex } from '../lib/version-index.mjs';

await stat(join(current, 'index.html'));
const builtAt = new Date().toISOString();
const { sourceCommit, sourceState } = readSourceState();
const id = `${builtAt.replace(/[-:.]/g, '').replace('T', '-').replace('Z', '')}-local-${sourceCommit.slice(0, 7)}${sourceState === 'working-tree' ? '-working' : ''}`;
const metadata = { id, sourceCommit, builtAt, method: 'local-production-build', sourceState, base: '/My-RM-Portfolio' };
await writeFile(join(current, 'version.json'), JSON.stringify(metadata, null, 2) + '\n');
const destination = within(history, id);
await mkdir(history, { recursive: true });
await cp(current, destination, { recursive: true, errorOnExist: true, force: false });
await refreshVersionIndex({ generatedAt: builtAt });
console.log(`Published build: publish/current/; archived as history/${id}/`);
