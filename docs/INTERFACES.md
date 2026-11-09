# SilverSky AI 跨模块接口索引

状态：Sprint 1 HTTP、进程内 Agent 调用和本地数据文件按 [v0.1 提案](API_CONTRACTS.md)、[核心 Schema](../schemas/core.v0.1.schema.json)与[数据集 Schema](../schemas/datasets.v0.1.schema.json)实现，并经两城 HTTP 集成测试与契约校验标为“技术已验证”。Sprint 2 D-011 可选地点精度与线路几何契约已实施、两城浏览器验证，并获最终独立 Contract Review PASS。Sprint 3 V-001 为已确认可视化派生契约，实施/验证见项目状态。MCP 工具名称和协议仍待定义。

## 模块边界

Sprint 2 前端消费边界（D-010、D-011，本地代码集成已验证）：前端 `src/api/` 统一调用现有 `GET /health`、`POST /api/v1/interpret`、`POST /api/v1/plan`。`interpret` 请求发送非空 `text` 和带时区 `reference_time`，若有上一轮则附 `planning_state`；响应直接替换本地状态，仅在 `planning_allowed:true` 且 `user_request` 非空、非 `MEDICAL_EMERGENCY` 时送入 `plan`。解释结果中的 `missing_fields`、`uncertain_fields`、`follow_up_question` 是唯一追问依据。刷新或“重新规划”可丢弃内存状态。HTTP 422/500 与网络错误由界面显示友好状态，不推断新路线。地图使用 `LocationRef.coordinate` 绘标记，仅使用 `Segment.geometry` 绘线路；缺失几何时显示原因。前端类型与 `$defs` 保持一致；本地验证见 `frontend/tests/e2e.mjs`、`frontend/src/App.test.tsx` 和项目状态记录。

Sprint 2 指定三轮演示的解释器衔接：上一轮已有具体目的地且只缺起点、服务端已追问起点时，下一轮仅包含单个明确地点名的回答可作为该缺失起点；若目的地仍为“医院”等泛称，或回答仅为“家里”“深圳南山区”等范围/泛称，则继续保留 `location_candidate` 并追问角色与具体位置。该规则只在服务端解释器执行，前端仍完全遵从返回的 `missing_fields`、`uncertain_fields` 和 `follow_up_question`；不新增字段或让客户端自行猜测。

对明确提及“我父亲/我母亲/我爸/我妈”且未给行动情况的本次规划，解释器在现有 `pending_clarifications` 中保留 `elderly_profile.mobility`；先问缺失的起终点和时间，补齐后仍须追问行动情况才允许规划。医疗急症提示优先。该行为仅使用已登记的字段，不要求前端新增判断；既有明确行动情况不会重复询问。

| 边界 | 预期交互 | 当前契约状态 | 待指定责任 |
| --- | --- | --- | --- |
| 前端 ↔ 后端 | `GET /health`；`POST /api/v1/interpret`：原有必填字段不变，可回传 `planning_state`，响应新增结构化意图、未知项、追问与是否允许规划；`POST /api/v1/plan`：`UserRequest → PlanningResult`，医疗急症返回 422 且提示先联系 120；非法请求 422，Agent 输出不合约 500 | Sprint 1.5 HTTP 与 Sprint 2 前端消费均通过本地技术验证；Sprint 2 产品验收 PASS。Sprint 3 不改变 HTTP 契约 | Backend 与前端 |
| 后端 ↔ Agent | 同进程 Python：`agent.interpreter.interpret(text, reference_time, planning_state=None) → InterpretationResult`，`agent.pipeline.plan(user_request) → PlanningResult`；旧双参数调用保留。医疗急症在解释器和规划入口双重阻断普通路线 | Sprint 1.5 已验证 | Backend 与 Agent |
| Agent ↔ MCP 工具 | Sprint 1 使用只读本地数据服务抽象；MCP 工具名称、输入/输出待 Sprint 2 定义；替换时保持来源和降级语义 | Sprint 2 待定义 | 工具负责人和调用方 |
| 数据文件 ↔ Agent | `data/public/` 的两城 POI、驾驶路线快照和 `data/simulated/air-scenarios.json`；读取时按数据集 Schema 校验；缺失/损坏模拟文件回退地面，地面证据无效时不生成候选；来源清单见 `DATA_SOURCES.md` | Sprint 1 已验证 | 数据负责人和 Agent |

Sprint 1 坐标为 WGS84，经度、纬度，数值不代表出入口；距离用米，时长用分钟，时间戳使用带时区的 RFC 3339。公开地点、道路快照、模拟航空情景分别独立保留 `PUBLIC_DATA` / `SIMULATED_DATA`，缺失接驳、无障碍、实时天气和运营信息按 `DATA_UNAVAILABLE` 或风险 `UNKNOWN` 传播。用户请求中的“附近”描述必须保留；OSM 中心点仅作模型估算代理点。显式提供而与缓存不一致的坐标不允许静默替换，Sprint 1 无对应路线快照时应拒绝计算并说明原因。用户请求中的地点描述不能自动升级为已核验位置。

P01–P20 增补验证：解释器对 `planning_state` 的短会话回传保留年龄、行动能力、地点候选与时间窗口；陪同冲突的结构化标识为 `elderly_profile.assistance_requirement`（见 D-009），旧消费方须遵守 `planning_allowed:false` 并显示追问。`家里` 等泛称只保留用户标签并标位置不确定；`明天下午` 保留时间窗口。验证证据：`tests/agent/test_interpreter_p01_p20.py`。

Sprint 1.5 契约：`PlanningState` 只保存本次规划已识别槽位及 `pending_clarifications`，客户端逐轮回传；服务端不持久化。单轮明确值覆盖同字段旧值，未提及字段保留；医疗急症状态除明确澄清外保持阻断。单个地点无角色时保留 `location_candidate` 并在 `uncertain_fields` 标 `location_role`；明确但未解析的行动/偏好表达也标记不确定，并跨轮保留至澄清。`departure_window` 为用户给出的时间范围，起止须带时区且结束晚于开始；旧精确时间请求仍有效。数据来源与 `DataStatus` 不变。D-011 仅在唯一 Golden 别名且城市或场景上下文明确时映射登记 POI；其他简称不猜测。新字段为向后兼容扩展；旧 `INDEPENDENT`、`FASTEST`、`ECONOMICAL`、`URGENT` 仅为过渡输入兼容，不由解释器新输出。证据见 `tests/agent/test_needs_interpreter_sprint15.py`、`tests/backend/test_app.py` 和 `scripts/validate_contract.py`。

## 契约登记要求

现有核心/数据集 Schema 与前端核心类型镜像已固定为 [2026-10-08 文件基线](../schemas/BASELINE.json)，规则见 [Schema 说明](../schemas/README.md)。`scripts/check_project_ready.py` 检测漂移，不替代语义验证。核心 HTTP 仍为 `0.1-proposal`；R-001/R-002 尚无独立机器 JSON Schema，未纳入这三份文件的机器契约覆盖。跨模块契约只分配一位写入者，不允许不同开发 Agent 分别定义字段。

每项契约应记录：编号、状态（提案/已确认/已实现/已验证）、负责人、提供方与消费方、用途、输入/输出、类型与单位、坐标系及时区、必填/可选规则、错误与降级、版本与兼容策略、最小样例、验证证据。JSON / GeoJSON 数据还需记录来源、更新时间、城市范围和统一 `DataStatus`：`VERIFIED`、`PUBLIC_DATA`、`SIMULATED_DATA`、`DATA_UNAVAILABLE`。

字段或端点尚未确认时标“待定义”。破坏性变化先列出消费方影响与迁移办法，按 `AGENTS.md` 的重大变更门槛处理。接口实现状态不能替代契约确认。

## D-011 已采纳契约补充（2026-09-27）

`LocationRef` 可选 `canonical_poi_id`、`entity_precision`（`POI` / `ENTRANCE` / `PICKUP_POINT` / `AREA` / `UNKNOWN`）、`entrance_verified`。Golden 场景的公开坐标仅为 `POI` 中心点且 `entrance_verified:false`；模拟起降点为 `SIMULATED_DATA`，不代表现实设施。

`Segment` 可选 `geometry`（RFC 7946 `LineString`，坐标 `[经度,纬度]`）、`geometry_status`（`PUBLIC_ROUTE_SNAPSHOT` / `STRAIGHT_REFERENCE_LINE` / `SIMULATED_AIR_CORRIDOR`）及独立的 `geometry_evidence`。三者同时出现；`PUBLIC_ROUTE_SNAPSHOT` 的几何来源为 `PUBLIC_DATA`，直线参考及模拟空中几何为 `SIMULATED_DATA`。几何来源与路程/时长来源分开；缺几何时前端不自行连线，显示不可绘制说明。旧响应不含这些可选字段仍有效。

Alias Registry 仅覆盖天津、深圳 Golden 场景。解析要求唯一实体且有明确城市/场景上下文；`家里` 等泛称不映射。来源不明或歧义时请求澄清。地面 POI 至 POI 的 OSRM 静态道路几何与模拟接驳直线分别标注，不可混用。前端按 `Segment.geometry` 绘制，不能根据端点自行推断道路或航线。

## V-001 Sprint 3 前端可视化派生契约（2026-09-27）

- 状态：已确认，实施与浏览器验证以 Sprint 3 交接为准。负责人：总控 Agent；提供方：现有 Backend `PlanningResult`；消费方：前端 Cesium Scene 与路线卡。没有新增 HTTP 或数据文件字段。
- 输入：只读取既有 `RouteOption.segments`、`Segment.geometry`/`geometry_status`/`geometry_evidence` 与 `LocationRef.coordinate`。几何三字段继续同时出现或同时缺失；坐标为 WGS84 `[经度, 纬度]`，单位为度；缺失/无效时不补画连线。
- 输出：当且仅当 `segment_type=AIR`、`geometry_status=SIMULATED_AIR_CORRIDOR`、`geometry_evidence.data_status=SIMULATED_DATA` 且几何有效时，前端按现有二维线派生三维显示点；起降点接近地表，中间为固定**模拟视觉高度**，含爬升/巡航/下降。高度单位米，仅用于画面；不回传 Backend，不写入 `PlanningResult`，不用于 Safety、时长或运营判断。地面 `PUBLIC_ROUTE_SNAPSHOT` 与 `STRAIGHT_REFERENCE_LINE` 继续显示为地面层，后者仍为示意。旧响应缺几何时继续显示文字降级。
- 失败与兼容：外部地形/建筑请求不参与规划 API；无 token、断网、配额或图层失败时，同一个 Viewer 使用本地基础地球和路线卡，模拟空中线仍可按椭球体显示。Cesium 初始化失败时保留路线文字说明。前端不得把模拟视觉高度、OSM 建筑或地形说成真实可飞性/许可依据。
- 最小样例：已有 `SIMULATED_AIR_CORRIDOR` 的 `LineString` `[[117.169,39.111],[117.174,39.113]]` 保持原 JSON；前端显示曲线可派生 `[117.169,39.111,0] → [中间经纬度,模拟展示高度] → [117.174,39.113,0]`，其中 0 为椭球体示意基准，不代表真实起降点海拔。展示高度不得进入 API 响应。
- 版本与验证：沿用 `0.1-proposal`，消费者无需迁移。相关证据记录在 Sprint 3 测试、浏览器截图及交接。

## 高德主地图评估边界（D-013 待决）

本段记录 D-013 评估时的边界：当时没有高德运行时接口、连接页或 Key 输入功能，主地图按 V-001 使用 Cesium。D-014 已授权本地接入，契约见下文；公网发布与正式服务仍须另行确认。用户已明确要求改进项目地图本身，不增加独立预览功能。

## A-001 高德本地地图显示契约（D-014）

- 状态：本地开发契约已验证（2026-09-28），生产部署接口待定义。负责人：总控 Agent。提供方：项目根 `.env`、Vite 本地服务及现有 `RouteOption`；消费方：前端地图组件。
- 本地配置：`AMAP_WEB_KEY` 为 Web 端 JS API Key，只可通过同源 `/__amap_config` 返回给浏览器；`AMAP_SECURITY_JS_CODE` 只在本地代理附加给 `_AMapService` 请求；`AMAP_WEB_SERVICE_KEY` 仅留服务端，用于本地 `/__amap_district_probe` 与 `/__amap_convert`。边界探针只返回成功状态和 `350000` 区划代码；坐标代理接收最多 40 个 WGS84 点并只返回高德坐标。安全密钥和 Web 服务 Key 不返回浏览器。类型以高德控制台平台类型确认为准，不以 Key 名称推断。缺项返回可判定的配置不可用状态，不输出凭证。
- 地图输入：沿用 V-001 的 WGS84 `[经度,纬度]` 度单位和来源状态；同源 `/__amap_convert` 调用高德 Web 服务坐标转换成功后才把 GCJ-02 坐标交给地图图层。旧 HTTP/JSON 结果无需迁移。模拟低空线在二维地图上显著标为模拟，展示不代表真实航线或高度。
- 地图输出：路线定位完成前以文字过渡态遮住全国初始视野和旧城市画面；保留高德原生署名/审图信息。福建省边界查询仅在 `?dev=1` 开发核验模式执行与展示，不纳入规划数据。
- 错误：配置缺失、JS API 加载失败、坐标转换失败或边界查询失败时向用户显示可理解状态；不得补造地图图块或边界。Cesium 既有地图可作明确标识的回退。服务端不记录或返回安全密钥与 Web 服务 Key。
- 版本与验证：本地开发契约，不改变核心 `0.1-proposal`。本机浏览器实测地图瓦片、署名、福建 JS 边界与 Web 服务探针，并验证天津地面/模拟低空和深圳地面路线；证据见 2026-09-28 交接。许可与生产代理方案仍待决。

## V-002 Sprint 3 地图视角选择（D-015）

- 状态：已确认并通过本地浏览器验证（2026-09-28）；证据见 Sprint 3 最终交接。提供方为既有 A-001 高德本地地图与 V-001 Cesium 场景；消费方为同一前端地图区域。无新 HTTP、Schema 或数据文件字段。
- 输入仍为既有 `RouteOption`、WGS84 几何和来源状态。依 D-016，纯地面与 `GROUND_AIR_GROUND` 均默认真实城市平面地图；立体旅程由用户主动打开。用户可手动切换，两种视角必须明确标出地图背景来源与空中数据的模拟身份。
- 高德 3D 视角使用官方 JS API 2.0 与已核验的本地 Web 端配置；现有路线经 A-001 转换为 GCJ-02 后作为地图平面投影，不得称为三维飞行轨迹或批准高度。Cesium 按 V-001 派生模拟视觉高度。任一视角失败不能改变规划结果、安全结论或数据状态。
- 高德失败时显示 Cesium 本地场景；可选 Cesium ion 资源失败时同一 Viewer 回退基础地球。地图切换不重新创建已有 Cesium Viewer；页面刷新或重新打开页面可创建新实例。无凭证时不伪造城市楼块。版本继续 `0.1-proposal`，旧消费者无需迁移。

## R-001 本地 Ground Reality 查询契约（D-016）

- 状态：Sprint 3.2 本地已实现，Reality Gate PARTIAL；提供方为 FastAPI 的 `GroundRealityProvider` / `AmapGroundRealityProvider`，消费方为前端地点确认与地图。`POST /api/v1/interpret`、`POST /api/v1/plan` 和核心 Schema 不变；生产代理与许可仍待 D-013。
- `GET /api/v1/reality/places?query=<1..80 字>&city=TIANJIN|SHENZHEN` 返回 `status`（`OK`/`DATA_UNAVAILABLE`）与 `candidates`；成功时另含 `source`、`retrieved_at`（带时区 ISO 8601）、`coordinate_system=GCJ-02`。候选含高德 `id/name/address/location:[经度,纬度]`；多个合理候选必须由用户选择，不能以首条替代。错误/无凭证返回明确 `DATA_UNAVAILABLE`，不得补造候选或成功状态来源字段。
- `POST /api/v1/reality/ground` 输入 `{city,origin_query,destination_query}`（字符串各 1..80 字）；提供方须分别解析两端同城、精确名称的唯一 POI。成功返回 `status=OK`、两端 POI（精度仅 `POI`）、`driving` / `walking` 在线路段参考（米、分钟、高德 GCJ-02 几何、`source`、`retrieved_at`）；可选 `origin_detail` / `destination_detail` 只给高德到达点坐标和证据时间，仍标 `entrance_verified:false`。一端歧义返回 `NEEDS_SELECTION` 和候选；上游失败返回 `DATA_UNAVAILABLE`。失败均不输出伪造线路。客户端原始输入仍由原 `PlanningResult.user_request` 保留。
- `entr_location` 仅能作为高德到达点原始证据，不能自动升级为已核验入口、接送点或轮椅入口。在线驾车/步行时间是相应路段的地图估算，不是完整行程到达时间；等候、上下车、无障碍和运营状态仍 `UNKNOWN`。GCJ-02 只供高德地图绘制，不得混入 WGS84 的核心 `Segment.geometry`。失败回退静态 OSRM 时必须显示“静态道路模型”。
- 最小状态样例（只展示判别字段，非完整真实响应）：成功 `{"status":"OK","coordinate_system":"GCJ-02","origin":{"id":"POIA"},"destination":{"id":"POIB"},"driving":{"distance_m":1800,"duration_min":10,"geometry":[[117.17,39.10],[117.18,39.11]]}}`；失败 `{"status":"DATA_UNAVAILABLE","message":"在线地点或路线暂不可用"}`；歧义 `{"status":"NEEDS_SELECTION","origin_candidates":[],"destination_candidates":[]}`。实现和本地证据见 `tests/backend/test_ground_reality.py`、`docs/evidence/reality-first/implementation/` 及 [Sprint 3.2 交接](handoffs/2026-09-29-reality-first-implementation.md)。

## R-002 天津出发的用户选点在线地面路线（D-017）

- 状态：本地已实现，Reality Gate PARTIAL；核心 `0.1-proposal` 不变。提供方为 FastAPI `AmapGroundRealityProvider`；消费方为页面地点选择与高德二维图。`GET /api/v1/reality/places` 的 `city` 新增 `ALL`，仅用于目的地全国搜索；起点仍限 `TIANJIN`。响应候选 `id/name/address/city/location` 为高德 GCJ-02 POI，须由用户明确选定；只输入文字或单条搜索结果不得自动规划。
- `POST /api/v1/reality/route-by-id` 输入 `{origin_id,destination_id}`，均为已选择的高德 POI ID（1..40 个字母数字），服务端重新查询两处 POI 详情并验证起点 `city=天津市`，终点须有高德返回的非空城市字段及有效 GCJ-02 坐标。成功返回 `status=OK`、两端 POI 详情、`driving` 在线几何/距离米/时间分钟及可选道路步骤文字、可选 `walking`、来源和抓取时间；驾车几何首尾须在所选 POI 的 750 米内，超出或数据不可用则 `DATA_UNAVAILABLE`，不补画直线。非空城市字段本身不证明法定辖区或实际入口。地点详情的到达点仅是未核验到达点，`entrance/pickup/accessibility=UNKNOWN`；`safety_review=NOT_PERFORMED`。
- 此路线与 `PlanningResult` 分开显示，状态明确为“地图道路参考，尚未经 SilverSky 安全审查”；不计算完整行程时间，不生成模拟低空或 `RECOMMENDED`，不改变旧 Golden Safety 状态。仅在用户当前页面会话保存搜索词与选择；不持久化个人出行记录。失败仍可查看旧 Golden 流程，但当前查询不能以静态 Golden 线路冒充任意路线。
- 最小状态样例（只展示判别字段，非完整真实响应）：选点成功 `{"status":"OK","coordinate_system":"GCJ-02","origin":{"id":"POIA","city":"天津市","location":[117.17,39.10],"precision":"POI","entrance_verified":false,"accessibility":"UNKNOWN"},"destination":{"id":"POIB","city":"北京市","location":[116.38,39.86]},"driving":{"geometry":[[117.17,39.10],[116.38,39.86]],"distance_m":131000,"duration_min":125},"safety_review":"NOT_PERFORMED"}`；不可用 `{"status":"DATA_UNAVAILABLE","message":"在线地点或驾车路线暂不可用"}`。示例折线只表示响应结构，不能作为可绘制真实道路；服务端实际要求完整上游道路几何及两端 750 米校验。测试见 `tests/backend/test_ground_reality.py` 与 `frontend/tests/tianjin-anywhere.mjs`，三组本地浏览器记录见 `docs/evidence/reality-first/implementation/tianjin-anywhere-runs.json`。

## V2-001 最小流程独立契约（REQ-012）

状态：用户已确认范围，2026-10-08 实施前登记；提供方 backend/v2.py，消费方 frontend/src/v2；唯一负责人当前集成 Agent。旧端点/核心 Schema/类型镜像不迁移。

- POST /api/v2/interpret：{text:1..2000字, city:TIANJIN|SHENZHEN|ALL}；输出 status=OK、intent（origin/destination 为地点词或 null；departure_time/mobility/preferences 字符串或 null；age 为0..120整数或 null）、两端 candidates、resolved（唯一精确匹配或 null）、missing_fields、source=DeepSeek。结构在 TripIntent Pydantic Schema，extra=forbid/strict，模型不得生成坐标、航空结论；所有槽位必须出现，未知 null。地点候选复用 R-001，GCJ-02。多个合理候选须用户选择，泛称不自动确认。缺地点返回空候选并提示修改。
- POST /api/v2/route：{origin_id,destination_id} 高德1..40字母数字ID；重新核实两端，拒绝相同点/无可靠驾车几何/首尾偏差>750m。status=OK、origin/destination（高德详情）、ground（完整高德GCJ-02 geometry、distance_m/duration_min/steps/source/retrieved_at/data_status=PUBLIC_DATA）、ground_wgs84（数值逆转换几何）、air（WGS84 [经度,纬度,示意高米]33点，SIMULATED_DATA、标签模拟空中路线、非航空许可）、coordinate_system=GCJ-02。地面未经核心Safety审查，空中不作运营、安全、时间、价格承诺。
- GET /api/v2/buildings?poi_id=...：以高德POI逆转换后附近约400m从OSM官方只读Map API检索真实建筑轮廓，最多100个；WGS84、来源/检索时间；height_m缺来源时12m示意，height_status=ILLUSTRATIVE，否则SOURCE_HEIGHT（非实测核验）；上游失败503，不补造楼块。OSM数据ODbL署名。响应读取上限4MB，拒绝缺节点、不闭合或越界轮廓；优先最近100栋。
- GET /api/v2/status：仅返回 DeepSeek/高德服务端是否配置及当前模型名，不返回密钥。
- 上游错误HTTP503（缺凭据）、502（服务/内容不可用）、422（输入非法），detail为中文提示，禁止包含URL/凭据/模型原始回复。超时有界，不记录用户文本、不持久化行程；前端保留文本/选点供重试；当前失败清除旧线。
- 高德2D使用原始GCJ-02，Cesium使用数值逆转换WGS84。转换为本地计算近似，测量残差验证，不宣称测绘认证；不能用于真实飞行。高度相对椭球仅视觉。定位仅地图浏览，不自动填入行程。
- 浏览器按住说话使用实际 SpeechRecognition zh-CN；松开stop，最终结果写入输入框，完成才分析。权限/无语音/网络/不支持明确提示，文字与Windows语音输入(Win+H)作为备用；本应用不存储录音，浏览器语音提供方可能联网处理。真人识别单列待验。
- 最小输入示例：{"text":"我想从天津大学卫津路校区去天津医科大学总医院。","city":"TIANJIN"}；路线输入示例：{"origin_id":"B012345678","destination_id":"B087654321"}（ID仅格式示例，不能用于真实路线）。
- 验证：tests/backend/test_v2.py、frontend/src/v2/*.test.*、frontend/tests/v2-*.mjs 与本轮交接；状态随证据追加。

V2-001 实际状态（2026-10-08）：已实现并经130项Python、23项前端及Chrome/Edge真实在线流程验证；建筑100栋及模拟高度标记成功，天津道路3个点与高德官方转换对照最大约0.09米偏差（仅已测点）。语音UI事件连接已验证，真人声学识别与最终用户验收仍NOT_VERIFIED；证据见 [V2交接](handoffs/2026-10-08-v2-mvp.md)。

## V2-002 试用反馈修正（REQ-013/014，实施前已确认）

- 用户实际确认语音转写并规划成功；原V2-001语音实现不扩展。歧义两端仍各须用户确认，点齐时立即调用已有route，无新增确认按钮，不把首候选当已选。
- Cesium仍为3D组件，增加OSM标准道路/地名底图（WGS84 WebMercator），遵循供应方署名/浏览器缓存/仅当前视口加载，不批量下载或预取；原本地概览作为失败回退，失败明确提示二维入口。无新付费API/更换地图方案；测试只做当前公开验收视口，不大范围自动扫图。
- interpret响应兼容增加departure_plan:{departure_time:ISO8601+08:00|null, departure_window:{start,end}|null, message:string}。仅确定性解析原文中明确时间，参照服务端Asia/Shanghai当前时间；未知或模糊需用户确认，不猜测。复用既有_time，不修改旧解释器。
- 前端时间安排：无时间默认“现在出发”；有已解析明确时间预填可编辑datetime-local（明确北京时间），过去/含糊时间须确认；预计到达=所选出发+高德当前道路估算，明确非指定未来实时交通预测、不含等候/上下车。空中时间仍不可用。出发时间编辑不重新调用LLM、不更改几何来源。
- 允许修改backend/v2.py、tests/backend/test_v2.py、frontend/src/v2/api.ts/MvpApp.tsx/CityScene.tsx/v2.css，新增DeparturePlan组件/测试和相关V2浏览器验证，相关需求/状态/契约/交接文档。核心Schema/旧API保持不变。

V2-002实际验证：原文明确/模糊/非法/过去时间后端40项V2风险测试、全部Python137、前端27、构建通过；Chrome/Edge实际道路地名瓦片与自动选点成功；天津之眼→西站北广场及明天下午3点预填/改18点到达更新已复现。语音用户REQ-013已确认本机成功；证据见最新反馈交接。

## V2-003 基础城市模型加载（REQ-015，兼容实施约定）

用户询问“能否加载3d城市模型”，沿用已授权基础城市体块范围；未据此批准采购实景纹理或新付费服务。负责人当前集成Agent，写入backend/v2.py、tests/backend/test_v2.py、frontend/src/v2/CityScene.tsx及新增useCityBuildings.ts/测试、V2地图浏览器验证与需求/状态/交接文档。

- GET /api/v2/buildings兼容增加可选limit整数，默认100，上限200，下限1；原调用方默认行为保持。既有OSM查询范围、4MB读取上限和高度规则保持。
- Cesium分别查询已确认起终点，每端最多200栋，按OSM ID去重；只覆盖两处街区，不声称全城/全程连续覆盖。一端失败保留另一端成功模型并提示失败，可显式重试；两端失败保留底图与路线，不造楼。
- 建筑显示开关、起点/终点街区视角不重新规划，不重新查询；建筑返回不得重置用户已经移动的相机。高度缺失仍12米示意，来源高度未独立实测；非带实景纹理模型。
- 未配置VITE_CESIUM_ION_TOKEN，不使用SDK内置演示凭据，不增加收费服务或配置界面。整城在线3D Tiles仅作为后续选项，不写成已接入/已验证。

状态：已实现并验证；相关后端44、前端32、构建通过，Chrome/Edge实际起终点合计400栋及开关/视角/部分失败恢复成功。开发StrictMode重复请求已修复，两个端点查询总计2次。详见[城市模型交接](handoffs/2026-10-08-v2-city-model.md)。

## CAT-001 航空器产品索引（REQ-016，2026-11-06 实施约定）

负责人当前集成Agent；用户要求独立索引，图片、型号、公司、主要性能，Figma套用产品矩阵，首批“国内为主，补充国外代表型号”。允许写入frontend/src/catalog/、frontend/public/aircraft-images/、main.tsx入口、v2/MvpApp.tsx导航及相应测试/资料文档；旧规划/API/Schema/依赖保持。

- 独立URL `/aircraft`，详情 `/aircraft/{id}`；主规划页通过新标签打开目录以保留正在编辑的行程。页面为可交互React，筛选/搜索/详情可用；无购物、预订或空中规划接入。
- 前端静态数据products.json：id/model/company/country/category(passenger|cargo)/piloting/autonomy(autonomous|piloted)/availability/statusNote/summary/metrics[{label,value,note}]/image/imageSource/sourceUrl/extraSources/checkedAt(Asia/Shanghai日期)/dataStatus=PUBLIC_DATA。无需新增后端接口或数据库。
- 数值保留单位、最大/设计/典型等口径及工况；不同产品航程与载重不默认同时可达。缺字段明确未公开，不推算未知性能。有驾驶员eVTOL作为相关载人产品单列标签，不冒充无人驾驶；研制机不称已上市/可运营。
- 图片使用对应厂商公开图片、本地静态文件并记原URL/版权归属，不用AI图、示意机或其他机型代替。加载失败显示“产品图片暂不可用”并保留官方链接，不伪称已加载。厂商版权保留，公开发布图片许可仍待独立确认。
- 目录仅公开产品资料，不代表SilverSky拥有航空器、可预订、具备空域许可或真实可飞；不改变现有模拟空中路线边界。

状态：已实现并验证；12款（国内9/国外3）、官方本地图片与参数工况、Figma模板适配完成；41项前端测试、typecheck/build与Chrome/Edge实际交互通过，详见[本轮交接](handoffs/2026-11-06-aircraft-catalog.md)。目录不迁移旧接口或核心Schema。

## V3-001 首页开放数据库街区模型（REQ-018/019）

实施约定已确认并已实现、经桌面及接口测试验证（2026-11-07）：保留Cesium/二维默认，不引入数据库服务、付费API或新密钥。数据提供方为OSM官方只读Map API，消费方为CityScene/useCityBuildings；负责人为本轮集成Agent。

兼容新增 GET /api/v2/city-buildings?longitude=117.19&latitude=39.12&limit=500：longitude/latitude为必填有限WGS84十进制度，范围[-179.99,179.99]/[-85,85]；limit整数1..500，默认500。固定查询中心±0.005经度/±0.004纬度，最多4MB、18秒上游超时，不接受外部URL或任意bbox。响应沿用Buildings的features/source/retrieved_at及coordinate_system=WGS84，兼容增加data_status=PUBLIC_DATA；每栋闭合footprint、height_m、height_status沿用既有定义。无建筑成功返回空列表，不补造；非法输入422，上游失败503，中文错误不泄露上游细节。旧/buildings?poi_id接口和100/200预算不变。

首页3D无需行程：初始天津街区，可切深圳或显式加载相机当前中心附近；移动相机不自动请求建筑；不发送用户文字或路线至OSM，只发送可见街区bbox。进入行程后自动恢复原起终点加载，手动浏览不重规划。仅闭合OSM建筑way，关系多面体/实景纹理/整城全覆盖不在本轮范围，未知高度12米示意，非安全或飞行证据。返回采集时间并显示OSM/ODbL署名及链接。

V3-001验证证据：后端V2 55项、前端44项/typecheck/build及Chrome真实两城/当前视野/503恢复通过，详见[首页3D交接](handoffs/2026-11-07-home-3d-open-data.md)。不含公网/全城/实测物理高度验收。

## V3-002 城市模型与模拟飞行 Agent（REQ-021）

本地兼容增量，先实施既有模拟边界。提供方为离线城市包及规则 Agent，消费方为首页 Cesium 和同源 FastAPI。城市包为带来源的静态分块数据，位于 `artifacts/flight-models/`。覆盖以实际导入边界、成功读取的格网及源数据为准。城市包不参与地面出行结果。

- GET `/api/v2/flight-sim/cities` 返回已就绪的城市清单、覆盖边界、建筑计数和来源。GET `/api/v2/flight-sim/{city}/buildings/{column}/{row}` 提供视口建筑分块，GET `/api/v2/flight-sim/{city}/terrain/{level}/{x}/{y}` 返回 Cesium 地理地形块的 33×33 高程。地形显示可回落到椭球，分析中的缺值保留未知。
- POST `/api/v2/flight-sim/{city}/plan` 输入 `{ "origin": [117.19, 39.12], "destination": [117.22, 39.13] }`。WGS84 经度在前，度单位。地面标高、建筑顶部、模拟轨迹 Z 均为 WGS84 椭球米。输出 `SIMULATED_DATA`、端点模型标高、已知障碍上包络、固定模拟间隔、缺口计数和分段轨迹。`MODEL_CANDIDATE`、`PARTIAL_PREVIEW` 与 `DATA_UNAVAILABLE` 区分按模型计算、含未知建筑的推演和不可生成。空域、起降适用性均为 `DATA_UNAVAILABLE`。旧 `/api/v2/route` 的 `air` 不变。
- 地形来自 GEDTM30 裸地估计和 EGM2008 转换。建筑优先使用来源高度。CNBH-10m 可用时以独立的遥感估计来源填补，未知仍保留 null。`estimated_building_cells` 和 `unknown_building_cells` 分别计数，含任一种的路线标记为 `PARTIAL_PREVIEW`。模型表面字段为 `highest_modeled_surface_m`，实地起降需另行核验。行程坐标由本地 Agent 处理，城市源数据离线准备。

城市包格式 v1 使用约 0.02° 分块，分析格网为 72×72 单元，单元从南向北、由西向东排列。每个单元以小端 `float32` 地面标高、`float32` 模型表面标高和 `uint8` 状态位存储，缺地形用 NaN。浏览建筑按分块裁切，来源楼高与 `CNBH_2020` 估计分开。`demo_points` 仅为已验证的模拟试算坐标。

V2-001 运行复验（REQ-022，2026-11-07）。DeepSeek 返回 HTTP 500/502/503/504 时，剩余分析预算充足可自动重试一次。持续失败仍返回 HTTP 502 和脱敏中文提示，保留输入。结构校验、地点核实与 API 字段沿用原约定。[复验证据](handoffs/2026-11-07-live-use-recheck.md)

V3 首页手动选点（2026-11-09，桌面已验证）。复用既有高德地点检索和 `/api/v2/route`。用户主动进入手动选点，分别确认两端的高德候选，再请求路线。DeepSeek 失败时保留文字，已识别急症时仍暂停普通规划。手动结果展示高德道路参考和可编辑出发时间，模拟空中参考单独标记。既有接口请求、响应和数据状态沿用原定义。
