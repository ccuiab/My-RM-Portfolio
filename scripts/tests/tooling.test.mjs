import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { ROOT, within } from '../lib/paths.mjs';
import { readSourceState } from '../lib/source-state.mjs';
import { buildVersionIndex, refreshVersionIndex, renderVersionIndex } from '../lib/version-index.mjs';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'rm-tooling-'));
  t.after(async () => {
    within(tmpdir(), directory);
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

test('version index preserves restore provenance, distinct snapshots, and offline records', () => {
  const original = { id: 'original', sourceCommit: '1234567890', method: 'original-github-pages-artifact', firstDeployedAt: '2026-01-01', artifactSha256: 'original-hash' };
  const local = { id: 'local', sourceCommit: original.sourceCommit, method: 'local-production-build', builtAt: '2026-02-01' };
  const offline = { id: 'offline', method: 'legacy-static-source-snapshot', firstDeployedAt: '2025-01-01' };
  const index = buildVersionIndex({
    previous: { current: original, versions: [original, offline] },
    restored: { versions: [{ ...original, artifactId: 42 }] },
    archived: [{ ...original, deploymentRecords: [{ id: 10 }] }, local],
    current: local, generatedAt: '2026-03-01',
  });
  assert.deepEqual(index.versions.map(version => version.id), ['local', 'original', 'offline']);
  assert.equal(index.versions[1].artifactSha256, 'original-hash');
  assert.equal(index.versions[1].artifactId, 42);
  assert.deepEqual(index.versions[1].deploymentRecords, [{ id: 10 }]);
  assert.deepEqual(index.current, { directory: 'current', ...local });
  assert.match(renderVersionIndex(index), /原始 GitHub Pages 发布包/);
  assert.match(renderVersionIndex(index), /旧版静态网页源码快照/);
  assert.throws(() => buildVersionIndex({ previous: { versions: [{}] } }), /missing its id/);
});

test('refreshing an index does not create snapshots or alter archive metadata', async t => {
  const publish = await fixture(t);
  const current = { id: 'build', method: 'local-production-build', builtAt: '2026-02-01' };
  const restored = { id: 'restore', method: 'rebuilt-from-deployed-git-commit', firstDeployedAt: '2026-01-01' };
  const json = value => JSON.stringify(value) + '\n';
  await mkdir(join(publish, 'history', restored.id), { recursive: true });
  await mkdir(join(publish, 'current'));
  await writeFile(join(publish, 'history', restored.id, 'version.json'), json(restored));
  await writeFile(join(publish, 'current/version.json'), json(current));
  await writeFile(join(publish, 'current/index.html'), '<h1>unchanged</h1>');
  await writeFile(join(publish, 'restored-versions.json'), json({ versions: [restored] }));
  const before = await readdir(join(publish, 'history'));
  const first = await refreshVersionIndex({ publish, generatedAt: '2026-03-01' });
  const second = await refreshVersionIndex({ publish, generatedAt: '2026-03-01' });
  assert.deepEqual(second, first);
  assert.deepEqual(await readdir(join(publish, 'history')), before);
  assert.equal(await readFile(join(publish, 'history', restored.id, 'version.json'), 'utf8'), json(restored));
  assert.equal(await readFile(join(publish, 'current/version.json'), 'utf8'), json(current));
  assert.equal(await readFile(join(publish, 'current/index.html'), 'utf8'), '<h1>unchanged</h1>');
  assert.equal(await readFile(join(publish, 'restored-versions.json'), 'utf8'), json({ versions: [restored] }));
  assert.match(await readFile(join(publish, 'VERSIONS.md'), 'utf8'), /从对应 Git 提交重建/);
});

test('source state detects untracked source and build config changes, but ignores generated output', async t => {
  const directory = await fixture(t);
  const checkout = join(directory, 'checkout');
  const git = (args, cwd = checkout) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  // Reuse the real repository's immutable objects; no synthetic authors or commits.
  git(['clone', '--shared', '--no-checkout', ROOT, checkout], directory);
  git(['sparse-checkout', 'set', '--no-cone', '/package.json', '/package-lock.json', '/tsconfig.json', '/.gitignore']);
  git(['checkout', '--detach', 'HEAD']);
  assert.equal(readSourceState(checkout).sourceState, 'committed');

  await mkdir(join(checkout, 'publish/current'), { recursive: true });
  await writeFile(join(checkout, 'publish/current/index.html'), 'generated');
  await writeFile(join(checkout, 'README.md'), 'documentation outside build inputs');
  assert.equal(readSourceState(checkout).sourceState, 'committed');

  for (const path of ['src/new-entry.ts', 'scripts/new-tool.mjs', 'materials/images/derived/web/new.svg']) {
    const destination = join(checkout, path);
    await mkdir(resolve(destination, '..'), { recursive: true });
    await writeFile(destination, 'new build input');
    assert.equal(readSourceState(checkout).sourceState, 'working-tree', path);
    await rm(destination);
  }
  for (const path of ['package-lock.json', 'tsconfig.json']) {
    const destination = join(checkout, path);
    const original = await readFile(destination);
    await writeFile(destination, Buffer.concat([original, Buffer.from('\n')]));
    assert.equal(readSourceState(checkout).sourceState, 'working-tree', path);
    await writeFile(destination, original);
    assert.equal(readSourceState(checkout).sourceState, 'committed', path);
  }
});

test('shared path guard rejects base and parent traversal', () => {
  assert.equal(within(ROOT, 'publish/current'), resolve(ROOT, 'publish/current'));
  assert.throws(() => within(ROOT, '.'), /Unsafe workspace path/);
  assert.throws(() => within(ROOT, '../outside'), /Unsafe workspace path/);
});
