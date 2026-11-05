import { expect, test } from '@playwright/test';

test('archived habit deletion requires review and updates history only after save', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.save-status')).toHaveText('READY');
  await page.getByRole('button', { name: 'Manage habits' }).click();
  await page.getByText(/Archived \(1\)/).click();
  await page.getByRole('button', { name: 'Permanently delete Old routine' }).click();
  const dialog = page.getByRole('dialog', { name: 'Permanently delete Old routine?' });
  await expect(dialog).toContainText('completions');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Permanently delete Old routine' })).toBeVisible();
  await page.getByRole('button', { name: 'Permanently delete Old routine' }).click();
  await page.evaluate(() => { (window as Window & { emberPreview: { failWrites: boolean } }).emberPreview.failWrites = true; });
  await dialog.getByRole('button', { name: 'Permanently delete' }).click();
  await expect(page.locator('.save-status')).toHaveText('NOT SAVED');
  await expect(page.getByRole('button', { name: 'Permanently delete Old routine' })).toBeVisible();
  await page.evaluate(() => { (window as Window & { emberPreview: { failWrites: boolean } }).emberPreview.failWrites = false; });
  await page.getByRole('button', { name: 'Permanently delete Old routine' }).click();
  await dialog.getByRole('button', { name: 'Permanently delete' }).click();
  await expect(page.getByText('Old routine')).toHaveCount(0);
  await expect(page.locator('.save-status')).toHaveText('READY');
});
