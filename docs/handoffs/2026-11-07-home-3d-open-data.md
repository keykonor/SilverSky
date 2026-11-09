# 首页开放数据库3D街区模型 · 2026-11-07

用户REQ-018/019明确需要真实建筑轮廓与街区，优先无需密钥；REQ-020取消继续检查手机布局。本轮使用现有Cesium及OSM开放数据库，不引入数据库服务、付费API或新凭据。

## 实现与来源

- 首页无行程时即可点“3D 城市”，默认天津；可切深圳或拖动视野后点“加载当前街区”。默认二维不变，行程仍使用原起终点模型，可从城市浏览返回行程模型。
- OSM真实闭合建筑轮廓，WGS84；使用原始height标签或明确12米示意。每个浏览街区固定±0.005经度/±0.004纬度、最多500栋；路线仍每端200栋，合并最多400栋。无整城、纹理或高精度地形承诺；关系多面体不解析。
- 新增兼容GET /api/v2/city-buildings，限制坐标/数量/固定上游/响应大小/请求超时；503不补造，支持重试。仅发送街区bbox至OSM，无用户文本/路线外发。
- [OSM许可](https://www.openstreetmap.org/copyright)为ODbL；[Cesium源码](https://github.com/CesiumGS/cesium)使用[Apache-2.0](https://github.com/CesiumGS/cesium/blob/main/LICENSE.md)。已先检索[独立开发者主列表](https://github.com/1c7/chinese-independent-developer)及[程序员版](https://github.com/1c7/chinese-independent-developer/blob/master/.github/pages/README-Programmer-Edition.md)，未找到合适的城市模型数据源，随后采用官方OSM资料。开源渲染器、开放数据库和托管服务分别核对，不把Cesium ion当作无需许可的模型数据库。

## 实际验证

- 后端全量150 passed（当时新增9项已纳入）；随后增加空数据/500栋上限2项，最终V2 55 passed。均有1条既有Starlette/httpx弃用警告。
- 前端44 passed、typecheck、最终build通过。原有契约校验和5份数据基线通过。
- Chrome桌面真实HTTP：天津500栋（4栋来源高度），深圳111栋（2栋来源高度）；当前视野手动加载成功。OSM道路底图HTTP200，单Viewer；图层/相机/二维三维切换不重查建筑。
- 故障注入503：底图和3D容器保留，中文提示，重试使用同次真实公开数据恢复，无补造。新地图控件和信息区axe严重/关键=0，pageerror=0。仅此局部范围通过；初次整页扫描发现既有输入字数色彩对比4.37，未顺手改无关输入区，不能宣称整页无障碍通过。
- 原有v2-city.mjs真实公开地点回归：两端200+200=400栋、模型开关、两处近景、单Viewer、仅1次规划、时间保留、部分建筑失败/恢复通过。该旧脚本默认刷新docs/evidence/v2-mvp中的Chrome城市证据；本轮结果另复制至本目录，避免当前报告依赖旧日期目录。
- 初始沙箱内TestClient卡在Windows socketpair初始化，连/health也复现；正常权限后全部通过。未改项目环境或测试逻辑绕过。
- 按REQ-020收窄后的最终脚本只测桌面；最终报告mobile_validation=EXCLUDED_BY_USER。不将中途范围调整前的额外检查提升为手机验收。

## 文件与复现

实现：backend/v2.py；frontend/src/v2/CityScene.tsx、MvpMap.tsx、useCityBuildings.ts、v2.css。测试：tests/backend/test_v2.py、frontend/src/v2/useCityBuildings.test.ts、frontend/tests/home-3d.mjs。相关契约、台账、项目状态和交接索引同步。

前后端服务运行后，在frontend执行 `node tests/home-3d.mjs`；原行程回归为 `node tests/v2-city.mjs`（真实DeepSeek/高德公开地点流程，需要原有配置）。本轮未变更锁文件、核心Schema、历史归档、后端路线逻辑或真实/模拟边界；工作区原有大量未提交变更保持，不提交/推送。

检查范围为上述源文件、调用方、公共来源/许可及实际桌面画面/网络；未独立审计OSM每栋物理高度、完整城市覆盖、真实老人/读屏、低端GPU、长测或公网许可。在线OSM有可用性依赖，椭球地形不代表真实地表。公网D-013仍待决，模拟低空不获得安全结论。

证据：[最终桌面报告](../evidence/2026-11-07-home-3d/chrome-results.json)、[天津](../evidence/2026-11-07-home-3d/chrome-tianjin.png)、[深圳](../evidence/2026-11-07-home-3d/chrome-shenzhen.png)、[旧行程回归](../evidence/2026-11-07-home-3d/chrome-city-results.json)。

使用：[首页](http://127.0.0.1:5173/) → “3D 城市” → “天津街区 / 深圳街区”；拖动后点“加载当前街区”。下一步由用户桌面复评，未知高度与整城纹理仍保持明确限制。
