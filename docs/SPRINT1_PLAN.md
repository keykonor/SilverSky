# Sprint 1 实施方案

日期：2026-09-27。状态：技术验收通过；产品指令指定闭环，数据与接口细节按本文件顺序落地，验收证据见 [PROJECT_STATE.md](PROJECT_STATE.md) 和本轮交接文档。

## 已完成的启动门槛

初始化基线提交：`d70fab1`。Python 3.12.7 项目虚拟环境已创建，依赖见 `requirements.txt`。六个项目 Skill 迁移至 `.agents/skills/`，当前只保留一套。

## Golden Scenarios

| 编号 | 已知事实 | 测试补充与未知项 |
| --- | --- | --- |
| TJ-001 | 78 岁，行动能力 `LIMITED`，需陪同；天津大学卫津路校区附近 → 天津医科大学总医院；15:00；`NORMAL`；`SAFETY_COMFORT` | 日期由 Golden 测试夹具显式提供，不能当作原始用户输入；步行容忍、轮椅需求、起点精确位置及是否允许模拟低空均未知 |
| SZ-001 | 72 岁，深圳市养老护理院 → 北京大学深圳医院；`NORMAL`；`SAFETY_COMFORT` | 机构选择依据为官方页面；完整出发时间由测试夹具显式提供；行动能力、步行容忍、辅助需求、轮椅需求及是否允许模拟低空均未知 |

两个场景的机构名称和地址有官方来源；OSM 对象中心点与 OSRM 一次性驾驶估算见 [DATA_SOURCES.md](DATA_SOURCES.md)，都属于 `PUBLIC_DATA`，不是出入口或实时路线。无障碍与真实交通运营条件仍无证据。Sprint 测试用的完整日期和时间见 [`TJ-001` 请求夹具](../examples/tj-001.interpret.json)与[`SZ-001` 请求夹具](../examples/sz-001.interpret.json)：这些日期是测试补充，不得标为原始用户事实。来源与使用边界见 [DATA_POLICY.md](DATA_POLICY.md)。

## 实施顺序与文件边界

1. **主 Agent：契约与数据**。更新 `schemas/`、`docs/API_CONTRACTS.md`、`docs/INTERFACES.md`，先定义自然语言解释结果、安全枚举和展示标签；最小 POI 数据记录来源、数据状态及采集时间。只做一次性公开数据核对与缓存；不得臆造坐标或道路距离。
2. **Backend 子任务**：只写 `backend/`、`tests/backend/`。FastAPI 提供 `GET /health`、`POST /api/v1/interpret`、`POST /api/v1/plan`，入口/出口遵守主 Agent 冻结的 Schema；不修改共享契约。
3. **运行时 Agent 子任务**：只写 `agent/`、`tests/agent/`。实现 Needs Interpreter、Candidate Planner、独立 Safety Reviewer、Solution Synthesizer 四个逻辑角色。候选可以少于三个；必须能区分纯地面与模拟低空，拒绝或降级不可信候选。
4. **主 Agent 集成**：联通 Backend 与 Agent，验证两城 Golden Scenario、七类指定测试、Schema 和安全标记；只读 Reviewer 再检查合同漂移、数据真实性与 Safety 绕过。

## 决策边界

本轮用只读数据服务接口，保留日后 MCP 适配点，不启动独立 MCP 服务。理由与影响见 [DECISIONS.md](DECISIONS.md) D-004。地面地点优先采用官方来源核实名称/地址；若需可复用坐标，按 OSM ODbL、署名及查询政策取得并缓存。无法核实时返回 `DATA_UNAVAILABLE`。低空起降点、航路、天气情景、价格和航空器信息全部为模拟数据，不能当作现实可乘坐建议。

## 完成门槛

稳定 Python 环境、服务可本地启动、两个 Golden Scenario 可执行、至少两种不同路线类型、模拟标记全链路保留、Safety 可降级/拒绝、API 结果通过 Schema、pytest 与契约校验通过、Reviewer 无 P0。任何缺项在 [PROJECT_STATE.md](PROJECT_STATE.md) 如实列为未完成；不得为凑满三条方案生成没有依据的实际路线或运营信息。
