# 本地开发与开发 Agent 边界

目标是让已有 MVP 稳定运行、可以验证和交接。本文件不批准新产品功能、生产部署或新基础设施。产品运行时角色见 [AGENT_ARCHITECTURE.md](AGENT_ARCHITECTURE.md)，开发 Agent 的职责如下。

## 一次任务的最小流程

1. 先读根目录 AGENTS.md 和 PROJECT_STATE.md。在[需求台账](requirements/README.md)追加用户请求，关联已有需求或建立验收项。
2. 写明正常输入、缺失/错误输入、输出和验收条件；确认现有功能能否满足。
3. 指定负责人、允许写入的具体文件和依赖方。涉及接口时先读 INTERFACES.md 和 schemas/README.md；重大变更遵循 AGENTS.md 的确认门槛。
4. 完成最小修改，运行 README 中与改动相关的检查。普通任务无需启动多个 Agent。
5. 检查 diff、密钥和文档一致性，记录实际结果、问题和未测范围，完成交接。小步提交；历史目录保持冻结，回退见 GIT_MANAGEMENT.md。

## 分工与文件写入边界

以下是默认分工，具体任务必须进一步列出文件；路径范围不是无条件修改授权。跨目录改动先由集成负责人分配，禁止两个 Agent 同时写一个文件。

| 开发角色 | 可分配的写入范围 | 依赖与限制 |
| --- | --- | --- |
| 集成负责人 | 根目录配置与说明、项目级 docs、schemas、frontend/src/types/contracts.ts、依赖锁文件 | 统一维护需求台账、状态和跨模块契约；不静默批准待决项 |
| Backend | backend/，分配给自己的后端测试 | 依赖已确定的契约；不独自修改 Schema、前端类型或数据事实 |
| 运行时 Agent 开发 | agent/，分配给自己的 Agent 测试 | 使用既有输入/输出；Safety 审查候选，不创造路线 |
| Frontend | frontend/src/App.tsx、App.css、api/client.ts、components/DirectGroundPlanner.tsx 及分配的界面测试 | contracts.ts 和地图组件由相应负责人持有；App 等入口文件单独指定唯一写入者 |
| Map | frontend/src/components/AmapRouteMap.tsx、RouteMap.tsx、RouteMap.css、RouteMap.test.ts 及分配的地图测试 | 不同时修改前端入口、DirectGroundPlanner.tsx、规划逻辑或坐标协议；来源/坐标/失败降级须验证 |
| Data | 明确分配的数据、样例和来源说明 | 不改 Schema；不能把模拟升级为真实，不能猜测入口、时刻、价格或无障碍事实 |
| QA / Reviewer | 默认只读；需要新增测试时单独分配测试文件和证据目录 | 不通过删测试或弱化断言使错误实现通过；结果区分 PASS、PARTIAL、未验证 |

共享文件（Schema、基线清单、contracts.ts、INTERFACES.md、PROJECT_STATE.md、DECISIONS.md、需求台账、依赖锁）同一时段只有集成负责人或其明确指定的一位写入者。tests/ 不是共享可任意写区域，测试也按文件分配。各 Agent 使用独立命名的交接文件；总入口和状态由集成负责人统一更新。

发生冲突时停止冲突文件的写入/合并，记录影响并由负责人裁决。未分配的工作不主动扩展；尚未定义的接口先提案，不让不同 Agent 各自猜字段。

## 可复制的任务卡

```text
任务 / 需求 ID：
负责人：待分配
目标与不在范围内的内容：
用户输入 / 缺失或错误输入：
预期输出 / 状态变化：
允许写入的具体文件：
只读文件 / 禁止修改范围：
依赖方 / 已确认的契约版本：
验收条件 / 应运行的命令：
数据来源 / 模拟标记 / 降级行为：
交接文件路径：
风险 / 回退方式：
```

## 完成条件

- 能从需求 ID 找到来源、验收和修改文件；待确认事项没有被写成已完成。
- 新功能有与风险匹配的测试；错误输入、无数据和上游失败有明确行为。
- 契约基线和相关验证通过；没有真实密钥、私人数据或临时产物进入提交。
- README 的启动步骤仍可用；重要成果更新 PROJECT_STATE.md，交接记录实际检查和使用入口。
- 没有改动 versions/ 中的历史快照，也没有覆盖其他人的未提交工作。

## 还应提前准备什么

| 准备 | 本仓库入口 / 当前边界 |
| --- | --- |
| 可复现环境和启动说明 | 根 README；requirements.txt、frontend/package-lock.json；不为整理文档升级依赖 |
| 需求与验收追溯 | requirements/；用户新请求逐条追加，取消/纠正也保留历史 |
| 统一数据契约 | schemas/README.md、BASELINE.json、INTERFACES.md；先固定现状再做受控变更 |
| Golden 与异常样例 | examples/、tests/、frontend/tests/；日期夹具不是用户真实信息，模拟路线不可预订 |
| 故障定位 | 先保存复现步骤、输入类别和实际错误；不记录密钥或个人行程，不盲目重试在线服务 |
| 小步 Git 与回退 | GIT_MANAGEMENT.md；本地历史已有，远端尚未配置 |
| 可交接的证据 | HANDOFF.md；把实际测试、未验证范围和 Blocker 写清楚 |

公开上线前还需处理 D-013 的托管/域名、地图授权和许可、生产代理、配额及失败降级；实际用户/读屏测试仍待补。本地V2 DeepSeek和个人出行信息边界遵循用户REQ-012及D-019；其他供应方或持久化范围仍须另行决策。这些是发布前待办，不表示本轮已部署、已采购服务或已通过真实用户验收。
