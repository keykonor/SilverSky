# WorkBuddy 端数据资产并入与互通约定

- 本轮目标：把 WorkBuddy 端 SilverSky 数据资产并入唯一事实源仓库，并建立双端口（Codex ↔ WorkBuddy）互通约定。
- 已完成：
  - 将 WorkBuddy 端 5 个 CSV（aircraft / vertiport_candidates / user_scenarios / competitors / feature_backlog）及 `DATA_DICTIONARY.md` 并入 `data/product-assets/`，统一为 UTF-8 无 BOM。
  - 新增 `docs/PORTAL_INTEGRATION.md`，约定双端口分工、数据资产规范、数据流向与互通规则。
  - 更新 `docs/WORKBUDDY_LINK.md`，将连接状态由"待连接"推进为"已连接"。
  - 更新 `README.md` 文档入口与 `docs/HANDOFF.md`。
- 修改文件：`data/product-assets/*`、`docs/PORTAL_INTEGRATION.md`、`docs/WORKBUDDY_LINK.md`、`docs/HANDOFF.md`、`README.md`。
- 关键决定与依据：仓库无 Git 远端，双向互通采用"两端口读写同一本地仓库目录 + 本地 git 提交"；产品 CSV 资产（`data/product-assets/`）与运行时 JSON 契约（`data/public/`、`data/simulated/`）分目录存放，互不混放。
- 验证结果：5 个 CSV 条数与 `DATA_DICTIONARY.md` 第 8 节一致（aircraft 6、vertiport 8、user_scenarios 8、competitors 8、feature_backlog 12），BOM 已去除。
- 未完成事项：双向创建可撤销测试任务做往返验收（已建 `docs/test-tasks/TEST-001-dual-portal-link.md`，待 Codex 端读取并回执）；如需跨机/云端同步再配置受控 Git 远端。
- 已完成（跟进）：`silversky-scenario-generator` skill 已对齐 19 列英文场景 schema（SKILL.md 与 generate.py 一致）。
- Blocker/风险：无 Git 远端，仅本机单仓库互通；两端同时编辑同一文件仍有冲突风险，须遵守写入边界。
- 下一步：在 Codex 端与 WorkBuddy 端各建一个可撤销测试任务，验证另一端可读任务与交接；必要时配置 Git 远端。
- 接手约束：项目状态以 `docs/PROJECT_STATE.md` 为准；遵守根目录 `AGENTS.md` 与 `docs/PORTAL_INTEGRATION.md`；数据以 `data/product-assets/DATA_DICTIONARY.md` 为准。
