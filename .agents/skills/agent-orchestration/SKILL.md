---
name: agent-orchestration
description: 协调 SilverSky AI 各专业开发对话的任务、依赖、交接、Sprint 和冲突；用于项目管理与集成，不用于设计产品运行时 Multi-Agent 算法。
---

# Agent Orchestration

## 目标

让前端、后端、Agent、MCP 和数据工作以同一目标、接口及验收口径交接。这里的“Agent”指开发协作角色，不是产品运行时的业务 Agent。

## 工作方式

1. 从 `docs/PROJECT_STATE.md` 和 `docs/ROADMAP.md` 识别当前阶段、依赖与 Blocker。任务需注明负责方、输入、交付物、接口依赖和完成定义；未指定负责方时标“待分配”。
2. 并行工作前确认接口责任人及契约状态；未确认的跨模块假设记录在 `docs/INTERFACES.md`，不得各自默认为已定。
3. 收到专业对话交接时核对修改文件、接口影响、MVP 范围、安全/数据影响和验证证据。缺证据则保持“待验收”。
4. 冲突先列出双方假设和受影响任务；接口冲突走 `api-contract`，重大架构冲突走 `docs/DECISIONS.md`，产品范围冲突走 `product-requirements`。
5. 更新 `docs/PROJECT_STATE.md`，保留状态与证据链接。阶段验收只在交付物和门槛均满足后确认。
6. 本轮结束前创建可独立转交的 `docs/handoffs/<日期>-<任务>.md`，更新 `docs/HANDOFF.md` 的最新入口，并在最终回复链接该文件；交接中区分已完成、待评审与待实施。

## 不负责

只在用户授权且任务可独立交接时按需启动开发用 Subagent；不为并行而并行，不替专业负责人编造完成状态，不把运行时 Agent 编排方案写入项目管理规则。
