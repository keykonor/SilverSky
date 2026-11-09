import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-software-rasterizer', '--disable-webgl'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
const result = { evidenceType: 'AUTOMATED_EVIDENCE', environment: 'Chrome WebGL disabled by launch flags', city: '天津', routeCount: null, safety: null, mapText: null, issue: null };
try {
  await page.goto(process.env.FRONTEND_URL || 'http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  await page.getByText('服务已连接').waitFor();
  await page.getByRole('button', { name: '天津体验' }).click();
  await page.getByRole('button', { name: /发送需求/ }).click();
  await page.getByRole('heading', { name: /路线方案 \(2\)/ }).waitFor();
  await page.getByRole('button', { name: /查看方案 B/ }).click();
  result.routeCount = await page.locator('.route-card').count();
  result.safety = await page.locator('.route-detail .safety-line').innerText();
  result.mapText = (await page.locator('.route-map-shell').innerText()).slice(0, 600);
  assert.equal(result.routeCount, 2);
  assert.match(result.safety, /当前不建议采用/);
  assert.match(result.mapText, /地图暂时无法显示/);
  assert.doesNotMatch(result.mapText, /CesiumWidget|Error constructing|See more/);
  assert.match(await page.locator('.journey-timeline').innerText(), /未来低空模拟航段/);
  console.log(JSON.stringify(result));
} catch (error) {
  result.issue = error instanceof Error ? error.message.slice(0, 400) : String(error);
  console.log(JSON.stringify(result));
  process.exitCode = 1;
} finally {
  await mkdir('../docs/experiments/sprint3.1-3d-ux-validation', { recursive: true });
  await writeFile('../docs/experiments/sprint3.1-3d-ux-validation/WEBGL_UNAVAILABLE.json', `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await browser.close();
}
