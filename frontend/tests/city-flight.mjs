import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const base = 'http://127.0.0.1:5173';
const evidence = '../docs/evidence/2026-11-07-city-flight-agent';
const executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Shanghai' });
const errors = [];
let terrainTiles = 0, buildingTiles = 0, streetTiles = 0;
page.on('pageerror', (error) => errors.push(error.message.replace(/https?:\/\/\S+/g, '[URL]')));
page.on('response', (response) => {
  if (!response.ok()) return;
  if (response.url().includes('/flight-sim/tianjin/terrain/')) terrainTiles += 1;
  if (response.url().includes('/flight-sim/tianjin/buildings/')) buildingTiles += 1;
  if (response.url().startsWith('https://tile.openstreetmap.org/')) streetTiles += 1;
});
try {
  const cities = await (await page.request.get(`${base}/api/v2/flight-sim/cities`)).json();
  const tianjin = cities.find((city) => city.id === 'tianjin');
  assert.ok(tianjin?.buildings > 0 && tianjin.terrain_cells > 0 && tianjin.estimated_height_records > 0 && tianjin.demo_points);
  const [lon, lat] = tianjin.demo_points.origin;
  const span = 180 / 2 ** 14;
  const tilePath = `terrain/14/${Math.floor((lon + 180) / span)}/${Math.floor((90 - lat) / span)}`;
  const terrain = await (await page.request.get(`${base}/api/v2/flight-sim/tianjin/${tilePath}`)).json();
  assert.equal(terrain.length, 33 ** 2);
  assert.ok(terrain.some((height) => Number.isFinite(height) && height !== 0));
  await mkdir(evidence, { recursive: true });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '3D 城市', exact: true }).click();
  await page.getByRole('button', { name: '全城模型与飞行 Agent', exact: true }).click();
  const panel = page.getByRole('region', { name: '模拟飞行 Agent' });
  await panel.getByText(/视野附近已加载 [1-9][\d,]* 条建筑记录/).waitFor({ timeout: 60000 });
  assert.ok(terrainTiles > 0 && buildingTiles > 0);
  await panel.getByRole('button', { name: '填入模拟示例' }).click();
  const pending = page.waitForResponse((response) => response.url().endsWith('/flight-sim/tianjin/plan'));
  await panel.getByRole('button', { name: '生成模拟轨迹' }).click();
  const response = await pending;
  assert.equal(response.status(), 200);
  const plan = await response.json();
  assert.equal(plan.data_status, 'SIMULATED_DATA');
  assert.equal(plan.status, 'PARTIAL_PREVIEW');
  assert.ok(plan.estimated_building_cells > 0);
  assert.equal(plan.landing_site_status, 'DATA_UNAVAILABLE');
  assert.deepEqual(plan.phases, ['ASCENT', 'CROSSING', 'DESCENT']);
  assert.ok(plan.geometry[1][2] >= plan.highest_modeled_surface_m + plan.simulation_margin_m);
  await panel.getByText(/模拟起升/).waitFor();
  // Allow Cesium's asynchronous extrusion meshes and textures to settle.
  await page.waitForTimeout(7000);
  await page.screenshot({ path: `${evidence}/tianjin-trajectory.png`, fullPage: true });
  await panel.getByRole('textbox', { name: '终点坐标' }).fill('116.9, 38.4');
  await panel.getByRole('button', { name: '生成模拟轨迹' }).click();
  await panel.getByText('无法生成', { exact: true }).waitFor();
  assert.equal(await panel.getByText(/模拟起升/).count(), 0);
  const originInput = panel.getByRole('textbox', { name: '起点坐标' });
  const previousOrigin = await originInput.inputValue();
  await panel.getByRole('button', { name: '地图选起点' }).click();
  await page.locator('.v2-cesium canvas').click({ position: { x: 900, y: 300 } });
  assert.notEqual(await originInput.inputValue(), previousOrigin);
  await page.getByRole('button', { name: '关闭全城模型' }).click();
  assert.equal(await panel.count(), 0);
  assert.equal(await page.locator('.v2-cesium canvas').count(), 1);
  assert.deepEqual(errors, []);
  const report = { browser: 'Chrome desktop', city: tianjin, terrainTiles, buildingTiles, streetTiles,
    testedPoints: tianjin.demo_points, status: plan.status, originGround: plan.origin_ground_m,
    destinationGround: plan.destination_ground_m, highestModeledSurface: plan.highest_modeled_surface_m,
    crossing: plan.geometry[1][2], estimatedCells: plan.estimated_building_cells,
    unknownCells: plan.unknown_building_cells, missingTerrainCells: plan.missing_terrain_cells,
    phaseOrder: plan.phases, mapPointSelection: true, outOfCoverageClearsTrajectory: true, originalSceneRestored: true, errors };
  await writeFile(`${evidence}/results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
