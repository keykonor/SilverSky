# Google Maps / Places 能力调研报告（SilverSky 老人低空出行规划）

- 调研日期：2026-09-29
- 调研人：google-researcher（Reality Research Agent）
- 调研原则：区分「API 理论支持」与「天津/深圳实际有数据」；无证据一律标注 UNKNOWN / NOT VERIFIED。
- 证据等级定义：
  - **官方文档**：developers.google.com / cloud.google.com / mapsplatform.google.com 官方页面
  - **官方周边**：about.google / support.google.com 官方页面（面向消费者功能说明，非 API 承诺）
  - **二手证据**：媒体、开发者社区、第三方测评
  - **UNKNOWN / NOT VERIFIED**：未找到可靠证据

---

## 1. Google Places API (New)：无障碍与出入口字段

### 1.1 字段支持情况（API 理论支持）

| 字段 | 是否支持 | 说明 | 证据等级 |
|---|---|---|---|
| `accessibilityOptions.wheelchairAccessibleEntrance` | ✅ 支持 | 布尔值，可缺省；值未知时字段不返回（客户端参考文档表述为返回 null） | 官方文档 |
| `accessibilityOptions.wheelchairAccessibleParking` | ✅ 支持 | 同上 | 官方文档 |
| `accessibilityOptions.wheelchairAccessibleRestroom` | ✅ 支持 | 同上 | 官方文档 |
| `accessibilityOptions.wheelchairAccessibleSeating` | ✅ 支持 | 同上 | 官方文档 |
| `entrances` | ✅ 支持（2026-08-06 新增） | 返回场所出入口坐标；可在 Place Details (New)、Nearby Search (New)、Text Search (New) 的 field mask 中请求 | 官方文档 |
| `navigationPoints` | ✅ 支持（2026-08-06 新增） | 返回道路侧导航终点及 `navigationPointToken`（可传给 Navigation SDK 或 Routes API）；各点带 travelModes（DRIVE/WALK）与 usages（如 PARKING） | 官方文档 |

关键原文与出处：

- 「Accessibility options. The Places API (New) includes the following accessibility option fields: wheelchairAccessibleParking / wheelchairAccessibleEntrance / wheelchairAccessibleRestroom / wheelchairAccessibleSeating」
  Source: https://developers.google.com/maps/documentation/places/web-service/op-overview （官方文档）
- REST 参考中 `AccessibilityOptions` 的四个布尔字段定义：
  Source: https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places （官方文档）
- 「August 06, 2026 — New fields: entrances and navigationPoints. The entrances and navigationPoints fields can be included in the field mask of a Nearby Search (New), Text Search (New), and Place Details (New) request. The response body for entrances includes entry and exit points for a place. The response body for navigationPoints defines road-side locations where navigation should end.」
  Source: https://developers.google.com/maps/documentation/places/web-service/release-notes （官方文档）
- Place Details (New) 官方示例使用旧金山国际机场（SFO）演示 entrances/navigationPoints 返回结构：
  Source: https://developers.google.com/maps/documentation/places/web-service/place-details （官方文档）

### 1.2 数据覆盖范围说明

- **Google 未在 Places API 文档中声明无障碍字段按国家/地区的覆盖清单**。未找到官方「全球覆盖」或「部分地区覆盖」的 API 级承诺。→ 覆盖范围：**UNKNOWN（官方未声明）**。
- 官方客户端参考（Maps JavaScript API / iOS SDK）明确这些字段是可选的，「Returns true or false if the value is known. Returns null if the value is unknown」，即**字段存在 ≠ 目标 POI 有数据**。
  Source: https://developers.google.com/maps/documentation/javascript/reference/place （官方文档）
- 消费者侧官方帮助页注明：「You can find wheelchair-accessible places on Google Maps **in certain countries only**」（仅在部分国家可用），未列出国家清单。
  Source: https://support.google.com/maps/answer/9882117 （官方周边）
- 官方披露的规模数据：截至 2023 年，Google 可为全球**超过 4000 万**商家提供轮椅无障碍信息（数据主要来自 Local Guides 众包与商家自填）。
  Source: https://about.google/intl/ja_ALL/belonging/disability-inclusion/product-accessibility/ （官方周边）
- 注意：无障碍数据**依赖众包**，中国大陆 Local Guides 生态基本不存在（Google 服务在大陆不可用，见第 3 节），因此大陆 POI 的无障碍属性**高度可能大面积缺失**。→ 具体覆盖率：NOT VERIFIED（无官方数字，仅有上述结构性推断）。

---

## 2. Google Routes API

### 2.1 能力（API 理论支持）

| 能力 | 是否支持 | 证据等级 |
|---|---|---|
| travelMode = DRIVE | ✅ 支持 | 官方文档 |
| travelMode = WALK | ✅ 支持（另有 BICYCLE、TWO_WHEELER、TRANSIT） | 官方文档 |
| 返回 `routes.polyline.encodedPolyline` | ✅ 支持（经 field mask 请求） | 官方文档 |
| 返回 `routes.duration` | ✅ 支持 | 官方文档 |
| 返回 `routes.distanceMeters` | ✅ 支持（恒为公制） | 官方文档 |

- 请求方式：HTTP POST `https://routes.googleapis.com/directions/v2:computeRoutes`，字段经 `X-Goog-FieldMask` 指定；官方示例即使用 `routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline`。
  Source: https://developers.google.com/maps/documentation/routes/compute_route_directions （官方文档）

### 2.2 中国大陆可用性

- **官方覆盖表（按国家）**：中国（CN）一行为「地图图块 2D ⬤ / 3D — / 地理编码 ⬤ / 车流量图层 ◯（近似质量）/ 行车路线与道路贴合 ⬤ / 骑行路线 — / 步行路线 ⬤ / 速限 —」。
  即：**官方声明中国大陆的驾车路线与步行路线「可用且数据质量良好」（⬤），实时交通仅为「近似质量」（◯），骑行路线不可用（—）**。
  Source: https://developers.google.com/maps/coverage （官方文档）
  注意：该表描述的是「数据覆盖」，**不代表端点可在中国大陆网络环境访问**。
- **网络可达性**：maps.googleapis.com 等 Google 服务域名在中国大陆不可直接访问；Google 面向中国的专用端点（maps.google.cn 系）已于 2020 年 2 月停止支持。→ 大陆客户端/服务器直接调用 `routes.googleapis.com` 会超时或失败，须经境外网络出口（服务端部署于境外可规避）。
  Source: https://www.chinafy.com/blog/does-google-maps-work-in-china （二手证据，多方一致）
- **GCJ-02 坐标偏移**：中国大陆街景地图采用 GCJ-02（火星坐标），Google 卫星影像为 WGS-84，两者存在可达数百米的系统性偏移；Google 不提供官方 GCJ-02 转换接口。WGS-84 的 GPS 轨迹/坐标直接叠加 Google 中国街景底图会产生偏移。
  Source: http://www.wikiwand.com/en/articles/Restrictions_on_geographic_data_in_China （二手证据，维基百科条目，长期稳定）
- **数据时效**：多方反馈 Google 中国地图数据自约 2010–2018 年后缺乏系统性更新（Google 无中国测绘资质），POI 陈旧、新建道路/地铁缺失。
  Source: https://chinaneighbor.com/ar/guide/essentials/google-maps-alternatives-china 等（二手证据）

结论：**Routes API 在天津/深圳「官方覆盖表上标称驾车/步行可用且质量良好」，但 (a) 端点在大陆网络不可达，(b) 数据陈旧与 GCJ-02 偏移使实际路线质量存疑**。标称覆盖与实际可用之间存在显著落差。

---

## 3. 天津 / 深圳实际覆盖评估

| 结论项 | 判定 | 证据等级 |
|---|---|---|
| Places API 字段（无障碍/entrances）在 API 层面可请求中国 POI | ✅ 理论支持（无区域排除声明） | 官方文档（未声明排除） |
| 天津 POI 在 Google Places 的实际数据质量/覆盖率 | **NOT VERIFIED**（无官方城市级数据） | — |
| 深圳 POI 在 Google Places 的实际数据质量/覆盖率 | **NOT VERIFIED**（无官方城市级数据） | — |
| 天津/深圳 POI 的无障碍属性（wheelchairAccessible*）实际有值比例 | **UNKNOWN** | — |
| 天津/深圳 POI 的 entrances / navigationPoints 实际有值比例 | **UNKNOWN**（该字段 2026-08 才上线，官方示例均为美国 SFO 机场；无任何中国样本证据） | — |
| Google 中国 POI 整体陈旧、覆盖远低于本土图商 | 多方一致的方向性结论 | 二手证据 |

二手证据摘要（仅作方向性参考，不可作定量依据）：

- Google 地图中国数据「自 2010 年前后未系统性更新」「POI 信息滞后普遍超过 5 年」（大数跨境，2025）：https://www.10100.com/encyclopedia/5/16951507
- 「即使通过 VPN 访问，Google 中国地图数据仍然过时：POI 陈旧、公交不可信」（chinaneighbor，2026-09 核验）：https://chinaneighbor.com/ar/guide/essentials/google-maps-alternatives-china
- 网传「Google 中国 POI 覆盖率约 32%」之类的定量说法出自非权威聚合页面，**不予采信，标记 NOT VERIFIED**。

**核心判断：「API 文档存在该字段」≠「天津/深圳目标 POI 实际返回数据」。无障碍字段依赖众包、大陆无 Local Guides 生态；entrances/navigationPoints 为 2026 年新字段且无任何中国覆盖证据。对 SilverSky 场景（医院/小区出入口级精度）不可依赖 Google 数据源。需实测验证（本次调研未执行 API 实测，建议后续用真实 API Key 对天津/深圳目标 POI 抽样实测后再升级结论）。**

---

## 4. 凭据与计费

| 项目 | 结论 | 证据等级 |
|---|---|---|
| API Key | 需要；经 Google Cloud Console 创建项目并启用相应 API 后获取 | 官方文档 |
| 结算账号 | **强制**：「未与活跃 Cloud Billing 账号关联的项目无法使用 Google Cloud 或 Google Maps Platform 服务，即使仅使用免费服务也是如此」 | 官方文档（cloud.google.com/billing） |
| 每月 $200 免费额度 | **已失效**：2025-03-01 起被按 SKU 免费用量门槛取代 | 官方文档 |
| 现行免费额度 | Essentials 类 SKU 每月 10,000 次免费计费事件；Pro 类 5,000 次；Enterprise 类 1,000 次（Map Tiles 2D/Street View Tiles 为 100,000 次）。Places Details 所需字段多落在 Essentials/Pro 档 | 官方文档 |
| 新客试用 | $300 试用金（Google Cloud 新客） | 官方文档（mapsplatform.google.com/pricing） |
| 中国开发者使用限制 | Google Cloud 商业结算服务未面向中国大陆开放，注册/结算流程中无中国大陆账单地址选项；常见做法是以香港等地区账单地址 + 国际信用卡注册。官方条款按账单地址所在区域确定签约主体（中国大陆不在其区域列举内） | 二手证据 + 官方条款间接印证 |

出处：

- 「未与活跃 Cloud Billing 账号关联的项目无法使用 Google Cloud 或 Google Maps Platform 服务。即使您仅使用免费的服务，也是如此。」
  Source: https://cloud.google.com/billing/docs/how-to/create-billing-account （官方文档）
- 「Effective March 1, 2025… modifying the USD $200 monthly recurring credit by offering a free monthly usage threshold for each Core Services SKU… Essentials 10,000 / Pro 5,000 / Enterprise 1,000」
  Source: https://developers.google.com/maps/billing-and-pricing/faq （官方文档）
- $300 试用金与订阅方案：https://mapsplatform.google.com/pricing/ （官方文档）
- 中国大陆无账单地址选项、以香港地址注册为常见路径：https://www.10100.com/encyclopedia/6/16974652 （二手证据）
- 服务条款按账单地址划分签约主体（EMEA/APAC/加拿大/其他），未列举中国大陆主体安排：https://cloud.google.com/maps-platform/terms/ （官方文档，间接印证）

---

## 5. 总体结论

1. **字段层（理论）**：Places API (New) 支持全部 4 个无障碍字段；`entrances`/`navigationPoints` 于 2026-08-06 上线，Details/Nearby/Text Search 均可请求。字段存在性无争议。
2. **覆盖层（现实）**：Google 未声明无障碍字段的国家覆盖清单（UNKNOWN）；大陆无众包生态，数据大概率大面积缺失；entrances/navigationPoints 无任何中国样本证据（UNKNOWN）。
3. **Routes 层**：DRIVE/WALK 返回 polyline/duration/distance 无误；官方覆盖表对中国驾车/步行标 ⬤，但大陆网络不可达 + 数据陈旧 + GCJ-02 偏移三重问题，使天津/深圳实际路线质量不可依赖。
4. **天津/深圳 POI 实测覆盖**：全部 NOT VERIFIED，必须用真实 API Key 抽样实测后才能定论。
5. **计费**：$200/月额度已于 2025-03-01 取消，改为每 SKU 免费门槛（Essentials 1 万次/月）；结算账号强制；中国大陆无法直接作为账单地区，需香港等境外路径。

**对 SilverSky 的建议**：Google Maps/Places 不能作为天津/深圳老人出行场景的主力数据源；其无障碍字段可作为境外城市的参考实现，国内数据应以本土图商（高德/百度）为准，Google 方案最多作对照实验。
