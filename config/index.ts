import { defineConfig } from '@tarojs/cli'
import type { ResolvedConfig } from 'vite'

export default defineConfig<'vite'>({
  projectName: 'StarShop',
  date: '2026-11-13',
  designWidth: 750,
  deviceRatio: { 640: 1.17, 750: 1, 375: 2, 828: 0.905 },
  sourceRoot: 'src',
  outputRoot: `dist/${process.env.TARO_ENV || 'weapp'}`,
  framework: 'react',
  compiler: {
    type: 'vite',
    vitePlugins: [
      {
        name: 'starshop-no-browser-launch',
        configResolved(config: ResolvedConfig) {
          if (config.command === 'serve' && config.server.open !== false) {
            throw new Error(
              'StarShop 开发服务禁止自动打开浏览器，请检查 h5.devServer.open',
            )
          }
        },
      },
    ],
  },
  plugins: [],
  mini: {
    postcss: { pxtransform: { enable: true }, cssModules: { enable: false } },
  },
  h5: {
    devServer: {
      host: '127.0.0.1',
      port: 10086,
      open: false,
      strictPort: true,
    },
    publicPath: '/',
    staticDirectory: 'static',
    router: { mode: 'hash' },
  },
})
