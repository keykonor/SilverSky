# Sprint 2 最终独立验收交接

日期：2026-09-27。范围仅为独立验收及验收发现的 P0/P1 修复；未新增业务功能。唯一项目状态以 [PROJECT_STATE.md](../PROJECT_STATE.md) 为准。

## 最终结论

| 验收项 | 结论 | 独立性与证据 |
| --- | --- | --- |
| Contract Review | **PASS** | 独立只读 `/root/contract_review` Subagent，检查 Schema、Dataset、Agent、Backend、Frontend；定向 16 tests passed，另做内存篡改与旧响应兼容复现。P0=0、P1=0、P2=2 |
| Safety Review | **PASS** | 独立只读 `/root/safety_review` Subagent，复跑两城 `interpret→plan`、检查 UI 与五张最终截图；P1 修复后复验。P0=0、P1=0、P2=2。该 Reviewer 未亲自操作 Chrome |
| Product Review | **PASS** | 独立只读 `/root/product_review` Subagent，先以普通用户视角在 Chrome 操作两城，再逐一复审五张截图；P1 修复后两城重试和最终截图复看。P0=0、P1=0、P2=4 组 |
| Accessibility | **PASS** | Chrome axe 在首屏、路线结果、医疗急症三状态无 serious/critical；风险和拒绝均有文字，未只用颜色表达。未覆盖所有屏宽及所有辅助技术 |

依产品负责人门槛，三项独立 Review 均 PASS、Accessibility PASS、无剩余 P0/P1，故 **Sprint 2 = PASS**。这是 Sprint 2 Web App 与 Golden 演示验收，不构成真实出行推荐或低空运营认可。建议进入 Sprint 3 范围与优先级讨论：**YES**；本轮未启动 Sprint 3。

## 两项 P1 与修复

1. **Safety P1，已修复**：静态道路的显眼地图说明原先未直接写明无障碍路线不保证。现 [RouteMap.tsx](../../frontend/src/components/RouteMap.tsx) 在 OSRM 实线说明中明确“不是实时导航或门到门路径，也不能保证无障碍通行”。独立 Safety Reviewer 复看最终页面与五张截图后确认关闭。
2. **Product P1，已修复**：地面卡原将 OSRM 纯车行估算 5/11 分钟标成“总时间”，易被理解为实际全程。现 [App.tsx](../../frontend/src/App.tsx) 标“道路模型车行时间”，同一卡说明“全程耗时待确认；车行估算不含等候、步行及上下车时间。”模拟卡仍显示“全程时间 待确认”。独立 Product Reviewer 在 Chrome 复验两城并复看最终截图后确认关闭。

P0：未发现。P1：无未解决。P3：未发现。

## 尚未修复的 P2

| 编号 | 来源 | 事实与影响 | 状态 |
| --- | --- | --- | --- |
| C-1 | Contract | `frontend/src/types/contracts.ts` 中三个几何字段分别可选，TypeScript 层未编码“三者同时出现”；后端 Schema 与地图运行时已阻止现有错误显示 | 后续类型收紧 |
| C-2 | Contract | `schemas/datasets.v0.1.schema.json` 未交叉校验 `vertiport_a/b` 标签与 `simulated_vertiports[0/1]` 名称/坐标；当前两城数据一致 | 后续读取时一致性检查 |
| S/P-1 | Safety、Product | 选中的 `REJECT` 方案仍显示绿色边框和 ✓，可能短暂误读为认可；同卡有显眼“当前不建议采用”和不可乘坐提示 | 后续改善选中态 |
| S/P-2 | Safety、Product | 折叠解释与规划提醒仍可见 `DATA_UNAVAILABLE`、`SIMULATED_DATA` 等内部枚举，老人阅读负担较高 | 后续转换用户语言 |
| P-3 | Product | 深圳地图的起降点和目的地标签拥挤，结果位于可滚动左栏下方，30 秒内下一步不够直观 | 后续地图/布局可读性优化 |
| P-4 | Product | 天津需求摘要保留原话“天津大学”，解析出的“卫津路校区”主要在地图标记中出现，确认成本偏高 | 后续摘要显示 canonical POI |

上述均未被独立 Reviewer 判为 P0/P1。本轮按“只修 P0/P1”限制没有实施 P2；进入 Sprint 3 前由产品负责人排序。

## Golden 场景与真实性判断

- **天津**：Chrome 输入“我父亲明天下午要去天津医大总医院。”→“天津大学。”→“78岁，腿脚不方便，希望安全舒服一点。”追问自然、无重复；返回两条方案。地面 `DOWNGRADE`，模拟低空 `REJECT`；切换方案后地图同步。POI 标为公开中心点，不是具体上下车位置。
- **深圳**：Chrome 使用正式深圳 Golden 入口，完成输入、规划、方案切换、地图拖动/缩放及重新规划；返回两条方案。地面 `DOWNGRADE`，模拟低空 `REJECT`。
- **Q1 模拟低空已经运营？** Product Reviewer 判“不容易误以为”；卡片、地图和安全结果明确未来模拟、不可购票乘坐。
- **Q2 POI 点就是实际接送入口？** 判“不容易”；地图写明中心点和上下车位置未核验。
- **Q3 OSRM 是实时导航？** 判“不容易”；地图写静态模型、非实时/门到门、无障碍不保证；地面卡现把车行时间与未知全程分开。
- **Q4 REJECT 仍是推荐？** 未判“容易发生”；红色拒绝文案清楚，但绿色选中勾仍记 P2。

最终五张截图：[天津对话与需求](../evidence/sprint2-d011/tianjin-conversation.png)、[天津地面路线](../evidence/sprint2-d011/tianjin-ground-map.png)、[天津模拟低空](../evidence/sprint2-d011/tianjin-air-map.png)、[深圳对话与需求](../evidence/sprint2-d011/shenzhen-conversation.png)、[深圳模拟低空](../evidence/sprint2-d011/shenzhen-air-map.png)。Product Reviewer 在 Chrome 操作后逐一检查，并在 P1 修复后复看更新版；Safety Reviewer 也复看更新版。对话与路线位于同一可滚动侧栏，需结合截图阅读。

## 验证与审计

- 后端全量：`.venv/Scripts/python.exe -m pytest -q` **77 passed**，1 条已有 TestClient/httpx 弃用警告；`scripts/validate_contract.py` 通过 2 个样例、4 个解释用例、1 个时间窗口请求、9 个不安全路线变体、5 个数据集、1 个不安全数据集变体。
- 前端：`npm run build` 通过，`npm test -- --run` **13 passed**；Chrome `npm run test:e2e` 两城、三轮、切换、缺几何、急症、键盘及新增 P1 文案断言通过；`npm run test:a11y` 首屏/结果/急症无 serious/critical。
- 人工浏览器验收由独立 Product/UX Subagent 在 Chrome 逐步操作，含输入、追问、规划、路线切换、地图拖缩、重新规划；不同于自动 E2E。Safety Reviewer 只读结果/UI/截图，未声称亲自操作 Chrome。
- 项目资料审计：盘点当时 98 个已跟踪文件、1 个由另一并行工作进程新建的未跟踪交接文件，覆盖 `.agents/`、源码、配置、Schema、数据、样例、测试、项目文档、交接与证据目录。对全部 14 个 JSON 解析、17 个 Python 文件作语法解析、5 个 CSV 作 UTF-8/CSV 检查、5 张 PNG 头校验、40 个 Markdown 中 104 个本地链接目标检查，未发现格式/链接问题；TypeScript 构建、合同、pytest、Chrome 另行验证。未逐文件人工阅读全部 98 项，也未验证外部网页内容或真实运营事实。
- 审计发现的问题：独立项目资料审计还指出 `docs/AGENT_ARCHITECTURE.md` 的 Safety `BLOCK` 旧枚举、`docs/MVP_SCOPE.md` 的 Sprint 1 旧状态、产品资产 CSV 与运行时模拟边界需持续澄清、六个 Skill 来源沿革未记录，以及深圳地图标签重叠。前四项未在本轮验收范围内修改，建议项目/数据负责人后续核对；标签问题已列 Product P2。该审计文件由另一并行工作进程维护，本轮保留其修改，不把其结果冒称为三位 Reviewer 结论。

WorkBuddy 仅受监督完成截图尺寸与测试文件清单的只读重复核对；另一次 WorkBuddy 长时安全复核超时，**未计入独立 Review 证据**。当前 WorkBuddy 连接只支持非交互任务调用，没有提供可创建或返回的用户界面会话 ID/链接；产品负责人可在 WorkBuddy 界面自行建立后续任务对话。

## 修改文件、提交与接手约束

本轮 P1 修复文件：`frontend/src/components/RouteMap.tsx`、`frontend/src/App.tsx`、`frontend/src/App.css`、`frontend/tests/e2e.mjs`、`docs/evidence/sprint2-d011/`；代码与证据提交 **`88d9c14`**。验收记录更新 `docs/PROJECT_STATE.md`、`docs/ROADMAP.md`、本文件及 `docs/HANDOFF.md`；这些文件所在提交以最终 `git log` 为准。未改 Safety 算法、核心 Schema、数据集或路线数量。

接手方不可把 Sprint 2 PASS 解释为真实低空航线、真实起降设施、实时导航、门到门/无障碍保证或地面安全推荐。未来引入真实数据、改变跨模块契约或扩展 MVP 范围，仍须先依 `docs/DECISIONS.md`、`docs/INTERFACES.md` 和项目规则决策。Sprint 3 当前只建议进入规划与优先级讨论，不在本轮新增功能。
