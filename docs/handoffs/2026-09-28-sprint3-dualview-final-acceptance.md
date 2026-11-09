# SilverSky AI — Sprint 3 双视角本地 Demo 最终交接

日期：2026-09-28。状态以 [`PROJECT_STATE.md`](../PROJECT_STATE.md) 为准：**Sprint 3 本地 Demo PASS**；公开部署、真实出行推荐与可选 Cesium ion 在线图层不在本次验收结论内。用户确认没有实际比赛环节，“比赛级”只表示演示质量。

## 本轮目标与完成内容

完成 Sprint 3 剩余的城市三维空间表达、两城回归、独立复核和阶段资料收尾。原高德主地图为平面路线投影，模拟低空只有高德失败时才显示立体航迹；现在同一地图区域提供“真实城市地图”和“立体旅程示意”，地面方案默认前者，模拟低空方案默认后者。天津、深圳本机真实高德街区近景与 Cesium 爬升、巡航、下降分别留有截图。地图来源、模拟标记、安全拒绝和静态道路限制始终可见。

产品结果页增加“规划协作”角色与可观察的需求理解、候选生成、安全审查结果，明确这些角色当前由本地规则流程承担；未接入外部 LLM。与旅程无关的福建省边界核验移入折叠诊断；地面图例只列实际存在的线路。Cesium 的无效坐标不再计入“可绘制几何”。高德 JS 脚本卡住时从请求前开始计时，20 秒内明确切回 Cesium；坐标转换失败时不绘造路线，安全 `REJECT` 不变。

## 关键决定、架构与接口

- D-015：高德 JS API 2.0 提供本地城市 3D 背景，Cesium 独立显示模拟空中视觉高度；在同一地图区域切换，两套地图不共享图块或凭证。高德中的空中线明确为**地图投影**。一个 Cesium Viewer 在第一次需要后保持挂载，切换路线不重建。
- V-002：沿用 V-001 和 A-001 的 `RouteOption`、WGS84 几何与来源状态；高德绘制前经本地代理转换到 GCJ-02。没有改 HTTP、Backend、Agent、核心 JSON Schema、数据文件或 Safety 结论。没有软件内 API Key 输入界面。
- 来源：天津/深圳真实地面证据仍为 OSM POI 中心点和 OSRM 静态道路快照；模拟起降点、接驳与低空线为 `SIMULATED_DATA`。高德楼块和可选 Cesium 地形/建筑只是背景，不证明出入口、无障碍、真实设施、飞行可行性或运营许可。原生地图/数据署名保留。
- 许可与网络：本机高德地图、福建边界及两城坐标转换已实测；公网授权域名、生产代理、公开使用许可和配额依 D-013 待决。没有实际比赛现场。可选 ion token 未配置；World Terrain/OSM Buildings 成功路径与在线性能未测。无 token 时使用包内 NaturalEarthII；外部图层请求失败和高德脚本阻断的本地降级已测。

## 修改文件与归属

本轮直接修改：`frontend/src/components/AmapRouteMap.tsx`、`RouteMap.tsx`、`RouteMap.css`、`App.tsx`、`App.css`；`frontend/tests/amap-local-check.mjs`、`e2e.mjs`、`accessibility.mjs`、`scene-fallback.mjs`、`scene-performance.mjs`、`zoom-200.mjs`、`sprint3-evidence.mjs`；`docs/DECISIONS.md`、`INTERFACES.md`、`DATA_POLICY.md`、`DATA_SOURCES.md`、`ROADMAP.md`、`MVP_SCOPE.md`、`PROJECT_STATE.md`、`HANDOFF.md` 与本交接；更新 `docs/evidence/sprint3/` 截图。部分列出的文件及其他工作树改动来自此前 Sprint/用户工作，本轮没有把既有未提交改动冒认成新的独立提交。

## 验证结果与 S3 用例

| 用例 | 本地证据与结论 |
| --- | --- |
| S3-01、02、19 | Cesium 3D Scene 可打开；无效 ion token/网络阻断和高德 JS 阻断后显示本地地图、仍可规划，`test:scene-fallback` PASS |
| S3-03、04、05、06 | 两城地面与模拟空中浏览器截图；`RouteMap.test.ts` 验证 0→800→0 米**视觉高度**及输入几何不变；安全文案标模拟，PASS |
| S3-07、08、09、10 | 模拟起降点详情、20 次 A/B 切换保持单 Viewer、完整路线镜头与双视角截图，PASS |
| S3-11、12、13、14 | REJECT 无绿色认可、前端枚举可读化、canonical POI 摘要、深圳路线/标签及镜头复位，在 E2E/截图复核，PASS |
| S3-15、16 | TypeScript 生产构建、契约脚本、数据集校验和后端回归，PASS |
| S3-17、18、20 | 六状态 axe/键盘、Safety 独立复核、两城 Golden/Sprint 2 E2E 与 84 项 Python/18 项前端单测，已测范围 PASS |

命令实测：`.venv/Scripts/python.exe -m pytest -q` **84 passed**（原有 TestClient/httpx 弃用警告）；`scripts/validate_contract.py` PASS；`npm test` **18 passed**；`npm run build` PASS；`npm run test:e2e` PASS；`npm run test:amap-local` PASS，包含天津/深圳高德 3D、福建边界 `350000`/421 段、坐标转换 503 时不留线路且 Safety `REJECT` 不变；`npm run test:scene-fallback` PASS，包含高德脚本阻断 20 秒回退；`npm run test:a11y` PASS，含键盘切至成功加载高德的状态；`npm run test:zoom-200` PASS（**720×450 CSS 视口、DPR2 近似**）；截图脚本 PASS。独立性能复测 20 次切换：中位数 **87ms**、P95 **159ms**、最大 **668ms**，单 Viewer canvas、无页面脚本错误；JS heap 约 80.3→99.7MB，未强制 GC，不能推出长期稳定性。`git diff --check` 无空白错误（Git 只报告现有 LF→CRLF 提示）。

截图在 [`docs/evidence/sprint3/`](../evidence/sprint3/)：天津/深圳城市近景、立体航迹、完整旅程、起降点详情、安全拒绝、数据说明、镜头复位、网络失败降级及缩放布局近似。本轮目视检查了两城街区、模拟航迹、深圳完整线路与安全拒绝截图；这不是对每张图片的逐像素审查。

## 独立复核与验收门槛

- Product：本地双视角 Demo **PASS**，P0/P1=0；原七问六项“是”，Agent 参与感起初为“部分”。其 P2 福建诊断占位和分工可见性已修正并重拍截图。第 4/6 项 Ground + Air 与 3D 理解均为“是”。
- Safety：本地双视角专项 **PASS**，P0/P1=0；无效坐标、转换失败不画线、高德卡住回退与 `REJECT` 保持已核对。独立复核未自行重跑浏览器脚本。
- Accessibility：独立结论 **PARTIAL（证据范围）**；已测 axe/键盘、320px 宽布局和高德网络阻断回退未见 P0/P1。主 Agent 在本机成功高德分支跑通六状态 axe；审查 Agent 的隔离环境无法独立加载第三方高德资源。真实屏幕阅读器及浏览器原生 200% 缩放**未测**，720×450/DPR2 仅是布局近似。原 S3-17“无 serious/critical”在已测范围成立，故本地阶段门槛达成，不宣称所有设备无障碍已验收。
- Contract：V-002 仅为前端可视化契约；HTTP/Schema/Agent 无新增字段，类型、契约、后端验证通过，未见 P0/P1。Sprint 3 原指令的 18 项本地退出门槛均有对应实现、回归或复核；可选在线图层和不存在的比赛现场不作为本地必需项。

## 项目资料审计

先以 `git ls-files --cached --others --exclude-standard` 盘点 **141 个仓库内容文件**（100 已跟踪、41 非忽略未跟踪）：`.agents` 8、`agent` 7、`backend` 2、`data` 11、`docs` 68、`examples` 4、`frontend` 26、`schemas` 2、`scripts` 2、`tests` 6，另有根目录资料与配置。另识别 26,675 个 Git 忽略条目，主要为 `.venv` 与 `frontend` 的依赖/构建文件；`.env` 为其中 1 个，**只确认忽略状态，没有读取或记录密钥值**。本轮按风险核对了四份主项目文档、D-014/D-015/V-001/V-002、数据来源与安全说明、两套地图实现、核心浏览器/契约测试及截图；未逐文件人工审阅 141 个内容文件，也未审查依赖内部源码。

方法：`rg` 检索旧赛事/高德状态与边界文案；`git diff --check`；Python 契约/pytest；前端构建、单测、两城浏览器 E2E、故障、axe、缩放布局近似和性能；目视查看关键截图。文档与代码现在一致地把高德列为本地已接入、把比赛现场列为不存在，并保留 D-013 公开发布待决。历史 D-012/D-013 仍保留作当时决策记录，以后续 D-014/D-015 作为当前边界。

### 发现的问题

1. `frontend/tests/accessibility.mjs` 与 `docs/evidence/sprint3/zoom-200-result.png`：真实屏幕阅读器和浏览器原生 200% 缩放未核验；影响是无法对这些运行环境作完整无障碍承诺。状态：**未验证，Sprint 4/目标设备验证**。
2. `frontend/src/components/RouteMap.tsx` 可选 ion 分支与 `docs/DATA_SOURCES.md`：World Terrain/OSM Buildings 的成功加载、在线配额、低配设备及长期性能未实测；影响只在选择可选在线背景或换设备展示时出现。状态：**未验证，可选能力**。
3. `frontend/vite.config.ts` 的本地高德代理和 `docs/DECISIONS.md` D-013：公开部署许可、正式域名/代理和配额待决；影响是当前结果不能据此公开上线。状态：**待决，先决策后部署**。
4. `docs/PROJECT_STATE.md` 与本交接：Sprint 3 本地 PASS 依据 axe/键盘与原指令门槛，Accessibility 审查的范围结论为 PARTIAL；影响是不能将“本地阶段 PASS”扩大解释成真实屏幕阅读器验收。状态：**已在状态和交接中明确界定**。

未发现新的本地 P0/P1、接口破坏、模拟冒充真实或未标来源的地图结果；对未人工核验的文件不作“全部无问题”断言。

## 未完成事项、风险与接手约束

没有真实航班、起降设施、可飞航线、天气、空域、可用车辆、精确上下车点或完整无障碍路线证据；地面 `DOWNGRADE`、模拟低空 `REJECT`，任何人不得因三维画面改判安全。D-008 外部 LLM 与个人出行信息发送仍待决。后续 Sprint 4 应优先补目标设备屏幕阅读器/原生缩放、故障恢复与低配设备长期运行；公开发布前单独完成 D-013。保留地图原生署名和模拟提示，不增加软件内 Key 输入功能，不把高德地图背景当作路线证据。

## Git 状态

本轮**未创建提交**。开工前工作树已有跨 Sprint、Skill、Remotion 与 WorkBuddy 的未提交改动；最终盘点有 41 个非忽略未跟踪文件。为避免把他人或前轮资料混入一个 Sprint 3 提交，保持现状供接手者按文件归属审查后再分批提交。当前提交哈希未在本轮改变；不能把工作树 PASS 当成已提交版本。
