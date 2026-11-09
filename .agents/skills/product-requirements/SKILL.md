---
name: product-requirements
description: 定义或澄清 SilverSky AI 的用户需求、MVP 范围、优先级和验收条件；当讨论功能取舍或产品承诺时使用，不用于具体技术实现或接口字段设计。
---

# Product Requirements

## 产品基线

目标用户是老年人及其子女。产品是 AI 驱动的低空综合出行规划智能体。首期天津、深圳；MVP 约 2 个月；地面数据为真实城市数据，低空数据为模拟数据。决策优先级为安全、舒适、可达性、时间、成本。

## 工作方式

1. 区分用户问题、MVP 必需能力、后续候选能力。把每项产品描述转换为用户故事、输入（Inputs）、状态（States）、输出（Outputs）、边界/失败情形（Edge Cases）、可观察验收条件（Acceptance Criteria）及明确不包含的范围。未知项保持待确认，不代替产品负责人作范围决定。
2. 需求涉及出行建议或真实/模拟数据时，用 `safety-data-integrity` 检查用户承诺和限制；不能把模拟可行性表述为真实运营可用性。
3. 影响阶段目标时更新 `docs/ROADMAP.md` 提案；影响既定范围或核心原则时在 `docs/DECISIONS.md` 提交待决项。
4. 将已确认需求交给 `implementation-strategy` 拆解，不在本 Skill 中决定框架、端点或 Agent 内部实现。

## 不负责

不因用户故事推断未授权的航空运营能力、真实航线可售性或安全保证；不负责代码审查。
