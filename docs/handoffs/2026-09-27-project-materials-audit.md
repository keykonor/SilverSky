# SilverSky 项目资料审计与结束审计规范

日期：2026-09-27

## 本轮目标

将“每轮项目工作结束后审计项目资料，并单独报告问题”的要求写入仓库规则；检查现有资料，留下具体审计证据和待处理问题。

## 已完成内容

- 在 `AGENTS.md` 增加全仓文件盘点、跨资料一致性检查、验证证据和问题单列要求。
- 没有新增或修改 Skill。
- 读取项目状态、决策、路线图、接口、项目愿景、MVP 范围、架构、数据政策/来源、API 契约、协作入口及六个项目 Skill。
- 审查了全仓 Git 文件清单（98 个文件）、40 个 Markdown 的本地链接、14 个 JSON 的语法、5 个 CSV 的 UTF-8 与表格形状；核对数据字典计数与 CSV 行数一致。
- 六个项目 Skill 均通过官方 `skill-creator` 的 `quick_validate.py`。Windows 默认编码导致的首次失败，用 `python -X utf8` 重跑后全部通过。
- 后端 `pytest`：77 passed，1 条 Starlette/httpx 弃用警告；`scripts/validate_contract.py` 通过。
- 前端 Vitest：13 passed；生产构建通过；Chrome E2E 通过；axe 在首屏、路线结果、急症状态均未发现 serious/critical 问题。
- 检视了当前更新的天津对话和地面地图截图，新增的无障碍限制说明可见。

## 发现的问题

1. **运行时 Agent 安全枚举文档过期**：`docs/AGENT_ARCHITECTURE.md` 仍写 Safety 返回 `PASS` / `BLOCK` / `UNKNOWN`；当前 `docs/API_CONTRACTS.md`、Schema 与 D-005 使用 `PASS` / `DOWNGRADE` / `REJECT` / `UNKNOWN`。这会给实现或评审方提供不一致的契约语义。本轮未修改该业务架构文档。
2. **MVP 范围状态过期**：`docs/MVP_SCOPE.md` 开头仍称场景数据源和阈值“需 Sprint 1 确认”，但项目状态已进入 Sprint 2 且 Sprint 1 已完成技术验收。需要产品/项目维护者确认并更新其状态说明。
3. **产品资产与运行时低空范围需要明确**：`data/product-assets/feature_backlog.csv` 将飞行器资料库和候选起降点库列为 P0、MVP 必需，并描述用于选型/Agent 决策；相关 CSV 含真实航空器公开资料及现实地点/潜在起降点。`docs/PORTAL_INTEGRATION.md` 说明产品资产与运行时契约分离，且本次在 `agent/`、`backend/`、`tests/`、`scripts/`、`schemas/` 未发现对这些 CSV 的引用；运行时低空数据仍来自模拟数据。建议产品与数据负责人明确这些 CSV 仅用于研究/规划，还是未来需要进入运行时；未经决定不得把候选地点当作运营设施。
4. **六个 SilverSky Skill 的来源沿革未登记**：六个 Skill 的格式和触发边界通过检查；Git 历史能证明它们随项目提交并迁移目录，但未提供原创/借鉴来源或官方 Skill 对照记录。因此无法完成来源溯源结论。后续 Skill 来源审计应记录每个 Skill 的维护来源、审查过的官方来源和版本（若有），不应把未知来源写成官方来源。
5. **深圳地图证据中的地点标签重叠**：`docs/evidence/sprint2-d011/shenzhen-conversation.png` 和 `shenzhen-air-map.png` 中，目的地与模拟起降点的文字标签重叠，难以逐个辨认。axe 检查只测出 serious/critical 违规，不覆盖此类视觉可读性；E2E 通过也未验证标签是否重叠。属于前端地图体验问题，本轮只记录，交由前端/产品评审处理。

## 现有项目未决项（非本轮新增）

- `docs/PROJECT_STATE.md` 标记 Sprint 2 的 Product Review、独立 Contract/Safety Review 尚未完成；缺精确上下车点、无障碍、接驳、天气、车辆和真实低空运营证据，阻断阶段完成声明及真实推荐。
- D-008 的 LLM 与个人信息传输边界待决；MCP 工具契约待定义。
- `pytest` 有一条 Starlette/httpx 弃用警告，未影响本轮测试结果。

## 工作区状态与修改文件

- 本轮写入：`AGENTS.md`、本交接文档、`docs/HANDOFF.md`。
- 审计中另观察到未由本轮写入的工作区差异：`frontend/src/App.tsx`、`frontend/src/App.css`、`frontend/src/components/RouteMap.tsx`、`frontend/tests/e2e.mjs`，以及审计结束时状态显示有改动的 `docs/evidence/sprint2-d011/` 地图 PNG。前端改动区分道路模型车行时间与全程耗时、补充不含等候/步行/上下车的说明，并标出静态路线不保证无障碍；没有覆盖或清理这些差异。针对最新源代码状态重跑后，Vitest 13 passed、构建、Chrome E2E 与 axe 均通过。
- 五张地图/对话证据均已查看。深圳两张图中目的地和模拟起降点标签重叠，影响辨认（问题 5）；天津新截图中的无障碍与时间限制文案清晰可见。
- 未改变 `docs/PROJECT_STATE.md`，因为本轮没有新的 Sprint 交付或阶段验收决定。

## 未完成事项与接手约束

- 由对应文档/产品/数据负责人处理上列问题；本轮仅审计和记录，没有代替产品决策，也没有修改业务架构、需求或运行时数据。
- Skill 来源沿革目前不可完全追溯；后续创建或更新 Skill 时按新加入的 `AGENTS.md` 来源记录规则执行。
- 状态仍以 `docs/PROJECT_STATE.md` 为准；以上测试是本轮实测，阶段验收仍保持 PARTIAL。
