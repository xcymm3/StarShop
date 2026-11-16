"""Package v0.6 review evidence without editing screenshots or game saves."""
import hashlib
import html
import json
import pathlib
import shutil

root = pathlib.Path(__file__).resolve().parents[1]
play = root / 'artifacts/mobile-review-v06-verified'
final = root / 'artifacts/mobile-review-v06-final-check'
out = root / 'docs/reviews/mobile-v06'
out.mkdir(parents=True, exist_ok=True)


def sample(folder, name, extension='png'):
    matches = list(folder.glob('*-' + name + '.' + extension))
    assert len(matches) == 1, (folder, name, matches)
    return matches[0]


records = [json.loads(line) for line in (play / 'actions.jsonl').read_text('utf-8').splitlines()]
trades = []
nontrade = []
for row in records:
    assert 'failed' not in row, row
    before, after = row['before'], row['after']
    assert row['command']['op'] in {'tap', 'drag', 'viewport', 'sample', 'scroll', 'insideScroll', 'reload', 'observe', 'stop'}
    if after['day'] != before['day']:
        assert after['day'] == before['day'] + 1 and row['command']['name'].startswith('继续营业')
    delta = after['cash'] - before['cash']
    if after['trades'] > before['trades']:
        old, new = {i['uid']: i for i in before['inventory']}, {i['uid']: i for i in after['inventory']}
        added = [i['name'] for uid, i in new.items() if uid not in old]
        removed = [i['name'] for uid, i in old.items() if uid not in new]
        trades.append(dict(number=after['trades'], day=before['day'], kind='收购' if added else '出售',
                           goods=added or removed, cash_before=before['cash'], cash_after=after['cash'],
                           delta=delta, visitor=before['visitor']['id']))
    elif delta:
        nontrade.append(dict(command=row['command'], delta=delta))
assert [t['number'] for t in trades] == list(range(1, 36))
assert all(sum(t['day'] == day for t in trades) == 5 for day in range(1, 8))
completed = json.loads(sample(play, 'completed-reloaded', 'json').read_text('utf-8'))['state']
resumed = json.loads(sample(final, 'reload-final', 'json').read_text('utf-8'))['state']
for state in [completed, resumed]:
    assert (state['day'], state['trades'], state['cash'], state['debt']) == (8, 35, 1109, 0)
    assert state['bills'] == [dict(day=7, amount=120, paid=120, deferred=False)]
    assert not state['errors']
assert 650 + sum(t['delta'] for t in trades) + sum(e['delta'] for e in nontrade) == 1109

images = []


def copy_image(file, name, title, phase):
    shutil.copyfile(file, out / name)
    images.append(dict(file=name, title=title, phase=phase,
                       sha256=hashlib.sha256(file.read_bytes()).hexdigest()))


copy_image(root / 'artifacts/final-v06-fresh.png', 'main.png', '最终构建：默认新店主界面', 'final')
for name, title in [
    ('main-final', '第八天恢复后的主界面'), ('bottom-320', '320×568：仓位、行号和营业日志不重叠'),
    ('bottom-375', '375×667：完整仓库和保存状态可达'), ('bottom-414', '414×736：短屏底部'),
    ('bottom-768', '768×900：竖屏工作区'), ('warehouse-grid', '最终格子底色与44像素格子'),
    ('warehouse-list', '商品清单与品质筛选'), ('ledger', '已付清账本与日汇总'),
    ('ledger-day7', '第七天收入、支出、毛利与明细'), ('help-320', '手机操作指引'),
    ('help-bottom', '长说明滚动后关闭入口仍可达'), ('showcase', '展示引导规则说明'),
    ('reload-final', '最终构建刷新后仍为35笔、1109星币、零欠租'),
]:
    copy_image(sample(final, name), name + '.png', title, 'final')

for width in [320, 375, 414, 768]:
    copy_image(root / f'artifacts/budget-fixed-{width}.png', f'budget-{width}.png',
               f'最终构建边界夹具：{width}宽预算不足', 'fixture')
for tolerance, title in [('0.8', '还价成功'), ('0.2', '还价被拒绝'), ('0.01', '顾客因还价离开')]:
    copy_image(root / f'artifacts/screenshots-v06/bargain-{tolerance}-320.png', f'bargain-{tolerance}.png',
               '最终构建边界夹具：' + title, 'fixture')

for name, title in [
    ('first-offer', '首客来货和整批报价'), ('purchase-receipt', '首笔收购回执'),
    ('first-touch-sale', '触摸拖货后立即核价出售'), ('refusal-320', '真实收藏家拒收'),
    ('budget-320', '真实经营中两件商品超过预算'), ('day1-report', '第一天日结'),
    ('upgraded', '花费180扩仓，现有货不挪位'), ('level2-day3-report', '第三日结算时解锁二级店铺'),
    ('identified', '花费8星币鉴定后的商品'), ('same-product-comparison', '同名商品的成本与坐标'),
    ('day5-retained-goods', '批发触发日结，留台商品跨日保留'), ('buyer-finished', '买家已买够的明确状态'),
    ('three-item-sale', '真实三件合售，一次确认算一笔'), ('rent-due-375', '第七天房租账单'),
    ('rent-due-320', '320窄屏房租账单'), ('rent-paid', '首周目标达成与租金付清'),
    ('completed-reloaded', '连续35笔交易完成后的首次刷新'),
]:
    copy_image(sample(play, name), 'play-' + name + '.png', title, 'play')

summary = dict(
    version='0.6.0', compiled_build_sha256=hashlib.sha256((root / 'release/StarShop-demo.html').read_bytes()).hexdigest(),
    played_build_sha256=hashlib.sha256((play / 'played-build.html').read_bytes()).hexdigest(),
    play_log_sha256=hashlib.sha256((play / 'actions.jsonl').read_bytes()).hexdigest(),
    actions=len(records), screenshots=len(images), initial_cash=650, trade_delta=sum(t['delta'] for t in trades),
    other_expenses=nontrade, completed=completed, resumed=resumed, images=images,
    phases='先完成连续35笔实玩；修正截图细节后使用本次独立存档复核最终构建。边界夹具不计入35笔。',
    limits=['H5 headless Chromium touch emulation, not a WeChat real device',
            'Locator taps may scroll buttons into view; synthetic drags do not prove human finger success rate'])
for filename, data in [('summary.json', summary), ('transactions.json', trades), ('completed-state.json', completed)]:
    (out / filename).write_text(json.dumps(data, ensure_ascii=False, indent=2), 'utf-8')

def figure(file, title):
    return f'<figure><figcaption>{html.escape(title)}</figcaption><a href="{file}"><img loading="lazy" src="{file}" alt="{html.escape(title)}"></a></figure>'

sections = []
for phase, title in [('final', '最终界面复核'), ('fixture', '最终构建的边界用例'), ('play', '连续实玩原始证据')]:
    sections.append(f'<section><h2>{title}</h2><div class="shots">' + ''.join(
        figure(i['file'], i['title']) for i in images if i['phase'] == phase) + '</div></section>')
(out / 'index.html').write_text('''<!doctype html><html lang="zh-CN"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>StarShop v0.6 修复与复测</title>
<style>html,body{overflow-x:clip}body{margin:0;padding:24px;background:#1d1b25;color:#ede4c6;font:16px/1.7 system-ui,sans-serif}
main{max-width:1100px;margin:auto}h1,h2{line-height:1.3;overflow-wrap:anywhere}h1{font-size:clamp(24px,6.4vw,32px)}a{color:#a4cebe}section{margin-top:40px}
.shots{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;align-items:start}figure{min-width:0;margin:0;padding:12px;border:1px solid #789c99;background:#292532}
figcaption{margin-bottom:12px;overflow-wrap:anywhere}img{display:block;max-width:100%;height:auto;margin:auto;image-rendering:pixelated}
@media(max-width:700px){body{padding:16px}.shots{grid-template-columns:minmax(0,1fr)}}
</style><main><h1>v0.6 手机界面打磨与复测</h1>
<p>32项逐条处理。连续35笔交易，支付120租金，第八天1109星币、零欠租；最终构建恢复存档验证一致。</p>
<p>美术方向保留，重点打磨可读性、触控、信息层次与反馈。以下均为原始截图，没有裁掉问题或重绘画面。</p>
<p><a href="../../移动端打磨与复测-v0.6.md">32项实现与验证对照</a> · <a href="transactions.json">35笔交易</a> · <a href="summary.json">证据与构建指纹</a></p>
<h2>预算不足：前后对照</h2><div class="shots">''' + figure('../mobile-v05/034-budget-exceeded-320.png', 'v0.5：提示挤掉预算和明细')
    + figure('budget-320.png', 'v0.6：预算、商品、合计和撤下入口各有位置') + '''</div>
<p>边界用例采用独立夹具；实玩段来自正常经营。实玩结束后又清理了无关旧提示、修正格子底色并补齐毛利显示，最终状态没有改钱或跳日。</p>'''
    + ''.join(sections) + '</main></html>', 'utf-8')
print(json.dumps(dict(screenshots=len(images), transactions=len(trades), actions=len(records)), ensure_ascii=False))
