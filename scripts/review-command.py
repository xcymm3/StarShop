"""Send explicit review gestures to the isolated headless session; no play policy."""
import json
import os
import pathlib
import sys
import urllib.request

root = pathlib.Path(os.environ.get('STARSHOP_REVIEW_DIR', 'artifacts/mobile-review-v05'))
base = json.loads((root / 'session.json').read_text('utf-8'))['base']
commands = json.loads(sys.stdin.read())
request = urllib.request.Request(base + '/review-control', data=json.dumps(commands).encode(), headers={'Content-Type': 'application/json'})
result = json.loads(urllib.request.urlopen(request, timeout=90).read())
(root / 'latest-observation.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), 'utf-8')
s = result.get('state', {})
v = s.get('visitor')
summary = {k: s.get(k) for k in ['day', 'progress', 'cash', 'trades', 'debt', 'report', 'notice', 'total', 'visible', 'scrollY', 'errors']}
summary['inventory'] = [[i[k] for k in ['uid', 'name', 'cat', 'area', 'x', 'y', 'cost', 'offer', 'estimate']] for i in s.get('inventory', [])]
summary['visitor'] = v and {k: v[k] for k in ['id', 'name', 'kind', 'category', 'budget', 'remaining', 'variety', 'minimumQuality', 'acceptsDamaged', 'stock']}
summary['quote'] = s.get('quote')
print(json.dumps({'results': result.get('results'), 'state': summary}, ensure_ascii=False))
