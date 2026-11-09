import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';

const out = '../docs/evidence/2026-11-07-home-3d';
await mkdir(out, { recursive: true });
const browserName = process.env.V2_BROWSER || 'chrome';
const executablePath = browserName === 'edge' ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' : 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN', timezoneId: 'Asia/Shanghai' });
const page = await context.newPage();
const errors = [], areas = {}, requests = [];
let roadTiles = 0;
page.on('pageerror', (e) => errors.push(e.message.replace(/https?:\/\/\S+/g, '[URL]')));
page.on('request', (r) => { if (r.url().includes('/api/v2/city-buildings?')) requests.push(r.url()); });
page.on('response', (r) => { if (r.ok() && r.url().startsWith('https://tile.openstreetmap.org/')) roadTiles++; });
async function modelReady(target = page) {
  await target.locator('.v2-building-status').filter({ hasText: /基础城市模型：\d+ 栋/ }).waitFor({ timeout: 65000 });
  // Cesium builds extrusion meshes asynchronously after React receives the footprints.
  await target.waitForTimeout(2500);
}
async function openScene(target) {
  await target.goto('http://127.0.0.1:5173/');
  await target.getByRole('button', { name: '3D 城市', exact: true }).click();
}
try {
  const homeResponse = page.waitForResponse((r) => r.url().includes('/api/v2/city-buildings?'));
  await openScene(page);
  const response = await homeResponse;
  assert.equal(response.status(), 200);
  areas.tianjin = await response.json();
  await modelReady();
  assert.ok(areas.tianjin.features.length > 0 && areas.tianjin.features.length <= 500);
  assert.equal(areas.tianjin.data_status, 'PUBLIC_DATA');
  assert.ok(areas.tianjin.features.some((f) => f.height_status === 'SOURCE_HEIGHT'));
  await page.waitForFunction(() => document.querySelector('.v2-street-status')?.textContent.includes('当前视口在线加载'));
  await page.screenshot({ path: `${out}/${browserName}-tianjin.png`, fullPage: true });
  const count = requests.length;
  await page.getByRole('checkbox', { name: '显示建筑', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: '显示建筑', exact: true }).check();
  await page.getByRole('button', { name: '放大', exact: true }).click();
  await page.getByRole('button', { name: '复位 3D 视角', exact: true }).click();
  await page.getByRole('button', { name: '二维地图', exact: true }).click();
  await page.getByRole('button', { name: '3D 城市', exact: true }).click();
  assert.equal(requests.length, count, 'camera/layer/view switches must not refetch building data');
  assert.equal(await page.locator('.v2-cesium canvas').count(), 1);
  const shenzhenResponse = page.waitForResponse((r) => r.url().includes('/city-buildings?longitude=114.06'));
  await page.getByRole('button', { name: '深圳街区', exact: true }).click();
  areas.shenzhen = await (await shenzhenResponse).json();
  await modelReady();
  assert.ok(areas.shenzhen.features.length > 0 && areas.shenzhen.features.length <= 500);
  await page.screenshot({ path: `${out}/${browserName}-shenzhen.png`, fullPage: true });
  const canvas = await page.locator('.v2-cesium canvas').boundingBox();
  await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvas.x + canvas.width / 2 + 100, canvas.y + canvas.height / 2, { steps: 12 });
  await page.mouse.up();
  const currentResponse = page.waitForResponse((r) => r.url().includes('/city-buildings?'));
  await page.getByRole('button', { name: '加载当前街区', exact: true }).click();
  const currentData = await (await currentResponse).json();
  await page.getByRole('button', { name: '加载当前街区', exact: true }).waitFor();
  await page.waitForFunction(() => !document.querySelector('.v2-building-status')?.textContent.includes('正在加载'));
  assert.ok(currentData.features.length <= 500);
  const audit = await new AxeBuilder({ page }).include('.v2-scene-controls').include('.v2-scene-info').analyze();
  const serious = audit.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
  assert.deepEqual(serious, []);

  // Only failure runs use same-run public OSM data; the first two cities were live.
  const fault = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN', timezoneId: 'Asia/Shanghai' });
  let fail = true;
  await fault.route('**/api/v2/city-buildings?*', (r) => r.fulfill({ status: fail ? 503 : 200,
    contentType: 'application/json', body: JSON.stringify(fail ? { detail: '建筑轮廓暂不可用' } : areas.tianjin) }));
  const failurePage = await fault.newPage();
  failurePage.on('pageerror', (e) => errors.push(e.message));
  await openScene(failurePage);
  await failurePage.getByRole('button', { name: '重试建筑加载', exact: true }).waitFor();
  assert.ok((await failurePage.locator('.v2-scene-info').innerText()).includes('当前街区建筑暂不可用'));
  assert.equal(await failurePage.locator('.v2-cesium canvas').count(), 1);
  await failurePage.screenshot({ path: `${out}/${browserName}-failure-desktop.png`, fullPage: true });
  fail = false;
  await failurePage.getByRole('button', { name: '重试建筑加载', exact: true }).click();
  await modelReady(failurePage);
  assert.equal(await failurePage.getByRole('button', { name: '重试建筑加载', exact: true }).count(), 0);
  await failurePage.screenshot({ path: `${out}/${browserName}-recovered.png`, fullPage: true });
  await failurePage.getByRole('button', { name: '二维地图', exact: true }).click();
  assert.equal(await failurePage.getByRole('button', { name: '二维地图', exact: true }).getAttribute('aria-pressed'), 'true');
  await fault.close();
  assert.deepEqual(errors, []);
  const report = { evidence_type: 'AUTOMATED_EVIDENCE', requirements: ['REQ-018', 'REQ-019'], browser: browserName,
    live_cities: Object.fromEntries(Object.entries(areas).map(([k, v]) => [k, { count: v.features.length,
      source_heights: v.features.filter((f) => f.height_status === 'SOURCE_HEIGHT').length, retrieved_at: v.retrieved_at }])),
    road_tiles_http200: roadTiles, current_area_count: currentData.features.length, city_queries: requests.length,
    single_viewer: true, no_queries_on_camera_layer_view_changes: true,
    injected_503_retry_recovered: true, mobile_validation: 'EXCLUDED_BY_USER',
    axe_new_map_controls_serious_critical: serious.length, pageerrors: errors,
    limits: 'Local street areas, not complete cities or textures; unknown heights illustrative; no real user/GPU/production acceptance' };
  await writeFile(`${out}/${browserName}-results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (e) {
  await page.screenshot({ path: `${out}/${browserName}-failure.png`, fullPage: true });
  throw e;
} finally { await browser.close(); }
