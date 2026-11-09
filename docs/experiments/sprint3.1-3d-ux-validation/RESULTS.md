# Sprint 3.1 已执行验证结果

证据日期：2026-09-29。本页仅汇总已实际执行的本地自动化与只读评审；真实老人/子女参与者为 `USER_STUDY_PENDING`。用户理解、晕动和 3D 收益的量表均为 `NOT_VERIFIED`。

| 检查 | 结果 | 证据与限制 |
| --- | --- | --- |
| UX-01 原生缩放 | Chrome 设置 100/125/150/200% 均完成天津输入、方案 B、地图切换、镜头、图例、时间线与重置；200% 为 720 CSS px、DPR 2，整页无水平溢出，地图与 `REJECT` 提示同屏；九个关键面板无横向裁切，四个关键按钮可聚焦且落在视口，地图两块浮层无重叠 | `NATIVE_ZOOM_RESULTS.json`、`ZOOM_200_LAYOUT.json`、`../../evidence/sprint3.1/native-zoom-*.png`；抽查面板/焦点，未代替完整键盘顺序或老人实际操作 |
| UX-02 屏幕阅读器 | `NOT_VERIFIED` | 本机有 Windows Narrator 程序，未完成七项实际朗读/操作记录；NVDA 未发现。文字时间线是可用的替代内容，不能据此声称屏幕阅读器 PASS |
| UX-03 低速 CPU | Chrome DevTools 4× 天津、6× 深圳均能输入、规划、换方案、移动镜头与切回城市视角，页面异常 0 | `CPU_RESULTS.json`；最终修复后复测。时间是本机 headless 参考，不代表低端实机或统一性能阈值 |
| UX-04 30 分钟 soak | 最终修复版本完成 **30.00 分钟、30/30 轮**，天津/深圳交替，地面/空中、城市/立体、镜头/重置均执行；30 次均为 2 卡、1 个 Viewer、操作 issue 0，页面脚本错误 0、WebGL context loss 0；JS heap 首尾约 82.2→90.4 MB，峰值约 122.5 MB。控制台错误 **1 条，原文未采集**，故不记无错误 PASS | `SOAK_RESULTS.json`；先前中止的 19 轮与 11 轮均不算结果；单条 console 错误需补采来源，heap 快照未经 GC 不能单独证明无泄漏 |
| UX-05/06/07/08 同结果与安全不变量 | 一个天津 `PlanningResult` 指纹 `e44d11e2…`，8 次视图切换，规划调用 1 次，方案详情稳定，模拟高度不在结果中，空中仍 `REJECT` | `VIEW_INVARIANTS.json`；证明技术不变量，未证明 3D 提升理解 |
| UX-09 无障碍未知 | R4 轮椅两种方案均 `REJECT`，页面写明无障碍证据缺失 | `SCENARIO_RESULTS.json`、`SCENARIO_BROWSER_RESULTS.json`；未核验真实无障碍设施 |
| UX-10 失败降级 | R9 高德不可用与 R10 可选 Cesium 服务不可用均保留核心规划；禁用 WebGL 后无英文 Cesium 错误弹层、保留文字/安全结果；高德与 WebGL 同时失败时显示“双地图不可用”且保留 2 卡和 `REJECT` | `frontend/tests/scene-fallback.mjs` 本轮重新执行 PASS、`WEBGL_UNAVAILABLE.json`、`DUAL_MAP_FAILURE.json`、`../../evidence/sprint3.1/scene-fallback-2026-09-29.png`；不代表所有设备/网络故障 |
| R1–R8 | 合成需求解释与浏览器页面检查完成；R7 追问仍未同时要求具体医院 | `SCENARIO_RESULTS.json`、`SCENARIO_BROWSER_RESULTS.json`；不是人工观察样本 |

## UX-3D-01 用户实验

Phase A 的 Product Reviewer 只读复审已完成，属于 `REVIEWER_EVIDENCE`；内部非开发人员未提供可记录的任务数据。Phase B 真实老人/子女测试未开始。六题用时、正确率、Ground–Air 转换正确率、模拟误认率、Confidence、Ease、Visual Overload、3D Value、Motion Comfort 均为 `NOT_VERIFIED`，分母 0。结论：**3D Utility = INCONCLUSIVE**。保持已有视图选择能力；默认视图是否调整要等配对实验。

## 复审来源

Product、Accessibility、Safety 与 Reality Consistency 分别由独立只读 reviewer 检查。Product/Accessibility 在修复前指出两个 P1：200% 地图区缺少同屏 `REJECT`、WebGL 错误覆盖；本轮已做局部修复并重新跑相应测试。Reviewer 意见与自动化修复验证不能替代用户测试。Reality 的水体/用地、真实地形裁切与设施可建设性未实测。

Sprint 3 回归本轮实际重跑：后端 **84 passed、1 条既有 Starlette/httpx 弃用警告**；契约检查通过 2 样例、4 解释用例、1 时间窗口、9 不安全路线变体、5 数据集与 1 不安全数据集变体；5 个规划 JSON 数据指纹通过。前端 18 个单元测试、生产构建、两城主流程 E2E、六状态 axe 均通过；双地图失败文案补丁之后又通过生产构建、专门的双故障浏览器测试与高德两城地图/福建边界/署名/服务探针。完整旧版 20 次性能脚本未重复，30 分钟长测覆盖更长的路线/视图交互，但其最终结论需以该脚本结果为准。
