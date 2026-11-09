import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5173/?legacy=1';
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' });
let planCalls = 0;
page.on('request', (request) => { if (request.url().includes('/api/v1/plan')) planCalls += 1; });

async function send(text) {
  await page.getByRole('textbox', { name: '描述您的出行需求' }).fill(text);
  await page.getByRole('button', { name: /发送需求/ }).click();
}

async function reset() {
  await page.getByRole('button', { name: '重新规划' }).click();
}

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.getByText('服务已连接').waitFor();
  assert.equal(await page.getByRole('button', { name: '天津体验' }).count(), 1);
  assert.equal(await page.getByRole('button', { name: '深圳体验' }).count(), 1);

  await page.getByRole('button', { name: '天津体验' }).click();
  assert.match(await page.getByRole('textbox', { name: '描述您的出行需求' }).inputValue(), /天津大学卫津路校区/);
  await page.getByRole('button', { name: /发送需求/ }).click();
  await page.getByRole('heading', { name: /路线方案 \(2\)/ }).waitFor();
  await page.locator('.route-map__safety-note').getByText(/不保证无障碍通行/).waitFor();
  assert.equal(await page.locator('.metric').filter({ hasText: '道路模型车行时间' }).count(), 1);
  await page.getByText(/车行时间来自静态道路模型估算，不是预计到达时间/).waitFor();
  assert.equal(await page.getByText('目前没有满足 SilverSky 安全推荐条件的真实出行方案。').count(), 1);
  assert.equal(await page.getByRole('button', { name: '真实城市地图' }).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.getByRole('button', { name: '查看完整路线' }).isEnabled(), true);
  await page.getByRole('button', { name: '查看完整路线' }).click();
  await page.getByRole('button', { name: /查看方案 B/ }).click();
  assert.equal(await page.getByRole('button', { name: '真实城市地图' }).getAttribute('aria-pressed'), 'true');
  await page.getByRole('button', { name: '查看立体旅程' }).click();
  await page.locator('.route-map-shell__layer:not(.route-map-shell__layer--hidden) .route-map__disclosure summary').filter({ hasText: '数据说明' }).click();
  await page.locator('.cesium-widget canvas').evaluate((canvas) => { window.__s3ViewerCanvas = canvas; });
  await page.getByRole('button', { name: /查看方案 A/ }).click();
  await page.getByRole('button', { name: /查看方案 B/ }).click();
  assert.equal(await page.locator('.cesium-widget canvas').evaluate((canvas) => window.__s3ViewerCanvas === canvas), true, 'Route switch recreated the Cesium Viewer');
  assert.equal(await page.locator('.route-card.selected').evaluate((card) => getComputedStyle(card).borderTopColor), 'rgb(132, 148, 157)');
  assert.equal(await page.locator('.route-card.selected').getByText('当前查看').count(), 1);
  await page.getByText('模拟低空情景 · 未来场景演示，当前不可据此购票或乘坐').waitFor();
  await page.getByRole('heading', { name: '模拟低空情景' }).waitFor();
  await page.getByText(/未来低空模拟航线/).first().waitFor();
  await page.getByText(/高度仅为画面演示/).first().waitFor();
  await page.getByRole('button', { name: /模拟起降点 A详情/ }).click();
  await page.getByText(/非真实运营设施/).first().waitFor();
  assert.doesNotMatch(await page.locator('body').innerText(), /\b(?:DATA_UNAVAILABLE|SIMULATED_DATA|PUBLIC_DATA|PUBLIC_ROUTE_SNAPSHOT)\b/);
  assert.equal(await page.getByRole('link', { name: '© OpenStreetMap contributors' }).count(), 1);
  await page.getByText(/地面线路为示意连接/).first().waitFor();
  await page.waitForTimeout(1200);
  await mkdir('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/tianjin-result.png', fullPage: true });

  await reset();
  await page.getByRole('button', { name: '深圳体验' }).click();
  assert.match(await page.getByRole('textbox', { name: '描述您的出行需求' }).inputValue(), /深圳市养老护理院/);
  await page.getByRole('button', { name: /发送需求/ }).click();
  await page.getByRole('heading', { name: /路线方案 \(2\)/ }).waitFor();
  await page.getByRole('button', { name: /查看方案 B/ }).click();
  await page.getByRole('button', { name: '查看立体旅程' }).click();
  await page.getByText(/未来低空模拟航线/).first().waitFor();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'artifacts/shenzhen-result.png', fullPage: true });
  await page.locator('.sidebar').evaluate((element) => { element.scrollTop = 0; });
  await page.screenshot({ path: 'artifacts/shenzhen-conversation.png', fullPage: true });

  await reset();
  const beforeConversation = planCalls;
  await send('我父亲明天下午要去天津医大总医院。');
  await page.getByText('请告诉我具体起点。').first().waitFor();
  assert.equal(planCalls, beforeConversation);
  await send('天津大学。');
  await page.getByText(/请确认行动能力是正常、一般，还是需要协助/).first().waitFor();
  assert.equal(planCalls, beforeConversation);
  await send('78岁，腿脚不方便，希望安全舒服一点。');
  await page.getByText(/天津大学有多个校区/).first().waitFor();
  assert.equal(planCalls, beforeConversation);
  await send('从天津大学卫津路校区出发');
  await page.getByRole('heading', { name: /路线方案 \(2\)/ }).waitFor();
  assert.equal(planCalls, beforeConversation + 1);
  assert.equal(await page.getByRole('article', { name: /方案/ }).count(), 2);
  await page.locator('.route-map-shell__layer:not(.route-map-shell__layer--hidden) .route-map__disclosure summary').filter({ hasText: '数据说明' }).click();
  await page.locator('.route-map-shell__layer:not(.route-map-shell__layer--hidden)').getByText(/OSRM 静态道路模型快照/).waitFor();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'artifacts/tianjin-three-turn.png', fullPage: true });
  await page.getByRole('button', { name: /查看方案 B/ }).click();
  await page.getByRole('button', { name: '查看立体旅程' }).click();
  await page.getByText(/未来低空模拟航线/).first().waitFor();
  await page.waitForTimeout(1200);
  assert.equal(await page.getByText(/入口：/).count(), 0);
  await page.screenshot({ path: 'artifacts/tianjin-three-turn-air.png', fullPage: true });
  await page.locator('.sidebar').evaluate((element) => { element.scrollTop = 0; });
  await page.screenshot({ path: 'artifacts/tianjin-three-turn-conversation.png', fullPage: true });

  await reset();
  const stripGeometry = async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    for (const option of body.route_options) for (const segment of option.segments) {
      delete segment.geometry;
      delete segment.geometry_status;
      delete segment.geometry_evidence;
    }
    await route.fulfill({ response, json: body });
  };
  await page.route('**/api/v1/plan', stripGeometry);
  await page.getByRole('button', { name: '天津体验' }).click();
  await page.getByRole('button', { name: /发送需求/ }).click();
  await page.locator('.route-map-shell__layer:not(.route-map-shell__layer--hidden)').getByText(/暂无可绘制线路/).waitFor();
  await page.unroute('**/api/v1/plan', stripGeometry);

  await reset();
  const beforeEmergency = planCalls;
  await send('老人突然胸痛，而且呼吸困难');
  await page.getByRole('alert').getByText(/请优先联系 120/).waitFor();
  assert.equal(planCalls, beforeEmergency);

  await reset();
  await page.getByRole('textbox', { name: '描述您的出行需求' }).fill('78岁老人从深圳市养老护理院到北京大学深圳医院，明天下午15:00出发，安全舒适优先。');
  await page.getByRole('textbox', { name: '描述您的出行需求' }).press('Enter');
  await page.getByRole('heading', { name: /路线方案/ }).waitFor();
  console.log('Browser E2E PASS: Tianjin and Shenzhen geometry, route switching, Golden three turns, emergency, keyboard.');
} finally {
  await browser.close();
}
