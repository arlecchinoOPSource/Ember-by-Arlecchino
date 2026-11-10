import { defineConfig, devices } from '@playwright/test';

// UI tests drive the real React interface against the browser preview build, whose native
// commands are replaced by synthetic in-memory data (src/preview). They verify layout, keyboard
// and accessibility behaviour; native persistence is covered by cargo test and npm run test:native.
// EMBER_CHROMIUM points at an already-installed Chromium where `npx playwright install` is not available.
const port = 4320;
const executablePath = process.env.EMBER_CHROMIUM;
export default defineConfig({
  testDir: 'tests/ui',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list']] : 'line',
  use: { baseURL: `http://localhost:${port}`, trace: 'retain-on-failure', viewport: { width: 1160, height: 780 } },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1160, height: 780 }, launchOptions: {
      // The desktop shells do not gate audio behind a click; keep the browser preview's autoplay
      // policy out of the startup/close sound assertions.
      args: ['--autoplay-policy=no-user-gesture-required'],
      ...(executablePath ? { executablePath } : {}),
    } } },
    // WebKit is the engine of the macOS app; run it where Playwright's WebKit is installed.
    ...(process.env.EMBER_WEBKIT ? [{ name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1160, height: 780 } } }] : []),
  ],
  // The tests run against the production preview build, not the Vite dev server: on the Linux CI runner
  // WebKit rendered the unminified dev build (React development mode, about 60 module requests) at about
  // one frame a second, so every click waited seconds and the job timed out differently on each run.
  webServer: { command: `npm run build:preview && npx vite preview --mode preview --outDir dist-preview --port ${port} --strictPort`, url: `http://localhost:${port}`, reuseExistingServer: false, timeout: 120_000 },
});
