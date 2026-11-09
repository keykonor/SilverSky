# P01–P20 口语与短会话样例交接（2026-09-27）

## 本轮目标与完成内容

产品负责人给出 P01–P20 二十条输入及期望行为。本轮在现有 Sprint 1.5 工作区解释器基础上补齐已确认的口语识别、冲突状态和多轮合并行为，并新增定向测试。没有改动路线来源或真实/模拟边界；未启动 Sprint 2 UI。

- 识别“腿脚还行但走多了容易累”“身体挺好”“正常能走”“走不了太远”等行动描述；保留轮椅需求与少量自主步行并追问能力边界。
- 区分赶高铁、复诊但无当前不适与胸口剧痛/喘不上气；医疗急症仍停止普通规划并提示 120。安全与时间可并存，Safety 审查优先级未改。
- 保留“明天下午”时间窗口、五大道地点角色不确定、家里泛称位置、七十多岁模糊年龄；补充“明天上午十点”以及多轮中医院泛称到具体名称的更新。
- 对“不着急但二十分钟必须到”“不需要陪同但最好有人陪着”标冲突并暂停规划，待用户澄清。

## 修改文件与接口影响

`agent/interpreter.py`、`schemas/core.v0.1.schema.json`、`tests/agent/test_interpreter_p01_p20.py`、`docs/API_CONTRACTS.md`、`docs/INTERFACES.md`、`docs/DECISIONS.md`、`docs/PROJECT_STATE.md`、`docs/HANDOFF.md` 和本文件。Schema 只增补陪同冲突标识 `elderly_profile.assistance_requirement`；旧结果仍符合枚举。D-009 记录动机、兼容、回退及验证。未来前端需遵守 `planning_allowed:false`，显示 `follow_up_question`，并在下轮回传 `planning_state`。

## 关键决定与依据

地点泛称仍只表示用户说法，不能当成已核验出入口。非主偏好暂放在既有 `ElderlyProfile.preferences` 数组，主偏好在 `TripPreferences.focus`；排序和安全审查不受偏好覆盖。陪同冲突以结构化不确定项传播，以免布尔值误导 Safety。医疗症状仅在当前、非否定或非假设语境触发急症分流。

## 验证结果

`.venv/Scripts/python.exe -m pytest -q`：66 passed，1 条既有 TestClient/httpx 弃用警告。`.venv/Scripts/python.exe scripts/validate_contract.py`：通过。`git diff --check`：无空白错误，只有 Windows 换行提示。新增 13 个定向测试函数/参数实例覆盖 P01–P20 的关键断言；既有 53 项保持通过。未进行真实路线或 UI 验收。

## 未完成事项、Blocker 与风险

本地规则覆盖已测短语，不证明任意自然语言泛化。P14 的“深圳南山区”仍是范围模糊的地点候选，需问清起点角色和具体位置；P12 的“家里”需具体地址。时间优先不能弥补真实天气、无障碍、车辆和接驳证据缺失。天津大学、医院简称未自动映射为精确 POI；没有证据时仍返回零路线候选。真实低空运营仍为 `DATA_UNAVAILABLE`，模拟数据不得当作可乘坐服务。

## 下一步与接手约束

按 [PROJECT_STATE.md](../PROJECT_STATE.md) 继续 Sprint 1.5 交接与 Sprint 2 准备；产品负责人可用本文件和定向测试检查 P01–P20。若扩展到开放式语义模型，先处理 D-008 的隐私与服务决策。不得将技术测试通过写成真实出行推荐或 Sprint 2 已启动。
