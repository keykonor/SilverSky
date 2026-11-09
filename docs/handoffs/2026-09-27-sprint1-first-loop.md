# SilverSky AI Sprint 1 交接：首个可运行规划闭环

日期：2026-09-27。交接对象：其他专业 Agent、总控 Agent 或网页端 GPT。状态以 [PROJECT_STATE.md](../PROJECT_STATE.md) 为准。

## 目标与验收结论

本轮贯通自然语言 → 老人需求结构化 → 已登记地点解析 → 地面及模拟低空候选 → 独立 Safety Review → 最多三条方案合成 → 可解释输出。Sprint 1 **技术验收通过**：天津 TJ-001 与深圳 SZ-001 均在本地 FastAPI 服务完成 `interpret → plan`。每城实际输出两条不同类型候选；缺乏有依据的第三条路线，因此不制造第三条。纯地面为 `PUBLIC_DATA` 驾驶模型估算，安全结果 `DOWNGRADE`；低空含 `SIMULATED_DATA` 空中段、缺失真实接驳及运营证据，整体 `DATA_UNAVAILABLE`、安全结果 `REJECT`，不可预订。两者均不作为真实可乘坐推荐。

## 本轮交付

- 初始化基线 Git 提交 `d70fab1`；稳定 Python 3.12.7 项目虚拟环境，依赖在 `requirements.txt`，本地用 `D:\anaconda\python.exe` 创建。`.venv/` 已被 `.gitignore` 排除。
- 六个仓库 Skill 从 `skills/` 移到 `.agents/skills/`，只保留一份；`AGENTS.md` 与相关文档引用已更新。每个 Skill 的官方结构校验通过。
- 两城 Golden 场景的自然语言夹具在 `examples/tj-001.interpret.json`、`examples/sz-001.interpret.json`。其中完整日期和时间是**测试补充**，不是原始用户事实。输入未给完整日期或地点时解释接口返回 `user_request:null` 和缺失项。
- `schemas/core.v0.1.schema.json` 增加解释请求/结果、`SAFETY_COMFORT`、`PASS/DOWNGRADE/REJECT/UNKNOWN` 与模拟/缺失路线不得 `PASS` 的规则；`schemas/datasets.v0.1.schema.json` 约束四个本地文件。`scripts/validate_contract.py` 验证有效样例、危险反例和数据集。
- `backend/` 提供 `GET /health`、`POST /api/v1/interpret`、`POST /api/v1/plan`；请求/响应经过 JSON Schema 校验，非法请求返回 422，Agent 输出不合约返回安全的 500。
- `agent/` 分离 Needs Interpreter、Candidate Planner、Safety Reviewer、Solution Synthesizer；只读数据服务校验本地数据集。Safety 逐段核对来源与模拟天气；缺失或损坏的模拟文件只撤销空中候选，保留可信地面候选。来源状态不一致时拒绝生成受影响路线。用户“附近”描述保留；OSM 中心点仅作估算代理，显式不一致的用户坐标不得静默替换。
- `scripts/demo_sprint1.py` 和 `README.md` 给出本地启动与两城演示；演示打印夹具日期来源说明。没有前端、Cesium、真实航班、支付、登录、PostGIS 或独立 MCP Server。

## 数据来源与边界

四处地点的名称和地址由[天津大学](https://tju.edu.cn/tdgk/tdxq/wjlxq.htm)、[天津政务网](https://www.tj.gov.cn/zwgk/ggqsydwxxgk/ylws/yy/202409/t20240923_6737587.html)、[深圳市养老护理院政府登记](https://www.sz.gov.cn/szzt2010/szyl/ylfw/jgylfw/yljgcx/content/mpost_11992149.html)、[北京大学深圳医院政府登记](https://www.sz.gov.cn/hospital/ssyy/bjdxszyy/content/post_9370612.html)人工核对。坐标取 OSM 对象中心点（© OpenStreetMap contributors，ODbL），驾驶距离/时间取一次性 OSRM 模型快照；详见 [DATA_SOURCES.md](../DATA_SOURCES.md)。中心点不是出入口，路线不含实时交通、步行、无障碍或实际车辆承诺。虚拟起降点、空中时长和天气情景完全模拟，无真实位置、航班、空域或价格。所有空中运营事实仍不可用。

## 决策与接口

`D-003`：项目 Skill 用 `.agents/skills/`；`D-004`：Sprint 1 用同进程只读数据服务，Sprint 2 再评估 MCP 适配；`D-005`：v0.1 核心契约收敛；`D-006`：两条有依据候选足以满足两种路线类型验收，数据失败关闭且 Safety 不给真实推荐。完整记录在 [DECISIONS.md](../DECISIONS.md)。跨模块调用、HTTP 状态和单位见 [INTERFACES.md](../INTERFACES.md)、[API_CONTRACTS.md](../API_CONTRACTS.md)。前端消费方尚未集成确认。

## 验证证据与运行

在仓库根目录运行：

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe scripts\validate_contract.py
.\.venv\Scripts\python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

另一窗口运行：

```powershell
.\.venv\Scripts\python.exe scripts\demo_sprint1.py tj-001
.\.venv\Scripts\python.exe scripts\demo_sprint1.py sz-001
```

本轮结果：`pytest` **27 passed**，1 个 FastAPI TestClient/httpx 弃用警告；契约脚本通过 2 个核心样例、3 个解释用例、9 个不安全路线变体、4 个数据集、1 个不安全数据集变体；两城真实本地 HTTP 演示均通过。六个 Skill 官方结构校验通过；Markdown 相对链接无缺失。只读 Reviewer 初审发现四项 P1 与两项 P2，四项 P1 与“模拟文件损坏回退”P2 已修复并复审，**无剩余 P0/P1**。

## 已知限制、风险与接手约束

1. 规则解释器只覆盖当前两城登记 POI 和有限中文日期表达；无法替代通用地理编码或自然语言理解。对未知地点返回缺项或无候选。
2. 真实出行推荐缺少精确出入口、无障碍、实际步行、可用车辆、实时天气与运营数据。不得把 `DOWNGRADE` 地面估算或 `REJECT` 模拟低空方案改成真实推荐。
3. Golden 夹具日期来源仅在演示输出及本文说明；`InterpretationResult.assumptions` 无法识别输入文字是否由夹具补写。独立复制 API 结果会丢失该来源说明，属于非阻断 P2，后续设计结构化来源字段前应避免把夹具文本当用户原话。
4. OSM 署名、来源时间与 `PUBLIC_DATA` / `SIMULATED_DATA` / `DATA_UNAVAILABLE` 必须贯穿新接口和展示。新增数据先核对许可及 Schema，再交 Safety Review；不能用模拟低空推断真实可飞性。
5. Sprint 2 尚未立项；优先补数据与接口消费证据，评估 MCP 只读适配和日期来源表达。任何重大架构变化依 `AGENTS.md` 先记录待决影响再实施。

接手顺序：先读 `AGENTS.md`、四份项目级状态文档与相关 `.agents/skills/*/SKILL.md`；运行上方验证命令；以 `docs/PROJECT_STATE.md` 确认当前范围，按照 `docs/INTERFACES.md` 核对跨模块影响。专业对话提交改动时附文件、接口/数据/安全影响、测试和未决事项。
