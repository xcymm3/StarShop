import { defineConfig } from '@tarojs/cli'
import type { ResolvedConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import path from 'node:path'

const demo = process.env.STARSHOP_DEMO === '1'

export default defineConfig<'vite'>({
  projectName: 'StarShop',
  date: '2026-11-13',
  designWidth: 750,
  deviceRatio: { 640: 1.17, 750: 1, 375: 2, 828: 0.905 },
  sourceRoot: 'src',
  outputRoot: demo ? 'dist/demo' : `dist/${process.env.TARO_ENV || 'weapp'}`,
  framework: 'react',
  defineConstants: {
    __SKETCH_ART__: JSON.stringify(process.env.STARSHOP_ART === 'sketch'),
  },
  compiler: {
    type: 'vite',
    vitePlugins: [
      {
        name: 'starshop-no-browser-launch',
        configResolved(config: ResolvedConfig) {
          if (demo) {
            const output = config.build.rollupOptions.output
            for (const item of Array.isArray(output) ? output : [output]) {
              if (item) {
                item.manualChunks = undefined
                item.inlineDynamicImports = true
              }
            }
          }
          if (config.command === 'serve' && config.server.open !== false) {
            throw new Error(
              'StarShop 开发服务禁止自动打开浏览器，请检查 h5.devServer.open',
            )
          }
        },
      },
      ...(demo ? [viteSingleFile()] : []),
    ],
  },
  plugins: [],
  mini: {
    imageUrlLoaderOption: {
      limit: 0,
      name: (filename: string) =>
        `assets/${path.basename(filename.split('\\').join('/'))}`,
    },
    postcss: { pxtransform: { enable: true }, cssModules: { enable: false } },
  },
  h5: {
    imageUrlLoaderOption: { limit: 1000000 },
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
