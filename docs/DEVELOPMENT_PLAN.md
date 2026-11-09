# 8 周开发计划与 Sprint 1 任务

状态：此文件为初始化时的计划草案，表内 Sprint 2/3 描述保留历史口径；实际完成状态和 Sprint 3.1 插入验证阶段以 [PROJECT_STATE.md](PROJECT_STATE.md)、[ROADMAP.md](ROADMAP.md) 与 [Sprint 边界](SPRINT_BOUNDARIES_AND_GATES.md) 为准。约 8 周规划不表示四个 Sprint 均已承诺。

| 阶段 | 主要交付 | 验收焦点 |
| --- | --- | --- |
| Sprint 1 | 场景、数据来源、核心 Schema、接口和最小实施方案 | 两城代表场景与安全边界明确；跨模块可按契约交接 |
| Sprint 2 | 地面数据与模拟低空数据的最小端到端链路 | 来源状态贯通；缺失/失败降级可见 |
| Sprint 3 | 路线卡、风险解释、3D 地图和报告集成 | 老人与子女能够比较、理解并识别模拟方案 |
| Sprint 4 | 两城代表场景验收、缺陷修复、演示准备 | 安全、接口、数据真实性和关键体验证据齐全 |

## Sprint 1：按优先级排列

| 优先级 | 任务 | 负责方 | 完成定义 |
| --- | --- | --- | --- |
| P0 | 确认天津、深圳各一个代表用户场景、输入缺失情形和验收条件 | 产品负责人 + 需求分析 | [MVP_SCOPE.md](MVP_SCOPE.md) 的验收草案经产品确认，未知项单列 |
| P0 | 确认真实地面数据的来源、使用条件、覆盖和更新频率，列出低空模拟依据 | 数据负责人待分配 | [DATA_POLICY.md](DATA_POLICY.md) 中登记可用数据源；缺失数据有明确状态 |
| P0 | 审核 `UserRequest`、`RouteOption` 等核心 Schema 和前端 ↔ 后端 ↔ Agent ↔ MCP 边界 | 前后端/Agent 负责人待分配 | [API_CONTRACTS.md](API_CONTRACTS.md) 提案完成跨模块评审，并更新 [INTERFACES.md](INTERFACES.md) 状态 |
| P1 | 固定 Safety Review 的排除/降级条件与代表性失败场景 | 安全/Agent 负责人待分配 | 明确模拟信息、行动限制和数据缺失情况下的可观察结果 |
| P1 | 细化 Sprint 2 的最小纵向演示路径及验证方法 | 技术负责人 | 任务与依赖可交接，前后端只按已确认 Schema 开始并行实现 |

阶段完成由总控 Agent 对照证据与 [PROJECT_STATE.md](PROJECT_STATE.md) 判定；“任务已提交”不自动表示通过验收。
