# Sprint 1 本地服务启动与 TJ-001 演示交接

日期：2026-09-27。任务：按仓库 README 启动已实现的 SilverSky Sprint 1 服务，不修改业务代码，实际调用天津 TJ-001 场景。项目长期状态以 [PROJECT_STATE.md](../PROJECT_STATE.md) 为准；服务是否仍在运行需接手时重新访问 `/health` 核实。

## 已完成与文件变化

- 使用现有 `.venv` 的 Python 3.12.7。执行 `.\.venv\Scripts\python.exe scripts\validate_contract.py`，通过；执行 `.\.venv\Scripts\python.exe -m pytest -q`，27 passed、1 个 TestClient/httpx 弃用警告。
- 按 README 启动 `.\.venv\Scripts\python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8000`。启动时 Uvicorn 报告服务已运行；浏览器文档页 `http://127.0.0.1:8000/docs` 返回 HTTP 200。
- `GET http://127.0.0.1:8000/health` 返回 HTTP 200、`{"status":"ok"}`。
- 读取 `examples/tj-001.interpret.json`，`POST http://127.0.0.1:8000/api/v1/interpret` 返回 HTTP 200，`missing_fields: []`，`user_request` 保留起点“天津大学卫津路校区附近”、终点“天津医科大学总医院”、78 岁、`LIMITED`、需陪同、`SAFETY_COMFORT`、`NORMAL`、`air_option: UNSPECIFIED`。
- 将本次解释结果的 `user_request` 发送到 `POST http://127.0.0.1:8000/api/v1/plan`，返回 HTTP 200、`schema_version: 0.1-proposal`、两条方案：`TJ-001-GROUND`（`GROUND_ONLY`、`PUBLIC_DATA`、安全 `DOWNGRADE`，OSRM 驾驶模型 1997.4 米 / 4.6767 分钟）；`TJ-001-AIR-SIM`（`GROUND_AIR_GROUND`，AIR 段 `SIMULATED_DATA`、整路 `DATA_UNAVAILABLE`、安全 `REJECT`，不能预订）。运行 `.\.venv\Scripts\python.exe scripts\demo_sprint1.py tj-001` 可打印完整的解释结果与规划结果。
- 本轮**没有修改任何代码、Schema、数据集或运行配置**；仅新增本交接文档并更新 [HANDOFF.md](../HANDOFF.md) 的最新入口。没有做架构或接口决定。

## 输入来源与安全说明

TJ-001 夹具文本中的完整日期 `2026-09-28 15:00 +08:00` 是测试补充，不是原始用户给出的日期。地面距离/时长来自 2026-09-26 抓取的 OSM/OSRM 驾驶路线快照，起点“附近”以 OSM POI 中心点作模型代理，非真实门到门路程；实际步行、无障碍、车辆、天气和接送情况未知。低空起降点与空中时长是模拟情景，不存在已核验的真实航班、起降点、接驳或价格。结果含 `© OpenStreetMap contributors` 署名。来源与限制见 [DATA_SOURCES.md](../DATA_SOURCES.md)。

## 未完成事项、风险与下一步

- 本服务仅监听 `127.0.0.1:8000`，可由本机浏览器访问；其他设备不能直接访问。服务运行状态是临时的，接手时先调用 `/health`，若未运行按 [README.md](../../README.md) 的命令重新启动。
- 演示返回两条有证据边界的方案，没有生成缺乏独立数据支撑的第三条。两条均不是可直接执行的真实出行推荐。
- `InterpretationResult` 本身不携带“日期由夹具补充”的来源标签；单独转交 API JSON 时须同时附本交接说明，后续契约改进见 [DECISIONS.md](../DECISIONS.md) D-006。
- 后续如需前端或其他 Agent 消费结果，先读 [INTERFACES.md](../INTERFACES.md)、[API_CONTRACTS.md](../API_CONTRACTS.md)、[PROJECT_STATE.md](../PROJECT_STATE.md) 和 `AGENTS.md`；保留公开、模拟、不可用状态及 Safety 结论，不将本演示当作真实航空运营证据。
