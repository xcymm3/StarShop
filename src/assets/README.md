# StarShop 美术资源

当前主界面以用户确认的竖屏风格参考为准。新增空店面和四顾客图集由内置image_gen绘制，提示词、分层和运行尺寸见 docs/主界面素材与布局.md。

- room/shop-portrait.png：852×1846空店面原稿；运行时使用同尺寸WebP。
- visitors/customers-sheet.png：1254×1254透明2×2顾客图集；运行时使用同尺寸WebP，alpha保持不变。
- items/p0..p23.png：此前认可的24项原创重绘商品，继续由真实库存位置驱动。
- visitors/v0..v3.png、room/counter.png、终端和放大镜：此前版本素材保留，放大镜继续用于检视面板。
- sketches/：历史简笔商品/顾客层；当前build:sketch沿用同一竖屏空店面，替换商品与人物为简笔层。
- 同名旧SVG是早期代码绘制源，不能宣称是当前AI原稿的可编辑源。generate-pixel-assets.py为历史方案，不覆盖当前正式素材。

不复制原Unity截图到产品。背景没有固定数字、顾客、商品或格线，均由真实交互层渲染。PNG原稿与运行WebP均保留；源码资源校验脚本的旧31项基线仍适用于旧素材，不涵盖新增两项。
