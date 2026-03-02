#!/usr/bin/env python3
"""
基于 akshare 的金融数据获取器
支持：A股、港股、美股、黄金/白银等大宗商品

用法：
    python3 fetch_stock_ak.py 002594.SZ          # A股深市
    python3 fetch_stock_ak.py 600519.SS          # A股沪市
    python3 fetch_stock_ak.py 1211.HK            # 港股
    python3 fetch_stock_ak.py TSLA               # 美股
    python3 fetch_stock_ak.py XAU                # 黄金
    python3 fetch_stock_ak.py XAG                # 白银
    python3 fetch_stock_ak.py CL                 # 原油
    python3 fetch_stock_ak.py --type stock 002594.SZ   # 指定类型
    python3 fetch_stock_ak.py --type commodity XAU     # 指定类型

输出：JSON 格式的标准化数据
"""

import sys
import json
import re
import argparse
from datetime import datetime

import akshare as ak
import pandas as pd


# ============================================================
# 商品代码映射
# ============================================================
COMMODITY_MAP = {
    # 贵金属
    'XAU': {'name': '黄金', 'type': 'precious_metal'},
    'GOLD': {'name': '黄金', 'type': 'precious_metal'},
    'XAG': {'name': '白银', 'type': 'precious_metal'},
    'SILVER': {'name': '白银', 'type': 'precious_metal'},
    'XPT': {'name': '铂金', 'type': 'precious_metal'},
    'XPD': {'name': '钯金', 'type': 'precious_metal'},
    # 能源
    'CL': {'name': '原油(WTI)', 'type': 'energy'},
    'OIL': {'name': '原油(WTI)', 'type': 'energy'},
    'BRENT': {'name': '原油(布伦特)', 'type': 'energy'},
    'NG': {'name': '天然气', 'type': 'energy'},
    # 农产品
    'SOYBEAN': {'name': '大豆', 'type': 'agriculture'},
    'CORN': {'name': '玉米', 'type': 'agriculture'},
    'WHEAT': {'name': '小麦', 'type': 'agriculture'},
}

# 股票名称映射（中文 → 代码）
STOCK_NAME_MAP = {
    '比亚迪': '002594.SZ',
    '茅台': '600519.SS',
    '贵州茅台': '600519.SS',
    '特斯拉': 'TSLA',
    '苹果': 'AAPL',
    '腾讯': '0700.HK',
    '阿里': 'BABA',
    '阿里巴巴': 'BABA',
    '宁德时代': '300750.SZ',
    '中国平安': '601318.SS',
    '黄金': 'XAU',
    '白银': 'XAG',
    '原油': 'CL',
}


def is_commodity(symbol: str) -> bool:
    """判断是否为商品代码"""
    return symbol.upper() in COMMODITY_MAP


def detect_type(symbol: str) -> str:
    """自动检测资产类型"""
    s = symbol.upper().strip()
    if s in COMMODITY_MAP:
        return 'commodity'
    if s in STOCK_NAME_MAP:
        resolved = STOCK_NAME_MAP[s]
        if resolved.upper() in COMMODITY_MAP:
            return 'commodity'
        return 'stock'
    if s.endswith('.SS') or s.endswith('.SZ'):
        return 'stock'
    if s.endswith('.HK'):
        return 'stock'
    if re.match(r'^\d{6}$', s):
        return 'stock'
    if re.match(r'^\d{4,5}$', s):
        return 'stock'
    if re.match(r'^[A-Z]+$', s) and len(s) <= 5:
        # 短字母可能是美股也可能是商品，优先看商品映射
        if s in COMMODITY_MAP:
            return 'commodity'
        return 'stock'
    return 'stock'


def normalize_symbol(symbol: str) -> str:
    """标准化代码"""
    s = symbol.strip()
    # 中文名映射
    if s in STOCK_NAME_MAP:
        return STOCK_NAME_MAP[s]
    s = s.upper()
    # 纯6位数字 → A股
    if re.match(r'^\d{6}$', s):
        if s.startswith('6') or s.startswith('68'):
            return f'{s}.SS'
        return f'{s}.SZ'
    # 纯4-5位数字 → 港股
    if re.match(r'^\d{4,5}$', s):
        return f'{s.zfill(5)}.HK'
    return s


# ============================================================
# A股数据获取
# ============================================================
def fetch_a_share(symbol: str) -> dict | None:
    """获取 A 股实时行情 + 基本面数据"""
    code = symbol.split('.')[0]
    suffix = symbol.split('.')[1] if '.' in symbol else ''
    market = 'A股沪市' if suffix == 'SS' else 'A股深市'

    try:
        # 实时行情：东方财富 A 股实时行情
        df = ak.stock_zh_a_spot_em()
        row = df[df['代码'] == code]
        if row.empty:
            return None

        row = row.iloc[0]
        current = float(row.get('最新价', 0) or 0)
        prev_close = float(row.get('昨收', 0) or 0)
        open_price = float(row.get('今开', 0) or 0)
        high = float(row.get('最高', 0) or 0)
        low = float(row.get('最低', 0) or 0)
        volume = float(row.get('成交量', 0) or 0)
        turnover = float(row.get('成交额', 0) or 0)
        change = float(row.get('涨跌额', 0) or 0)
        change_pct = float(row.get('涨跌幅', 0) or 0)
        turnover_rate = row.get('换手率', None)
        pe = row.get('市盈率-动态', None)
        pb = row.get('市净率', None)
        total_mv = row.get('总市值', None)
        circ_mv = row.get('流通市值', None)
        high_52w = row.get('52周最高', None) or row.get('年初至今最高', None)
        low_52w = row.get('52周最低', None) or row.get('年初至今最低', None)
        name = str(row.get('名称', code))

        result = {
            'symbol': symbol,
            'name': name,
            'market': market,
            'updated_at': datetime.now().isoformat(),
            'price': {
                'current': current,
                'open': open_price,
                'prev_close': prev_close,
                'high': high,
                'low': low,
                'change': round(change, 3),
                'change_pct': f'{"+" if change_pct >= 0 else ""}{change_pct:.2f}%',
            },
            'volume': int(volume),
            'turnover': round(turnover, 2),
            '_source': 'akshare',
        }

        if pe is not None and pd.notna(pe):
            result['pe_ratio'] = round(float(pe), 2)
        if pb is not None and pd.notna(pb):
            result['pb_ratio'] = round(float(pb), 2)
        if total_mv is not None and pd.notna(total_mv):
            result['market_cap'] = float(total_mv)
        if circ_mv is not None and pd.notna(circ_mv):
            result['circ_market_cap'] = float(circ_mv)
        if turnover_rate is not None and pd.notna(turnover_rate):
            result['turnover_rate'] = f'{float(turnover_rate):.2f}%'
        if high_52w is not None and pd.notna(high_52w) and low_52w is not None and pd.notna(low_52w):
            result['range_52w'] = {'high': float(high_52w), 'low': float(low_52w)}

        # 获取资金流向
        try:
            fund_df = ak.stock_individual_fund_flow(stock=code, market=suffix.lower() if suffix else 'sz')
            if fund_df is not None and not fund_df.empty:
                latest = fund_df.iloc[-1]
                result['capital_flow'] = {
                    'main_net': str(latest.get('主力净流入-净额', '')),
                    'retail_net': str(latest.get('小单净流入-净额', '')),
                }
        except Exception:
            pass

        return result
    except Exception as e:
        print(f'[WARN] akshare A-share fetch failed: {e}', file=sys.stderr)
        return None


# ============================================================
# 港股数据获取
# ============================================================
def fetch_hk_stock(symbol: str) -> dict | None:
    """获取港股实时行情"""
    code = symbol.replace('.HK', '').lstrip('0')

    try:
        df = ak.stock_hk_spot_em()
        # 代码列可能有前导零
        row = df[df['代码'].str.lstrip('0') == code]
        if row.empty:
            # 尝试用原始代码匹配
            row = df[df['代码'] == symbol.replace('.HK', '')]
        if row.empty:
            return None

        row = row.iloc[0]
        current = float(row.get('最新价', 0) or 0)
        prev_close = float(row.get('昨收', 0) or 0)
        change = float(row.get('涨跌额', 0) or 0)
        change_pct = float(row.get('涨跌幅', 0) or 0)
        volume = float(row.get('成交量', 0) or 0)
        turnover = float(row.get('成交额', 0) or 0)
        name = str(row.get('名称', code))

        result = {
            'symbol': symbol,
            'name': name,
            'market': '港股',
            'updated_at': datetime.now().isoformat(),
            'price': {
                'current': current,
                'prev_close': prev_close,
                'change': round(change, 3),
                'change_pct': f'{"+" if change_pct >= 0 else ""}{change_pct:.2f}%',
            },
            'volume': int(volume),
            'turnover': round(turnover, 2),
            '_source': 'akshare',
        }

        pe = row.get('市盈率', None)
        if pe is not None and pd.notna(pe):
            result['pe_ratio'] = round(float(pe), 2)

        return result
    except Exception as e:
        print(f'[WARN] akshare HK stock fetch failed: {e}', file=sys.stderr)
        return None


# ============================================================
# 美股数据获取
# ============================================================
def fetch_us_stock(symbol: str) -> dict | None:
    """获取美股实时行情"""
    try:
        df = ak.stock_us_spot_em()
        # 美股代码可能在不同列
        sym_upper = symbol.upper()
        row = df[df['代码'].str.upper().str.contains(sym_upper)]
        if row.empty:
            # 尝试用名称匹配
            row = df[df['名称'].str.contains(sym_upper, case=False, na=False)]
        if row.empty:
            return None

        row = row.iloc[0]
        current = float(row.get('最新价', 0) or 0)
        prev_close = float(row.get('昨收', 0) or 0)
        change = float(row.get('涨跌额', 0) or 0)
        change_pct = float(row.get('涨跌幅', 0) or 0)
        volume = float(row.get('成交量', 0) or 0)
        name = str(row.get('名称', symbol))

        result = {
            'symbol': symbol,
            'name': name,
            'market': '美股',
            'updated_at': datetime.now().isoformat(),
            'price': {
                'current': current,
                'prev_close': prev_close,
                'change': round(change, 3),
                'change_pct': f'{"+" if change_pct >= 0 else ""}{change_pct:.2f}%',
            },
            'volume': int(volume),
            '_source': 'akshare',
        }

        pe = row.get('市盈率', None)
        if pe is not None and pd.notna(pe):
            result['pe_ratio'] = round(float(pe), 2)
        total_mv = row.get('总市值', None)
        if total_mv is not None and pd.notna(total_mv):
            result['market_cap'] = float(total_mv)

        return result
    except Exception as e:
        print(f'[WARN] akshare US stock fetch failed: {e}', file=sys.stderr)
        return None


# ============================================================
# 大宗商品 / 贵金属
# ============================================================
def fetch_gold() -> dict | None:
    """获取国际黄金现货价格"""
    # 方式1：上海金基准价（无参数）
    try:
        df = ak.spot_golden_benchmark_sge()
        if df is not None and not df.empty:
            latest = df.iloc[-1]
            # 列名可能是中文或英文，按位置取
            cols = list(df.columns)
            price = float(latest.iloc[1]) if len(latest) > 1 else 0
            date_str = str(latest.iloc[0]) if len(latest) > 0 else ''
            return {
                'symbol': 'XAU',
                'name': '黄金(上海金基准价)',
                'market': '大宗商品',
                'asset_type': 'commodity',
                'updated_at': datetime.now().isoformat(),
                'price': {
                    'current': price,
                    'unit': '元/克',
                },
                '_source': 'akshare_sge',
                '_note': f'基准日期: {date_str}',
            }
    except Exception as e:
        print(f'[WARN] SGE gold benchmark fetch failed: {e}', file=sys.stderr)

    # 方式2：Au99.99 历史行情
    try:
        df = ak.spot_hist_sge(symbol="Au99.99")
        if df is not None and not df.empty:
            latest = df.iloc[-1]
            cols = list(df.columns)
            # 尝试中文列名，回退到位置
            def _get(row, names, idx):
                for n in names:
                    if n in row.index:
                        v = row[n]
                        if pd.notna(v):
                            return float(v)
                if idx < len(row):
                    v = row.iloc[idx]
                    if pd.notna(v):
                        return float(v)
                return 0

            return {
                'symbol': 'XAU',
                'name': '黄金(Au99.99)',
                'market': '大宗商品',
                'asset_type': 'commodity',
                'updated_at': datetime.now().isoformat(),
                'price': {
                    'current': _get(latest, ['收盘价', 'close'], 4),
                    'open': _get(latest, ['开盘价', 'open'], 1),
                    'high': _get(latest, ['最高价', 'high'], 2),
                    'low': _get(latest, ['最低价', 'low'], 3),
                    'unit': '元/克',
                },
                '_source': 'akshare_sge',
            }
    except Exception as e:
        print(f'[WARN] SGE Au99.99 fetch failed: {e}', file=sys.stderr)

    # 方式3：外盘期货黄金
    try:
        df = ak.futures_foreign_commodity_realtime(symbol="全部")
        if df is not None and not df.empty:
            row = df[df['名称'].str.contains('黄金|Gold|GOLD', case=False, na=False)]
            if not row.empty:
                row = row.iloc[0]
                current = float(row.get('最新价', 0) or 0)
                prev = float(row.get('昨结算', 0) or row.get('昨收', 0) or 0)
                change = current - prev if prev else 0
                pct = (change / prev * 100) if prev else 0
                return {
                    'symbol': 'XAU',
                    'name': '国际黄金',
                    'market': '大宗商品',
                    'asset_type': 'commodity',
                    'updated_at': datetime.now().isoformat(),
                    'price': {
                        'current': current,
                        'prev_close': prev,
                        'change': round(change, 2),
                        'change_pct': f'{"+" if pct >= 0 else ""}{pct:.2f}%',
                        'unit': '美元/盎司',
                    },
                    '_source': 'akshare_futures',
                }
    except Exception as e:
        print(f'[WARN] Futures gold fetch failed: {e}', file=sys.stderr)

    return None


def fetch_silver() -> dict | None:
    """获取白银价格"""
    # 方式1：上海金交所 Ag(T+D)
    try:
        df = ak.spot_hist_sge(symbol="Ag(T+D)")
        if df is not None and not df.empty:
            latest = df.iloc[-1]

            def _get(row, names, idx):
                for n in names:
                    if n in row.index and pd.notna(row[n]):
                        return float(row[n])
                if idx < len(row) and pd.notna(row.iloc[idx]):
                    return float(row.iloc[idx])
                return 0

            return {
                'symbol': 'XAG',
                'name': '白银(Ag T+D)',
                'market': '大宗商品',
                'asset_type': 'commodity',
                'updated_at': datetime.now().isoformat(),
                'price': {
                    'current': _get(latest, ['收盘价', 'close'], 4),
                    'open': _get(latest, ['开盘价', 'open'], 1),
                    'high': _get(latest, ['最高价', 'high'], 2),
                    'low': _get(latest, ['最低价', 'low'], 3),
                    'unit': '元/千克',
                },
                '_source': 'akshare_sge',
            }
    except Exception as e:
        print(f'[WARN] SGE silver fetch failed: {e}', file=sys.stderr)

    # 方式2：外盘期货白银
    try:
        df = ak.futures_foreign_commodity_realtime(symbol="全部")
        if df is not None and not df.empty:
            row = df[df['名称'].str.contains('白银|Silver|SILVER', case=False, na=False)]
            if not row.empty:
                row = row.iloc[0]
                current = float(row.get('最新价', 0) or 0)
                prev = float(row.get('昨结算', 0) or row.get('昨收', 0) or 0)
                change = current - prev if prev else 0
                pct = (change / prev * 100) if prev else 0
                return {
                    'symbol': 'XAG',
                    'name': '国际白银',
                    'market': '大宗商品',
                    'asset_type': 'commodity',
                    'updated_at': datetime.now().isoformat(),
                    'price': {
                        'current': current,
                        'prev_close': prev,
                        'change': round(change, 2),
                        'change_pct': f'{"+" if pct >= 0 else ""}{pct:.2f}%',
                        'unit': '美元/盎司',
                    },
                    '_source': 'akshare_futures',
                }
    except Exception as e:
        print(f'[WARN] Futures silver fetch failed: {e}', file=sys.stderr)

    return None


def fetch_commodity_futures(symbol: str) -> dict | None:
    """获取期货商品价格（原油等）"""
    commodity_info = COMMODITY_MAP.get(symbol.upper())
    if not commodity_info:
        return None

    try:
        # 国际大宗商品实时行情
        df = ak.futures_foreign_commodity_realtime(symbol="全部")
        if df is not None and not df.empty:
            name = commodity_info['name']
            # 模糊匹配商品名称
            row = df[df['名称'].str.contains(name.split('(')[0], na=False)]
            if row.empty:
                # 尝试英文名
                name_map = {'原油': 'WTI|Oil|Crude', '天然气': 'Gas', '大豆': 'Soy', '玉米': 'Corn', '小麦': 'Wheat'}
                pattern = name_map.get(name.split('(')[0], name)
                row = df[df['名称'].str.contains(pattern, case=False, na=False)]
            if not row.empty:
                row = row.iloc[0]
                current = float(row.get('最新价', 0) or 0)
                prev_close = float(row.get('昨结算', 0) or row.get('昨收', 0) or 0)
                change = current - prev_close if prev_close else 0
                change_pct = (change / prev_close * 100) if prev_close else 0

                return {
                    'symbol': symbol.upper(),
                    'name': commodity_info['name'],
                    'market': '大宗商品',
                    'asset_type': 'commodity',
                    'updated_at': datetime.now().isoformat(),
                    'price': {
                        'current': current,
                        'prev_close': prev_close,
                        'change': round(change, 2),
                        'change_pct': f'{"+" if change_pct >= 0 else ""}{change_pct:.2f}%',
                    },
                    '_source': 'akshare_futures',
                }
    except Exception as e:
        print(f'[WARN] akshare commodity futures fetch failed: {e}', file=sys.stderr)

    return None


def fetch_commodity(symbol: str) -> dict | None:
    """获取大宗商品数据（自动路由）"""
    s = symbol.upper()
    if s in ('XAU', 'GOLD'):
        return fetch_gold()
    if s in ('XAG', 'SILVER'):
        return fetch_silver()
    # 其他商品走期货接口
    return fetch_commodity_futures(s)


# ============================================================
# 统一入口
# ============================================================
def fetch(symbol: str, asset_type: str | None = None) -> dict:
    """根据代码格式自动选择数据源"""
    symbol = normalize_symbol(symbol)
    if asset_type is None:
        asset_type = detect_type(symbol)

    result = None

    if asset_type == 'commodity':
        result = fetch_commodity(symbol)
    elif symbol.endswith('.SS') or symbol.endswith('.SZ'):
        result = fetch_a_share(symbol)
    elif symbol.endswith('.HK'):
        result = fetch_hk_stock(symbol)
    elif re.match(r'^[A-Z]+$', symbol):
        result = fetch_us_stock(symbol)

    if result:
        return result

    return {
        'symbol': symbol,
        'error': f'无法获取 {symbol} 的数据',
        'updated_at': datetime.now().isoformat(),
    }


def main():
    parser = argparse.ArgumentParser(description='akshare 金融数据获取器')
    parser.add_argument('symbols', nargs='+', help='股票代码或商品代码')
    parser.add_argument('--type', choices=['stock', 'commodity'], default=None,
                        help='资产类型（默认自动检测）')
    args = parser.parse_args()

    if len(args.symbols) == 1:
        result = fetch(args.symbols[0], args.type)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        results = [fetch(s, args.type) for s in args.symbols]
        print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
