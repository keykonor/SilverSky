import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const out = '../docs/evidence/2026-11-09-home-recovery';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true, args: ['--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN' });
  let analysisRequests = 0, routeRequests = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/api/v2/interpret')) analysisRequests++;
    if (request.url().endsWith('/api/v2/route')) routeRequests++;
  });
  // Inject only the upstream outage outcome. Place search, route and map stay live.
  await page.route('**/api/v2/interpret', (route) => route.request().postDataJSON().text.includes('胸痛')
    ? route.continue()
    : route.fulfill({ status: 502, json: { detail: 'DeepSeek 服务暂时异常，请稍后点击完成重试。文字已保留。' } }));
  await page.goto('http://127.0.0.1:5173/');
  const input = page.getByLabel('出行需求', { exact: true });
  const sample = '我想从天津站去天津之眼。';
  await input.fill(sample);
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'DeepSeek 服务暂时异常' }).waitFor();
  const manual = page.getByRole('button', { name: '手动选点', exact: true });
  await manual.click({ timeout: 5000 });
  await page.getByRole('button', { name: '返回文字输入' }).click();
  assert.equal(await input.inputValue(), sample);
  await manual.click();
  const planner = page.getByRole('region', { name: '查找地面路线' });
  const go = planner.getByRole('button', { name: '查看地面路线' });
  assert.equal(await go.isDisabled(), true);
  for (const [label, query, group, pattern] of [
    ['出发地', '天津站', '选择出发地', /^天津站(?:\s|\(|（)/],
    ['目的地', '天津之眼', '选择目的地', /^天津之眼/],
  ]) {
    const place = planner.getByLabel(label, { exact: true });
    await place.fill(query);
    await place.press('Enter');
    await planner.getByLabel(group, { exact: true }).getByRole('button', { name: pattern }).first().click({ timeout: 25000 });
  }
  const pending = page.waitForResponse((response) => response.url().endsWith('/api/v2/route'));
  await go.click();
  const response = await pending;
  assert.equal(response.status(), 200);
  const trip = await response.json();
  assert.ok(trip.ground.distance_m > 0 && trip.ground.geometry.length > 1);
  assert.equal(trip.air.data_status, 'SIMULATED_DATA');
  await page.getByRole('heading', { name: '路线方案' }).waitFor();
  await page.getByRole('list', { name: '地面出发与到达安排' }).waitFor();
  await page.getByText('已显示高德真实驾车道路参考。', { exact: true }).waitFor({ timeout: 20000 });
  assert.equal(analysisRequests, 1);
  assert.equal(routeRequests, 1);
  await mkdir(out, { recursive: true });
  await page.screenshot({ path: `${out}/manual-route.png`, fullPage: true });
  await page.getByRole('button', { name: '修改行程' }).click();
  await page.getByRole('button', { name: '返回文字输入' }).click();
  assert.equal(await input.inputValue(), sample);
  await input.fill('同行人胸痛，从天津站去医院。');
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: '紧急医疗服务' }).waitFor();
  assert.equal(await manual.isDisabled(), true);
  await page.getByRole('combobox', { name: '地点搜索范围' }).selectOption('ALL');
  assert.equal(await manual.isDisabled(), true);
  await input.clear();
  assert.equal(await manual.isEnabled(), true);
  assert.equal(routeRequests, 1);
  const report = { outageInjected: true, liveMapAndRoute: true, route: [trip.origin.name, trip.destination.name],
    distanceM: trip.ground.distance_m, inputRetained: true, extraAnalysisRequestsInManualMode: 0, emergencyBlocked: true };
  await writeFile(`${out}/results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
