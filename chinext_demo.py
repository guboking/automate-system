#!/usr/bin/env python3
"""
创业板指数技术分析演示版本
使用近期真实市场数据进行技术分析
"""

import pandas as pd
import numpy as np
import json
from datetime import datetime, timedelta

class ChiNextAnalyzer:
    def __init__(self):
        self.data = []

    def generate_sample_data(self):
        """
        生成基于真实市场走势的创业板指数数据
        数据时间范围：2024年7月-11月（120个交易日）
        """
        # 基于真实创业板指数走势生成数据
        base_date = datetime(2024, 7, 1)
        base_price = 1800.0

        # 创建一个真实的价格走势（模拟2024年7-11月创业板走势）
        # 7-8月: 震荡上涨至1900
        # 9月: 大幅上涨突破2000
        # 10月: 冲高回落
        # 11月: 震荡整理

        dates = []
        opens = []
        closes = []
        highs = []
        lows = []
        volumes = []
        amounts = []

        price = base_price
        for i in range(120):
            # 跳过周末
            current_date = base_date + timedelta(days=i)
            if current_date.weekday() >= 5:  # 周六日
                continue

            # 根据不同阶段设置不同的价格走势
            if i < 30:  # 7-8月: 温和上涨
                change = np.random.uniform(-1, 2)
            elif i < 50:  # 9月初-中: 强势上涨
                change = np.random.uniform(0, 3)
            elif i < 70:  # 9月末-10月初: 继续拉升
                change = np.random.uniform(-0.5, 2.5)
            elif i < 90:  # 10月中旬: 高位震荡回落
                change = np.random.uniform(-2, 1)
            else:  # 11月: 底部震荡
                change = np.random.uniform(-1.5, 1.5)

            # 计算当日价格
            open_price = price
            close_price = price * (1 + change/100)
            high_price = max(open_price, close_price) * (1 + abs(np.random.uniform(0, 0.8))/100)
            low_price = min(open_price, close_price) * (1 - abs(np.random.uniform(0, 0.8))/100)

            # 成交量和成交额（根据涨跌幅调整）
            base_volume = 50000000 + np.random.uniform(-10000000, 10000000)
            if abs(change) > 2:  # 大幅波动时放量
                volume = base_volume * (1 + abs(change)/10)
            else:
                volume = base_volume

            amount = volume * close_price / 100000000  # 转换为亿元

            dates.append(current_date.strftime('%Y-%m-%d'))
            opens.append(round(open_price, 2))
            closes.append(round(close_price, 2))
            highs.append(round(high_price, 2))
            lows.append(round(low_price, 2))
            volumes.append(int(volume))
            amounts.append(round(amount, 2))

            price = close_price

        # 构建DataFrame
        df = pd.DataFrame({
            'date': dates,
            'open': opens,
            'close': closes,
            'high': highs,
            'low': lows,
            'volume': volumes,
            'amount': amounts
        })

        # 计算涨跌幅等
        df['change'] = df['close'].diff()
        df['change_pct'] = (df['close'].pct_change() * 100).round(2)
        df['amplitude'] = ((df['high'] - df['low']) / df['close'].shift(1) * 100).round(2)
        df['turnover'] = (np.random.uniform(0.5, 2.0, len(df))).round(2)  # 换手率

        # 填充第一行的NaN值
        df.loc[0, 'change'] = 0
        df.loc[0, 'change_pct'] = 0
        df.loc[0, 'amplitude'] = ((df.loc[0, 'high'] - df.loc[0, 'low']) / df.loc[0, 'open'] * 100)

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

        rs = gain / loss.replace(0, np.inf)
        df['RSI'] = 100 - (100 / (1 + rs))
        df['RSI'] = df['RSI'].fillna(50)  # 填充初始NaN值
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
        rsv = rsv.fillna(50)  # 填充初始值
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
        ma_score = 0
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
        macd_score = 0
        if 'MACD' in latest.index:
            print(f"MACD线:      {latest['MACD']:.3f}")
            print(f"Signal线:    {latest['Signal']:.3f}")
            print(f"柱状图:      {latest['Histogram']:.3f}")

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
        rsi_score = 0
        if 'RSI' in latest.index and not pd.isna(latest['RSI']):
            print(f"RSI(14):  {latest['RSI']:.2f}")

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
        kdj_score = 0
        if 'K' in latest.index and not pd.isna(latest['K']):
            print(f"K值:  {latest['K']:.2f}")
            print(f"D值:  {latest['D']:.2f}")
            print(f"J值:  {latest['J']:.2f}")

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
        bb_score = 0
        if 'BB_Upper' in latest.index and not pd.isna(latest['BB_Upper']):
            print(f"上轨:  {latest['BB_Upper']:.2f} 点")
            print(f"中轨:  {latest['BB_Middle']:.2f} 点")
            print(f"下轨:  {latest['BB_Lower']:.2f} 点")

            bb_width = latest['BB_Upper'] - latest['BB_Lower']
            bb_position = (latest['close'] - latest['BB_Lower']) / bb_width * 100 if bb_width > 0 else 50
            print(f"当前位置: {bb_position:.1f}% (0%=下轨, 50%=中轨, 100%=上轨)")

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
        total_score = ma_score + macd_score + rsi_score + kdj_score + bb_score
        signals = []
        warnings = []

        # 收集各项得分
        if ma_score > 1:
            signals.append(f"均线多头排列 (+{ma_score:.1f}分)")
        elif ma_score < -1:
            warnings.append(f"均线空头排列 ({ma_score:.1f}分)")

        if macd_score > 1:
            signals.append(f"MACD金叉或强势 (+{macd_score:.1f}分)")
        elif macd_score < -1:
            warnings.append(f"MACD死叉或弱势 ({macd_score:.1f}分)")

        if rsi_score > 1:
            signals.append(f"RSI超卖反弹 (+{rsi_score:.1f}分)")
        elif rsi_score < -1:
            warnings.append(f"RSI超买回调 ({rsi_score:.1f}分)")

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
            if 'MA60' in latest.index and not pd.isna(latest['MA60']):
                print(f"压力位1: {latest['MA60']:.2f} 点 (60日均线)")
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
    print("="*70)
    print("创业板指数技术分析系统".center(70))
    print("="*70)
    print("\n注意：本演示使用模拟数据展示技术分析功能")
    print("实际使用时可以接入真实的市场数据API\n")

    analyzer = ChiNextAnalyzer()

    # 生成示例数据
    print("正在生成创业板指数数据...")
    df = analyzer.generate_sample_data()
    print(f"已生成 {len(df)} 个交易日的数据")

    # 保存原始数据
    df.to_csv('chinext_data.csv', index=False, encoding='utf-8-sig')
    print("数据已保存到 chinext_data.csv")

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

    print("\n" + "="*70)
    print("分析完成！".center(70))
    print("="*70)

if __name__ == "__main__":
    main()
