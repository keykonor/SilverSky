# SilverSky Git 管理说明

建立日期：2026-10-08。仓库已有历史，本轮保留全部原有提交和分支，在此基础上建立当前开发入口与三版归档。

## 当前结构

```text
SilverSky/
  .git/                    唯一的 Git 对象库和历史
  .gitattributes            文本换行和二进制属性
  .gitignore               凭证、依赖和产物排除规则
  agent/ backend/ frontend/ 当前开发源码
  data/ schemas/ examples/  当前数据与契约
  docs/ tests/ scripts/     当前文档、测试和工具
  versions/
    README.md
    manifest.json
    v1-sprint1/             Sprint 1 + 1.5 的历史完整快照
    v2-sprint2/             Sprint 2 最终验收快照
    v3-sprint3/             Sprint 3 系列至 3.2 的历史完整快照
```

当前开发分支为 `main`；原 `master`、`codex/sprint2-webapp`、`sprint3` 均保留原指向。旧 `master` 是较早阶段分支，不能当作当前版本。三个带说明的标签为 `archive/v1-sprint1`、`archive/v2-sprint2`、`archive/v3-sprint3`，具体提交及历史边界见 [版本索引](../versions/README.md)。这些编号是归档分类，核心 HTTP/Schema 仍为 `0.1-proposal`，前端包版本也没有因目录编号调整。

当前未配置远端，因此版本管理仅保存在本机。远端地址、平台和可见性尚未指定；没有创建 GitHub 仓库或上传项目。选定远端后再配置 `origin` 并推送 `main` 和标签；不要直接推送所有历史分支。

## 日常开发

在项目根目录使用 Git。首次由用户提交前，设置自己的仓库身份：

```powershell
git config --local user.name "你的姓名"
git config --local user.email "你的提交邮箱"
git status --short --branch
git switch main
git switch -c codex/任务名称
```

本轮没有替用户设置姓名或邮箱；本轮提交和归档标签以临时命令配置的 `Codex <codex@local.invalid>` 标记自动化作者。

按明确文件范围提交，提交前查看差异并运行任务所需检查：

```powershell
git diff --check
git add -- 具体文件路径
git diff --cached --stat
git diff --cached
git commit -m "清晰描述本次改动"
```

合入 `main` 前仍须按 `AGENTS.md` 核对范围、接口、安全、验证和交接。可以快进时使用：

```powershell
git switch main
git merge --ff-only codex/任务名称
```

存在分叉或冲突时先审查再集成。归档目录与标签保持冻结，不将新开发改动写回历史目录；新增大版本时建立新归档并更新校验清单。

## 查看与运行历史版本

查看三个文件夹即可比较完整历史资料。需要根目录切换到历史代码时，先提交或妥善保存当前改动，再运行，例如：

```powershell
git switch -c codex/review-v2 archive/v2-sprint2
```

按该版 README 重建对应依赖和本地环境；归档不携带依赖或凭证。返回当前开发版使用 `git switch main`。旧版涉及的外部服务和历史数据可能已变化，历史验收不能替代重新运行验证。

## 仓库校验

```powershell
.\.venv\Scripts\python.exe scripts\verify_version_archives.py
.\.venv\Scripts\python.exe scripts\validate_contract.py
.\.venv\Scripts\python.exe scripts\verify_data_baseline.py
.\.venv\Scripts\python.exe -m pytest -q
git diff --check
git fsck --full
```

前端在 `frontend/` 运行 `npm test` 和 `npm run build`。根目录 `pytest.ini` 将默认发现限定为 `tests/`，避免收集归档中的历史测试。`.gitignore` 对嵌套目录同样排除依赖、缓存、构建产物和真实环境配置； `.env.example` 仍可跟踪。忽略规则不能代替提交前的差异检查。

本机已有的系统 pytest 临时目录和缓存曾返回权限错误。本轮使用独立临时目录完成全部回归；遇到同样环境问题时可运行：

```powershell
New-Item -ItemType Directory -Path .verification -Force | Out-Null
.\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider --basetemp=.verification/pytest-local
```

`.verification/` 由 Git 忽略，保存测试临时数据，不纳入历史版本。

`git fsck` 的 dangling 对象是尚无引用的旧 Git 对象，单独出现不表示历史损坏；本轮保留它们，没有清理或重写历史。

## 当前产品V3命名（2026-11-07）

用户将当前完整开发状态定义为SilverSky V3（3.0.0），见[版本定义](releases/v3.0.0.md)。这是当前产品版本，不改写versions/v3-sprint3及archive/v3-sprint3的历史归档编号；前端包根版本同步3.0.0，依赖锁定版本不变，HTTP/Schema仍保持兼容。

工作分支名codex/silversky-v2-mvp沿用开发历史；本轮没有替现有未提交成果创建提交或发布标签，旧HEAD不能被误称为完整V3快照。当前版本定义以根VERSION及PROJECT_STATE为准。
