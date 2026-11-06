import { expect, test } from '@playwright/test';

const startup = (page: import('@playwright/test').Page) => page.locator('.startup');
const status = (page: import('@playwright/test').Page) => page.locator('.save-status');

test('first launch shows Ember startup and leaves when local habits are ready', async ({ page }) => {
  await page.goto('/?startupDelay=650');
  await expect(startup(page)).toBeVisible();
  await expect(startup(page)).toContainText('OPENING HABITS');
  await expect(startup(page)).toHaveAttribute('data-animated', 'true');
  await expect(startup(page).locator('.startup-wordmark')).toHaveText('EMBER');
  await expect(status(page)).toHaveText('READY');
  await expect(startup(page)).toBeVisible();
  await expect(startup(page)).toHaveCount(0, { timeout: 2400 });
  await expect(status(page)).toHaveText('READY');
});

test('slow local loading reports its real state, and a key skips the screen', async ({ page }) => {
  await page.goto('/?startupDelay=5600');
  await expect(startup(page)).toContainText('STILL OPENING HABITS', { timeout: 5500 });
  await expect(status(page)).toHaveText('OPENING');
  await page.keyboard.press('a');
  await expect(startup(page)).toHaveCount(0);
  await expect(status(page)).toHaveText('READY', { timeout: 2000 });
});

test('a local load failure reveals Retry, and retry opens the app', async ({ page }) => {
  await page.goto('/?startupFail=true');
  await expect(startup(page)).toHaveCount(0);
  await expect(status(page)).toHaveText('LOAD ERROR');
  await expect(page.getByRole('button', { name: 'Retry loading' })).toBeVisible();
  await page.evaluate(() => { (window as Window & { emberPreview: { failLoads: boolean } }).emberPreview.failLoads = false; });
  await page.getByRole('button', { name: 'Retry loading' }).click();
  await expect(status(page)).toHaveText('READY');
});

test('reduced motion removes startup animation without hiding loading feedback', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?startupDelay=650');
  await expect(startup(page)).toBeVisible();
  await expect(startup(page)).toHaveAttribute('data-animated', 'false');
  await expect(startup(page)).toContainText('OPENING HABITS');
  await expect(status(page)).toHaveText('READY');
  await expect(startup(page)).toHaveCount(0);
});

test('startup sound plays once per launch, independent of the startup screen, and rejected audio does not block launch', async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as Window & { startupPlayCount: number };
    state.startupPlayCount = 0;
    AudioBufferSourceNode.prototype.start = () => { state.startupPlayCount += 1; throw new Error('Audio unavailable'); };
  });
  const count = () => page.evaluate(() => (window as Window & { startupPlayCount: number }).startupPlayCount);
  await page.goto('/?startupDelay=2000');
  await expect(startup(page)).toBeVisible();
  await expect.poll(count).toBe(1);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('radio', { name: 'Off' }).last().check();
  await page.reload();
  await expect(status(page)).toHaveText('OPENING');
  await expect(startup(page)).toHaveCount(0);
  await expect.poll(count).toBe(1);
  await expect(status(page)).toHaveText('READY', { timeout: 3000 });
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('radio', { name: 'Off' }).last()).toBeChecked();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Sounds' }).click();
  await page.getByRole('checkbox', { name: 'Startup sound' }).uncheck();
  await page.reload();
  await expect(status(page)).toHaveText('READY', { timeout: 3000 });
  await page.waitForTimeout(300);
  expect(await count()).toBe(0);
});
