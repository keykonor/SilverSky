# 2026-09-27 高德地图与 Remotion 本地接入交接

## 目标与授权

用户要求从高德截图核对 Web 端 JS API Key、对应安全密钥及 Web 服务 Key，写入项目根 `.env`，在现有地图界面真实加载中国全貌并查询福建省边界，同时完成 Remotion 本地接入。只做本地预览，不制作旅行足迹动画，不公网部署。平台类型或字符无法从截图核实时必须先确认，不能猜。

## 已完成

- 截图有两条 Key，第一条同一行有安全密钥；没有显示两条 Key 的控制台平台类型。已请求用户确认，未抄录或输出真实凭证。
- D-014 登记本地实施范围、备选、影响、回退和门槛；A-001 登记本地配置、代理、WGS84→GCJ-02 显示转换及失败状态。D-013 的公网和许可范围仍待决。
- 现有 `RouteMap` 尝试加载高德 JS API 2.0，以中国为初始视野；`AMap.DistrictSearch` 查询福建省边界并在成功时绘制。既有 WGS84 路段经同源本地服务代理调用 Web 服务坐标转换，成功后叠加；失败不补造线路，原生署名不隐藏。
- Vite 本地服务从根 `.env` 读取三项变量。`/__amap_config` 仅向浏览器提供 Web 端 Key；`/_AMapService` 在本地代理附加安全密钥；`/__amap_district_probe` 和 `__amap_convert` 用 Web 服务 Key 在服务端查询边界与转换最多 40 个 WGS84 点，不向浏览器传密钥。根 `.env` 已被 Git 忽略，新增无真实值的根 `.env.example`。
- 安装高德 Loader 与 Remotion 4.0.529 核心包/CLI。Remotion 为开发依赖，未创建视频作品。无凭证时界面明确提示高德未加载，显示原有 Cesium 地理概览。

## 修改文件

配置与依赖：`.env.example`、`frontend/vite.config.ts`、`frontend/package.json`、`frontend/package-lock.json`。地图与验证：`frontend/src/components/AmapRouteMap.tsx`、`frontend/src/components/RouteMap.tsx`、`frontend/src/components/RouteMap.css`、`frontend/tests/amap-local-check.mjs`、`frontend/tests/e2e.mjs`。项目资料：`README.md`、`docs/DECISIONS.md`、`docs/INTERFACES.md`、`docs/PROJECT_STATE.md`、`docs/HANDOFF.md`、本文件。工作区还保留其他任务的未提交改动；本轮未清理。`.gitignore` 原本已包含 `.env`，未重复添加。

## 关键决定与依据

用户本轮明确授权 D-014 的本地地图接入；高德官方 JS API 安全密钥文档建议服务端代理，官方坐标文档说明 WGS84 与 GCJ-02 不能直接混用。项目安全基线要求保留路线真实/模拟状态。Web 服务 Key 仅在本地服务端使用，不写入前端代码。Remotion 只安装本地工具，不扩展产品功能。

## 验证结果

- `npm exec remotion versions`：Remotion 包版本一致，CLI 可运行。
- `npm run typecheck`、`npm run build`：通过；`npm run test`：2 个文件、18 项通过。
- `npm run test:amap-local`：无凭证状态的明确失败提示和 Cesium 回退通过，**不等于高德真实加载验证**。
- `npm run test:e2e`：原有天津/深圳路线、切换、Golden 三轮、急症和键盘流程通过。浏览器导航改为等待文档加载，避免在线地图持续请求阻塞测试。
- 前端本地预览监听 `127.0.0.1:5173`，后端监听 `127.0.0.1:8000`；`GET /health` 成功；`GET /__amap_config` 因缺凭证返回不可用。
- 最初受限沙箱的 npm 构建/测试遇目录读取拒绝；获自动审批后复跑通过。最初 E2E 因 `networkidle` 超时，改为 `domcontentloaded` 后通过。真实 Key 的高德地图和福建边界请求未运行。

## 未完成、Blocker 与风险

- **Blocker**：截图未显示两条 Key 的平台类型。已询问用户第一行为 Web 端 JS API、第二行为 Web 服务是否属实，或补显示类型的截图。确认前不能写 `.env`；目前根 `.env` 不存在。
- 高德中国图块、署名实际呈现、福建 JS 边界、Web 服务边界、两城路线转换、授权域名、网络及配额均待在线实测，不能称为接入完成。
- `test:e2e` 聚焦原有 Cesium 回退；真实高德配置后须运行 `test:amap-local` 并补两城地图操作检查。D-013 正式许可与公网代理仍待决。
- 安全优先级、真实地面与模拟低空标记、Backend/Agent/Schema 未改变；行政边界只作地图能力验证，不作为可用出行或航空运营依据。

## 项目资料审计

- 盘点：`git ls-files --cached --others --exclude-standard` 覆盖全仓 126 个已跟踪和未跟踪路径，包含 `.agents` Skills 6、`agent` 7、`backend` 2、`data` 11、`docs` 56、`examples` 4、`frontend` 25、`schemas` 2、`scripts` 2、`tests` 6 及根文件。盘点不等于逐文件内容审阅。
- 方法与已检查范围：读取本轮相关 `PROJECT_STATE`、`DECISIONS`、`ROADMAP`、`INTERFACES` 和五项必读 Skill；检查地图组件、配置、依赖、安全/数据文案与状态证据；执行 `.env` 忽略检查、`git diff --check`、前端类型/单测/构建及本地浏览器流程。两城浏览器流程为抽样回归。
- 未检查或无法验证：126 个文件的全部内容、其他任务未提交改动的语义、线上高德账户许可/配额、真实地图加载。因未改 Backend 或 Schema，本轮未重复完整后端测试。

### 发现的问题

1. 项目根 `.env`：不存在，截图不能确认 Key 平台类型；影响在线地图和边界实测；状态为等待用户确认，未猜测或写入。
2. `frontend/tests/e2e.mjs`：既有测试聚焦 Cesium Viewer；配置真实高德后不能单独作为高德验收证据；状态为保留回退回归，高德独立测试已备，真实两城地图验证待补。
3. `docs/DECISIONS.md` D-013：正式许可、配额和公网安全代理仍待决；影响赛事及公网发布；状态待决，本地 D-014 不改变此结论。

## 下一步与接手约束

确认控制台平台类型后，核对字符并保留其他已有配置写入根 `.env`，不输出真实值；重启本地前端。用浏览器实际查看中国全貌和高德原生署名，运行 `npm run test:amap-local`，核验福建边界、两城路线叠加和失败状态。失败时记录具体原因，不用假地图替代。最后更新 `PROJECT_STATE.md` 与本交接；只有证据充分时才把 A-001 改为已验证。Sprint 3 仍须按原全部退出门槛评审。
