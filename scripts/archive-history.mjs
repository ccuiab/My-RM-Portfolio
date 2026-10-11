// Restore recorded GitHub Pages versions without checking out or changing the working tree.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, readdir, stat, symlink, unlink, rm } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const run = promisify(execFile);
const root = fileURLToPath(new URL('..', import.meta.url));
const repo = 'ccuiab/My-RM-Portfolio';
const history = join(root, 'publish/history');
const work = join(root, '.archive-work');

function within(base, ...parts) {
  const target = resolve(base, ...parts);
  const rel = relative(resolve(base), target);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw new Error(`Unsafe archive path: ${target}`);
  return target;
}
async function command(file, args, cwd = root) {
  return (await run(file, args, {cwd, maxBuffer: 32 * 1024 * 1024, env: {...process.env, ASTRO_TELEMETRY_DISABLED: '1'}})).stdout.trim();
}
async function json(args) { return JSON.parse(await command('gh', args)); }
async function exists(path) { try { await stat(path); return true; } catch { return false; } }
async function inventory(dir) {
  let files = 0, bytes = 0;
  for (const item of await readdir(dir, {withFileTypes: true})) {
    const path = join(dir, item.name);
    if (item.isDirectory()) { const child = await inventory(path); files += child.files; bytes += child.bytes; }
    else if (item.isFile()) { files++; bytes += (await stat(path)).size; }
    else throw new Error(`Unexpected link in published version: ${path}`);
  }
  return {files, bytes};
}
async function extract(tar, destination, strip = false) {
  const entries = (await command('tar', ['-tf', tar])).split(/\r?\n/);
  for (const entry of entries) {
    if (isAbsolute(entry) || /(^|[\\/])\.\.([\\/]|$)/.test(entry) || /^[A-Za-z]:/.test(entry)) {
      throw new Error(`Unsafe archive entry: ${entry}`);
    }
  }
  await mkdir(destination, {recursive: true});
  await command('tar', ['-xf', tar, '-C', destination, ...(strip ? ['--strip-components=1'] : [])]);
}

await mkdir(history, {recursive: true});
await mkdir(work, {recursive: true});
const deployments = await json(['api', '--paginate', `repos/${repo}/deployments?per_page=100`, '--jq', '[.[] | {sha,created_at,id,environment}]']);
const artifacts = (await json(['api', `repos/${repo}/actions/artifacts?per_page=100`])).artifacts;
const versions = [];
const grouped = new Map();
for (const deployment of deployments.filter(d => d.environment === 'github-pages')) {
  if (!grouped.has(deployment.sha)) grouped.set(deployment.sha, []);
  grouped.get(deployment.sha).push(deployment);
}
for (const [sha, records] of grouped) {
  const first = records.reduce((a, b) => a.created_at < b.created_at ? a : b);
  try { await command('git', ['cat-file', '-e', `${sha}^{commit}`]); }
  catch { await command('git', ['fetch', 'origin', sha]); }
  const tree = await command('git', ['ls-tree', '--name-only', sha]);
  const astro = tree.split(/\r?\n/).includes('astro.config.mjs');
  const id = `${first.created_at.replace(/[-:]/g, '').replace('T', '-').replace('Z', '')}-${astro ? 'astro' : 'legacy'}-${sha.slice(0, 7)}`;
  const destination = within(history, id);
  const metadataPath = join(destination, 'version.json');
  if (await exists(metadataPath)) {
    versions.push(JSON.parse(await readFile(metadataPath, 'utf8')));
    console.log(`Already archived ${id}`);
    continue;
  }
  const staging = within(work, sha);
  await mkdir(staging, {recursive: true});
  const artifact = artifacts.find(a => a.name === 'github-pages' && !a.expired && a.workflow_run?.head_sha === sha);
  let method, artifactSha256;
  if (astro && artifact) {
    console.log(`Downloading original Pages artifact ${id}`);
    const download = within(staging, 'artifact');
    await mkdir(download, {recursive: true});
    const tar = join(download, 'artifact.tar');
    if (!(await exists(tar))) await command('gh', ['run', 'download', String(artifact.workflow_run.id), '--repo', repo, '--name', 'github-pages', '--dir', download]);
    artifactSha256 = createHash('sha256').update(await readFile(tar)).digest('hex');
    await extract(tar, destination);
    method = 'original-github-pages-artifact';
  } else if (astro) {
    console.log(`Rebuilding archived Astro source ${id}`);
    const source = within(staging, 'source');
    const tar = within(staging, 'source.tar');
    await command('git', ['archive', '--format=tar', '-o', tar, sha]);
    await extract(tar, source);
    const packageData = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
    const currentPackage = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    if (JSON.stringify(packageData.dependencies) !== JSON.stringify(currentPackage.dependencies) ||
        JSON.stringify(packageData.devDependencies) !== JSON.stringify(currentPackage.devDependencies)) {
      throw new Error(`Dependency versions differ for ${id}; an isolated npm ci is required.`);
    }
    const modules = within(source, 'node_modules');
    if (!(await exists(modules))) await symlink(join(root, 'node_modules'), modules, 'junction');
    try {
      await command(process.execPath, [join(source, 'scripts/subset-fonts.mjs')], source);
      await command(process.execPath, [join(root, 'node_modules/astro/bin/astro.mjs'), 'build', '--outDir', destination], source);
    } finally { await unlink(modules); }
    method = 'rebuilt-from-deployed-git-commit';
  } else {
    console.log(`Restoring legacy website ${id}`);
    const rootEntries = tree.split(/\r?\n/);
    const legacyDirectory = rootEntries.includes('docs') ? 'docs' : rootEntries.includes('CV') ? 'CV' : '';
    if (!legacyDirectory && !rootEntries.some(p => p.endsWith('.html'))) throw new Error(`Missing legacy website directory: ${sha}`);
    // Read Git blobs directly: Windows tar can strip Chinese filenames incorrectly.
    await rm(destination, {recursive: true, force: true});
    await mkdir(destination, {recursive: true});
    const paths = (await command('git', ['ls-tree', '-r', '-z', '--name-only', sha, ...(legacyDirectory ? [legacyDirectory] : [])])).split('\0').filter(Boolean);
    for (const path of paths) {
      const file = within(destination, legacyDirectory ? path.slice(legacyDirectory.length + 1) : path);
      await mkdir(resolve(file, '..'), {recursive: true});
      const {stdout} = await run('git', ['show', `${sha}:${path}`], {cwd: root, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024});
      await writeFile(file, stdout);
    }
    method = 'legacy-static-source-snapshot';
  }
  const entryPoint = (await exists(join(destination, 'index.html'))) ? 'index.html'
    : (await exists(join(destination, 'CUIChuhanCV.html'))) ? 'CUIChuhanCV.html'
    : (await exists(join(destination, 'CUIchuhan.html'))) ? 'CUIchuhan.html' : null;
  if (!entryPoint) throw new Error(`Missing version entry point: ${id}`);
  const info = await inventory(destination);
  const metadata = {
    id, sourceCommit: sha, firstDeployedAt: first.created_at,
    deploymentRecords: records, method,
    ...(artifact ? {artifactId: artifact.id, workflowRunId: artifact.workflow_run.id, artifactSha256} : {}),
    restoredAt: new Date().toISOString(), base: '/My-RM-Portfolio', entryPoint, ...info,
  };
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2) + '\n');
  versions.push(metadata);
  // Every disposable checkout is confined to .archive-work. Junctions are removed above.
  await rm(within(work, sha), {recursive: true, force: true});
  console.log(`Archived ${id}: ${method}, ${info.files} files`);
}
await writeFile(join(root, 'publish/restored-versions.json'), JSON.stringify({generatedAt: new Date().toISOString(), versions}, null, 2) + '\n');
console.log(`Restored ${versions.length} historical website versions.`);
