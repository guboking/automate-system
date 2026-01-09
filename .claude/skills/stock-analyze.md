---
name: stock-analyze
description: 分析单只股票，输出完整报告
context: fork
allowed-tools:
  - WebSearch
  - WebFetch
  - Read
  - Write
  - Glob
---

# 股票分析技能

当用户请求分析某只股票时，执行以下流程：

## 1. 识别股票

从用户输入中识别股票名称或代码，转换为标准格式：
- A股沪市：{6位}.SS（60/68开头）
- A股深市：{6位}.SZ（00/30/002开头）
- 港股：{4-5位}.HK
- 美股：纯字母代码

## 2. 检查缓存

检查 `./stock_cache/data/{symbol}.json` 是否存在且未过期：
- price: 24小时有效
- fundamentals: 7天有效
- news: 6小时有效
- analyst: 3天有效

## 3. 获取数据

如缓存过期或不存在，通过 WebSearch 获取：
- 当前股价、涨跌幅、成交量
- 基本面数据（营收、利润、PE、PB）
- 机构评级和目标价
- 资金流向
- 最新新闻

## 4. 输出报告

按以下模板输出分析报告：

### 📊 股价概览
- 现价、涨跌幅、52周区间位置

### 📈 基本面分析
- 营收利润增速、毛利率

### 🎯 机构观点
- 目标价区间、评级分布

### 💰 资金流向
- 主力/散户动向

### ⚠️ 风险提示
- 需关注的风险点

## 5. 更新缓存

将数据写入 `./stock_cache/data/{symbol}.json`，更新 `cache_index.json`。
