---
name: silver-sky-ux-reality-validation
description: 在 SilverSky 重要阶段验收、双视角/3D Demo 或老年用户体验评估时，编排真实使用、现实语义、模拟标记、无障碍与故障降级验证；不用于普通代码检查或功能开发。
---

# SilverSky UX / Reality Validation

## 适用边界与输入

用于 Sprint Product Acceptance、Cesium/3D UX、A/B 或产品实验、老年用户体验、真实场景与 Demo 验证、无障碍及现实一致性评估。不用于格式检查、单元测试编写、Backend API 或 Safety 算法开发、单纯 ETL、Git 操作。此 Skill 编排产品体验证据，不批准真实运营或改变 Safety 结论。

先确定 Product Version、User Flow、Screenshots、Route Options、Data Status、Safety Result、Test Scenarios、Product Goal。缺项列为 `NOT_VERIFIED` 并继续可做的审查；不能用截图或自动化替代真实用户行为。以 `docs/PROJECT_STATE.md` 定位版本和验收范围，核对 `docs/INTERFACES.md` 的数据与可视化契约。

## 七层验证

1. **Task Completion**：观察用户是否知道从哪里开始、下一步、如何获取路线、切换方案及重新规划；记录任务成功率、错误和求助，而非只看页面是否可点击。按 [UX 检查表](references/ux-checklist.md) 执行。
2. **Elderly UX**：检查字体、对比度、点击目标、信息密度、导航复杂度、认知负担、动效舒适度与错误恢复；区分设计评审和目标用户实测。使用同一检查表。
3. **Reality Consistency**：逐一核对现实语义与来源。POI 中心点不是入口；静态道路不是实时导航；模拟起降点不是现实设施；视觉高度不是获批飞行高度。按 [现实一致性检查表](references/reality-consistency-checklist.md) 留证。
4. **Simulation Truth**：检验用户会否把模拟航线、起降点或视觉高度当作真实运营信息，或把 `REJECT` 方案当作推荐。发现任何一种实际误导风险至少列 P1；严重安全或隐私后果列 P0。不得因画面精美提高结论。
5. **3D Utility**：不预设 3D 有益。涉及 3D 时使用 [实验模板](references/3d-experiment-template.md)，比较同一 `PlanningResult` 的 2D 与 3D 在理解、耗时、错误、认知负担、模拟误解和晕动舒适度上的结果。无真实对照证据时结论为 `INCONCLUSIVE`。
6. **Accessibility**：查键盘、焦点、真实屏幕阅读器、浏览器原生缩放、对比度及非颜色安全表达。逐项标明证据层级；缺实际证据写 `NOT_VERIFIED`，不得猜测 PASS。参见 [无障碍证据层级](references/accessibility-evidence-levels.md)。布局模拟不等于真实 200% 缩放；axe 不等于屏幕阅读器测试。
7. **Performance / Failure**：核对慢 CPU、断网、地图失败、3D 失败、长时间使用和反复切换。地图失败时，路线文本、数据来源与 Safety 结论仍应可用；失败不得使规划结果或安全判定改变。

## 协作与证据

现有 `safety-data-integrity` 检查模拟/真实与降级边界；`silver-sky-geospatial-review` 检查坐标、几何和地图来源。若 `simulation-truth-boundary`、`silver-sky-experiment-design`、`silver-sky-data-audit` 可用，分别复用其边界、实验结构、来源核查能力；不存在时直接按本 Skill 对应清单执行，不宣称已调用。通用 UX 截图审查或指标设计 Skill 可辅助，但不能代替本 Skill 的最终判定。

每条发现写明用户任务、界面状态或文件、观察事实、证据类型、影响与处理状态。证据类型只用 `AUTOMATED_EVIDENCE`、`REVIEWER_EVIDENCE`、`REAL_USER_EVIDENCE`、`NOT_VERIFIED`；注明日期、设备/环境和样本。审查者判断不能写成用户研究；地图坐标合理不能写成真实设施可用；3D 理解提升假设不能写成实验结论。

严重度：P0 为严重安全、隐私或完全不可使用；P1 为进入下一阶段前必须解决，包含模拟真实性误导；P2 为明显产品问题但不阻塞阶段；P3 为低优先优化。缺证据单列 `Unverified`，不能仅因未知自动判为缺陷已发生。

## 固定报告格式

每次调用输出 `# UX Reality Validation Report`，依次包含 `## Scope`、`## Evidence`、`## User Flow`、`## Elderly UX`、`## Reality Consistency`、`## Simulation Truth`、`## 3D Utility`、`## Accessibility`、`## Performance`、`## P0`、`## P1`、`## P2`、`## P3`、`## Unverified`、`## Recommendation`。末尾明确给出：`### Product UX`（PASS / PARTIAL / FAIL）、`### Reality Consistency`（PASS / PARTIAL / FAIL）、`### 3D Utility`（SUPPORTED / INCONCLUSIVE / NOT_SUPPORTED）、`### Accessibility`（PASS / PARTIAL / FAIL）、`### Safety`（PASS / FAIL）。

这些结论只适用于报告列明的范围。`PARTIAL` 表示有可用证据但关键范围未验证；Safety 只对已检查的展示边界给出 PASS/FAIL，不能代替运行时 Safety Reviewer 或真实出行批准。若证据不足以判断 Safety，标为 `FAIL` 并解释为“本次验收证据不足，不能放行”，不声称发现实际安全故障。
