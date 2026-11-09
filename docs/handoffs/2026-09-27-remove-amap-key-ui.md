# SilverSky AI 高德 Key 界面纠偏交接

日期：2026-09-27。状态以 [PROJECT_STATE.md](../PROJECT_STATE.md) 为准。本轮是用户对地图需求的直接澄清，接手方可以独立阅读本文件。

## 本轮目标

用户希望 SilverSky **主地图**呈现尽可能真实、可追溯的天津/深圳城市三维模型。此前把“可以提供高德 API”误解成要在软件里增加 Key 输入和独立预览；用户明确要求删除该功能。

## 已完成与修改文件

- 删除 `frontend/public/amap-connect.html`、`frontend/tests/amap-connection.mjs`、`docs/evidence/sprint3/amap-connection-form.png` 及构建副本 `frontend/dist/amap-connect.html`，移除 `frontend/package.json` 的对应测试命令。没有在主 Web App 留下高德输入入口或高德运行时请求。
- 修正 [PROJECT_STATE.md](../PROJECT_STATE.md)、[DECISIONS.md](../DECISIONS.md)、[INTERFACES.md](../INTERFACES.md)、[DATA_SOURCES.md](../DATA_SOURCES.md) 与 [Sprint 3 交接](2026-09-27-sprint3-3d-demo.md)：记录用户澄清、误建功能已删除、D-013 高德主地图评估仍“待决”。更新 [HANDOFF.md](../HANDOFF.md) 的最新入口。
- 保留 Sprint 3 已有的 Cesium 3D 模拟航迹、可选 ion 地形/OSM 建筑及本地降级。没有切换地图提供方、改 Safety/Agent/Backend/Schema，亦没有使用或保存真实 API Key。

## 关键决定与依据

主地图真实性应通过正式的数据源、许可、坐标转换和现场实测来提升，而不是向产品用户索要地图服务 Key。D-012 的 Cesium ion World Terrain/OSM Buildings 仍是已采纳的可选背景方案；D-013 仅评估高德作为**主地图提供方**。官方 [高德 JS API 3D](https://lbs.amap.com/api/javascript-api-v2/guide/map/3d-map)与[楼块图层](https://lbs.amap.com/api/javascript-api-v2/guide/layers/official-layers)说明其独立地图能力；[坐标转换](https://lbs.amap.com/api/javascript-api-v2/guide/transform/convertfrom)说明高德 GCJ-02 与当前 WGS84 的边界，[平台协议](https://lbs.amap.com/pages/terms/)需结合具体授权核对。现有资料不证明可把高德楼块直接当作 Cesium 图块使用，也不证明比赛环境获准或可用。正式替换或并用需按 D-013 完成决策。

## 验证结果

- 删除后重新运行前端生产构建：**通过**；输出只含主页面与现有 Cesium 资源，不含 `amap-connect.html`。`git diff --check` 通过（只有换行提示）。搜索现行源码、测试与配置，未发现 `amap-connect` 或 `test:amap-connection` 引用。
- Sprint 3 先前验证证据仍有效：Python 84 passed、前端 18 个单测、两城 E2E、五状态 axe、模拟断网降级与本地切换性能通过。删除的是独立误建页面，没有改这些功能的实现。本轮未重新执行全量 Python/浏览器测试，不将其写成新运行结果。
- 误建页面的虚构凭据测试属于已撤销功能，**不计入现行产品验收**；没有真实高德 Key 或高德地图成功加载证据。

## 未完成事项、Blocker 与风险

Sprint 3 仍为 **PARTIAL / 进行中**。要让主地图显示真实城市建筑，需在有效且获准的地图账户与比赛网络中实测天津/深圳图层、署名、覆盖、配额和性能；若选高德，另需 D-013 的授权、WGS84→GCJ-02 转换、接口/部署和回退决策。真实出行运营、出入口和无障碍证据仍缺，不得把模拟航迹或模型建筑当成可飞、可乘坐信息。用户尚未提供具体高德产品文档或授权说明；不要请用户把 Key 发在聊天中，也不要再创建软件内 Key 界面。

## 下一步与接手约束

优先验证 D-012 的 Cesium 真实建筑/地形能否在比赛环境稳定加载；如用户提供高德具体官方产品链接和授权范围，再对照 D-013 评估它能否成为主地图及必要的迁移。Product Review 对本地 Demo 为 PARTIAL，在线真实城市模型尚待复核。所有状态与待决项以项目状态及决策文档为准；不得把“页面已删除”误写为“高德已接入”或“Sprint 3 PASS”。

## 项目资料审计

盘点方法：`git ls-files` 与非忽略未跟踪清单覆盖 **100 个已跟踪 + 22 个未跟踪 = 122 个文件**，包括项目文档、6 个 Skills、源码、配置、2 个 Schema、数据、样例、测试、交接和 18 张 PNG 截图。机械检查解析了 14 个 JSON、5 个 CSV、17 个 Python 文件语法、18 个 PNG 文件头及 46 个 Markdown 的 **142 个本地相对链接**；0 个文件/链接/格式缺失。`git diff --check` 通过（Git 仅提示换行规范）。本轮还针对高德界面删除、D-013 待决、真实/模拟边界和验证证据做抽样语义核对；**未逐文件完整审阅**。构建后的 `dist` 为忽略文件，单独确认误建 HTML 副本不存在。

### 发现的问题

1. `frontend/src/components/RouteMap.tsx`、`docs/DATA_SOURCES.md`：真实 ion 地形/建筑尚无有效账户成功加载及许可、配额、现场网络证据；影响 Sprint 3 全 3D 与 Product PASS，**待验证**。
2. `docs/DECISIONS.md` D-013：高德官方 JS API 文档描述 3D/楼块，但未核验用户可用的具体服务及授权，也未解决 WGS84/GCJ-02 和与现有 Cesium 的迁移；影响主地图数据源选择，**待决**。
3. `data/product-assets/*.csv`：本轮仅格式核验，产品研究资产的来源与运行时数据边界未逐条复审；不得作为真实运营证据，**沿用既有风险**。

未检查或无法验证：真实屏幕阅读器、200% 缩放、真实高德/ion 在线图层、比赛现场网络、许可与长期 3D 性能。没有把这些范围归为通过。

## Git Commit

本轮没有创建提交。Sprint 3 尚未 PASS，工作区原有未提交资料与实现需要按归属核对后再提交；当前基线 HEAD 仍为 `8ead045`。
