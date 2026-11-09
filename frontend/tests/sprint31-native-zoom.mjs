import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const context = await chromium.launchPersistentContext('artifacts/sprint31-zoom-profile', {
  executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: process.env.HEADFUL !== '1',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
  viewport: { width: 1440, height: 900 },
  locale: 'zh-CN',
});
const page = await context.newPage();
const baseUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5173/';

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  const settings = await context.newPage();
  await settings.goto('chrome://settings/appearance', { waitUntil: 'domcontentloaded' });
  const results = [];
  await mkdir('../docs/evidence/sprint3.1', { recursive: true });
  await mkdir('../docs/experiments/sprint3.1-3d-ux-validation', { recursive: true });
  for (const level of ['1', '1.25', '1.5', '2']) {
    await settings.locator('#zoomLevel').selectOption(level);
    await page.waitForTimeout(300);
    const percent = Math.round(Number(level) * 100);
    const result = { percent, checks: [], issue: null };
    try {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      await page.getByText('服务已连接').waitFor({ timeout: 15000 });
      await page.getByRole('textbox', { name: '描述您的出行需求' }).click();
      await page.getByRole('button', { name: '天津体验' }).click();
      await page.getByRole('button', { name: /发送需求/ }).click();
      await page.getByRole('heading', { name: /路线方案 \(2\)/ }).waitFor({ timeout: 20000 });
      await page.getByRole('button', { name: /查看方案 B/ }).click();
      await page.getByRole('button', { name: '查看立体旅程' }).click();
      await page.getByRole('button', { name: '查看完整路线' }).click();
      await page.locator('.route-map-shell__layer:not(.route-map-shell__layer--hidden) .route-map__disclosure summary').filter({ hasText: '数据说明' }).click();
      for (const [label, selector] of [
        ['input', 'textarea'], ['conversation', '.conversation-history'], ['routeCard', '.route-card.selected'],
        ['safety', '.route-detail .safety-line'], ['map', '.route-map-shell__stage'], ['legend', '.route-map-shell__layer:not(.route-map-shell__layer--hidden) .route-map__legend'],
        ['timeline', '.journey-timeline'], ['mapControls', '.route-map-shell__controls'],
      ]) {
        const target = page.locator(selector).first();
        assert.ok(await target.count(), `${label} missing at ${percent}%`);
        await target.scrollIntoViewIfNeeded();
        assert.ok(await target.isVisible(), `${label} hidden at ${percent}%`);
        result.checks.push(label);
      }
      const layout = await page.evaluate(() => ({
        devicePixelRatio: window.devicePixelRatio,
        innerWidth: window.innerWidth,
        outerWidth: window.outerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      result.layout = layout;
      assert.ok(Math.abs(layout.devicePixelRatio - Number(level)) < 0.02, `Chrome native zoom mismatch at ${percent}%`);
      assert.ok(layout.scrollWidth <= layout.innerWidth + 2, `Horizontal overflow at ${percent}%: ${JSON.stringify(layout)}`);
      assert.match(await page.locator('.route-card.selected').innerText(), /当前不建议采用/);
      assert.match(await page.locator('.route-detail .safety-line').innerText(), /当前不建议采用/);
      await page.locator('.route-map-shell__stage').scrollIntoViewIfNeeded();
      const safetyAtMap = page.locator('.route-map-shell__safety');
      assert.match(await safetyAtMap.innerText(), /当前不建议采用/);
      const safetyBox = await safetyAtMap.boundingBox();
      const stageBox = await page.locator('.route-map-shell__stage').boundingBox();
      assert.ok(safetyBox && stageBox && safetyBox.y >= 0 && safetyBox.y + safetyBox.height <= page.viewportSize().height && stageBox.y < page.viewportSize().height && stageBox.y + stageBox.height > 0, `Safety and map not in the same viewport at ${percent}%`);
      result.checks.push('safetyVisibleWithMap');
      await page.screenshot({ path: `../docs/evidence/sprint3.1/native-zoom-${percent}.png`, fullPage: true });
      await page.getByRole('button', { name: '重新规划' }).click();
      assert.equal(await page.locator('.route-card').count(), 0);
    } catch (error) {
      result.issue = error instanceof Error ? error.message.slice(0, 400) : String(error);
    }
    results.push(result);
    console.log(JSON.stringify(result));
  }
  await writeFile('../docs/experiments/sprint3.1-3d-ux-validation/NATIVE_ZOOM_RESULTS.json', `${JSON.stringify(results, null, 2)}\n`, 'utf8');
  assert.ok(results.every((result) => result.issue === null), 'One or more native zoom checks failed');
} finally {
  await context.close();
}
