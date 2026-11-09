import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-software-rasterizer', '--disable-webgl'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
const result = { evidenceType: 'AUTOMATED_EVIDENCE', fault: 'AMap loader aborted and WebGL disabled', routeCount: null, selectedSafety: null, mapNotice: null, issue: null };
try {
  await page.route(/https:\/\/webapi\.amap\.com\/maps\?/, (route) => route.abort());
  await page.goto(process.env.FRONTEND_URL || 'http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  await page.getByText('服务已连接').waitFor();
  await page.getByRole('button', { name: '天津体验' }).click();
  await page.getByRole('button', { name: /发送需求/ }).click();
  await page.getByRole('heading', { name: /路线方案 \(2\)/ }).waitFor();
  await page.getByRole('button', { name: /查看方案 B/ }).click();
  await page.getByText('高德与三维地图均不可用；请阅读路线文字说明。').waitFor({ timeout: 30000 });
  result.routeCount = await page.locator('.route-card').count();
  result.selectedSafety = await page.locator('.route-map-shell__safety').innerText();
  result.mapNotice = await page.locator('.route-map-shell__controls').innerText();
  assert.equal(result.routeCount, 2);
  assert.match(result.selectedSafety, /当前不建议采用/);
  assert.doesNotMatch(result.mapNotice, /已显示 Cesium 基础地图/);
  assert.match(await page.locator('.journey-timeline').innerText(), /未来低空模拟航段/);
  console.log(JSON.stringify(result));
} catch (error) {
  result.issue = error instanceof Error ? error.message.slice(0, 400) : String(error);
  console.log(JSON.stringify(result));
  process.exitCode = 1;
} finally {
  await writeFile('../docs/experiments/sprint3.1-3d-ux-validation/DUAL_MAP_FAILURE.json', `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await browser.close();
}
