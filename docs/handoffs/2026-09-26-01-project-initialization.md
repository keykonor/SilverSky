# 交接：SilverSky AI 项目初始化

日期：2026-09-26。状态：工程规范与契约提案已完成，业务开发尚未开始。本文可复制给其他 Agent 或网页端 GPT。

## 项目约束

产品面向老年人及其子女，首期天津、深圳，约 8 周 MVP。优先级是安全 > 舒适 > 可达性 > 时间 > 成本。地面数据应真实且来源可追溯；MVP 低空数据全部为模拟，不能冒充真实运营。未知航空信息为 `DATA_UNAVAILABLE`。技术方向：React + TypeScript + CesiumJS、Python + FastAPI、Multi-Agent、MCP、JSON / GeoJSON。

## 已完成与文件

根目录 `AGENTS.md` 定义项目规则，`README.md` 提供入口。`docs/PRODUCT_VISION.md`、`docs/MVP_SCOPE.md` 管产品；`docs/ARCHITECTURE.md`、`docs/AGENT_ARCHITECTURE.md` 管技术方案；`docs/DATA_POLICY.md` 管来源和模拟标记；`docs/API_CONTRACTS.md` 与 `schemas/core.v0.1.schema.json` 是待评审契约；`docs/DEVELOPMENT_PLAN.md`、`docs/ROADMAP.md` 管计划；`docs/PROJECT_STATE.md`、`docs/DECISIONS.md`、`docs/INTERFACES.md` 管状态与决策。初始化时六个项目 Skill 位于 `skills/`，后续已迁移至 `.agents/skills/`，当前路径以 `AGENTS.md` 为准。`examples/` 是纯契约样例，`scripts/validate_contract.py` 用于验证。

## 决策、验证和风险

已采纳基线记录于 `docs/DECISIONS.md` 的 D-001、D-002。核心 Schema、接口、8 周路线为提案；没有已确认的 HTTP 端点或 MCP 工具。`python scripts/validate_contract.py` 接受两个有效样例、拒绝七个不安全变体；六个 Skill 通过结构校验，本地 Markdown 链接有效。这些不是业务验收。

真实地面数据来源及使用条件、模拟低空场景依据、接口负责人和 Sprint 日期尚未确定。模拟路线误导用户、老人无障碍信息不足、接口漂移是主要风险。接手者先读 `AGENTS.md` 与 `docs/PROJECT_STATE.md`，再按 `docs/DEVELOPMENT_PLAN.md` 的 Sprint 1 顺序确认场景、数据、契约与安全规则。不得把提案当作已实施功能。
