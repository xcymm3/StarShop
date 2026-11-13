# StarShop

空间站商店模拟经营游戏。当前仅搭建开发环境，首页为占位内容，尚未实现玩法。

## 技术栈

Taro 4.3.2、React 18、TypeScript、Vite。支持 H5 调试与微信小程序构建。

## 本地使用

需要 Node.js 22 和 npm 10。在项目根目录执行：

```sh
npm ci
npm run dev:h5
```

开发服务不自动打开浏览器。请自行访问终端输出的本地地址，默认端口 10086。

```sh
npm run typecheck
npm run build:h5
npm run build:weapp
npm run check
```

H5 产物位于 `dist/h5`，微信小程序产物位于 `dist/weapp`，两者互不覆盖。

## 微信小程序

运行 `npm run dev:weapp` 持续编译，由使用者自行打开微信开发者工具并导入本项目根目录。`project.config.json` 使用游客 AppID，仅用于本地搭建；正式预览、上传和发布前需设置自己的 AppID，按需通过 `TARO_APP_ID` 环境变量配置。

微信开发者工具的 ES6 转换、样式补全和代码压缩已关闭，由 Taro 构建处理。未验证开发者工具导入、真机运行或微信发布。

## 目录

- `config/`：跨端构建配置。
- `src/`：应用入口与页面。
- `types/`：项目类型声明。
- `.github/workflows/`：安装依赖、类型检查及双端构建。

后续经营规则独立于界面实现，存档等平台能力通过适配层封装。本项目不依赖原游戏文件。
