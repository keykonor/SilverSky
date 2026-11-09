---
name: silver-sky-handoff-review
description: 审核 SilverSky 的专业开发、WorkBuddy、Reviewer 或 Sprint 交接文档；用于接收 docs/handoffs 中的交接并决定是否进入集成或验收。
---

# SilverSky 交接审查

读取交接文档及 `docs/PROJECT_STATE.md`、`docs/INTERFACES.md` 中相关部分，并核对文档引用的实际改动与验证证据。交接文字本身不能证明实现或验收成功。

逐项检查：任务目标和范围、修改文件、负责人或来源、接口变化及消费方、安全和数据来源影响、真实与模拟标记、验证命令与结果、未决事项、Blocker、下一步和接手约束。对于未写明的项目，标出证据缺口和受影响的决策，不自行补写成功结论。

有代码或配置变更时按 `code-change-verification` 审查关键差异及适当的运行证据；涉及出行安全和地图来源时按 `safety-data-integrity` 审查。跨模块冲突走 `agent-orchestration` 和 `api-contract`。只有交付物与退出门槛均有证据时，才建议更新 `docs/PROJECT_STATE.md` 为已验收。

输出应明确区分已核实、待核实、发现的问题和建议处理方。不要把“已提交”“测试通过”“已集成”和“Sprint PASS”混为同一状态，也不要复制密钥或私人出行信息到交接文件。
