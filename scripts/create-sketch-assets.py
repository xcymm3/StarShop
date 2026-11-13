"""User-requested simple line drawings, kept as a reproducible layout prototype."""
from pathlib import Path
from PIL import Image, ImageDraw
import shutil
R=Path(__file__).resolve().parents[1]
O=R/'src/assets/sketches'
O.mkdir(parents=True,exist_ok=True)
ink='#a4cebe'
imports=[]
for i in range(24):
    im=Image.new('RGBA',(128,128));d=ImageDraw.Draw(im)
    if i<6:
        d.ellipse((25,25,103,103),outline=ink,width=4);d.ellipse((43,43,85,85),outline=ink,width=3)
        d.line((64,15,64,30),fill=ink,width=4);d.line((98,64,113,64),fill=ink,width=4)
    elif i<12:
        d.rectangle((32,31,96,105),outline=ink,width=4);d.rectangle((44,20,84,31),outline=ink,width=4)
        d.line((42,60,85,60,85,84,42,84),fill=ink,width=3)
    elif i<18:
        d.ellipse((28,26,100,98),outline=ink,width=4);d.line((48,100,42,116,65,108,84,116,79,100),fill=ink,width=3)
    else:
        d.rectangle((25,23,103,107),outline=ink,width=4);d.line((34,23,34,107),fill=ink,width=3)
        for y in (45,61,77):d.line((46,y,88,y),fill=ink,width=3)
    d.text((57,111),str(i+1),fill=ink)
    im.save(O/f'p{i}.png');imports.append(f"import p{i} from './p{i}.png'")
for i in range(4):
    im=Image.new('RGBA',(256,320));d=ImageDraw.Draw(im)
    d.ellipse((81,22,175,125),outline=ink,width=4);d.line((97,125,96,146,56,170,35,310,221,310,202,170,161,146,160,125),fill=ink,width=4)
    d.line((108,79,117,79),fill=ink,width=4);d.line((141,79,150,79),fill=ink,width=4);d.arc((112,90,145,110),0,180,fill=ink,width=3)
    d.line((128,150,128,310),fill=ink,width=3)
    if i==0:d.rectangle((15,149,48,265),outline=ink,width=4)
    if i==1:d.rectangle((80,12,177,39),outline=ink,width=4)
    if i==2:d.rectangle((148,177,186,209),outline=ink,width=4)
    if i==3:d.ellipse((93,61,124,91),outline=ink,width=3)
    im.save(O/f'v{i}.png');imports.append(f"import v{i} from './v{i}.png'")
im=Image.new('RGBA',(960,640),'#292532');d=ImageDraw.Draw(im)
d.rectangle((280,50,650,520),outline=ink,width=4);d.rectangle((30,80,230,270),outline=ink,width=4)
for y in range(85,500,35):d.line((290,y,640,y),fill='#443c49',width=3)
d.line((0,525,960,525),fill=ink,width=4);im.save(O/'counter.png')
for name in ['terminal','magnifier']:
    im=Image.new('RGBA',(160,160));d=ImageDraw.Draw(im)
    if name=='terminal':
        d.rectangle((28,23,133,100),outline=ink,width=4);d.polygon([(28,100),(133,100),(151,140),(10,140)],outline=ink,width=4)
    else:
        d.ellipse((55,10,145,100),outline=ink,width=5);d.line((68,86,18,140),fill=ink,width=12)
    im.save(O/f'{name}.png')
    # Until the production pass, every slot remains a sketch.
    target=R/f'src/assets/room/{name}.png'
    if not target.exists():shutil.copy2(O/f'{name}.png',target)
imports += ["import counter from './counter.png'","import terminal from './terminal.png'","import magnifier from './magnifier.png'"]
imports += ['export const sketchItems: Record<string,string> = {'+','.join(f'p{i}' for i in range(24))+'}',"export const sketchVisitors: Record<string,string> = {拾荒者:v0,船员:v1,商人:v2,收藏家:v3}",'export const sketchRoom=counter','export const sketchTerminal=terminal','export const sketchMagnifier=magnifier']
(O/'index.ts').write_text('\n'.join(imports)+'\n','utf-8')
