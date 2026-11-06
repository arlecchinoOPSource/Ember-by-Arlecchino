import { expect, test } from '@playwright/test';

/** Counts every Web Audio cue that actually starts, by file. */
const countCues = () => {
  const target = window as Window & { emberCues: string[] };
  target.emberCues = [];
  const decode = AudioContext.prototype.decodeAudioData;
  const names = new WeakMap<AudioBuffer, string>();
  const originalFetch = window.fetch;
  let last = '';
  window.fetch = (input, init) => { last = String(input); return originalFetch(input, init); };
  AudioContext.prototype.decodeAudioData = function (data: ArrayBuffer) {
    const name = last;
    return decode.call(this, data).then(buffer => { names.set(buffer, name); return buffer; });
  } as typeof decode;
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...args: Parameters<typeof start>) {
    target.emberCues.push((this.buffer && names.get(this.buffer)?.match(/(\w+)[-.]\w*\.wav/)?.[1]) || 'cue');
    return start.apply(this, args);
  };
};
const cues = (page: import('@playwright/test').Page) => page.evaluate(() => (window as Window & { emberCues: string[] }).emberCues.length);

test('Sounds popup matches Terminal: master switch, cue switches with previews, choices persist', async ({ page }) => {
  await page.addInitScript(countCues);
  await page.goto('/');
  await expect(page.locator('.save-status')).toHaveText('READY');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('.settings-dock')).not.toContainText(/sound/i);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Sounds' }).click();
  const dialog = page.getByRole('dialog', { name: 'Sounds' });
  await expect(dialog.getByRole('switch', { name: /Sound/ })).toBeChecked();
  await expect(dialog.getByText('INTERFACE', { exact: true })).toBeVisible();
  for (const name of ['Interface', 'Completion', 'Error', 'Close', 'Startup']) await expect(dialog.getByRole('button', { name: `Preview ${name} sound` })).toBeVisible();
  await expect(dialog.getByRole('slider', { name: 'Master volume' })).toBeVisible();
  await expect(dialog.getByRole('slider', { name: 'Interface volume' })).toBeVisible();
  await expect(dialog.getByRole('checkbox', { name: 'Startup sound' })).toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: 'Close sound' })).toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: 'Completion sound' })).not.toBeChecked();

  // ▶ plays on press, even with that cue switched off, and is not doubled by the interface cue.
  const before = await cues(page);
  await dialog.getByRole('button', { name: 'Preview Completion sound' }).click();
  await expect.poll(() => cues(page)).toBe(before + 1);

  await dialog.getByRole('checkbox', { name: 'Interface sound' }).check();
  await page.keyboard.press('Escape');
  const pressed = await cues(page);
  await page.getByRole('button', { name: 'Today' }).click();
  await expect.poll(() => cues(page)).toBeGreaterThan(pressed);

  await page.getByRole('button', { name: 'Sounds' }).click();
  await dialog.getByRole('switch', { name: /Sound/ }).uncheck();
  await expect(dialog).toContainText('OFF');
  await page.keyboard.press('Escape');
  const muted = await cues(page);
  await page.getByRole('button', { name: 'Today' }).click();
  await page.waitForTimeout(200);
  expect(await cues(page)).toBe(muted);
  await page.reload();
  await page.getByRole('button', { name: 'Sounds' }).click();
  await expect(dialog.getByRole('checkbox', { name: 'Interface sound' })).toBeChecked();
  await expect(dialog.getByRole('switch', { name: /Sound/ })).not.toBeChecked();
});

test('cues start on press, before the button is released', async ({ page }) => {
  await page.addInitScript(countCues);
  await page.goto('/');
  await expect(page.locator('.save-status')).toHaveText('READY');
  await page.getByRole('button', { name: 'Sounds' }).click();
  await page.getByRole('dialog', { name: 'Sounds' }).getByRole('checkbox', { name: 'Interface sound' }).check();
  await page.keyboard.press('Escape');
  const box = (await page.getByRole('button', { name: 'Today' }).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const before = await cues(page);
  await page.mouse.down();
  await expect.poll(() => cues(page), { timeout: 250 }).toBe(before + 1);
  await page.mouse.up();
  await page.waitForTimeout(100);
  expect(await cues(page)).toBe(before + 1);
});

test('Full, Reduced, Off, and OS reduced motion keep navigation and focus usable', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-06T10:00:00') });
  await page.goto('/');
  await expect(page.locator('.save-status')).toHaveText('READY');
  const next = page.getByRole('button', { name: /^Next month/ });
  await next.click();
  await expect(next).toBeFocused();
  expect(await page.locator('.month-title').evaluate(e => getComputedStyle(e).animationName)).toBe('ember-month-in');
  await page.getByRole('button', { name: 'Settings' }).click();
  const dock = page.locator('.settings-dock');
  expect(await dock.evaluate(e => getComputedStyle(e).animationName)).toBe('panel-in');
  await page.getByRole('group', { name: /Motion/ }).getByRole('radio', { name: 'Reduced' }).check();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  expect(await dock.evaluate(e => getComputedStyle(e).animationName)).toBe('none');
  await page.getByRole('group', { name: /Motion/ }).getByRole('radio', { name: 'Off' }).check();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  expect(await page.locator('.check').first().evaluate(e => getComputedStyle(e).transitionDuration)).toMatch(/^0s/);
  await page.getByRole('group', { name: /Motion/ }).getByRole('radio', { name: 'Full' }).check();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  await page.getByRole('button', { name: 'Close settings' }).click();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
  await next.click(); await next.click(); await next.click();
  await expect(next).toBeFocused();
  await expect(page.locator('.month-title')).toHaveText('March 2027');
});

test('Themes and Sounds popups open in the middle while Settings stays docked', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.startup')).toHaveCount(0);
  for (const [button, panel] of [['Sounds', '.ember-sounds-popover'], ['Themes', '.ember-theme-popover']] as const) {
    await page.getByRole('button', { name: button }).click();
    const offset = await page.locator(panel).evaluate(element => {
      const box = element.getBoundingClientRect();
      const shell = document.querySelector('.app-shell')!.getBoundingClientRect();
      return { x: Math.abs(box.left + box.width / 2 - (shell.left + shell.width / 2)), y: Math.abs(box.top + box.height / 2 - (shell.top + shell.height / 2)) };
    });
    expect(offset.x).toBeLessThan(2);
    expect(offset.y).toBeLessThan(2);
    await page.keyboard.press('Escape');
  }
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.locator('.settings-dock')).toBeVisible();
  const dockOffset = await page.locator('.settings-dock').evaluate(element => element.getBoundingClientRect().left - element.parentElement!.getBoundingClientRect().left);
  expect(Math.abs(dockOffset)).toBeLessThan(2);
});
