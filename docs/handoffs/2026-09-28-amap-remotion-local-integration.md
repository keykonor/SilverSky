# 高德地图与 Remotion 本地接入交接（2026-09-28）

## 目标

按用户授权，在 SilverSky 现有地图界面本地接入高德真实地图，确认截图中凭证的平台类型后安全配置；验证中国全貌、署名、福建省边界查询及现有路线叠加。安装 Remotion 本地依赖以备后续视频工作。本轮不制作旅行足迹动画、不部署公网。

## 完成内容

- 根据高德控制台截图中的“Web端”和“Web服务”绑定服务标签确认凭证类型；根目录 `.env` 已保存三项凭证，受 `.gitignore` 忽略。交接、日志、源码和截图均不包含凭证值。
- 在现有地图区域接入高德 JS API 2.0；中国全貌为初始视野，保留高德原生地图署名。`DistrictSearch` 查询福建边界并显示；本地 Vite 同源代理使用 Web 服务 Key 做行政区探针和 WGS84→GCJ-02 转换，服务端 Key 与安全密钥不下发浏览器。
- 仅在坐标转换成功后绘制现有路线；保留数据来源与模拟低空标识，失败时展示状态并保留带来源标识的 Cesium 回退。
- 加入 `@amap/amap-jsapi-loader` 与 Remotion 4.0.529 开发依赖；未新增动画或产品能力。

## 修改文件

- `.env`（本机敏感配置，Git 忽略；不复制到交接）与 `.env.example`
- `frontend/src/components/AmapRouteMap.tsx`、`frontend/src/components/RouteMap.tsx`、`frontend/src/components/RouteMap.css`、`frontend/vite.config.ts`
- `frontend/package.json`、`frontend/package-lock.json`、`frontend/tests/amap-local-check.mjs`
- `README.md`、`docs/PROJECT_STATE.md`、`docs/DECISIONS.md`（D-014）、`docs/INTERFACES.md`（A-001）
- `docs/evidence/amap-local/amap-china-overview.png`、`docs/evidence/amap-local/amap-loaded.png`
- `docs/HANDOFF.md` 与本交接文件

## 关键决定与依据

D-014 授权本地地图与 Remotion 工具依赖。平台类型依据控制台截图中的绑定服务标签，而非 Key 名称。Web 服务 Key 只保留在本地开发服务端；浏览器只拿到 JS API 所需公开 Key。地图失败不伪造瓦片或边界，路线转换失败不绘制未转换数据。A-001 的本地开发契约已验证。公网、比赛环境和正式商业许可仍按 D-013 单独决策。

## 验证结果

- `npm run test:amap-local`：真实本机浏览器通过，确认中国全貌、原生署名、福建省界查询（421 段边界）、Web 服务区划探针返回 `350000`。
- 最后复验时，默认受限执行环境拦截了对高德 JS API 的请求（`ERR_NETWORK_ACCESS_DENIED`）；在获得联网执行权限后立即重跑同一浏览器验收并通过。该差异是本地执行环境网络策略，不是凭证或地图接口验证失败。
- 同一浏览器联测覆盖天津地面 1 段、天津模拟低空 3 段和深圳地面 1 段；转换成功并绘制，没有坐标转换错误。
- 前端 TypeScript 类型检查通过；Vitest 18 项通过；Vite 构建通过；原 Cesium fallback E2E 通过。
- 机密检查：`.env` 被 Git 忽略；`frontend/src` 与 `frontend/dist` 未搜索到 Web 服务 Key 或安全密钥变量名；不输出环境值。
- 本地预览：`http://127.0.0.1:5173/`；FastAPI 服务 `127.0.0.1:8000`。进程仅用于本机开发。

## 项目资料审计

- 盘点方法：`git ls-files --cached --others --exclude-standard` 汇总已跟踪及普通未跟踪文件；Git 状态显示 100 个已跟踪文件、29 个普通未跟踪文件。清单按 `.agents`、`agent`、`backend`、`data`、`docs`、`examples`、`frontend`、`schemas`、`scripts`、`tests` 等目录汇总。`.env` 是被忽略的敏感本地文件，不属于普通未跟踪清单，单独确认其忽略规则存在。
- 本轮逐项核对了地图组件、Vite 本地代理、地图接入测试、环境变量忽略规则、D-014、A-001、当前状态及相关证据；`git diff --check` 无空白错误。
- 验收证据包括真实浏览器地图与截图、福建查询和路线叠加、类型检查、单测、构建及回退 E2E。前端源码构建物中未发现服务端 Key 或安全密钥标识。
- 未逐文件审阅整个仓库 129 项文件，也未验证高德在线配额上限、比赛/商用许可、授权域名、生产代理、安全策略或公网部署；这些是当前明确未检查范围。

## 发现的问题

1. **公网/比赛环境尚未授权与验证**：`docs/DECISIONS.md` 的 D-013 仍待决。影响：不得将本地验证解释成可部署、可商用或赛事授权。状态：待决，需在扩大环境前评估并决策。
2. **在线用量上限未穷尽验证**：真实坐标服务曾返回高德 QPS 限流；已通过每批最多 40 个点及批次间隔解决当前浏览器测试。影响：更高并发或不同账户配额下表现未知。状态：本地场景通过，容量待确认。
3. **Sprint 3 其他验收门槛仍未通过**：Cesium ion 地形/建筑许可、比赛现场网络与性能、200% 缩放和屏幕阅读器复核尚未完成。影响：Sprint 3 维持 PARTIAL。状态：见 `docs/PROJECT_STATE.md`，不属于本轮地图接入的完成范围。

## 未完成事项与下一步

保持当前本机预览供用户查看。下一步按 Sprint 3 计划核验 Cesium ion 许可/网络和无障碍检查；若计划在比赛或生产环境使用高德，先单独完成 D-013 决策及配额、域名、代理、许可和回退设计。不得制作旅行足迹动画或部署公网，除非用户另行授权。

## 接手约束

不要读取、复制或在任何输出中显示 `.env` 的值。地图输入仍为 V-001 的 WGS84；只有 Web 服务转换成功的 GCJ-02 坐标可交给高德地图绘制。模拟数据与路线来源标记必须保留。无法获取真实数据时显示明确状态，不得造地图瓦片、边界或航空运营事实。
