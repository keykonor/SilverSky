# WorkBuddy Handoff

日期：2026-09-28

## Task

核查 Codex 在 SilverSky Sprint 3 完成的任务，并诊断 Codex 在本项目上「容易卡顿」的根因。纯只读分析，不改动 Codex 的代码、Schema、Safety、Agent Pipeline、Git 历史或 Sprint 结论。

## Scope

- 盘点 Git 仓库状态（分支、提交历史、工作树脏度、未跟踪文件）。
- 通读 Sprint 3 相关的状态/决策/路线图/交接文档，核对「Sprint 3 本地 Demo PASS」结论与版本库的一致性。
- 归纳 Codex 反复停滞（卡顿）的结构性原因，按 P0–P3 分级。

## Evidence

**1. Git 提交链**

- `git log`：Codex 最后一次提交为 `95daf94 docs: accept Sprint 2`（2026-09-27 17:46）。此后 Sprint 3 的全部工作（09-27 深夜至 09-28）**没有任何 Codex 提交**。
- 当前分支仍为 `codex/sprint2-webapp`（`git branch` 仅此一支 + `master`），**未创建 sprint3 分支**。
- 最终交接文档 `docs/handoffs/2026-09-28-sprint3-dualview-final-acceptance.md` 第 63–65 行自述：「本轮**未创建提交**……最终盘点有 41 个非忽略未跟踪文件……当前提交哈希未在本轮改变；不能把工作树 PASS 当成已提交版本。」

**2. 工作树脏度**

- `git status --porcelain`：41 个非忽略未跟踪文件（`??`）+ 26 个已跟踪文件修改（`M`）。
- `git diff --stat`：26 文件，+4665 / −337。
- 未跟踪内容包括：Sprint 3 全部交接（`2026-09-27-sprint3-3d-demo.md`、`2026-09-28-sprint3-dualview-final-acceptance.md` 等 10 份）、全部证据截图（`docs/evidence/sprint3/` 18 张 PNG、`docs/evidence/amap-local/`）、新地图组件 `frontend/src/components/AmapRouteMap.tsx`、`RouteMap.test.ts`、5 个新测试脚本、2 个新 Skill 目录、`docs/AGENT_SKILL_REGISTRY.md`。
- 已跟踪但未提交的修改包括：`agent/data_access.py`（新增模拟起降点校验）、`frontend/` 全部核心组件、`docs/PROJECT_STATE.md`/`DECISIONS.md`/`ROADMAP.md`/`HANDOFF.md` 等 12 份文档、`frontend/package-lock.json`（+3900 行，引入 Remotion + 高德加载器）。

**3. 「PASS」结论的落点**

- 「Sprint 3 本地 Demo = PASS」仅存在于工作树里**未提交**的 `docs/PROJECT_STATE.md`、`docs/ROADMAP.md`、`docs/DECISIONS.md`(D-015) 中。
- 版本库 HEAD 仍停留在 Sprint 2 验收状态；任何干净 `git clone`/`checkout` 都无法复现 Sprint 3 成果。

**4. 决策链漂移**

- Sprint 3 地图实现经历 4 次决策改写：D-012（Cesium 3D + 可选 ion + 断网降级）→ D-013（高德评估）→ D-014（高德接入）→ D-015（高德 + Cesium 双视角）。
- 期间误建「高德 Key 输入界面」，被用户澄清后整轮删除（`docs/handoffs/2026-09-27-remove-amap-key-ui.md`）。
- D-015 宣称「不改 Backend、Agent、核心 Schema」，但 `agent/data_access.py` 实际已修改（模拟起降点 A/B 校验），存在契约宣称与代码事实不一致。

**5. 验收与工具缺口**

- 官方 Skill 列表 API 返回 403；旧对话 `doc`/`create-plan` 官方路径不存在；ChatGPT 关联对话「预览中途截断」，当前无 `read_thread` 类工具，导致 Skill 安装清单无法核实，反复请求用户（`docs/handoffs/2026-09-28-sprint3-skill-setup-and-resume.md`）。
- Accessibility 反复落在 PARTIAL：真实屏幕阅读器、原生 200% 缩放无法本地验证，遂以 `zoom-200.mjs` + 720×450 CSS 视口/DPR2 造「近似」证据。
- 引入 `@remotion/cli`/`remotion` 4.0.529 依赖（+3900 行 lock），但 D-014 明确「本轮不制作旅行足迹动画」，属未产生产品能力的死重依赖。

## Findings

### P0 — 必须立即解决

1. **Sprint 3 全程零提交，版本库与「PASS」结论脱节。**
   - 证据：Codex 末次提交停在 Sprint 2 验收；41 未跟踪 + 26 修改文件承载全部 Sprint 3 成果；分支仍名 `codex/sprint2-webapp`；最终交接自述「本轮未创建提交」。
   - 影响：这是「卡顿」的核心死结。工作树越脏 → 收尾越需全量审计 → 越难判定文件归属 → 越不敢提交 → 工作树更脏。最终连 PASS 本身都只是工作树里的未提交文本，无法复现、无法交接、无法回滚。
   - 建议：立即按文件归属拆分提交（代码 / 数据 / 文档 / 证据四类），创建 `codex/sprint3` 分支，把 Sprint 3 成果固化为可复现版本；先落「代码 + 测试」提交，再落文档与证据，不追求单条大提交。

### P1 — 进入下一阶段前必须解决

2. **范围漂移 + 决策链过长，一个 Sprint 被 4 个决策反复改写。**
   - 证据：D-012→D-015 四次决策；高德 Key 界面误建又删除整轮返工。
   - 影响：每个决策都要求「动机/备选/影响/迁移/验证」+ 官方文档链接核对，且外部依赖（高德 Key、ion token、许可配额）长期待决（D-013），形成永久 Blocker，主线反复被打断。
   - 建议：Sprint 边界内冻结范围，外部地图/许可问题降级为「可选项 + 待决清单」，不与核心验收捆绑；D-013 类公网/许可项单独开决策，不阻塞本地 Demo 验收。

3. **验收门槛自我膨胀 + 「近似证据」陷阱。**
   - 证据：自己设了无法本地验证的门槛（真实屏幕阅读器、原生 200% 缩放、ion 在线层、比赛现场网络），又花大量精力造近似证据（zoom-200.mjs、DPR2 近似），Accessibility 反复 PARTIAL。
   - 影响：验收被反复拉回，四路独立 subagent（Contract/Safety/Product/Accessibility）复核循环消耗大量轮次，且审查环境受限（无法加载第三方高德资源）。
   - 建议：验收门槛分级为「本地必需」与「目标设备/公网后补」，本地 Demo 只挂本地可测项；PARTIAL 结论一旦明确界定范围即收口，不无限补证据。

### P2 — 后续改善

4. **文档与审计负担过重，吞噬开发时间。**
   - 证据：AGENTS.md 强制「每轮项目资料审计」（盘点 141+ 文件）+ 必写交接 + 同步更新 ≥6 份文档；Sprint 3 一天内产出 4 份交接 + 2 个新 Skill + 1 份 Skill 登记，单份交接 8–17KB。
   - 影响：文档/审计成本远超代码本身，Codex 大量轮次花在「写证明」而非「写功能」。
   - 建议：把审计与交接模板精简为关键字段；非里程碑轮次允许轻量交接。

5. **死重依赖：引入未使用的 Remotion。**
   - 证据：`@remotion/cli`/`remotion` 4.0.529 进依赖（lock +3900 行），但本轮明确不制作动画。
   - 影响：扩大构建面与 lock 体积，无产品收益。
   - 建议：要么删除，要么在有明确视频产出需求时再引入。

6. **契约宣称与代码事实不一致。**
   - 证据：D-015 称「不改 Backend/Agent」，但 `agent/data_access.py` 已修改。
   - 影响：这类「文档说没改、代码改了」的漂移，正是 Codex 反复自我审查、不敢提交的诱因之一。
   - 建议：任何触及 Backend/Agent/Schema 的改动（即使仅数据校验）都显式写入决策与交接，消除口径漂移。

### P3 — 低优先级

7. **环境噪音**：Windows GBK/UTF-8 首次读取失败需 `PYTHONUTF8=1`、Git 反复提示 LF→CRLF、`__pycache__`/`.pytest_cache` 干扰文件盘点。
   - 建议：在仓库统一 `.gitattributes` 行尾策略与编码约定，减少每次收尾的噪音。

## Recommendations

核心结论：Codex 卡顿不是单点技术问题，而是「**未提交工作树膨胀 → 收尾审计成本递增 → 不敢提交 → 树更脏**」的恶性循环，叠加「范围漂移 + 门槛膨胀 + 文档过载 + 外部依赖待决」四类放大器。最直接的破局动作是把 Sprint 3 成果尽快分拆提交并建 `codex/sprint3` 分支，让「PASS」在版本库中有可复现落点；其次冻结 Sprint 边界、分级验收门槛、精简交接模板。

## Files reviewed

- `docs/PROJECT_STATE.md`、`docs/ROADMAP.md`、`docs/DECISIONS.md`、`docs/HANDOFF.md`、`docs/INTERFACES.md`（部分）、`AGENTS.md`
- `docs/handoffs/2026-09-28-sprint3-dualview-final-acceptance.md`、`2026-09-28-sprint3-skill-setup-and-resume.md`、`2026-09-28-skill-baseline-audit.md` 及 HANDOFF.md 所列交接清单
- `git log` / `git branch` / `git status` / `git diff --stat` / `git ls-files` / `git reflog`
- `agent/data_access.py`、`frontend/package.json`（diff）
- `.agents/skills/` 目录结构与 `.gitignore`

## Files modified

None（只读审查；本交接文档为 WorkBuddy 独立新增，未触碰 Codex 的任何改动）。

## Unverified

- 未重跑 `.venv` 的 84 项 pytest 与 18 项前端单测（只读审查，依赖 `docs` 中的自述证据）。
- 未逐像素核验 `docs/evidence/sprint3/` 18 张截图。
- 未读取 `.env`（已忽略，仅确认忽略状态，不接触密钥）。

## Codex handoff

1. 创建 `codex/sprint3` 分支，把 Sprint 3 成果按「代码 / 测试 / 数据 / 文档 / 证据」分拆提交，使 PASS 在版本库可复现。
2. 补录 `agent/data_access.py` 的模拟起降点校验改动到 D-015 或新建决策，消除「文档说没改、代码改了」的口径漂移。
3. 明确 D-013（公网许可/域名/配额）与本地 Demo 验收解耦，单独列待决，不阻塞 Sprint 4 启动。
4. 对 Remotion 依赖做保留/删除裁决，明确其产品用途或移除。
5. 将验收门槛分级为「本地必需」与「目标设备/公网后补」，为 Accessibility PARTIAL 划定明确收口条件。
6. 精简 AGENTS.md 的每轮审计与交接模板，区分里程碑与非里程碑轮次。
7. 统一 `.gitattributes` 行尾与编码约定，消除 LF/CRLF、GBK/UTF-8 噪音。
