#!/usr/bin/env python3
"""
创业板（ChiNext）数据抓取和技术分析脚本
使用 Playwright 抓取实时和历史数据
"""

import asyncio
import json
import csv
from datetime import datetime, timedelta
from playwright.async_api import async_playwright
import pandas as pd
import numpy as np

class ChiNextAnalyzer:
    def __init__(self):
        self.data = []
        self.base_url = "http://quote.eastmoney.com/zs399006.html"  # 创业板指数

    async def fetch_data(self):
        """使用 Playwright 抓取创业板数据"""
        async with async_playwright() as p:
            print("正在启动浏览器...")
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()

            try:
                print(f"正在访问创业板页面: {self.base_url}")
                await page.goto(self.base_url, wait_until='networkidle', timeout=30000)

                # 等待页面加载
                await page.wait_for_timeout(3000)

                # 获取实时数据
                print("正在提取实时数据...")
                current_price = await page.locator('.price').first.inner_text() if await page.locator('.price').count() > 0 else "N/A"

                # 尝试获取K线数据的API
                # 东方财富的K线数据API
                kline_url = "http://push2his.eastmoney.com/api/qt/stock/kline/get"
                params = {
                    'secid': '0.399006',  # 创业板指数代码
                    'fields1': 'f1,f2,f3,f4,f5,f6',
                    'fields2': 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
                    'klt': '101',  # 日K线
                    'fqt': '1',
                    'beg': '0',
                    'end': '20500101',
                    'lmt': '120',  # 最近120个交易日
                    'ut': 'fa5fd1943c7b386f172d6893dbfba10b'
                }

                # 构建完整URL
                param_str = '&'.join([f"{k}={v}" for k, v in params.items()])
                full_kline_url = f"{kline_url}?{param_str}"

                print(f"正在访问K线数据API...")
                api_page = await browser.new_page()
                await api_page.goto(full_kline_url)

                # 获取API返回的JSON数据
                content = await api_page.content()

                # 解析JSON数据
                import re
                json_match = re.search(r'<pre[^>]*>(.*?)</pre>', content, re.DOTALL)
                if json_match:
                    json_data = json.loads(json_match.group(1))

                    if json_data.get('data') and json_data['data'].get('klines'):
                        klines = json_data['data']['klines']

                        print(f"成功获取 {len(klines)} 条K线数据")

                        for kline in klines:
                            parts = kline.split(',')
                            if len(parts) >= 11:
                                self.data.append({
                                    'date': parts[0],
                                    'open': float(parts[1]),
                                    'close': float(parts[2]),
                                    'high': float(parts[3]),
                                    'low': float(parts[4]),
                                    'volume': float(parts[5]),
                                    'amount': float(parts[6]),
                                    'amplitude': float(parts[7]) if parts[7] else 0,
                                    'change_pct': float(parts[8]) if parts[8] else 0,
                                    'change': float(parts[9]) if parts[9] else 0,
                                    'turnover': float(parts[10]) if parts[10] else 0
                                })
                    else:
                        print("警告：API返回数据格式不正确")
                else:
                    print("警告：无法解析API返回数据")

                await api_page.close()

            except Exception as e:
                print(f"抓取数据时发生错误: {e}")
                import traceback
                traceback.print_exc()
            finally:
                await browser.close()

        return self.data

    def save_to_csv(self, filename='chinext_data.csv'):
        """保存数据到CSV文件"""
        if not self.data:
            print("没有数据可保存")
            return

        df = pd.DataFrame(self.data)
        df.to_csv(filename, index=False, encoding='utf-8-sig')
        print(f"数据已保存到 {filename}")
        return df

    def calculate_ma(self, df, periods=[5, 10, 20, 30, 60]):
        """计算移动平均线"""
        for period in periods:
            df[f'MA{period}'] = df['close'].rolling(window=period).mean()
        return df

    def calculate_macd(self, df, fast=12, slow=26, signal=9):
        """计算MACD指标"""
        exp1 = df['close'].ewm(span=fast, adjust=False).mean()
        exp2 = df['close'].ewm(span=slow, adjust=False).mean()
        df['MACD'] = exp1 - exp2
        df['Signal'] = df['MACD'].ewm(span=signal, adjust=False).mean()
        df['Histogram'] = df['MACD'] - df['Signal']
        return df

    def calculate_rsi(self, df, period=14):
        """计算RSI指标"""
        delta = df['close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / loss
        df['RSI'] = 100 - (100 / (1 + rs))
        return df

    def calculate_bollinger_bands(self, df, period=20, std_dev=2):
        """计算布林带"""
        df['BB_Middle'] = df['close'].rolling(window=period).mean()
        df['BB_Std'] = df['close'].rolling(window=period).std()
        df['BB_Upper'] = df['BB_Middle'] + (df['BB_Std'] * std_dev)
        df['BB_Lower'] = df['BB_Middle'] - (df['BB_Std'] * std_dev)
        return df

    def analyze(self, df):
        """进行技术分析"""
        print("\n" + "="*60)
        print("创业板指数技术分析报告")
        print("="*60)

        if df.empty:
            print("没有数据可分析")
            return

        # 最新数据
        latest = df.iloc[-1]
        prev = df.iloc[-2] if len(df) > 1 else latest

        print(f"\n【基本信息】")
        print(f"日期: {latest['date']}")
        print(f"收盘价: {latest['close']:.2f}")
        print(f"涨跌幅: {latest['change_pct']:.2f}%")
        print(f"涨跌额: {latest['change']:.2f}")
        print(f"成交量: {latest['volume']:.0f}")
        print(f"成交额: {latest['amount']:.2f}亿")
        print(f"振幅: {latest['amplitude']:.2f}%")

        # 移动平均线分析
        print(f"\n【均线系统】")
        print(f"MA5:  {latest['MA5']:.2f}")
        print(f"MA10: {latest['MA10']:.2f}")
        print(f"MA20: {latest['MA20']:.2f}")
        print(f"MA30: {latest['MA30']:.2f}")
        print(f"MA60: {latest['MA60']:.2f}")

        # 判断均线趋势
        if latest['close'] > latest['MA5'] > latest['MA10'] > latest['MA20']:
            ma_trend = "多头排列 📈（强势上涨）"
        elif latest['close'] < latest['MA5'] < latest['MA10'] < latest['MA20']:
            ma_trend = "空头排列 📉（弱势下跌）"
        else:
            ma_trend = "均线缠绕（震荡整理）"
        print(f"均线形态: {ma_trend}")

        # MACD分析
        print(f"\n【MACD指标】")
        print(f"MACD: {latest['MACD']:.2f}")
        print(f"Signal: {latest['Signal']:.2f}")
        print(f"Histogram: {latest['Histogram']:.2f}")

        if latest['MACD'] > latest['Signal'] and prev['MACD'] <= prev['Signal']:
            macd_signal = "金叉 🟢（买入信号）"
        elif latest['MACD'] < latest['Signal'] and prev['MACD'] >= prev['Signal']:
            macd_signal = "死叉 🔴（卖出信号）"
        elif latest['MACD'] > latest['Signal']:
            macd_signal = "多头（看涨）"
        else:
            macd_signal = "空头（看跌）"
        print(f"MACD信号: {macd_signal}")

        # RSI分析
        print(f"\n【RSI指标】")
        print(f"RSI(14): {latest['RSI']:.2f}")

        if latest['RSI'] > 70:
            rsi_signal = "超买区域 ⚠️（可能回调）"
        elif latest['RSI'] < 30:
            rsi_signal = "超卖区域 ⚠️（可能反弹）"
        elif latest['RSI'] > 50:
            rsi_signal = "强势区域（偏多）"
        else:
            rsi_signal = "弱势区域（偏空）"
        print(f"RSI状态: {rsi_signal}")

        # 布林带分析
        print(f"\n【布林带】")
        print(f"上轨: {latest['BB_Upper']:.2f}")
        print(f"中轨: {latest['BB_Middle']:.2f}")
        print(f"下轨: {latest['BB_Lower']:.2f}")

        bb_position = (latest['close'] - latest['BB_Lower']) / (latest['BB_Upper'] - latest['BB_Lower']) * 100
        print(f"当前位置: {bb_position:.1f}%（0%=下轨，100%=上轨）")

        if latest['close'] > latest['BB_Upper']:
            bb_signal = "突破上轨（超买，注意回调风险）"
        elif latest['close'] < latest['BB_Lower']:
            bb_signal = "跌破下轨（超卖，可能反弹）"
        elif bb_position > 50:
            bb_signal = "上半部（偏强）"
        else:
            bb_signal = "下半部（偏弱）"
        print(f"布林带信号: {bb_signal}")

        # 综合分析
        print(f"\n【综合研判】")

        # 计算近期表现
        if len(df) >= 5:
            week_change = ((latest['close'] - df.iloc[-5]['close']) / df.iloc[-5]['close']) * 100
            print(f"近5日涨跌: {week_change:.2f}%")

        if len(df) >= 20:
            month_change = ((latest['close'] - df.iloc[-20]['close']) / df.iloc[-20]['close']) * 100
            print(f"近20日涨跌: {month_change:.2f}%")

        # 综合评分（简单示例）
        score = 0
        signals = []

        # 均线得分
        if latest['close'] > latest['MA5']:
            score += 1
            signals.append("收盘价在MA5上方")
        if latest['close'] > latest['MA20']:
            score += 1
            signals.append("收盘价在MA20上方")

        # MACD得分
        if latest['MACD'] > latest['Signal']:
            score += 1
            signals.append("MACD多头")
        if latest['Histogram'] > 0:
            score += 0.5

        # RSI得分
        if 40 < latest['RSI'] < 70:
            score += 1
            signals.append("RSI处于健康区间")

        print(f"\n多头信号: {signals}")
        print(f"技术强度: {score}/4.5 分")

        if score >= 3.5:
            overall = "强势多头 🚀 建议：关注回调买入机会"
        elif score >= 2.5:
            overall = "偏多格局 📈 建议：谨慎看多"
        elif score >= 1.5:
            overall = "震荡整理 ↔️ 建议：观望为主"
        else:
            overall = "偏空格局 📉 建议：规避风险"

        print(f"综合研判: {overall}")

        print("\n" + "="*60)
        print("注意：以上分析仅供参考，投资有风险，入市需谨慎！")
        print("="*60 + "\n")

async def main():
    analyzer = ChiNextAnalyzer()

    # 抓取数据
    print("开始抓取创业板数据...")
    data = await analyzer.fetch_data()

    if not data:
        print("未能获取数据，请检查网络连接")
        return

    # 保存原始数据
    df = analyzer.save_to_csv()

    # 计算技术指标
    print("\n正在计算技术指标...")
    df = analyzer.calculate_ma(df)
    df = analyzer.calculate_macd(df)
    df = analyzer.calculate_rsi(df)
    df = analyzer.calculate_bollinger_bands(df)

    # 保存带指标的数据
    df.to_csv('chinext_analysis.csv', index=False, encoding='utf-8-sig')
    print("分析数据已保存到 chinext_analysis.csv")

    # 进行技术分析
    analyzer.analyze(df)

if __name__ == "__main__":
    asyncio.run(main())
