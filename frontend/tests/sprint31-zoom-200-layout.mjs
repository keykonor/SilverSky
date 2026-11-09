import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const context = await chromium.launchPersistentContext('artifacts/sprint31-zoom-layout-profile', {
  executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
  viewport: { width: 1440, height: 900 },
  locale: 'zh-CN',
});
const page = await context.newPage();
const settings = await context.newPage();
const result = { evidenceType: 'AUTOMATED_EVIDENCE', zoom: 'Chrome native 200%', panels: [], focus: [], issue: null };
try {
  await settings.goto('chrome://settings/appearance');
  await settings.locator('#zoomLevel').selectOption('2');
  await page.goto(process.env.FRONTEND_URL || 'http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  await page.getByText('服务已连接').waitFor();
  await page.getByRole('button', { name: '天津体验' }).click();
  await page.getByRole('button', { name: /发送需求/ }).click();
  await page.getByRole('heading', { name: /路线方案 \(2\)/ }).waitFor();
  await page.getByRole('button', { name: /查看方案 B/ }).click();
  await page.getByRole('button', { name: '查看立体旅程' }).click();

  for (const selector of ['.needs-card', '.routes-section', '.route-card.selected', '.route-detail', '.journey-timeline', '.composer', '.route-map-shell__controls', '.route-map__header', '.route-map__details']) {
    const item = await page.locator(selector).first().evaluate((el, label) => ({ selector: label, clientWidth: el.clientWidth, scrollWidth: el.scrollWidth }), selector);
    result.panels.push(item);
    assert.ok(item.scrollWidth <= item.clientWidth + 2, `Text/content clipped horizontally: ${JSON.stringify(item)}`);
  }
  for (const name of ['重新规划', '真实城市地图', '查看立体旅程', '查看完整路线']) {
    const button = page.getByRole('button', { name }).first();
    await button.scrollIntoViewIfNeeded();
    await button.focus();
    const focused = await button.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return { focused: document.activeElement === el, top: box.top, bottom: box.bottom, left: box.left, right: box.right, viewportWidth: innerWidth, viewportHeight: innerHeight };
    });
    result.focus.push({ name, ...focused });
    assert.ok(focused.focused && focused.top >= -1 && focused.bottom <= focused.viewportHeight + 1 && focused.left >= -1 && focused.right <= focused.viewportWidth + 1, `Focused button not fully visible: ${name}`);
  }
  const layer = page.locator('.route-map-shell__layer:not(.route-map-shell__layer--hidden)');
  const overlay = await layer.evaluate((el) => {
    const header = el.querySelector('.route-map__header')?.getBoundingClientRect();
    const details = el.querySelector('.route-map__details')?.getBoundingClientRect();
    if (!header || !details) return null;
    return { overlapX: Math.max(0, Math.min(header.right, details.right) - Math.max(header.left, details.left)), overlapY: Math.max(0, Math.min(header.bottom, details.bottom) - Math.max(header.top, details.top)) };
  });
  result.mapOverlay = overlay;
  assert.ok(overlay && overlay.overlapX * overlay.overlapY === 0, `Map panels overlap at 200%: ${JSON.stringify(overlay)}`);
  console.log(JSON.stringify(result));
} catch (error) {
  result.issue = error instanceof Error ? error.message.slice(0, 450) : String(error);
  console.log(JSON.stringify(result));
  process.exitCode = 1;
} finally {
  await writeFile('../docs/experiments/sprint3.1-3d-ux-validation/ZOOM_200_LAYOUT.json', `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  await context.close();
}
