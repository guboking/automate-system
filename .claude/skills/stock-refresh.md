---
name: stock-refresh
description: 强制刷新股票数据，忽略缓存
context: fork
allowed-tools:
  - WebSearch
  - WebFetch
  - Read
  - Write
  - Glob
---

# 股票数据刷新技能

当用户说「刷新」「更新」时，强制获取最新数据。

## 执行流程

1. **识别股票代码** - 转换为标准格式
2. **忽略缓存** - 直接获取全量最新数据
3. **更新缓存** - 覆盖写入 `./stock_cache/data/{symbol}.json`
4. **输出报告** - 按标准模板输出分析

## 数据获取优先级

1. WebSearch - 快速获取最新行情
2. WebFetch - 抓取财经网站详情

## 常用数据源

- 东方财富：quote.eastmoney.com
- 雪球：xueqiu.com
- Yahoo Finance：finance.yahoo.com
