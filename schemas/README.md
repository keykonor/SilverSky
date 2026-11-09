# Schema 基线与变更规则

2026-10-08 固定当前文件基线；核心 HTTP 版本仍为 `0.1-proposal`，不改变现有端点、字段或产品验收状态。

| 内容 | 唯一来源 / 使用方 |
| --- | --- |
| 解释、用户请求、规划、安全结果 | core.v0.1.schema.json；backend/app.py 使用 Draft 2020-12 校验 |
| POI、别名、地面快照、模拟低空数据 | datasets.v0.1.schema.json；数据/契约验证脚本 |
| 前端核心类型镜像 | ../frontend/src/types/contracts.ts；与核心 Schema 同步审查，不单方面改字段 |
| 跨模块规则与其他接口 | ../docs/INTERFACES.md、../docs/API_CONTRACTS.md |

[BASELINE.json](BASELINE.json) 保存上述两份 Schema 和核心 TypeScript 镜像的 SHA-256。计算前只将 CRLF 规范为 LF，以兼容 Windows 检出。`check_project_ready.py` 检测文件漂移；它不能自动证明所有 TypeScript 字段的语义等价，不能替代运行时契约验证。

## 已固定的约束

- `DataStatus` 只有 `VERIFIED`、`PUBLIC_DATA`、`SIMULATED_DATA`、`DATA_UNAVAILABLE`；不能自行加入 `REAL_DATA`。
- 核心几何使用 WGS84，经纬度顺序为 longitude/latitude；高德在线查询使用 GCJ-02，转换和来源须显式区分，不能混用。
- 距离、时间、费用等单位以 Schema 字段和 API_CONTRACTS.md 为准；未知不填写猜测值，遵守字段的 null/缺省约束。
- Safety 结果为 PASS、DOWNGRADE、REJECT、UNKNOWN；候选生成与安全通过是不同状态。在线地面路线参考不等于经过核心 Safety 审查。
- 模拟低空必须保留标记和不可预订说明；日期样例不代表用户真实行程。

## 需要改动时

1. 记录需求 ID，搜索后端、Agent、前端、数据、样例及测试的调用方。
2. 先在 INTERFACES.md 登记契约提案、兼容性和迁移影响。重大 Schema/安全边界变化先按 AGENTS.md 获得决定。
3. 指定一个写入者，同步修改 Schema、类型、调用方、样例和必要测试。其他开发 Agent 只提交建议，不并行改契约。
4. 运行契约、回归和相关前端检查。由负责人审查 diff 和证据后，在同一变更中更新 BASELINE.json 的版本说明和哈希；不提供自动接受漂移的命令。

哈希算法等价于：

```python
hashlib.sha256(path.read_bytes().replace(b"\r\n", b"\n")).hexdigest()
```

在仓库根目录验证：

```powershell
.\.venv\Scripts\python.exe scripts/check_project_ready.py
.\.venv\Scripts\python.exe scripts/validate_contract.py
```

## 已知缺口

R-001 / R-002 在线地面查询目前在 INTERFACES.md、后端实现和测试中定义，尚无独立的机器可读 JSON Schema；本轮未把它们误称为完整冻结的机器契约。基线也不覆盖所有前端派生视图类型。补齐这些接口需单独分配兼容性审查任务；本轮只固定现有核心边界，不引入类型生成框架或更改运行接口。
