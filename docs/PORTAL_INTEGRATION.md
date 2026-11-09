# SilverSky 双端口协作与互通约定

> 更新日期：2026-09-27 · 版本 v0.2（约定：WorkBuddy 所有产出的唯一落点为仓库目录）

SilverSky 由两个 AI 工作端口并行推进，本文约定两端的定位、唯一事实源、数据流向与交接规则，保证任务与数据在两端口互通、不冲突。

## 1. 两个端口

| 端口 | 工具 | 定位 | 主要产出 |
| --- | --- | --- | --- |
| Codex 端口 | OpenAI Codex / ChatGPT 桌面端 | 技术实现主体 | 后端、Agent、Schema、运行时数据契约、验收与演示 |
| WorkBuddy 端口 | WorkBuddy | 产品与数据资产主体 | 飞行器资料、候选起降点、用户场景库、竞品研究、需求池 |

两端口**不是**两个并行分支，而是同一项目上的**不同职责**：Codex 负责"怎么做"，WorkBuddy 负责"给什么数据/给什么需求"。

## 2. 唯一事实源

项目唯一事实源是 Codex 侧的 Git 仓库：

```
C:\Users\17154\Documents\ChatGPT\SilverSky
```

所有项目文件（代码、文档、数据资产）以该仓库为准。**WorkBuddy 端口产生的所有文件与数据（数据资产、场景、需求、报告、脚本等）一律直接写入本仓库对应目录并提交 git，不另设工作区副本**；WorkBuddy 会话工作区仅作为临时执行环境，不存放 SilverSky 数据。Codex 端口读取同一目录。

## 3. 数据资产规范

产品/运营数据资产统一存放于：

```
data/product-assets/
```

| 文件 | 内容 | 维护方 |
| --- | --- | --- |
| `DATA_DICTIONARY.md` | 数据字典与全部字段/枚举/规则（**唯一权威**） | WorkBuddy |
| `aircraft.csv` | 低空载人飞行器基础资料 | WorkBuddy |
| `vertiport_candidates.csv` | 天津/深圳候选起降点 | WorkBuddy |
| `user_scenarios.csv` | 用户场景库 | WorkBuddy |
| `competitors.csv` | 产品与产业竞品研究 | WorkBuddy |
| `feature_backlog.csv` | 产品需求池 | WorkBuddy |

格式硬约束（与 `DATA_DICTIONARY.md` 一致）：UTF-8 **无 BOM**、逗号分隔、枚举大写加下划线、无法确认填 `DATA_UNAVAILABLE`、四态（`VERIFIED`/`PUBLIC_DATA`/`SIMULATED_DATA`/`DATA_UNAVAILABLE`）严格分离。

> 与运行时数据契约的边界：`data/public/`、`data/simulated/` 是后端 Agent 用的 JSON/GeoJSON 运行时契约（见 `schemas/datasets.v0.1.schema.json`），由 Codex 维护；`data/product-assets/` 是产品/运营 CSV 资产，由 WorkBuddy 维护。两者语义不同，不要混放。

## 4. 数据流向与交接

```
WorkBuddy 产出/更新任何文件与数据（一律落在仓库目录内）
        │  数据资产写入 data/product-assets/（遵守数据字典）；其余按类型写入对应目录
        ▼
git 提交（附清晰 commit message）
        │
        ▼
Codex 读取同一仓库目录，用于 Agent 测试、Demo、需求排期
```

反向：Codex 在实现中发现数据缺口或新需求，写入 `docs/` 交接文档或在 `feature_backlog.csv` 登记，WorkBuddy 跟进补全。

## 5. 互通规则

1. **状态唯一**：项目状态只以 `docs/PROJECT_STATE.md` 为准，两端口都只更新这一份，不各自维护状态。
2. **交接唯一**：每轮有实质工作的进程结束前，按 `AGENTS.md` 在 `docs/handoffs/` 建交接文档并更新 `docs/HANDOFF.md`；两端口都能据此接续。
3. **决策唯一**：重大决定记录在 `docs/DECISIONS.md`，接口变化记录在 `docs/INTERFACES.md`。
4. **数据不编造**：两端口都遵守 `DATA_DICTIONARY.md` 的四态与"不编造"规则，模拟数据必须显式标注。
5. **不并行改同一文件**：同一核心 Schema、同一 CSV、同一状态文档，禁止两端口同时修改；先到先得，后到方在交接文档中说明。

## 6. 协作红线（沿用 AGENTS.md）

安全优先级 `安全 > 舒适 > 可达性 > 时间 > 成本` 不变；不把模拟数据伪装成真实航空运营信息；不扩大 MVP 范围；医疗急救场景只做转运协同、不做医疗处置。详见根目录 `AGENTS.md` 与 `.agents/skills/`。
