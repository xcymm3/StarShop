"""Package unaltered screenshots and public observations from the v0.5 review."""
import hashlib
import html
import json
import pathlib
import re
import shutil
import subprocess

root = pathlib.Path(__file__).resolve().parents[1]
raw = root / 'artifacts/mobile-review-v05'
out = root / 'docs/reviews/mobile-v05'
report = root / 'docs/手机试玩视觉评审-2026-11-14.md'
out.mkdir(parents=True, exist_ok=True)
names = sorted(set(re.findall(r'reviews/mobile-v05/([^()\s]+\.png)', report.read_text('utf-8'))))
records = [json.loads(line) for line in (raw / 'actions.jsonl').read_text('utf-8').splitlines()]
trades = []
for row in records:
    before, after = row['before'], row.get('after', {})
    if after.get('trades', 0) > before['trades']:
        trades.append(dict(day=before['day'], trade=after['trades'], operation=row['command'],
                           cash_before=before['cash'], cash_after=after['cash'],
                           visitor=before['visitor']['id']))
assert [t['trade'] for t in trades] == list(range(1, 36))
final = json.loads((raw / '055-completed-reloaded.json').read_text('utf-8'))['state']
assert (final['day'], final['cash'], final['debt']) == (8, 1109, 0)
assert final['bills'] == [dict(day=7, amount=120, paid=120, deferred=False)]
samples = []
cards = []
for name in names:
    image = raw / name
    shutil.copyfile(image, out / name)
    data = json.loads(image.with_suffix('.json').read_text('utf-8'))
    m, s = data['metrics'], data['state']
    samples.append(dict(file=name, sha256=hashlib.sha256(image.read_bytes()).hexdigest(),
                        day=s['day'], trades=s['trades'], cash=s['cash'], metrics=m))
    v = m['viewport']
    label = f"{name} · {v['width']}×{v['height']} · 第{s['day']}天 · {s['trades']}笔 · {s['cash']}星币"
    cards.append(f'<figure><figcaption>{html.escape(label)}</figcaption>'
                 f'<a href="{name}"><img src="{name}" loading="lazy" alt="{html.escape(label)}"></a></figure>')
summary = dict(source_commit=subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
               demo_sha256=hashlib.sha256((root / 'release/StarShop-demo.html').read_bytes()).hexdigest(),
               action_log_sha256=hashlib.sha256((raw / 'actions.jsonl').read_bytes()).hexdigest(),
               action_records=len(records), failed_commands=[r['failed'] for r in records if 'failed' in r],
               original_screenshots=len(list(raw.glob('*.png'))), selected_screenshots=len(samples),
               visited_customers=len({r['before']['visitor']['id'] for r in records if r['before']['visitor']}),
               page_errors=final['errors'], limitations=['Headless Chromium, not WeChat real device',
               'tap locators may auto-scroll', 'no human finger accuracy or phone performance measurement'],
               samples=samples)
for name, data in [('transactions.json', trades), ('completed-state.json', final), ('summary.json', summary)]:
    (out / name).write_text(json.dumps(data, ensure_ascii=False, indent=2), 'utf-8')
(out / 'index.html').write_text('''<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>StarShop v0.5 实玩证据册</title>
<style>body{margin:0;padding:24px;background:#1d1b25;color:#ede4c6;font:16px/1.6 system-ui,sans-serif}
header{max-width:900px;margin:auto auto 24px}a{color:#a4cebe}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:24px;align-items:start}
figure{margin:0;padding:12px;border:1px solid #789c99;background:#292532}figcaption{overflow-wrap:anywhere;margin-bottom:12px}
img{display:block;max-width:100%;height:auto;margin:auto;image-rendering:pixelated}</style>
<header><h1>首周实玩与手机视觉证据</h1><p>35笔交易，支付120房租，第八天1109星币、零欠租，刷新保持。当前Demo没有最终结局。
保留原始截图，点击可看原尺寸；本页适配仅为阅读报告，不代表游戏适配已修复。</p>
<p><a href="../../手机试玩视觉评审-2026-11-14.md">完整32项评审</a> · <a href="transactions.json">交易记录</a> · <a href="summary.json">测量与覆盖</a> · <a href="completed-state.json">最终状态</a></p></header><main>'''
    + '\n'.join(cards) + '</main></html>', 'utf-8')
print(json.dumps(dict(screenshots=len(samples), transactions=len(trades), actions=len(records),
                     source=summary['source_commit']), ensure_ascii=False))
