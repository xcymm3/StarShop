# StarShop 原创像素资源

这些资源通过 `scripts/generate-pixel-assets.py` 独立绘制，参考原作截图的低饱和紫灰、青灰金属与暖色纸张配色，以及柜台/货架的功能关系；没有嵌入原作贴图、字体、角色图或截图像素。

- `items/p0..p23`：24 种 48×48 透明商品图。
- `visitors/v0..v3`：64×96 透明上半身立绘，分别用于拾荒者、船员、商人、收藏家。
- `room/counter`：320×220 柜台背景，前景不含来客，中央台面留作商品展示。
- 同名 SVG 为可编辑矢量绘图源，PNG 用于 H5/微信小程序。
- `preview-contact-sheet.png` 为开发查看联系表，不由产品代码引用。

复现需要 Python + Pillow：`python scripts/generate-pixel-assets.py`。像素图建议 `image-rendering: pixelated`，不要使用平滑拉伸。
