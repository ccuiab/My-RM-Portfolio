"""Verify local downloads and publish a credential-free Chinese material index."""
import hashlib
import json
import subprocess
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
AUDITS = ROOT / 'materials/documents/audits/bilibili'
DOCUMENTS = ROOT / 'materials/documents'
VIDEOS = ROOT / 'materials/videos/source/bilibili'
FFPROBE = Path('C:/ffmpeg/bin/ffprobe.exe')
plan_path = AUDITS / 'download-plan.json'
if not plan_path.exists():
    plan_path = DOCUMENTS / 'bilibili-video-catalog.json'
plan = json.loads(plan_path.read_text(encoding='utf-8'))
state_path = AUDITS / 'downloads.json'
state = json.loads(state_path.read_text(encoding='utf-8'))
clips_state = AUDITS / 'clips-downloads.json'
if clips_state.exists():
    supplement = json.loads(clips_state.read_text(encoding='utf-8'))
    state['videos'].update(supplement['videos'])
page_path = AUDITS / 'page-catalog.json'
pages = json.loads(page_path.read_text(encoding='utf-8'))['videos'] if page_path.exists() else {}
now = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')

def probe(path):
    return json.loads(subprocess.check_output([
        str(FFPROBE), '-v', 'error', '-show_entries',
        'format=duration,size:stream=codec_type,codec_name,width,height', '-of', 'json', str(path),
    ]))

def digest(path):
    with path.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()

target = next(t for t in plan['videos'] if t['bvid'] == 'BV1MV8nzFEcb')
target_key = 'BV1MV8nzFEcb-P01'
if target_key not in state['videos']:
    path = VIDEOS / 'robot-demo/BV1MV8nzFEcb - 复活赛寄了，可以发了.mp4'
    result = probe(path)
    state['videos'][target_key] = {
        **target, 'status': 'complete', 'url': 'https://www.bilibili.com/video/BV1MV8nzFEcb/',
        'file': path.relative_to(ROOT).as_posix(), 'bytes': path.stat().st_size,
        'sha256': digest(path), 'duration': float(result['format']['duration']),
        'streams': result['streams'], 'uploader': 'star_Light星',
    }

records = []
for task in plan['videos']:
    key = f"{task['bvid']}-P{task.get('page', 1):02d}"
    record = state['videos'].get(key, {})
    if record.get('status') != 'complete':
        raise RuntimeError(f'Not completed: {key}')
    path = ROOT / record['file']
    if not path.resolve().is_relative_to(VIDEOS.resolve()):
        raise RuntimeError(f'Unexpected material path: {key}')
    if path.stat().st_size != record['bytes'] or digest(path) != record['sha256']:
        raise RuntimeError(f'File checksum mismatch: {key}')
    result = probe(path)
    if abs(float(result['format']['duration']) - record['duration']) > 0.1:
        raise RuntimeError(f'Duration mismatch: {key}')
    if not any(s['codec_type'] == 'video' for s in result['streams']):
        raise RuntimeError(f'Missing video stream: {key}')
    if not any(s['codec_type'] == 'audio' for s in result['streams']):
        raise RuntimeError(f'Missing audio stream: {key}')
    record = {**record, **task, 'streams': result['streams']}
    page = pages.get(task['bvid'], {})
    record['uploader'] = page.get('uploader') or record.get('uploader')
    record['uploaderId'] = page.get('mid') or record.get('uploaderId')
    source_part = next((p for p in page.get('pages', []) if p['page'] == task['page']), None)
    if source_part:
        if abs(record['duration'] - source_part['duration']) > 3:
            raise RuntimeError(f'Published part duration mismatch: {key}')
        record['sourcePart'] = source_part['part']
        record['sourceDurationSeconds'] = source_part['duration']
    if page.get('pubdate'):
        record['publishedAt'] = datetime.fromtimestamp(page['pubdate'], timezone.utc).isoformat()
    if task['group'] == 'engineer-pov':
        part_name = task['title'].rsplit(' - ', 1)[-1]
        if part_name.startswith('main_'):
            record['viewLabel'] = '比赛主画面'
        elif part_name.startswith('ControlRoom_'):
            record['viewLabel'] = '监控室视角'
        elif part_name.startswith('OtherArea_'):
            record['viewLabel'] = '场外固定机位'
        else:
            record['viewLabel'] = '港科大工程第一视角'
    if task['bvid'] == 'BV1YFhLz4Evi':
        if task['page'] == 3:
            record['viewLabel'] = '对手蓝方工程；同场对照素材'
        elif task['page'] == 10:
            record['viewLabel'] = '红方创新者工程；港科大工程视角'
    records.append(record)
    print(f'Verified {key}', flush=True)

# Run this after the downloader finishes: both commands write the local audit.
state['videos'] = {f"{r['bvid']}-P{r['page']:02d}": r for r in records}
state['updatedAt'] = now
state_path.write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
catalog = {
    'scope': plan['scope'], 'verifiedAt': now,
    'coverage': '官方赛事与公开投稿合集内已找到并核实的 2025 工程相关素材；分 P 各自保存。',
    'excluded': ['2024 英雄赛季', '不含工程机器人的 3v3 联盟赛', '2026 赛季', '无关兵种第一视角'],
    'downloadQuality': '保留公开可用的最佳音视频流，合并为 MP4；具体编码、分辨率、时长与 SHA256 逐文件记录。',
    'identification': {
        'allStarEngineer': '香港科技大学 ENTERPRIZE 工程属于创新者 INNOVATOR；全明星工程视角为 R2。',
        'evidence': 'materials/images/site/eng-allstar.webp：官方全明星工程卡片标有 INNOVATOR。',
    },
    'sources': [
        {'name': 'RoboMaster 机甲大师官方', 'url': 'https://space.bilibili.com/20554233/'},
        {'name': '翔林魔主 / xianglinmozhu', 'url': 'https://space.bilibili.com/1568334988/'},
        {'name': 'star_Light星', 'url': 'https://space.bilibili.com/319349289/'},
        {'name': '花师小哲-中二', 'url': 'https://space.bilibili.com/259430549/'},
    ],
    'summary': {'posts': len({r['bvid'] for r in records}), 'files': len(records), 'bytes': sum(r['bytes'] for r in records), 'groups': dict(Counter(r['group'] for r in records))},
    'videos': records,
}
(DOCUMENTS / 'bilibili-video-catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
names = {
    'robot-demo': '实车演示与上台阶', 'official-matches': '官方复活赛完整录像',
    'all-star': '全明星比赛、入场与颁奖', 'engineer-pov': '工程、主画面、监控室与场外视角',
    'highlights': '官方精彩回顾', 'clips': '全明星工程剪辑与花絮',
}
lines = [
    '# 2025 工程赛季 Bilibili 视频索引', '',
    f"已保存 {catalog['summary']['posts']} 条投稿中的 {len(records)} 个 MP4（分 P 单独保存），共 {catalog['summary']['bytes']/1024**3:.2f} GiB。核验时间：{now}。", '',
    '视频总目录：`materials/videos/source/bilibili/`。不同类型分别存放；完整源视频保留，分 P 单独归档。', '',
    '《复活赛寄了，可以发了》已抽帧核验，确认包含这台工程机器人上台阶的实车演示。', '',
    '范围仅为 2025 工程赛季。官方三场复活赛与全明星比赛均保留完整录像；翔林魔主投稿保留主画面、港科大工程、监控室及场外分 P。全明星的蓝方工程视角属于对手，对照素材已注明。', '',
    '公开来源：' + '、'.join(f"[{s['name']}]({s['url']})" for s in catalog['sources']) + '。', '',
    '清单覆盖公开页面与合集内已找到并核实的相关条目。没有把未公开、已删除或需要额外账号权限的内容计入完成数量。', '',
]
for group, label in names.items():
    subset = [r for r in records if r['group'] == group]
    if not subset:
        continue
    lines += [f'## {label}（{len(subset)} 个）', '', '| 视频与来源 | 时长 | 分辨率 | 本地文件 |', '| --- | --- | --- | --- |']
    for record in subset:
        video_stream = next(s for s in record['streams'] if s['codec_type'] == 'video')
        minutes, seconds = divmod(round(record['duration']), 60)
        local_link = quote('../' + record['file'].removeprefix('materials/'), safe='/')
        title = record['title'].replace('|', '｜')
        label = record.get('viewLabel', '')
        if label:
            title += f'（{label}）'
        lines.append(f"| [{title}]({record['url']}) · {record['uploader']} | {minutes:02d}:{seconds:02d} | {video_stream['width']}×{video_stream['height']} | [MP4]({local_link}) |")
    lines.append('')
lines += [
    '## 校验与再次下载', '',
    '机器可读清单 `materials/documents/bilibili-video-catalog.json` 记录原链接、UP 主、分 P、文件大小、音视频编码、时长和 SHA256。', '',
    '本地审计位于 `materials/documents/audits/bilibili/`，封面在 `materials/images/archive/bilibili/covers/`。原始媒体和包含临时下载地址的审计文件不纳入 Git。', '',
    '使用 `.venv/Scripts/python.exe scripts/download-bilibili.py` 可按已审核清单断点续传；默认使用 `C:/ffmpeg/bin/ffmpeg.exe` 合并音视频。原片下载完成后再运行 `scripts/catalog-bilibili.py` 更新校验和索引。', '',
]
(DOCUMENTS / 'bilibili-video-catalog.md').write_text('\n'.join(lines), encoding='utf-8')
(VIDEOS / 'README.md').write_text('# 2025 工程视频素材\n\n完整清单与来源说明见 `materials/documents/bilibili-video-catalog.md`。\n\n' + '\n'.join(f'- `{group}/`：{label}' for group, label in names.items()) + '\n', encoding='utf-8')
print(f"Cataloged {len(records)} videos, {catalog['summary']['bytes']/1024**3:.2f} GiB.")
