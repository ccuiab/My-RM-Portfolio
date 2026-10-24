import { refreshVersionIndex } from '../lib/version-index.mjs';

const index = await refreshVersionIndex();
console.log(`Publication index refreshed: ${index.versions.length} versions; no new snapshot created.`);
