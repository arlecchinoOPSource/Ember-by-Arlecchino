import { expect, test, type Page } from '@playwright/test';

// Synthetic data comes from src/preview/sampleNative.ts (dates relative to the mocked "today").
let mod = 'Control';

async function open(page: Page, isoNow = '2026-12-31T10:00:00') {
  await page.clock.install({ time: new Date(isoNow) });
  await page.goto('/');
  await expect(statusBar(page)).toHaveText('READY');
  // The app uses ⌘ where the browser reports a Mac, Ctrl elsewhere.
  mod = await page.evaluate(() => /Mac|iPhone|iPad/.test(navigator.platform)) ? 'Meta' : 'Control';
}
const title = (page: Page) => page.locator('.month-title');
const statusBar = (page: Page) => page.locator('.save-status');
const grid = (page: Page) => page.getByRole('grid');
const columnNames = (page: Page) => page.locator('thead th .habit-name').allTextContents();

test('month, year and Today navigation cross year boundaries', async ({ page }) => {
  await open(page);
  await expect(title(page)).toHaveText('December 2026');
  await page.getByRole('button', { name: /^Next month/ }).click();
  await expect(title(page)).toHaveText('January 2027');
  await page.getByRole('button', { name: /^Previous month/ }).click();
  await page.getByRole('button', { name: /^Previous month/ }).click();
  await expect(title(page)).toHaveText('November 2026');
  await page.getByRole('button', { name: 'Next year, November 2027' }).click();
  await expect(title(page)).toHaveText('November 2027');
  await page.getByRole('button', { name: 'Today' }).click();
  await expect(title(page)).toHaveText('December 2026');
  // Keyboard shortcuts, outside text fields.
  await page.keyboard.press(`${mod}+ArrowRight`);
  await expect(title(page)).toHaveText('January 2027');
  await page.keyboard.press(`${mod}+Shift+ArrowLeft`);
  await expect(title(page)).toHaveText('January 2026');
  await page.keyboard.press(`${mod}+t`);
  await expect(title(page)).toHaveText('December 2026');
  // Archive panel: year stepper and month list.
  await page.getByRole('button', { name: 'Previous year, 2025' }).click();
  await page.getByRole('button', { name: /^03\s*March/ }).click();
  await expect(title(page)).toHaveText('March 2025');
  await expect(page.getByRole('button', { name: /^03\s*March/ })).toHaveAttribute('aria-current', 'date');
});

test('the grid is one Tab stop with arrow-key movement, and toggling keeps focus', async ({ page }) => {
  await open(page);
  await expect(grid(page).locator('button[tabindex="0"]')).toHaveCount(1);
  const start = grid(page).locator('button[tabindex="0"]');
  await expect(start).toHaveAttribute('data-date', '2026-12-31');
  await start.focus();
  await page.keyboard.press('ArrowUp');
  const cell = page.locator(':focus');
  await expect(cell).toHaveAttribute('data-date', '2026-12-30');
  await expect(cell).toHaveAccessibleName(/^Workout, Wednesday,? 30 December 2026|^Workout, Wednesday, December 30, 2026/);
  const before = await cell.getAttribute('aria-pressed');
  await page.keyboard.press('Space');
  await expect(statusBar(page)).toHaveText('SAVED');
  await expect(cell).toHaveAttribute('aria-pressed', before === 'true' ? 'false' : 'true');
  await expect(cell).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator(':focus')).toHaveAccessibleName(/^Read, /);
  await page.keyboard.press(`${mod}+Home`);
  await expect(page.locator(':focus')).toHaveAttribute('data-date', '2026-12-01');
  await page.keyboard.press('PageDown');
  await expect(page.locator(':focus')).toHaveAttribute('data-date', '2026-12-08');
  await page.keyboard.press('End');
  await expect(page.locator(':focus')).toHaveAccessibleName(/^Compose, /);
});

test('future and inactive days are announced, focusable, and cannot be toggled', async ({ page }) => {
  await open(page, '2026-12-15T10:00:00');
  const future = grid(page).locator('button[data-date="2026-12-20"]').first();
  await expect(future).toHaveAttribute('aria-disabled', 'true');
  await expect(future).toHaveAccessibleName(/future date$/);
  await future.focus();
  await page.keyboard.press('Space');
  await expect(future).toHaveAttribute('aria-pressed', 'false');
  await expect(statusBar(page)).toHaveText('READY');
});

test('an active habit can be checked on an earlier day', async ({ page }) => {
  await open(page, '2026-11-06T10:00:00');
  await page.getByRole('button', { name: 'Add habit' }).click();
  await page.getByRole('textbox', { name: 'Habit name' }).fill('Backfill test');
  await page.getByRole('button', { name: 'Save habit' }).click();
  const cell = grid(page).getByRole('button', { name: /^Backfill test, Thursday, November 5, 2026/ });
  await expect(cell).not.toHaveAttribute('aria-disabled', 'true');
  await cell.click();
  await expect(cell).toHaveAttribute('aria-pressed', 'true');
  await expect(statusBar(page)).toHaveText('READY');
});

test('columns follow the saved order; archived habits stay in their historical months', async ({ page }) => {
  await open(page);
  // "Old routine" was archived on 1 December (today − 30 days): visible in December and November, gone in January.
  expect(await columnNames(page)).toEqual(['Workout', 'Read', 'Guitar', 'Meditate', 'Old routine', 'Compose']);
  await expect(page.locator('thead th.archived-habit')).toContainText('ARCHIVED');
  await page.keyboard.press(`${mod}+ArrowRight`);
  expect(await columnNames(page)).toEqual(['Workout', 'Read', 'Guitar', 'Meditate', 'Compose']);
  await page.keyboard.press(`${mod}+t`);
  await page.getByRole('button', { name: 'Manage habits' }).click();
  await page.getByRole('button', { name: 'Move Workout right' }).click();
  await expect(statusBar(page)).toHaveText('SAVED');
  expect(await columnNames(page)).toEqual(['Read', 'Workout', 'Guitar', 'Meditate', 'Old routine', 'Compose']);
});

test('rename is inline and archive asks in a dialog, both by keyboard', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Manage habits' }).click();
  await page.getByRole('button', { name: 'Rename Guitar' }).click();
  const field = page.getByLabel('New name for Guitar');
  await expect(field).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Rename Guitar' })).toBeFocused();
  await page.keyboard.press('Enter');
  await field.fill('Lead guitar');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('columnheader', { name: 'Lead guitar' })).toBeVisible();
  await page.getByRole('button', { name: 'Archive Meditate' }).click();
  const dialog = page.getByRole('dialog', { name: 'Archive Meditate?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await dialog.getByRole('button', { name: 'Archive' }).click();
  await expect(page.locator('.habit-list')).not.toContainText('Meditate');
  await expect(page.locator('.archived-list summary')).toHaveText('Archived (2)');
  // Still a column this month: today is its last active day.
  await expect(page.getByRole('columnheader', { name: /Meditate/ })).toContainText('ARCHIVED');
});

test('side panels collapse, keep essential controls, and remember the choice', async ({ page }) => {
  await open(page);
  const gridWidth = async () => (await page.locator('.grid-area').boundingBox())!.width;
  const wide = await gridWidth();
  await page.getByRole('button', { name: 'Collapse archive / 2026' }).click();
  await page.getByRole('button', { name: 'Collapse monthly / december' }).click();
  expect(await gridWidth()).toBeGreaterThan(wide + 300);
  await expect(page.getByRole('button', { name: 'Expand archive / 2026' })).toHaveAttribute('aria-expanded', 'false');
  for (const name of [/^Previous month/, /^Next month/, /^Previous year/, /^Next year/, 'Today']) await expect(page.getByRole('button', { name }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Expand archive / 2026' })).toBeVisible();
  await page.getByRole('button', { name: 'Expand archive / 2026' }).click();
  await expect(page.getByRole('button', { name: /^03\s*March/ })).toBeVisible();
});

test('small windows: panels start collapsed and open over the grid', async ({ page }) => {
  await page.setViewportSize({ width: 680, height: 520 });
  await open(page);
  await expect(page.getByRole('button', { name: 'Expand archive / 2026' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Expand monthly/ })).toBeVisible();
  for (const name of [/^Previous month/, /^Next month/, 'Today', 'Add habit']) await expect(page.getByRole('button', { name }).first()).toBeInViewport();
  const before = (await page.locator('.grid-area').boundingBox())!;
  await page.getByRole('button', { name: 'Calendar archive' }).click();
  await expect(page.locator('.left-panel')).toHaveAttribute('data-open', 'true');
  expect((await page.locator('.grid-area').boundingBox())!.width).toBe(before.width);
  await page.getByRole('button', { name: /^02\s*February/ }).click();
  await expect(title(page)).toHaveText('February 2026');
  await expect(page.locator('.left-panel')).toHaveAttribute('data-open', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a failed save says so, changes nothing, and reload recovers', async ({ page }) => {
  await open(page);
  await page.getByLabel('Simulate save failure').check();
  const cell = grid(page).locator('button[data-date="2026-12-30"]').first();
  const before = await cell.getAttribute('aria-pressed');
  await cell.click();
  await expect(page.getByRole('status').filter({ hasText: 'NOT SAVED' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('simulated save failure');
  await expect(cell).toHaveAttribute('aria-pressed', before!);
  await page.getByLabel('Simulate save failure').uncheck();
  await page.getByRole('button', { name: 'Reload saved data' }).click();
  await expect(statusBar(page)).toHaveText('READY');
});

test('reduced motion turns animation off; text scaling keeps the layout usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  expect(await page.locator('.wordmark-glow').evaluate(e => getComputedStyle(e).animationName)).toBe('none');
  expect(await page.locator('.check').first().evaluate(e => getComputedStyle(e).transitionDuration)).toMatch(/^0s/);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => { document.documentElement.style.fontSize = '150%'; });
  await expect(page.getByRole('button', { name: 'Today' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // The grid scrolls inside its frame rather than overflowing the window.
  const box = (await page.locator('.grid-area').boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(1160);
});

test('preferences survive reopening and optional audio failure leaves the completion saved', async ({ page }) => {
  await open(page);
  const settings = page.getByRole('button', { name: 'Settings', exact: true });
  await page.getByRole('button', { name: 'Sounds' }).click();
  await expect(page.getByRole('checkbox', { name: 'Completion sound' })).not.toBeChecked();
  await page.getByRole('checkbox', { name: 'Completion sound' }).check();
  await page.keyboard.press('Escape');
  await settings.click();
  await page.getByRole('group', { name: /Motion/ }).getByRole('radio', { name: 'Off' }).check();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Themes' }).click();
  await page.getByRole('button', { name: /Terminal Mint/ }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'mint');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
  await page.getByRole('button', { name: 'Sounds' }).click();
  await expect(page.getByRole('checkbox', { name: 'Completion sound' })).toBeChecked();
  await page.keyboard.press('Escape');
  await page.evaluate(() => { AudioBufferSourceNode.prototype.start = () => { throw new Error('Audio unavailable'); }; });
  const cell = grid(page).locator('button[data-date="2026-12-31"]').first();
  await cell.click();
  await expect(cell).toHaveAttribute('aria-pressed', 'true');
  await expect(statusBar(page)).toHaveText('SAVED');
});

test('Terminal parity: centred wordmark, rail order, and Settings docked at the left', async ({ page, browserName }) => {
  for (const size of [{ width: 1160, height: 780 }, { width: 680, height: 500 }]) {
    await page.setViewportSize(size);
    await open(page);
    const strip = (await page.locator('.identity-strip').boundingBox())!;
    const mark = (await page.locator('.identity-strip .wordmark').boundingBox())!;
    expect(Math.abs((mark.x + mark.width / 2) - (strip.x + strip.width / 2))).toBeLessThan(2);
    const text = await page.locator('#root').innerText();
    for (const gone of ['HABIT SYSTEM', 'ONE DAY AT A TIME', 'LOCAL DATA', '· 30 DAYS', '· 31 DAYS']) expect(text).not.toContain(gone);
    await expect(statusBar(page)).toHaveText('READY');
    const settings = page.getByRole('button', { name: 'Settings' });
    await expect(settings).toBeInViewport();
    const rail = (await page.locator('.rail').boundingBox())!;
    const box = (await settings.boundingBox())!;
    expect(rail.y + rail.height - (box.y + box.height)).toBeLessThan(16);
    const themesBox = (await page.getByRole('button', { name: 'Themes' }).boundingBox())!;
    const addBox = (await page.getByRole('button', { name: 'Add habit', exact: true }).boundingBox())!;
    expect(themesBox.y + themesBox.height).toBeLessThan(addBox.y);
  }
  // Keyboard: Settings is reachable and shows a visible focus ring.
  await page.getByRole('button', { name: 'Add habit', exact: true }).focus();
  // macOS WebKit uses Option-Tab to include buttons with default keyboard preferences.
  await page.keyboard.press(browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab');
  const settings = page.getByRole('button', { name: 'Settings' });
  await expect(settings).toBeFocused();
  expect(await settings.evaluate(e => getComputedStyle(e).outlineStyle)).toBe('solid');
  await page.keyboard.press('Enter');
  const dock = page.getByRole('complementary', { name: 'Settings' });
  await expect(dock).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Full' })).toBeVisible();
  const panel = (await dock.boundingBox())!;
  const workspace = (await page.locator('.workspace').boundingBox())!;
  expect(Math.abs(panel.x - workspace.x)).toBeLessThan(2);
  expect(panel.y).toBeGreaterThanOrEqual(workspace.y);
  expect(panel.x + panel.width).toBeLessThanOrEqual(680);
  expect(panel.y + panel.height).toBeLessThanOrEqual(500);
  await page.getByRole('button', { name: 'Choose theme' }).click();
  await expect(page.getByRole('dialog', { name: 'Themes' })).toBeVisible();
  // Everyday text uses the reading faces; Orbitron stays for the wordmark and short headings.
  const font = (selector: string) => page.locator(selector).first().evaluate(e => getComputedStyle(e).fontFamily);
  expect(await font('thead th')).toContain('IBM Plex Sans');
  expect(await font('.month-title')).toContain('IBM Plex Sans Condensed');
  expect(await font('.wordmark')).toContain('Orbitron');
});

test('minimum width at 150% keeps navigation reachable and wide habits scroll within the grid', async ({ page }) => {
  await page.setViewportSize({ width: 680, height: 500 });
  await open(page);
  await page.evaluate(() => { document.documentElement.style.fontSize = '150%'; });
  for (const control of await page.locator('.rail button, .toolbar button, .panel-toggle').all()) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(681);
    expect(box!.y + box!.height).toBeLessThanOrEqual(501);
  }
  const last = page.locator('tbody tr').first().getByRole('button').last();
  await last.focus();
  await expect(last).toBeFocused();
  await expect(last).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(680);
});
