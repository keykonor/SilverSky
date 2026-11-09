import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' })
const evidence = []
let validReference
const base = process.env.FRONTEND_URL || 'http://127.0.0.1:5173/'

async function selectPlace(role, query) {
  const form = page.locator('.direct-planner__search').nth(role === 'origin' ? 0 : 1)
  await form.locator('input').fill(query)
  const result = page.waitForResponse((response) => response.url().includes('/api/v1/reality/places') && response.request().method() === 'GET')
  await form.getByRole('button', { name: '查找' }).click()
  assert.equal((await result).ok(), true)
  await form.locator('.direct-planner__choices button').first().waitFor({ timeout: 15000 })
  assert.equal(await page.getByRole('button', { name: '查看地面路线' }).isDisabled(), true, 'Search results must not auto-select a place')
  const name = await form.locator('.direct-planner__choices button strong').first().innerText()
  await form.locator('.direct-planner__choices button').first().click()
  return name
}

async function run(originQuery, destinationQuery, file) {
  await page.getByRole('button', { name: '重新规划' }).click()
  const origin = await selectPlace('origin', originQuery)
  const destination = await selectPlace('destination', destinationQuery)
  const response = page.waitForResponse((item) => item.url().includes('/api/v1/reality/route-by-id'))
  await page.getByRole('button', { name: '查看地面路线' }).click()
  const routeResponse = await response
  assert.equal(routeResponse.ok(), true)
  const routeBody = await routeResponse.json()
  validReference = routeBody
  assert.equal(routeBody.status, 'OK')
  assert.equal(routeBody.origin.name, origin)
  assert.equal(routeBody.destination.name, destination)
  assert.equal(routeBody.safety_review, 'NOT_PERFORMED')
  await page.locator('.direct-planner__result').waitFor()
  await page.locator('.route-map__loading-cover').waitFor({ state: 'hidden', timeout: 30000 })
  await page.waitForTimeout(1500)
  assert.match(await page.locator('.route-map-shell__safety').innerText(), /未经 SilverSky 安全审查/)
  assert.equal(await page.getByRole('button', { name: '查看立体旅程' }).count(), 0)
  assert.equal(await page.getByRole('button', { name: '真实城市地图' }).getAttribute('aria-pressed'), 'true')
  await page.screenshot({ path: `../docs/evidence/reality-first/implementation/${file}.png`, fullPage: true })
  evidence.push({ origin, destination, originCity: routeBody.origin.city, destinationCity: routeBody.destination.city, distance_m: routeBody.driving.distance_m, geometryPoints: routeBody.driving.geometry.length, safety: routeBody.safety_review })
}

try {
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  await page.getByText('服务已连接').waitFor()
  await mkdir('../docs/evidence/reality-first/implementation', { recursive: true })
  await run('天津站', '天津之眼', 'tianjin-station-to-eye')
  await run('天津南站', '天津博物馆', 'tianjin-south-to-museum')
  await run('天津站', '北京南站', 'tianjin-to-beijing')
  await page.getByRole('button', { name: '重新规划' }).click()
  await selectPlace('origin', '天津站')
  await selectPlace('destination', '天津之眼')
  await page.route('**/api/v1/reality/route-by-id', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'DATA_UNAVAILABLE', message: '测试：在线路线不可用' }) }))
  await page.getByRole('button', { name: '查看地面路线' }).click()
  await page.getByText(/暂无可靠数据：测试：在线路线不可用/).waitFor()
  assert.equal(await page.locator('.direct-planner__result').count(), 0)
  assert.equal(await page.locator('.route-map__legend').getByText(/高德在线驾车参考/).count(), 0)
  await page.unroute('**/api/v1/reality/route-by-id')

  await page.getByRole('button', { name: '重新规划' }).click()
  await page.getByRole('button', { name: '天津体验' }).click()
  await page.getByRole('button', { name: /发送需求/ }).click()
  await page.getByRole('heading', { name: /路线方案 \(2\)/ }).waitFor()
  await selectPlace('origin', '天津站')
  assert.equal(await page.getByRole('heading', { name: 'SilverSky 已理解' }).count(), 0, 'Old Golden trip must not remain current during direct search')
  await selectPlace('destination', '天津之眼')
  let releaseRoute
  const blocked = new Promise((resolve) => { releaseRoute = resolve })
  await page.route('**/api/v1/reality/route-by-id', async (route) => { await blocked; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(validReference) }).catch(() => {}) })
  const requestStarted = page.waitForRequest((request) => request.url().includes('/api/v1/reality/route-by-id'))
  await page.getByRole('button', { name: '查看地面路线' }).click()
  await requestStarted
  await page.getByRole('textbox', { name: '描述您的出行需求' }).fill('老人突然胸痛，而且呼吸困难')
  await page.getByRole('button', { name: /发送需求/ }).click()
  await page.locator('.emergency-panel').waitFor()
  releaseRoute()
  await page.waitForTimeout(250)
  assert.equal(await page.locator('.direct-planner__result').count(), 0, 'Late route response must not restore ordinary planning after emergency')
  assert.equal(await page.getByRole('button', { name: '查看地面路线' }).isDisabled(), true)
  await writeFile('../docs/evidence/reality-first/implementation/tianjin-anywhere-runs.json', JSON.stringify({ date: new Date().toISOString(), environment: 'Local Chrome + live Amap Web Service', evidence }, null, 2))
  console.log(`Arbitrary Tianjin origins to destinations: ${evidence.length} live browser routes rendered; failed route shows no false line or safety recommendation.`)
} finally {
  await browser.close()
}
