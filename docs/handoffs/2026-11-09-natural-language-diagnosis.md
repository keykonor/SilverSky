# UX Reality Validation Report

## Scope

2026-11-09，SilverSky V3，REQ-026。检查文字输入不可用的原因并提出方案。范围为本机 Chrome 桌面、公开地点样本、DeepSeek 与高德，以及一次受控 HTTP 502。运行代码与环境配置沿用当前版本。

## Evidence

- 本地首页与代理 `/api/v2/status` 均返回 200。状态中的 DeepSeek 与高德布尔值只读取配置是否存在。
- Chrome 输入“我想从天津站去天津之眼。”，提交按钮可用。`interpret` HTTP 200，约 3.47 秒，两端各一个候选；`route` HTTP 200，路线和时间安排可见。[浏览器记录](../evidence/2026-11-09-natural-language/desktop.json) · [页面截图](../evidence/2026-11-09-natural-language/desktop.png)
- 诊断用项目的实际提取器，对当前配置 `deepseek-chat` 的简单和带时间需求的样本分别取得 200，模型报告由 `deepseek-flash` 提供，JSON 均通过 Schema。用官方当前名称 `deepseek-flash` 并关闭思考模式的单次对照也通过。两种名称的结果各属小样本，无法将此前 500 归因于模型名称。[上游记录](../evidence/2026-11-09-natural-language/upstream.json) · [DeepSeek 当前模型](https://api-docs.deepseek.com/quick_start/pricing/) · [思考模式配置](https://api-docs.deepseek.com/guides/thinking_mode/)
- 11 月 7 日曾复现相同提示，观测到 DeepSeek HTTP 500、分析超时和一次自动重试 500→200。HTTP 500 为供应方服务异常的返回，不能从本机确认供应商内部原因或用户每次遇到的具体情况。[此前实测](2026-11-07-live-use-recheck.md) · [DeepSeek 错误码](https://api-docs.deepseek.com/quick_start/error_codes/)
- 受控延迟及 502 时，提交后文字框和“手动选点”均禁用。错误返回后两者恢复，输入原文保留。[受控验证](../evidence/2026-11-09-natural-language/pending-ui.json)

## User Flow

输入 → `/api/v2/interpret` → DeepSeek 结构化提取 → 高德核实 → `/api/v2/route`。此前能确认的故障发生在 DeepSeek 返回阶段。当前真实样本走完全链。位置字段与原文不一致、结构校验失败和高德检索失败均有独立代码分支，本轮未在真实样本中观察到这些故障。

## Elderly UX

长时间等待时编辑与手动入口均禁用，容易被理解为整个功能卡住。受控测试验证了解锁，未做目标用户研究。

## Reality Consistency

实际路线来自高德；两个确认地点是 POI，入口、接送与无障碍仍需核验。

## Simulation Truth

本轮文字与地面路线诊断沿用既有模拟边界，未进行飞行功能验收。

## 3D Utility

本轮范围为文字解析和地面路线，3D 对照未验证。

## Accessibility

浏览器通过可访问标签填写和提交。辅助技术与手机布局未在本轮检查。

## Performance

真实桌面一次 `interpret` 约 3.47 秒。前端客户端 65 秒中止请求，后端 DeepSeek 请求使用 40 秒超时设置。读取超时是 HTTP 客户端的阶段限制，现有重试剩余时间检查不等于整个业务链的硬截止时间。

## P0

本轮已测范围未发现 P0。

## P1

自然语言必须等待 DeepSeek 返回才能确认地点。连续 5xx、超时或格式错误会阻断同一句话的规划，已有手动入口解决地面可用性，但用户需要重新输入两端。

## P2

“服务已连接”取自配置和本机连通状态。用户无法区分供应方失败、输出无效和地点查询失败的具体阶段。等待中缺少明确取消操作。

## P3

本轮未发现新增 P3。

## Unverified

原截图触发句子与原请求日志、供应商内部原因、长时稳定性、语音声学识别和未测句式。

## Recommendation

1. 实施本地明确句式提取作为文字规划的降级路径。识别“从 A 到 B”“从 A 去 B”等可精确切分的句式，输出仅限原文地点词。后端共享急症检查、地点校验和时间解析。用现有高德地点检索呈现候选，要求用户确认起终点，再复用既有路线接口。地点模糊或缺失时问清地点或切到手动选点。保留原文，区分本地提取与云端分析；需要扩展输出来源时先登记兼容契约。
2. 复杂表达继续由 DeepSeek 提取。给分析阶段设置独立总预算，以 8–10 秒为初始目标，按测量调整。在上游 5xx、超时或无效 JSON 时切入上述本地路径。补充可取消的等待状态。将官方模型名 `deepseek-flash` 与明确的非思考模式作为兼容性调整，先用一组正常、歧义和否定输入做对照。
3. 把诊断拆成连接、认证/余额/限流、供应方故障、输出结构、地点查询、路线六类。记录请求 ID、阶段、HTTP 状态、耗时和重试次数，保持用户原文及密钥不进入诊断日志。前端区分“本机服务已连接”和“文字分析暂不可用”。
4. 验收用正常、歧义、缺地点、急症和隐私安全样本。注入 500、超时、无效 JSON 时，明确句式仍能选点并查到真实路线；无法可靠提取时保留输入并请用户补全。高德失败时给出对应提示。正常云端流程和手动流程各跑一遍，验证旧响应晚到不会覆盖当前行程。

### Product UX

PARTIAL。真实样本成功，已证实的间歇性故障风险仍在，方案待实施。

### Reality Consistency

PASS，仅指本次样本的高德参考来源与展示。

### 3D Utility

INCONCLUSIVE。本轮未做对照。

### Accessibility

PARTIAL。标签操作实测，辅助技术未测。

### Safety

FAIL。本轮仅做文字规划故障诊断，证据不足以放行任何新的安全或运营行为；未发现实际安全故障。
