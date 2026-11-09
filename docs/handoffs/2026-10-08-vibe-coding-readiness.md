# 2026-10-08 vibe coding 开发准备

## 本轮目标

落实产品负责人 REQ-010：阅读“改用Git管理项目”可见对话，补齐可运行 README、每次请求的文件化机制、现有 Schema 固定与开发 Subagent 边界，并补充适合当前 MVP 的本地预检和完成条件。

## 已完成内容

- README 写明 Python/Node 环境、依赖安装、根/前端环境变量、前后端地址、双终端启动、代理、测试/构建及故障排查。说明没有 lint 命令、无需外部 LLM Key、生产代理尚未批准。
- requests.json 记录 11 条当前上下文/引用预览可见请求，18 条历史决定作为独立回溯索引；旧 AGENTS.md 草稿以非规范性文件快照保留。来源、原文/摘要范围、日期未知和聊天缺口明确区分。之后的需求、纠正、取消、范围确认均追加 ID。
- 固定两份既有 JSON Schema 和核心 TypeScript 镜像的 LF 规范化 SHA-256；HTTP 保持 0.1-proposal。单一写入者先审查契约/调用方再更新基线，不能自动接受漂移。
- DEVELOPMENT.md 明确集成、Backend、Agent、Frontend、Map、Data、QA 文件范围，前端入口/地图组件分离，共享契约/状态/锁文件唯一写入者，并提供任务卡和完成条件。本轮没有实际启用多个 Subagent。
- 新增只读预检（文档链接/围栏、台账来源、Schema 漂移、DataStatus、脚本和环境模板）及可选四地址 smoke；新增 6 项有针对性的预检测试。
- AGENTS.md 增加台账/边界/基线入口，INTERFACES.md 登记现有文件基线和缺口；PROJECT_STATE.md 只增加开发准备证据，不提升产品阶段状态。

## 修改文件

相对本轮开工快照，修改 5 个已有文件：

- `AGENTS.md`
- `README.md`
- `docs/HANDOFF.md`
- `docs/INTERFACES.md`
- `docs/PROJECT_STATE.md`

新增 12 个文件：

- `docs/DEVELOPMENT.md`
- `docs/evidence/vibe-coding/2026-10-08-audit.json`
- `docs/evidence/vibe-coding/2026-10-08-browser.json`
- `docs/evidence/vibe-coding/2026-10-08-verification.json`
- `docs/handoffs/2026-10-08-vibe-coding-readiness.md`
- `docs/requirements/README.md`
- `docs/requirements/requests.json`
- `docs/requirements/sources/2026-10-08-user-agents-draft.md`
- `schemas/BASELINE.json`
- `schemas/README.md`
- `scripts/check_project_ready.py`
- `tests/test_project_ready.py`

上一轮 AGENTS.md 验证/最小修订及其证据仍保留，本轮未覆盖其内容。工作区文件已写入，尚未新增 Git 提交或推送；Git diff 中还包含此前已授权、未提交的 AGENTS.md 等改动，不能把整个 diff 都归为本轮。

## 关键决定与依据

1. 用现有结构落实准备，避免增加新框架、CI 平台、数据库或部署设施；依据用户“先落地、简单 MVP”的要求及 AGENTS.md。
2. 不把助手提出的语音/LLM 建议变为已批准需求。当前本地解析继续运行；D-008/D-013 待决，未采购服务或部署。
3. 只固定当前契约文件，不制造新的运行 Schema。R-001/R-002 已有接口文档与测试，但没有独立机器 Schema；这项缺口保留。
4. 引用对话全文读取工具不可用，只能读用户提供的截断预览。覆盖声明为不完整；历史决定不冒充逐字用户聊天。
5. 原始数据状态、安全优先级、WGS84/GCJ-02 边界、模拟低空不可预订保持原有约束。

## 验证结果

| 检查 | 实际结果 |
| --- | --- |
| 完整 Python pytest（独立 basetemp，关闭 cache） | 97 passed，含新增 6 项；1 个既有 TestClient/httpx 弃用警告 |
| Frontend typecheck / test / build | PASS / 19 passed / PASS |
| validate_contract.py | 2 样例、4 解释、时间窗口、9 不安全路线变体、5 数据集和不安全数据集变体通过 |
| verify_data_baseline.py | 5 JSON 文件通过 |
| verify_version_archives.py | 87 + 99 + 252 = 438 文件与源提交/标签/树/内容一致 |
| check_project_ready.py 离线和 --smoke | 通过；4 个本地地址、含 Vite /health 代理 |
| Chrome 本地实际操作 | 页面加载、服务连接、天津 Golden 两候选、安全提示通过；外部网络阻断 |
| git diff --check | 通过 |
| Git 忽略 | 根 .env、前端 .env.local、.verification、dist 被忽略；未读取本地凭据值 |

初次沙箱内 Vitest / build 因 realpath EPERM 失败；初次 HTTP smoke 为 URLError。已正常权限重跑通过，未删测、降断言或修改依赖。Python 结果也来自正常权限执行。不能把初次失败写成通过。

详细结果：[verification.json](../evidence/vibe-coding/2026-10-08-verification.json)；浏览器证据：[browser.json](../evidence/vibe-coding/2026-10-08-browser.json)。

## 项目资料审计

先盘点全仓 Git 已跟踪/非忽略未跟踪文件：开工 698 + 4 = 702；结束 698 + 16 = 714。覆盖文档、Skills、源码、配置、Schema、数据/样例、测试、交接与证据。忽略文件可枚举数至少 28234，其中 .pytest_cache 无法访问，所以忽略文件清单不完整；凭据、依赖、产物只做路径盘点，不读取秘密内容。

方法：开工 SHA-256 与结束对照确定本轮范围；版本归档逐文件验证；人工核对当前任务相关命令、配置、契约和安全说明；新增文件格式/链接/台账与基线检查；相关回归与本地 HTTP/Chrome 冒烟。不是全仓逐文件语义审阅。

结果：范围与验证检查通过，已知缺口保留；运行端点/字段、原 Schema、核心 TS、依赖、数据和历史快照未变。完整清单及发现：[audit.json](../evidence/vibe-coding/2026-10-08-audit.json)。

### 发现的问题

| 编号 | 文件 / 事实 | 影响与状态 |
| --- | --- | --- |
| F01 | requirements/requests.json：引用全文与其他历史聊天缺失 | 不能宣称每次历史请求完整收齐；OPEN_SOURCE_GAP |
| F02 | INTERFACES.md、schemas/README.md：在线查询缺独立机器 Schema | 当前机器基线覆盖不完整；KNOWN_GAP，未改运行接口 |
| F03 | PROJECT_STATE.md、DECISIONS.md：真人/读屏证据、D-008/D-013 待补 | 不能判完整产品或公开部署 PASS；原有 Blocker 不变 |
| F04 | requirements.txt、README：Python 版本范围且未空白环境重装 | 当前环境验证不等于新机器逐版本复现；NOT_VERIFIED |
| F05 | verification.json：沙箱 EPERM/URLError | 正常权限重跑解决，原始失败保留；RESOLVED_BY_VALID_RETRY |
| F06 | .pytest_cache/：原有权限拒绝，正常权限仍不能枚举 | 忽略清单不完整；测试隔离目录不受影响；不改 ACL 或清理无关缓存 |

未检查/无法验证：完整历史聊天、被拒绝访问的缓存内容、空白安装、在线地图/ion、真实参与者、Narrator、生产托管/代理/域名/许可/配额。以上不能归为通过。

## 未完成、Blocker 与风险

本轮文件和本地预检已可用；“所有历史请求逐条完整收录”仍 PARTIAL，必须取得原文后补录。R-001/R-002 的机器 Schema 后续另分配兼容性任务。Python 精确依赖快照与干净安装可在发布准备阶段核实，不顺手升级包。

产品仍 Sprint 3 本地 PASS、Sprint 3.1 G2 PARTIAL、Sprint 3.2 Reality Gate PARTIAL、Sprint 4 未启动，以 PROJECT_STATE.md 为准。不得借本轮测试承诺真实安全推荐、真实低空运营或公开上线。

## 下一步与接手约束

- 后续每条用户请求追加台账，再给任务分配需求 ID 和具体文件；共享文件只指定一位写入者。
- 获得引用对话原文时追加带来源记录，不改写已有请求。需要补在线机器契约时先提案和搜索调用方。
- 产品工作仍按 PROJECT_STATE.md 优先补真人/读屏、入口/落客/无障碍和车辆证据；公开发布先决定 D-013，外部 LLM 先决定 D-008。
- 不动 versions/、真实 .env、其他人的未提交改动；不得自动接受 Schema 漂移或把待决写成已实现。

## 可进入链接或者软件

本轮已启动并验证：

- 前端：http://127.0.0.1:5173/
- 后端 API 文档：http://127.0.0.1:8000/docs
- 健康：http://127.0.0.1:8000/health

这些是本机地址，依赖服务持续运行；重启步骤见根 README。后台服务记录位于忽略的 .verification/vibe-coding-20261008/services.json；本轮最终监听 PID 为后端 11864、前端 19328，操作前须重新确认归属，不终止未知进程。没有公开 URL。
