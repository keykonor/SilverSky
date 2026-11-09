# SilverSky V3

> GitHub 首发为当前 V3 源码快照，包含前后端与测试。公开展示页不运行后端。本机证据与历史归档单独保留；厂商图片请查看目录中的官方来源。

面向老年人及其子女的综合出行规划 MVP，首期天津、深圳。优先级：**安全 > 舒适 > 可达性 > 时间 > 成本**。地面数据按来源展示；低空数据明确为模拟，不表示真实航空服务可用或可预订。

当前版本为 **SilverSky V3（3.0.0）**，于2026-11-07按用户要求将当前完整开发版命名为V3，包含文字/语音行程规划、真实地面路线、模拟空中路线、基础3D城市与航空器产品库。[V3版本定义](docs/releases/v3.0.0.md) / [版本号](VERSION)。工作分支仍为 `codex/silversky-v2-mvp`，名称沿用开发历史。真实 DeepSeek、高德选点/驾车、模拟空中线与 Cesium 基础建筑已在 Windows Chrome / Edge 实测；**用户已确认本机语音转写规划成功，最终产品复评仍待反馈**。旧 Sprint 页面保留在 `/?legacy=1`；完整状态以 [PROJECT_STATE.md](docs/PROJECT_STATE.md) 为准。

## 运行地址

| 用途 | 默认地址 |
| --- | --- |
| V3 前端页面 | http://127.0.0.1:5173/ |
| 航空器产品索引 | http://127.0.0.1:5173/aircraft |
| 保留的旧版页面 | http://127.0.0.1:5173/?legacy=1 |
| 后端服务 | http://127.0.0.1:8000（根路径返回 404 正常） |
| 健康检查 | http://127.0.0.1:8000/health |
| API 交互文档 | http://127.0.0.1:8000/docs |
| OpenAPI | http://127.0.0.1:8000/openapi.json |

## 首次安装（Windows PowerShell）

在仓库根目录执行。使用 Python 3.12、Node.js >=22.12 和 npm；当前本机已验证 Python 3.12.7 / Node 24.15.0。Node 下限依据当前锁文件中 Vite / Cesium 的共同要求。不要为安装顺手升级依赖。

```powershell
python --version
node --version
npm --version
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Push-Location frontend
npm ci
Pop-Location
```

若 `python` 不是 3.12，可用 `py -3.12 -m venv .venv` 或本机实际的 Python 3.12 路径。已有 `.venv` 时无需重建。Python 依赖范围在 requirements.txt，前端精确依赖由 package-lock.json 记录。

## 环境变量

仅在模板不存在对应本地文件时复制，不覆盖已有凭据：

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
if (-not (Test-Path frontend/.env.local)) { Copy-Item frontend/.env.example frontend/.env.local }
```

编辑本地文件填写自己的值；所有 `.env*` 真实配置已被 Git 忽略，模板 `.env.example` 可以提交。不要把凭据发到聊天、截图或提交里。变更后重启相关服务。

| 变量 | 位置 | 用途 / 是否必需 |
| --- | --- | --- |
| AMAP_WEB_KEY | 根 .env | 高德浏览器 JS API Key；在线地图需要，可由浏览器看到，应限制授权域名 |
| AMAP_SECURITY_JS_CODE | 根 .env | 高德安全码；由本地 Vite 安全代理处理，不硬编码到前端 |
| AMAP_WEB_SERVICE_KEY | 根 .env 或后端进程环境 | 高德 Web 服务 Key；在线 POI / 地面路线查询需要，后端优先读取进程环境 |
| DEEPSEEK_API_KEY | 根 .env 或后端进程环境 | 当前版需求分析必需，优先进程环境，仅后端读取 |
| DEEPSEEK_MODEL | 根 .env 或后端进程环境 | 可选，默认 deepseek-chat，本机已实际调用；可按服务账户配置 |
| VITE_CESIUM_ION_TOKEN | frontend/.env.local | 可选 ion 公共资产只读 Token；会进入浏览器，不能使用私有写权限 Token |
| CHROME_PATH | 浏览器测试进程环境 | 可选；Chrome 不在默认 Windows 路径时指定可执行文件 |
| FRONTEND_URL | 浏览器测试进程环境 | 可选；E2E 默认 http://127.0.0.1:5173/ |

没有高德配置仍可运行旧版本地解释/规划与静态 Golden 数据流程，在线地图与查询不可用时显示降级说明，不补造数据。ion Token 不影响基础本地演示。V3沿用V2的现有 DeepSeek 配置；旧版仍可使用本地规则。无需 OPENAI_API_KEY 或新的 API_BASE_URL。外发范围按用户既有授权与 D-019 执行，公网部署仍待 D-013。

## 启动（两个终端）

本机入口打不开时，从项目根目录在 PowerShell 运行：

```powershell
.\scripts\start-local.ps1 -OpenBrowser
```

脚本检查并启动缺失的前后端，验证首页代理后打开浏览器。服务已运行时可重复执行。若端口由其他程序占用，请查看脚本提示与 `.verification/local-start/` 日志。

首页可直接点“手动选点”，分别查找并确认两端后点“查看地面路线”。DeepSeek 失败时也能用这条高德路线流程，返回文字输入可继续编辑原文。

终端 A，在仓库根目录：

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

终端 B：

```powershell
Set-Location frontend
npm run dev -- --port 5173 --strictPort
```

打开 http://127.0.0.1:5173/。停止服务在各自终端按 Ctrl+C。前端 Vite 将 `/health`、`/api` 转发到本地 8000；高德配置与安全代理也是本地开发能力。`npm run build` 生成静态产物，但不自动提供生产代理或公网部署；生产方案仍受 D-013 约束。

第三个终端，在根目录检查文件、Schema 和本地连通性：

```powershell
.\.venv\Scripts\python.exe scripts/check_project_ready.py --smoke
```

`--smoke` 只读取固定的本地健康、OpenAPI、前端和前端代理地址，不调用收费地图服务，不读取凭据。不开服务时去掉 `--smoke` 做离线检查。

## 如何试用

V3 输入“我想从天津大学卫津路校区去天津医科大学总医院。”，点击「完成」；可选地面/模拟空中路线与「3D 城市」。输入“从天津大学去总医院。”时应先点选两端具体地点，选齐后立即规划，无需额外确认。「修改行程」保留原文。

语音：按住「按住说话」，松开等待转写，检查或修改后再点击「完成」。浏览器需麦克风权限和语音网络服务；不可用时使用文字或点击文本框后按 Win+H。应用不保存录音，浏览器服务可能联网识别。点击完成才将文字发送 DeepSeek；地点检索/道路查询发高德，起点建筑查询仅公开坐标发 OSM。不要输入姓名、电话等隐私。供应方保留政策未独立核验。

3D 建筑为起点约400米街区的 OSM 真实轮廓，最多100栋；无可靠高度用12米示意并标注。底图为在线OSM道路/地名（失败回退本地概览）、椭球平面地形，航空器为原创通用模型；示意高度不是获批飞行高度。道路未经核心 Safety 审查，入口/无障碍需核实，模拟空中不可运营或预订。

旧版两城 Golden 与核心 Safety 仍可通过 `/?legacy=1` 使用。

也可在根目录运行既有后端演示：

```powershell
.\.venv\Scripts\python.exe scripts/demo_sprint1.py tj-001
.\.venv\Scripts\python.exe scripts/demo_sprint1.py sz-001
```

examples 中的日期是可重复测试夹具，不是用户真实行程，也不是今天仍有效的运营时刻。公开道路快照不含实时交通、入口/上下车点或无障碍保证。模拟低空不可预订。

## 测试、类型检查与构建

根目录：

```powershell
.\.venv\Scripts\python.exe scripts/check_project_ready.py
.\.venv\Scripts\python.exe scripts/validate_contract.py
.\.venv\Scripts\python.exe scripts/verify_data_baseline.py
.\.venv\Scripts\python.exe scripts/verify_version_archives.py
.\.venv\Scripts\python.exe -m pytest -q

git diff --check
```

若当前受限环境不能写 pytest 默认缓存/临时目录，可指定仓库内的独立目录，不跳过测试：

```powershell
New-Item -ItemType Directory -Path .verification -Force | Out-Null
.\.venv\Scripts\python.exe -m pytest -q -p no:cacheprovider --basetemp=.verification/pytest-local-run
```

`--basetemp` 使用专用临时目录，pytest 会清理该目录，不放用户文件。前端：

```powershell
Set-Location frontend
npm run typecheck
npm run test
npm run build
npm run test:v2
npm run test:v2-failures
```

当前没有 `npm run lint` 或 Ruff 配置，不运行不存在的脚本，也不为整理文档引入新工具。按风险选相关测试；涉及公共契约时执行契约校验和相关前后端回归。

浏览器检查需要两个服务正在运行，并安装 Chrome（默认 `C:\Program Files\Google\Chrome\Application\chrome.exe`）；在线地图检查另需合法配置和网络：

```powershell
# 在 frontend/ 运行；旧版专项按以下地址运行
$env:FRONTEND_URL = "http://127.0.0.1:5173/?legacy=1"
npm run test:e2e
npm run test:amap-local
npm run test:scene-fallback
npm run test:scene-performance
npm run test:a11y
npm run test:zoom-200
```

自动化不替代老人/照护子女试用、Narrator 实际朗读或生产环境验收；未运行的检查不能报告通过。

## 常见问题

| 现象 | 检查 |
| --- | --- |
| 5173 / 8000 被占用 | 先确认占用进程；不要终止未知服务。使用默认端口便于代理和测试一致 |
| 页面 API 502 | 后端是否在 8000 启动；先访问 /health；检查终端错误 |
| 后端首页 404 | 访问 /docs 或 /health，后端没有产品首页 |
| 在线地图/查询失败 | 本地变量、平台类型、域名限制、配额和网络；不打印 Key，不画伪线 |
| ion 图层加载失败 | 可选外部资源，不代表本地流程整体失效；检查降级说明 |
| 测试出现 EPERM / 权限错误 | 区分环境权限与代码失败，保留错误证据；不可删测或报告通过 |
| Schema 基线失败 | 审查契约 diff 和调用方，不盲目重算哈希接受变更 |

## 开发与文档入口

| 主题 | 文件 |
| --- | --- |
| 开发规则 | [AGENTS.md](AGENTS.md) |
| 用户请求、需求与验收追溯 | [requirements/README.md](docs/requirements/README.md) |
| 开发 Agent 分工、任务卡、完成条件 | [DEVELOPMENT.md](docs/DEVELOPMENT.md) |
| Schema 固定与受控变更 | [schemas/README.md](schemas/README.md) |
| 当前状态 / 路线图 | [PROJECT_STATE.md](docs/PROJECT_STATE.md)、[ROADMAP.md](docs/ROADMAP.md) |
| 产品目标与 MVP | [PRODUCT_VISION.md](docs/PRODUCT_VISION.md)、[MVP_SCOPE.md](docs/MVP_SCOPE.md) |
| 接口与历史决定 | [INTERFACES.md](docs/INTERFACES.md)、[API_CONTRACTS.md](docs/API_CONTRACTS.md)、[DECISIONS.md](docs/DECISIONS.md) |
| 架构 / 运行时 Agent | [ARCHITECTURE.md](docs/ARCHITECTURE.md)、[AGENT_ARCHITECTURE.md](docs/AGENT_ARCHITECTURE.md) |
| 数据来源和限制 | [DATA_SOURCES.md](docs/DATA_SOURCES.md)、[DATA_POLICY.md](docs/DATA_POLICY.md) |
| 最新交接 | [HANDOFF.md](docs/HANDOFF.md) |
| Git 与历史版本 | [GIT_MANAGEMENT.md](docs/GIT_MANAGEMENT.md)、[versions/README.md](versions/README.md) |
| Codex / WorkBuddy 交接 | [PORTAL_INTEGRATION.md](docs/PORTAL_INTEGRATION.md) |

根目录是当前开发版，历史目录 versions/ 冻结；三个标签为 archive/v1-sprint1、archive/v2-sprint2、archive/v3-sprint3。保留原历史和分支，目前未配置远端。项目 Skills 位于 `.agents/skills/`，按 AGENTS.md 中的任务类型读取。

V2 浏览器检查默认根页面，`npm run test:v2` 调用真实 DeepSeek/高德/OSM，使用公开地点句，会消耗现有账户配额；`test:v2-failures` 的语音为明确事件桩，不能当作声学识别。Edge 复验可先设置 `$env:V2_BROWSER = "edge"`。结果与截图在 [V2 证据](docs/evidence/v2-mvp/README.md)。旧版 `test:e2e` / `test:amap-local` 默认已转到保留入口，断言未降低；其余历史专项需上述 FRONTEND_URL。

按本轮实际试用反馈，新增左侧「地面行程时间」：可选现在出发或北京时间日期/时间，显示预计到达；输入“明天下午3点”可预填，模糊时间需确认。耗时基于高德当前道路估算，不是未来拥堵预测，模拟空中没有可用运营时间。反馈复现检查：`node tests/v2-feedback.mjs`；[最新交接](docs/handoffs/2026-10-08-v2-feedback-map-time.md)。

## 基础城市模型

规划后点「3D 城市」，用「起点街区」「终点街区」近看楼宇，或切换「显示建筑」。每端最多200栋真实OSM轮廓，合计去重最多400栋；缺少高度时12米示意，非整城或实景纹理。两端建筑数据独立，部分失败保留成功街区并可重试。无需新增凭据，当前未配置ion整城模型。

Chrome/Edge本机实测400栋、显示切换/近景/部分失败恢复通过；复现进入frontend执行 `node tests/v2-city.mjs`，Edge先设置 `$env:V2_BROWSER='edge'`。详见[城市模型交接](docs/handoffs/2026-10-08-v2-city-model.md)。

## 航空器产品库

主页面右上角“航空器产品”在新标签打开索引，保留原行程。首批12款（国内9、国外3），有对应官方图片、型号、生产公司、主要性能与工况；可按用途、产地、驾驶方式、公司组合筛选并搜索，点击产品进入详情查看来源。有人驾驶eVTOL与研发机单独标注，目录不代表可购买、可预订或获准执行航线；它是代表型号索引，非全市场清单。

[Figma可编辑设计](https://www.figma.com/design/hiQYqQgFzNgWf6Tpwvo7zl?node-id=6-180)实际套用Simple Design System的Page Product Results模板。图片版权归厂商，公网商业使用前另行确认授权。资料核对日2026-11-06；[交接与资料审计](docs/handoffs/2026-11-06-aircraft-catalog.md)。

在frontend运行`node tests/catalog.mjs`复验Chrome；先设置`$env:CATALOG_BROWSER='edge'`后同命令复验Edge。目录静态资料不依赖厂商站点实时响应；生产托管需支持/aircraft深链接回退到index.html，公网仍待D-013。

### 全城模型与模拟飞行 Agent

本机已有天津城市包时，打开首页后依次点击“3D 城市”“全城模型与飞行 Agent”“填入模拟示例”“生成模拟轨迹”。也可在地图选择端点或输入 WGS84 经纬度。Agent 输出模型地面标高、模拟起升与下降量和轨迹，明确区分来源楼高、遥感估计和未知楼高。城市数据准备、API 示例与桌面验证见[交接](docs/handoffs/2026-11-07-city-flight-agent.md)。
