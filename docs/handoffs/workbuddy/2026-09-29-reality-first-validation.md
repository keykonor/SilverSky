# WorkBuddy Handoff — 2026-09-29 Reality-First 验证

Task：Reality-first 全量验证（高德/Google 能力调研、两城 Golden 实测、入口/无障碍证据、2D UX 独立体验、3D 风险、测试协议准备）
Scope：只读研究 + 外部 API 实测 + 本地 Demo UX 审查；未修改任何业务代码、Schema、Safety 逻辑、数据文件。
研究文档：`docs/research/reality-first/`（8 份）；实测证据 JSON：`docs/evidence/reality-first/`（12 份原始 API 响应 + UX 截图）。

---

## Executive Summary

本轮用**真实外部证据**检验 SilverSky 与真实出行情境的差距，核心结论：

1. **POI 与路线现实性成立**：4 个 Golden POI 在高德全部首条命中，坐标经 GCJ-02 对齐后与 OSM 中心点仅差 6–71 m（同一物理地点）；两城 OSRM 静态路线与高德驾车路线主干一致，距离差 ≤8.1%，无 MATERIAL_MISMATCH。
2. **时长系统性偏乐观 40–45%**：OSRM 自由流模型 vs 高德交通感知（TJ 4.7→8.8 min，SZ 11.0→20.1 min）。UI 必须保持「模型估算」声明，不得显示为预计到达时间。
3. **入口能力有真实抓手**：高德 `entr_location`（到达点）对 4/4 Golden POI 实测有返回；医院类 POI 有门诊/急诊/停车场子 POI。这是从「POI 中心点」走向「可用到达点」的最低成本路径。
4. **无障碍证据两极**：两家医院有 HIGH 级公开无障碍证据（总医院助老服务、北大深圳医院门诊落客区共享轮椅）；天津大学校门与深圳养老护理院入口级无障碍证据 **UNKNOWN**。
5. **Google 不能作为两城主力数据源**：官方覆盖表标称可用，但大陆网络不可达、数据陈旧、无障碍字段依赖 Local Guides 众包（大陆生态不存在）——仅作 OPTIONAL 交叉验证。
6. **3D 误导风险真实存在**（见 UX 章节）。

## Amap Findings

（详见 `AMAP_CAPABILITY_REVIEW.md`，全部结论有官方文档 URL）

- POI：文本/周边/多边形/ID 查询、输入提示全部支持；返回经纬度/类型/地址。
- 路线：v3 驾车/步行/公交默认返回 distance/duration/steps/polyline；v5 需 `show_fields` 显式开启 duration/polyline。
- 入口：`entr_location`（extensions=all）官方明确"可用作 POI 到达点"；`exit_location` 字段存在但官方称不返回内容；**无多入口、无通用上下车点字段（NOT AVAILABLE）**；AOI 边界需工单开通。
- 凭据：JS API Key 与 Web 服务 Key 为不同类型 Key 不可混用；JS API 强制 securityJsCode（官方强烈建议服务端代理转发）；域名白名单要求 NOT FOUND；免费月配额：搜索类 5,000 次/月、路径规划类 150,000 次/月（个人认证非商业 1 年），超量 30 元/万次；QPS 数字需登录控制台核实（UNKNOWN）。
- **实测**：`entr_location` 对 4/4 Golden POI 有值（北大深圳医院另有 indoor_map=1）；总医院/北大深圳医院有门诊楼/急诊部/停车场子 POI。

## Google Findings

（详见 `GOOGLE_MAPS_CAPABILITY_REVIEW.md`）

- Places (New) 理论支持 `entrances`、`navigationPoints`（2026-08-06 新增）与 4 个 wheelchairAccessible* 字段。
- 但：大陆端点不可达（maps.google.cn 2020-02 停止支持）、覆盖表仅标称数据质量、GCJ-02 偏移、数据陈旧、无障碍字段依赖大陆不存在的 Local Guides 众包。
- 结论：REQUIRED NOW 不成立；OPTIONAL（境外部署时的交叉验证）；不得用于对老人承诺无障碍。

## Tianjin Reality Check

- POI 全部 CONSISTENT（对齐后 71 m / 32 m）。
- 驾车：OSRM 1997 m/4.7 min vs 高德 1835 m/8.8 min → REASONABLE_DIFFERENCE（端点差异 + 自由流 vs 交通模型）。
- 总医院入口证据充分：3 号门急诊落客（交管部门 2024-11 公告，HIGH）、10 号门/16 号门车行入口（HIGH）、门诊 1 号门（MEDIUM）；院方官网助老无障碍服务（HIGH）。
- 天津大学：东/西/北/铭德道门有校方公告（HIGH），但**校门轮椅通行能力 UNKNOWN**。

## Shenzhen Reality Check

- POI 全部 CONSISTENT（对齐后 6 m / 11 m）；养老护理院门牌「56号 vs 高德60号」待官方复核。
- 驾车：OSRM 9489 m/11.0 min vs 高德 8739 m/20.1 min → REASONABLE_DIFFERENCE；主干走廊一致（龙珠大道—北环大道—新洲路）。
- 北大深圳医院：B601 就医专线门诊落客区+共享轮椅（官网，HIGH）、门急诊新楼（HIGH）。
- 养老护理院：入口/停车/接送点全部 UNKNOWN 或仅 LOW 级营销稿证据；**不得对该 POI 做任何适老设施声明**。

## Entrance Findings

- 最高价值发现：高德 `entr_location` 实测 4/4 有返回（天津大学 799 m、总医院 129 m、护理院 61 m、北大深圳 149 m 距 POI 点），可作 MEDIUM 级「到达点」。
- 官方/媒体级入口证据：总医院 4 个门（HIGH×3）、北大深圳医院门诊落客区与新门急诊楼（HIGH）、天津大学 4 个校门（HIGH）。
- 无证据：所有 POI 的网约车专用上下客点（任何数据源 NOT AVAILABLE）。

## Pickup Findings

- 总医院：出租车「就医通道」至 3 号门急诊楼前落客（交管部门公告，HIGH）。
- 北大深圳医院：B601 门诊大厅旁落客区（官网，HIGH）；老人临时停靠≤10 分钟仅第三方（LOW）。
- 天津大学、深圳养老护理院：UNKNOWN。

## Accessibility Findings

- 有证据（HIGH）：总医院（院方官网助老服务：临时停车区、轮椅坡道、共享轮椅、无障碍卫生间）；北大深圳医院（落客区共享轮椅、连廊、陪诊轮椅协助）。
- UNKNOWN：天津大学校门级；深圳养老护理院全部入口级；两院无障碍专用停车位均 UNKNOWN（北大深圳仅 LOW 级第三方）。
- 红线维持：UNKNOWN 处不得说「适合老人」。

## 2D UX Findings

（详见 `UX_2D_REVIEW.md`，24 张截图证据 `docs/evidence/reality-first/ux/`；双视角实测本地 Demo）

七维度判定：Start **PASS** / Follow-up **PASS** / Location **PASS** / Route **PARTIAL** / Safety **PASS** / Evidence **PASS** / Next Step **PARTIAL**。

- 老人视角：输入与追问只靠打字，术语（"降低推荐优先级""OSRM 模型快照"）难懂；150% 缩放可用；模拟方案紫 banner 醒目有效。
- 子女视角：流程顺畅、证据透明度极高；核心摩擦是"结果返回瞬间地图不是目标城市"。
- **P0-1**：重新规划后地图残留上一城市 4–10 秒且无任何切换提示，新方案文字与旧城市地图同屏——现实正确性误导（22/23/24 截图复现双向）。
- **P1-1**：首次结果返回后约 10 秒内地图无有效路线（全国视野→超大视野→街区级），"路线在哪"不能立刻回答。
- **P1-2**：系统无提示接受过去的出发时间（2026-09-29 输入 9-28 15:00 直接出方案）。
- P2：DOWNGRADE 措辞过术语、缺"两方案谁更接近现实"直白对比；地图面板暴露无关的"福建省边界查询成功（421 段）"且紫色福建高亮常驻；"为什么这样规划"有机器拼接语。
- P3：追问无快捷选项；3D 标签重叠；控制台 1 条 404（疑 favicon）；对话折叠后继续交互入口不显眼。

## 3D Risks

（详见 UX_2D_REVIEW.md 第四节）

- 模拟低空在立体视图中的视觉真实感与文案否定存在天然张力，但当前**四层文案缓解（顶部状态条+面板+紫 banner+详情）密度高、位置醒目**，误导风险整体为低。
- 最大残留：R1 截图外传播场景（航迹剖面像真实飞行，免责声明可能不在截图内）；R3 主视图"高德地图 · 城市 3D"常驻文案只强调"3D"，否定说明藏在折叠详情（低-中）。
- 不存在"3D 无明显标注导致必然误认"的 P0 问题；建议增加水印级常驻标识以覆盖截图传播场景。

## External Dependencies

| 能力 | 分级 | 说明 |
|---|---|---|
| 高德 Web 服务 API（POI 搜索/输入提示/路径规划/POI Detail 含 entr_location） | **REQUIRED NOW** | Key 已在仓库 `.env`；搜索类免费配额 5,000 次/月较紧，需注意调用预算；生产前需决定认证档位 |
| 高德 JS API Key + securityJsCode 服务端代理 | REQUIRED NOW（上线前） | 官方明确明文 securityJsCode 不建议生产使用 → 需要生产代理（关联 D-013） |
| Google Places (New) / Routes API | OPTIONAL | 仅境外部署时作交叉验证；需 Billing 账号；不得用于无障碍承诺 |
| 高德 AOI 边界查询 | OPTIONAL | 需工单开通高阶权限；有逆地理编码降级路径 |
| 额外 3D 服务（ion 在线地形/建筑等） | NOT NEEDED NOW | 维持现状 |

## P0

1. **P0-1（UX）**：重新规划后地图残留上一城市 4–10 秒，新方案文字与旧城市地图同屏且无切换提示——现实正确性误导，违反「现实正确性 > 一切」原则。数据层实测无 P0（POI 与路线均无 MATERIAL_MISMATCH）。

## P1

1. **P1-1（UX）**：首次结果返回后约 10 秒地图无有效路线（全国→超大视野→街区级），"路线在哪"不能一眼回答。
2. **P1-2（UX/逻辑）**：系统无提示接受过去的出发时间并照常出方案。
3. OSRM 时长系统性偏乐观 40–45%：UI 任何时长显示必须保持「道路模型估算」声明且足够显眼（当前声明方向正确，需在修复 P0/P1 时一并复核）。
4. 深圳市养老护理院门牌（56 vs 60）与入口信息 UNKNOWN：Golden Origin 现实可用性证据不足。
5. 模拟低空与地面方案的"谁更接近现实"缺直白对比文案（P2-1，随 P1 修复一并处理）。

## P2

1. 引入高德 `entr_location` 作为「到达点」层（MEDIUM 证据），替代 OSM 中心点作为路线端点的展示语义。
2. 引入医院子 POI（门诊/急诊/停车场）作为 Golden Destination 细化选项。
3. 步行方案缺口：两城高德步行数据可用（TJ 23 min / SZ 106 min），SZ 步行对老人不现实这一事实本身有产品价值。
4. 补充天津大学/总医院 HIGH 级入口证据进 Golden 数据（带来源）。

## P3

1. Google Places 交叉验证脚本（境外环境）。
2. 高德 AOI 边界（工单开通）。
3. 公交方案（v3 transit 含地铁出入口）作为远期能力。

## UNKNOWN

- 天津大学四个校门的轮椅通行能力。
- 深圳市养老护理院入口形式、访客停车、网约车接送点（可电话 0755-61165568 核实）。
- 两医院无障碍专用停车位。
- Google Maps 侧 POI/路线实测（网络限制，本轮未执行）。
- 高德 QPS 具体数字（需控制台查看）。
- 含无障碍约束的步行路线（任何数据源均无证据）。

## Recommendations for Codex（≤15 条）

1. 接入高德 Web 服务 `v3/place/text` + `assistant/inputtips` 替换/增强本地语法解析的地点识别层（保留受控别名回退）。
2. 接入 `v3/direction/driving`（或 v5+show_fields）校准 OSRM 快照；预期距离 ±10%、时长显著上升，需同步更新 Golden 预期与 UI 文案。
3. 将 `entr_location`（extensions=all）落为 Segment 端点的「到达点」属性，证据等级标 MEDIUM，文案不得写「入口」。
4. 为总医院/北大深圳医院增加门诊/急诊子 POI 选项（高德实测存在），让 Golden 目的地贴近真实就医动线。
5. 时长一律渲染为「道路模型估算，非预计到达时间」（实测偏乐观 40–45%）。
6. 复核深圳市养老护理院门牌（56 vs 60）并记录官方来源。
7. 无障碍声明仅对已核验 POI（总医院、北大深圳医院）开放，其余 POI 显示「无障碍信息未核实」。
8. 落地本轮 USER_TEST_PROTOCOL.md 与 UX_2D_3D_AB_PROTOCOL.md，安排 60+ 老人/子女真实参与者（G2 缺口）。
9. 修复 UX P0-1：重新规划/切换城市时在地图完成定位前展示「地图正在切换」过渡态，禁止旧城市地图与新方案同屏；同步修复 P1-1 首结果地图定位时序与 P1-2 过去时间提示。
10. 生产化前确定高德认证档位与配额预算（搜索类 5,000 次/月为瓶颈）。
11. JS API 上线前实现 securityJsCode 服务端代理（关联 D-013）。
12. 3D 视图增加常驻「模拟演示，非真实航线」水印级标识（依据本轮 3D 风险清单）。
13. 不要接入任何「上下车点」功能直到有真实数据源（当前 NOT AVAILABLE）。
14. 将本轮 `docs/evidence/reality-first/` 原始 JSON 纳入 Golden 证据链管理。
15. Sprint 4 启动前按本交接 P1 清单做范围裁定。

## Files reviewed

- `docs/PROJECT_STATE.md`、`docs/HANDOFF.md`、`data/public/{tianjin-poi,shenzhen-poi,golden-aliases,ground-routes}.json`、`examples/{tj-001,sz-001}.interpret.json`、`backend/app.py`、`frontend/package.json`、`frontend/vite.config.ts`

## Files modified

- 新增：`docs/research/reality-first/` 8 份研究文档；`docs/evidence/reality-first/` 实测 JSON 与 UX 截图；本交接。
- 业务代码/Schema/数据：**None**。

## Unverified

- Google 侧一切实测；屏幕阅读器操作；真实用户测试（仅协议准备）；高德 QPS；控制台错误归因（Sprint 3.1 遗留，不在本轮范围）。

## Codex handoff

见「Recommendations for Codex」15 条；优先级按 P1 > P2 排列执行。
