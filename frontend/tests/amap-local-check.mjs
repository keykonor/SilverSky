import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const baseUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5173/?legacy=1'
const configResponse = await fetch(new URL('/__amap_config', baseUrl))
const configured = configResponse.ok
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' })

try {
  await page.goto(new URL('/?legacy=1&dev=1', baseUrl).toString(), { waitUntil: 'domcontentloaded' })
  await page.getByText('服务已连接').waitFor({ timeout: 15000 })
  if (configured) {
    await page.getByText('高德地图已加载。').waitFor({ timeout: 30000 })
    await page.getByText('地图能力核验').click()
    await page.getByText(/福建省边界查询成功/).waitFor({ timeout: 30000 })
    await page.getByText('地图能力核验').click()
    assert.equal(await page.locator('.amap-maps').count(), 1)
    assert.equal(await page.locator('.amap-logo').count() > 0, true, 'AMap native attribution must remain visible')
    const probeResponse = await fetch(new URL('/__amap_district_probe', baseUrl))
    const probe = await probeResponse.json()
    assert.equal(probeResponse.ok && probe.available === true && probe.adcode === '350000', true, 'Web service boundary probe failed')
    await page.waitForTimeout(1200)
    await mkdir('artifacts', { recursive: true })
    await page.screenshot({ path: 'artifacts/amap-china-overview.png', fullPage: true })
    await page.getByRole('button', { name: '天津体验' }).click()
    await page.getByRole('button', { name: /发送需求/ }).click()
    await page.getByRole('heading', { name: /路线方案 \(2\)/ }).waitFor({ timeout: 30000 })
    await page.locator('.route-map__loading-cover').waitFor({ state: 'hidden', timeout: 30000 })
    assert.doesNotMatch(await page.locator('.route-map-shell__layer:not(.route-map-shell__layer--hidden) .route-map__legend').innerText(), /模拟低空/, 'ground map must not advertise an absent air line')
    assert.doesNotMatch(await page.locator('.route-map-shell__layer:not(.route-map-shell__layer--hidden) .route-map__details').innerText(), /坐标转换失败/)
    await page.getByRole('button', { name: /查看方案 B/ }).click()
    await page.getByRole('button', { name: '查看立体旅程' }).waitFor()
    assert.equal(await page.getByRole('button', { name: '真实城市地图' }).getAttribute('aria-pressed'), 'true')
    await page.getByRole('button', { name: '查看立体旅程' }).click()
    await page.locator('.cesium-widget canvas:visible').first().waitFor()
    const spatialCanvas = await page.locator('.cesium-widget canvas').first().elementHandle()
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'artifacts/tianjin-spatial-route.png' })
    await page.getByRole('button', { name: '真实城市地图' }).click()
    await page.locator('.route-map__loading-cover').waitFor({ state: 'hidden', timeout: 30000 })
    assert.match(await page.locator('.route-map-shell__layer:not(.route-map-shell__layer--hidden) .route-map__legend').innerText(), /模拟低空/)
    assert.doesNotMatch(await page.locator('.route-map-shell__layer:not(.route-map-shell__layer--hidden) .route-map__details').innerText(), /坐标转换失败/)
    await page.getByRole('button', { name: '查看起点街区' }).click()
    await page.waitForTimeout(1400)
    await page.screenshot({ path: 'artifacts/amap-city-3d-closeup.png' })
    await page.getByRole('button', { name: '查看立体旅程' }).click()
    assert.equal(await spatialCanvas?.evaluate((canvas) => canvas.isConnected), true, 'Cesium Viewer canvas must survive view switch')
    await page.getByRole('button', { name: '重新规划' }).click()
    await page.getByRole('button', { name: '深圳体验' }).click()
    await page.getByRole('button', { name: /发送需求/ }).click()
    await page.getByRole('heading', { name: /路线方案 \(2\)/ }).waitFor({ timeout: 30000 })
    await page.locator('.route-map__loading-cover').waitFor({ state: 'hidden', timeout: 30000 })
    assert.doesNotMatch(await page.locator('.route-map-shell__layer:not(.route-map-shell__layer--hidden) .route-map__details').innerText(), /坐标转换失败/)
    await page.getByRole('button', { name: '查看起点街区' }).click()
    await page.waitForTimeout(4500)
    await page.screenshot({ path: 'artifacts/shenzhen-city-3d-closeup.png' })
    await page.getByRole('button', { name: /查看方案 B/ }).click()
    assert.equal(await page.getByRole('button', { name: '真实城市地图' }).getAttribute('aria-pressed'), 'true')
    await page.getByRole('button', { name: '查看立体旅程' }).click()
    await page.locator('.cesium-widget canvas:visible').first().waitFor()
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'artifacts/shenzhen-spatial-route.png' })
    const conversionFailurePage = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' })
    try {
      await conversionFailurePage.route('**/__amap_convert', (route) => route.fulfill({ status: 503, body: 'conversion unavailable' }))
      await conversionFailurePage.goto(baseUrl, { waitUntil: 'domcontentloaded' })
      await conversionFailurePage.getByText('高德地图已加载。').waitFor({ timeout: 30000 })
      await conversionFailurePage.getByRole('button', { name: '天津体验' }).click()
      await conversionFailurePage.getByRole('button', { name: /发送需求/ }).click()
      await conversionFailurePage.getByText(/地点坐标转换失败；当前地图无法可靠定位/).waitFor({ timeout: 30000 })
      assert.equal(await conversionFailurePage.getByRole('button', { name: '查看完整路线' }).count(), 0, 'failed conversion must not leave a route overlay')
      await conversionFailurePage.getByRole('button', { name: /查看方案 B/ }).click()
      assert.match(await conversionFailurePage.locator('.safety-line.reject').innerText(), /当前不建议采用/)
    } finally {
      await conversionFailurePage.close()
    }
  } else {
    await page.getByText(/高德地图不可用，已显示 Cesium 基础地图/).waitFor({ timeout: 15000 })
    assert.equal(await page.locator('.cesium-widget canvas').count(), 1)
  }
  await page.waitForTimeout(1800)
  await page.screenshot({ path: `artifacts/amap-${configured ? 'loaded' : 'unconfigured'}.png`, fullPage: true })
  console.log(configured ? 'AMap map, Fujian JS boundary, attribution and Web service probe verified.' : 'AMap unconfigured state and labeled Cesium fallback verified.')
} finally {
  await browser.close()
}
