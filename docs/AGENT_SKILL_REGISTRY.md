# SilverSky Agent Skill 登记

核对日期：2026-09-29。项目 Skill 位于 `.agents/skills/`；用户级 Skill 位于 Codex 的 Skill 目录。此表记录已核实的本机状态，不把旧对话中的名称自动视为仍可安装。

| Skill | 来源与版本 | 用途 | 当前状态 |
| --- | --- | --- | --- |
| `gh-address-comments` | OpenAI `openai/skills` 的 `skills/.curated/gh-address-comments`，2026-09-28 从 `main` 安装；当日远端 HEAD 为 `49f948faa9258a0c61caceaf225e179651397431`，安装器未记录精确安装提交 | GitHub PR 评论处理 | **已安装**；当前项目未要求处理 PR，未运行其工作流 |
| `doc` | 旧对话指定的 `skills/.curated/doc` 路径 | 原对话用于项目 Markdown 文档 | **当前官方路径不存在，未安装**；本机已有 `documents:documents`，其范围是 Word 文档，不能等同于 Markdown 管理 |
| `create-plan` | 旧对话指定的 `skills/.experimental/create-plan` 路径 | 原对话用于 Sprint 任务拆解 | **当前官方路径不存在，未安装**；项目现有 `implementation-strategy` 与 `agent-orchestration` 覆盖当前 Sprint 拆解与依赖协调 |
| `product-requirements`、`implementation-strategy`、`agent-orchestration`、`api-contract`、`safety-data-integrity`、`code-change-verification` | SilverSky 仓库级，项目现有 | 产品、方案、协调、接口、安全、代码验收 | **已有，保留唯一正文** |
| `silver-sky-geospatial-review` | SilverSky 仓库级，2026-09-28 新建 | 两城地图几何、坐标、3D 显示、来源和降级审查 | **已创建；`quick_validate.py` 通过** |
| `silver-sky-handoff-review` | SilverSky 仓库级，2026-09-28 新建 | 专业开发、WorkBuddy、Reviewer 与 Sprint 交接审查 | **已创建；`quick_validate.py` 通过** |
| `silver-sky-ux-reality-validation` | SilverSky 仓库级，v0.1.0，2026-09-29 新建 | 阶段 UX、现实语义、模拟真实性、2D/3D 有效性、老年无障碍和故障体验的证据编排 | **已创建；格式与 Dry Run 见本轮交接** |

## `silver-sky-ux-reality-validation` 调用登记

| 字段 | 内容 |
| --- | --- |
| name | `silver-sky-ux-reality-validation` |
| source | `.agents/skills/silver-sky-ux-reality-validation/SKILL.md`（项目自定义） |
| version | `0.1.0`（Skill 文档版本；不改变产品或 API 版本） |
| purpose | 在重要阶段后核查实际使用、地图与现实语义、模拟误认、3D 效用、无障碍、性能及故障降级 |
| trigger | Sprint Product Acceptance、3D/Cesium UX、A/B 或产品实验、老年用户体验、真实场景/Demo、Accessibility、Reality Consistency |
| dependencies | `docs/PROJECT_STATE.md`、`docs/INTERFACES.md`；按问题复用 `safety-data-integrity`、`silver-sky-geospatial-review`；可选 `product-design:audit` 与 `data-analytics:design-kpis`。`simulation-truth-boundary`、`silver-sky-experiment-design`、`silver-sky-data-audit` 当前未发现，存在时按 Skill 正文协作。 |

`gh-address-comments` 的精确安装提交未被安装脚本持久记录，因此不能把远端 HEAD 当作已核实的安装版本。关联 ChatGPT 对话只提供了截断预览；预览后段可能有其他 Skill，清单仍待对照全文。新增项目 Skill 可由 Codex 在下轮会话自动发现。
