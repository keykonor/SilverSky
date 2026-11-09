import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
const page = await context.newPage();
const issues = [];
const amapConfigured = (await fetch(new URL('/__amap_config', baseUrl))).ok;

async function audit(state) {
  const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  for (const violation of report.violations) {
    if (violation.impact === 'critical' || violation.impact === 'serious') {
      issues.push({ state, id: violation.id, impact: violation.impact, description: violation.help, nodes: violation.nodes.map((node) => node.target) });
    }
  }
}

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await audit('first view');
  await page.getByRole('button', { name: '天津体验' }).click();
  await page.getByRole('button', { name: /发送需求/ }).click();
  await page.getByRole('heading', { name: /路线方案/ }).waitFor();
  await audit('route result');
  await page.getByRole('button', { name: /查看方案 B/ }).click();
  await page.getByRole('button', { name: '查看立体旅程' }).click();
  await page.getByRole('button', { name: /模拟起降点 A详情/ }).click();
  await page.locator('.route-map-shell__layer:not(.route-map-shell__layer--hidden) .route-map__disclosure summary').click();
  await audit('simulated 3D route and vertiport detail');
  const cityButton = page.getByRole('button', { name: '真实城市地图' });
  let amapLoaded = false;
  if (amapConfigured && await cityButton.isEnabled()) {
    await cityButton.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => {
      const city = document.querySelector('.route-map-shell__layer:not(.route-map-shell__layer--hidden) .route-map__scene-state');
      const unavailable = document.querySelector('.route-map-shell__controls')?.textContent?.includes('高德地图不可用');
      return city?.textContent?.includes('高德地图已加载') || unavailable;
    }, null, { timeout: 32000 });
    amapLoaded = await cityButton.isEnabled();
  }
  if (amapLoaded) {
    await audit('loaded AMap city view by keyboard');
    await page.getByRole('button', { name: '查看立体旅程' }).click();
  } else {
    await audit('Cesium fallback after unavailable city map');
  }
  await page.setViewportSize({ width: 760, height: 900 });
  await audit('narrow simulated route');
  const headerBox = await page.locator('.route-map-shell__layer:not(.route-map-shell__layer--hidden) .route-map__header').boundingBox();
  const detailsBox = await page.locator('.route-map-shell__layer:not(.route-map-shell__layer--hidden) .route-map__details').boundingBox();
  assert.ok(headerBox && detailsBox && headerBox.y + headerBox.height <= detailsBox.y, 'Narrow map overlays overlap');
  await page.getByRole('button', { name: '重新规划' }).click();
  await page.getByRole('textbox', { name: '描述您的出行需求' }).fill('78岁老人从天津大学到天津医科大学总医院，明天下午15:00出发，腿脚不方便');
  await page.getByRole('button', { name: /发送需求/ }).click();
  await page.getByText(/天津大学有多个校区/).first().waitFor();
  await audit('ambiguous place confirmation');
  for (const button of await page.locator('.place-choices button').all()) {
    const box = await button.boundingBox();
    assert.ok(box && box.height >= 44, 'Place choice target too small for elderly use');
  }
  await page.getByRole('button', { name: '重新规划' }).click();
  await page.getByRole('textbox', { name: '描述您的出行需求' }).fill('老人突然胸痛，而且呼吸困难');
  await page.getByRole('button', { name: /发送需求/ }).click();
  await page.locator('.emergency-panel').waitFor();
  await audit('medical emergency');
  await page.getByRole('button', { name: '重新规划' }).click();
  const directForms = page.locator('.direct-planner__search');
  for (const [index, query] of [[0, '天津站'], [1, '天津之眼']]) {
    const form = directForms.nth(index);
    await form.locator('input').fill(query);
    await form.getByRole('button', { name: '查找' }).click();
    await form.locator('.direct-planner__choices button').first().waitFor({ timeout: 15000 });
    await audit(index === 0 ? 'Tianjin origin choices' : 'destination choices');
    await form.locator('.direct-planner__choices button').first().click();
  }
  await page.getByRole('button', { name: '查看地面路线' }).click();
  await page.locator('.direct-planner__result').waitFor({ timeout: 20000 });
  await audit('Tianjin arbitrary route result');
  if (issues.length) console.error(JSON.stringify(issues, null, 2));
  assert.equal(issues.length, 0, 'Serious or critical accessibility violations found');
  console.log(`Accessibility PASS: no serious or critical axe violations in first view, ground result, simulated 3D detail, ${amapLoaded ? 'loaded AMap city view' : 'Cesium fallback'}, narrow view, medical emergency, or arbitrary Tianjin route. Narrator remains NOT_VERIFIED.`);
} finally {
  await browser.close();
}
