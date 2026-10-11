"""Archive public video/collection metadata without account credentials."""
import argparse
import json
import time
from pathlib import Path
import yt_dlp

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'materials/documents/audits/bilibili'
parser = argparse.ArgumentParser()
parser.add_argument('bvid', nargs='+')
args = parser.parse_args()
OUT.mkdir(parents=True, exist_ok=True)
catalog = OUT / 'page-catalog.json'
state = json.loads(catalog.read_text(encoding='utf-8')) if catalog.exists() else {'videos': {}, 'collections': {}, 'failures': {}}

def add(video):
    owner = video.get('owner', {})
    if not isinstance(owner, dict):
        owner = {}
    old = state['videos'].get(video['bvid'], {})
    state['videos'][video['bvid']] = {
        'bvid': video['bvid'], 'title': video['title'],
        'uploader': owner.get('name') or old.get('uploader'), 'mid': owner.get('mid') or old.get('mid'),
        'description': video.get('desc') or old.get('description', ''), 'pubdate': video.get('pubdate') or old.get('pubdate'),
        'duration': video.get('duration') or old.get('duration'), 'pages': video.get('pages') or old.get('pages', []),
        'url': 'https://www.bilibili.com/video/' + video['bvid'] + '/',
    }

with yt_dlp.YoutubeDL({'quiet': True, 'socket_timeout': 30}) as ydl:
    for bvid in args.bvid:
        try:
            raw = ydl.urlopen('https://www.bilibili.com/video/' + bvid + '/').read().decode('utf-8')
            data = json.JSONDecoder().raw_decode(raw.split('window.__INITIAL_STATE__=', 1)[1])[0]['videoData']
            (OUT / (bvid + '.page.json')).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
            add(data)
            season = data.get('ugc_season', {})
            if season:
                state['collections'][str(season['id'])] = season
            for section in season.get('sections', []):
                for episode in section.get('episodes', []):
                    add({**episode.get('arc', {}), 'bvid': episode['bvid'], 'title': episode['title']})
            state['failures'].pop(bvid, None)
            print(f"Read {bvid}: {data['title']}; {len(state['videos'])} candidates", flush=True)
        except Exception as error:
            state['failures'][bvid] = str(error)
            print(f'Unavailable {bvid}: {error}', flush=True)
        state['queriedAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        catalog.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding='utf-8')
        time.sleep(1)
