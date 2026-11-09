# Codex 与 WorkBuddy 协作入口（已连接）

本仓库是 SilverSky 的项目文件来源，也是双端口唯一事实源。WorkBuddy 端已接入：其产品/运营数据资产已并入本仓库 `data/product-assets/`，两端读写同一本地仓库目录。

## 连接状态

- **Codex 端口**：技术实现主体，项目目录 `C:\Users\17154\Documents\ChatGPT\SilverSky`（已在 Codex 注册为 trusted）。
- **WorkBuddy 端口**：产品与数据资产主体，工作区位于 `C:\Users\17154\WorkBuddy\...`；数据资产统一落入本仓库 `data/product-assets/`。
- **传输方式**：本仓库当前**无 Git 远端**，双向互通靠两端口读写同一本地仓库目录 + 本地 git 提交实现。如需多机/云端同步，再配置受控 Git 远端。

## 互通规则

两端均读取根目录 `AGENTS.md`、`docs/PROJECT_STATE.md`、`docs/HANDOFF.md`，每轮工作结束更新交接；并行任务划定文件写入边界，避免同时编辑核心 Schema、同一 CSV 或同一状态文档。详细分工、数据资产规范与数据流向见 [PORTAL_INTEGRATION.md](PORTAL_INTEGRATION.md)。

## 验收连接

2026-09-27 本机同仓库双向任务与交接读写已通过往返验证：Codex 对 WorkBuddy 发起的任务回执提交为 `3eb37c9`；WorkBuddy 对 Codex 发起、测试码为 `SILVERSKY-CW-7F3A91` 的任务回执提交为 `cafc90f`。临时任务按约定清理，证据保留在 Git 历史和本轮交接。此验收仅覆盖同一本地仓库的读写；没有验证自动通知、实时同步或跨机器传输。
