from pathlib import Path
from PIL import Image
import json,hashlib
R=Path(__file__).resolve().parents[1]
rows=json.loads((R/'docs/素材清单.json').read_text('utf-8'))
assert len(rows)==31 and len({r['id'] for r in rows})==31
for r in rows:
    path=R/'src/assets'/r['runtime'];im=Image.open(path).convert('RGBA')
    assert list(im.size)==r['runtime_size'],r['id']
    assert r['status']=='installed',r['id']
    assert hashlib.sha256(path.read_bytes()).hexdigest()==r['runtime_sha256'],r['id']
    assert r['runtime_sha256']!=r['source_sha256'],r['id']
    assert im.getchannel('A').getextrema()[1]>=128,r['id']
    if r['id']!='counter':assert im.getchannel('A').getextrema()[0]==0,r['id']
print(f'PASS: {len(rows)} original images, expected dimensions, alpha, hashes, no identical Unity source files; {sum(r["runtime_bytes"] for r in rows):,} bytes')
