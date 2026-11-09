import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const browserName = process.env.V2_BROWSER || 'chrome';
const executablePath = browserName === 'edge' ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' : 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox','--enable-unsafe-swiftshader'] });
const context = await browser.newContext({ viewport: { width:1440, height:1000 }, locale:'zh-CN' });
const page = await context.newPage();
const out = '../docs/evidence/v2-mvp';
const text = '我想从天津大学卫津路校区去天津医科大学总医院。';
const areas = new Map();
const errors = [];
let analysis, trip, buildingRequests = 0, routeRequests = 0;
page.on('pageerror', (error) => errors.push(error.message.replace(/https?:\/\/\S+/g,'[URL]')));
page.on('request', (r) => { if(r.url().includes('/api/v2/buildings?')) buildingRequests++; if(r.url().endsWith('/api/v2/route')) routeRequests++; });
page.on('response', async (r) => {
  if(!r.ok()) return;
  if(r.url().endsWith('/api/v2/interpret')) analysis = await r.json();
  if(r.url().endsWith('/api/v2/route')) trip = await r.json();
  if(r.url().includes('/api/v2/buildings?')) areas.set(new URL(r.url()).searchParams.get('poi_id'), await r.json());
});
async function plan(p) {
  await p.goto('http://127.0.0.1:5173/');
  await p.getByLabel('出行需求',{exact:true}).fill(text);
  await p.getByRole('button',{name:'完成',exact:true}).click();
  await p.getByRole('heading',{name:'路线方案',exact:true}).waitFor({timeout:65000});
  await p.getByRole('button',{name:/模拟空中路线 空间参考/}).click();
  await p.getByRole('button',{name:'3D 城市',exact:true}).click();
}
try {
  await plan(page);
  await page.locator('.v2-building-status').filter({hasText:/基础城市模型：\d+ 栋/}).waitFor({timeout:65000});
  assert.equal(areas.size,2,'both public street areas must have actual successful responses');
  const unique = new Set([...areas.values()].flatMap((area)=>area.features.map((f)=>f.id)));
  assert.ok(unique.size > 100 && unique.size <= 400);
  for (const area of areas.values()) assert.ok(area.features.length > 0 && area.features.length <= 200);
  assert.ok((await page.locator('.v2-building-status').innerText()).includes(`${unique.size} 栋`));
  await page.getByRole('button',{name:'起点街区',exact:true}).click();
  await page.waitForTimeout(1600);
  await page.screenshot({path:`${out}/${browserName}-city-origin.png`});
  await page.getByRole('checkbox',{name:'显示建筑',exact:true}).uncheck();
  await page.screenshot({path:`${out}/${browserName}-city-hidden.png`});
  await page.getByRole('checkbox',{name:'显示建筑',exact:true}).check();
  await page.getByRole('button',{name:'终点街区',exact:true}).click();
  await page.waitForTimeout(1600);
  await page.screenshot({path:`${out}/${browserName}-city-destination.png`});
  await page.getByRole('button',{name:'二维地图',exact:true}).click();
  await page.getByRole('button',{name:'3D 城市',exact:true}).click();
  assert.equal(buildingRequests,2,'camera/layer/view changes must not query buildings again');
  assert.equal(routeRequests,1,'city exploration must not replan');
  assert.equal(await page.locator('.v2-cesium canvas').count(),1);
  assert.equal(await page.getByRole('list',{name:'地面出发与到达安排'}).count(),1);

  // Fault injection: only building fetches are replaced by the actual public data obtained above.
  const faultContext = await browser.newContext({viewport:{width:1440,height:1000},locale:'zh-CN'});
  await faultContext.route('**/api/v2/interpret',(r)=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(analysis)}));
  await faultContext.route('**/api/v2/route',(r)=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(trip)}));
  let failDestination = true;
  await faultContext.route('**/api/v2/buildings?*',(r)=> {
    const id = new URL(r.request().url()).searchParams.get('poi_id');
    return r.fulfill({status:failDestination && id === trip.destination.id ? 503 : 200,contentType:'application/json',body:JSON.stringify(failDestination && id === trip.destination.id ? {detail:'建筑轮廓暂不可用'} : areas.get(id))});
  });
  const fault = await faultContext.newPage();
  await plan(fault);
  await fault.getByText('终点街区建筑暂不可用。',{exact:false}).waitFor({timeout:30000});
  assert.ok((await fault.locator('.v2-building-status').innerText()).includes(`${areas.get(trip.origin.id).features.length} 栋`));
  await fault.getByRole('button',{name:'起点街区',exact:true}).click();
  await fault.waitForTimeout(800);
  await fault.screenshot({path:`${out}/${browserName}-city-partial-failure.png`});
  failDestination = false;
  await fault.getByRole('button',{name:'重试建筑加载',exact:true}).click();
  await fault.locator('.v2-building-status').filter({hasText:`${unique.size} 栋`}).waitFor();
  assert.equal(await fault.getByRole('button',{name:'重试建筑加载',exact:true}).count(),0);
  await faultContext.close();

  const report = {evidence_type:'AUTOMATED_EVIDENCE',requirement:'REQ-015',browser:browserName,source:'Actual AMap/OSM requests for public acceptance places',origin_buildings:areas.get(trip.origin.id).features.length,destination_buildings:areas.get(trip.destination.id).features.length,unique_buildings:unique.size,illustrative_heights:[...areas.values()].flatMap(a=>a.features).filter(f=>f.height_status==='ILLUSTRATIVE').length,building_requests:buildingRequests,route_requests:routeRequests,layer_toggle:true,origin_and_destination_views:true,single_viewer:true,time_plan_preserved:true,fault_injection:{partial_model_retained:true,retry_recovered:true,fixtures:'same-run actual public route and footprints'},errors,limitation:'Two local street areas; not complete city or photorealistic texture'};
  assert.deepEqual(errors,[]);
  await writeFile(`${out}/${browserName}-city-results.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} catch(error) { await page.screenshot({path:`${out}/${browserName}-city-failure.png`}); console.log((await page.locator('body').innerText()).slice(-1800)); throw error; }
finally {await browser.close();}
