import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' })
const baseUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5173/'
const runs = []
try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await page.getByText('服务已连接').waitFor()
  assert.equal(await page.getByText('地图能力核验').count(), 0, 'Developer-only Fujian probe leaked into product UI')
  for (let cycle = 0; cycle < 5; cycle++) {
    for (const [city, button] of [['TIANJIN', '天津体验'], ['SHENZHEN', '深圳体验']]) {
      await page.getByRole('button', { name: '重新规划' }).click()
      await page.getByRole('button', { name: button }).click()
      const planResponse = page.waitForResponse((response) => response.url().includes('/api/v1/plan') && response.request().method() === 'POST')
      await page.getByRole('button', { name: /发送需求/ }).click()
      const response = await planResponse
      assert.equal(response.ok(), true)
      await page.getByRole('heading', { name: /路线方案 \(2\)/ }).waitFor()
      const cover = page.locator('.route-map__loading-cover')
      const covered = await cover.isVisible()
      const started = Date.now()
      await cover.waitFor({ state: 'hidden', timeout: 30000 })
      const mapReadyMs = Date.now() - started
      assert.equal(await page.getByRole('button', { name: '真实城市地图' }).getAttribute('aria-pressed'), 'true')
      assert.match(await page.locator('.route-map-shell__safety').innerText(), /正在查看：纯地面方案/)
      const live = await page.locator('.route-map__details').getByText(/高德在线驾车参考/).first().isVisible().catch(() => false)
      runs.push({ cycle: cycle + 1, city, covered, mapReadyMs, onlineReferenceVisibleAtMapReady: live })
      if (cycle === 0) {
        await page.locator('.route-map__details').getByText(/高德在线驾车参考/).first().waitFor({ timeout: 30000 })
        await mkdir('../docs/evidence/reality-first/implementation', { recursive: true })
        await page.screenshot({ path: `../docs/evidence/reality-first/implementation/${city.toLowerCase()}-2d-online.png`, fullPage: true })
        await page.getByRole('button', { name: /查看方案 B/ }).click()
        assert.equal(await page.getByRole('button', { name: '真实城市地图' }).getAttribute('aria-pressed'), 'true', 'Simulated air route did not default to 2D')
        assert.match(await page.locator('.route-map-shell__safety').innerText(), /当前不建议采用/)
        await page.getByRole('button', { name: '查看立体旅程' }).click()
        assert.match(await page.locator('.route-map-shell__safety').innerText(), /当前不建议采用/)
      }
    }
  }
  for (const failure of ['upstream', 'mismatch']) {
    const check = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' })
    try {
      await check.route('**/api/v1/reality/ground', (route) => failure === 'upstream'
        ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ status: 'DATA_UNAVAILABLE' }) })
        : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'OK', origin: { location: [114, 22] }, destination: { location: [114, 22] }, driving: { geometry: [[114, 22], [114.1, 22.1]], distance_m: 1000, duration_min: 10, retrieved_at: new Date().toISOString() } }) }))
      await check.goto(baseUrl, { waitUntil: 'domcontentloaded' })
      await check.getByRole('button', { name: '天津体验' }).click()
      await check.getByRole('button', { name: /发送需求/ }).click()
      await check.getByRole('heading', { name: /路线方案 \(2\)/ }).waitFor()
      await check.locator('.route-map__details').getByText(failure === 'upstream' ? /高德在线路线暂不可用；当前显示静态道路模型/ : /高德在线地点与当前方案不一致；保留静态道路模型/).waitFor({ timeout: 30000 })
      assert.equal(await check.locator('.route-map__details').getByText(/高德在线驾车参考/).count(), 0)
    } finally {
      await check.close()
    }
  }
  await writeFile('../docs/evidence/reality-first/implementation/map-switch-runs.json', JSON.stringify({ date: new Date().toISOString(), environment: 'Local Chrome headless, Amap configured', runs }, null, 2))
  console.log(`Reality-first map: ${runs.length} city plans, online reference visible in both Golden cases, upstream and endpoint-mismatch fallback passed. Maximum map-ready ${Math.max(...runs.map((run) => run.mapReadyMs))} ms.`)
} finally {
  await browser.close()
}
