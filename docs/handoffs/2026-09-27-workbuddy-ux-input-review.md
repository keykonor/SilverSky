# WorkBuddy Sprint 3 UX 输入复核交接

日期：2026-09-27。状态以 [PROJECT_STATE.md](../PROJECT_STATE.md) 为准。Codex 是最终技术集成负责人；WorkBuddy 仅提供辅助只读 Review。本轮未修改代码、Schema、数据、Safety、Contract 或 Sprint Scope。

## 本轮目标与范围

以上次 Codex 最终验收提交 `95daf94` 为界，检查 `docs/handoffs/workbuddy/` 此后新增的全部 Handoff，逐项核验 Task、Scope、Evidence，并按 ACCEPT / PARTIAL / REJECT 作集成判断。目录中仅有一份新增文件，提交 `8ead045`。Sprint 2 已 PASS，Sprint 3 尚未启动；没有可直接纳入的当前进行中 Sprint 工作。

## WorkBuddy inputs

已读取：[Sprint 3 前置 UX 基线审查](workbuddy/2026-09-27-sprint3-ux-baseline-review.md)。其 Task 是为 Sprint 3 提供 UX 优先级；Scope 为提交 `95daf94` 的前后端文案/界面源码与五张最终截图，只读；Evidence 为源码位置、截图及 Sprint 2 最终验收交接。核对 `git show 8ead045`，该提交只新增此 Handoff，未改代码或数据。以下分类针对每条建议，不把 WorkBuddy 的优先级或结论直接视为项目决定。

| 输入 | 结论 | 独立核验、原因和处置 |
| --- | --- | --- |
| P1-1 REJECT 绿色选中态与勾 | **PARTIAL** | `App.css` 的 `.route-card.selected` 用绿色边框，最终天津/深圳模拟地图截图可见 REJECT 卡带 ✓，问题成立；同卡也有红色“当前不建议采用”和不可乘坐横幅。独立 Safety/Product 验收原定 P2，WorkBuddy 未给出新用户实测以支持升级 P1。保留为 Sprint 3 优先比较的安全表达 P2；选中仅表示“查看”的方向可接受，但不改 Safety 结论。 |
| P1-2 英文枚举透传 | **PARTIAL** | `safety_reviewer.py` 对模拟低空候选的缺失和模拟路段会追加英文枚举 reasons；`candidate_planner.py` 的 warnings、`solution_synthesizer.py` 的 explanation/warnings 也含相同枚举。`App.tsx` 原样渲染这些字符串，`presentation.ts` 仅翻译结构化状态；默认模拟候选的非折叠原因列表即存在暴露路径。截图截取范围未覆盖完整列表，也没有新的用户理解测试支持 P1 定级。列为高优先 P2；改文案须保留模拟、不可乘坐和缺数据语义，结构化枚举不变。 |
| P1-3 结果首屏与安全结论 | **PARTIAL** | `App.tsx` 顺序为对话→需求摘要→结果；截图显示侧栏需滚动，首屏难见结果的担忧成立。截图是滚动后的静态状态，不能证明“30 秒内无法理解”；且 `reference-notice` 在方案卡之前，故“先看到方案卡再看到免责声明”这一子结论 **REJECT**。列为结果可达性 P2，后续需按真实视口和键盘/屏幕阅读器验证；不能未经审查折叠关键警示。 |
| P1-4 地图标签重叠和夹具名 | **PARTIAL** | 五张截图中天津、深圳模拟路线的标签确实重叠；`RouteMap.tsx` 用完整 `角色 · location.label` 与固定 `pixelOffset`，数据名含 `Golden Demo`。视觉问题明确，但路线卡及文字说明仍可读，现有 Product 验收为 P2；无新证据支持 P1。列为地图可读性高优先 P2。可缩短用户显示名，但必须保留“模拟”，不可把虚构起降点包装成真实设施。 |
| P2-1 原话与 canonical POI 关系 | **ACCEPT** | 摘要只显示 `stateForDisplay.*.label`，地图使用 canonical 名；前端类型已有 `canonical_poi_id` 等字段。列为 Sprint 3 高优先 P2 候选，显示“POI 中心点、非入口”并验证实际数据可用性；不改变别名契约。 |
| P2-2 小字号与缺字号策略 | **ACCEPT** | CSS 含 13–17px 多档，部分限制说明为 14/15px。列为适老可读性 P2 候选；“大字模式”是额外功能，需产品范围确认，不自动纳入。 |
| P2-3 大量“待确认”指标 | **PARTIAL** | 模拟方案截图可见多个待确认，事实成立；合并或隐藏可能弱化缺失证据。保留为 P2 文案布局候选，前提是缺失状态仍逐项可发现。 |
| P2-4 地图浮层文字过载 | **PARTIAL** | 截图可见右下说明面板占用地图面积。折叠版权、模拟和数据边界的建议未经许可/安全可见性审查；仅接受布局评估，不批准移走强制说明。 |
| P2-5 对话历史占据首屏 | **ACCEPT** | `conversation` 最大高 350px，结果态没有收起逻辑，截图可见需求摘要和对话占主栏。与结果首屏 P2 合并评估；保留完整历史入口、焦点和可访问性。 |
| P2-6 3D 扩大前置条件 | **PARTIAL** | 标签重叠已有证据，但 3D 扩大、晕动和相机负担是预测，尚无实际使用测试；只有 Sprint 3 确认扩大地图时才作为条件评估，不提前承诺 3D。 |
| P3-1 底图影像 | **ACCEPT** | 纯色底图在截图可见；按 P3 入 backlog。外部影像涉及来源、许可、数据真实性和可能的新服务，须另作决策，不能直接实施。 |
| P3-2 Demo 快捷按钮 | **ACCEPT** | CSS 的按钮最小高 42px；与主任务竞争注意力是 UX 判断，列 P3 backlog。 |
| P3-3 起降点“场所感” | **PARTIAL** | `Golden Demo` 是工程夹具名，显示名清理可随地图标签 P2 评估；“场所感”若暗示真实设施则不接受。模拟标识与无运营依据必须显著保留。 |
| P3-4 ✓/→ 符号 | **ACCEPT** | 符号在当前界面可见，列 P3 backlog；可与选中态 P2 一并评估文字替代。 |

**汇总：ACCEPT 6 项（P2-1、P2-2、P2-5、P3-1、P3-2、P3-4）；PARTIAL 8 项（P1-1～4、P2-3、P2-4、P2-6、P3-3）；REJECT 1 项子结论（P1-3 所称安全声明在卡片之后）。** P0 无；没有独立核验后 ACCEPT 的 P1。WorkBuddy 的四项 P1 提级均未纳入已完成的 Sprint 2，也未自动启动 Sprint 3。

## 关键决定与优先级

现有 Sprint 3 目标为体验深化与集成，但范围和负责人仍待产品负责人确认。优先讨论与安全理解直接相关的 P2：REJECT 选中态、英文枚举、结果可达性、地图标签和 POI 精度说明；同时比较现有 Contract P2（几何三字段类型约束、模拟点映射校验）。字号、待确认布局和对话收纳随后评估。P3 留 backlog。需要折叠安全说明、加入外部底图、改变模拟设施展示或调整契约的提案，必须先走产品、Safety、数据来源及必要的接口/决策流程。`docs/DECISIONS.md` 和 `docs/ROADMAP.md` 本轮不改：无新重大决策获批，Sprint 3 范围未定。

## 验证、项目资料审计与发现的问题

- 已检查：`git log 95daf94..HEAD -- docs/handoffs/workbuddy`、该目录文件清单与 `8ead045` diff；当前 `PROJECT_STATE`、`DECISIONS`、`ROADMAP`、`INTERFACES`；相关 Skill；前端和 Agent 被引用代码；五张最终截图；Sprint 2 最终验收交接。全仓盘点时为 100 个已跟踪、1 个未跟踪文件（另有未提交的 `AGENTS.md`、`docs/HANDOFF.md` 修改），但**未逐文件审阅**。本轮修改的三个 Markdown 文件相对链接检查 0 缺失，`git diff --check` 对已跟踪修改通过。未运行应用、浏览器或测试；本轮是只读事实复核与文档更新。
- 发现的问题：WorkBuddy 把四项既有 P2 提为 P1，但静态证据不足以推翻 Sprint 2 的独立 Review；P1-3 的安全声明顺序陈述与组件源码相反；地图标签重叠及工程名、英文枚举暴露路径、结果可达性和 POI 映射说明仍需处理。部分 UI 折叠建议可能影响安全提示和 OSM 署名可见性，尚未通过相关审查。
- 工作区另有并行未提交的 `AGENTS.md`、`docs/HANDOFF.md` 和 `docs/handoffs/2026-09-27-project-materials-audit.md`；本轮保留其内容，不将其结论视为本次 WorkBuddy 审查结果。

## 未完成事项、Blocker 与接手约束

Sprint 3 尚未启动，产品负责人需决定其范围、P2 排序和负责人。无新增 P0/P1 实施任务。真实出行推荐的证据缺口、D-008 和既有数据边界不因 UX Review 改变。接手方按本交接的 ACCEPT/PARTIAL/REJECT 处理 WorkBuddy 输入；任何 Safety、Contract、数据真实性或 Sprint Scope 变化先走相应 Skill 与审查，不能以 WorkBuddy 建议直接修改。
