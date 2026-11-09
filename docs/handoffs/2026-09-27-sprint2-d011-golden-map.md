# Sprint 2 D-011 Golden 地点与地图闭环交接

日期：2026-09-27。当前状态以 [PROJECT_STATE.md](../PROJECT_STATE.md) 为准。阶段产品验收：**PARTIAL**。

## 本轮目标与结果

按产品负责人 D-011 裁决完成天津、深圳 Golden 场景的受控地点简称、可追溯 POI、静态道路几何、模拟起降点与未来低空线，并在 Web App 中将三轮需求解释、规划候选、安全结论和地图连通。没有扩展城市 GIS、真实低空运营、第三路线或安全推荐条件。

- 天津三轮原文：“我父亲明天下午要去天津医大总医院。”→“天津大学。”→“78岁，腿脚不方便，希望安全舒服一点。”最终进入规划，返回纯地面与模拟低空两条候选；地面 `DOWNGRADE`、低空 `REJECT`。
- 深圳 Golden 规划返回相同两类候选和安全结论。路线卡、方案切换、地点标记、地面几何、模拟起降点及模拟低空几何均在 Chrome 中验证。
- `天津大学`、`天大` 仅在天津 Golden 城市/场景上下文解析为天津大学卫津路校区 POI；`天津医大总医院` 与深圳所需简称按登记表解析。无上下文简称与“家里”不自动映射。用户原始标签在 `UserRequest` 保留，规划路段端点使用 canonical 名称。

## 数据与真实性

| 数据 | 状态 | 边界 |
| --- | --- | --- |
| 四个 POI 中心点与受控别名 | `PUBLIC_DATA` | OSM 对象中心点；机构公开页面核对名称/地址。`entity_precision:POI`、`entrance_verified:false`，不代表校门、上车点或无障碍通道 |
| 天津 50 点、深圳 148 点 OSRM 静态 GeoJSON | `PUBLIC_ROUTE_SNAPSHOT` + `PUBLIC_DATA` 几何证据 | 2026-09-27T05:55:00Z 从原登记 URL 获取；距离/时长与原快照一致。非实时、非门到门导航 |
| 天津/深圳各两个虚构起降点及地面接驳直线 | `SIMULATED_DATA`；接驳线 `STRAIGHT_REFERENCE_LINE` | 人工构造坐标，只为情景绘图；地面接驳距离、时间与可达性仍 `DATA_UNAVAILABLE` |
| 未来低空直线 | `SIMULATED_AIR_CORRIDOR` + `SIMULATED_DATA` | 不代表当前航线、可用航班、空域、运营或飞行高度 |

来源和使用条件详见 [DATA_SOURCES.md](../DATA_SOURCES.md) 与 [DATA_POLICY.md](../DATA_POLICY.md)。地图标示“地面线路为示意连接”和“未来低空模拟航线”；公开道路几何以实线显示，示意/模拟线为虚线。两种方案只要绘制公开 POI，均显示 OpenStreetMap 署名与许可链接。

## 修改文件与契约

- 数据：`data/public/golden-aliases.json`、`data/public/tianjin-poi.json`、`data/public/shenzhen-poi.json`、`data/public/ground-routes.json`、`data/simulated/air-scenarios.json`。
- 运行时：`agent/data_access.py`、`agent/candidate_planner.py`；`agent/safety_reviewer.py` 未改。
- 契约：`schemas/core.v0.1.schema.json`、`schemas/datasets.v0.1.schema.json`；`LocationRef` 增可选 canonical/精度字段，`Segment` 增可选 GeoJSON `geometry`、`geometry_status`、独立 `geometry_evidence`，旧响应仍可无几何。`docs/INTERFACES.md`、`docs/API_CONTRACTS.md` 已登记；接口校验确保 AIR 只能使用模拟空中几何，地面参考线不能冒充公开路线。
- 页面与浏览器验证：`frontend/src/components/RouteMap.tsx`、`RouteMap.css`、`frontend/src/types/contracts.ts`、`frontend/tests/e2e.mjs`。Cesium 只按 `Segment.geometry` 绘线；缺几何时保留卡片并说明不可绘制。
- 测试与状态：`tests/integration/test_d011_golden_geometry.py`、`tests/agent/test_sprint1_runtime.py`、`docs/PROJECT_STATE.md`、`docs/DECISIONS.md`、`docs/ROADMAP.md`、`docs/DATA_POLICY.md`、`docs/DATA_SOURCES.md`、本交接及 `docs/HANDOFF.md`。

## 验证与截图

- 后端：**77 passed**；合同脚本通过 2 个结果样例、4 个解释用例、1 个时间窗口、9 个不安全路线变体、5 个数据集、1 个不安全数据集变体。唯一警告为已有 TestClient/httpx 弃用提示。
- 前端：13 passed、TypeScript/Vite 生产构建通过。
- Chrome E2E：两城规划、天津三轮、方案切换、无几何降级、急症阻断、键盘输入通过。G01–G10/G14 后端测试，G11–G13 浏览器断言与页面复核通过。axe 在首屏、结果、急症三状态无 serious/critical 问题。
- 截图：[天津对话与需求](../evidence/sprint2-d011/tianjin-conversation.png)、[天津地面地图](../evidence/sprint2-d011/tianjin-ground-map.png)、[天津模拟低空地图](../evidence/sprint2-d011/tianjin-air-map.png)、[深圳对话与需求](../evidence/sprint2-d011/shenzhen-conversation.png)、[深圳模拟低空地图](../evidence/sprint2-d011/shenzhen-air-map.png)。对话、需求、卡片与地图分屏滚动，需结合截图阅读。

## 审查、未完成与接手约束

本轮自查：没有修改 Safety 代码；两城纯地面仍 `DOWNGRADE`，模拟低空仍 `REJECT`；没有把模拟坐标标为公开数据；缺几何不自动连线。Chrome axe 未发现严重/关键无障碍违规。**独立 Contract Reviewer、Safety Reviewer 和 Product Review 尚无正式结论**，因此不能写 Sprint 2 PASS。

Blocker：产品负责人需检查两城实际页面、截图和文案并给出 Product Review；独立契约/安全复审需确认无 P0/P1。真实推荐还缺出入口、无障碍、接驳、实时天气、车辆和低空运营证据。地图使用本地低分辨率概览，近景道路不显示底图细节；线路自身可见，适老化地图可读性可在产品评审中继续检查。Golden 日期来源独立复制时仍可能丢失。

接手方须以 [PROJECT_STATE.md](../PROJECT_STATE.md) 为唯一状态源；不要把技术验证写成产品完成，不要改变安全优先级或把情景低空称为可乘坐。若要新增 POI、外部地图/实时服务、真实入口或改变跨模块契约，先按 [DECISIONS.md](../DECISIONS.md) 与 [INTERFACES.md](../INTERFACES.md) 记录决策与来源。下一步完成产品/独立审查，再逐项对照 [ROADMAP.md](../ROADMAP.md) 的 Sprint 2 退出门槛。
