# Sprint 3.1：真实使用与 3D 效用验证

目标：回答首次使用、现实语义、3D 理解收益及老年用户负担四个问题。Sprint 3 本地 Demo PASS 是起点，不自动成为 Sprint 3.1 PASS。核心 HTTP 仍为 `0.1-proposal`，低空数据仍为模拟；不提供真实出行安全推荐。

| 文件 | 用途 |
| --- | --- |
| [EXPERIMENT_PROTOCOL.md](EXPERIMENT_PROTOCOL.md) | 同一 PlanningResult 的 2D/3D 对照流程、招募与决策规则 |
| [TEST_SCENARIOS.md](TEST_SCENARIOS.md) | R1–R10 非 Golden/失败场景与实际状态登记 |
| [METRICS.md](METRICS.md) | 八项用户指标、任务评分和安全护栏 |
| [RESULT_TEMPLATE.md](RESULT_TEMPLATE.md) | 逐位参与者的匿名记录表 |
| [RESULTS.md](RESULTS.md)、[FINDINGS.md](FINDINGS.md) | 已执行本地验证与待决结论；USER_STUDY_PENDING 不填虚构指标 |
| `NATIVE_ZOOM_RESULTS.json`、`ZOOM_200_LAYOUT.json`、`CPU_RESULTS.json`、`VIEW_INVARIANTS.json`、`SCENARIO_RESULTS.json`、`SCENARIO_BROWSER_RESULTS.json`、`WEBGL_UNAVAILABLE.json`、`DUAL_MAP_FAILURE.json` | 各项本地自动化的原始记录；按结果字段判断，不凭文件存在宣称 PASS |
| `SOAK_RESULTS.json` | 仅在最终完整 30 分钟、30 轮结束后作为长期稳定性证据 |

证据类型严格分为 `AUTOMATED_EVIDENCE`、`REVIEWER_EVIDENCE`、`REAL_USER_EVIDENCE`、`NOT_VERIFIED`。当前没有招募或测试的真实老人/子女样本时，写 `USER_STUDY_PENDING`，3D Utility 为 `INCONCLUSIVE`。

使用 [Sprint 边界与分级门槛](../../SPRINT_BOUNDARIES_AND_GATES.md) 判断范围。公开部署、真实航线、真实起降点、可用车辆、精确入口、实时天气和安全推荐不在本实验结论中。
