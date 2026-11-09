# Git 正式管理与三版历史归档交接

日期：2026-10-08。当前产品状态以 [PROJECT_STATE.md](../PROJECT_STATE.md) 为准。本轮只整理本地 Git 管理和历史版本，未启动新 Sprint 或改变产品验收结论。

## 目标与授权

用户要求将整个项目正式纳入 Git，并把之前三个大版本分别放进对应文件夹。用户进一步确认：按 Sprint 1、2、3 归档，Sprint 1.5 纳入第 1 版，Sprint 3.1/3.2 纳入第 3 版，根目录继续保留当前开发版。

仓库原已存在 `.git` 和完整提交历史。没有重新初始化、删除、压缩或重写历史；没有创建远端或上传。

## 已完成内容与关键依据

1. 新增 `main` 当前开发分支，基于原 `sprint3` 的 `c7c2ebe`。原 `master=25ef3c2`、`codex/sprint2-webapp=a367c1f`、`sprint3=c7c2ebe` 保留原指向。
2. 查看并补存既有未跟踪截图 `docs/evidence/reality-first/ux/13-tianjin-3d-vertiport-detail.png`，提交 `9c776a9`；该提交不改产品代码。
3. 建立三份完整源提交快照及带说明的标签，文件不经过手工拼装：

| 目录 | 来源提交 | 标签 | 文件数 / 字节 |
| --- | --- | --- | --- |
| `versions/v1-sprint1/` | `bf237eb` | `archive/v1-sprint1` | 87 / 452731 |
| `versions/v2-sprint2/` | `95daf94` | `archive/v2-sprint2` | 99 / 1713696 |
| `versions/v3-sprint3/` | `9c776a9` | `archive/v3-sprint3` | 252 / 24044128 |

4. `versions/manifest.json` 保存完整提交、Git 树、标签、文件数、字节数及规范化导出 SHA-256；`scripts/verify_version_archives.py` 只读校验标签、树、清单和全部 438 个文件内容。固定 LF 导出，避免 Windows 换行设置影响归档。
5. 扩展 `.gitignore`，让嵌套版本目录中的依赖、产物、缓存、真实环境文件与私钥文件同样受忽略；`.env.example` 保留。新增 `.gitattributes` 和 `pytest.ini`，默认只收集根目录 `tests/`，避免历史测试重复发现或导入冲突。
6. 增补 [Git 管理说明](../GIT_MANAGEMENT.md)、[版本索引](../../versions/README.md)，更新 README、项目状态、D-018 决策及交接入口。

历史边界：Sprint 1.5 和早期 Sprint 2 Web App 共同提交于 `bf237eb`，因此第 1 版包含早期界面和当时 Sprint 2 状态。已在版本索引明确披露；不能把该提交解释为独立的 Sprint 1.5 验收树。第 3 版保留 Sprint 3 本地 Demo PASS、Sprint 3.1 G2 PARTIAL、Sprint 3.2 Reality Gate PARTIAL。

## 修改文件与接口、安全影响

新增：`.gitattributes`、`pytest.ini`、`scripts/verify_version_archives.py`、`docs/GIT_MANAGEMENT.md`、本交接、`docs/evidence/git-management/2026-10-08-audit.json`、`versions/README.md`、`versions/manifest.json` 和三版全部归档文件。

修改：`.gitignore`、`README.md`、`docs/PROJECT_STATE.md`、`docs/DECISIONS.md`、`docs/HANDOFF.md`。此前未跟踪的 UX 截图单独保存于 `9c776a9`。

运行源码、核心 Schema、公开/模拟数据文件及 HTTP 接口没有变更，因此未修改 `docs/INTERFACES.md` 和 `docs/ROADMAP.md`。目录版本号不改变 `0.1-proposal`。继续保持地面 `DOWNGRADE`、模拟低空 `REJECT`；归档不提升真实出行、无障碍、运营或公开部署承诺。

## 验证结果

| 检查 | 实际结果 |
| --- | --- |
| `scripts/verify_version_archives.py` | 三版全部通过，438 个文件逐一与规范化源导出一致 |
| `scripts/validate_contract.py` | 2 个样例、4 个解释用例、1 个时间窗口请求、9 个不安全路线变体、5 个数据集和1个不安全数据变体通过 |
| `scripts/verify_data_baseline.py` | 5 份 JSON 基线通过 |
| pytest，默认收集范围，专用临时目录 | **91 passed**，1 个既有 TestClient/httpx 弃用警告 |
| `frontend/` 的 `npm test` | **19 passed**，2 个测试文件 |
| `frontend/` 的 `npm run build` | TypeScript 与 Vite 生产构建通过 |
| 前端关键依赖与 lock 对照 | Vite、Vitest、TypeScript、React、Cesium 的已安装版本与 lock 一致 |

实际 Python 成功命令：先创建 `.verification/`，再运行 `.venv/Scripts/python.exe -m pytest -q -p no:cacheprovider --basetemp=.verification/git-archive-20261008-pytest -o faulthandler_timeout=60`。普通沙箱首次后端运行停滞后已终止；首次前端运行因 Vitest `realpath` 权限 EPERM 未执行测试。提升到本机权限后，Python 曾有 80 passed / 11 fixture errors，原因是既有系统临时目录/缓存权限；改用独立目录并创建父目录后全部通过。未修改产品代码来绕过失败。

Git 写入因 `.git` 在普通沙箱只读，按本轮已授权范围使用提升权限完成。未给用户配置个人 Git 身份，本轮自动化提交和标签使用命令级 `Codex <codex@local.invalid>`，日常身份配置方法见管理说明。

## 项目资料审计

开工先用 `git ls-files`、`git ls-files --others --exclude-standard` 和 `rg --files --hidden` 盘点：251 个已跟踪内容文件、1 张非忽略未跟踪截图，共 252 个；覆盖项目文档、13 份 Skill/参考文件、源码、配置、Schema、数据、样例、测试、交接和证据。另盘点 Git 忽略目录，识别 `.env`、虚拟环境、node_modules、构建和缓存；没有读取真实 `.env` 值。`.git` 内部历史单独使用 `git fsck` 检查。

本轮结束前再次盘点全部已跟踪和非忽略未跟踪内容文件；机器可读清单、分类计数、忽略规则探针和静态检查见 [审计记录](../evidence/git-management/2026-10-08-audit.json)。该清单记录提交前状态，不能把其中的未跟踪标记误读为最终未提交。

结束盘点共 **698 个内容文件**（提交前 252 已跟踪、446 新文件）；其中 `versions/` 为 440 个文件（438 个快照文件及 2 个索引/清单）。解析了其余 102 份 JSON，核查变更文档中的 80 个本地链接、12 项忽略/保留探针；均通过。默认 pytest 收集 91 项且没有历史归档测试。`git diff --check` 和 `git fsck --full` 通过；fsck 报告 52 个既有 dangling 对象，已保留，没有对象损坏报告。三个原分支指向保持不变，归档中没有嵌套 `.git`。

提交前核对 451 个暂存变更文件，并通过 Git 对象批量读取确认全部 438 个暂存归档文件与已经过来源校验的磁盘内容逐字节一致；`git diff --cached --check` 通过。`.gitattributes` 对自动识别的文本统一 LF，包含环境模板和 SHA-256 清单，避免再次检出时的换行漂移。

核查方法：阅读四份主项目文档及实施、代码验证、安全 Skill；核对源提交历史和验收文档；对三版 438 个文件逐字节比较，检查敏感文件名及候选版本文本中的凭证特征（两处匹配均为环境变量引用）；核对当前运行源码和数据无差异；检查新增文档链接、JSON 格式、嵌套忽略规则、默认 pytest 发现、Git 空白错误、对象完整性和原分支指向。目视检查了补存的一张截图。

没有逐文件人工审阅所有历史文档、截图、源码或依赖内部实现；没有重跑历史版本的独立运行环境、浏览器/地图、在线服务、真人或屏幕阅读器验收。内容一致性检查不等于产品正确性完整审查；凭证特征扫描也不是对全部历史对象的完整密钥审计。

### 发现的问题

1. `versions/v1-sprint1/` 的来源 `bf237eb`：Sprint 1.5 与早期 Sprint 2 界面在同一历史提交；影响是无法取得纯独立 Sprint 1.5 已提交树。状态：**已披露并保留完整历史**，不伪造提交。
2. `docs/evidence/reality-first/ux/13-tianjin-3d-vertiport-detail.png`：开工时未跟踪，可能随文件夹复制或交接丢失。状态：**已保存于 `9c776a9` 并纳入第 3 版**。
3. Git 远端配置：开工及结束整理时均未配置，用户未提供目标平台/地址/可见性。影响是本地设备丢失时没有远端备份。状态：**未配置，后续由用户指定**；不属于本地整理失败。
4. 本机既有 pytest 临时目录/缓存与沙箱 Vitest 路径：存在权限问题，影响直接使用原环境命令。状态：**本轮用独立临时目录及本机权限完成验证，保留原目录，管理文档提供替代命令**；未声称原命令环境已修复。
5. `docs/PROJECT_STATE.md`：真实用户、Narrator、现实入口/无障碍、D-008/D-013 和可选在线图层证据仍不完整。状态：**继承原待验证/待决**；本轮不扩展范围处理，不改判 PASS。

在本轮已检查范围内，未发现新增的源码/接口改变、数据基线漂移、归档内容缺失或模拟冒充真实问题；以上未决和证据缺口不归为通过。

## 未完成事项、下一步与接手约束

本地版本整理已完成；最终提交可通过 `git log -1 --oneline main` 定位。需要远端备份时，先确定仓库平台、地址和可见性，再配置推送；不要擅自公开项目或上传凭证。继续开发使用根目录和 `main`/`codex/` 分支；历史目录冻结，仅供查看与比较。不要覆盖归档标签、重写原历史或把老目录中的 PROJECT_STATE 当作当前状态。

继续产品工作时按根目录 `docs/PROJECT_STATE.md` 的原下一步推进：真人与屏幕阅读器、入口/接送/无障碍证据；Sprint 4 与公网部署依原决策门槛另行决定。完成新代码改动后重复相关验证和交接，不能把本轮仓库回归替代产品验收。
