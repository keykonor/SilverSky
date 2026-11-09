import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
});

try {
  // A 720 × 450 CSS viewport at 2× pixel density approximates a 1440 × 900 display at 200% browser zoom.
  const page = await browser.newPage({ viewport: { width: 720, height: 450 }, deviceScaleFactor: 2, locale: 'zh-CN' });
  await page.goto(process.env.FRONTEND_URL || 'http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '天津体验' }).click();
  await page.getByRole('button', { name: /发送需求/ }).click();
  await page.getByRole('heading', { name: /路线方案/ }).waitFor();
  const layout = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
    page: document.documentElement.scrollWidth,
  }));
  assert.ok(layout.page <= layout.viewport + 2, `200% layout has horizontal overflow: ${JSON.stringify(layout)}`);
  assert.ok(await page.getByRole('button', { name: /查看方案 B/ }).count(), 'Alternative route is missing');
  assert.ok(await page.getByText(/模拟低空/).count(), 'Simulation disclosure is missing');
  await page.getByRole('button', { name: /查看方案 B/ }).click();
  assert.equal(await page.getByRole('button', { name: '真实城市地图' }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: '查看立体旅程' }).click();
  await page.locator('.cesium-widget canvas:visible').first().waitFor();
  assert.equal(await page.getByRole('button', { name: '查看立体旅程' }).getAttribute('aria-pressed'), 'true');
  const controls = await page.locator('.route-map-shell__controls').boundingBox();
  const scene = await page.locator('.route-map-shell__stage').boundingBox();
  assert.ok(controls && scene && controls.y + controls.height <= scene.y + 2, 'Map view controls overlap the scene');
  await page.screenshot({ path: '../docs/evidence/sprint3/zoom-200-result.png', fullPage: true });
  console.log(`200% viewport approximation PASS: ${JSON.stringify(layout)}`);
} finally {
  await browser.close();
}
