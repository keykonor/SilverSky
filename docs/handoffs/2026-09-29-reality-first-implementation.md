# Sprint 3.2 Reality-First 本地实施交接（2026-09-29）

## 本轮目标与状态

从 `sprint3` 分支 `e527aa3` 续接 WorkBuddy 证据，把真实二维地图与天津普通地点选点做成可操作流程。Sprint 3 PASS、Sprint 3.1 G2 PARTIAL 保留；**Sprint 3.2 本地实现完成，Reality Gate PARTIAL**。此结果不表示公开部署或真实出行安全推荐。项目状态以 `docs/PROJECT_STATE.md` 为准。

本轮 Git checkpoint 分拆：契约/来源 `a54ba74`、代码 `ab0b9a9`、测试 `c0f9bb5`、浏览器证据 `eee9d95`；最终状态与交接单独提交。本轮没有修改原有 JSON/GeoJSON 数据集，因此没有新增“数据”提交。

## WorkBuddy Inputs

已核对 WorkBuddy Reality-First 交接、修复指令、`docs/research/reality-first/` 的能力/POI/道路/入口/无障碍/二维 UX/实验资料及两城原始响应。逐项分类见 [WorkBuddy 消化记录](2026-09-29-workbuddy-reality-consumption.md)。既有未跟踪截图 `docs/evidence/reality-first/ux/13-tianjin-3d-vertiport-detail.png` 归 WorkBuddy，本轮未修改或暂存。

## ACCEPT / PARTIAL / REJECT

| 结论 | 分类 | 动作 |
| --- | --- | --- |
| 本地高德 POI/驾车/步行/详情 | ACCEPT | 后端受控接入，时间与来源显示，失败明确降级 |
| 两城 Golden 在线地点和路线 | PARTIAL | 只验收具体样本，不推广为任意地点 |
| 高德到达点等于真正入口 | PARTIAL | 仅标到达点，入口/接送/轮椅保持 UNKNOWN |
| 公开无障碍资料证明完整路线适老 | PARTIAL | 不升级 Safety 结论 |
| OSRM 普遍偏乐观 40–45% | REJECT | 两组样本不足，不做统一时间修正 |
| Google 字段足以作为当前主数据源 | REJECT | 无目标 POI 返回证据、Key/Billing；暂不接入 |
| 旧城残留、过去时间、双端模糊地点 | ACCEPT | 遮罩、过去时间追问、两端分别澄清 |
| 3D 默认显示 | REJECT | 二维默认，三维为可选辅助 |

## External Dependencies

本地高德三类凭证仅确认存在且运行成功，未输出值；线上仍依赖网络/额度。实测一次暂时 `DATA_UNAVAILABLE`，重试恢复，故不能保证持续可用。D-013 的公开许可、域名、正式代理和配额仍待决。本地不需要新增 Google Key 或插件。地点词和选定 POI 会发送至高德，页面已提示不要输入姓名电话；本地不持久化行程。

## Provider Architecture

`backend/ground_reality.py` 增加 `GroundRealityProvider`/高德实现。`GET /api/v1/reality/places` 搜索天津、深圳或全国地点；`POST /api/v1/reality/ground` 给两城 Golden 地图参考；`POST /api/v1/reality/route-by-id` 凭用户选定的两个 POI ID 重查详情，并验证天津起点、在线驾车首尾与所选地点在 750 米内。坏点、缺几何、空时长或失败返回 `DATA_UNAVAILABLE`，不补画直线。GCJ-02 只供高德图层；核心 WGS84 `PlanningResult`、Safety 和 `0.1-proposal` Schema 不变。契约为 R-001/R-002，决定为 D-016/D-017。

## Amap Integration

高德真实二维城市地图默认。Golden 在线线仅在端点匹配时替代地图上的 OSRM 静态线，失败保留标明来源的静态线。天津通用路线用所选 POI 的在线驾车几何，失败时不套用 Golden 线。地图显示起终点、完整线形、来源与未知项；跨城截图两端 marker 可见。结果有时间、距离、可选步行和道路步骤文字，标明**尚未经 SilverSky 安全审查**，不生成低空或推荐方案。

## Google Decision

Google Places 官方字段支持入口/导航点/轮椅信息，但本仓库没有天津/深圳目标地点的实际返回数据。当前不申请 Key/Billing、不宣称其有可用覆盖；以后需有明确目标、授权与实测再评估。

## Tianjin Reality Golden

天津大学卫津路校区→天津医科大学总医院在线参考成功；原静态地面安全 `DOWNGRADE`、模拟低空 `REJECT` 不变。模糊“天津大学/天大”先要求选具体校区。新增三组非 Golden 浏览器路线：天津站→天津之眼约 4.3 km、天津南站→天津博物馆约 22.2 km、天津站→北京南站约 131 km。数值为采样时驾车路段，不是全程承诺；证据在 `docs/evidence/reality-first/implementation/`。

## Shenzhen Reality Golden

深圳 Golden 在线驾车参考约 8.7 km，浏览器已显示；静态方案和安全状态不变。深圳普通起点尚未扩展为本轮通用选点，不写成已覆盖。

## Entrance

POI/高德到达点不能等同校门、院门或轮椅入口。实际入口未核实，`entrance_verified=false`。

## Pickup

没有可靠落客、上车、预约车辆或实时接驳证据；维持 `UNKNOWN`，不声称门到门。

## Accessibility

候选与主按钮至少 48px；Chrome 原生 200% 的 720 CSS px 视口中，路线输入、按钮、结果均在边界内、无水平溢出，地图可从结果链接跳转。axe 覆盖候选、通用结果、Golden、急症等状态，无 serious/critical 违规。道路步骤是文字参考，不是实时导航或无障碍指引。Windows Narrator/NVDA 实际朗读 `NOT_VERIFIED`；真实老人/照护子女 `USER_STUDY_PENDING`。

## 2D UX

首屏两个明确输入：“天津出发地”“目的地（不限天津）”；分别搜索并明确选中 POI 才可查路线。结果显示当前 OD、来源、时间、未知项与下一步；含“向下查看路线地图”。Golden→通用查询清旧需求摘要；急症暂停普通查询，迟到响应不能恢复路线。200% 完整物理视口图为 `tianjin-anywhere-zoom-200.png`。首次使用是否容易仍需真人测试。

## 3D Role

所有原有方案二维默认，3D 由用户主动打开；通用地面路线只显示二维。真人 A/B 尚无样本，3D 只定为 `AUXILIARY`，不能称已提高理解。

## Tests

- 后端全量 **91 passed**、1 个旧 TestClient 弃用警告；含错城线形、坏点、空时长、天津起点和失败降级。核心契约脚本通过既有样例、不安全路线和数据集变体。
- 前端 **19 passed**，TypeScript/生产构建通过；既有天津/深圳 E2E 通过。高德本地与旧城遮罩曾单独通过浏览器检查。
- 三组天津通用在线路线在 Chrome 实测成功；失败不画伪线，选点不自动、旧 Golden 摘要清除、急症迟到响应作废。中途一次上游暂不可用，重试恢复。
- Chrome 原生 200%：宽与滚动宽均为 720 CSS px，核心控件右界 ≤720；CDP 保存 1440 物理像素宽完整截图。axe 新增通用候选/结果覆盖通过。
- `git diff --check` 无格式错误。Sprint 3.1 的 4×/6× CPU 和 30 分钟长测是历史证据，新增通用路线未重跑长测。

## Independent Reviews

Reality Reviewer：初审找出错城线形与北京终点被盖 P1；修复后独立后端 7 passed、跨城图两端可见，终审本地地图真实性 PASS，无 P0/P1；后续也修复了无效中间点 P2。Safety Reviewer：初审发现急症竞态与旧摘要 P1；修复后本地技术行为 PASS，无剩余 P0/P1/P2，不代表真实出行推荐。UX Reviewer：初审质疑 200% 截图裁切与旧摘要；完整 CDP 截图、边界断言及跨流程测试解决，三个 P2（状态文字、地图跳转、第三方查询说明）也已补齐；总体仍 PARTIAL，缺真人测试。Contract Reviewer：独立只读复审确认核心 `0.1-proposal` 兼容、GCJ-02 与 WGS84/Safety 分离；原始输入、TS 来源/未知字段、最小样例和失败字段措辞均已修正，未见 P0/P1；因搜索只覆盖首批 20 个高德候选而判本地契约验收 PARTIAL。

## Reality Gate

| 门槛 | 判定 | 限制 |
| --- | --- | --- |
| Tianjin Ground Reality | PARTIAL | 普通路线本地成功，非每个地址/门到门/安全推荐 |
| Shenzhen Ground Reality | PARTIAL | Golden 在线成功，通用起点未覆盖 |
| Entrance Evidence | PARTIAL | 有 POI/到达点，实际入口未核实 |
| Pickup Evidence | FAIL | 无可靠上下车点/车辆证据 |
| Accessibility Evidence | PARTIAL | UI 自动检查/200% 通过，实际轮椅线路和 Narrator 未验证 |
| 2D Core UX | PARTIAL | 本地流程完成，老人首次使用待测 |
| 3D | AUXILIARY | 真人效用实验未完成 |

## P0 / P1 / P2

终态没有已知未修复 P0/P1。初审的错城线路、终点遮挡、急症异步回填、旧 Golden 上下文均有修复和证据。剩余 P2/证据缺口：偶发在线不可用、长距离道路步骤阅读负担、通用路线慢网/低端设备未实测，以及 Sprint 3.1 长测一条控制台错误未归因。

## UNKNOWN

高德搜索覆盖每个天津地址/偏远地点的比例，实际入口、落客、轮椅可达、车辆和实时交通；Windows Narrator 七项操作、目标老人 2D/3D 实验、生产许可/额度、低端实体 GPU 均未知，不得记 PASS。

## Required User Actions

当前本地演示无需新 Key/Plugin。进一步验收需要产品负责人安排真实老人/照护子女测试与实际入口/接送/无障碍证据；公开部署前须决定 D-013 的授权、生产代理和额度。不要在产品页面添加凭证输入。

## Sprint 4 Recommendation

优先投资：①实际入口/落客/无障碍证据与动态路线 Safety 接口；②普通地址与未命名地点覆盖和失败解释；③真人二维流程、屏幕阅读器和慢设备验证。继续暂停真实低空运营推荐、3D 特效扩张、Google 接入、登录/支付/预约和新城市。

## 给产品负责人的 12 个答案

1. 天津：本地可从高德可识别且用户选定的地点查省内/跨城地面路线；并非每个输入都能匹配，也不是安全推荐。
2. 深圳：Golden 在线道路参考可用，普通深圳起点尚未接入通用流程。
3. 真实在线：高德 POI、详情、驾车/可选步行几何与路段时间，附来源/抓取时间。
4. 静态/模拟：OSRM 道路快照静态；起降点、接驳直线和低空航迹模拟。
5. 真正入口：不能确认；到达点不等于入口。
6. 可靠接送点：不能确认；车辆可用性未知。
7. 无障碍：不能证明整段或轮椅适用。
8. 2D：承载了本地选点、路线和风险文字；老人独立完成仍待试用。
9. 3D：可选地表达未来低空空间层次，真人效用无证据。
10. 新 API/Key/Plugin：本地无需；公开发布需要 D-013 高德许可/域名/代理/配额，当前不需 Google。
11. 三项投资：入口/接送/无障碍证据；通用地址和失败覆盖；真实老人/屏幕阅读器二维验证。
12. 继续暂停：真实低空推荐、3D 视觉扩张、Google、登录支付预约、新城市。

## 审计与接手约束

已盘点 251 个已跟踪及非忽略未跟踪路径，覆盖项目文档、Skills、Schema、源码、配置、数据、样例、测试、交接和证据；忽略项抽样为 `.env`、`.venv` 和缓存，未输出凭证。重点核对 D-016/D-017、R-001/R-002、数据边界和改动验证；不是 251 个文件逐行审阅。

**发现的问题：** ① `docs/evidence/reality-first/ux/13-tianjin-3d-vertiport-detail.png` 为既有未跟踪 WorkBuddy 文件，本轮保持原状；②实际老人、Narrator、入口、接送、生产许可缺证据，状态待验证；③ Sprint 3.1 长测控制台错误原文缺失。接手时不得把在线驾车参考、POI 到达点或 axe 通过写成安全推荐、真实入口或屏幕阅读器 PASS。
