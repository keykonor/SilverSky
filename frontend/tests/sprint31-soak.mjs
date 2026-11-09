import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const baseUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5173/';
const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const output = '../docs/experiments/sprint3.1-3d-ux-validation/SOAK_RESULTS.json';
const minimumMs = 30 * 60 * 1000;
const minimumCycles = 30;
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN', reducedMotion: 'reduce' });
const started = Date.now();
const events = { pageErrors: 0, consoleErrors: 0, webglContextLost: 0 };
const samples = [];
page.on('pageerror', () => { events.pageErrors += 1; });
page.on('console', (message) => { if (message.type() === 'error') events.consoleErrors += 1; });
await page.addInitScript(() => {
  window.__webglLost = 0;
  window.addEventListener('webglcontextlost', () => { window.__webglLost += 1; }, true);
});

async function snapshot(cycle, city, issue = null) {
  const state = await page.evaluate(() => ({
    heapBytes: performance.memory?.usedJSHeapSize ?? null,
    viewerCount: document.querySelectorAll('.cesium-widget canvas').length,
    webglContextLost: window.__webglLost ?? 0,
    routeCount: document.querySelectorAll('.route-card').length,
  })).catch(() => ({ heapBytes: null, viewerCount: null, webglContextLost: null, routeCount: null }));
  samples.push({ cycle, city, elapsedSeconds: Math.round((Date.now() - started) / 1000), ...state, issue });
  events.webglContextLost = Math.max(events.webglContextLost, state.webglContextLost ?? 0);
  console.log(`cycle ${cycle}/${minimumCycles}: ${city}, viewer=${state.viewerCount}, heap=${state.heapBytes}, issue=${issue ?? 'none'}`);
}

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.getByText('服务已连接').waitFor({ timeout: 15000 });
  for (let cycle = 1; cycle <= minimumCycles; cycle += 1) {
    const city = cycle % 2 ? '天津' : '深圳';
    let issue = null;
    try {
      await page.getByRole('button', { name: `${city}体验` }).click();
      await page.getByRole('button', { name: /发送需求/ }).click();
      await page.getByRole('heading', { name: /路线方案 \(2\)/ }).waitFor({ timeout: 20000 });
      await page.getByRole('button', { name: /查看方案 B/ }).click();
      await page.locator('.cesium-widget canvas:visible').first().waitFor({ timeout: 20000 });
      await page.getByRole('button', { name: '查看完整路线' }).click();
      const cityView = page.getByRole('button', { name: '真实城市地图' });
      if (await cityView.isEnabled()) {
        await cityView.click();
        const neighborhood = page.getByRole('button', { name: '查看起点街区' });
        if (await neighborhood.isVisible().catch(() => false) && await neighborhood.isEnabled()) await neighborhood.click();
      }
      await page.getByRole('button', { name: '查看立体旅程' }).click();
      await page.getByRole('button', { name: /查看方案 A/ }).click();
      await page.getByRole('button', { name: /查看方案 B/ }).click();
      assert.match(await page.locator('.route-card.selected').innerText(), /当前不建议采用/);
      assert.equal(await page.locator('.cesium-widget canvas').count(), 1);
    } catch (error) {
      issue = error instanceof Error ? error.name : 'unknown';
    }
    await snapshot(cycle, city, issue);
    await page.getByRole('button', { name: '重新规划' }).click().catch(() => { issue = issue ?? 'reset_failed'; });
    const nextCycleAt = started + cycle * 60_000;
    if (Date.now() < nextCycleAt) await page.waitForTimeout(nextCycleAt - Date.now());
  }
  if (Date.now() - started < minimumMs) await page.waitForTimeout(minimumMs - (Date.now() - started));
} finally {
  const result = {
    environment: { browser: 'local Chrome headless', viewport: '1440x900 CSS', reducedMotion: true },
    startedAt: new Date(started).toISOString(),
    endedAt: new Date().toISOString(),
    durationMinutes: Number(((Date.now() - started) / 60_000).toFixed(2)),
    requiredCycles: minimumCycles,
    completedCycles: samples.length,
    events,
    samples,
  };
  await mkdir('../docs/experiments/sprint3.1-3d-ux-validation', { recursive: true });
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await browser.close();
  console.log(`Soak evidence saved: ${output}; duration=${result.durationMinutes}min; cycles=${samples.length}; pageErrors=${events.pageErrors}; webglLost=${events.webglContextLost}`);
  if (samples.length < minimumCycles || result.durationMinutes < 30 || samples.some((sample) => sample.issue) || events.pageErrors || events.webglContextLost) process.exitCode = 1;
}
