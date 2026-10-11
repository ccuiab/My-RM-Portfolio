"""Resumable downloads of the reviewed plan, with duration and SHA256 verification."""
import argparse
import concurrent.futures
import hashlib
import json
import math
import re
import subprocess
import threading
import time
import urllib.request
from pathlib import Path
import yt_dlp
from yt_dlp.extractor.bilibili import BilibiliBaseIE
from yt_dlp.networking import Request

ROOT = Path(__file__).resolve().parents[1]
AUDITS = ROOT / 'materials/documents/audits/bilibili'
VIDEOS = ROOT / 'materials/videos/source/bilibili'
COVERS = ROOT / 'materials/images/archive/bilibili/covers'
parser = argparse.ArgumentParser()
parser.add_argument('--group')
parser.add_argument('--jobs', type=int, default=2)
parser.add_argument('--segments', type=int, default=8)
parser.add_argument('--plan', type=Path)
parser.add_argument('--state', type=Path, default=AUDITS / 'downloads.json')
parser.add_argument('--ffmpeg', type=Path, default=Path('C:/ffmpeg/bin/ffmpeg.exe'))
args = parser.parse_args()
if args.jobs < 1 or args.segments < 1:
    parser.error('--jobs 和 --segments 必须是正整数')
FFMPEG = args.ffmpeg.resolve()
FFPROBE = FFMPEG.with_name('ffprobe.exe')
if not FFMPEG.is_file() or not FFPROBE.is_file():
    parser.error('找不到 ffmpeg / ffprobe，请用 --ffmpeg 指定 ffmpeg.exe')
plan_path = args.plan or AUDITS / 'download-plan.json'
if not plan_path.exists():
    plan_path = ROOT / 'materials/documents/bilibili-video-catalog.json'
plan = json.loads(plan_path.read_text(encoding='utf-8'))
tasks = [t for t in plan['videos'] if not args.group or t['group'] == args.group]
for task in tasks:
    if not re.fullmatch(r'BV1[0-9A-Za-z]{9}', task['bvid']):
        parser.error('清单含无效 BVID')
    if not re.fullmatch(r'[a-z0-9-]+', task['group']) or task.get('page', 1) < 1:
        parser.error('清单含无效分组或分 P')
lock = threading.Lock()
clients = threading.local()
state_path = args.state.resolve()
state_path.parent.mkdir(parents=True, exist_ok=True)
state = json.loads(state_path.read_text(encoding='utf-8')) if state_path.exists() else {'videos': {}}
original_extract = BilibiliBaseIE.extract_formats

def formats_with_backups(self, data):
    formats = original_extract(self, data)
    streams = [*data.get('dash', {}).get('video', []), *data.get('dash', {}).get('audio', [])]
    for fmt in formats:
        for stream in streams:
            if fmt['url'] == stream.get('baseUrl', stream.get('base_url')):
                fmt['backup_urls'] = stream.get('backupUrl', stream.get('backup_url', []))
    return formats
BilibiliBaseIE.extract_formats = formats_with_backups

def save(key, record):
    with lock:
        state['videos'][key] = record
        state['updatedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        temp = state_path.with_suffix('.tmp')
        temp.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding='utf-8')
        temp.replace(state_path)

def probe(path):
    raw = subprocess.check_output([str(FFPROBE), '-v', 'error', '-show_entries', 'format=duration,size:stream=codec_name,width,height', '-of', 'json', str(path)])
    return json.loads(raw)

def safe_name(value):
    return re.sub(r'[<>:"/\\|?*\x00-\x1f]', '-', value)[:90].rstrip(' .')

def request(url, headers, start, end):
    if not hasattr(clients, 'downloader'):
        clients.downloader = yt_dlp.YoutubeDL({'quiet': True, 'socket_timeout': 15})
    req = Request(url, headers={**headers, 'Range': f'bytes={start}-{end}'})
    with clients.downloader.urlopen(req) as response:
        if response.status != 206:
            raise RuntimeError('Server did not honor a byte range')
        data = response.read(end-start+2)
        return data, response.headers.get('Content-Range', '')

def stream_download(fmt, work, headers, key):
    urls = list(dict.fromkeys([fmt['url'], *fmt.get('backup_urls', [])]))
    last = None
    for url in urls:
        try:
            first, content_range = request(url, headers, 0, 0)
            total = int(content_range.rsplit('/', 1)[1])
            break
        except Exception as error:
            last = error
    else:
        raise RuntimeError(f'No available CDN for {key}: {type(last).__name__}')
    fmt_id = safe_name(fmt['format_id'])
    chunks = work / fmt_id
    chunks.mkdir(parents=True, exist_ok=True)
    chunk_size = 1024*1024
    count = math.ceil(total / chunk_size)
    progress = {'bytes': 0, 'reported': time.monotonic()}
    progress_lock = threading.Lock()
    def chunk(index):
        start = index*chunk_size
        end = min(total-1, start+chunk_size-1)
        path = chunks / f'{index:06d}.part'
        expected = end-start+1
        if not path.exists() or path.stat().st_size != expected:
            for attempt in range(6):
                try:
                    data, content_range = request(urls[attempt % len(urls)], headers, start, end)
                    if len(data) != expected or not content_range.startswith(f'bytes {start}-{end}/'):
                        raise RuntimeError('Incomplete byte range')
                    temp = path.with_suffix('.tmp')
                    temp.write_bytes(data)
                    temp.replace(path)
                    break
                except Exception as error:
                    if attempt == 5:
                        raise RuntimeError(f'Failed byte range {index}: {type(error).__name__}') from error
                    time.sleep(min(3, attempt+1))
        with progress_lock:
            progress['bytes'] += expected
            if time.monotonic()-progress['reported'] >= 30:
                print(f"{key} {fmt_id}: {progress['bytes']/total:.0%} ({progress['bytes']/1024**2:.1f}/{total/1024**2:.1f} MiB)", flush=True)
                progress['reported'] = time.monotonic()
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.segments) as pool:
        for _ in pool.map(chunk, range(count)):
            pass
    assembled = work / (fmt_id + '.mp4')
    with assembled.open('wb') as output:
        for index in range(count):
            output.write((chunks / f'{index:06d}.part').read_bytes())
    assert assembled.stat().st_size == total
    return assembled

def download(task):
    bvid, page = task['bvid'], task.get('page', 1)
    key = f'{bvid}-P{page:02d}'
    old = state['videos'].get(key, {})
    if old.get('status') == 'complete' and (ROOT / old['file']).exists():
        print('Already verified ' + key, flush=True)
        return True
    try:
        output_dir = VIDEOS / task['group']
        output_dir.mkdir(parents=True, exist_ok=True)
        url = f'https://www.bilibili.com/video/{bvid}/?p={page}'
        print('Starting ' + key + ' ' + task['title'], flush=True)
        with yt_dlp.YoutubeDL({'quiet': True, 'no_warnings': True, 'noplaylist': True, 'socket_timeout': 20, 'format': 'bestvideo+bestaudio/best'}) as ydl:
            info = ydl.extract_info(url, download=False)
        (AUDITS / 'metadata').mkdir(parents=True, exist_ok=True)
        (AUDITS / 'metadata' / (key + '.info.json')).write_text(json.dumps(info, ensure_ascii=False, indent=2), encoding='utf-8')
        name = key + ' - ' + safe_name(task['title']) + '.mp4'
        destination = output_dir / name
        work = VIDEOS / '.download-parts' / key
        work.mkdir(parents=True, exist_ok=True)
        save(key, {**task, 'status': 'downloading', 'file': destination.relative_to(ROOT).as_posix(), 'url': url})
        headers = {**info.get('http_headers', {}), 'Referer': 'https://www.bilibili.com/'}
        inputs = [stream_download(f, work, headers, key) for f in info.get('requested_formats', [info])]
        command = [str(FFMPEG), '-hide_banner', '-loglevel', 'error', '-y']
        for path in inputs:
            command += ['-i', str(path)]
        if len(inputs) == 2:
            command += ['-map', '0:v:0', '-map', '1:a:0']
        command += ['-c', 'copy', '-movflags', '+faststart', str(work / 'merged.mp4')]
        subprocess.run(command, check=True)
        verification = probe(work / 'merged.mp4')
        duration = float(verification['format']['duration'])
        expected_duration = info.get('duration')
        if expected_duration and abs(duration-expected_duration) > 3:
            raise RuntimeError(f'Duration mismatch: {duration} vs {expected_duration}')
        (work / 'merged.mp4').replace(destination)
        with destination.open('rb') as source:
            sha = hashlib.file_digest(source, 'sha256').hexdigest()
        COVERS.mkdir(parents=True, exist_ok=True)
        try:
            urllib.request.urlretrieve(info['thumbnail'], COVERS / (key + '.jpg'))
        except Exception:
            pass
        record = {**task, 'status': 'complete', 'url': url, 'file': destination.relative_to(ROOT).as_posix(), 'bytes': destination.stat().st_size, 'sha256': sha, 'duration': duration, 'streams': verification['streams'], 'uploader': info.get('uploader'), 'completedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
        save(key, record)
        # Only successful task intermediates under this fixed material subdirectory are removed.
        import shutil
        assert work.resolve().parent == (VIDEOS / '.download-parts').resolve()
        shutil.rmtree(work)
        print(f'Complete {key}: {destination.stat().st_size/1024**2:.1f} MiB, {duration:.1f}s, SHA256 verified', flush=True)
        return True
    except Exception as error:
        save(key, {**task, 'status': 'failed', 'error': str(error)})
        print(f'Failed {key}: {error}', flush=True)
        return False

with concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs) as pool:
    results = list(pool.map(download, tasks))
print(f'Finished {sum(results)}/{len(results)} planned videos.', flush=True)
raise SystemExit(0 if all(results) else 1)
