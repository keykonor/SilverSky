# Sprint 3 Skill 基线审计（2026-09-28）

## Existing Skills

仓库原有六个项目 Skill：`product-requirements`、`implementation-strategy`、`agent-orchestration`、`api-contract`、`safety-data-integrity`、`code-change-verification`。本机原有系统 `skill-installer`、`skill-creator`，以及 Word 文档专用的 `documents:documents`。六个项目 Skill 的正文各有一份，位于 `.agents/skills/`。

## Missing Capabilities

Sprint 3 地图几何、坐标、3D 场景与交接证据审查没有专门的项目级 Skill。关联对话的预览在自定义 Skill 01 中途截断，当前工具没有读取该 ChatGPT 对话全文的入口，后续名单待核。

## Recommended Additions

已从 OpenAI 官方仓库安装 `gh-address-comments`，并创建 `silver-sky-geospatial-review` 与 `silver-sky-handoff-review`。旧对话指定的 `doc` 与 `create-plan` 当前官方路径已不存在；Markdown 交接与 Sprint 拆解优先复用项目既有 Skill，不创建功能重叠的副本。安装详情见 [`AGENT_SKILL_REGISTRY.md`](../AGENT_SKILL_REGISTRY.md)。

## Conflicts

`doc` 的原对话用途是 Markdown 项目文档，而本机 `documents:documents` 处理 Word 文档，不能当作同一个 Skill。`create-plan` 与项目现有实施方案、协调 Skill 在功能上重叠；直接复制旧版本会增加路由歧义。官方列表 API 返回 403，因此逐个用官方 Git 仓库路径核验；`gh-address-comments` 成功安装，其余两个路径返回不存在。
