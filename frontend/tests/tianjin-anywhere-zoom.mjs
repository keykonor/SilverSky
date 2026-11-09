import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { chromium } from 'playwright-core'

const context = await chromium.launchPersistentContext('artifacts/tianjin-anywhere-zoom-profile', {
  executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader'],
  viewport: { width: 1440, height: 900 }, locale: 'zh-CN',
})
try {
  const settings = await context.newPage()
  await settings.goto('chrome://settings/appearance', { waitUntil: 'domcontentloaded' })
  await settings.locator('#zoomLevel').selectOption('2')
  const page = await context.newPage()
  await page.goto(process.env.FRONTEND_URL || 'http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' })
  assert.ok(Math.abs(await page.evaluate(() => window.devicePixelRatio) - 2) < 0.02)
  for (const [index, query] of [[0, '天津站'], [1, '天津之眼']]) {
    const form = page.locator('.direct-planner__search').nth(index)
    await form.locator('input').fill(query)
    await form.getByRole('button', { name: '查找' }).click()
    await form.locator('.direct-planner__choices button').first().waitFor({ timeout: 15000 })
    const box = await form.locator('.direct-planner__choices button').first().boundingBox()
    assert.ok(box && box.height >= 48)
    await form.locator('.direct-planner__choices button').first().click()
  }
  await page.getByRole('button', { name: '查看地面路线' }).click()
  await page.locator('.direct-planner__result').waitFor()
  await page.locator('.route-map__loading-cover').waitFor({ state: 'hidden', timeout: 30000 })
  for (const selector of ['#direct-origin', '#direct-destination', '.direct-planner__submit', '.direct-planner__result', '.route-map-shell__safety', '.route-map__legend']) {
    const element = page.locator(selector).first()
    await element.scrollIntoViewIfNeeded()
    assert.equal(await element.isVisible(), true, `${selector} hidden at 200%`)
  }
  const layout = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, sidebar: document.querySelector('.sidebar')?.scrollWidth, boxes: ['.workspace','.sidebar','.direct-planner','.direct-planner__search input','.direct-planner__submit','.direct-planner__result','.map-panel'].map((selector) => { const rect = document.querySelector(selector)?.getBoundingClientRect(); return { selector, left: rect?.left, right: rect?.right, width: rect?.width } }) }))
  assert.ok(layout.scrollWidth <= layout.width + 2, `Horizontal overflow ${JSON.stringify(layout)}`)
  for (const box of layout.boxes.filter((item) => item.selector.startsWith('.direct-planner'))) assert.ok(box.left >= 0 && box.right <= layout.width + 2, `${box.selector} clipped: ${JSON.stringify(layout)}`)
  await page.getByRole('link', { name: '向下查看路线地图' }).click()
  assert.equal(await page.evaluate(() => location.hash), '#route-map-panel')
  assert.equal(await page.locator('#route-map-panel').isVisible(), true)
  const cdp = await context.newCDPSession(page)
  const capture = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: layout.width * 2, height: 2 * await page.evaluate(() => document.documentElement.scrollHeight), scale: 1 } })
  await writeFile('../docs/evidence/reality-first/implementation/tianjin-anywhere-zoom-200.png', Buffer.from(capture.data, 'base64'))
  console.log(`Tianjin arbitrary route at native 200% zoom PASS: ${JSON.stringify(layout)}`)
} finally { await context.close() }
