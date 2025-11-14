#!/usr/bin/env python3
"""
创业板（ChiNext）数据抓取和技术分析脚本
使用 HTTP 请求直接获取数据，更稳定可靠
"""

import requests
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

class ChiNextAnalyzer:
    def __init__(self):
        self.data = []
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }

    def fetch_data(self):
        """获取创业板数据"""
        try:
            # 东方财富创业板指数K线数据API
            url = "http://push2his.eastmoney.com/api/qt/stock/kline/get"
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

            print(f"正在访问创业板数据API...")
            response = requests.get(url, params=params, headers=self.headers, timeout=10)

            if response.status_code == 200:
                json_data = response.json()

                if json_data.get('data') and json_data['data'].get('klines'):
                    klines = json_data['data']['klines']
                    name = json_data['data'].get('name', '创业板指数')

                    print(f"成功获取 {name} 的 {len(klines)} 条K线数据")

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
                    print(f"返回内容: {json_data}")
            else:
                print(f"请求失败，状态码: {response.status_code}")

        except Exception as e:
            print(f"抓取数据时发生错误: {e}")
            import traceback
            traceback.print_exc()

        return self.data

    def save_to_csv(self, filename='chinext_data.csv'):
        """保存数据到CSV文件"""
        if not self.data:
            print("没有数据可保存")
            return None

        df = pd.DataFrame(self.data)
        df.to_csv(filename, index=False, encoding='utf-8-sig')
        print(f"数据已保存到 {filename}")
        return df

    def calculate_ma(self, df, periods=[5, 10, 20, 30, 60]):
        """计算移动平均线"""
        for period in periods:
            df[f'MA{period}'] = df['close'].rolling(window=period).mean()
        return df

    def calculate_ema(self, df, periods=[12, 26]):
        """计算指数移动平均线"""
        for period in periods:
            df[f'EMA{period}'] = df['close'].ewm(span=period, adjust=False).mean()
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

        # 避免除以零
        rs = gain / loss.replace(0, np.inf)
        df['RSI'] = 100 - (100 / (1 + rs))
        return df

    def calculate_bollinger_bands(self, df, period=20, std_dev=2):
        """计算布林带"""
        df['BB_Middle'] = df['close'].rolling(window=period).mean()
        df['BB_Std'] = df['close'].rolling(window=period).std()
        df['BB_Upper'] = df['BB_Middle'] + (df['BB_Std'] * std_dev)
        df['BB_Lower'] = df['BB_Middle'] - (df['BB_Std'] * std_dev)
        return df

    def calculate_kdj(self, df, n=9, m1=3, m2=3):
        """计算KDJ指标"""
        low_list = df['low'].rolling(window=n).min()
        high_list = df['high'].rolling(window=n).max()

        rsv = (df['close'] - low_list) / (high_list - low_list) * 100
        df['K'] = rsv.ewm(com=m1-1, adjust=False).mean()
        df['D'] = df['K'].ewm(com=m2-1, adjust=False).mean()
        df['J'] = 3 * df['K'] - 2 * df['D']
        return df

    def analyze(self, df):
        """进行技术分析"""
        print("\n" + "="*70)
        print("创业板指数（399006）技术分析报告".center(70))
        print("="*70)

        if df.empty:
            print("没有数据可分析")
            return

        # 最新数据
        latest = df.iloc[-1]
        prev = df.iloc[-2] if len(df) > 1 else latest
        prev5 = df.iloc[-6] if len(df) > 5 else latest
        prev20 = df.iloc[-21] if len(df) > 20 else latest

        print(f"\n【基本信息】")
        print(f"日期:     {latest['date']}")
        print(f"收盘价:   {latest['close']:.2f} 点")
        print(f"开盘价:   {latest['open']:.2f} 点")
        print(f"最高价:   {latest['high']:.2f} 点")
        print(f"最低价:   {latest['low']:.2f} 点")
        print(f"涨跌幅:   {latest['change_pct']:+.2f}%")
        print(f"涨跌额:   {latest['change']:+.2f} 点")
        print(f"成交量:   {latest['volume']/100000000:.2f} 亿手")
        print(f"成交额:   {latest['amount']:.2f} 亿元")
        print(f"振幅:     {latest['amplitude']:.2f}%")

        # 近期表现
        print(f"\n【近期表现】")
        if len(df) >= 6:
            week_change = ((latest['close'] - prev5['close']) / prev5['close']) * 100
            print(f"近5日涨跌:  {week_change:+.2f}%")

        if len(df) >= 21:
            month_change = ((latest['close'] - prev20['close']) / prev20['close']) * 100
            print(f"近20日涨跌: {month_change:+.2f}%")

        # 移动平均线分析
        print(f"\n【均线系统】")
        mas = {}
        for period in [5, 10, 20, 30, 60]:
            if f'MA{period}' in latest.index and not pd.isna(latest[f'MA{period}']):
                ma_val = latest[f'MA{period}']
                mas[period] = ma_val
                deviation = ((latest['close'] - ma_val) / ma_val) * 100
                print(f"MA{period:2d}:  {ma_val:8.2f} 点 (乖离率: {deviation:+.2f}%)")

        # 判断均线趋势
        if len(mas) >= 4:
            if (latest['close'] > mas.get(5, 0) > mas.get(10, 0) > mas.get(20, 0) > mas.get(30, 0)):
                ma_trend = "完美多头排列 🚀（强势上涨）"
                ma_score = 2.0
            elif (latest['close'] > mas.get(5, 0) > mas.get(10, 0) > mas.get(20, 0)):
                ma_trend = "多头排列 📈（偏强）"
                ma_score = 1.5
            elif (latest['close'] < mas.get(5, float('inf')) < mas.get(10, float('inf')) < mas.get(20, float('inf')) < mas.get(30, float('inf'))):
                ma_trend = "完美空头排列 📉（弱势下跌）"
                ma_score = -2.0
            elif (latest['close'] < mas.get(5, float('inf')) < mas.get(10, float('inf')) < mas.get(20, float('inf'))):
                ma_trend = "空头排列 📉（偏弱）"
                ma_score = -1.5
            else:
                ma_trend = "均线缠绕 ↔️（震荡整理）"
                ma_score = 0
            print(f"\n均线形态: {ma_trend}")

        # MACD分析
        print(f"\n【MACD指标】")
        if 'MACD' in latest.index:
            print(f"MACD线:      {latest['MACD']:.3f}")
            print(f"Signal线:    {latest['Signal']:.3f}")
            print(f"柱状图:      {latest['Histogram']:.3f}")

            macd_score = 0
            if not pd.isna(latest['MACD']) and not pd.isna(latest['Signal']):
                if latest['MACD'] > latest['Signal'] and prev['MACD'] <= prev['Signal']:
                    macd_signal = "金叉 🟢（买入信号）"
                    macd_score = 1.5
                elif latest['MACD'] < latest['Signal'] and prev['MACD'] >= prev['Signal']:
                    macd_signal = "死叉 🔴（卖出信号）"
                    macd_score = -1.5
                elif latest['MACD'] > latest['Signal']:
                    macd_signal = "多头区域（看涨）"
                    macd_score = 1.0
                else:
                    macd_signal = "空头区域（看跌）"
                    macd_score = -1.0

                # 柱状图强度
                if latest['Histogram'] > 0 and latest['Histogram'] > prev['Histogram']:
                    macd_signal += " - 柱状图增强"
                    macd_score += 0.5
                elif latest['Histogram'] < 0 and latest['Histogram'] < prev['Histogram']:
                    macd_signal += " - 柱状图走弱"
                    macd_score -= 0.5

                print(f"MACD信号: {macd_signal}")

        # RSI分析
        print(f"\n【RSI指标】")
        if 'RSI' in latest.index and not pd.isna(latest['RSI']):
            print(f"RSI(14):  {latest['RSI']:.2f}")

            rsi_score = 0
            if latest['RSI'] > 80:
                rsi_signal = "严重超买 ⚠️⚠️（强烈回调风险）"
                rsi_score = -2.0
            elif latest['RSI'] > 70:
                rsi_signal = "超买区域 ⚠️（注意回调）"
                rsi_score = -1.0
            elif latest['RSI'] < 20:
                rsi_signal = "严重超卖 ⚠️⚠️（强烈反弹信号）"
                rsi_score = 2.0
            elif latest['RSI'] < 30:
                rsi_signal = "超卖区域 ⚠️（可能反弹）"
                rsi_score = 1.0
            elif latest['RSI'] > 50:
                rsi_signal = "强势区域（偏多）"
                rsi_score = 0.5
            else:
                rsi_signal = "弱势区域（偏空）"
                rsi_score = -0.5
            print(f"RSI状态:  {rsi_signal}")

        # KDJ分析
        print(f"\n【KDJ指标】")
        if 'K' in latest.index and not pd.isna(latest['K']):
            print(f"K值:  {latest['K']:.2f}")
            print(f"D值:  {latest['D']:.2f}")
            print(f"J值:  {latest['J']:.2f}")

            kdj_score = 0
            if latest['K'] > latest['D'] and prev['K'] <= prev['D']:
                kdj_signal = "K线上穿D线 🟢（金叉，买入）"
                kdj_score = 1.0
            elif latest['K'] < latest['D'] and prev['K'] >= prev['D']:
                kdj_signal = "K线下穿D线 🔴（死叉，卖出）"
                kdj_score = -1.0
            elif latest['J'] > 100:
                kdj_signal = "J值超过100（超买）"
                kdj_score = -0.5
            elif latest['J'] < 0:
                kdj_signal = "J值低于0（超卖）"
                kdj_score = 0.5
            else:
                kdj_signal = "正常震荡"
                kdj_score = 0
            print(f"KDJ信号: {kdj_signal}")

        # 布林带分析
        print(f"\n【布林带】")
        if 'BB_Upper' in latest.index and not pd.isna(latest['BB_Upper']):
            print(f"上轨:  {latest['BB_Upper']:.2f} 点")
            print(f"中轨:  {latest['BB_Middle']:.2f} 点")
            print(f"下轨:  {latest['BB_Lower']:.2f} 点")

            bb_width = latest['BB_Upper'] - latest['BB_Lower']
            bb_position = (latest['close'] - latest['BB_Lower']) / bb_width * 100 if bb_width > 0 else 50
            print(f"当前位置: {bb_position:.1f}% (0%=下轨, 50%=中轨, 100%=上轨)")

            bb_score = 0
            if latest['close'] > latest['BB_Upper']:
                bb_signal = "突破上轨（强势超买，注意回调）"
                bb_score = -0.5
            elif latest['close'] < latest['BB_Lower']:
                bb_signal = "跌破下轨（超卖，可能反弹）"
                bb_score = 0.5
            elif bb_position > 70:
                bb_signal = "接近上轨（偏强）"
                bb_score = 0.3
            elif bb_position < 30:
                bb_signal = "接近下轨（偏弱）"
                bb_score = -0.3
            else:
                bb_signal = "中轨区域（震荡）"
                bb_score = 0
            print(f"布林带信号: {bb_signal}")

        # 成交量分析
        print(f"\n【成交量分析】")
        if len(df) >= 6:
            avg_volume_5 = df['volume'].tail(5).mean()
            volume_ratio = (latest['volume'] / avg_volume_5) * 100 if avg_volume_5 > 0 else 100
            print(f"今日成交量: {latest['volume']/100000000:.2f} 亿手")
            print(f"5日平均量: {avg_volume_5/100000000:.2f} 亿手")
            print(f"量比: {volume_ratio:.1f}%")

            if volume_ratio > 150 and latest['change_pct'] > 0:
                volume_signal = "放量上涨 🔥（强势）"
            elif volume_ratio > 150 and latest['change_pct'] < 0:
                volume_signal = "放量下跌 ⚠️（警惕）"
            elif volume_ratio < 70:
                volume_signal = "缩量交易（观望情绪浓厚）"
            else:
                volume_signal = "正常交易"
            print(f"成交量状态: {volume_signal}")

        # 综合分析
        print(f"\n" + "="*70)
        print("【综合研判】")
        print("="*70)

        # 综合评分
        total_score = 0
        signals = []
        warnings = []

        # 收集各项得分
        if 'ma_score' in locals():
            total_score += ma_score
            if ma_score > 1:
                signals.append(f"均线多头排列 (+{ma_score:.1f}分)")
            elif ma_score < -1:
                warnings.append(f"均线空头排列 ({ma_score:.1f}分)")

        if 'macd_score' in locals():
            total_score += macd_score
            if macd_score > 1:
                signals.append(f"MACD金叉或强势 (+{macd_score:.1f}分)")
            elif macd_score < -1:
                warnings.append(f"MACD死叉或弱势 ({macd_score:.1f}分)")

        if 'rsi_score' in locals():
            total_score += rsi_score
            if rsi_score > 1:
                signals.append(f"RSI超卖反弹 (+{rsi_score:.1f}分)")
            elif rsi_score < -1:
                warnings.append(f"RSI超买回调 ({rsi_score:.1f}分)")

        if 'kdj_score' in locals():
            total_score += kdj_score

        if 'bb_score' in locals():
            total_score += bb_score

        # 趋势判断
        print(f"\n技术评分: {total_score:.1f} 分")
        print(f"评分说明: >3分=强势多头, 1-3分=偏多, -1到1分=震荡, -3到-1分=偏空, <-3分=弱势")

        if signals:
            print(f"\n看多信号:")
            for sig in signals:
                print(f"  ✓ {sig}")

        if warnings:
            print(f"\n风险提示:")
            for warn in warnings:
                print(f"  ⚠ {warn}")

        # 综合研判
        if total_score >= 4:
            overall = "🚀 强势多头"
            suggestion = "技术面非常强势，但需注意不要追高，等待回调买入"
        elif total_score >= 2:
            overall = "📈 偏多格局"
            suggestion = "技术面偏强，可逢低适量买入"
        elif total_score >= 0:
            overall = "↗️ 震荡偏强"
            suggestion = "技术面中性偏强，谨慎操作，控制仓位"
        elif total_score >= -2:
            overall = "↘️ 震荡偏弱"
            suggestion = "技术面中性偏弱，观望为主，减少操作"
        elif total_score >= -4:
            overall = "📉 偏空格局"
            suggestion = "技术面偏弱，建议减仓规避风险"
        else:
            overall = "🔻 弱势空头"
            suggestion = "技术面很弱，严格控制风险，等待企稳信号"

        print(f"\n综合研判: {overall}")
        print(f"操作建议: {suggestion}")

        # 关键支撑位和压力位
        print(f"\n【关键价位】")
        if 'MA20' in latest.index and not pd.isna(latest['MA20']):
            print(f"支撑位1: {latest['BB_Lower']:.2f} 点 (布林下轨)")
            print(f"支撑位2: {latest['MA20']:.2f} 点 (20日均线)")
            print(f"压力位1: {latest['MA60']:.2f} 点 (60日均线)" if 'MA60' in latest.index and not pd.isna(latest['MA60']) else "")
            print(f"压力位2: {latest['BB_Upper']:.2f} 点 (布林上轨)")

        print("\n" + "="*70)
        print("免责声明: 以上分析仅供参考，不构成投资建议。")
        print("          股市有风险，投资需谨慎！请根据自身情况理性决策。")
        print("="*70 + "\n")

        # 生成简报
        return {
            'date': latest['date'],
            'close': latest['close'],
            'change_pct': latest['change_pct'],
            'score': total_score,
            'trend': overall,
            'suggestion': suggestion
        }

def main():
    analyzer = ChiNextAnalyzer()

    # 抓取数据
    print("开始抓取创业板指数数据...")
    print("数据来源: 东方财富网")
    data = analyzer.fetch_data()

    if not data:
        print("\n未能获取数据，请检查网络连接或稍后重试")
        return

    # 保存原始数据
    df = analyzer.save_to_csv()

    if df is None or df.empty:
        print("数据为空，无法进行分析")
        return

    # 计算技术指标
    print("\n正在计算技术指标...")
    df = analyzer.calculate_ma(df)
    df = analyzer.calculate_ema(df)
    df = analyzer.calculate_macd(df)
    df = analyzer.calculate_rsi(df)
    df = analyzer.calculate_kdj(df)
    df = analyzer.calculate_bollinger_bands(df)

    # 保存带指标的数据
    df.to_csv('chinext_analysis.csv', index=False, encoding='utf-8-sig')
    print("分析数据已保存到 chinext_analysis.csv")

    # 进行技术分析
    result = analyzer.analyze(df)

    # 保存分析结果
    if result:
        with open('chinext_report.json', 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"分析报告已保存到 chinext_report.json")

if __name__ == "__main__":
    main()
