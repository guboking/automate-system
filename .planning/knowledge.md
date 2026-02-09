# Project Knowledge Base

> AI 工作流规划系统 - 项目知识库
> 持久化存储项目信息和决策，新人/新会话快速上手

---

## 项目概览

**项目名称：** automate-system
**项目定位：** AI 驱动的投资分析与自动化系统
**主要功能：**
- 股票分析系统（A股/港股/美股，含缓存策略）
- Clawdbot AI Agent 框架（基于 Claude API 的 Node.js 框架）
- 研报综合分析（机构研报提取、融合、评分）
- 技术分析工具（创业板指数、K线指标计算）
- 投资组合可视化

---

## 技术栈

| 层面 | 技术 | 说明 |
|------|------|------|
| AI Agent | Node.js + TypeScript | Clawdbot 框架，@anthropic-ai/sdk |
| 数据分析 | Python 3 | 研报提取、技术指标计算 |
| 数据爬取 | Playwright + HTTP | 财经数据抓取 |
| 前端展示 | HTML5 + Canvas + CSS3 | 可视化报告、小游戏 |
| 数据存储 | JSON + CSV + Markdown | 文件系统存储，无数据库 |
| CI/CD | GitHub Actions | 自动合并工作流 |

---

## 目录结构说明

```
automate-system/
├── .planning/                  # [NEW] AI 工作流规划系统
│   ├── task_plan.md           # 当前任务计划
│   ├── progress.md            # 进度追踪
│   └── knowledge.md           # 项目知识库（本文件）
├── clawdbot/                   # AI Agent 框架
│   └── src/                   # TypeScript 源码
├── stock_cache/                # 股票数据缓存
│   ├── cache_index.json       # 缓存索引
│   └── data/                  # 个股数据 JSON
├── 分析报告/                   # 研报存档（47+ 文件）
├── *.py                        # Python 分析脚本
├── *.html                      # 可视化页面
├── CLAUDE.md                   # AI 工作流指令（股票分析 + 规划系统）
└── CLAUDE_MEMORY.md            # 投资策略记忆
```

---

## 关键约定

### 编码规范

- Python 脚本使用 UTF-8 编码
- TypeScript 使用 ES2020+ 语法
- JSON 文件使用 2 空格缩进
- Markdown 使用 GFM（GitHub Flavored Markdown）

### 股票代码格式

| 市场 | 格式 | 示例 |
|------|------|------|
| A股沪市 | {6位}.SS | 603993.SS |
| A股深市 | {6位}.SZ | 000001.SZ |
| 港股 | {4-5位}.HK | 1211.HK |
| 美股 | {字母} | TSLA |

### 缓存有效期

| 数据类型 | 有效期 |
|----------|--------|
| price（行情） | 24 小时 |
| fundamentals（财报） | 7 天 |
| news（新闻） | 6 小时 |
| analyst（评级） | 3 天 |

---

## 架构决策记录（ADR）

### ADR-001: 使用文件系统而非数据库

**日期：** 2025-12-07
**决策：** 所有数据使用 JSON/CSV/Markdown 文件存储
**原因：** 项目以 AI 辅助分析为主，数据量可控，文件系统更易于版本控制和 AI 读写
**后果：** 无需数据库运维，但大规模数据查询性能有限

### ADR-002: 采用三文件规划系统

**日期：** 2026-02-09
**决策：** 使用 task_plan.md / progress.md / knowledge.md 三文件持久化 AI 工作上下文
**原因：** 解决 AI "没记性"问题，参考 Superpowers + Planning-with-Files 方案
**后果：** 长周期项目重复解释成本从 ~30% 降至接近零，跨会话无缝续作

---

## 常见问题（FAQ）

### Q: 新会话开始时 AI 应该读什么？

1. `CLAUDE.md` - 获取工作流指令
2. `.planning/knowledge.md` - 了解项目背景
3. `.planning/progress.md` - 了解上次进度
4. `.planning/task_plan.md` - 了解当前任务

### Q: 什么时候更新 knowledge.md？

- 做出重要架构决策时
- 新增关键功能模块时
- 发现重要的项目约定时
- 技术栈发生变化时

### Q: 什么时候更新 progress.md？

- 每完成一个计划步骤时
- 遇到阻塞问题时
- 做出重要决策时
- 会话结束时（写入会话摘要）

### Q: 什么时候更新 task_plan.md？

- 开始新任务时（清空旧内容，填写新计划）
- 计划需要调整时
- 进入验证阶段时

---

## 项目时间线

| 日期 | 事件 |
|------|------|
| 2025-12 | 项目初始化，股票分析系统上线 |
| 2026-01 | 研报分析系统完善，ETF 配置建议 |
| 2026-01 | Clawdbot AI Agent 框架设计 |
| 2026-02 | 创业板技术分析工具上线 |
| 2026-02-09 | AI 工作流规划系统引入 |
