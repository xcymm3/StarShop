"""Original code-drawn pixel assets. Reference: local source-game palette/composition only.
No source-game pixels, sprites, typography, or audio are embedded.
Run: python scripts/generate-pixel-assets.py (requires Pillow).
"""
from pathlib import Path
from PIL import Image, ImageDraw
import random, json, html
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'src/assets'
C={'edge':'#25212e','shadow':'#36303f','dark':'#48414d','metal':'#777c74','light':'#acb6a1','teal':'#7ba9a2','cyan':'#a4d0bf','paper':'#ddcfa1','gold':'#c7a268','amber':'#e0b674','rust':'#955e52','red':'#c68370','blue':'#577884','violet':'#80718a','glass':'#4d666d','white':'#efe5c6'}
class Pixel:
 def __init__(self,w,h,bg=None):
  self.w,self.h=w,h;self.im=Image.new('RGBA',(w,h),C.get(bg,bg) if bg else (0,0,0,0));self.d=ImageDraw.Draw(self.im);self.svg=[]
  if bg:self.rect((0,0,w-1,h-1),bg)
 def col(self,c):return C.get(c,c)
 def rect(self,b,c):
  c=self.col(c);self.d.rectangle(b,fill=c);x,y,x2,y2=b;self.svg.append(f'<rect x="{x}" y="{y}" width="{x2-x+1}" height="{y2-y+1}" fill="{c}"/>')
 def ellipse(self,b,c):
  c=self.col(c);self.d.ellipse(b,fill=c);x,y,x2,y2=b;self.svg.append(f'<ellipse cx="{(x+x2)/2}" cy="{(y+y2)/2}" rx="{(x2-x)/2}" ry="{(y2-y)/2}" fill="{c}"/>')
 def poly(self,pts,c):
  c=self.col(c);self.d.polygon(pts,fill=c);self.svg.append(f'<polygon points="'+ ' '.join(f'{x},{y}' for x,y in pts)+f'" fill="{c}"/>')
 def line(self,pts,c,width=1):
  c=self.col(c);self.d.line(pts,fill=c,width=width);self.svg.append('<polyline points="'+' '.join(f'{x},{y}' for x,y in pts)+f'" stroke="{c}" stroke-width="{width}" fill="none"/>')
 def box(self,b,c,highlight='light'):
  x,y,x2,y2=b;self.rect(b,'edge');self.rect((x+2,y+2,x2-2,y2-2),c);self.line([(x+2,y2-3),(x+2,y+2),(x2-3,y+2)],highlight);self.line([(x+3,y2-2),(x2-2,y2-2),(x2-2,y+3)],'shadow')
 def save(self,stem):
  stem.parent.mkdir(parents=True,exist_ok=True);self.im.save(stem.with_suffix('.png'));stem.with_suffix('.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" width="{self.w}" height="{self.h}" shape-rendering="crispEdges">'+''.join(self.svg)+'</svg>\n',encoding='utf8')
def bolts(p,points):
 for x,y in points:p.rect((x,y,x+1,y+1),'light')
def lines(p,x,y,n,w,c='light'):
 for i in range(n):p.rect((x,y+i*4,x+w-(i%3)*3,y+i*4+1),c)
def icon(i):
 p=Pixel(48,48)
 # ground shadow anchors object without a card-like frame
 p.ellipse((7,39,41,44),'edge')
 if i==0: # bearing
  p.ellipse((5,5,42,42),'edge');p.ellipse((8,7,40,39),'metal');p.ellipse((11,10,36,35),'light');p.ellipse((14,13,34,33),'shadow');p.ellipse((18,17,30,29),'teal');p.ellipse((20,19,28,27),'edge')
  bolts(p,[(13,11),(31,11),(10,23),(33,25),(21,34)]);p.line([(12,7),(22,5),(34,9)],'cyan',2)
 elif i==1: # pump
  p.box((11,12,36,37),'blue');p.box((17,5,30,17),'metal');p.box((3,22,16,31),'metal');p.box((32,17,44,27),'metal');p.ellipse((18,20,30,32),'edge');p.ellipse((21,23,27,29),'teal');bolts(p,[(14,16),(32,33)]);p.rect((19,8,28,10),'light')
 elif i==2: # gyro
  p.ellipse((6,5,42,40),'edge');p.ellipse((9,8,39,37),'gold');p.ellipse((12,11,36,34),'shadow');p.poly([(24,8),(32,23),(24,38),(16,23)],'teal');p.poly([(24,13),(28,23),(24,32),(20,23)],'light');p.rect((22,20,25,26),'edge');p.line([(6,23),(42,23)],'gold',2);p.box((18,37,30,44),'metal')
 elif i==3: # airlock controller
  p.box((8,5,39,42),'metal');p.box((13,10,34,26),'blue');p.rect((16,13,30,16),'cyan');lines(p,16,19,2,12,'teal');p.box((12,30,22,37),'rust');p.box((26,30,35,37),'teal');bolts(p,[(11,8),(35,8),(11,39),(35,39)])
 elif i==4: # ignition core
  p.box((13,3,34,44),'metal');p.box((17,8,30,36),'rust');p.rect((21,11,26,33),'amber');p.rect((23,15,25,28),'white')
  for y in (6,36,40):p.rect((10,y,37,y+3),'shadow');p.rect((12,y,35,y),'light')
 elif i==5: # coil
  p.box((8,33,40,43),'metal');p.rect((15,8,33,35),'edge');p.rect((19,5,29,37),'blue')
  for y in range(7,33,5):p.poly([(10,y+2),(34,y),(38,y+3),(14,y+5)],'gold');p.line([(11,y+2),(34,y)],'paper')
  p.box((20,2,28,6),'metal')
 elif i==6: # rations pouch
  p.poly([(10,5),(35,5),(39,39),(34,43),(8,41),(7,11)],'edge');p.poly([(12,7),(33,7),(36,38),(31,40),(11,38),(10,12)],'teal');p.rect((11,8,33,11),'light');p.box((13,18,32,32),'paper','white');p.poly([(17,27),(22,20),(28,27)],'blue');p.line([(14,36),(32,36)],'shadow',2)
 elif i==7: # filter
  p.box((12,5,35,43),'metal');p.box((16,2,31,9),'blue');p.box((15,9,32,35),'paper')
  for y in range(12,34,4):p.rect((18,y,29,y+1),'metal')
  p.rect((17,38,30,40),'teal')
 elif i==8: # coffee tin
  p.ellipse((9,6,38,14),'edge');p.rect((9,10,38,36),'edge');p.rect((12,11,35,36),'rust');p.ellipse((9,31,38,41),'edge');p.ellipse((12,31,35,37),'rust');p.box((14,16,32,31),'paper');p.ellipse((21,19,27,28),'rust');p.line([(23,20),(25,27)],'edge');p.ellipse((11,7,36,13),'metal');p.line([(15,8),(31,8)],'light')
 elif i==9: # oxygen
  p.rect((19,2,29,7),'edge');p.rect((22,3,31,5),'gold');p.box((11,8,37,43),'teal');p.rect((15,13,19,36),'light');p.box((21,20,32,32),'paper');p.rect((24,23,28,29),'blue');p.rect((15,38,33,40),'shadow')
 elif i==10: # med kit
  p.box((14,5,33,13),'metal');p.rect((18,8,29,13),'edge');p.box((5,13,43,40),'rust');p.rect((9,17,39,35),'paper');p.rect((21,19,27,33),'rust');p.rect((17,23,31,29),'rust');p.rect((9,34,39,36),'gold');bolts(p,[(8,15),(40,15),(8,37),(40,37)])
 elif i==11: # incubator
  p.box((5,8,43,42),'metal');p.box((9,12,31,35),'glass');p.rect((11,14,13,30),'teal');p.box((34,14,39,24),'shadow');p.rect((35,15,38,17),'cyan');p.rect((35,28,38,31),'rust');p.ellipse((17,24,25,32),'gold');p.line([(20,26),(20,18),(25,17)],'teal',2)
 elif i==12: # stamps
  p.box((9,6,33,35),'paper','white');p.box((16,15,40,42),'paper','white');p.rect((19,18,37,36),'blue');p.poly([(20,33),(27,23),(35,33)],'teal');p.ellipse((29,20,33,24),'gold');p.rect((20,39,34,39),'rust')
  for y in range(17,40,5):p.rect((15,y,17,y+1),'edge');p.rect((39,y,41,y+1),'edge')
 elif i==13: # medal
  p.poly([(13,3),(23,3),(30,22),(21,24)],'rust');p.poly([(26,3),(36,4),(28,24),(20,22)],'blue');p.ellipse((10,18,38,44),'edge');p.ellipse((13,20,36,41),'gold');p.ellipse((17,24,32,37),'paper');p.poly([(24,25),(26,29),(31,30),(27,33),(28,37),(24,35),(20,37),(21,33),(17,30),(22,29)],'gold')
 elif i==14: # watch
  p.ellipse((19,2,29,12),'gold');p.ellipse((21,4,27,10),'edge');p.ellipse((7,9,41,44),'edge');p.ellipse((10,11,39,41),'gold');p.ellipse((14,15,35,37),'paper');p.line([(24,18),(24,27),(30,30)],'shadow',2);bolts(p,[(23,16),(16,25),(32,25),(23,34)])
 elif i==15: # astrolabe
  for b,c in [((5,5,42,43),'edge'),((8,8,40,41),'gold'),((11,11,36,37),'edge'),((14,14,34,35),'gold'),((17,17,31,32),'shadow')]:p.ellipse(b,c)
  p.line([(23,5),(24,43)],'paper',2);p.line([(5,24),(42,24)],'paper',2);p.poly([(23,9),(27,25),(22,38),(20,23)],'teal');p.ellipse((21,21,27,27),'gold')
 elif i==16: # record
  p.box((5,6,37,41),'rust');p.poly([(8,9),(33,9),(33,37),(8,37)],'paper');p.ellipse((12,9,43,41),'edge');p.ellipse((16,13,39,37),'shadow');p.ellipse((20,17,35,33),'edge');p.ellipse((24,21,31,29),'gold');p.rect((27,24,28,25),'edge')
 elif i==17: # glass
  p.poly([(10,12),(20,4),(34,7),(41,21),(34,39),(19,44),(7,32)],'edge');p.poly([(12,14),(21,7),(32,10),(37,23),(31,36),(20,40),(11,30)],'blue');p.poly([(21,7),(25,23),(12,29),(12,14)],'teal');p.poly([(25,23),(32,10),(37,23),(31,36)],'violet');p.line([(20,11),(22,21),(15,25)],'cyan',2);p.rect((27,29,29,31),'light')
 elif i==18: # map
  p.poly([(5,9),(18,5),(30,10),(42,5),(42,39),(30,44),(18,39),(5,43)],'edge');p.poly([(8,11),(18,8),(30,13),(39,9),(39,36),(30,40),(18,36),(8,39)],'paper');p.line([(18,8),(18,36)],'gold');p.line([(30,13),(30,40)],'gold');p.line([(11,29),(16,21),(25,28),(35,17)],'rust',2);bolts(p,[(11,29),(16,20),(24,27),(35,16)])
 elif i==19: # repair book
  p.box((8,4,38,43),'blue');p.rect((10,7,15,39),'shadow');p.rect((16,7,34,9),'teal');p.poly([(22,16),(27,14),(31,18),(27,22),(25,21),(20,31),(16,29),(22,19)],'light');p.rect((17,36,33,38),'paper');p.rect((36,8,38,40),'metal')
 elif i==20: # specimen
  p.box((12,5,35,42),'metal');p.box((17,10,31,37),'glass');p.rect((19,12,21,33),'teal');p.line([(25,33),(24,18)],'gold',2);p.poly([(24,24),(19,20),(20,17),(24,20)],'cyan');p.poly([(25,28),(30,23),(29,20),(25,24)],'teal');p.box((10,2,37,8),'blue');p.box((10,37,37,44),'blue')
 elif i==21: # data recorder
  p.box((5,8,43,40),'metal');p.box((9,12,31,28),'blue');lines(p,12,15,3,16,'cyan');p.box((34,12,39,21),'rust');p.rect((35,25,38,27),'gold');p.rect((10,32,38,35),'shadow');p.rect((14,33,29,34),'light')
 elif i==22: # coordinate crystal device
  p.box((7,25,41,43),'blue');p.poly([(15,24),(15,10),(23,3),(32,10),(32,24),(24,31)],'edge');p.poly([(18,23),(18,11),(23,7),(28,12),(28,23),(24,27)],'teal');p.poly([(23,7),(24,27),(28,23),(28,12)],'blue');p.line([(20,11),(20,21)],'cyan');p.rect((12,33,35,36),'paper');p.rect((16,39,32,40),'teal')
 else: # archive cartridge stack
  p.box((7,10,36,41),'shadow');p.box((12,6,41,36),'blue');p.box((16,3,44,31),'metal');p.rect((20,7,40,15),'paper');p.rect((23,9,37,10),'rust');p.rect((21,19,40,25),'shadow');p.rect((25,20,27,24),'gold');p.rect((31,20,33,24),'gold');p.rect((37,20,39,24),'gold')
 return p
for i in range(24):icon(i).save(OUT/f'items/p{i}')
def visitor(role):
 p=Pixel(64,96)
 # silhouette, backpack and arms
 coat=['blue','rust','metal','violet'][role]
 p.rect((10,48,53,93),'edge');p.rect((5,55,58,89),'edge');p.rect((8,56,14,86),coat);p.rect((49,56,55,86),coat)
 p.rect((15,50,48,93),coat);p.rect((17,53,20,89),'light');p.rect((43,52,47,91),'shadow');p.rect((29,55,32,94),'shadow')
 p.rect((17,88,29,95),'shadow');p.rect((34,88,47,95),'shadow');p.rect((11,87,15,94),'gold');p.rect((49,87,54,94),'gold')
 p.rect((23,39,41,53),'edge');p.rect((26,41,38,50),'gold');p.rect((20,48,44,55),'paper');p.rect((24,50,40,54),'shadow')
 p.rect((19,9,45,39),'edge');p.rect((22,12,42,35),'gold');p.rect((24,27,41,36),'paper');p.rect((22,14,26,30),'rust')
 if role==0:
  p.rect((14,4,48,17),'edge');p.rect((17,5,45,14),'rust');p.rect((12,13,50,19),'shadow');p.rect((19,19,44,27),'edge');p.rect((22,20,40,24),'teal');p.rect((26,21,37,22),'cyan');p.box((38,60,45,72),'gold');p.rect((18,65,25,80),'shadow');p.line([(19,67),(24,77)],'metal')
 elif role==1:
  p.rect((16,8,48,16),'edge');p.rect((21,3,44,12),'blue');p.rect((23,5,43,7),'teal');p.rect((18,12,49,16),'blue');p.rect((23,20,28,22),'edge');p.rect((35,20,39,22),'edge');p.rect((27,31,36,32),'rust');p.box((38,59,44,66),'gold');p.rect((19,73,26,76),'cyan')
 elif role==2:
  p.rect((17,5,46,16),'shadow');p.poly([(17,15),(20,5),(43,4),(47,12),(44,19)],'edge');p.rect((21,9,43,16),'metal');p.rect((21,20,29,25),'shadow');p.rect((34,20,42,25),'shadow');p.line([(29,22),(34,22)],'shadow');p.rect((27,31,35,32),'rust');p.rect((19,57,25,77),'gold');p.rect((38,57,44,77),'gold');p.rect((22,78,41,80),'paper')
 else:
  p.rect((13,4,50,14),'edge');p.rect((19,0,44,10),'violet');p.rect((14,11,50,15),'violet');p.rect((24,18,29,20),'edge');p.rect((36,18,41,20),'edge');p.ellipse((32,15,45,28),'gold');p.ellipse((34,17,43,26),'blue');p.line([(38,27),(41,43)],'gold');p.rect((25,32,35,34),'rust');p.poly([(20,50),(30,66),(23,79),(16,54)],'metal');p.poly([(44,50),(33,66),(40,80),(49,55)],'metal');p.box((37,73,44,80),'gold')
 p.save(OUT/f'visitors/v{role}');return p
visitors=[visitor(i) for i in range(4)]
def room():
 p=Pixel(320,220,'shadow');rng=random.Random(44)
 # side walls and hull ribs
 p.rect((0,0,319,159),'dark');p.rect((0,0,9,172),'edge');p.rect((310,0,319,172),'edge');p.rect((11,0,17,172),'metal');p.rect((300,0,307,171),'metal')
 for x in (12,303):p.rect((x,0,x+1,171),'light')
 p.rect((20,0,296,7),'shadow');p.rect((22,9,294,11),'metal')
 # central shutter occupies back wall; empty right-mid for actual visitor overlay
 p.box((107,29,244,159),'shadow','metal')
 for y in range(35,155,8):p.rect((112,y,239,y+3),'dark');p.rect((114,y,238,y),'violet')
 p.rect((112,152,239,155),'edge')
 # ceiling conduit
 p.line([(25,0),(25,18),(94,18),(94,28)],'edge',5);p.line([(25,0),(25,17),(94,17),(94,28)],'gold',1)
 p.line([(267,0),(267,43),(282,43),(282,87)],'edge',5);p.line([(267,0),(267,42),(282,42),(282,87)],'teal',1)
 # lamp fixture, no diffusion gradients
 p.box((125,8,213,23),'metal');p.rect((132,13,207,16),'paper');p.rect((135,17,204,18),'gold')
 # left built-in cabinet
 p.box((24,30,100,146),'shadow','metal');p.rect((30,47,94,137),'edge');p.rect((34,50,91,134),'dark')
 for y in (75,104,133):p.rect((31,y,94,y+3),'metal');p.rect((33,y+1,92,y+1),'light')
 p.rect((31,35,93,42),'teal');p.rect((37,37,60,38),'cyan')
 # stock silhouettes inside cupboard - original small generic bottles and boxes
 for x,y,col in [(38,56,'rust'),(53,55,'blue'),(73,55,'gold'),(37,84,'blue'),(59,84,'teal'),(76,84,'rust'),(40,113,'gold'),(62,113,'violet')]:
  p.box((x,y,x+10,y+17),col,'metal');p.rect((x+3,y-3,x+7,y-1),'shadow')
 # poster and worn utility panel right
 p.box((253,54,292,104),'rust','gold');p.rect((258,59,287,98),'gold');p.ellipse((263,65,282,84),'rust');p.poly([(262,86),(272,74),(283,86)],'paper');p.rect((260,92,285,94),'rust')
 p.box((255,115,291,145),'metal');p.box((261,120,280,134),'blue');p.rect((264,123,276,125),'cyan');bolts(p,[(284,122),(284,129),(260,138),(284,138)])
 # wall wear: deterministic small chips restricted to wall edges
 for _ in range(75):
  x=rng.choice([rng.randint(18,23),rng.randint(97,105),rng.randint(245,251),rng.randint(293,299)]);y=rng.randint(25,158)
  p.rect((x,y,x+rng.randint(1,3),y+1),rng.choice(['shadow','metal','rust']))
 # perspective tabletop - short foreground leaves room for touch UI below
 p.poly([(25,158),(291,158),(319,189),(0,189)],'edge');p.poly([(29,157),(287,157),(310,180),(9,180)],'metal');p.line([(29,157),(287,157),(310,180)],'light',2)
 p.rect((6,181,314,188),'dark');p.rect((10,181,310,183),'light');p.rect((18,189,302,219),'shadow');p.rect((27,194,294,219),'dark')
 for x in range(30,294,14):p.rect((x,196,x+9,216),'shadow')
 # left till and right miniature parcel counter furniture
 p.poly([(42,161),(73,161),(82,175),(35,175)],'shadow');p.poly([(45,163),(70,163),(74,170),(40,170)],'teal');p.line([(46,164),(68,164)],'cyan');p.rect((42,172,72,173),'metal')
 p.box((258,164,283,177),'shadow','metal');p.rect((263,167,276,170),'gold');p.rect((261,173,279,174),'blue')
 # bare center counter intentionally retained for merchandise overlay
 p.line([(93,173),(204,173)],'light');p.line([(94,174),(203,174)],'dark')
 # front panel lights and service badge
 p.box((136,182,186,197),'metal');p.rect((142,187,149,191),'teal');p.rect((155,187,162,191),'rust');p.rect((168,187,177,191),'gold')
 p.save(OUT/'room/counter');return p
r=room()
# source index: only PNG files imported in game so WeChat need not support SVG
imports=[f"import p{i} from './items/p{i}.png'" for i in range(24)]+[f"import v{i} from './visitors/v{i}.png'" for i in range(4)]+["import counter from './room/counter.png'"]
index='\n'.join(imports)+"\n\nexport const itemArt: Record<string, string> = {\n"+''.join(f'  p{i},\n' for i in range(24))+"}\nexport const visitorArt: Record<string, string> = { '拾荒者': v0, '船员': v1, '商人': v2, '收藏家': v3 }\nexport const roomArt = counter\n"
(OUT/'index.ts').write_text(index,encoding='utf8');(OUT/'assets.d.ts').write_text("declare module '*.png' { const src: string; export default src }\n",encoding='utf8')
(OUT/'README.md').write_text('''# StarShop 原创像素资源

这些资源通过 `scripts/generate-pixel-assets.py` 独立绘制，参考原作截图的低饱和紫灰、青灰金属与暖色纸张配色，以及柜台/货架的功能关系；没有嵌入原作贴图、字体、角色图或截图像素。

- `items/p0..p23`：24 种 48×48 透明商品图。
- `visitors/v0..v3`：64×96 透明上半身立绘，分别用于拾荒者、船员、商人、收藏家。
- `room/counter`：320×220 柜台背景，前景不含来客，中央台面留作商品展示。
- 同名 SVG 为可编辑矢量绘图源，PNG 用于 H5/微信小程序。
- `preview-contact-sheet.png` 为开发查看联系表，不由产品代码引用。

复现需要 Python + Pillow：`python scripts/generate-pixel-assets.py`。像素图建议 `image-rendering: pixelated`，不要使用平滑拉伸。
''',encoding='utf8')
# contact sheet at readable scale
sheet=Image.new('RGB',(720,820),C['edge']);d=ImageDraw.Draw(sheet)
for i in range(24):
 x=(i%8)*90+10;y=(i//8)*112+12
 im=icon(i).im.resize((72,72),Image.Resampling.NEAREST);sheet.paste(im,(x,y),im);d.text((x+24,y+78),f'p{i}',fill=C['paper'])
for i,v in enumerate(visitors):
 im=v.im.resize((96,144),Image.Resampling.NEAREST);sheet.paste(im,(35+i*175,355),im);d.text((65+i*175,505),f'v{i}',fill=C['paper'])
im=r.im.resize((400,275),Image.Resampling.NEAREST);sheet.paste(im,(160,535),im)
sheet.save(OUT/'preview-contact-sheet.png')
print('Generated 24 item sprites, 4 visitors, 1 counter, SVG/PNG and contact sheet')

