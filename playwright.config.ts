import { defineConfig, devices } from '@playwright/test'

// Needs `supabase start` running. Tests run against a production build, which hydrates
// quickly and consistently; an already running server on :3000 is reused.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    ...devices['Pixel 7'],
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : undefined,
  },
  webServer: {
    command: 'pnpm build && PORT=3000 pnpm start',
    url: 'http://localhost:3000/login',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
