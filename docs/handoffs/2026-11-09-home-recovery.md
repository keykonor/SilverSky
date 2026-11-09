# 本机入口恢复与首页手动规划

2026-11-09 · REQ-023 / REQ-024

检查时本机前后端未监听。重新启动后，首页、旧版入口与后端状态均实测 HTTP 200。`scripts/start-local.ps1` 可重复运行，检查服务、启动缺失进程，并验证首页的 API 代理。可加 `-OpenBrowser` 打开首页。该脚本连续运行两次成功复用现有服务，冷启动用相同的 Uvicorn 与 Vite 命令实际验证。进程日志位于 `.verification/local-start/`。

首页增加“手动选点”。从当前城市范围查找出发地，目的地允许全国查询。两端都须从高德候选中显式选择，再生成驾车参考、出发与到达估算和地图。通过“返回文字输入”恢复原文。已识别急症的需求保持暂停，切换搜索范围不会解除暂停。模拟空中参考沿用标记与数据边界。

实现涉及 `frontend/src/v2/MvpApp.tsx`、`api.ts`、`v2.css`、`frontend/src/components/DirectGroundPlanner.tsx` 与启动脚本。复用高德地点查询和现有 `/api/v2/route`，保持旧版调用方式和后端接口。浏览器测试为 `frontend/tests/home-manual-route.mjs`。

桌面 Chrome 以 502 故障注入阻断文字分析，高德查找、路线与地图使用实际服务。天津站至天津之眼得到约 4.3 公里驾车参考，显示地图及时间安排。手动流程未发起额外分析请求，原文回切保留。实际后端的急症分支暂停普通规划。前端 44 项测试、类型检查与生产构建通过，核心契约和数据基线校验通过。[测试报告](../evidence/2026-11-09-home-recovery/results.json) · [路线画面](../evidence/2026-11-09-home-recovery/manual-route.png)

本轮验证本机可用与 DeepSeek 故障降级。DeepSeek 当前稳定性和持续联网条件需独立观察。真实运营、手机布局未在本轮验收。用户可直接打开 [SilverSky 首页](http://127.0.0.1:5173/)试用手动选点。
