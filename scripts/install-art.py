"""Package approved/generated masters at runtime sizes and build local comparison books."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,shutil,hashlib,base64,html
R=Path(__file__).resolve().parents[1]
LOCAL=Path(r'D:/mydoc/probably-stolen-rea/starshop-art')
PILOT=LOCAL.parent/'art-pilot'
reuse={'v0':'04-scavenger','terminal':'05-terminal','magnifier':'01-magnifier'}
for ident,stem in reuse.items():shutil.copy2(PILOT/'redraws'/f'{stem}.png',LOCAL/'masters'/f'{ident}.png')
manifest=json.loads((R/'docs/素材清单.json').read_text('utf-8'))
missing=[x['id'] for x in manifest if not (LOCAL/'masters'/f"{x['id']}.png").exists()]
if missing:raise SystemExit('Missing masters: '+', '.join(missing))
runtime_bytes=0
for row in manifest:
    master=LOCAL/'masters'/f"{row['id']}.png"
    im=Image.open(master).convert('RGBA')
    if row['id']=='counter':
        # Keep the entire generated composition. Master should be 3:2; fit without stretching.
        bg=Image.new('RGBA',tuple(row['runtime_size']),'#292532')
        scale=min(bg.width/im.width,bg.height/im.height)
        thumb=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
        bg.alpha_composite(thumb,((bg.width-thumb.width)//2,(bg.height-thumb.height)//2))
    else:
        assert im.getchannel('A').getextrema()[0]==0,f'No transparency: {row["id"]}'
        bounds=im.getchannel('A').point(lambda a:255 if a>=128 else 0).getbbox()
        assert bounds, f'Blank asset: {row["id"]}'
        im=im.crop(bounds)
        bg=Image.new('RGBA',tuple(row['runtime_size']))
        scale=min(bg.width*.92/im.width,bg.height*.94/im.height)
        thumb=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
        x=(bg.width-thumb.width)//2
        y=bg.height-thumb.height if row['id'].startswith('v') else (bg.height-thumb.height)//2
        bg.alpha_composite(thumb,(x,y))
    target=R/'src/assets'/row['runtime'];target.parent.mkdir(parents=True,exist_ok=True)
    # Palette conversion is packaging, not a creative redraw; preserve the full master.
    bg.quantize(colors=256,method=Image.Quantize.FASTOCTREE,dither=Image.Dither.NONE).save(target,optimize=True)
    sha=hashlib.sha256(target.read_bytes()).hexdigest()
    assert sha!=row['source_sha256'],f'Source image accidentally packaged: {row["id"]}'
    if row['id'] not in ['p0','p1','p2','counter'] and row['id'] not in reuse and not row['prompt'].endswith(' No glow, halo or background shading outside the object.'):
        row['prompt']+=' No glow, halo or background shading outside the object.'
    if row['id'] in reuse:
        prior=json.loads((PILOT/'prompts.json').read_text('utf-8'))['prompts'][reuse[row['id']]]
        row['prompt']=prior if isinstance(prior,str) else json.dumps(prior,ensure_ascii=False)
    row.update(status='installed',generation='approved-pilot-reuse' if row['id'] in reuse else 'built-in-image_gen',master_sha256=hashlib.sha256(master.read_bytes()).hexdigest(),runtime_sha256=sha,runtime_bytes=target.stat().st_size)
    runtime_bytes+=row['runtime_bytes']
(R/'docs/素材清单.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n','utf-8')
font=lambda n:ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',n)
board=Image.new('RGB',(1600,((len(manifest)+5)//6)*260+70),'#292532');d=ImageDraw.Draw(board)
d.text((24,15),'StarShop · 31 项原创运行时素材',font=font(27),fill='#ede4c6')
for i,row in enumerate(manifest):
    x=(i%6)*266;y=(i//6)*260+70
    d.text((x+12,y+5),row['id']+' '+row['name'],font=font(18),fill='#a4cebe')
    im=Image.open(R/'src/assets'/row['runtime']).convert('RGBA');bb=im.getchannel('A').point(lambda a:255 if a>=128 else 0).getbbox();im=im.crop(bb)
    scale=min(230/im.width,192/im.height);im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
    board.paste(im,(x+(266-im.width)//2,y+36+(192-im.height)//2),im)
    d.text((x+12,y+235),str(row['runtime_size'])+' · '+str(row['runtime_bytes']//1024)+' KB',font=font(13),fill='#bcb5c6')
board.save(R/'docs/原创素材总览.jpg',quality=92)
shutil.copy2(R/'docs/原创素材总览.jpg',LOCAL/'original-art-catalog.jpg')
def embed(path):return 'data:image/png;base64,'+base64.b64encode(path.read_bytes()).decode()
head='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>StarShop 素材册</title><style>body{margin:24px;background:#292532;color:#ede4c6;font:16px system-ui}article{border-top:1px solid #789c99;padding:20px 0}section{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}figure{margin:0;background:#37313e;padding:12px}img{width:100%;height:260px;object-fit:contain}figcaption{color:#a4cebe}p{line-height:1.7}@media(max-width:600px){section{grid-template-columns:1fr}img{height:220px}}</style><h1>StarShop · 31 项素材对照册</h1><p>依次展示简笔占位、Unity 真实参考、原创替换；参考按用途或材质选择，不代表同一物品。高清原创原稿保留在 masters 目录。</p>'''
parts=[head]
for row in manifest:
    parts.append('<article><h2>'+html.escape(row['id']+' '+row['name'])+'</h2><section>')
    sketch=R/'src/assets/sketches'/f"{row['id']}.png"
    for label,path in [('简笔占位',sketch),('Unity 真实参考',LOCAL/'originals'/f"{row['id']}.png"),('原创替换',R/'src/assets'/row['runtime'])]:
        parts.append('<figure><img src="'+embed(path)+'"><figcaption>'+label+'</figcaption></figure>')
    parts.append('</section><p>'+html.escape(f"{row['usage']}；来源 {row['source']['file']} / {row['source']['path_id']} / {row['source']['name']}；运行时 {row['runtime_size']}")+'</p></article>')
(LOCAL/'comparison-catalog.html').write_text('\n'.join(parts)+'</html>','utf-8')
(LOCAL/'prompt-set.json').write_text(json.dumps({x['id']:x['prompt'] for x in manifest},ensure_ascii=False,indent=2),'utf-8')
print(f'Installed {len(manifest)} original assets, total {runtime_bytes:,} bytes')
