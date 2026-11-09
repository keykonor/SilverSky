import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

// Start Vite with a deliberately invalid VITE_CESIUM_ION_TOKEN on another port.
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5174/';
const evidenceDir = fileURLToPath(new URL('../../docs/evidence/sprint3/', import.meta.url));
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN', reducedMotion: 'reduce' });
try {
  await page.route('**/__amap_config', (route) => route.fulfill({ status: 503, body: 'unavailable' }));
  await page.route(/https:\/\/(?:api|assets)\.cesium\.com\//, (route) => route.abort());
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.getByText('服务已连接').waitFor();
  await page.getByText(/外部三维图层不可用，已使用本地基础地图/).waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: '天津体验' }).click();
  await page.getByRole('button', { name: /发送需求/ }).click();
  await page.getByRole('heading', { name: /路线方案 \(2\)/ }).waitFor();
  await page.getByRole('button', { name: /查看方案 B/ }).click();
  assert.equal(await page.locator('.cesium-widget canvas').count(), 1);
  await page.getByText(/当前不可据此购票或乘坐/).waitFor();
  assert.equal(await page.getByLabel('显示 3D 建筑').count(), 0, 'unavailable 3D building control must be hidden');
  await page.waitForTimeout(900);
  await mkdir(evidenceDir, { recursive: true });
  await page.screenshot({ path: `${evidenceDir}3d-network-failure-fallback.png` });
  const stalledAmap = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
  try {
    await stalledAmap.route(/https:\/\/webapi\.amap\.com\/maps\?/, (route) => route.abort());
    await stalledAmap.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await stalledAmap.getByText(/高德地图不可用，已显示 Cesium 基础地图/).waitFor({ timeout: 26000 });
    assert.equal(await stalledAmap.locator('.cesium-widget canvas').count(), 1);
  } finally {
    await stalledAmap.close();
  }
  console.log('3D network and stalled AMap loader fallback PASS: planning, safety text and local Cesium route remain available.');
} finally {
  await browser.close();
}
