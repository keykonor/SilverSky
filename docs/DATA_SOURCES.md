# Sprint 1–2 Golden 数据来源登记

核对日期：2026-09-27。数据仅支持 TJ-001 与 SZ-001；当前文件中的 POI 坐标是 OSM 对象中心点，**不是入口或接送位置**。地面路线是 OSRM 基于 OSM 的一次性驾驶估计，没有实时交通、无障碍或实际服务保证。

| 场景 | 地点名称与地址核对 | 坐标与路线核对 |
| --- | --- | --- |
| TJ-001 | [天津大学卫津路校区](https://tju.edu.cn/tdgk/tdxq/wjlxq.htm)：卫津路 92 号；[天津医科大学总医院](https://www.tj.gov.cn/zwgk/ggqsydwxxgk/ylws/yy/202409/t20240923_6737587.html)：鞍山道 154 号 | OSM way/48165383、way/216874872 的中心点；[OSRM 路线查询](https://router.project-osrm.org/route/v1/driving/117.164728,39.1087675;117.1783982,39.1165863?overview=full&geometries=geojson&steps=false) 驾驶距离 1997.4 米、模型时长 280.6 秒 |
| SZ-001 | [深圳市养老护理院](https://www.sz.gov.cn/szzt2010/szyl/ylfw/jgylfw/yljgcx/content/mpost_11992149.html)：龙珠七路与龙苑路交汇口 56 号；[北京大学深圳医院](https://www.sz.gov.cn/hospital/ssyy/bjdxszyy/content/post_9370612.html)：莲花路 1120 号 | OSM way/1426312278、way/364731902 的中心点；[OSRM 路线查询](https://router.project-osrm.org/route/v1/driving/113.9789758,22.5655958;114.0440949,22.5592647?overview=full&geometries=geojson&steps=false) 驾驶距离 9488.8 米、模型时长 660.3 秒 |

OSM 数据按 [ODbL 与署名规则](https://www.openstreetmap.org/copyright) 使用，公开结果应显示“© OpenStreetMap contributors”；若公开衍生数据库，须满足相应共享义务。四次地点查询遵守 [Nominatim 一次性查询政策](https://operations.osmfoundation.org/policies/nominatim/)；应用运行时不调用公共 Nominatim。路线快照来自 [OSRM 演示服务](https://github.com/Project-OSRM/osrm-backend/wiki/Api-usage-policy) 的两次一次性查询；应用运行时只读本地快照，不依赖公共演示服务。

政府和校方页面用于人工核对少量 POI 名称与地址，不复制整表或网页内容。[天津政务网站法律声明](https://www.tj.gov.cn/glllm_55512/glsy/flsm/)和[深圳政府在线版权声明](https://www.sz.gov.cn/cn/fzgn/bqbh/index.html)限制转载/商用；若后续扩展数据集，应重新核查授权。OSM 地图对象、官方地址和 OSRM 路线来自不同来源，不能把组合结果标为项目独立核验 `VERIFIED`。

D-011 于 2026-09-27T05:55:00Z 再次查询上表两个 OSRM URL，取得天津 50 点、深圳 148 点的 GeoJSON `LineString`；返回距离和时长与原 2026-09-26 快照一致。几何保存在 `data/public/ground-routes.json` 的 `geometry`，查询时间在 `geometry_captured_at`；状态为 `PUBLIC_DATA`，仅为静态道路模型。官方 [OSRM Route API](https://project-osrm.org/docs/v5.24.0/api/) 说明 `overview=full&geometries=geojson` 返回路线几何。OSM 数据按 [版权与署名要求](https://www.openstreetmap.org/copyright) 标注。

Golden 别名位于 `data/public/golden-aliases.json`，各条只指向上表 canonical POI，`source_ref` 为对应机构公开名称页面；别名到具体校区是 **限定情景的产品决定**，不证明任意语境下“天津大学”都指卫津路校区。无明确城市/场景上下文时不映射。

低空场景见 `data/simulated/air-scenarios.json`：天津、深圳各两个 **人工构造** 的 Golden Demo 起降点坐标，供绘制情景用，未存真实起降设施、航路、航班、价格或天气。地面接驳画直线时标 `STRAIGHT_REFERENCE_LINE`，不代表道路；空中直线标 `SIMULATED_AIR_CORRIDOR`，不代表当前航线。接驳距离/时长、步行距离、轮椅通行、实时交通和真实天气须返回 `DATA_UNAVAILABLE` 或 `UNKNOWN`，不得从绘图线条推断。

## Sprint 3 可选三维背景资源

核对日期：2026-09-28。Cesium ion 的 [World Terrain](https://cesium.com/platform/cesium-ion/content/cesium-world-terrain/) 和 [OSM Buildings](https://cesium.com/platform/cesium-ion/content/cesium-osm-buildings/) 为**可选**在线流式背景资源，需要有效 Cesium ion 账户、受限只读 token、网络及适用配额。OSM Buildings 来自 OpenStreetMap，显示须保留 `© OpenStreetMap contributors`；Cesium 自带 Logo、数据 attribution 和地形各来源署名须可见，规则见 [官方使用与署名指南](https://cesium.com/learn/ion/content-usage-and-attribution-guide/) 与 [第三方条款](https://cesium.com/legal/third-party-terms/)。本地未配置 ion token，故 World Terrain/OSM Buildings 成功加载、配额与性能均**未验证**；失败降级已在浏览器模拟验证。用户已确认没有实际比赛环节，本地 Sprint 3 Demo 不以现场网络或赛事许可验收；一般公开展示/部署仍须另行核对许可和配额。无 token 时使用包内 NaturalEarthII 地理概览与本地几何；三维背景不能用作导航、无障碍或低空运营证据，视觉高度为前端模拟展示值。

## 高德地图本地城市背景（D-014/D-015）

2026-09-27 用户澄清：高德用于主地图真实城市背景，**不增加软件内 Key 输入或独立预览功能**；误建连接页已删除。2026-09-28 D-014 的本地凭证、JS API、福建省边界和两城线路转换已在浏览器验证；D-015 把高德城市 3D 与 Cesium 模拟立体航迹放在同一地图区域供切换。高德楼块只在设备/WebGL 与街区近景支持时显示；天津、深圳近景截图证明本机渲染，不证明所有设备覆盖。高德使用 GCJ-02，已有场景几何仍是 WGS84；本地代理按[官方坐标转换](https://lbs.amap.com/api/javascript-api-v2/guide/transform/convertfrom)转换成功后才绘制。高德**仅是背景与行政区查询来源**，不是 POI、静态道路、模拟设施或航空安全证据。地图原生署名与审图信息保留。官方 [JS API 3D](https://lbs.amap.com/api/javascript-api-v2/guide/map/3d-map)、[楼块图层](https://lbs.amap.com/api/javascript-api-v2/guide/layers/official-layers)、[安全密钥](https://lbs.amap.com/api/javascript-api-v2/guide/abc/jscode)、[开放平台协议](https://lbs.amap.com/pages/terms/)及[合规指南](https://lbs.amap.com/api/compliance-center/check-and-reference/compliance)供核对。D-013 对公网部署、正式代理、授权域名、公开使用许可、配额与混用边界仍**待决**；本地加载成功不等于获准公开发布。

## Sprint 3.2 高德在线地面参考（D-016）

2026-09-29 在本地受控 FastAPI 层增加高德 Web 服务地点搜索、POI 详情、驾车与步行参考。提供方可返回 GCJ-02 POI/线路、来源及带时区抓取时间；只有具体名称、同城且与核心规划 POI 的转换坐标相近时，前端才用在线蓝线替代地图上的 OSRM 静态线。核心 `PlanningResult`、Safety 和 WGS84 几何仍使用既有静态数据；失败或地点不一致时地图明确回退“静态道路模型”。高德路段估时不是等候、上下车、门到门或完整行程时间。

两城 Golden 在线实测成功：天津驾车约 1835 米、深圳约 8739 米；耗时随请求时刻变化，单次值不固化为到达承诺。`entr_location` 仅展示为高德到达点证据，不等于已核实入口、轮椅入口或接送点。无障碍、接送点、等待时间仍为未知。此前“高德仅是背景”仅描述 D-014/015 历史阶段，**不再是 Sprint 3.2 的完整现状**。在线能力依赖本地凭证、网络和服务额度；公开部署仍受 D-013 门槛约束。

### 天津通用地点地面路线（D-017/R-002）

用户在页面分别搜索并明确选定天津出发地及全国目的地 POI；后端凭高德 POI ID 重新读取详情，再向高德查询在线驾车路径和可选步行路径。地图只绘高德 GCJ-02 在线几何，文字保留来源、获取时间、距离、路段估时和可选道路步骤。2026-09-29 本地浏览器实测天津站→天津之眼、天津南站→天津博物馆、天津站→北京南站成功；故障模拟返回 `DATA_UNAVAILABLE` 时不画伪线。搜索覆盖高德可识别的地点与地址，不能保证每个输入、具体家门或偏远地点均能匹配。此查询不进入 SilverSky `PlanningResult` 或 Safety，故只称地面道路参考；不提供真实出行安全推荐、完整行程时间或低空路线。公开地点的实际入口、接送、无障碍和轮椅适用性仍未知。
