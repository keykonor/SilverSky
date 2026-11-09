# 核心数据契约 v0.1

状态：**v0.1 提案已在 Backend、运行时 Agent、两城 HTTP 链路和 Sprint 2 前端消费链路中本地技术验证；Sprint 2 最终独立 Contract/Product Review 均 PASS**。Sprint 3 V-001 只在前端派生三维显示，不改本 HTTP 契约。机器可读定义为 [`schemas/core.v0.1.schema.json`](../schemas/core.v0.1.schema.json)，使用 JSON Schema 2020-12。该文件根对象校验 `PlanningResult`；单独的 `UserRequest`、`TextInterpretRequest`、`InterpretationResult` 和其他类型位于 `$defs`。最小有效结构见[请求样例](../examples/user-request.v0.1.json)和[结果样例](../examples/planning-result.v0.1.json)；两者均为**纯契约样例，没有真实地面数据，不可用于出行**。

## 请求与用户条件

| 对象 | 字段与语义 |
| --- | --- |
| `UserRequest` | `origin`、`destination` 为用户地点描述；`departure_time` 为带时区的 RFC 3339 时间。仅有“明天下午”时为 `null`，须同时给 `departure_window` 的起止时间及 `AFTERNOON` 精度；不得把时间范围伪装成精确时刻。可选 `city`。`urgency` 支持 `NORMAL` / `TIME_SENSITIVE` / `URGENT_TRAVEL` / `MEDICAL_EMERGENCY` / `UNKNOWN`；旧 `URGENT` 暂保留输入兼容。`elderly_profile` 和 `preferences` 必填 |
| `TextInterpretRequest` | 原有 `text`、带时区的 `reference_time` 必填；可选 `planning_state` 为客户端回传的当前规划会话状态，不引入服务端长期记忆 |
| `InterpretationResult` | 原有 `user_request`、`needs_summary`、`missing_fields`、`assumptions` 保留；新增 `structured_intent`、`planning_state`、`uncertain_fields`、`follow_up_question`、`planning_allowed` 和 `interpretation_summary`。缺必填槽位或医疗急症时 `user_request:null`；仅追问缺失或明显不确定内容。`needs_summary` 为旧契约名，`interpretation_summary` 为同义输出 |
| `ElderlyProfile` | `age` 可未知；解释器标准输出 `NORMAL` / `MODERATE` / `LIMITED` / `ASSISTED` / `WHEELCHAIR` / `UNKNOWN`；旧 `INDEPENDENT` 暂保留输入兼容。步行、轮椅、陪同约束未知用 `null`。不得推断医疗诊断 |
| `TripPreferences` | 解释器标准输出 `SAFETY_COMFORT` / `TIME` / `LESS_WALKING` / `FEWER_TRANSFERS` / `LOW_COST` / `BALANCED`；旧 `FASTEST` / `ECONOMICAL` 暂保留输入兼容。`air_option` 仅表示模拟低空展示意愿；偏好不改变安全优先级 |

P01–P20 口语验收补充：`ElderlyProfile.preferences` 暂存非主偏好（如少换乘同时少步行），`TripPreferences.focus` 保留主偏好；排序始终受 Safety 审查约束。轮椅使用与少量自主步行可同时成立，解释器保留 `wheelchair_requirement:true` 并在能力不清时追问。`planning_state.pending_clarifications` 和 `InterpretationResult.uncertain_fields` 增补 `elderly_profile.assistance_requirement`；陪同语义冲突时值为 `null`、`planning_allowed:false`，待用户澄清。`家里` 等泛称不得升级为精确位置，需在 `uncertain_fields` 标记 `origin`。

Sprint 2 前端消费补充：短会话中已知具体目的地且只缺起点时，对服务端上一轮起点追问的单地点回答可填充起点；无上下文的地点或“医院”“家里”“深圳南山区”等泛称仍待澄清。明确提及父母且未提供行动情况的本次规划，在 `pending_clarifications` 保留 `elderly_profile.mobility`，核心地点/时间补齐后再问行动情况。前端不另写追问规则，始终以返回字段为准；接口字段和版本保持不变。

地点可先用 `label` 表达，坐标可选；提供坐标时使用 `longitude`、`latitude` 数值。解释器须保留“附近”等位置模糊性，不能将其静默改写为精确出发点。Sprint 1 已登记 POI 的 OSM 中心点只可作为驾驶估算代理点，须在输出中说明其不是实际门到门路线；用户显式提供而与缓存不一致的坐标不能静默替换，无法计算时返回无候选及原因。地理编码必须保留来源。涉及城市范围限制的校验待数据源确定。

地图交换的 GeoJSON 提案遵循 [RFC 7946](https://www.rfc-editor.org/rfc/rfc7946.html)：坐标顺序为经度、纬度，可选第三维为相对 WGS 84 椭球的高度（米）。缺失高度不能推断飞行高度；Cesium 3D 空中线须有明确高度来源或模拟依据。`LocationRef` 的坐标对象用于结构化请求，与 GeoJSON 数组表达不同。

## 结果与安全审查

| 对象 | 字段与语义 |
| --- | --- |
| `PlanningResult` | `schema_version`、规范化 `user_request`、需求摘要、`route_options` 和警告；无足够可靠候选时列表可以为空 |
| `RouteOption` | ID、`GROUND_ONLY` / `GROUND_AIR_GROUND`、`RECOMMENDED` / `SAFETY_COMFORT` / `FASTEST` / `ECONOMICAL` / `SIMULATED_SCENARIO` / `UNRANKED` 展示标签、时间分钟、步行米数、换乘次数、人民币估算成本、总体风险、0–100 舒适分、汇总来源状态、路段、安全审查与解释；未知数值写 `null` |
| `Segment` | `WALK` / `CAR` / `SHUTTLE` / `AIR` / `WAIT`，起终点、距离米数、时长分钟和来源证据；`AIR` 段在 MVP 只允许 `SIMULATED_DATA` 或 `DATA_UNAVAILABLE` |
| `RiskAssessment` | 天气、行动能力、换乘、运营、数据不确定性五类风险；`review_outcome` 为 `PASS` / `DOWNGRADE` / `REJECT` / `UNKNOWN`；至少一个理由。任一风险为 `HIGH` 或 `UNKNOWN` 时不得 `PASS`。Safety 只审查候选，不创建新路线 |
| `DataStatus` | `VERIFIED` / `PUBLIC_DATA` / `SIMULATED_DATA` / `DATA_UNAVAILABLE`，含义与汇总顺序见 [DATA_POLICY.md](DATA_POLICY.md) |

`SourceEvidence` 对有效数据需 `source_ref` 和 `observed_at`；对不可用数据需 `unavailable_reason`。Schema 强制 AIR 仅为模拟或不可用、地面路线不能含 AIR 段、模拟候选带显著展示标签且不能标为 `RECOMMENDED`、`RECOMMENDED` 必须有通过的安全审查、路线级 `SIMULATED_DATA` 或 `DATA_UNAVAILABLE` 不得获得 `PASS`，路段模拟或不可用状态不能被路线级状态美化。Schema 尚不能证明路线总时长等于各段合计、所有状态汇总完全正确、风险排序、位置相接、时间有效性，以及模拟路线在文字说明中不得当成真实可执行建议；这些需要后续语义校验和验收案例。

## 跨模块确认事项

1. 前端与后端确认请求缺项时返回澄清信息的结构，以及报告是否另用契约。
2. 后端与 Agent 确认候选生成、Safety Review 和降级时的错误/未知语义。
3. Agent 与 MCP 负责人确认 `source_ref` 如何指向数据登记记录，以及工具输入/输出 Schema。
4. GeoJSON 展示确认 WGS84 坐标、线路高度单位及来源状态如何附在 Feature 属性上；3D 展示不能覆盖 `DATA_UNAVAILABLE`。

评审结果更新 [INTERFACES.md](INTERFACES.md)；破坏性变更按 [DECISIONS.md](DECISIONS.md) 流程处理。

## Sprint 1 HTTP 边界

`GET /health` 返回服务状态。`POST /api/v1/interpret` 输入 `TextInterpretRequest`、输出 `InterpretationResult`；缺少日期或地点时返回待补充字段，不暗填真实值。`POST /api/v1/plan` 输入完整 `UserRequest`、输出 `PlanningResult`，最多三个方案。两个 POST 的正常响应严格按本 Schema 校验；HTTP 错误结构沿用 FastAPI 常规错误，具体错误示例在集成时补充。首次闭环经由两次调用完成自然语言到规划结果；客户端可以在收到 `user_request:null` 时提示补充信息。

## Sprint 2 D-011 增量契约

`LocationRef` 可选 `canonical_poi_id`、`entity_precision` 和 `entrance_verified`。两城 Golden 输出中的公开 POI 坐标标为 `POI` 且 `entrance_verified:false`，只能解释为对象中心点。`UserRequest` 中原始用户地点标签继续保留，规划结果中的路段端点使用 canonical POI 名称和中心坐标；用户显式给出的不同坐标仍拒绝静默替换。

`Segment` 可选 `geometry`、`geometry_status`、`geometry_evidence`，三者必须同时出现。`geometry` 为二维 GeoJSON `LineString`，坐标 `[经度, 纬度]`；不推断高度。`PUBLIC_ROUTE_SNAPSHOT` 配 `PUBLIC_DATA` 几何证据，表示 OSRM 基于 OSM 的静态道路模型快照；`STRAIGHT_REFERENCE_LINE` 和 `SIMULATED_AIR_CORRIDOR` 配 `SIMULATED_DATA` 几何证据。原 `evidence` 继续描述路段距离/时长等业务数据，和几何证据独立。接驳段可以是 `evidence:DATA_UNAVAILABLE` 同时具备模拟参考线，不能由该线推断接驳距离/时间。缺少几何时允许旧响应，前端展示不可绘制说明。

数据集新增 `GOLDEN_ALIAS_REGISTRY`，只支持带城市或场景上下文的唯一别名映射至 canonical POI；`家里` 等泛称不可映射。地面快照可选 `geometry` 与 `geometry_captured_at`；模拟低空场景可选两个 `simulated_vertiports` 对象，均强制 `SIMULATED_DATA`、`coordinate_is_synthetic:true`。旧 `vertiport_a/b` 标签保留。受控别名、地面几何和虚构坐标仅覆盖 TJ-001 与 SZ-001。验证见 `tests/integration/test_d011_golden_geometry.py`、Chrome E2E 和 `scripts/validate_contract.py`。

## Sprint 1 本地数据文件契约

[`schemas/datasets.v0.1.schema.json`](../schemas/datasets.v0.1.schema.json) 验证四类只读文件：`PUBLIC_POIS`、`GROUND_ROUTE_SNAPSHOTS`、`SIMULATED_AIR_SCENARIOS`、`GOLDEN_ALIAS_REGISTRY`。POI 名称/地址由机构或政府原始页面核实；坐标取 OSM 对象中心点，`coordinate_kind` 明示**不是入口**；路线距离/时长为 OSRM 一次性驾驶路线快照，非实时道路、交通、无障碍或实际接送承诺。D-011 为两城补入静态道路几何和虚构起降点坐标；原始模拟标签仍在。`PUBLIC_DATA` 仅表示有公开来源，不能升级为 `VERIFIED`。每个文件记录来源/版权、抓取时间、城市或场景以及数据状态。模拟空中场景不提供可运营航线、价格或真实天气。
