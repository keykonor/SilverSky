import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const fixture = JSON.parse(await readFile('../docs/experiments/sprint3.1-3d-ux-validation/SCENARIO_RESULTS.json', 'utf8')).cases;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
const results = {};
let planCalls = 0;
page.on('request', (request) => { if (request.url().includes('/api/v1/plan')) planCalls += 1; });

try {
  await page.goto(process.env.FRONTEND_URL || 'http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  await page.getByText('服务已连接').waitFor();
  for (const [id, scenario] of Object.entries(fixture)) {
    await page.getByRole('button', { name: '重新规划' }).click();
    const before = planCalls;
    await page.getByRole('textbox', { name: '描述您的出行需求' }).fill(scenario.input);
    await page.getByRole('button', { name: /发送需求/ }).click();
    if (id === 'R6') {
      await page.getByRole('alert').getByText(/120/).waitFor();
      assert.equal(planCalls, before);
      results[id] = { emergencyStop: true, planCalls: 0 };
    } else if (id === 'R7') {
      await page.locator('.follow-up').waitFor();
      assert.equal(planCalls, before);
      assert.equal(await page.locator('.route-card').count(), 0);
      results[id] = { followUp: await page.locator('.follow-up').innerText(), planCalls: 0 };
    } else {
      await page.getByRole('heading', { name: /路线方案/ }).waitFor({ timeout: 20000 });
      const routeCount = await page.locator('.route-card').count();
      assert.equal(routeCount, scenario.routes.length, `${id} route count`);
      if (routeCount) {
        await page.getByRole('button', { name: /查看方案 B/ }).click();
        assert.match(await page.locator('.route-map-shell__safety').innerText(), /当前不建议采用/);
      } else {
        assert.match(await page.locator('.empty-results').innerText(), /缺少足够可靠的地点或路线数据/);
      }
      if (id === 'R4') assert.match(await page.locator('.route-detail').innerText(), /无障碍|轮椅/);
      if (id === 'R5') assert.match(await page.locator('.route-map-shell__safety').innerText(), /当前不建议采用/);
      results[id] = { routeCount, planCalls: planCalls - before, selectedSafety: routeCount ? await page.locator('.route-map-shell__safety').innerText() : null };
    }
    console.log(`${id}: ${JSON.stringify(results[id])}`);
  }
} finally {
  await writeFile('../docs/experiments/sprint3.1-3d-ux-validation/SCENARIO_BROWSER_RESULTS.json', `${JSON.stringify({ evidenceType: 'AUTOMATED_EVIDENCE', cases: results }, null, 2)}\n`, 'utf8');
  await browser.close();
}
