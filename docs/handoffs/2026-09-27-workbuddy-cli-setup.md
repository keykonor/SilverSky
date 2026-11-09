# WorkBuddy CLI 派工准备交接

- 本轮目标：让 Codex 可通过 WorkBuddy/CodeBuddy CLI 直接派发适合 WorkBuddy 的独立任务，支持同步推进。
- 已完成：确认桌面内置精简 CLI 缺少交互登录界面；按官方安装方式安装完整 CodeBuddy Code CLI v2.158.0；为 SilverSky 目录选择仅信任当前目录；启动中国站 OAuth 登录流程。
- 修改文件：本交接与 `docs/HANDOFF.md`。CLI 安装位于用户全局 npm 目录，仓库代码未因本轮变更。
- 关键决定与依据：只把来源核对、产品数据资产整理、需求池维护等有明确文件边界的任务交给 WorkBuddy；CodeBuddy CLI 不等于现有桌面会话，实际派工须先完成 CLI 授权和一次只读调用验证。
- 验证结果：`codebuddy --version` 返回 `2.158.0`；交互 CLI 已生成腾讯中国站登录页并等待账户授权。尚未完成模型调用或实际派工。
- 未完成事项：用户完成官方 OAuth 登录；Codex 验证只读调用并派发首个独立任务。
- Blocker/风险：登录需账户持有人在官方页面授权；仓库存在另一轮 Sprint 2 未提交修改，并行任务不得触碰这些文件。
- 下一步：登录完成后，先只读核对 WorkBuddy 能读取本仓库，再派发独立的产品数据来源核对任务，并检查交接证据。
- 接手约束：遵守 `AGENTS.md` 与 `docs/PORTAL_INTEGRATION.md`；不得读取或复制账号令牌；WorkBuddy 不修改当前 Sprint 2 代码、Schema、运行时数据或接口文档。
