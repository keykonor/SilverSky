import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const chromePath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.env.FRONTEND_URL || 'http://127.0.0.1:5173/';
const evidenceDir = fileURLToPath(new URL('../../docs/evidence/sprint3/', import.meta.url));
await mkdir(evidenceDir, { recursive: true });
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN', reducedMotion: 'reduce' });

async function capture(name) {
  await page.locator('.sidebar').evaluate((element) => { element.scrollTop = 0; });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${evidenceDir}${name}.png` });
}

async function demo(city) {
  await page.getByRole('button', { name: `${city}体验` }).click();
  await page.getByRole('button', { name: /发送需求/ }).click();
  await page.getByRole('heading', { name: /路线方案 \(2\)/ }).waitFor();
  await page.waitForTimeout(850);
}

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByText('服务已连接').waitFor();
  await demo('天津');
  await capture('tianjin-ground-3d');
  await page.locator('.route-map-shell__layer:not(.route-map-shell__layer--hidden) .route-map__globe canvas').hover({ position: { x: 620, y: 420 } });
  await page.mouse.wheel(0, -700);
  await capture('tianjin-camera-moved');
  await page.getByRole('button', { name: '查看完整路线' }).click();
  await capture('tianjin-full-journey');
  await page.getByRole('button', { name: /查看方案 B/ }).click();
  await capture('tianjin-air-3d');
  await page.getByRole('button', { name: '查看完整路线' }).click();
  await capture('tianjin-air-full-journey');
  await page.getByRole('button', { name: /模拟起降点 A详情/ }).click();
  await capture('tianjin-vertiport-detail');
  await page.locator('.route-detail .safety-line').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidenceDir}safety-reject.png` });
  await page.locator('.data-truth summary').click();
  await page.locator('.data-truth').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidenceDir}data-truth.png` });

  await page.getByRole('button', { name: '重新规划' }).click();
  await demo('深圳');
  await capture('shenzhen-ground-3d');
  await page.getByRole('button', { name: /查看方案 B/ }).click();
  await capture('shenzhen-air-3d');
  await page.locator('.route-map-shell__layer:not(.route-map-shell__layer--hidden) .route-map__globe canvas').hover({ position: { x: 620, y: 420 } });
  await page.mouse.wheel(0, -700);
  await page.getByRole('button', { name: '查看完整路线' }).click();
  await page.waitForTimeout(1800);
  await capture('shenzhen-full-journey');
  await capture('local-3d-fallback-and-legend');
  console.log(`Sprint 3 screenshots saved to ${evidenceDir}`);
} finally {
  await browser.close();
}
