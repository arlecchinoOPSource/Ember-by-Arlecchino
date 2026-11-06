import { expect, test } from '@playwright/test';

test('New Habit opens a centered popup, validates, cancels, and restores focus', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.save-status')).toHaveText('READY');
  const trigger = page.getByRole('button', { name: 'Add habit', exact: true });
  await trigger.click();
  const popup = page.getByRole('dialog', { name: 'New habit' });
  await expect(popup).toBeVisible();
  await expect(popup.getByRole('textbox', { name: 'Habit name' })).toBeFocused();
  const center = await popup.evaluate(element => { const box = element.getBoundingClientRect(); const shell = document.querySelector('.app-shell')!.getBoundingClientRect(); return Math.abs(box.left + box.width / 2 - shell.left - shell.width / 2); });
  expect(center).toBeLessThan(2);
  await popup.getByRole('button', { name: 'Save habit' }).click();
  await expect(popup.getByRole('alert')).toContainText('1–60');
  await popup.getByRole('textbox', { name: 'Habit name' }).fill('Read');
  await popup.getByRole('button', { name: 'Save habit' }).click();
  await expect(popup.getByRole('alert')).toContainText('already has this name');
  await page.keyboard.press('Escape');
  await expect(popup).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await popup.getByRole('textbox', { name: 'Habit name' }).fill('Temporary idea');
  await popup.getByRole('button', { name: 'Cancel' }).click();
  await expect(popup).toHaveCount(0);
  await expect(page.getByRole('grid')).not.toContainText('Temporary idea');
});

test('New Habit stays open on failed save and closes only after success', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.save-status')).toHaveText('READY');
  const trigger = page.getByRole('button', { name: 'Add habit', exact: true });
  await trigger.click();
  const popup = page.getByRole('dialog', { name: 'New habit' });
  await popup.getByRole('textbox', { name: 'Habit name' }).fill('Preview QA habit');
  await page.evaluate(() => { (window as Window & { emberPreview: { failWrites: boolean } }).emberPreview.failWrites = true; });
  await popup.getByRole('button', { name: 'Save habit' }).click();
  await expect(popup).toBeVisible();
  await expect(popup.getByRole('alert')).toContainText('could not save');
  await expect(page.locator('.save-status')).toHaveText('NOT SAVED');
  await page.evaluate(() => { (window as Window & { emberPreview: { failWrites: boolean } }).emberPreview.failWrites = false; });
  await popup.getByRole('button', { name: 'Save habit' }).click();
  await expect(popup).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(page.locator('.save-status')).toHaveText('SAVED');
  await expect(page.getByRole('grid')).toContainText('Preview QA habit');
});
