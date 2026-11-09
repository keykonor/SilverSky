# SilverSky AI Sprint 3 三维出行 Demo 交接

日期：2026-09-27。唯一状态来源：[PROJECT_STATE.md](../PROJECT_STATE.md)。本文件可交给后续开发 Agent 或网页端 GPT；文件路径均相对 SilverSky 仓库。

## Sprint 3 Status

**PARTIAL / 进行中，未达到 PASS 门槛。** Sprint 2 最终验收仍为 PASS，基线提交 `8ead045` 含 Sprint 2 验收提交 `95daf94`。本轮实现了两城地面与未来低空模拟的空间表达及本地降级。最终本地 18 个前端单测、构建、两城 E2E、五状态无障碍和模拟网络失败测试通过；独立 Contract、Safety、Accessibility 未见 P0/P1。最终 Product Review 为 PARTIAL：七项比赛问题在本地 Demo 六项为“是”，AI Agent 参与感仍为“部分”；真实 ion 城市图层、比赛网络/许可/配额与在线场景性能没有成功加载实测证据，故不宣布 Sprint 3 完成。

## WorkBuddy Inputs

代码修改前盘点 `docs/handoffs/workbuddy/`，Sprint 3 未消化输入只有 [UX 基线审查](workbuddy/2026-09-27-sprint3-ux-baseline-review.md)。对照代码、截图、契约、数据来源和 Sprint 2 已验收状态，结果记录在 [独立复核](2026-09-27-workbuddy-ux-input-review.md)：**ACCEPT 6 项**（POI 原话与 canonical、字号评估、对话首屏、底图影像 backlog、快捷按钮 backlog、符号 backlog）；**PARTIAL 8 项**（WorkBuddy 四项 P1 提级、待确认布局、地图浮层、3D 可读性预测、模拟起降点场所感）；**REJECT 1 项子结论**（安全声明位于路线卡之后，与源码顺序相反）。没有经独立核验直接采纳的 P1；产品负责人正式 Sprint 3 指令另外明确授权四项高优先 P2，已实施。未发现另一份 Sprint 3 3D/许可 WorkBuddy Handoff，故外部资源按官方文档独立核对。

## Implemented

- 方案选中只表示“当前查看”，与 `REJECT` / “当前不建议采用”分开；后端枚举在用户界面转为中文，结构化值不变。需求摘要保留用户原话及解析 POI，并写明公开 POI 中心点不是已核验入口。
- 结果态缩短对话占高，先呈现需求、两张方案卡和安全声明，再展开当前方案；增加地面/低空阶段时间线、数据说明与老人年龄和行动能力摘要。顶栏明确“理解需求 → 形成候选 → 安全审查”，只描述现有处理流程，不声称接入新 LLM。
- 现有 Cesium Viewer 内按经过验证的 `Segment.geometry` 绘地面静态道路、地面示意连接和模拟航段。模拟航段由现有二维坐标派生起降约 0m、巡航 800m 的画面曲线；该值仅是展示参数。增加模拟起降点详情、图例、完整路线相机、短标签及可选建筑开关；关闭滚轮缩放惯性，避免深圳快速点击相机复位后路线再次离开画面。
- 配置有效 `VITE_CESIUM_ION_TOKEN` 时尝试 Cesium World Terrain/OSM Buildings；无 token 或资源请求失败时维持本地基础地球、路线卡和模拟视觉航迹。Token 只允许受限只读的前端公开用途，`.env.example` 不含私密值。
- C-1 使用 TypeScript 类型约束几何三字段同时存在或同时缺失。C-2 在模拟数据读取时校验 A/B 引用与 `simulated_vertiports[]` 的 ID、名称、城市和有效且不同的坐标；损坏数据按原安全边界退回地面。没有修改 `agent/safety_reviewer.py`、HTTP、核心 JSON Schema 或规划算法。

## 3D Architecture

`frontend/src/components/RouteMap.tsx` 在页面生命周期内持有一个 Viewer。路线切换清空和重建实体，不重建 canvas。地面线贴近地表，空中线仅在 `AIR` + `SIMULATED_AIR_CORRIDOR` + `SIMULATED_DATA` 且几何有效时从已有线派生 33 个三维点；空中端点保持原经纬度。相机按路线点拟合，尊重 reduced motion（动画时长 0），常规过渡 0.65 秒，并关闭会覆盖按钮复位的滚轮缩放惯性。天津有移开/复位对照；深圳快速滚轮后立即复位连续两次重拍均显示完整路线。没有真实航高、飞行包线或航空动力学计算。

## Data Sources

Golden 场景仍用登记的天津/深圳 OSM POI 中心点、带时间与来源的 OSRM 静态道路模型快照及人工构造起降点；具体见 [DATA_SOURCES.md](../DATA_SOURCES.md)。本地底图为 Cesium 包内 NaturalEarthII 概览。可选在线背景为 Cesium ion World Terrain 与 OSM Buildings；它们只提供城市空间背景，不能证明道路可达、出入口、空域、航班或可飞高度。

高德 JS API 2.0 官方资料描述 3D 视图与楼块图层，但本轮没有真实 Key、授权或高德地图成功加载；它**不是**现有地图数据来源。高德使用 GCJ-02，现有路线为 WGS84，若用作主地图须另做官方坐标转换。见 [来源登记](../DATA_SOURCES.md) 和 [D-013 待决](../DECISIONS.md)。用户明确要求改进主地图，不增加单独预览或 Key 输入功能。

## Licenses / Attribution

已核对 Cesium 官方 [World Terrain](https://cesium.com/platform/cesium-ion/content/cesium-world-terrain/)、[OSM Buildings](https://cesium.com/platform/cesium-ion/content/cesium-osm-buildings/)、[使用与署名指南](https://cesium.com/learn/ion/content-usage-and-attribution-guide/)、[Token 指南](https://cesium.com/learn/ion/cesium-ion-access-tokens/)及[第三方条款](https://cesium.com/legal/third-party-terms/)。界面保留 Cesium 地图底部署名与 `© OpenStreetMap contributors`。具体比赛账户方案、使用许可、请求限额与现场显示效果**待验证**；不能把官方公开介绍等同于本账户获准和现场可用。

## Network Dependencies

规划 API、两城本地数据和基础路线不依赖 Cesium ion。增强地形/建筑依赖有效账户、受限只读 token、网络、配额和流式资源。代码没有把私人 token 写入仓库；前端构建变量会进入公开浏览器包，不得存放有私有权限的密钥。现场中国网络连通性和资源加载性能待实测。

若以后采用高德作为主地图，较新 Web 端 Key 需要配套安全密钥；官方建议正式部署用服务端代理保护安全密钥。当前没有高德凭据输入、代理或运行时请求，网络和配额均未验证。

## Fallback

无 token 使用本地基础 Cesium 地球。测试以无效 token 并阻断 Cesium 网络请求模拟资源失败，页面仍能完成对话、规划、路线切换和本地三维模拟线，并显示降级文字；证据见 [网络失败截图](../evidence/sprint3/3d-network-failure-fallback.png)。地图初始化失败时路线文字仍可阅读。真实在线资源成功后中途断网、配额耗尽和长时间恢复尚未逐一验证。

## Visualization Contract

[V-001](../INTERFACES.md) 已先于三维实现登记：沿用 `0.1-proposal` 和可选的 Segment 几何三字段，无新 API 字段。视觉高度只在前端内存派生，不写回结果、不输入 Safety；旧响应缺几何时显示不可绘制说明。几何与路线距离/时长的证据分开。可选建筑和地形失败不改变 Safety 判定。C-1/C-2 是已实施的内部约束，外部 HTTP 兼容。

## Performance

最终本地无在线建筑的 Chrome 测量：20 次 A/B 路线切换，中位数 79ms，P95 277ms，最大 283ms；canvas 对象保持同一个，页面脚本错误为 0。测得 JS heap 39.5→54.8 MB，未强制 GC，不能据此判断泄漏。首屏加载、真实 3D Tiles/地形、地图漫游、长时间运行和较低规格设备未完整测量，性能验收仅为 **PARTIAL**。

## Safety Review

独立最终只读抽查结果 **PASS（所审本地实现，无 P0/P1）**：模拟低空仍 `REJECT`，地面仍按原 Safety 结果 `DOWNGRADE`；选中态没有推荐意味；模拟线路、视觉高度及模拟起降点均有显著说明。审查指出在线图层对象创建后即称“已加载/已显示”过早，已改为“已启用，图块按视角加载”，不宣称实际瓦片渲染成功。`agent/safety_reviewer.py` 保持只读。真实运营与可用性数据依旧缺失，不能让三维画面暗示当前可乘坐。

## Accessibility Review

独立最终只读复核无 P0/P1；最终浏览器 axe 在首屏、地面、模拟方案/详情、760px 和急症状态无 serious/critical，760px 的浮层边界断言通过。键盘可打开起降点详情，reduced motion 相机时长为 0，无横向溢出。独立复核指出桌面起点文字曾被详情浮层部分遮住；随后浮层缩至 240px，新 [天津起降点详情截图](../evidence/sprint3/tianjin-vertiport-detail.png) 可见完整起点标签。真实屏幕阅读器、200% 缩放、在线建筑覆盖下的标签仍待验证。

## Product Review

独立最终评审 **PARTIAL**：七项比赛问题中，本地用途、老人需求核心、Ground + Air、模拟边界、3D 帮助理解、相较 Sprint 2 的产品提升均为“是”；AI Agent 参与感为“部分”，三阶段流程说明可见，但不能声称接入 LLM。初评老人需求可见性 P1 已由最终天津“78 岁·行动能力受限”、深圳“72 岁·待确认”截图关闭。评审发现深圳首次镜头复位截图为空白；快速滚轮惯性已关闭，连续两次重拍的深圳完整路线恢复可见，天津也有移开/复位对照。3D 正面结论仅限本地模拟线；在线城市地形/建筑和完整比赛环境无证据，因此正式 Product PASS 待在线场景复核。

## Tests

- Python 全量：**84 passed**，1 个既有 Starlette/httpx 弃用警告。`scripts/validate_contract.py`：2 个样例、4 个解释、1 个时间窗口、9 个不安全路线变体、5 个数据集、1 个不安全数据集变体通过。
- 最终前端 **18 个单元测试通过**、生产构建、`npm run typecheck`、两城 E2E 和五状态 axe/760px 检查通过。模拟航迹单测检查 0→800→0m、端点不变及重合点拒绘；C-2 破损数据测试覆盖 A/B 一致性。沙箱内一次 Vitest 启动曾因目录访问被拒绝失败；按自动审批流程重试后最终代码的 Vitest 通过。
- 最终模拟网络失败降级脚本通过；本地 20 次路线切换性能脚本通过。最终截图脚本运行并在深圳镜头修正后再次运行；两次快速复位均拍到完整深圳线路。自动审批服务曾因用量上限拒绝截图操作；提示时间过后按原审批流程获准重试，没有绕过审批。
- 误建的高德连接页曾使用虚构凭据通过局部测试；用户澄清后页面、对应测试和截图均已删除。该历史测试不计入现行产品验收，也没有真实高德连接证据。
- S3-01、03–18、20 有最终代码、本地测试或截图支撑；S3-02/19 的网络失败是模拟阻断，未覆盖真实成功加载后故障。S3-17 没有真实屏幕阅读器/200% 缩放验证，S3-20 的已测 Sprint 2 浏览器/Python 回归通过，不能代表所有未知环境。在线地形/建筑成功路径和完整比赛环境未测，不能把 S3-01–20 整体标 PASS。

## Screenshots

本地 13 张 Sprint 3 截图位于 [docs/evidence/sprint3/](../evidence/sprint3/)：天津地面、镜头移开、复位完整路线、模拟低空、低空完整路线、起降点详情、安全拒绝；深圳地面、模拟低空、复位完整路线；数据说明、本地图例、网络失败降级。它们展示本地基础地球和模拟三维线，**不是**真实在线建筑/地形验收图。

## P0/P1/P2

最终独立 Contract、Safety、Accessibility 检查未发现 P0/P1；Product 初评的老人需求核心可见性 P1 经最终视觉复核关闭。深圳快速滚轮后相机复位空白的 P1 风险已通过关闭滚轮惯性及连续两次重拍消除，本地未发现剩余 P0/P1。P2 待核：外部 3D 性能/场景与许可实测、真实屏幕阅读器、200% 缩放、AI Agent 参与感产品叙事。WorkBuddy P3 保持 backlog，不因本轮顺手扩大范围。

## Known Issues

1. `frontend/src/components/RouteMap.tsx` / `docs/DATA_SOURCES.md`：Cesium ion 增强路径只有官方资料核对和失败模拟；有效账户、比赛用途许可、天津/深圳网络/配额、在线建筑及署名布局未实测。影响真实 3D 背景的验收；状态 **待验证**。
2. `frontend/src/App.tsx`、`frontend/src/components/RouteMap.tsx`：本地视觉与交互已完成复测，Product 七问中 AI Agent 参与感仍为“部分”；现有确定性解释器不得用文案包装为新 LLM。影响比赛叙事；状态 **P2，待产品优化**。
3. `frontend/src/components/RouteMap.css`：旧截图曾有详情浮层遮挡起点、760px 浮层重叠；最终 CSS、760px 自动检查和天津新截图已修正。真实屏幕阅读器与 200% 缩放未测；状态 **剩余验证 P2**。
4. `agent/data_access.py`：A/B 一致性校验可发现缺失、错配、无效或相同坐标；若有人同时改动两处 ID/名称/有效坐标使其一致，没有独立地理锚点可判定真实语义。模拟数据不会转成真实数据，但场景位置可能错误；状态 **已知边界 P2**。
5. `frontend/tests/scene-performance.mjs`：仅本地快速切换且未控 GC，无法推断长期 WebGL/内存稳定性；状态 **待测 P2**。

## Sprint 4 Inputs

先完成 Sprint 3 的实测/复核与验收，再把剩余非阻断体验和长时间性能纳入 Sprint 4。真实出行推荐所需的出入口、无障碍、接驳、天气、车辆和运营证据继续独立补齐；D-008 外部 LLM 与隐私边界仍为待决。不得由三维演示反推出任何真实运营承诺。

用户表示可提供高德地图 API 资料，随后明确澄清：需要项目主地图使用尽可能真实的城市模型，**不需要软件内 Key 输入或独立预览**。误建的页面、测试、截图及构建副本已删除；官方 3D/楼块、安全密钥、坐标和平台协议资料仅用于 D-013 **待决**评估。截至本交接未收到用户指定产品链接、真实账户授权或成功加载证据。后续若选择高德，先核对许可、署名、网络、接口与回退，再决定主地图实现；不要要求用户在聊天中发送 Key。

## Git Commit

本轮未创建 Sprint 3 提交，当前基线 HEAD 为 `8ead045`；Sprint 3 尚未 PASS，且开工前工作区已有其他未提交的 `AGENTS.md`、`docs/HANDOFF.md`、`docs/PROJECT_STATE.md` 和两份交接资料。后续在复测与审查完成后核对文件归属，再建议提交 `feat: add SilverSky 3D low-altitude route experience` 并记录 hash。没有把既有未提交变动冒认为本轮提交。

## 项目资料审计与接手约束

**已检查范围与方法：**在本轮纠偏交接新建前，通过 `git ls-files` 和非忽略未跟踪清单盘点全仓 **100 个已跟踪 + 21 个未跟踪 = 121 个文件**，覆盖项目文档、6 个 Skills、源码、配置、2 个 Schema、数据/5 个 CSV、样例、测试、交接和 18 张 PNG 证据。对所有文件做存在性/扩展名盘点；解析 14 个 JSON、5 个 CSV、17 个 Python 文件语法，检查 18 个 PNG 文件头，检查 45 个 Markdown 中 **134 个本地相对链接（0 个缺失）**。本轮重点阅读了改动的接口、来源、安全、状态文档及前后端相关代码、测试和评审记录；`git diff --check` 通过（仅有 Git 换行提示）。这属于全仓盘点及格式检查、风险相关抽样语义审阅，**不是逐文件完整审阅**。

**验证结果与未覆盖范围：**Python 全量 84 passed、契约校验通过、最终 TypeScript 类型检查、18 个前端单测、构建、两城 E2E、五状态 axe、网络失败降级、本地性能与两城截图通过。初次 Vitest 的沙箱目录访问失败和截图的自动审批用量限制均在后续按原审批流程重试成功，最终结论以成功执行的结果为准。在线资源、真实屏幕阅读器、200% 缩放、在线 3D 性能及比赛网络无法在本轮验证；不把这些范围归为通过。

### 发现的问题

1. `frontend/src/components/RouteMap.tsx`、`docs/DATA_SOURCES.md`：增强 3D 仅有官方资料和失败路径证据，无有效账户成功加载、许可/配额/网络实测；影响 Sprint 3 全 3D 验收，**待验证**。
2. `frontend/src/App.tsx`：最终老人需求可见性 P1 已经产品视觉复核关闭，但“AI Agent 参与”的解释仍部分依赖静态流程文案；影响比赛叙事，**P2 待优化**。
3. `frontend/src/components/RouteMap.css`：初评的浮层遮挡已有 CSS、760px 自动检查和最终截图修正；真实屏幕阅读器、200% 缩放仍未覆盖，**P2 待验证**。
4. `agent/data_access.py`：一致性校验没有独立地理真值锚点；两处同时被同样误改时仍可能接受虚构场景错误位置；影响模拟路线可信度，**已知边界 P2**。
5. `data/product-assets/*.csv` 和 `data/product-assets/DATA_DICTIONARY.md`：这是产品研究资产，不应混作运行时真实起降点/航空运营数据；本轮仅做 CSV 格式检查，未逐条核验资产来源或是否适于运行时，**沿用既有待核风险**。
6. `.agents/skills/*/SKILL.md`：6 份文件存在且列入盘点，来源沿革没有在本轮独立核实；影响治理溯源，**沿用既有资料审计待核项**。

**接手约束：**以 `PROJECT_STATE.md` 判状态；本地最终浏览器检查和 Product Review 已完成，Product 仍为 PARTIAL。下一步用合法有效的只读 ion token/比赛环境实测在线层；若改用高德主地图，先完成 D-013 的许可、坐标和接口决策。不得添加软件内 Key 输入功能；不要覆盖 WorkBuddy 原始 Handoff 或把截图中的模拟设施当成真实设施。
