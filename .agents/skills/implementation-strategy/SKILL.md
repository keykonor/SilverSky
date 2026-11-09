---
name: implementation-strategy
description: 为 SilverSky AI 的已确定需求制定实施方案、技术取舍和阶段拆解；当任务要求方案、架构评估或实现顺序时使用，不用于重新定义产品需求或直接批准重大变更。
---

# Implementation Strategy

## 目标

把已确认的产品目标转成可交接、可验证的技术方案，并保持 MVP 技术方向和约 2 个月周期一致。

## 工作方式

1. 从 `docs/PROJECT_STATE.md`、`docs/ROADMAP.md`、`docs/DECISIONS.md` 确认现有约束；需求不清时先用 `product-requirements` 澄清范围。
2. 写清候选方案、受影响模块、依赖顺序、接口与数据需求、可交付物、验收证据、主要风险。优先选能在 MVP 内验证核心用户价值的方案。
3. 涉及接口时交给 `api-contract` 细化契约；涉及安全或数据真实性时使用 `safety-data-integrity` 确定约束。
4. 如果方案改变 AGENTS.md 所列重大架构边界，先提交影响分析到 `docs/DECISIONS.md` 的待决项；明确决策前不实施。

## 不负责

不自行扩大 MVP 功能、不替代接口字段定义、不把技术可行性当作产品验收，也不以计划完成代替代码验证。
