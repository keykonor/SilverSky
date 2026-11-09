# 高德开放平台（lbs.amap.com）能力调研报告

- 项目：SilverSky AI（老人低空出行规划）
- 调研人：amap-researcher（Reality Research Agent）
- 调研日期：2026-09-29
- 原则：现实正确性 > 证据透明。仅引用高德开放平台官方文档；无官方证据处明确标注 `NOT AVAILABLE / NOT FOUND IN OFFICIAL API`，不做推测。
- 证据等级标注：**【官方文档直接证据】** / **【推断】** / **【UNKNOWN】**

---

## 1. POI 能力

### 1.1 支持的搜索机制（Web 服务 API）

官方文档明确说明搜索服务 API 提供四种筛选机制：关键字搜索、周边搜索、多边形搜索、ID 查询。
**证据等级：官方文档直接证据**
Source: https://lbs.amap.com/api/webservice/guide/api/search （页面标题"搜索POI"，最后更新 2026-07-15）

| 能力 | 是否支持 | 请求 URL | 证据等级 |
|---|---|---|---|
| 关键字/文本搜索 | 支持 | `https://restapi.amap.com/v3/place/text` | 官方文档直接证据 |
| 周边搜索 | 支持 | `https://restapi.amap.com/v3/place/around` | 官方文档直接证据 |
| 多边形搜索 | 支持 | `https://restapi.amap.com/v3/place/polygon` | 官方文档直接证据 |
| POI Detail（ID 查询） | 支持 | `https://restapi.amap.com/v3/place/detail`（参数 `id`，一次最多 1 个） | 官方文档直接证据 |

限制：翻页查询最多支持获取 200 条数据；`offset` 强烈建议不超过 25。（官方文档直接证据，同上 Source）

### 1.2 输入提示（Input Tips）

- 支持。请求 URL：`https://restapi.amap.com/v3/assistant/inputtips`（GET），必填参数 `keywords`。
- 返回字段（tips 列表）：`id`（POI 类型时返回 POI ID）、`name`、`district`、`adcode`、`location`（tip 中心点坐标；busline 类型时不返回）、`address`。
- 即：输入提示可直接返回经纬度 `location` 与 POI ID，可与 ID 查询配合使用（官方文档原文建议"ID 查询……建议可同输入提示 API 配合使用"）。

**证据等级：官方文档直接证据**
Source: https://lbs.amap.com/api/webservice/guide/api-advanced/inputtips （最后更新 2026-02-02）

### 1.3 POI 返回字段（关键字/周边/多边形/ID 查询共用）

`pois[]` 下字段（官方文档逐项列出）：

| 字段 | 含义 | 备注 |
|---|---|---|
| `id` | 唯一 ID | 基础返回 |
| `name` | 名称 | 基础返回 |
| `type` | 兴趣点类型（大类;中类;小类） | 基础返回 |
| `typecode` | 兴趣点类型编码（如 050118） | 基础返回 |
| `address` | 地址 | 基础返回 |
| `location` | 经纬度，格式 `X,Y`（经度,纬度） | 基础返回 |
| `distance` | 离中心点距离（米） | 仅周边搜索返回 |
| `biz_type` / `tel` / `postcode` 等 | 行业类型、电话、邮编 | 部分需 `extensions=all` |
| `business_area` | 所属商圈 | `extensions=all` 时返回 |
| `entr_location` | **POI 的入口经纬度** | `extensions=all` 时返回；官方原文："也可用作于 POI 的到达点" |
| `exit_location` | POI 的出口经纬度 | 官方原文："**目前不会返回内容**" |
| `navi_poiid` | POI 导航 ID | `extensions=all` 时返回 |
| `parking_type` | 停车场类型（地下/地面/路边） | 仅停车场类 POI；`extensions=all` |
| `indoor_map` / `indoor_data`（含 `cpid`/`floor`/`truefloor`） | 室内地图标志与数据 | `extensions=all` 时返回 |
| `photos` / `biz_ext`（rating、cost 等） | 照片、深度信息 | `extensions=all` 时返回 |

结论：POI 返回包含 `location`（经纬度）、`type`/`typecode`、`address`，三者均为官方文档直接证据。
Source: https://lbs.amap.com/api/webservice/guide/api/search

---

## 2. 路线能力

高德 Web 服务同时存在两代路径规划接口：**路径规划 2.0（v5）** 与 **旧版 v3 路径规划**，两代文档当前均在线。

### 2.1 路径规划 2.0（v5）

官方文档原文："支持驾车、公交、步行、骑行、电动车路线规划。"
Source: https://lbs.amap.com/api/webservice/guide/api/newroute （最后更新 2026-06-17）

| 方式 | 请求 URL | 是否支持 |
|---|---|---|
| 驾车 | `https://restapi.amap.com/v5/direction/driving` | 支持 |
| 步行 | `https://restapi.amap.com/v5/direction/walking` | 支持 |
| 公交 | `https://restapi.amap.com/v5/direction/transit/integrated` | 支持 |
| 骑行 | `https://restapi.amap.com/v5/direction/bicycling` | 支持 |
| 电动车 | `https://restapi.amap.com/v5/direction/electrobike` | 支持 |

v5 返回结构（驾车/步行/骑行/电动车）：
- 基础返回（不设 `show_fields`）：`route.paths[].distance`（方案距离，米）、`steps[]`（`instruction`/`orientation`/`road_name`/`step_distance`）。
- **`duration` 与 `polyline` 在 v5 中不是默认返回**：需通过 `show_fields` 显式请求——`show_fields=cost` 返回 `cost.duration`（耗时，秒）；`show_fields=polyline` 返回 `polyline`（分路段坐标点串）。另有 `navi`（action/assistant_action）、`tmcs`（路况）、`cities`（途径城市）等可选字段类。

**证据等级：官方文档直接证据**（v5 公交部分返回结果表格在官方页面中未能完整提取到 segments 明细，v5 公交 segments 级字段见 2.2 v3 结构并标注）
Source: https://lbs.amap.com/api/webservice/guide/api/newroute

### 2.2 旧版 v3 路径规划（文档仍在线）

Source: https://lbs.amap.com/api/webservice/guide/api/direction （最后更新 2026-02-02）

- 步行：`https://restapi.amap.com/v3/direction/walking`（最大 100km）。返回 `route.paths[].distance`（米）、`duration`（秒）、`steps[]`（`instruction`/`road`/`distance`/`duration`/`polyline`/`action`/`assistant_action`/`walk_type`）。
- 驾车：`https://restapi.amap.com/v3/direction/driving`。返回 `route.paths[].distance`（米）、`duration`（秒）、`tolls`、`traffic_lights`、`steps[]`（含分段 `polyline`），`taxi_cost` 需 `extensions=all`。
- 公交：`https://restapi.amap.com/v3/direction/transit/integrated`。返回 `route.transits[]`：`cost`（元）、`duration`（秒）、`walking_distance`、`segments[]`：
  - `walking`：步行段（`distance`/`duration`/`steps[]` 含 `polyline`）；
  - `bus.buslines[]`：`departure_stop`（`name`/`id`/`location` 经纬度）、`arrival_stop`（`name`/`id`/`location`）、`name`/`type`/`distance`/`duration`/`polyline`/`via_stops[]`（含各站 `location`）、首末班时间；
  - `entrance`：**地铁入口**（`name` + `location` 经纬度，仅地铁路段有值）；
  - `exit`：**地铁出口**（`name` + `location` 经纬度，仅地铁路段有值）；
  - `railway`：火车换乘（`departure_stop`/`arrival_stop` 含 `location`、`adcode`、车次、仓位价格等）。

**证据等级：官方文档直接证据**

### 2.3 关键结论

- `distance`、`duration`、`steps`、`polyline` 四类字段在 v3 全部默认返回（官方文档直接证据）。
- v5 中 `distance`/`steps` 默认返回；`duration`（经 `cost`）、`polyline`、`navi` 需 `show_fields` 显式开启（官方文档直接证据）。
- 起终点支持传 POI ID（`origin_id`/`destination_id`，v5；v3 为 `originid`/`destinationid`）提升算路准确性（官方文档直接证据）。

---

## 3. 入口 / 上下车点 / 到达点能力

| 能力 | 结论 | 证据 | Source |
|---|---|---|---|
| POI 入口经纬度（entrance） | **支持**：`entr_location`，POI 搜索/详情 `extensions=all` 时返回；官方原文"也可用作于 POI 的到达点" | 官方文档直接证据 | https://lbs.amap.com/api/webservice/guide/api/search |
| POI 出口 | 字段存在（`exit_location`）但官方原文"**目前不会返回内容**"，即实际不可用 | 官方文档直接证据 | 同上 |
| 导航点 | `navi_poiid`（POI 导航 ID）`extensions=all` 返回；导航 ID 的具体使用方式官方页面未展开 | 官方文档直接证据（字段存在）/ UNKNOWN（用法细节） | 同上 |
| 主入口（main entrance，多入口区分） | **NOT FOUND IN OFFICIAL API**。文档仅有单一 `entr_location`，无多入口/主入口区分字段 | — | — |
| 上下车点（pickup/dropoff 专用字段） | **NOT AVAILABLE / NOT FOUND IN OFFICIAL API**。最接近的官方能力为 `entr_location`（到达点）与公交 `entrance`/`exit`（地铁出入口） | — | — |
| 停车点 | `parking_type`（地下/地面/路边），仅停车场类 POI 返回，非"下车点"语义 | 官方文档直接证据 | https://lbs.amap.com/api/webservice/guide/api/search |
| 地铁出入口 | 公交路径规划（v3）segments 中 `entrance`/`exit` 各含 `name`+`location`，仅地铁路段有值 | 官方文档直接证据 | https://lbs.amap.com/api/webservice/guide/api/direction |
| business area（商圈） | 支持：`business_area`（POI，`extensions=all`）；逆地理编码返回 `businessAreas[]`（含商圈中心点 `location`、`name`、`id`） | 官方文档直接证据 | https://lbs.amap.com/api/webservice/guide/api/search ; https://lbs.amap.com/api/webservice/guide/api/geocode |
| 室内地图 | `indoor_map`（0/1 标志）+ `indoor_data`（`cpid`/`floor`/`truefloor`），`extensions=all` 返回 | 官方文档直接证据 | https://lbs.amap.com/api/webservice/guide/api/search |
| AOI 边界 | 支持：`https://restapi.amap.com/v5/aoi/polyline`（按 POI ID 查边界坐标串 `polyline`、中心点 `location`、`area` 等）。**注意：属高阶服务，需通过工单申请开通权限**。逆地理编码 `extensions=all` 也可返回所在 AOI（`aois[]`：`id`/`name`/`location`/`area`/`distance`） | 官方文档直接证据 | https://lbs.amap.com/api/webservice/guide/api/search（AOI 边界查询节）; https://lbs.amap.com/api/webservice/guide/api/geocode |

---

## 4. 凭据（Key）、认证与配额

### 4.1 Key 类型

- Key 按"服务平台"区分类型，需分别创建。创建 Key 时需在应用下"添加 Key"并选择服务平台：`Web 服务`（用于 restapi.amap.com 服务端 HTTP 接口）与 `Web端(JS API)`（用于 webapi.amap.com 地图 JS API）是两个不同的平台选项；另有 Android/iOS/微信小程序等平台。
- **JS API Key 与 Web 服务 Key 是不同类型的 Key，不能混用**（创建时平台选项不同；配额页也注明"配额共享平台：API、JS、Android、iOS、微信小程序"，即各平台 Key 调用共享同一服务组配额）。

**证据等级：官方文档直接证据**
Source: https://lbs.amap.com/api/webservice/create-project-and-key （最后更新 2026-03-30）; https://lbs.amap.com/api/jsapi-v2/prerequisites ; https://lbs.amap.com/upgrade

### 4.2 JS API 安全密钥（securityJsCode）与域名

- **securityJsCode 必须**：官方原文"2021年12月02日后创建的 key 必须配备安全密钥一起使用"。设置方式两种：服务端代理转发（`window._AMapSecurityConfig.serviceHost`，官方强烈建议）或明文 `securityJsCode`（官方注明"不建议在生产环境使用"）。
- **授权域名白名单**：**NOT FOUND IN OFFICIAL API**（本次调研的官方文档中未见 JS API 强制配置域名白名单的要求；官方提供的安全机制为安全密钥/代理转发）。

**证据等级：官方文档直接证据（securityJsCode）；NOT FOUND（域名白名单）**
Source: https://lbs.amap.com/api/javascript-api-v2/guide/abc/prepare（"JS API 安全密钥使用"，最后更新 2025-06-18）; https://lbs.amap.com/api/jsapi-v2/prerequisites

### 4.3 实名/开发者认证

- 需先注册成为开发者（console.amap.com/dev/id）并创建应用与 Key。
- 官方定价页明确区分"**个人认证开发者**"与"**企业认证开发者**"两类配额档位，且免费月配额仅面向"非商业目的使用的个人认证开发者"及经评估的企业认证开发者（自注册认证之日起 1 年）。即：获取可用免费配额需完成认证；注册环节是否强制实名认证的流程细节 **UNKNOWN**（官方文档未展示注册表单细节）。

**证据等级：官方文档直接证据（认证档位存在且与配额挂钩）；UNKNOWN（注册环节强制实名细节）**
Source: https://lbs.amap.com/upgrade

### 4.4 配额与收费（官方最新政策，新定价 2025-05-20 起执行）

官方配额为**月配额**（注意：2021 年后高德从日配额改为月配额+共享服务组模式，2025-05-20 起执行新定价）。

| 服务组 | 包含接口 | 个人认证开发者（月配额） | 企业认证开发者（月配额） | 企业（技术服务许可）（月配额） | 超配额价格 |
|---|---|---|---|---|---|
| 基础 LBS 服务 | 驾车/骑行/步行/**公交路径规划**、距离测量、地理/逆地理编码、坐标转换、行政区划、IP 定位、静态地图 | 150,000 | 3,000,000 | 9,000,000 | 30 元/万次 |
| 基础搜索服务 | **关键字搜索、周边搜索、多边形搜索、ID 查询、输入提示** | 5,000 | 50,000 | 500,000 | 30 元/万次 |
| 基础地图定位 | JS 地图图面初始化、在线定位 | 1,500,000 | 30,000,000 | 90,000,000 | 3 元/万次 |
| 天气 / 智能硬件定位 | — | 5,000 / 0 | 5,000 / 5,000 | 9,000,000 / 9,000,000 | 30 元/万次 |

- 免费月配额期限：非商业目的个人认证开发者自注册认证之日起 **1 年**免费月配额。
- 配额共享平台：API、JS、Android、iOS、微信小程序（同一服务组跨平台共享）。
- 月配额超限后需付费购买流量包（30 元/万次，有效期 1 年）；LBS 服务按量另有阶梯折扣（0–30W 八折、30–100W 六折等，搜索服务不享受折扣）。
- **QPS**：官方配额页注明"QPS 配额信息请在控制台-流量分析-配额管理页面查看"，文档未给出公开的具体 QPS 数字（**UNKNOWN / 需登录控制台核实**）；提升 QPS 需购买 QPS 包（400~1500 元/月/10QPS，联系商务）。
- 企业技术服务许可：基础版 ¥50,000/年、高级版 ¥100,000/年（含配额权益与合规许可）。

**证据等级：官方文档直接证据**
Source: https://lbs.amap.com/upgrade ; https://lbs.amap.com/api/webservice/guide/tools/flowlevel（该页最后更新 2024-07-15，已跳转至定价页）

---

## 5. 对 SilverSky 的能力结论速览

| SilverSky 需要的能力 | 高德是否可满足 | 关键依据 |
|---|---|---|
| 地点搜索（文本/周边/多边形） | 可满足 | v3/place/text、/around、/polygon |
| 地点联想（输入提示） | 可满足（返回 POI ID + 经纬度） | v3/assistant/inputtips |
| POI 详情（ID 查询） | 可满足 | v3/place/detail |
| POI 经纬度/类型/地址 | 可满足 | `location`/`type`/`typecode`/`address` |
| 驾车/步行/公交路径规划（distance/duration/steps/polyline） | 可满足（v3 默认全返回；v5 需 show_fields） | v3/v5 direction 系列 |
| 地铁出入口（含经纬度） | 可满足（仅公交 v3 地铁路段） | segments.entrance/exit |
| POI 入口/到达点 | 可满足（`entr_location`，需 extensions=all） | 搜索 API |
| POI 出口 | 不可用（字段存在但官方称不返回内容） | 搜索 API |
| 通用上下车点/多入口 | **NOT AVAILABLE** | 无官方字段 |
| AOI 边界 | 可满足但需工单开通高阶权限（或逆地理编码降级获取所在 AOI） | v5/aoi/polyline |
| JS 端地图 | 需独立 JS API Key + securityJsCode（2021-12-02 后强制） | JS API 文档 |
| 免费额度 | 个人认证：搜索类 5,000 次/月、路径规划类 150,000 次/月（非商业 1 年）；超出 30 元/万次 | 官方定价页 |

---

*本报告所有结论均以 2026-09-29 当日可访问的高德开放平台官方文档为准；官方页面未来变更请以 lbs.amap.com 最新文档为准。*
