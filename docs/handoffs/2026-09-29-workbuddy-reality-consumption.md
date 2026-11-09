# WorkBuddy Reality-First 交接消化（2026-09-29）

## 范围与方法

起点 `e527aa3`，工作区另有一张未跟踪的 WorkBuddy 截图 `docs/evidence/reality-first/ux/13-tianjin-3d-vertiport-detail.png`，本轮未改动或暂存它。逐项核对 `docs/handoffs/workbuddy/2026-09-29-reality-first-validation.md`、修复指令、8 份研究文档、12 份高德原始响应，以及 Sprint 3.1 源码与契约；对高德、Google 仅核对官方能力文档。2026-09-29 以现有本地 Web 服务 Key 对两城实际再次调用，未输出凭证。`ACCEPT` 只说明本轮证据足以支持相应限定动作，不代表真实出行安全验收。

| Finding | WorkBuddy Evidence | Codex Verification | Decision | Action |
| --- | --- | --- | --- | --- |
| 高德地点检索、驾车和步行接口可用 | `AMAP_CAPABILITY_REVIEW.md`、两城 8 份 POI/路线原始响应 | 官方[POI 搜索](https://lbs.amap.com/api/webservice/guide/api/search/)及[路径规划](https://lbs.amap.com/api/webservice/guide/api/direction)说明字段；现有 Web 服务 Key 实调两城均 `OK` | ACCEPT | 本地后端提供受控查询；在线值仅作路段参考，失败回退静态模型 |
| 两城 Golden POI 和路线总体接近 | `GOLDEN_POI_REALITY_CHECK.md`、`GROUND_ROUTE_COMPARISON.md` | 4 份原始 POI、4 份路线响应成功；本轮再次得到 TJ 1835m、SZ 8739m 驾车路径；仍是两组特定 POI 与时刻 | PARTIAL | 保留两城 Golden 对照；不推广为任意地点/时刻已核实 |
| OSRM 时长“系统性偏乐观 40–45%” | 两组静态与在线对照 | 仅两条同日样本且端点/交通模型不同；可确认两例静态估时较短，不能证明总体系统性幅度 | REJECT | UI 明示“静态道路模型估算，非预计到达时间”；不使用统一校正系数 |
| 高德 `entr_location` 为真实入口 | 4 份详情原始响应均含此字段 | 官方文档称可用作 POI 到达点；未证明具体校门、院门、接送点或轮椅入口 | PARTIAL | 后端保留到达点及时间，UI 只说“高德到达点，实际入口待核实”；精度维持 POI |
| 公开无障碍/落客资料可直接证明完整路线适老 | `ENTRANCE_PICKUP_ACCESSIBILITY.md` 院方与交管来源 | 地点级服务证据不能推断上车点、整条步行/驾车路线或当前可用性；护理院/校门仍缺证据 | PARTIAL | 所有方案的整体无障碍与推荐上下车点维持 UNKNOWN；人工核实列为下一步 |
| Google 字段可作两城主数据源 | `GOOGLE_MAPS_CAPABILITY_REVIEW.md` 为文档能力，无目标 POI 实测或 Key | Google [Places 官方说明](https://developers.google.com/maps/documentation/places/web-service/op-overview)确有 entrances、navigationPoints、wheelchair 字段，但没有天津/深圳四处地点的字段返回证据 | REJECT（当前接入） | 暂不申请或接入；仅留可选交叉核验，不作无障碍承诺 |
| 旧城市地图残留和首次全国视角 | `UX_2D_REVIEW.md`、22–24 等截图 | 原 `AmapRouteMap` 在坐标批量转换结束前保留旧 viewport，确有状态路径；本轮 Chrome 延迟转换截图复核 | ACCEPT | 显式过渡遮罩、先定位端点、缓存已核验转换结果，新增跨城浏览器检查 |
| 已过去时间被接受 | 修复指令 F2、原 Interpreter 代码 | `_time` 曾无相对 `reference_time` 的过去检查 | ACCEPT | 过去时间清除后追问未来时间；保留原文和状态，不自动改成“明天” |
| “从家里去医院”两端模糊 | Sprint 3.1 R7、Interpreter 代码 | 原逻辑仅标起点不确定，目的地泛称未标记 | ACCEPT | 同时标记 `origin`、`destination`，分别追问具体出发位置与医院 |
| 3D 应继续默认 | Sprint 3 Demo 默认；Sprint 3.1 真实用户 A/B 待完成 | 无真人对照证明 3D 提高理解，WorkBuddy 仅启发式走查 | REJECT（默认） | 地面/模拟低空均默认 2D，3D 改为主动打开的辅助视图 |

## External Dependency Gate

- 已核对本地 `.env` **仅凭证存在性**：Web 端 JS Key、安全密钥、Web 服务 Key 均有配置，类型不得混用；本轮两城在线接口实际成功。凭证值未复制进仓库、文档或日志。
- 高德搜索、驾车、步行与详情能力在本地可用；正式配额、QPS、商用许可、授权域名与生产代理仍按 D-013 待决。本轮不把本地成功写成发布可用。
- Google 无本地 API Key、Billing 或目标 POI 实测证据；当前路线能力不依赖 Google。若将来要以 Google 核验特定入口或轮椅字段，需产品负责人提供受控 Key/Billing、目标地点和许可范围，再做实际数据覆盖测试。

## 接收边界与下一步

详见 [D-016](../DECISIONS.md) 与 [R-001](../INTERFACES.md)。WorkBuddy 证据对本地两城实施有价值，但不支持真实出行安全推荐、完整行程时间、真实低空运营或普遍无障碍结论。未跟踪截图保持原状；可复现的新实测放在 `docs/evidence/reality-first/implementation/`。
