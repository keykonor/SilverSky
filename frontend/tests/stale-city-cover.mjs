import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' })
let delayConversion = false
await page.route('**/__amap_convert', async (route) => {
  if (delayConversion) await new Promise((resolve) => setTimeout(resolve, 2500))
  await route.continue()
})
try {
  await page.goto(process.env.FRONTEND_URL || 'http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '天津体验' }).click()
  await page.getByRole('button', { name: /发送需求/ }).click()
  await page.getByRole('heading', { name: /路线方案 \(2\)/ }).waitFor()
  await page.locator('.route-map__loading-cover').waitFor({ state: 'hidden', timeout: 30000 })
  delayConversion = true
  await page.getByRole('button', { name: '重新规划' }).click()
  await page.getByRole('button', { name: '深圳体验' }).click()
  await page.getByRole('button', { name: /发送需求/ }).click()
  await page.getByRole('heading', { name: /路线方案 \(2\)/ }).waitFor()
  const cover = page.locator('.route-map__loading-cover')
  assert.equal(await cover.isVisible(), true, 'New result exposed the previous city map')
  const topLayer = await page.evaluate(() => {
    const map = document.querySelector('.route-map')
    const rect = map.getBoundingClientRect()
    const element = document.elementFromPoint(rect.left + rect.width * 0.78, rect.top + rect.height * 0.45)
    return { loadingCover: Boolean(element?.closest('.route-map__loading-cover')), text: element?.textContent?.slice(0, 30) }
  })
  assert.equal(topLayer.loadingCover, true, `Old city tiles may be above transition cover: ${JSON.stringify(topLayer)}`)
  await mkdir('../docs/evidence/reality-first/implementation', { recursive: true })
  await page.screenshot({ path: '../docs/evidence/reality-first/implementation/cross-city-pending.png', fullPage: true })
  await cover.waitFor({ state: 'hidden', timeout: 30000 })
  assert.equal(await page.getByRole('button', { name: '真实城市地图' }).getAttribute('aria-pressed'), 'true')
  console.log('Cross-city pending: old map covered above Amap tiles, new city revealed after conversion.')
} finally {
  await browser.close()
}
