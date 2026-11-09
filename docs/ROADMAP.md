# SilverSky AI MVP 路线图

状态：Sprint 1 与 Sprint 1.5 已完成技术验收；本地解析对任意自由表达的覆盖仍是风险，LLM 接入待决。**Sprint 2 验收 PASS；Sprint 3 本地 Demo 验收 PASS**。Sprint 3.1 G2 为 PARTIAL；Sprint 3.2 Reality-First 本地实现已形成，分项验收见 `PROJECT_STATE.md`；Sprint 4 尚未启动。Sprint 3 的两城双视角、降级、Product/Safety 复核与已测无障碍门槛通过；原生 Chrome 200% 缩放已在 Sprint 3.1 单独验证，但真实屏幕阅读器、目标用户 A/B、可选 ion 在线图层和公开部署不能沿用 Sprint 3 PASS。详情以 [项目状态](PROJECT_STATE.md)、[Sprint 边界与门槛](SPRINT_BOUNDARIES_AND_GATES.md) 和 [Sprint 3.1 结果](experiments/sprint3.1-3d-ux-validation/RESULTS.md) 为准。用户确认没有实际比赛环节，比赛级仅指演示质量。

| 阶段 | 目标 | 关键依赖 | 退出门槛 |
| --- | --- | --- | --- |
| Sprint 1：首个闭环 | 从自然语言需求到结构化、地点解析、候选、安全审查和解释输出；任务详见 [SPRINT1_PLAN.md](SPRINT1_PLAN.md) | 产品与数据负责人；稳定 Python 环境与核心契约 | 两城 Golden Scenario 可执行；至少两种路线类型；模拟标记及 Safety 降级/拒绝有测试证据；API/契约/pytest 通过 |
| Sprint 1.5：Needs Interpreter | 标准化 mobility、preference、urgency；保留部分意图并逐轮合并；只追问缺失/待澄清项；医疗急症优先急救 | Sprint 1 技术闭环与向后兼容契约；产品负责人指定的六组场景 | 六组场景逐条通过；原 27 项不回归；合同、解释器、规划与安全测试通过；待决 LLM 服务不冒充已实现 |
| Sprint 2：可操作 Web App | 桌面优先的自然语言多轮对话、需求摘要、路线和安全/来源说明、Cesium 基础地图与方案切换；D-011 两城 Golden 受控别名、静态道路几何及模拟线路已实施。数据/工具边界继续作为并行依赖评估 | Sprint 1.5 技术结果、兼容前端契约、两城来源明确的静态数据 | F01–F20 与 G01–G14 技术用例通过；两城 Chrome E2E、无障碍无 P0/P1；独立 Contract/Safety Reviewer 无 P0/P1 且 Product Review 通过后才标阶段完成。缺几何时明确说明 |
| Sprint 3：3D 城市低空综合出行 Demo | 修复 Sprint 2 高优先 P2；两城地面真实城市背景与模拟低空三维航迹形成可辨空间层；可选 Cesium 地形/建筑及断网降级；路线阶段、图例、相机和数据说明服务老人及本地演示。无新规划算法、真实运营或 LLM | Sprint 2 PASS、V-001/V-002 可视化契约、D-014 本地地图、现有两城几何 | 两城完整本地 Demo 与网络失败降级可复现；S3-01–S3-20 及 Sprint 2 回归有实测；Safety/Contract/Accessibility 无 P0/P1，Product Review PASS，性能与截图有证据；否则保持进行中。可选在线 Cesium 图层与公开部署另行核验 |
| Sprint 3.1：真实使用与 3D 有效性验证 | 验证原生缩放、屏幕阅读器、慢设备、长会话、非 Golden 场景、现实语义与同结果 2D/3D 对照；只修复实测暴露问题 | Sprint 3 G1 本地 PASS 与可复现 checkpoint；目标老人/子女样本需另行安排 | 分项报告 Product UX、Reality、3D Utility、Accessibility、Performance、Safety；缺真实用户样本时标 `USER_STUDY_PENDING`、3D Utility `INCONCLUSIVE`，不得写成通过 |
| Sprint 3.2：Reality-First 本地实施 | 消化 WorkBuddy 证据，修复旧城残留、过去时间和模糊地点；两城受控高德在线地面参考与 2D 默认体验；按 D-017 支持天津可识别地点出发、全国目的地显式选点；3D 留作辅助 | D-016/R-001、D-017/R-002、本地 Web 服务凭证、两城 Golden 及失败降级；公开部署仍受 D-013 | 两城在线 POI/驾车/步行、天津非 Golden 与跨城终点、失败不画伪线、地点确认、旧城遮挡与安全不变量有证据；入口/接送/无障碍未知不得升级；独立复审后分项判定，真实用户与所有地点覆盖缺口不能写 PASS |
| Sprint 4：稳定与验收 | 修复阻断问题，核验安全降级、数据说明和 MVP 交付 | 截至 Sprint 3.1 的交付物与未验证清单 | 关键场景与失败场景有验证证据；剩余风险明示；总控 Agent 给出验收结论 |

## 范围控制

本路线图不承诺真实低空航班预订、实际运营调度、监管许可或 PostGIS 迁移。新增能力先经过 `.agents/skills/product-requirements/SKILL.md` 的 MVP 取舍，并在需要时记录重大决策。

## SilverSky V2（REQ-012，2026-10-08已授权）

以六阶段最小流程优先：审查/独立分支/布局 → DeepSeek与高德选点 → 真实道路及模拟空中 → 语音 → Cesium基础城市与航空器 → A/B/C/D端到端及用户验收。保留旧版资产，不继续复杂空域规划。每阶段记录浏览器实际结果，真人语音单列证据；公开部署仍待D-013。阶段最终状态见PROJECT_STATE.md。
