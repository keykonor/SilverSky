import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import AxeBuilder from '@axe-core/playwright';

const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const out = '../docs/evidence/v2-mvp';
await mkdir(out, { recursive: true });
const reports = {};
const text = '我想从天津大学卫津路校区去天津医科大学总医院。';
try {
  const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5173/');
  await page.getByText('服务已连接', { exact: true }).waitFor();
  reports.native_speech_constructor = await page.evaluate(() => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
  // This is an explicit event stub for UI integration, never acoustic recognition evidence.
  await page.addInitScript(() => {
    class EventStub {
      start() { this.onstart?.(); }
      stop() {
        this.onresult?.({ results: [{ isFinal: true, 0: { transcript: '我想从天津大学卫津路校区去天津医科大学总医院。' } }] });
        setTimeout(() => this.onend?.(), 0);
      }
      abort() {}
    }
    window.SpeechRecognition = EventStub;
  });
  await page.reload();
  let analyses = 0;
  page.on('request', (r) => { if (r.url().endsWith('/api/v2/interpret')) analyses++; });
  const mic = page.getByRole('button', { name: '按住说话', exact: true });
  const bounds = await mic.boundingBox();
  await page.mouse.move(bounds.x + bounds.width/2, bounds.y + bounds.height/2);
  await page.mouse.down();
  await page.getByRole('button', { name: '松开结束', exact: true }).waitFor();
  await page.mouse.up();
  await page.getByText(/已填入文字，请检查修改后点击完成/).waitFor();
  assert.equal(await page.getByLabel('出行需求', { exact: true }).inputValue(), text);
  assert.equal(analyses, 0);
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await page.getByRole('heading', { name: '路线方案', exact: true }).waitFor({ timeout: 65000 });
  assert.equal(analyses, 1);
  reports.voice_ui = { status: 'PASS', evidence: 'AUTOMATED_EVENT_STUB', real_acoustic_asr: 'NOT_VERIFIED', explicit_complete_required: true, real_backend_after_complete: true };
  const axe = await new AxeBuilder({ page }).exclude('.amap-maps').analyze();
  reports.axe = { serious_critical: axe.violations.filter((v) => ['serious','critical'].includes(v.impact)).map((v) => ({ id: v.id, nodes: v.nodes.length })), excluded: 'third-party .amap-maps canvas', real_screen_reader: 'NOT_VERIFIED' };
  assert.deepEqual(reports.axe.serious_critical, []);
  await page.getByRole('button', { name: '修改行程', exact: true }).click();
  // Amap fails after places are confirmed: old lines must not remain, text is retained.
  await page.route('**/api/v2/route', (r) => r.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ detail: '高德未能提供可靠的驾车路线，未绘制路线。请核对地点或稍后重试。' }) }));
  await page.getByRole('button', { name: '完成', exact: true }).click();
  await page.getByRole('alert').waitFor({ timeout: 65000 });
  assert.equal(await page.getByLabel('出行需求', { exact: true }).inputValue(), text);
  assert.equal(await page.getByRole('heading', { name: '路线方案', exact: true }).count(), 0);
  await page.screenshot({ path: `${out}/chrome-amap-error.png` });
  reports.amap_failure = { status: 'PASS', injected: true, text_preserved: true, old_route_cleared: true };
  await context.close();
  const unsupportedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await unsupportedContext.addInitScript(() => { window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; });
  const unsupported = await unsupportedContext.newPage();
  await unsupported.route('**/api/v2/status', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"deepseek_configured":true,"amap_configured":true}' }));
  await unsupported.route('**/__amap_config', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await unsupported.goto('http://127.0.0.1:5173/');
  await unsupported.getByText(/此浏览器不支持网页语音识别/).waitFor();
  assert.equal(await unsupported.getByRole('button', { name: '按住说话', exact: true }).isDisabled(), true);
  await unsupported.getByLabel('出行需求', { exact: true }).fill(text);
  assert.equal(await unsupported.getByRole('button', { name: '完成', exact: true }).isEnabled(), true);
  assert.equal(await unsupported.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await unsupported.screenshot({ path: `${out}/mobile-unsupported-speech-map.png`, fullPage: true });
  reports.unsupported = { status: 'PASS', text_available: true, explicit_fallback: true, no_mobile_horizontal_overflow: true, map_failure: true };
  await writeFile(`${out}/failure-voice-ui-results.json`, JSON.stringify(reports, null, 2));
  console.log(JSON.stringify(reports, null, 2));
} finally { await browser.close(); }
