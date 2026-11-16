import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  outputDir: 'artifacts/browser-results',
  reporter: [['list']],
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
    baseURL: 'http://127.0.0.1:10086',
    launchOptions: {
      args: [
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--mute-audio',
      ],
    },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev:h5',
    url: 'http://127.0.0.1:10086/index.html',
    reuseExistingServer: false,
    timeout: 120000,
  },
})
