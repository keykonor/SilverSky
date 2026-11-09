# 新版 AGENTS.md 验证与交接

日期：2026-10-08。目标：验证用户贴文及当前根目录 AGENTS.md 是否适合现有 SilverSky 仓库，不修改或代替用户采纳新规则。

结论：**尚不建议直接验收为项目正式规则**。最小修改、密钥保护、禁止削弱测试和按风险验证等通用原则可保留；数据枚举、接口变更顺序及项目安全优先级需要先对齐。产品状态仍以根目录 `docs/PROJECT_STATE.md` 为准，本轮不提升任何产品验收结论。

## 已完成与修改范围

阅读新版磁盘文件、四份主项目文档、README、Git 管理说明、Schema、环境模板变量名称及现有工具配置；使用 code-change-verification、safety-data-integrity 和 api-contract 的相关约束核对。

仅新增本交接及 `docs/evidence/agents-review/2026-10-08-validation.json`，更新 `docs/HANDOFF.md` 最新入口。**没有修改、暂存或提交用户的 AGENTS.md**；没有修改源码、接口、数据、依赖或历史归档。

## 发现的问题

| 编号 / 优先级 | 具体文件与事实 | 影响与建议 | 状态 |
| --- | --- | --- | --- |
| A01 / P1 | `AGENTS.md:211` 列出 `REAL_DATA`；`schemas/core.v0.1.schema.json:9` 的 DataStatus 为 `VERIFIED`、`PUBLIC_DATA`、`SIMULATED_DATA`、`DATA_UNAVAILABLE` | 若将新版示例用于真实响应，会违反现有契约并丢失公开数据与已核验数据的区别。沿用现有四值；若 REAL_DATA 仅是概念分组，应显式说明不得作为字段值 | 待修正 |
| A02 / P1 | `AGENTS.md:159` 的步骤先修改代码，再于第 5 步更新 INTERFACES；`docs/INTERFACES.md:30` 与 api-contract 要求区分提案/确认/实现/验证 | 容易先实现未确认契约。建议先列调用方、兼容/迁移影响，再更新契约或提案；破坏性变化依 DECISIONS 待决/采纳，随后实施和验证。普通兼容修改无需额外重复审批 | 待修正 |
| A03 / P1 | `AGENTS.md:361` 只有工程交付优先级，没有 `docs/DECISIONS.md:8` 的业务排序“安全 > 舒适 > 可达性 > 时间 > 成本”，也未说明 Safety 只审候选 | 交付顺序可保留，但不能替代行程决策排序。建议补充项目业务约束和 Safety 不创造路线的职责，避免以能运行或能上线替代安全证据 | 待补充 |
| A04 / P2 | `AGENTS.md:7` 和 `:67` 使用 `agents/`，实际目录为 `agent/`；结构图没有现有 `schemas/`、`examples/`、`scripts/`、`versions/` | `agents/` 应改为 `agent/`，不要迁移代码来迎合示意。其余目录建议补入，尤其说明版本目录冻结、根目录为当前开发入口 | 待修正/补充 |
| A05 / P2 | `AGENTS.md:124` 将 `LLM + Tool / Agent` 列为技术方向；D-008 仍待决，当前为本地规则解析 | 技术方向可以保留，须明确当前未接入外部 LLM；该描述和 OPENAI_API_KEY 示例不代表模型供应方或个人出行信息外发授权。可部署目标也不替代 D-013 的公网决策 | 待澄清 |
| A06 / P2 | `AGENTS.md:40` 示例有 `npm run lint`，当前 package.json 没有 lint script；没有 ruff 配置。`:228` 的 AMAP_KEY 与环境模板不一致 | 文件已有“以现有配置为准”的限定，因此不是已发生的运行错误；建议直接列项目可用命令、优先 npm ci、使用本地虚拟环境 pytest。高德变量为 AMAP_WEB_KEY、AMAP_SECURITY_JS_CODE、AMAP_WEB_SERVICE_KEY；Cesium 为 VITE_CESIUM_ION_TOKEN。不要为了示例安装工具或更改变量 | 待适配 |
| A07 / P2 | 新版只画出 `.agents/skills/`，未写任务到 Skill 的入口；也未解释总控/专业开发、交接和历史版本管理入口 | 建议以简短链接指向任务相关 Skills、docs/HANDOFF.md 与 docs/GIT_MANAGEMENT.md，保留独立写入边界；不必恢复机械读取所有文件的流程 | 待补充 |
| A08 / P3 | 用户贴文有标题与 14 节，磁盘 AGENTS.md 共 381 行、Markdown 标题数为 0；`:1` 存在行尾空白 | 内容仍可阅读，但磁盘版不是贴文的完整排版。恢复总标题/章节标题并删除行尾空白；不需修改产品代码 | 待修正 |

正向检查：保留了环境变量与模板原则、模拟标记、当前状态单一入口、限制无关改动、禁止用删除/跳过/降低测试断言掩盖问题、重大操作确认及实际验证汇报。未发现当前改动包含真实密钥值；本轮只读取 `.env.example` 变量名称，没有读取真实 `.env`。

## 验证证据

- `scripts/validate_contract.py`：通过 2 个样例、4 个解释用例、1 个时间窗口请求、9 个不安全路线变体、5 个数据集及 1 个不安全数据变体。它证明现有契约有效，**不表示新 AGENTS.md 的 REAL_DATA 示例合约**。
- `scripts/verify_version_archives.py`：三版 438 个归档文件来源、标签和内容一致，通过。
- 目录与脚本静态检查：`agent/` 存在、`agents/` 不存在；frontend package scripts 没有 lint；未发现项目 ruff 配置。没有实际执行不存在的命令或安装新工具。
- `git diff --check -- AGENTS.md`：**未通过**，第 1 行行尾空白。用户文件保留原状。
- Markdown 与模板静态检查：381 行、0 个标题，代码围栏成对；仅比较模板变量名，不读取真实凭证。
- 未运行 Backend/Frontend 全量测试、构建、浏览器或在线地图：本轮没有运行代码/配置变更，不需要用这些检查代替规则语义审查。前轮测试结果没有冒认为本轮运行结果。

## 项目资料审计

开工盘点全仓已跟踪和非忽略未跟踪文件：698 个已跟踪、0 个非忽略未跟踪；开工时仅 AGENTS.md 已被用户修改。覆盖 Skills、源码、配置、Schema、数据、样例、测试、交接、证据和三个历史版本。结束清单与检查记录见 [验证记录](../evidence/agents-review/2026-10-08-validation.json)。

方法：Git 全仓清单/差异、主项目文件定向阅读、实际目录与 package scripts/Schema/环境模板对照、相关词检索、Markdown/空白检查、契约脚本与完整归档内容校验。对当前任务相关文件逐项核对；没有逐文件人工审阅全仓源码和历史文档，也没有审阅全部截图、依赖内部实现或全部历史 Git 对象。以上 A01–A08 仍待修正/澄清，不能归为通过。

## 未完成、风险与下一步

下一步是修订 AGENTS.md 的项目适配内容，保留用户的精简原则和按任务阅读要求。用户本轮只要求验证，因此修订建议尚未应用，不擅自恢复旧版或改变用户新规则。接手时先确认文件仍与本轮校验内容相同，再按反馈修订；保持核心 Schema、环境变量、业务安全和历史归档不变。

本轮没有新增产品功能，无需启动应用或生成产品访问地址。可直接查看 [被审查文件](../../AGENTS.md) 和本报告。项目产品状态、原有真人/Narrator/现实来源证据缺口仍按 PROJECT_STATE，不因文档验证而改判。
