# UX Reality Validation Report

## Scope

2026-11-07，SilverSky V3。使用本机 Chrome 桌面和公开地点输入核查用户截图中的 DeepSeek 报错、文字规划与现有地图路径。用户截图未包含输入原文。天津全城 Agent 单独复验。证据类别为 `AUTOMATED_EVIDENCE` 或 `REVIEWER_EVIDENCE`。

## Evidence

- 修复前，一次首页公开地点输入的 `/api/v2/interpret` 返回 200。另一次完整桌面流程重现用户截图的通用错误，停在路线方案之前。[首次成功响应](../evidence/2026-11-07-live-recheck/first-success.png) · [复现截图](../evidence/2026-11-07-live-recheck/before-retry-failure.png)
- 使用实际项目请求代码检查公开地点样本，DeepSeek 返回过 HTTP 500。账户的旧模型别名也曾返回 200，响应标记实际由 `deepseek-flash` 提供。直接调用 `deepseek-flash` 也出现过 HTTP 500，因此未把模型名称认定为本次报错原因。[官方错误说明](https://api-docs.deepseek.com/quick_start/error_codes/)
- 修改 `backend/v2.py`，让 500/502/503/504 在原有请求预算还充足时等待 0.5 秒并最多重试一次。仍失败返回脱敏提示并保留输入。增加 `tests/backend/test_v2.py` 三项回归，覆盖恢复、重试耗尽和 429 不重试。后端与 Agent 全量 160 项通过，核心契约及 5 份数据基线通过。
- 修复后，同一条此前失败的公开样本实际出现上游 500→200，总耗时约 17.84 秒，最后结果通过结构校验。另一轮完整桌面流程仍在第一次文字分析处收到服务异常提示，证明单次重试无法覆盖持续故障。[持续失败截图](../evidence/2026-11-07-live-recheck/chrome-failure.png)
- 天津全城模型在 Chrome 重新加载实际地形、建筑与底图，地图选点、约 1.7 公里模拟轨迹、越界清线、关闭后恢复单 Viewer 均通过。[运行报告](../evidence/2026-11-07-live-recheck/results.json) · [轨迹截图](../evidence/2026-11-07-live-recheck/tianjin-trajectory.png)

## User Flow

文字输入能到达真实后端和 DeepSeek。上游短暂 500 可自动恢复，持续故障在浏览器中显示具体提示并保留输入。另一条带出发时间与同行需求的桌面输入返回 HTTP 502 超时，原文保留。旧版“查找地面路线”实际手动选点成功，天津站至天津之眼显示高德驾车参考约 4.3 公里、17 分钟，期间 DeepSeek 分析请求为 0。[桌面路径结果](../evidence/2026-11-07-live-recheck/desktop-paths.json) · [旧版路线截图](../evidence/2026-11-07-live-recheck/legacy-ground.png)

## Elderly UX

本轮核对错误后的原文保留与可重试提示。老年目标用户的实际任务完成率为 `NOT_VERIFIED`。

## Reality Consistency

核对桌面地图使用公开道路和实际天津模型。示例 POI 与模型坐标作为出行参考，具体接送入口和运营条件仍需核实。

## Simulation Truth

全城 Agent 返回 `PARTIAL_PREVIEW`，示例有 60 个估计楼高格、25 个未知楼高格，场地和空域保持 `DATA_UNAVAILABLE`。浏览器显示模拟和缺口状态。

## 3D Utility

验证模型、点选、轨迹和视图恢复。2D 与 3D 的真人比较为 `NOT_VERIFIED`。

## Accessibility

桌面脚本通过可访问标签操作表单、错误提示和地图控件。真实读屏与原生放大为 `NOT_VERIFIED`，手机布局按 REQ-020 排除。

## Performance

实测一次上游 500 自动恢复约 17.84 秒。完整文字规划仍曾遇到连续上游故障。未做长测和并发压力测试。

## P0

已测范围未发现 P0。

## P1

DeepSeek 上游故障持续时，主入口文字规划会中断。局部恢复已验证，稳定性仍待验证。截图原始请求的具体原因未知。

## P2

错误提示已区分上游服务异常和其他结构化输出问题。既有整页对比度问题沿用此前记录，本轮未重新验收。

## P3

本轮未发现新的 P3。

## Unverified

用户截图原句、真人麦克风、真实读屏、长时稳定性与运营验证。

## Recommendation

同一文字样本重试一次后可恢复时继续规划。服务连续失败时保留文字，天津全城模拟 Agent 可直接从 3D 入口使用。地面路线可在旧版手动查找并选择两端。[旧版入口](http://127.0.0.1:5173/?legacy=1)

### Product UX

PARTIAL。上游连续异常仍会中断文字规划。

### Reality Consistency

PARTIAL。已测公开路线和模型信息有实际来源，实地条件未核验。

### 3D Utility

INCONCLUSIVE。桌面功能可用，缺真人对照。

### Accessibility

PARTIAL。已测桌面控件可操作，缺真实辅助技术证据。

### Safety

PASS。仅限本轮查看的模拟和数据缺口标记。
