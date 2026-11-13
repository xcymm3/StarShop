"""Extract selected shipped-artifact base prices from the existing offline CIL export.

This reads text only. It does not load/execute the game and does not copy assets.
"""
import argparse
import hashlib
import json
import pathlib
import re

SELECTION = [
    ('机械', '便携放大镜', 'MG', 'ToolDirectory', 'CreateMagnifier', '镜片边缘留着维修班的编号。'),
    ('机械', '精密螺丝刀', 'SD', 'ToolDirectory', 'CreateScrewdriver', '适合处理舱内小型设备的紧固件。'),
    ('机械', '便携焊接器', 'WL', 'ToolDirectory', 'CreateWelder', '在下一次舱外维修前，它还有用武之地。'),
    ('机械', '旧式工具箱', 'TB', 'ToolDirectory', 'CreateToolbox', '外壳有些旧，搭扣依然结实。'),
    ('机械', '电流转换器', 'CV', 'MiscItemDirectory', 'CurrentConverter', '改装货船上常见的供电配件。'),
    ('机械', '精密电路组件', 'EC', 'MaterialDirectory', 'RareElectronic', '一块拆卸得很完整的电路组件。'),
    ('补给', '密封营养肉块', 'NR', 'FoodItemDirectory', 'ProcessedMeat', '便于储存的旅途口粮。'),
    ('补给', '航行饮水包', 'WA', 'FoodItemDirectory', 'WaterRation', '补给清单里总会留一个位置给它。'),
    ('补给', '节能补给模块', 'EM', 'ModuleDirectory', 'SystemEfficiencyModule', '一枚可用于设备维护的节能模块。'),
    ('补给', '速食面杯', 'ND', 'FoodItemDirectory', 'CupNoodle', '值夜班前能吃上一口热食就很好。'),
    ('补给', '冷藏生肉', 'MT', 'FoodItemDirectory', 'RawMeat', '独立封装的厨房备料。'),
    ('补给', '精装瓶装水', 'PW', 'FoodItemDirectory', 'BottledWaterPremium', '远航餐桌上不常见的精装补给。'),
    ('遗物', '旧港手电', 'FL', 'MiscItemDirectory', 'Flashlight', '灯壳上的划痕见过许多次停电。'),
    ('遗物', '旧式腰包', 'PK', 'ContainerItemDirectory', 'FannyPack', '一位老船员留下的小收纳包。'),
    ('遗物', '拾荒纪念章', 'SC', 'MiscItemDirectory', 'ScavToken', '金属边缘被反复摩挲得发亮。'),
    ('遗物', '帆布挎包', 'BG', 'ContainerItemDirectory', 'Satchel', '搭扣旁还缝着早年的航线标。'),
    ('遗物', '旧校徽背包', 'BP', 'ContainerItemDirectory', 'KidsBackpack', '背包上留下了一段出发的故事。'),
    ('遗物', '远行大背包', 'LB', 'ContainerItemDirectory', 'BackpackLarge', '足够装下一段漫长航程的行李。'),
    ('数据', '净水作业手册', 'WG', 'MiscItemDirectory', 'WaterGuide', '几页维护记录被重点折了角。'),
    ('数据', '燃料检查指南', 'FG', 'MiscItemDirectory', 'FuelGuide', '纸页间夹着一张旧检修表。'),
    ('数据', '水耕栽培手册', 'HG', 'MiscItemDirectory', 'HydroponicGuide', '记录了如何在密闭舱里照顾幼苗。'),
    ('数据', '化学操作指南', 'CG', 'MiscItemDirectory', 'ChemistryGuide', '整理得很清楚的实验工作笔记。'),
    ('数据', '安保档案卡', 'SK', 'MiscItemDirectory', 'SecKeycard', '一张已离开原岗位的识别卡。'),
    ('数据', '指挥档案卡', 'CK', 'MiscItemDirectory', 'CommandKeycard', '封套上仍有旧指挥台的索引号。'),
]


DEMO_NAMES = [
    '磁悬轴承', '微型燃料泵', '导航陀螺', '气闸控制器', '聚变点火芯', '量子线圈',
    '藻类口粮', '净水滤芯', '密封咖啡豆', '应急氧气罐', '医疗补给包', '恒温培养盒',
    '旧地球邮票', '矿工纪念章', '轨道怀表', '航海铜星盘', '殖民地唱片', '月海玻璃',
    '港口星图', '修理手册', '植物样本记录', '探测器日志', '古航路坐标', '失落观测档案',
]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def methods(path):
    text = path.read_text(encoding='utf-8-sig')
    for match in re.finditer(r'^METHOD (.+?) TOKEN (.+?) RVA (\d+)\n(.*?)(?=^METHOD |\Z)', text, re.M | re.S):
        yield match, text.count('\n', 0, match.start()) + 1


def extract(root):
    products = []
    for idx, (category, name, mark, directory, function, story) in enumerate(SELECTION):
        path = root / f'{directory}.il.txt'
        candidates = [(m, ln) for m, ln in methods(path) if m[1] == f'GameItem {directory}::{function}()']
        if len(candidates) != 1:
            raise ValueError(f'Method selection ambiguous: {directory}.{function}')
        match, line = candidates[0]
        body = match[4].splitlines()
        stores = [(k, s) for k, s in enumerate(body) if 'GameItem::set_unitValue(System.Int64)' in s]
        if len(stores) != 1:
            raise ValueError(f'Non-unique unitValue assignment: {directory}.{function}')
        k, store = stores[0]
        price = const_line = None
        for source in reversed(body[max(0, k-4):k]):
            numeric = re.search(r'ldc\.i[48](?:\.s)? (-?\d+)', source)
            short = re.search(r'ldc\.i4\.(m1|[0-8])(?:\s|$)', source)
            if numeric:
                price, const_line = int(numeric[1]), source
                break
            if short:
                price, const_line = (-1 if short[1] == 'm1' else int(short[1])), source
                break
        if price is None or price <= 0:
            raise ValueError(f'Positive direct constant not found: {directory}.{function}')
        sprites = []
        for j, source in enumerate(body):
            if 'SetSpriteAndShape(System.String,System.String)' in source:
                strings = [re.search(r'ldstr "(.*)"', s)[1] for s in body[:j] if re.search(r'ldstr "(.*)"', s)]
                if len(strings) >= 2:
                    sprites.append(strings[-2:])
        if len(sprites) != 1:
            raise ValueError(f'Atlas/sprite selection ambiguous: {directory}.{function}')
        products.append({
            'id': f'p{idx}', 'category': category, 'name': DEMO_NAMES[idx], 'base': price,
            'demoId': f'p{idx}', 'demoName': DEMO_NAMES[idx], 'demoCategory': category,
            'sourceMethod': match[1], 'sourceBase': price,
            'sourceSprite': sprites[0][1], 'sourceAtlas': sprites[0][0],
            'mappingNature': '同价位/同用途基准映射，不是同一商品或完整原作复刻',
            'sourceAnalogueLabel': name,
            'level': 1 if idx % 6 < 4 else 2 if idx % 6 == 4 else 3,
            'source': {
                'il_file': path.name, 'il_sha256': digest(path), 'method': match[1],
                'token': match[2], 'rva': int(match[3]), 'method_line': line,
                'price_constant': const_line, 'unit_value_assignment': store,
                'atlas': sprites[0][0], 'sprite': sprites[0][1],
                'meaning': 'observed direct factory unitValue constant, not a verified sale price',
            },
        })
    return products


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--il-root', type=pathlib.Path, default=pathlib.Path(r'D:\mydoc\probably-stolen-rea\il'))
    parser.add_argument('--output-dir', type=pathlib.Path, default=pathlib.Path(__file__).resolve().parents[1] / 'docs')
    args = parser.parse_args()
    products = extract(args.il_root)
    assembly = args.il_root.parent / 'input' / 'Probably Stolen' / 'Probably Stolen_Data' / 'Managed' / 'Assembly-CSharp.dll'
    result = {
        'schema_version': 1, 'source_assembly_sha256': digest(assembly) if assembly.exists() else None,
        'source_build': 'Probably Stolen supplied Windows Mono build, bundleVersion 0.46D',
        'inspection': 'offline CIL text parsing; not REA-native Evidence, no game execution',
        'scope': '24 selected factory methods; one direct unitValue constant and one direct atlas/sprite selection per method',
        'limitations': [
            'Factory constants do not establish actual in-game transaction prices or all later value modifications.',
            'StarShop original IDs and display names remain unchanged; sourceAnalogueLabel is a descriptive translation of the method, not recovered localization. Price references are same-tier/use-case mappings, not item identity.',
            'Quality, condition, buy/sell multipliers, budgets, hot-market markup and rent remain StarShop tuning, not original-game rules.',
            'p8 密封咖啡豆 uses the 70-credit industrial efficiency-module price as a price-tier reference only; it is not claimed to be the same original product.',
        ],
        'products': products,
    }
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / '商品数值对照.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    md = ['# 商品基础价与 Unity 原作对照', '', '提取日期：2026-11-13。原作构建身份见同名 JSON。仅静态读取已导出的 IL 文本，没有加载游戏程序集或启动游戏。', '',
          '24 个商品保留 StarShop 现有原创名称与 ID，基础价参考选定原作工厂方法中的 `set_unitValue` 常数。这是同价位／同用途的基准映射，不表示两者是同一商品；它不是完整经济系统，也不代表玩家实际成交价。', '',
          '| StarShop ID | 简化商品 | 类别 | 基础价 | 原作方法 | Token | 图集 / Sprite |', '|---|---|---|---:|---|---|---|']
    for p in products:
        s = p['source']
        md.append(f"| {p['id']} | {p['name']} | {p['category']} | {p['base']} | `{s['method']}` | `{s['token']}` | `{s['atlas']} / {s['sprite']}` |")
    md += ['', '## 采用方式与边界', '',
           '- p0 磁悬轴承保留 50，p8 密封咖啡豆保留 70，p12 旧地球邮票保留 40；现有商品名、ID、描述和美术语义不因数值来源而改变。',
           '- 机械、补给、遗物、数据是 StarShop 的四类简化。机械参考工具与电子设备价阶，补给参考食物、饮水与容器价阶，遗物参考手电、背包和纪念章价阶，数据参考文档和访问卡价阶。它们不是逐物品复刻。特别是密封咖啡豆的 70 仅借用工业模块的价格档位，不能说原作咖啡就是此价格。',
           '- 机械价阶约 25–350、补给约 20–325、二手遗物约 40–650、数据文档约 25–125。高等级大背包基础价 650，买家预算应随所求商品价值调整，避免高价货永远卖不出去。',
           '- 当前 StarShop 的品质倍率、损坏倍率、固定收购折扣、收藏家加价、热销加价和每周租金尚无原作代码证据，必须标成简化版调参，不能描述为原作真实参数。',
           '- 单位价可能在原作其他帮助方法、事件、库存状态或交易逻辑中继续改变。此提取只确认每个选定工厂方法的一处直接赋值。',
           '- 图集和 sprite 名只用于查找本地视觉参考；脚本不会复制图像、字体、音效、原作长文案或任何二进制到产品目录。',
           '- 同名 JSON 保存方法行号、RVA、价格指令、IL 文件摘要，便于逐条复核；这些是普通静态解析证据，不冒充 REA Evidence ID。',
           '', '## 复现', '', '```powershell', r'python scripts/extract-source-prices.py --il-root D:\mydoc\probably-stolen-rea\il', '```', '',
           '脚本对每个选定方法要求恰好一处直接价格赋值和一组直接图集/贴图名，条件不满足则报错，不猜测运行时价格。原 IL 不提交至 StarShop 仓库。', '']
    (args.output_dir / '商品数值对照.md').write_text('\n'.join(md), encoding='utf8')
    print(f'Exported {len(products)} observed base prices')


if __name__ == '__main__':
    main()
