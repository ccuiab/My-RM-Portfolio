"""Download the official RMUC 2025 V2.0.0 field STEP without changing its bytes.

Run from the repository root. Interrupted transfers keep a validated range ledger.
The .download file is preallocated: its size alone never indicates completion.
"""

import argparse
import concurrent.futures
import datetime
import hashlib
import json
import threading
import time
import urllib.parse
import urllib.request
from pathlib import Path


NAME = 'RMUC 2025复活赛&全国赛_asm.stp'
KEY = '7ca50e5ad5014c9c8067f559097f66981750837527528/' + NAME
ORIGIN = 'https://hz-rm-bbs-web-prod.oss-cn-hangzhou.aliyuncs.com/' + KEY
CDN = 'https://bbs-web-static.robomaster.com/' + KEY
EXPECTED_BYTES = 276996994
EXPECTED_ETAG = '"A12452326025AAE96594B049BDA2F23F-265"'


def encoded(url):
    return urllib.parse.quote(url, safe=':/&')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workers', type=int, default=12)
    parser.add_argument('--timeout', type=float, default=15)
    args = parser.parse_args()
    if not 1 <= args.workers <= 16:
        parser.error('--workers must be between 1 and 16')

    root = Path.cwd() / 'materials/models/source/robomaster/2025'
    root.mkdir(parents=True, exist_ok=True)
    target = root / NAME
    partial = root / (NAME + '.download')
    state_path = root / (NAME + '.download-state.json')
    meta_path = root / (NAME + '.metadata.json')
    if target.exists():
        if not meta_path.exists():
            raise RuntimeError('Preserving existing STEP without provenance metadata')
        meta = json.loads(meta_path.read_text(encoding='utf-8'))
        actual_hash = hashlib.file_digest(target.open('rb'), 'sha256').hexdigest()
        if target.stat().st_size != EXPECTED_BYTES or actual_hash != meta['sha256']:
            raise RuntimeError('Existing STEP differs from its provenance metadata')
        print(json.dumps({'path': str(target), 'sha256': actual_hash, 'alreadyComplete': True}))
        return

    mirrors = []
    remote_headers = {}
    for url in (CDN, ORIGIN):
        try:
            with urllib.request.urlopen(
                urllib.request.Request(encoded(url), method='HEAD'), timeout=args.timeout
            ) as response:
                headers = dict(response.headers)
            if int(headers['Content-Length']) != EXPECTED_BYTES or headers['ETag'] != EXPECTED_ETAG:
                raise RuntimeError('Official object identity changed; inspect before proceeding')
            mirrors.append(url)
            remote_headers[url] = headers
        except OSError as error:
            print(f'HEAD unavailable: {url}: {error}', flush=True)
    if not mirrors:
        raise RuntimeError('Neither official download endpoint is reachable')

    chunk_size = 524288
    total = (EXPECTED_BYTES + chunk_size - 1) // chunk_size
    completed = {}
    recovered = False
    if state_path.exists():
        state = json.loads(state_path.read_text(encoding='utf-8'))
        if (state['etag'], state['bytes'], state['chunkBytes']) != (
            EXPECTED_ETAG, EXPECTED_BYTES, chunk_size
        ):
            raise RuntimeError('Preserving incompatible download checkpoint')
        completed = state['completed']
    if not partial.exists():
        with partial.open('xb') as output:
            output.truncate(EXPECTED_BYTES)
    if partial.stat().st_size != EXPECTED_BYTES:
        raise RuntimeError('Preserving partial file of unexpected size')

    # The initial in-session transfer predates the range ledger. STEP is text and
    # contains no NUL bytes; preallocated regions are NUL-filled. Recover only
    # whole text blocks, then bind their SHA-256 values to the current object ETag.
    with partial.open('rb') as source:
        for index in range(total):
            data = source.read(min(chunk_size, EXPECTED_BYTES - index * chunk_size))
            key = str(index)
            digest = hashlib.sha256(data).hexdigest()
            if key in completed:
                if digest != completed[key]:
                    completed.pop(key)
            elif not state_path.exists() and b'\0' not in data:
                completed[key] = digest
                recovered = True

    lock = threading.Lock()
    start_time = time.monotonic()
    used_urls = set()

    def save_state():
        state = {'etag': EXPECTED_ETAG, 'bytes': EXPECTED_BYTES,
                 'chunkBytes': chunk_size, 'completed': completed}
        temporary = state_path.with_suffix('.json.tmp')
        temporary.write_text(json.dumps(state, indent=2), encoding='utf-8')
        temporary.replace(state_path)

    save_state()
    print(f'Resuming {len(completed)}/{total} validated ranges', flush=True)

    def fetch(index):
        if str(index) in completed:
            return
        start = index * chunk_size
        end = min(EXPECTED_BYTES - 1, start + chunk_size - 1)
        for attempt in range(6):
            url = mirrors[attempt % len(mirrors)]
            try:
                request = urllib.request.Request(encoded(url), headers={
                    'Range': f'bytes={start}-{end}', 'If-Match': EXPECTED_ETAG
                })
                with urllib.request.urlopen(request, timeout=args.timeout) as response:
                    if response.status != 206:
                        raise RuntimeError('Server did not return a partial response')
                    if response.headers.get('Content-Range') != f'bytes {start}-{end}/{EXPECTED_BYTES}':
                        raise RuntimeError('Unexpected Content-Range')
                    if response.headers.get('ETag') != EXPECTED_ETAG:
                        raise RuntimeError('Download object ETag changed')
                    data = response.read()
                if len(data) != end - start + 1 or b'\0' in data:
                    raise RuntimeError('Incomplete or non-text STEP range')
                with lock:
                    with partial.open('r+b') as output:
                        output.seek(start)
                        output.write(data)
                    completed[str(index)] = hashlib.sha256(data).hexdigest()
                    used_urls.add(url)
                    save_state()
                    count = len(completed)
                    if count % 20 == 0 or count == total:
                        print(f'{count}/{total} ranges, {time.monotonic() - start_time:.1f} s', flush=True)
                return
            except (OSError, RuntimeError):
                if attempt == 5:
                    raise

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        list(pool.map(fetch, range(total)))
    if len(completed) != total:
        raise RuntimeError('Download range ledger is incomplete')
    with partial.open('rb') as source:
        if source.read(13) != b'ISO-10303-21;':
            raise RuntimeError('Not a STEP file')
        source.seek(-128, 2)
        if b'END-ISO-10303-21;' not in source.read():
            raise RuntimeError('Missing STEP footer')
        source.seek(0)
        sha256 = hashlib.file_digest(source, 'sha256').hexdigest()
    partial.rename(target)
    headers = next(iter(remote_headers.values()))
    metadata = {
        'sourcePage': 'https://bbs.robomaster.com/article/372035?source=1',
        'publisher': 'RoboMaster 高校赛务',
        'title': 'RMU 2025场地图纸&装甲贴纸开源',
        'attachmentId': 112413, 'name': NAME, 'url': ORIGIN,
        'encodedUrl': encoded(ORIGIN), 'officialMirrorUrls': mirrors,
        'transferUrls': sorted(used_urls), 'ruleVersion': 'RMUC 2025 V2.0.0',
        'publishedDate': '2025-06-25',
        'downloadedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'bytes': EXPECTED_BYTES, 'sha256': sha256,
        'httpLastModified': headers.get('Last-Modified'), 'httpETag': EXPECTED_ETAG,
        'httpCRC64ECMA': headers.get('x-oss-hash-crc64ecma'),
        'anonymousDownload': True, 'originalBytes': True,
        'transferMethod': 'Validated HTTP byte ranges reassembled in original order',
        'recoveredInitialInSessionRanges': recovered,
        'officialCaveat': '仅做参考使用；若模型与规则手册标注或比赛现场场地有结构出入，以规则手册和现场场地为准。',
    }
    with meta_path.open('x', encoding='utf-8') as output:
        json.dump(metadata, output, ensure_ascii=False, indent=2)
    print(json.dumps({'path': str(target), 'metadata': str(meta_path),
                      'bytes': EXPECTED_BYTES, 'sha256': sha256}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
