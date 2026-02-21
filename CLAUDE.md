# 股票分析系统

## 触发条件

当用户提到以下关键词时，启动本工作流：
- 「分析 XXX 股票」「看看 XXX」「XXX 怎么样」
- 「刷新 XXX 数据」「更新 XXX」
- 「对比 A 和 B」「XXX vs YYY」

---

## 1. 执行流程

```
用户请求
    ↓
识别股票代码 → 转换为标准格式（见代码格式表）
    ↓
检查缓存 ./stock_cache/data/{symbol}.json
    ↓
┌─ 缓存存在且未过期 → 直接读取，输出分析
│
└─ 缓存不存在或已过期 → 获取新数据 → 写入缓存 → 输出分析
```

## 2. 缓存策略

### 2.1 有效期判断

```python
# 伪代码逻辑
def is_expired(updated_at, data_type):
    age = now() - updated_at
    limits = {
        "price": 24小时,      # 行情数据，每日更新
        "fundamentals": 7天,  # 财报数据，季度更新
        "news": 6小时,        # 新闻资讯，频繁更新
        "analyst": 3天        # 机构评级，定期更新
    }
    return age > limits[data_type]
```

### 2.2 缓存更新规则

| 场景 | 动作 |
|------|------|
| 无缓存 | 全量获取所有数据 |
| 价格过期 | 仅更新 price 字段 |
| 新闻过期 | 仅更新 news 字段 |
| 用户说「刷新」 | 强制全量更新 |

---

## 3. 数据结构

### 3.1 标准数据字段

```json
{
  "symbol": "002594.SZ",
  "name": "比亚迪",
  "market": "A股深市",
  "updated_at": "2025-12-07T14:00:00Z",

  "price": {
    "current": 95.98,
    "prev_close": 95.24,
    "change_pct": "+0.78%",
    "range_day": [94.71, 96.22],
    "range_52w": [87.40, 138.99],
    "volume": "35.92万手",
    "turnover": "34.84亿元"
  },

  "fundamentals": {
    "revenue_ytd": "5662.66亿元",
    "revenue_growth": "+12.75%",
    "net_profit_ytd": "233.33亿元",
    "profit_growth": "-7.55%",
    "gross_margin": "17.87%",
    "pe_ratio": null,
    "pb_ratio": null
  },

  "analyst": {
    "target_price_avg": 129.78,
    "target_price_high": 167,
    "target_price_low": 92,
    "buy_ratings": 28,
    "hold_ratings": 0,
    "sell_ratings": 2,
    "upside": "+35.22%"
  },

  "capital_flow": {
    "main_net": "+3.44亿元",
    "retail_net": "-2.31亿元",
    "north_net": null
  },

  "technical": {
    "ma5": null,
    "ma20": null,
    "support": null,
    "resistance": null,
    "signal": null
  },

  "news": []
}
```

### 3.2 股票代码格式

| 市场 | 格式 | 示例 | 识别规则 |
|------|------|------|----------|
| A股沪市 | {6位}.SS | 603993.SS | 60/68开头 |
| A股深市 | {6位}.SZ | 000001.SZ | 00/30/002开头 |
| 港股 | {4-5位}.HK | 1211.HK | 纯数字 |
| 美股 | {字母} | TSLA | 纯字母 |

---

## 4. 分析报告模板

输出报告应包含以下模块：

### 📊 股价概览
- 现价、涨跌幅、52周区间
- 当前位置（高位/中位/低位）

### 📈 基本面分析
- 营收、利润及增速
- 毛利率、PE、PB
- 同比环比变化

### 🎯 机构观点
- 目标价区间
- 买入/卖出评级数
- 潜在涨幅

### 💰 资金流向
- 主力/散户动向
- 北向资金（如有）

### ⚠️ 风险提示
- 技术面信号
- 需关注的风险点

---

## 5. 数据获取优先级

1. **WebSearch** - 快速获取最新行情和新闻
2. **WebFetch** - 抓取特定财经网站详情页
3. **Playwright** - 复杂页面爬取（需 browser 工具）

常用数据源：
- 东方财富：`quote.eastmoney.com`
- 雪球：`xueqiu.com`
- Yahoo Finance：`finance.yahoo.com`
- Investing.com：`investing.com`

---

## 6. 目录结构

```
./stock_cache/
├── cache_index.json          # 索引：记录每只股票的更新时间
├── data/
│   ├── {symbol}.json         # 单股数据文件
│   └── ...
└── reports/
    └── {symbol}_{date}.md    # 分析报告存档
```

---

## 7. 使用示例

| 用户说 | Claude 动作 |
|--------|-------------|
| 「分析比亚迪」 | 查缓存 → 有效则读取 → 输出分析 |
| 「刷新比亚迪数据」 | 强制获取最新数据 → 更新缓存 → 输出分析 |
| 「比亚迪 vs 特斯拉」 | 分别获取两只股票 → 对比分析 |
| 「最近分析过哪些股票」 | 读取 cache_index.json 列出 |

---

## 8. Agent Teams 多智能体协作

> 需要 Claude Opus 4.6 + `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`

### 8.1 适用场景

当任务涉及**多维度并行分析**时，启用 Agent Teams：
- 「深度分析 XXX」「全面分析 XXX」→ 多 Agent 并行调研
- 「对比 A、B、C 三只股票」→ 每只股票分配一个 Agent
- 「审查投资组合」→ 风险、收益、配置各一个 Agent

### 8.2 推荐团队配置

#### 单股深度分析团队（3 teammates）

```
创建 Agent 团队深度分析 {股票名}，分配三个队友：
- 数据调研员：搜集最新行情、财报、新闻，写入 stock_cache/data/{symbol}.json
- 基本面分析师：基于调研数据分析营收、利润、估值、成长性
- 技术面分析师：分析资金流向、技术指标、市场情绪
三个队友完成后汇总为完整分析报告。
```

#### 多股对比团队（N teammates）

```
创建 Agent 团队对比分析以下股票：{A}、{B}、{C}
每只股票分配一个队友负责独立调研和分析。
完成后各队友互相交叉验证数据，最终生成对比报告。
```

#### 投资组合审查团队（4 teammates）

```
创建 Agent 团队审查当前投资组合：
- 风险评估员：识别各持仓的风险敞口和相关性
- 收益分析师：评估各持仓的增长潜力和目标价
- 配置优化师：建议仓位调整和再平衡方案
- 宏观研究员：分析宏观经济环境对组合的影响
要求：队友之间互相挑战结论，形成共识后再汇总。
```

### 8.3 文件分工规则

避免多个 Agent 同时编辑同一文件：

| Agent 角色 | 写入文件 |
|-----------|----------|
| 数据调研员 | `stock_cache/data/{symbol}.json` |
| 基本面分析师 | `stock_cache/reports/{symbol}_fundamental_{date}.md` |
| 技术面分析师 | `stock_cache/reports/{symbol}_technical_{date}.md` |
| Lead 汇总 | `stock_cache/reports/{symbol}_{date}.md`（最终报告）|

### 8.4 Team 生命周期

```
用户请求深度分析
    ↓
Lead 创建团队 → 分解任务 → 分配给队友
    ↓
队友并行工作（各自独立的 context window）
    ↓
队友通过邮箱互相交流发现和质疑
    ↓
所有任务完成 → Lead 汇总最终报告
    ↓
清理团队资源
```
