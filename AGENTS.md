# SilverSky AI - AGENTS.md

本文件定义 Codex、Subagent 及其他开发 Agent 在 SilverSky AI 仓库中的基本工作规则。

# 1. 项目结构

SilverSky AI 当前主要结构：
```
SilverSky-AI/
├── backend/              # FastAPI 后端
├── frontend/             # React + TypeScript 前端
├── agent/                # 产品运行时 Agent
├── data/                 # 项目数据、样例数据
├── schemas/              # 核心与数据集 Schema
├── examples/             # 接口与规划样例
├── scripts/              # 契约、数据与归档校验脚本
├── tests/                # 测试
├── versions/             # 三个历史大版本的冻结归档
├── docs/                 # 项目文档
│   ├── PROJECT_STATE.md
│   ├── ROADMAP.md
│   ├── INTERFACES.md
│   └── DECISIONS.md
├── .agents/
│   └── skills/           # Codex / Agent Skills
├── .env.example
├── .gitignore
├── AGENTS.md
└── README.md
```
如果实际仓库结构与这里不同，以当前仓库实际结构为准，并在必要时更新本文件。
不要为了让目录“更漂亮”而主动重构目录结构。

当前开发入口为 `main` 分支和项目根目录。`versions/` 及对应归档标签保持冻结，不在历史目录中开发或安装依赖；当前状态以根目录 `docs/PROJECT_STATE.md` 为准。具体说明见 [Git 管理说明](docs/GIT_MANAGEMENT.md) 和 [版本索引](versions/README.md)。

# 2. 启动、测试与检查命令

开始修改前，先检查 README.md、package.json、Python 配置和现有脚本，优先使用项目已经定义的命令。

## Backend

常见命令：
```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe scripts\validate_contract.py
.\.venv\Scripts\python.exe scripts\verify_data_baseline.py
```
以上命令在项目根目录运行。首次建立 Python 环境按 [README.md](README.md) 操作；遇到本机 pytest 临时目录或缓存权限问题时，使用 [Git 管理说明](docs/GIT_MANAGEMENT.md) 中的独立临时目录命令。

如项目存在 lint / format / type check 配置，使用项目已有命令。当前未配置 Ruff，不将 `ruff check` 或 `ruff format` 作为项目现有检查命令。
不要擅自引入新的代码质量工具，除非当前任务明确需要。

## Frontend

进入前端目录后，优先使用 package.json 已定义的 scripts：
```
npm ci
npm run dev
npm run test
npm run typecheck
npm run build
```
具体命令以当前 package.json 为准。

当前未定义 `lint` script，不运行 `npm run lint`。修改地图时按场景选用现有 `test:amap-local`、`test:scene-fallback`、`test:e2e`；启动依赖和本机浏览器要求见 [README.md](README.md)。

## 完成任务前

根据修改范围执行相关检查。
至少满足：
```
修改 Backend
→ 运行相关 backend tests

修改 Frontend
→ lint / test / build 中适用的检查

修改 API
→ 验证前后端调用

修改地图
→ 验证地图加载和核心交互

修改 Agent
→ 验证正常输入、异常输入和 Golden Case
```
不得声称未实际运行的检查已经通过。

# 3. 文件修改范围

## 默认可以修改

在当前任务明确需要时，可以修改：
```
backend/
frontend/
agent/
tests/
docs/
data/
```
以及与当前任务直接相关的配置文件。
遵循：
只修改完成当前任务真正需要修改的文件。

## 不要随意修改

以下内容没有明确理由时不要修改：
```
.git/
.gitignore
核心项目配置
锁定的依赖版本
核心 Schema
已有稳定 API
地图底层配置
生产环境配置
```
不要顺手：
- 重命名大量文件
- 移动大量目录
- 重构无关代码
- 更换技术框架
- 删除暂时看不懂的代码
- 清理与当前任务无关的历史实现

## 严禁修改或提交

不得提交：
```
.env
API Key
Access Token
密码
私钥
用户隐私数据
本地缓存
临时凭证
```
敏感信息统一通过环境变量读取。
需要新增环境变量时：
更新：
```
.env.example
```
不得提交真实值。

# 4. 核心架构约束

SilverSky AI 当前目标是快速完成可运行、可部署、可上线的 MVP。
当前主要技术方向：
```
Frontend
React + TypeScript

Map
高德地图 / CesiumJS

Backend
Python + FastAPI

Agent
LLM + Tool / Agent（技术方向；当前使用本地规则编排）

Data
JSON / GeoJSON
```

外部 LLM 服务选择及个人出行信息外发仍按 `docs/DECISIONS.md` 的 D-008 待决，以上技术方向不代表已接入或已授权发送。可部署、可上线是目标；公网部署仍须满足 D-013 的许可、域名、生产代理与配额决策。

除非现有技术已经无法满足需求，否则不要主动引入：
- 微服务
- Kubernetes
- 消息队列
- 多数据库架构
- 大规模事件系统
- 复杂分布式架构
- 为未来需求提前设计的大量抽象层
开发原则：
优先简单、稳定、可维护、能上线的实现。
不要为了体现“高级架构”增加复杂度。

# 5. API 与 Schema

前端、后端、Agent、地图和数据模块之间的接口不能随意修改。
涉及以下内容时需要特别谨慎：
```
API 路径
请求字段
响应字段
字段名称
字段类型
枚举值
Agent 输出结构
GeoJSON 结构
跨模块 Schema
```
修改前先检查：
```
docs/INTERFACES.md
```
并搜索所有调用方。

## API / Schema 修改规则

如果任务必须修改接口：
1. 先确认现有调用方和兼容、迁移影响，尽量保持向后兼容
2. 先在 docs/INTERFACES.md 更新契约或提案，区分提案、已确认、已实现、已验证
3. 破坏性变化先在 docs/DECISIONS.md 记录为待决，获得明确决策并更新契约后再实施；普通兼容修改无需重复审批
4. 修改相关代码
5. 修改对应测试
6. 验证前后端或相关模块仍然可以正常工作
不要出现：
```
Backend 改了字段
Frontend 没同步

Agent 改了输出
Planner 没同步

Schema 改了
旧测试直接删掉
```
核心 Schema 的大幅修改需要用户确认。

# 6. 新功能必须补测试

新增功能时，应增加与功能风险相匹配的测试。
测试重点覆盖：
```
正常情况
典型用户输入
边界情况
错误情况
已有功能回归
```
不要求为了测试覆盖率数字编写大量低价值测试。
重点是：
防止新功能把已经能工作的东西改坏。

# 7. 禁止通过修改测试掩盖问题

测试失败时：
先确认失败原因。
优先修复：
```
业务代码
接口实现
数据处理
状态管理
配置错误
```
禁止：
- 删除失败测试
- 注释失败测试
- 跳过测试
- 降低断言要求
- 修改正确测试来迎合错误实现
如果确认：
测试本身已经过时或需求已经正式变化
才允许修改测试，并在最终汇报中明确说明原因。

# 8. 数据与密钥规则

不得把模拟数据伪装成真实运营数据。
数据状态沿用现有 Schema，统一为：
```
VERIFIED
PUBLIC_DATA
SIMULATED_DATA
DATA_UNAVAILABLE
```
`VERIFIED` 表示记录字段已核验，`PUBLIC_DATA` 表示有来源的公开数据；二者都不代表航空运营批准。不得把 `REAL_DATA` 作为现有 API、Schema 或数据文件的状态值。

无法确认的数据：
不要猜测。
不要为了让 Demo 看起来完整而生成虚假的真实：
- 起降点
- 航线
- 航班
- 运营时间
- 航空价格
- 低空运营状态
模拟数据必须明确标记。

## 密钥

所有 API Key 和 Secret 必须使用环境变量。
当前项目变量名称以根目录及前端的 `.env.example` 为准：
```
AMAP_WEB_KEY
AMAP_SECURITY_JS_CODE
AMAP_WEB_SERVICE_KEY
VITE_CESIUM_ION_TOKEN
```
前三项配置在项目根目录 `.env`；可选的 `VITE_CESIUM_ION_TOKEN` 按 `frontend/.env.example` 配置。不要仅因示例而改名或新增外部服务凭证。

代码中禁止：
```
api_key = "真实密钥"
```
.env 不得进入 Git。

# 9. 修改前必须阅读

每次开始代码修改前，至少阅读：
```
AGENTS.md
docs/PROJECT_STATE.md
```
然后根据任务决定是否阅读：
```
README.md
docs/ROADMAP.md
docs/INTERFACES.md
docs/DECISIONS.md
```
规则：
```
项目状态
→ PROJECT_STATE.md

接口问题
→ INTERFACES.md

重大历史决策
→ DECISIONS.md

后续计划
→ ROADMAP.md

运行方式
→ README.md
```
不要每次机械读取所有文件。
只读取当前任务需要的内容。

## 按任务使用 Skills

按实际任务读取并遵循相关 Skill，不机械加载全部 Skills；Skill 不扩大用户授权。

| 任务 | Skill |
| --- | --- |
| 需求、MVP 范围、优先级与验收条件 | [product-requirements](.agents/skills/product-requirements/SKILL.md) |
| 技术方案、实施拆解与架构影响 | [implementation-strategy](.agents/skills/implementation-strategy/SKILL.md) |
| 跨专业分工、依赖、Sprint 与冲突协调 | [agent-orchestration](.agents/skills/agent-orchestration/SKILL.md) |
| 跨模块接口与 Schema 变更 | [api-contract](.agents/skills/api-contract/SKILL.md) |
| 出行安全、真实/模拟数据、隐私与降级 | [safety-data-integrity](.agents/skills/safety-data-integrity/SKILL.md) |
| 代码与运行配置审查、验证和验收 | [code-change-verification](.agents/skills/code-change-verification/SKILL.md) |
| 地图几何、坐标、三维场景、来源与降级 | [silver-sky-geospatial-review](.agents/skills/silver-sky-geospatial-review/SKILL.md) |
| 专业开发、WorkBuddy、Reviewer 或 Sprint 交接审查 | [silver-sky-handoff-review](.agents/skills/silver-sky-handoff-review/SKILL.md) |
| 重要阶段真实使用、3D 效用与适老体验验证 | [silver-sky-ux-reality-validation](.agents/skills/silver-sky-ux-reality-validation/SKILL.md) |

# 10. 开发执行原则

修改代码时遵循：
```
先理解
↓
定位问题
↓
确定最小修改范围
↓
修改
↓
测试
↓
检查影响
↓
汇报
```
优先修复根本原因。
不要在任务过程中主动扩大范围。
如果发现与当前任务无关的问题：
记录下来即可。
除非会阻塞当前功能，否则不要顺手修复。

总控 Agent 负责范围、依赖、重大决策和阶段验收；专业开发 Agent 在已授权模块内实现并提交验证证据。开发用 Subagent 与产品运行时 Agent 分开，只处理已授权、可独立交接的任务，事先明确文件写入边界，禁止并行修改同一文件或核心 Schema。

用户的新需求、纠正、取消和范围确认逐条追加到 [需求台账](docs/requirements/README.md)，保留来源并写明验收；不把助手建议自动当作批准的需求。完整聊天缺失时如实记录覆盖范围。

开发角色和共享文件的唯一写入边界见 [DEVELOPMENT.md](docs/DEVELOPMENT.md)，Schema 基线与变更步骤见 [schemas/README.md](schemas/README.md)。任务开始前明确具体文件；预检使用 `scripts/check_project_ready.py`，不能用重算基线代替契约审查。

# 11. 什么时候需要用户确认

以下操作实施前需要用户确认：
- 更换主要技术栈
- 删除核心功能
- 大幅修改核心 Schema
- 大规模目录重构
- 更换地图方案
- 引入收费 API
- 引入新的核心基础设施
- 引入数据库或改变主要存储方式
- 改变真实 / 模拟数据边界
- 改变产品核心流程
普通 Bug 修复、局部优化和已经明确要求开发的功能无需反复询问。

# 12. 完成任务后的汇报

每次完成实际代码修改后，必须报告：
```
完成内容：

修改文件：

验证结果：

未完成 / 已知问题：

下一步：
```
同时给出可进入的链接或者软件，可以让我真实使用该项目成果再进行评价，例如：
```
完成内容：
- 新增语音输入
- 语音结果自动写入需求输入框

修改文件：
- frontend/src/components/InputPanel.tsx
- frontend/src/hooks/useSpeechRecognition.ts
- frontend/src/components/InputPanel.test.tsx

验证结果：
- npm run test：PASS
- npm run typecheck：PASS
- npm run build：PASS
- 手动验证文字输入未受影响

未完成 / 已知问题：
- Safari 语音识别兼容性待验证

下一步：
- 接入 interpret API 自动提取起点和终点

可进入链接或者软件：
-
```

只汇报实际完成和实际验证的内容。
禁止把：
```
计划做
```
写成：
```
已经完成
```

项目交接入口见 [docs/HANDOFF.md](docs/HANDOFF.md)。实际项目工作结束时，在 `docs/handoffs/` 新建带日期和任务名的交接并更新入口，说明目标、修改文件、接口/安全影响、实际验证和未决事项；资料审计按本轮风险记录检查范围、方法、结果、未检查范围及发现的问题。纯简短问答无需额外交接。

# 13. 项目状态

docs/PROJECT_STATE.md 是项目当前状态的唯一主要记录。
完成重要功能后，根据实际结果更新：
```
当前版本
当前 Sprint
已完成
正在进行
Blocker
主要风险
下一步
```
用户询问项目整体状态时，以该文件为准。

# 14. 总原则

出行规划的业务取舍始终遵循：**安全 > 舒适 > 可达性 > 时间 > 成本**。Safety 角色只审查已有候选，不创造路线；未知条件保留不可用或不确定状态，不因演示、可运行或可上线目标提升安全结论。

以下为工程交付优先级，不能替代上述业务取舍顺序。

SilverSky AI 当前阶段的优先级：
```
能正确运行
>
核心流程完整
>
结果可靠
>
可以部署
>
真实用户可以使用
>
代码优雅
>
复杂架构
```
遇到多个可行方案时，优先选择：
修改更少、风险更低、测试更容易、后续更容易维护的方案。
当前目标不是打造最复杂的 Agent 系统。
当前目标是：
把 SilverSky AI 做成真正能运行、能部署、能演示、能让用户使用的产品。
