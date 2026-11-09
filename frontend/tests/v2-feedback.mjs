import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox','--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' });
let analysisCalls = 0, routeCalls = 0;
let route;
let analysis;
page.on('request', (r) => { if (r.url().endsWith('/api/v2/interpret')) analysisCalls++; if (r.url().endsWith('/api/v2/route')) routeCalls++; });
page.on('response', async (r) => { if (r.url().endsWith('/api/v2/route') && r.ok()) route = await r.json(); if (r.url().endsWith('/api/v2/interpret') && r.ok()) analysis = await r.json(); });
const out = '../docs/evidence/v2-mvp';
try {
  await page.goto('http://127.0.0.1:5173/');
  await page.getByLabel('出行需求', { exact: true }).fill('我想明天下午3点从天津之眼去天津西站北广场。');
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.v2-place-group') || document.querySelector('.v2-time-plan'), { timeout: 65000 });
  if (await page.getByRole('heading', { name: '确认具体地点', exact: true }).count()) {
    for (const [label, regex] of [['选择出发地', /^天津之眼 /], ['选择目的地', /天津西站.*北广场/]]) {
      const region = page.getByRole('region', { name: label, exact: true });
      if (await region.locator('button[aria-pressed="true"]').count() === 0) await region.getByRole('button', { name: regex }).first().click();
    }
  }
  await page.getByRole('heading', { name: '路线方案', exact: true }).waitFor({ timeout: 35000 });
  const input = page.getByLabel('出发时间（北京时间）');
  const originalDeparture = await input.inputValue();
  assert.equal(originalDeparture.endsWith('T15:00'), true, '明天下午3点 must be prefilled explicitly');
  const nextDate = originalDeparture.slice(0, 10);
  const arrivalBefore = await page.getByRole('list', { name: '地面出发与到达安排' }).innerText();
  await input.fill(`${nextDate}T18:00`);
  const arrivalAfter = await page.getByRole('list', { name: '地面出发与到达安排' }).innerText();
  assert.notEqual(arrivalBefore, arrivalAfter);
  assert.equal(analysisCalls, 1); assert.equal(routeCalls, 1);
  await page.getByRole('button', { name: /模拟空中路线 空间参考/ }).click();
  const loaded = page.waitForResponse((r) => /tile\.openstreetmap\.org\/1[4-9]\//.test(r.url()) && r.ok(), { timeout: 30000 });
  await page.getByRole('button', { name: '3D 城市', exact: true }).click();
  await loaded;
  await page.getByText(/道路与地名底图：© OpenStreetMap/).waitFor();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${out}/feedback-eye-west-station-time-3d.png` });
  assert.equal(await input.inputValue(), `${nextDate}T18:00`, 'switching to simulated air must retain the ground departure plan');
  const report = { evidence_type: 'AUTOMATED_EVIDENCE', requirements: ['REQ-013','REQ-014'], origin: route.origin.name, destination: route.destination.name,
    distance_m: route.ground.distance_m, driving_duration_min: route.ground.duration_min, original_departure_beijing: originalDeparture,
    edited_departure_beijing: `${nextDate}T18:00`, timeline: arrivalAfter, editing_replans: false, actual_street_tile_http_200: true, auto_plan_after_selection: true };
  // Separate fault injection with the public route just obtained live; no tile traffic escapes.
  const failedContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' });
  await failedContext.route('https://tile.openstreetmap.org/**', (r) => r.abort());
  await failedContext.route('**/api/v2/interpret', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...analysis, resolved: { origin: route.origin, destination: route.destination } }) }));
  await failedContext.route('**/api/v2/route', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(route) }));
  const failedPage = await failedContext.newPage();
  await failedPage.goto('http://127.0.0.1:5173/');
  await failedPage.getByLabel('出行需求', { exact: true }).fill('我想明天下午3点从天津之眼去天津西站北广场。');
  await failedPage.getByRole('button', { name: '完成', exact: true }).click();
  await failedPage.getByRole('heading', { name: '路线方案', exact: true }).waitFor();
  await failedPage.getByRole('button', { name: '3D 城市', exact: true }).click();
  await failedPage.locator('.v2-street-status').filter({ hasText: /未能加载|加载超时/ }).waitFor({ timeout: 25000 });
  assert.equal(await failedPage.getByRole('list', { name: '地面出发与到达安排' }).count(), 1);
  await failedPage.screenshot({ path: `${out}/3d-tile-failure.png` });
  report.street_failure = { injected: true, reason_visible: true, ground_timeline_preserved: true };
  await failedContext.close();
  await writeFile(`${out}/feedback-results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) { await page.screenshot({ path: `${out}/feedback-failure.png` }); console.log((await page.locator('body').innerText()).slice(0, 2000)); throw error; }
finally { await browser.close(); }
