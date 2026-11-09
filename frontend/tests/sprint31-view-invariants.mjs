import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
const baseUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5173/';
let planCalls = 0;
let planningResult;
page.on('response', async (response) => {
  if (response.url().includes('/api/v1/plan') && response.request().method() === 'POST') {
    planCalls += 1;
    if (response.ok()) planningResult = await response.json();
  }
});

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.getByText('服务已连接').waitFor();
  await page.getByRole('button', { name: '天津体验' }).click();
  await page.getByRole('button', { name: /发送需求/ }).click();
  await page.getByRole('heading', { name: /路线方案 \(2\)/ }).waitFor();
  assert.equal(planCalls, 1);
  assert.ok(planningResult);
  const selectedRoute = planningResult.route_options.find((item) => item.route_type === 'GROUND_AIR_GROUND');
  assert.ok(selectedRoute);
  assert.equal(selectedRoute.risk_assessment.review_outcome, 'REJECT');
  const fingerprint = createHash('sha256').update(JSON.stringify(planningResult)).digest('hex');
  await page.getByRole('button', { name: /查看方案 B/ }).click();
  assert.match(await page.locator('.route-map-shell__safety').innerText(), /当前不建议采用/);
  const before = await page.locator('.route-detail').innerText();
  for (let i = 0; i < 4; i += 1) {
    const cityView = page.getByRole('button', { name: '真实城市地图' });
    if (await cityView.isEnabled()) await cityView.click();
    await page.getByRole('button', { name: '查看立体旅程' }).click();
    assert.match(await page.locator('.route-card.selected').innerText(), /当前不建议采用/);
    assert.match(await page.locator('.route-detail .safety-line').innerText(), /当前不建议采用/);
    assert.match(await page.locator('.route-map-shell__safety').innerText(), /当前不建议采用/);
    assert.equal(await page.locator('.route-detail').innerText(), before, 'Route details changed after view toggle');
    assert.equal(planCalls, 1, 'View toggle unexpectedly called the planning API');
  }
  await page.getByRole('button', { name: /查看方案 A/ }).click();
  assert.match(await page.locator('.route-map-shell__safety').innerText(), /存在限制，已降低推荐优先级/);
  await page.getByRole('button', { name: /查看方案 B/ }).click();
  assert.match(await page.locator('.route-map-shell__safety').innerText(), /当前不建议采用/);
  const result = { evidenceType: 'AUTOMATED_EVIDENCE', city: '天津', planningResultSha256: fingerprint, selectedRouteId: selectedRoute.route_id, routeType: selectedRoute.route_type, safetyOutcome: selectedRoute.risk_assessment.review_outcome, planCalls, viewToggles: 8, routeDetailsStable: true, mapSafetyFollowsRouteSelection: true, simulatedAltitudeInPlanningResult: JSON.stringify(planningResult).includes('visual_altitude') };
  assert.equal(result.simulatedAltitudeInPlanningResult, false);
  await mkdir('../docs/experiments/sprint3.1-3d-ux-validation', { recursive: true });
  await writeFile('../docs/experiments/sprint3.1-3d-ux-validation/VIEW_INVARIANTS.json', `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(result));
} finally {
  await browser.close();
}
