# 天津全城模型与模拟飞行 Agent

2026-11-07 · REQ-021

本轮在首页 3D 场景新增“全城模型与飞行 Agent”。城市包采用静态分块，地图按镜头加载建筑和地形，Agent 按走廊读取本地分析格网。天津作为首个实际导入城市。深圳可用同一导入脚本准备数据包。

- 来源建筑采用 Overture 2026-10-21.0 的建筑和建筑组成部分，按 OSM 天津行政边界 R912999 裁切。覆盖包含主体及三个分离多边形，源数据可能有漏绘。[建筑数据许可](https://docs.overturemaps.org/attribution/) · [行政范围](https://www.openstreetmap.org/relation/912999)
- GEDTM30 v1.2 裸地格网为约 30 米分辨率。将 EGM2008 正高与 NGA 格网高程异常相加，统一到 WGS84 椭球米，再用于建筑底面、端点地面参考标高和三维轨迹。[GEDTM30 元数据](https://portal.opentopography.org/datasetMetadata?otCollectionID=OT.082025.4326.1) · [PROJ EGM2008 格网](https://cdn.proj.org/us_nga_egm08_25.tif)
- 来源楼高优先，缺失时可从复旦团队 CNBH-10m 的 2020 年遥感模型取轮廓内部像元估计，仍无值则保留未知。楼高估计在地图上使用单独的颜色与标签。跨分块建筑会按边界裁切，估计计数以分块记录计。[CNBH-10m 数据及许可](https://doi.org/10.5281/zenodo.7923866)

用户可在地图点选或键入两个 WGS84 经纬度，查看端点模型地面标高、模型走廊最高表面、模拟跨越高度、起升与下降高度和数据缺口。路线由垂直起升、水平跨越、垂直下降组成，使用固定的 30 米模拟余量。30 米约为本模型格网级别，余量用于推演。端点附近建筑占用、端点地形未知或走廊缺地形时返回原因和空轨迹。估计楼高或未知楼高产生 `PARTIAL_PREVIEW`。航空器性能、实时障碍、地面承载、地面场地和空域许可均需要独立核验，返回的场地和空域状态为 `DATA_UNAVAILABLE`。

## 实现与调用

- `agent/flight_simulation.py` 按格网读取地面、障碍与不确定性，生成模拟轨迹。`backend/flight_simulation.py` 提供城市清单、建筑/地形分块与模拟查询，路由注册在 `backend/app.py`。输入坐标在本机处理。数据仅在准备阶段从固定公开来源获取。
- `frontend/src/v2/CityScene.tsx` 接入 `FlightSimulation.tsx`，使用同一 Cesium Viewer 绘制地形、建筑、端点和轨迹。样式在 `v2.css`。开关后恢复原场景。
- `scripts/prepare_flight_city.py` 生成基础数据包，`scripts/enrich_flight_city_heights.py` 生成带来源标签的估计层。数据位于工作区 `artifacts/flight-models/tianjin/`，由本机服务读取，体量较大，保存在 Git 忽略的本地目录。再生成数据时先输出到新目录，验收后切换。
- 新契约见 [V3-002](../INTERFACES.md)。稳定规划响应和核心 Schema 继续沿用既有版本。

打开 [SilverSky 首页](http://127.0.0.1:5173/)，依次点击“3D 城市”“全城模型与飞行 Agent”“填入模拟示例”“生成模拟轨迹”。示例为公开模型坐标。也可调用 `POST /api/v2/flight-sim/tianjin/plan`，请求体为 `{"origin":[117.155,39.088],"destination":[117.173,39.094]}`。

检索中国独立开发者合集主列表、程序员版和往年列表后，未发现满足天津行政范围、裸地与楼高要求的数据源。选用 Overture、GEDTM30 与 CNBH。GlobalBuildingAtlas 的 LoD1 和楼高采用 CC BY-NC，保留为有使用条件的备选资料。[国内项目索引](https://github.com/1c7/chinese-independent-developer) · [GlobalBuildingAtlas 许可](https://github.com/zhu-xlab/GlobalBuildingAtlas#license-notice)

## 复现城市数据准备

数据准备工具单独安装至 `.verification/city-model-tools`，运行服务只需要项目已有依赖。

```powershell
.\.venv\Scripts\python.exe -m pip install --target .verification/city-model-tools overturemaps rasterio shapely
$env:PYTHONPATH = (Resolve-Path .verification/city-model-tools).Path
```

使用官方 Overture CLI 按边界主体及分离区的包围盒导出 `building` 与 `building_part` 为 GeoJSONSeq，固定 `--release 2026-10-21.0`。天津主体 bbox 为 `116.7020443,38.5549527,118.0586744,40.2520111`，分离区合并 bbox 为 `113.728304,36.5714411,113.7830829,36.6455934`。将 R912999 的 WGS84 MultiPolygon 保存为几何 JSON。用 `scripts/prepare_flight_city.py --help` 查看输入、输出与地形默认地址。用 `scripts/enrich_flight_city_heights.py --help` 指定基础包、新输出目录和覆盖范围内 CNBH 的 GeoTIFF。天津使用 `X113Y37`、`X117Y39`、`X117Y41`、`X119Y39`、`X119Y41`。供方数据证据及最终运行结果附后。[Overture 获取指南](https://docs.overturemaps.org/getting-data/overturemaps-py/)

## 验证与剩余范围

- 天津城市包 3,641 块、1,745,309 条源建筑及组成部分记录、665 条来源楼高、16,274,208 个有效地形格。约 614 MiB。本次遥感补足 1,394,957 条分块记录，另有 384,136 条分块记录高度未知。核验每块分析文件字节数、建筑分块存在性及蓟州、滨海、分离区域的地形读取。
- Chrome 桌面通过真实天津包加载建筑、地形和 OSM 道路瓦片请求。试算两点相距约 1.7 公里，椭球地面参考 -6.2 米和 -4.6 米，模型最高表面 197.7 米，模拟跨越标高 228 米。走廊有 60 个估计楼高格、25 个未知楼高格、0 个缺地形格，返回 `PARTIAL_PREVIEW`。地图点选、端点越界后清除轨迹、关闭并恢复原地图与单 Viewer 通过。该截图中的部分地表区域以模型底色显示。[桌面报告](../evidence/2026-11-07-city-flight-agent/results.json) · [轨迹截图](../evidence/2026-11-07-city-flight-agent/tianjin-trajectory.png)
- 后端与 Agent 全量 157 项通过，含来源楼高、估计楼高、地形缺值、建筑占用、有效包及缺包边界，有一条既有 Starlette/httpx 弃用警告。前端 44 项与生产构建通过。核心契约、五份数据基线和项目预检通过。桌面实测命令为 `node tests/city-flight.mjs`（在 frontend 目录运行，本机需已导入模型且前后端已启动）。
- 实测覆盖天津本地浏览与模拟，深圳尚未准备实际全城包。遥感楼高来自 2020 年影像估计，公开数据存在时效、漏绘和格网误差。真实起降场地、临时障碍、飞机性能、实时空域与许可需要独立来源和核验。手机布局沿用 REQ-020 的排除范围。
