# Sprint 2 Web App 本地集成交接（2026-09-27）

## 本轮目标与状态

产品负责人正式启动 Sprint 2：让老年用户或子女在浏览器中完成自然语言多轮规划、阅读需求与路线、安全/来源说明，并在 Cesium 基础地图中切换方案。当前状态以 [PROJECT_STATE.md](../PROJECT_STATE.md) 为准：**本地技术链路已运行，Sprint 2 最终产品验收尚未完成**。不能把地图示意或零候选当作真实线路验收。

## 已完成和修改文件

- 前端 `frontend/`：Vite + React + TypeScript + Cesium；`src/api/client.ts` 集中封装 `/health`、`/api/v1/interpret`、`/api/v1/plan`；`src/types/contracts.ts` 对齐现有核心 Schema；`src/App.tsx` 实现欢迎、Demo 输入、多轮状态回传、后端追问、需求摘要、规划门控、急症阻断、路线卡片、解释、安全/来源、零候选、错误、重新规划和键盘发送；`src/components/RouteMap.tsx` 使用本地 NaturalEarth II 底图，只使用返回坐标，缺失时以文字说明。`src/App.css` 和地图样式包含适老化文字、焦点与对比度修正。
- 后端 `agent/interpreter.py`：对已有具体目的地且刚追问起点的短会话，单个明确地点回答可填入起点；无上下文或“医院/家里/深圳南山区”等泛称继续澄清。明确提及父母却没有行动情况时，在既有待澄清状态中延后询问行动能力；医疗急症提示优先，不附普通偏好追问。`tests/agent/test_needs_interpreter_sprint15.py` 加入指定三轮与反例，原时间窗口边界测试给出行动情况以符合新追问门槛。
- 项目文件：更新 `README.md`、`docs/PROJECT_STATE.md`、`docs/ROADMAP.md`、`docs/INTERFACES.md`、`docs/API_CONTRACTS.md`、`docs/DECISIONS.md`，新增 [SPRINT2_PLAN.md](../SPRINT2_PLAN.md)；`.gitignore` 排除依赖、构建及本地浏览器产物。
- 本轮开始时工作区已有 Sprint 1.5 和 P01–P20 的未提交代码、契约、测试与两份交接文档。本轮在其上继续并保留；本交接中的 67 项后端测试包含这些先前改动，不应误记为全由 Sprint 2 新增。

## 关键决定与依据

- D-010 已采纳：桌面优先 Web App 复用现有 HTTP/`planning_state` 契约，当前会话只在浏览器内存中保存，不新增登录、服务器 Session、外部 LLM 或长期画像。规划仅在 `planning_allowed:true`、`user_request` 非空且非医疗急症时调用；后端 422 急症阻断保持。
- 地面快照只有距离和时长，没有道路 GeoJSON；天津 Golden 起点“附近”不带精确坐标，模拟起降点也无坐标。地图只画有两端坐标的虚线示意连接，明确说明不是实际道路/航线/高度；缺坐标时显示“位置待确认/暂无可绘制线路”。页面不地理编码、不猜入口、不制造第三条路线。
- D-011 待决：若要完成真正线路展示和指定口语最终演示的路线卡片，建议采集有来源的静态地面几何并设计可选兼容字段，地点简称先由用户澄清。该决定影响跨模块接口与数据来源，按 `AGENTS.md` 在产品负责人裁决前不实施。
- WorkBuddy 只读任务曾尝试交付 UX 检查，但自动审批拒绝，理由是会向未核验外部目的地传送项目文档和 Sprint 2 附件；没有绕过审批。后续由本地 Agent/主 Agent 完成前端、地图与审查。

## 验证结果

| 范围 | 实际结果 |
| --- | --- |
| 后端 | `.venv/Scripts/python.exe -m pytest -q`：67 passed，1 条既有 TestClient/httpx 弃用警告；`.venv/Scripts/python.exe scripts/validate_contract.py`：通过原有核心、时间窗口、数据源和不安全变体验证 |
| 前端 | `npm test`：13 passed；`npm run build`：TypeScript 与 Vite 生产构建通过；`dist/cesium/` 包含本地 Cesium 资源 |
| 真实浏览器 | `npm run test:e2e`：本机 Chrome 通过首次页面、天津/深圳 Demo、双方案地图切换、指定三轮追问、零候选、医疗急症不调用 plan、Enter 发送 |
| 无障碍 | `npm run test:a11y`：首次、路线结果、医疗急症三个浏览器状态无 axe serious/critical 违规；修复了焦点区域、隐藏地图焦点和品牌副标题对比度。仍需产品/老人用户人工评审 |
| Git | `git diff --check` 无空白错误；Windows 换行提示不影响结果。尚未将阶段标记为产品验收 |

F01–F19 的核心行为已由前端单元、浏览器脚本或后端定向测试覆盖；F20 通过 TypeScript 类型检查、两城真实 HTTP 浏览器调用与核心契约脚本做样本级对照，尚未生成由 Schema 自动推导的类型。安全卡片从真实返回动态渲染数量：天津、深圳 Golden 当前均为两类候选；指定口语三轮的简称地点则为零候选。

## 未完成、Blocker 与风险

1. 指定最终口语示例“我父亲明天下午要去天津医大总医院。”→“天津大学。”→“78岁，腿脚不方便……”现在会正确逐轮追问并进入 `/plan`，但两处简称未精确匹配登记 POI，返回零候选和警告。不能按总指令展示真实路线卡片与对应地图线路。
2. 当前地图有基础地理概览和已返回坐标的地点标记；只有坐标两端完整时才显示示意虚线。无真实道路几何或模拟起降点坐标，故“真实线路展示”退出门槛仍未满足。D-011 需要产品负责人选择。
3. 公开驾驶估算没有实时候车、接送车辆、入口、无障碍、步行、天气保证；真实低空运营仍 `DATA_UNAVAILABLE`。所有现有候选均不应标为安全真实推荐或可购票。
4. 本地规则覆盖已测口语，任意自由表达与方言泛化未证明；D-008 的 LLM/个人出行文本边界仍待决。页面不向外部模型发送用户文本。

## 下一步及接手约束

1. 产品负责人对 D-011 的有来源几何/简称澄清方案作明确决策；若采纳，先更新 `docs/INTERFACES.md`、核心/数据集合同与来源清单，再实施数据、Agent 和地图，并补合同与浏览器失败降级测试。
2. 对本轮 Web App 做产品和老人用户人工评审；保留本轮自动无障碍、安全和两城结果作为证据，不自动宣称 Sprint 2 完成。
3. 继续数据证据补全。禁止把 POI 中心点视为入口、把静态驾驶快照视为实时门到门路径、把模拟低空标成真实运营；无可靠数据继续使用 `DATA_UNAVAILABLE`。
4. 可用 README 的两个终端启动前后端；前端在 `http://127.0.0.1:5173/`。`npm run test:e2e`/`npm run test:a11y` 需本机 Chrome、两个服务在运行。本轮提交将包含开始时已有的 Sprint 1.5/P01–P20 已验证改动与 Sprint 2 新增内容；接手时先核对 Git 状态和本交接。
