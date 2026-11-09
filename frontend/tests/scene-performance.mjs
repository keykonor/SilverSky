import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN', reducedMotion: 'reduce' });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '天津体验' }).click();
  await page.getByRole('button', { name: /发送需求/ }).click();
  await page.getByRole('heading', { name: /路线方案 \(2\)/ }).waitFor();
  await page.getByRole('button', { name: /查看方案 B/ }).click();
  const canvas = page.locator('.cesium-widget canvas');
  await canvas.first().waitFor();
  await canvas.evaluate((element) => { window.__s3Canvas = element; });
  const memoryBefore = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? null);
  const times = [];
  for (let i = 0; i < 20; i += 1) {
    const letter = i % 2 === 0 ? 'A' : 'B';
    const start = Date.now();
    await page.getByRole('button', { name: new RegExp(`查看方案 ${letter}`) }).click();
    await page.locator('.route-card.selected').getByRole('button', { name: new RegExp(`查看方案 ${letter}`) }).waitFor();
    times.push(Date.now() - start);
    assert.equal(await canvas.count(), 1);
    assert.equal(await canvas.evaluate((element) => window.__s3Canvas === element), true);
  }
  const memoryAfter = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? null);
  assert.deepEqual(pageErrors, []);
  times.sort((a, b) => a - b);
  console.log(JSON.stringify({ switches: times.length, medianMs: times[9], p95Ms: times[18], maxMs: times[19], memoryBeforeBytes: memoryBefore, memoryAfterBytes: memoryAfter, viewerCanvasRecreated: false, pageErrors }, null, 2));
} finally {
  await browser.close();
}
