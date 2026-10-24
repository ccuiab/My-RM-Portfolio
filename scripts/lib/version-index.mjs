import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PUBLISH } from './paths.mjs';

const METHODS = {
  'original-github-pages-artifact': '原始 GitHub Pages 发布包',
  'rebuilt-from-deployed-git-commit': '从对应 Git 提交重建',
  'legacy-static-source-snapshot': '旧版静态网页源码快照',
  'local-production-build': '本地生产构建',
  'local-before-reorganization': '目录整理前的本地网页',
};

function records(document) {
  if (!document) return [];
  if (!Array.isArray(document.versions)) throw new Error('Version index must contain a versions array');
  return document.versions;
}

// Existing index records are retained even if their local archive is offline.
// Per-version files are authoritative; dedupe by id, never by source commit.
export function buildVersionIndex({ previous, restored, archived = [], current = null, generatedAt }) {
  const versionsById = new Map();
  for (const version of [...records(previous), ...records(restored), ...archived]) {
    if (!version || typeof version.id !== 'string' || !version.id) throw new Error('Version record is missing its id');
    versionsById.set(version.id, { ...versionsById.get(version.id), ...version });
  }
  const timestamp = version => version.firstDeployedAt || version.builtAt || '';
  const versions = [...versionsById.values()].sort((a, b) =>
    timestamp(b).localeCompare(timestamp(a)) || a.id.localeCompare(b.id));
  return { generatedAt, current: current ? { directory: 'current', ...current } : null, versions };
}

export function renderVersionIndex(index) {
  const cell = value => String(value ?? '—').replaceAll('|', '\\|').replaceAll('\n', ' ');
  const rows = index.versions.map(version =>
    `| ${cell(version.id)} | ${cell(version.sourceCommit?.slice(0, 7))} | ${cell(METHODS[version.method] || version.method)} |`);
  return [
    '# 网页版本索引', '',
    '当前版本位于 `current/`，历史网页位于 `history/<版本名>/`。现有版本记录会保留；本机可用文件以对应历史目录为准。', '',
    '| 版本目录 | Git 提交 | 保存方式 |', '| --- | --- | --- |', ...rows, '',
    '详细时间、发布记录与原始包校验值见 `versions.json`、`restored-versions.json` 和各版本的 `version.json`。', '',
  ].join('\n');
}

async function optionalJson(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function replaceFile(path, contents) {
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(temporary, contents);
    await rename(temporary, path);
  } finally { await rm(temporary, { force: true }); }
}

export async function refreshVersionIndex({ publish = PUBLISH, generatedAt = new Date().toISOString() } = {}) {
  const history = join(publish, 'history');
  const [previous, restored, current, entries] = await Promise.all([
    optionalJson(join(publish, 'versions.json')),
    optionalJson(join(publish, 'restored-versions.json')),
    optionalJson(join(publish, 'current/version.json')),
    readdir(history, { withFileTypes: true }).catch(error => {
      if (error.code === 'ENOENT') return [];
      throw error;
    }),
  ]);
  const archived = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const metadata = await optionalJson(join(history, entry.name, 'version.json'));
    if (metadata) archived.push(metadata);
  }
  const index = buildVersionIndex({ previous, restored, archived, current, generatedAt });
  await mkdir(publish, { recursive: true });
  await replaceFile(join(publish, 'versions.json'), JSON.stringify(index, null, 2) + '\n');
  await replaceFile(join(publish, 'VERSIONS.md'), renderVersionIndex(index));
  return index;
}
