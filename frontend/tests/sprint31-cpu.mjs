import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'],
});
const baseUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5173/';
const results = [];

try {
  for (const [rate, city] of [[4, '天津'], [6, '深圳']]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN', reducedMotion: 'reduce' });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    const result = { rate, city, environment: 'Chrome DevTools CPU emulation, headless', pageErrors: 0, timingsMs: {}, issue: null };
    page.on('pageerror', () => { result.pageErrors += 1; });
    try {
      let start = Date.now();
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.getByText('服务已连接').waitFor({ timeout: 60000 });
      result.timingsMs.firstReady = Date.now() - start;
      start = Date.now();
      const input = page.getByRole('textbox', { name: '描述您的出行需求' });
      await input.fill('测试输入响应');
      result.timingsMs.inputResponse = Date.now() - start;
      await page.getByRole('button', { name: `${city}体验` }).click();
      start = Date.now();
      await page.getByRole('button', { name: /发送需求/ }).click();
      await page.getByRole('heading', { name: /路线方案 \(2\)/ }).waitFor({ timeout: 60000 });
      result.timingsMs.planResult = Date.now() - start;
      start = Date.now();
      await page.getByRole('button', { name: /查看方案 B/ }).click();
      await page.locator('.cesium-widget canvas:visible').first().waitFor({ timeout: 60000 });
      result.timingsMs.routeSwitch = Date.now() - start;
      start = Date.now();
      await page.getByRole('button', { name: '查看完整路线' }).click({ timeout: 60000 });
      result.timingsMs.camera = Date.now() - start;
      const cityView = page.getByRole('button', { name: '真实城市地图' });
      if (await cityView.isEnabled()) {
        start = Date.now();
        await cityView.click();
        result.timingsMs.cityViewSwitch = Date.now() - start;
        result.cityViewState = await page.locator('.route-map-shell__controls').innerText();
      } else {
        result.cityViewState = 'unavailable; Cesium fallback';
      }
      assert.match(await page.locator('.route-card.selected').innerText(), /当前不建议采用/);
      assert.match(await page.locator('.route-detail .safety-line').innerText(), /当前不建议采用/);
      assert.equal(await page.locator('.route-card').count(), 2);
      result.heapBytes = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? null);
    } catch (error) {
      result.issue = error instanceof Error ? error.message.slice(0, 400) : String(error);
    }
    results.push(result);
    console.log(JSON.stringify(result));
    await context.close();
  }
  await mkdir('../docs/experiments/sprint3.1-3d-ux-validation', { recursive: true });
  await writeFile('../docs/experiments/sprint3.1-3d-ux-validation/CPU_RESULTS.json', `${JSON.stringify(results, null, 2)}\n`, 'utf8');
  assert.ok(results.every((result) => result.issue === null), 'Core plan was unusable under CPU throttling');
} finally {
  await browser.close();
}
