# SilverSky AI — 数据字典 (DATA_DICTIONARY)

> 版本 v0.1 · 2026-09-27 · 维护方：数据与产品运营（WorkBuddy 协助）
> 适用阶段：MVP 建设期 · 第一阶段城市：天津、深圳

---

## 0. 总体约定

- 所有 CSV 统一采用 **UTF-8（无 BOM）** 编码，逗号分隔，字段内部不使用英文逗号（如需用引号包裹）。
- 第一行为表头（字段名），后续每行代表一条记录。
- 字段值中的枚举统一使用**大写字母 + 下划线**，见各表枚举说明。
- **任何无法确认的信息一律填 `DATA_UNAVAILABLE`，严禁编造。**

### 数据状态枚举（全库统一）

| 枚举值 | 含义 | 适用场景 |
| --- | --- | --- |
| `VERIFIED` | 已经我方核实（含内部确认/人工核验） | 我方实地或权威渠道确认过 |
| `PUBLIC_DATA` | 公开数据（官网、权威媒体、公开地图等） | 有公开来源、可追溯 source_url |
| `SIMULATED_DATA` | 模拟/构造数据 | Demo、Agent 测试用的假设值 |
| `DATA_UNAVAILABLE` | 数据不可得/未知 | 无法确认、暂缺 |

> 说明：本阶段示例数据以 `PUBLIC_DATA` 与 `SIMULATED_DATA` 为主；`VERIFIED` 仅在人工核验后使用，`DATA_UNAVAILABLE` 用于诚实标注缺口。

---

## 1. aircraft.csv — 低空载人飞行器基础资料

**用途**：维护 SilverSky 可以考虑的低空载人飞行器基础资料，为选型、起降点评估与 Agent 决策提供可追溯依据。

| 字段 | 含义 | 说明 |
| --- | --- | --- |
| aircraft_id | 飞行器唯一编号 | 主键，如 `AC-001` |
| manufacturer | 制造商 | 中文名 + 英文 |
| model | 型号 | |
| vehicle_type | 飞行器类型 | 多旋翼 / 复合翼 / 倾转旋翼等 |
| capacity | 载客(乘员)数 | 单位：人；含飞行员时在 notes 注明 |
| range_km | 航程(公里) | 未知填 `DATA_UNAVAILABLE` |
| cruise_speed_kmh | 巡航速度(km/h) | 未知填 `DATA_UNAVAILABLE` |
| takeoff_type | 起降方式 | 常见 `VTOL 垂直起降` |
| energy_type | 能源类型 | 如 `纯电` |
| elderly_accessibility_notes | 老年人无障碍说明 | 未知/缺失须如实写"无公开信息" |
| source_name | 来源名称 | 官网/媒体等 |
| source_url | 来源链接 | 用于追溯 |
| source_date | 来源日期 | 报道/证书/发布日期 |
| data_status | 数据状态 | 见总枚举 |
| notes | 备注 | 运营状态、验证阶段、约值提示等 |

**关键规则**：
- 参数尽量保留原始来源；**概念机/验证机参数不得写成已运营参数**（见 `AC-006 VT-30` 示例，notes 中明确"验证机、未取证"）。
- 厂商声明值为设计/最大性能，非实测运营值，已在 notes 标注。

---

## 2. vertiport_candidates.csv — 候选起降点

**用途**：维护天津、深圳的候选起降点，供路径规划与起降点选择使用。

| 字段 | 含义 | 说明 |
| --- | --- | --- |
| vertiport_id | 起降点唯一编号 | 主键，如 `VP-TJ-001` |
| city | 城市 | 天津 / 深圳 |
| name | 名称 | |
| latitude / longitude | 经纬度 | 近似值需在 notes 注明"需GIS校核" |
| candidate_type | 候选类型 | 见下方枚举 |
| nearby_hospital | 附近医院 | 具体名称或 `NO` |
| nearby_eldercare_facility | 附近养老设施 | 具体名称或 `NO` |
| nearby_transport_hub | 附近交通枢纽 | 具体名称或 `NO` |
| ground_accessibility | 地面可达性 | 文字描述 |
| estimated_service_radius_km | 估计服务半径(km) | 估算值 |
| source_name / source_url | 来源 | 模拟数据留空 |
| data_status | 数据状态 | 见总枚举 |
| notes | 备注 | 必须写清是否模拟/假设 |

**candidate_type 枚举**：
- `EXISTING_PUBLIC_INFO` — 真实存在且有公开信息的既有设施（如机场、有公开起降记录的地点）
- `POTENTIAL_SITE` — 真实地点，作为起降点仅为候选假设，未经任何运营确认
- `SIMULATED_SITE` — 完全模拟点位，非真实设施

**关键规则**：
- 所有 `SIMULATED_SITE` 的 `data_status` 必须为 `SIMULATED_DATA`，且 notes 写明"非真实设施、仅用于 Demo/Agent 测试"。
- 真实地点的坐标为近似值，均标注"需GIS校核"。

---

## 3. user_scenarios.csv — 用户场景库

**用途**：作为后续 Agent 测试、Demo 和产品设计的标准场景库。

| 字段 | 含义 | 说明 |
| --- | --- | --- |
| scenario_id | 场景唯一编号 | 主键，如 `SCN-TJ-001` |
| city | 城市 | 天津 / 深圳 |
| user_role | 用户角色 | 见枚举 |
| elderly_age | 老人年龄 | 非老人角色留空 |
| mobility_level | 行动能力等级 | `FULL` / `REDUCED` / `SEVERE` |
| walking_tolerance_m | 步行耐受(米) | |
| wheelchair_required | 是否需轮椅 | `YES` / `NO` |
| assistance_required | 是否需协助 | `YES` / `NO` |
| origin / destination | 起点 / 终点 | |
| departure_time | 出发时间 | 如 `08:30`，急救可为 `任意` |
| urgency | 紧急程度 | 见枚举 |
| purpose | 出行目的 | 见枚举 |
| priority_1/2/3 | 优先级排序 | 如 无障碍可达性 / 时间可控 / 成本 |
| special_constraints | 特殊约束 | 轮椅、陪护、携带物等 |
| expected_behavior | 期望行为 | 供 Agent 判定依据 |
| status | 场景状态 | `ACTIVE` / `DRAFT` / `ARCHIVED` |

**user_role 枚举**：`ELDERLY` / `CHILD` / `CAREGIVER`
**purpose 枚举**：`MEDICAL` / `VISIT_FAMILY` / `RECREATION` / `WELLNESS` / `DAILY_TRAVEL` / `OTHER`
**urgency 枚举**：`NORMAL` / `TIME_SENSITIVE` / `URGENT`

**关键规则**：
- SilverSky **不是急救/医疗诊断系统**。真正医疗急救场景（`URGENT` + `MEDICAL`）必须在 `expected_behavior` 中标注"引导呼叫 120 急救体系，SilverSky 仅作转运协同、不做医疗处置"（见 `SCN-SZ-004`）。
- 未成年人出行需监护人陪同及合规审核（见 `SCN-SZ-005`）。

---

## 4. competitors.csv — 产品与产业竞品研究

**用途**：长期维护 SilverSky 的产品与产业竞品研究，用于学习借鉴。

| 字段 | 含义 | 说明 |
| --- | --- | --- |
| competitor_id | 竞品唯一编号 | 主键，如 `C-001` |
| product_name | 产品名 | |
| company | 公司 | |
| country | 国家/地区 | |
| category | 类别 | 见枚举 |
| target_user | 目标用户 | |
| core_function | 核心功能 | |
| ai_capability / agent_capability / map_capability / 3d_capability / low_altitude_capability / elderly_capability / route_planning_capability | 各项能力 | `YES` / `NO` / `PARTIAL` / `UNKNOWN` |
| strengths | 优势 | |
| limitations | 不足 | |
| relevance_to_silversky | 对 SilverSky 的借鉴点 | 解决什么/可学什么/没解决什么 |
| source_name / source_url / source_date | 来源 | 能力定性行 source_date 可留空 |
| last_checked | 最近核查日期 | 用于识别过期条目 |
| status | 状态 | `ACTIVE` / `INACTIVE` |

**category 枚举**：`NAVIGATION` / `LOW_ALTITUDE_PLATFORM` / `EVTOL_OPERATOR` / `AI_AGENT` / `ELDERCARE` / `URBAN_MOBILITY`

**关键规则**：不做"谁比 SilverSky 好"的简单判断；重点分析其解决的问题、SilverSky 可学习之处、以及它尚未解决的问题。

---

## 5. feature_backlog.csv — 产品需求池

**用途**：SilverSky 产品需求池，供研发排期。

| 字段 | 含义 | 说明 |
| --- | --- | --- |
| feature_id | 需求唯一编号 | 主键，如 `F-001` |
| module | 所属模块 | 数据资产/行程规划/无障碍/安全合规/用户画像/低空/Demo |
| feature_name | 需求名 | |
| user_problem | 用户痛点 | |
| user_value | 用户价值 | |
| description | 描述 | |
| priority | 优先级 | `P0` / `P1` / `P2` / `P3` |
| mvp_required | 是否 MVP 必需 | `YES` / `NO` |
| dependencies | 依赖项 | 关联 feature_id |
| data_requirement | 数据需求 | |
| risk | 风险 | |
| acceptance_criteria | 验收标准 | |
| status | 状态 | 见枚举 |
| owner | 负责人 | |
| notes | 备注 | |

**priority 枚举**：`P0` / `P1` / `P2` / `P3`
**status 枚举**：`IDEA` / `RESEARCH` / `READY` / `IN_PROGRESS` / `REVIEW` / `DONE` / `DEFERRED`

---

## 6. 真实 / 模拟数据管理原则

1. **四态分离**：`VERIFIED`、`PUBLIC_DATA`、`SIMULATED_DATA`、`DATA_UNAVAILABLE` 必须严格区分，任何记录都须有明确 `data_status`。
2. **可追溯**：`PUBLIC_DATA` 必须携带 `source_name` + `source_url`（+ `source_date`）；无法给出来源的一律不写为公开数据。
3. **模拟隔离**：所有模拟数据（`SIMULATED_SITE` 等）必须显式标注，不得让使用者误以为是真实运营设施。
4. **不编造**：无法确认的信息填 `DATA_UNAVAILABLE`，绝不臆造参数或来源。
5. **运营状态区分**：概念机/验证机/未取证机型与已运营机型在 `notes` 中明确区分。

---

## 7. 维护归属

| 表 | 当前维护方 | 说明 |
| --- | --- | --- |
| aircraft.csv | WorkBuddy（人工/运营） | 需人工核验来源与参数 |
| vertiport_candidates.csv | WorkBuddy（人工/运营） | 真实点位需 GIS/实地校核 |
| user_scenarios.csv | WorkBuddy（人工/运营） | 产品与合规共同维护 |
| competitors.csv | WorkBuddy（人工/运营） | 长期研究，定期核查 |
| feature_backlog.csv | WorkBuddy（产品运营） | 随研发进程流转 status |

> 未来由 SilverSky 软件自动生成的表（规划中，本阶段暂不创建）：
> - 行程/订单/调度运行记录（由后端自动写入）
> - 起降点实时状态与空域/气象动态数据（由软件采集）
> - 用户出行偏好画像（由系统沉淀）
> - Agent 执行日志与评测结果（由 Agent 运行自动生成）

---

## 8. 当前示例数据概览

- **aircraft.csv**：6 条，均为 `PUBLIC_DATA`（公开来源），其中 `AC-002` 航程、`AC-006` 巡航速度为 `DATA_UNAVAILABLE`。
- **vertiport_candidates.csv**：8 条；真实/候选点为 `PUBLIC_DATA`，2 条 `SIMULATED_SITE` 为 `SIMULATED_DATA`。
- **user_scenarios.csv**：8 条场景，覆盖 3 角色 × 5 目的 × 3 紧急程度。
- **competitors.csv**：8 条，覆盖导航/低空平台/eVTOL运营/AI Agent 等类别。
- **feature_backlog.csv**：12 条，P0 8 条、P1 3 条、P2 1 条。
