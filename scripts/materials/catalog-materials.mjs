// Rebuild the local material inventory, including ignored archives, without network access.
import { createReadStream } from 'node:fs';
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, extname } from 'node:path';
import { ROOT as root, MATERIALS as library } from '../lib/paths.mjs';

const seed = process.argv.includes('--seed') ? process.argv[process.argv.indexOf('--seed') + 1] : 'materials/inventory.csv';
function parseCsv(text) {
  const rows = []; let row = [], value = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && text[i + 1] === '"' && quoted) { value += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === ',' && !quoted) { row.push(value); value = ''; }
    else if (c === '\n' && !quoted) { row.push(value.replace(/\r$/, '')); rows.push(row); row = []; value = ''; }
    else value += c;
  }
  if (row.length || value) { row.push(value); rows.push(row); }
  const headers = rows.shift() ?? [];
  return rows.map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])));
}
const prior = parseCsv(await readFile(join(root, seed), 'utf8').catch(() => ''));
const priorByPath = new Map(prior.map(row => [row['materials内相对路径'], row]));
const cleanup = JSON.parse(await readFile(join(library, 'cleanup.json'), 'utf8'));
const migration = new Map(cleanup.entries.filter(e => e.destination).map(e => [e.destination.replace(/^materials\//, ''), e]));
const labels = { images: '图片', models: '模型', videos: '视频', fonts: '字体', documents: '资料与审计' };
async function walk(dir, prefix = '') {
  const files = [];
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const path = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await walk(join(dir, entry.name), `${path}/`));
    else if (entry.isFile()) files.push(path);
    else throw new Error(`Unexpected symbolic link in materials: ${path}`);
  }
  return files.sort();
}
async function digest(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path, { highWaterMark: 4 * 1024 * 1024 })) hash.update(chunk);
  return hash.digest('hex');
}
function size(bytes) {
  for (const [unit, scale] of [['GiB', 1024 ** 3], ['MiB', 1024 ** 2], ['KiB', 1024]]) if (bytes >= scale) return `${(bytes / scale).toFixed(2)} ${unit}`;
  return `${bytes} B`;
}
function type(path) {
  const ext = extname(path).toLowerCase();
  if (/^\.(bmp|jpe?g|png|svg|webp)$/.test(ext)) return '图片';
  if (/^\.(glb|blend|stl|sldasm|urdf|step|stp|xbf)$/.test(ext)) return '3D/CAD/URDF';
  if (ext === '.mp4') return '视频';
  if (/^\.(ttf|woff2)$/.test(ext)) return '字体';
  if (/^\.(json|csv)$/.test(ext)) return '索引、参数与审计数据';
  if (/^\.(md|pdf|txt)$/.test(ext)) return '文档';
  if (ext === '.7z') return '压缩归档';
  return '解码器与来源页面';
}
const rows = [];
for (const path of await walk(library)) {
  if (['INVENTORY.md', 'inventory.csv'].includes(path)) continue;
  const old = migration.get(path);
  const metadata = priorByPath.get(path) ?? priorByPath.get(old?.source.replace(/^materials\//, '')) ?? {};
  const info = await stat(join(library, path));
  const sourceReadme = path.endsWith('/README.md') && path.includes('/source/');
  const level = sourceReadme ? '目录索引' : path.includes('/source/') ? '原始输入' : path.includes('/derived/') ? '二级材料' : '目录索引';
  const defaultUsage = path.includes('/derived/audits/') ? '来源与审计支撑' : path.includes('/source/') ? '原始输入' : '说明与索引';
  const missionStory = /^(videos\/derived\/web\/engineer-mission[^/]*|images\/derived\/video-posters\/engineer-mission[^/]*|models\/derived\/rm2025-field\/models\/mission-[^/]*|models\/derived\/web\/mission-transmitter\.(glb|json))$/.test(path);
  const missionUsage = missionStory ? (path.startsWith('models/') ? '制作输入：A章统一场地与返程轨迹' : '网页展示：A章整车行动短片') : null;
  const swerveStory = /^models\/derived\/web\/engineer-swerve-context\.(glb|json)$/.test(path);
  rows.push({ ...metadata, '序号': rows.length + 1, '大类': labels[path.split('/')[0]] ?? '目录说明', '材料层级': level,
    '存放用途': sourceReadme ? '原件目录说明' : old?.usage ?? missionUsage ?? (swerveStory ? '网页展示：舵轮整车高精度背景与装配参数' : defaultUsage), '文件类型': type(path), '文件名': path.split('/').at(-1),
    'materials内相对路径': path, '大小字节': info.size, '大小': size(info.size),
    '修改时间（北京时间）': new Date(info.mtimeMs + 8 * 3600000).toISOString().replace('Z', '+08:00'),
    '整理前路径': old?.source ?? metadata['整理前路径'] ?? '', '分类依据': old?.reason ?? (missionStory ? metadata['分类依据'] ?? '实际CAD派生成片与官方规则场地' : ''),
    '校验SHA256': await digest(join(library, path)) });
}
// Remap links in the previous inventory, preserving its source titles, authors, parts and original paths.
for (const row of rows) for (const key of ['来源记录（仓库相对路径）']) if (row[key]) {
  for (const entry of cleanup.entries) if (entry.destination) row[key] = row[key].replaceAll(entry.source, entry.destination);
}
const headers = ['序号', '大类', '材料层级', '存放用途', '文件类型', '文件名', 'materials内相对路径', '大小字节', '大小', '修改时间（北京时间）', '整理前路径', '分类依据', '原迁移路径', '来源链接（公开网页）', '来源记录（仓库相对路径）', '视频标题', '作者', 'BVID', '分P', '时长秒', '画面分辨率', '已有SHA256（来源记录值）', '校验SHA256'];
const escape = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
await writeFile(join(library, 'inventory.csv'), '\uFEFF' + [headers, ...rows.map(row => headers.map(h => row[h]))].map(row => row.map(escape).join(',')).join('\r\n') + '\r\n');
const total = rows.reduce((n, row) => n + row['大小字节'], 0);
const now = new Date(Date.now() + 8 * 3600000).toISOString().replace('Z', '+08:00');
const lines = ['# 素材总清单', '', `生成时间：${now}（北京时间）。`, '',
  `本地 materials/ 共 **${rows.length.toLocaleString('en-US')} 个文件，${size(total)}**。包含 Git 忽略的本地素材；本清单和 inventory.csv 不计入统计。每个文件均重新计算 SHA-256。`, '',
  '原始输入与二级材料的定义、使用方式见 [README.md](README.md)。完整文件、层级、分类依据、来源和校验值见 [inventory.csv](inventory.csv)。', '',
  '## 按层级和类型查找', '', '| 层级 | 类型 | 文件数 | 大小 | 目录 |', '| --- | --- | ---: | ---: | --- |'];
for (const level of ['source', 'derived']) for (const category of Object.keys(labels)) {
  const group = rows.filter(r => r['materials内相对路径'].startsWith(`${category}/${level}/`) && r['材料层级'] !== '目录索引');
  if (!group.length) continue;
  lines.push(`| ${level === 'source' ? '原始输入' : '二级材料'} | ${labels[category]} | ${group.length} | ${size(group.reduce((n,r) => n + r['大小字节'], 0))} | [${category}/${level}/](${category}/${level}/) |`);
}
lines.push('', '## 当前展示与处理输入', '', '| 使用情况 | 文件数 | 大小 |', '| --- | ---: | ---: |');
for (const usage of [...new Set(rows.map(r => r['存放用途']))].sort()) {
  const group = rows.filter(r => r['存放用途'] === usage);
  lines.push(`| ${usage} | ${group.length} | ${size(group.reduce((n,r) => n + r['大小字节'], 0))} |`);
}
lines.push('', '## 当前模型与视频', '', '| 文件 | 用途 | 大小 |', '| --- | --- | ---: |');
for (const row of rows.filter(r => /^(models|videos)\/derived\/web\/.*\.(glb|mp4|json)$/.test(r['materials内相对路径']))) {
  lines.push(`| [${row['文件名']}](${row['materials内相对路径']}) | ${row['存放用途']} | ${row['大小']} |`);
}
const deleted = cleanup.entries.filter(e => !e.destination);
lines.push('', '## 历史素材清理记录', '', `既有记录包含 **${deleted.length} 个未使用的二级文件，${size(deleted.reduce((n,e) => n + e.bytes, 0))}**。历史文件已送入 Windows 回收站；逐项旧路径、大小、SHA-256、删除原因和保留材料的新路径见 [cleanup.json](cleanup.json)。本清单生成只刷新索引与校验值。`, '',
  '原片目录 [videos/source/bilibili/](videos/source/bilibili/) 及来源索引 [documents/derived/bilibili-video-catalog.md](documents/derived/bilibili-video-catalog.md) 均保留。', '',
  'CAD 原件在外部只读目录，入口见 [models/source/README.md](models/source/README.md)。模型导出、PNG 截图、URDF 等归二级材料；本地仅保留当前展示、复现和溯源所需的加工文件。', '',
  '刷新本清单：`npm run materials:inventory`。历史网页发布包由 publish/ 单独管理。', '');
await writeFile(join(library, 'INVENTORY.md'), lines.join('\n'));
console.log(`Material inventory: ${rows.length} files, ${size(total)}; historical cleanup records: ${deleted.length} items.`);
