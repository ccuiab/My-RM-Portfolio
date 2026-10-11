// Every successful production build gets an immutable local release snapshot.
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const publish = join(root, 'publish');
const current = join(publish, 'current');
const history = join(publish, 'history');
await stat(join(current, 'index.html'));
const builtAt = new Date().toISOString();
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).trim();
const changes = execFileSync('git', ['status', '--porcelain', '--untracked-files=no', '--', 'src', 'scripts', 'materials', 'package.json', 'astro.config.mjs', '.github'], {cwd: root, encoding: 'utf8'}).trim();
const id = `${builtAt.replace(/[-:.]/g, '').replace('T', '-').replace('Z', '')}-local-${sourceCommit.slice(0, 7)}${changes ? '-working' : ''}`;
const metadata = {id, sourceCommit, builtAt, method: 'local-production-build', sourceState: changes ? 'working-tree' : 'committed', base: '/My-RM-Portfolio'};
await writeFile(join(current, 'version.json'), JSON.stringify(metadata, null, 2) + '\n');
const destination = resolve(history, id);
if (relative(history, destination) !== id) throw new Error('Unexpected release archive path');
await mkdir(history, {recursive: true});
await cp(current, destination, {recursive: true, errorOnExist: true, force: false});
const versions = [];
for (const entry of await readdir(history, {withFileTypes: true})) {
  if (!entry.isDirectory()) continue;
  try { versions.push(JSON.parse(await readFile(join(history, entry.name, 'version.json'), 'utf8'))); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
versions.sort((a, b) => (b.firstDeployedAt || b.builtAt || '').localeCompare(a.firstDeployedAt || a.builtAt || ''));
await writeFile(join(publish, 'versions.json'), JSON.stringify({generatedAt: builtAt, current: {directory: 'current', ...metadata}, versions}, null, 2) + '\n');
const methods = {
  'original-github-pages-artifact': '原始 GitHub Pages 发布包',
  'rebuilt-from-deployed-git-commit': '从对应 Git 提交重建',
  'legacy-static-source-snapshot': '旧版静态网页源码快照',
  'local-production-build': '本地生产构建',
  'local-before-reorganization': '目录整理前的本地网页',
};
const rows = versions.map(v => `| ${v.id} | ${v.sourceCommit?.slice(0, 7) || '—'} | ${methods[v.method] || v.method} |`).join('\n');
await writeFile(join(publish, 'VERSIONS.md'), `# 网页版本索引\n\n当前版本位于 \`current/\`，历史网页位于 \`history/<版本名>/\`。每个历史目录都包含独立的网页与资源。\n\n| 版本目录 | Git 提交 | 保存方式 |\n| --- | --- | --- |\n${rows}\n\n详细时间、发布记录与原始包校验值见 \`versions.json\` 和各版本的 \`version.json\`。\n`);
console.log(`Published build: publish/current/; archived as history/${id}/`);
