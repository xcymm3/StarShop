"""Static Unity reference export. Originals stay outside the StarShop repository."""
from pathlib import Path
import sys,json,hashlib
from PIL import Image,ImageDraw,ImageFont
REPO=Path(__file__).resolve().parents[1]
REA=Path(r'D:/mydoc/probably-stolen-rea')
OUT=REA/'starshop-art'
sys.path.insert(0,str(REA/'tools/python'))
import UnityPy
rows=[
('p0','磁悬轴承',878,'A compact magnetic bearing: concentric steel rings around a dark hollow center, three ochre calibration notches, worn blue-grey outer housing.'),
('p1','微型燃料泵',982,'A small fuel transfer pump: squat blue-grey cylindrical pump body, two brass hose connectors, a tiny red lever and reinforced foot.'),
('p2','导航陀螺',934,'A navigation gyroscope with three interlocking tarnished brass gimbal rings around a teal sphere, mounted on a small square steel foot.'),
('p3','气闸控制器',1116,'A handheld airlock controller: chunky blue-grey rectangular box, small blank amber display, one red guarded switch, two ivory keys and connector socket.'),
('p4','聚变点火芯',1297,'A fusion ignition cartridge: short thick cylindrical cartridge, dark graphite caps and protective steel ribs around a small warm amber inner core.'),
('p5','量子线圈',991,'A compact toroidal quantum coil: thick aged copper windings around a graphite ring, two teal ceramic clamps and short insulated terminal leads.'),
('p6','藻类口粮',1188,'A sealed algae food ration pouch: worn olive-green foil packet, torn cream rectangular blank label, simple leaf pictogram, crimped top and bottom.'),
('p7','净水滤芯',440,'A portable water filter cartridge: tall ribbed cream ceramic cylinder, dark teal end caps, two small brass pipe adapters and blue-grey retaining band.'),
('p8','密封咖啡豆',1090,'A sealed coffee bean pouch: squat folded kraft-brown bag, dark plum resealable top clip, small blank cream label with three coffee-bean pictograms. No plant.'),
('p9','应急氧气罐',1174,'An emergency oxygen canister: squat steel blue cylinder, rounded shoulders, brass valve with protective collar, faded ochre stripe and a small analog gauge.'),
('p10','医疗补给包',1250,'A compact medical supply satchel: muted rust fabric case with cream cross patch, dark straps, metal zipper and slight worn corners.'),
('p11','恒温培养盒',1281,'A small insulated specimen incubator box: grey-green rugged case, clear dark teal top viewing panel showing two tiny seedling vials, amber status lamp, side handle.'),
('p12','旧地球邮票',1365,'A single vintage postage stamp with perforated cream paper edges, muted blue-green illustration of Earth and a tiny old rocket, faded rust circular postmark. No readable letters or digits.'),
('p13','矿工纪念章',597,'An old miners commemorative medal: tarnished brass hexagonal medallion with crossed pick pictogram, worn burgundy ribbon, small dents.'),
('p14','轨道怀表',1388,'An antique orbital pocket watch: round weathered brass case, ivory face with simple ticks and two dark hands, short chain and small side crown.'),
('p15','航海铜星盘',936,'A brass celestial astrolabe: layered circular engraved rings and delicate star pointers, dark plum recesses, compact folding triangular stand.'),
('p16','殖民地唱片',917,'A vintage colony vinyl record half-sliding from a worn square cardboard sleeve; sleeve has a faded geometric teal coastline and ochre sun, disc dark plum with cream blank central label.'),
('p17','月海玻璃',1154,'A lunar sea glass specimen: irregular translucent blue-green glass shard with pale mineral swirls, amber inclusion and weathered cloudy edges, resting in a small dark metal sample cradle.'),
('p18','港口星图',1148,'A folded old port star chart on cream paper: simple teal orbital routes, small ochre star dots, dark plum border, curled corners and one metal clip. No letters.'),
('p19','修理手册',1143,'A thick worn repair handbook: muted petrol-blue hardcover, cream spine tape, simple wrench pictogram embossed on cover, several ochre page tabs and frayed corners.'),
('p20','植物样本记录',1226,'A compact botanical sample logbook: grey-green cloth cover, cream label with small pressed leaf drawing, burgundy binding strap and worn paper page edges.'),
('p21','探测器日志',945,'A rugged probe flight-log data recorder: dark blue-grey palm-sized rectangular drive with amber inset strip, metal corner guards and two teal indicator dots.'),
('p22','古航路坐标',1200,'An old navigation coordinate data card: wide dark teal chipped metal card with narrow brass contact strip, cream constellation pictogram and faded ochre diagonal corner marking.'),
('p23','失落观测档案',379,'A lost observatory archive cartridge: chunky plum-grey rectangular data cassette with recessed twin reels, tarnished brass lock tab, amber glass data window and blank aged label.'),
('v0','拾荒者',1697,'REUSE approved scavenger woman'),
('v1','船员',1093,'A NEW station crewman, young adult man with warm brown skin, close-cropped dark hair, pale steel-blue flight jacket, ochre collar, shoulder comms patch, cream harness and small headset. Calm slightly tired face. Front facing waist-up bust, complete shoulders.'),
('v2','商人',1691,'A NEW interstellar merchant, middle-aged stocky man with olive skin, wavy dark hair and short beard, worn burgundy travelling coat, petrol-blue vest, brass clasp, cream scarf and small ledger tucked into breast pocket. Wry friendly expression. Front facing waist-up bust, complete shoulders.'),
('v3','收藏家',1037,'A NEW antique collector, older woman with dark brown skin, neat silver hair bun, round brass spectacles, deep teal tailored coat with ochre lining, small astronomical brooch and cream blouse. Curious discerning expression. Front facing waist-up bust, complete shoulders.'),
('counter','店铺背景',1273,'A richly detailed but quiet empty space-station secondhand shop viewed straight-on from behind the shop counter. Wide 3:2 composition. Worn blue-grey industrial walls, central open service hatch with dark purple station corridor beyond, stacked drawers and illuminated glass cabinet at left, shelves and bundles of old cable to right, amber practical lamp overhead, teal indicator lights. Strongest light and empty space at central hatch for a separate NPC bust overlay. Bottom 15 percent is a bare countertop ledge. NO people, NO terminal, NO loose merchandise on counter, NO text, logos, signage or UI. Original architecture; match reference visual language without tracing.'),
('terminal','交易终端',1216,'REUSE approved terminal'),
('magnifier','鉴定工具',1072,'REUSE approved magnifier'),
]
inv=json.loads((REA/'art-pilot/sprite-inventory.json').read_text('utf-8'))
envs={};manifest=[]
for folder in ['originals','references','masters']:(OUT/folder).mkdir(parents=True,exist_ok=True)
for ident,label,pid,subject in rows:
    file='sharedassets1.assets' if ident.startswith('v') or ident in ['counter','terminal'] else 'resources.assets'
    # Some atlas entries are placeholders with alpha 0..3. Use verified visible references.
    pid={'p2':963,'p6':1006,'p10':894,'p11':988,'p21':1179,'p22':1358}.get(ident,pid)
    source=next(x for x in inv if x['file']==file and x['path_id']==pid)
    if file not in envs:envs[file]=UnityPy.load(str(REA/'input/Probably Stolen/Probably Stolen_Data'/file))
    obj=next(x for x in envs[file].objects if x.path_id==pid)
    im=obj.read().image.convert('RGBA');im.save(OUT/'originals'/f'{ident}.png')
    assert im.getchannel('A').getextrema()[1]>=128, f'Invisible reference: {ident}'
    crop=im.crop(im.getchannel('A').point(lambda a:255 if a>=128 else 0).getbbox());scale=min(800/crop.width,800/crop.height)
    crop=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.NEAREST)
    ref=Image.new('RGBA',(1024,1024));ref.paste(crop,((1024-crop.width)//2,(1024-crop.height)//2));ref.save(OUT/'references'/f'{ident}.png')
    if ident.startswith('p'):target=f'items/{ident}.png';size=[128,128];usage='柜台、仓库、商品档案、展示柜'
    elif ident.startswith('v'):target=f'visitors/{ident}.png';size=[320,400];usage='柜台顾客半身像'
    else:target=f'room/{ident}.png';size= {'counter':[960,640],'terminal':[256,224],'magnifier':[128,128]}[ident];usage='店铺场景' if ident!='magnifier' else '鉴定档案'
    style='Use case: stylized-concept. ONE original 2D game asset, a carefully crafted muted retro space-station pixel-style illustration. Input 1 is Unity reference for material, composition and atmosphere ONLY; redesign shapes and structure, do not trace. Input 2 (when present) is the approved ORIGINAL art style reference. Match its nuanced weathered industrial craft, steel blue/grey, warm ochre and cream accents, purple dark shadows, restrained pixel clusters and natural proportions. '
    constraints=' Complete centered subject, 10 percent clear margin, genuine transparent background. No scene, text, logo, border, flat vector style, chibi, 3D render, or photorealism. Readable silhouette on a phone. Do not draw the reference object when the requested subject is different.'
    if ident=='counter':constraints=' Opaque background filling image. No border, interface, text, people, labels or watermark. Render a cohesive polished background, keeping a calm center for separately composited character.'
    manifest.append({'id':ident,'name':label,'source':source,'source_size':list(im.size),'source_sha256':hashlib.sha256((OUT/'originals'/f'{ident}.png').read_bytes()).hexdigest(),'mapping':'用途或材质的视觉参考，非同物身份复刻；与价格参考分开','usage':usage,'runtime':target,'runtime_size':size,'prompt':style+'Subject: '+subject+constraints,'status':'reference-exported'})
(REPO/'docs/素材清单.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n','utf-8')
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',n)
board=Image.new('RGB',(1600,((len(manifest)+5)//6)*260+70),'#292532');d=ImageDraw.Draw(board);d.text((24,15),'StarShop · 全部 31 项 Unity 真实参考素材',font=font(27),fill='#ede4c6')
for i,r in enumerate(manifest):
    x=(i%6)*266;y=(i//6)*260+70
    d.text((x+12,y+5),r['id']+' '+r['name'],font=font(18),fill='#a4cebe')
    im=Image.open(OUT/'originals'/f"{r['id']}.png").convert('RGBA');im=im.crop(im.getchannel('A').getbbox());im.thumbnail((230,192),Image.Resampling.NEAREST)
    if im.width<150 and im.height<150:
        scale=min(230/im.width,192/im.height);im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.NEAREST)
    board.paste(im,(x+(266-im.width)//2,y+36+(192-im.height)//2),im)
    d.text((x+12,y+235),r['source']['name'][:24],font=font(13),fill='#bcb5c6')
board.save(OUT/'unity-catalog.png')
lines=['# Unity 参考素材册','','本地静态导出，不启动游戏。仅作参考，不包含在产品或 Git 提交中。素材数量：31。','','![总览](unity-catalog.png)','','|编号|用途|Unity Sprite|来源 / Path ID|原始画布|原创目标画布|','|---|---|---|---|---|---|']
for r in manifest:lines.append(f"|{r['id']} {r['name']}|{r['usage']}|{r['source']['name']}|{r['source']['file']} / {r['source']['path_id']}|{r['source_size']}|{r['runtime_size']}|")
(OUT/'素材册.md').write_text('\n'.join(lines)+'\n','utf-8')
print(f'Exported {len(manifest)} references to {OUT}')
