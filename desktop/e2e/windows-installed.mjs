// Runs only on the disposable Windows runner, against the installed WebView2 app.
import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';
const [exe, kind] = process.argv.slice(2);
const habit = 'Installer check ' + kind;
async function open(check) {
  const child = spawn(exe, [], {env:{...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9222'}});
  const stopped = once(child,'exit');
  let browser;
  try {
    await expect.poll(async()=>{ try { return (await fetch('http://127.0.0.1:9222/json/version')).ok; } catch { return false; } },{timeout:40000}).toBe(true);
    browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
    const context=browser.contexts()[0];
    await expect.poll(()=>context.pages().length).toBeGreaterThan(0);
    const page=context.pages()[0];
    await expect(page.getByText('LOCAL DATA / READY',{exact:true})).toBeVisible({timeout:30000});
    await check(page);
  } finally {
    if (browser) await browser.close().catch(()=>{});
    child.kill(); await stopped; await sleep(1500);
  }
}
await open(async page=>{
  await page.getByRole('button',{name:'Add habit',exact:true}).click();
  const input=page.locator('#new-habit');
  await input.fill(habit); await input.press('Enter');
  await expect(page.getByText('LOCAL DATA / SAVED',{exact:true})).toBeVisible();
  // The start date is today, so exactly one cell for the new habit is eligible.
  const eligible=page.locator('button[data-date]:not([aria-disabled="true"])').and(page.getByRole('button',{name:new RegExp('^'+habit+',')}));
  await eligible.click();
  await expect(eligible).toHaveAttribute('aria-pressed','true');
});
await open(async page=>{
  const checked=page.locator('button[aria-pressed="true"][data-date]').and(page.getByRole('button',{name:new RegExp('^'+habit+',')}));
  await expect(checked).toHaveCount(1);
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('button',{name:'Create backup',exact:true}).click();
  const result=page.locator('.data-copies [role=status]');
  await expect(result).toContainText('Saved to ');
  const path=(await result.textContent()).slice('Saved to '.length);
  const backup=JSON.parse(await readFile(path,'utf8'));
  if (!backup.habits.some(h=>h.name===habit)) throw Error('Backup missing saved habit');
  await page.getByLabel('Restore backup').setInputFiles(path);
  await page.getByRole('button',{name:'Replace history'}).click();
  await expect(result).toContainText('Restored. Recovery copy:');
});
