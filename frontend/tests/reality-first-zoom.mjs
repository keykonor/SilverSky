import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const context = await chromium.launchPersistentContext('artifacts/reality-first-zoom-profile', {
  executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
  viewport: { width: 1440, height: 900 },
  locale: 'zh-CN',
})
const page = await context.newPage()
try {
  const settings = await context.newPage()
  await settings.goto('chrome://settings/appearance', { waitUntil: 'domcontentloaded' })
  await settings.locator('#zoomLevel').selectOption('2')
  await page.goto(process.env.FRONTEND_URL || 'http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '天津体验' }).click()
  await page.getByRole('button', { name: /发送需求/ }).click()
  await page.getByRole('heading', { name: /路线方案 \(2\)/ }).waitFor()
  await page.locator('.route-map__loading-cover').waitFor({ state: 'hidden', timeout: 30000 })
  await page.locator('.route-map__details').getByText(/高德在线驾车参考/).first().waitFor({ timeout: 30000 })
  for (const selector of ['textarea', '.route-card.selected', '.route-detail .safety-line', '.route-map-shell__stage', '.route-map__legend', '.route-map__details']) {
    const item = page.locator(selector).first()
    await item.scrollIntoViewIfNeeded()
    assert.equal(await item.isVisible(), true, `${selector} hidden at native 200% zoom`)
  }
  const layout = await page.evaluate(() => ({ dpr: window.devicePixelRatio, viewport: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, elements: ['.sidebar', '.needs-card', '.routes-section', '.route-detail', '.map-panel', '.route-map__details'].map((selector) => { const item = document.querySelector(selector); return { selector, width: item?.clientWidth, scrollWidth: item?.scrollWidth, right: item?.getBoundingClientRect().right } }) }))
  assert.ok(Math.abs(layout.dpr - 2) < 0.02, `Chrome did not apply native 200% zoom: ${JSON.stringify(layout)}`)
  assert.ok(layout.scrollWidth <= layout.viewport + 2, `Horizontal overflow: ${JSON.stringify(layout)}`)
  await page.getByRole('button', { name: /查看方案 B/ }).click()
  assert.equal(await page.getByRole('button', { name: '真实城市地图' }).getAttribute('aria-pressed'), 'true')
  assert.match(await page.locator('.route-map-shell__safety').innerText(), /当前不建议采用/)
  await mkdir('../docs/evidence/reality-first/implementation', { recursive: true })
  await page.screenshot({ path: '../docs/evidence/reality-first/implementation/native-zoom-200.png', fullPage: true })
  console.log(`Reality-first Chrome native zoom 200%: input, route, safety, 2D map, legend and online evidence reachable; ${JSON.stringify(layout)}`)
} finally {
  await context.close()
}
