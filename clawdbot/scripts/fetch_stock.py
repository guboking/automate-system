#!/usr/bin/env python3
"""
股票实时数据获取器
直接调用免费行情接口，无需第三方库依赖

数据源：
- A股：新浪财经实时接口 + 东方财富行情接口
- 港股：新浪财经港股接口
- 美股：新浪财经美股接口

用法：
    python3 fetch_stock.py 002594.SZ          # A股深市
    python3 fetch_stock.py 600519.SS          # A股沪市
    python3 fetch_stock.py 1211.HK            # 港股
    python3 fetch_stock.py TSLA               # 美股
    python3 fetch_stock.py 002594.SZ 600519.SS  # 多只股票

输出：JSON 格式的标准化股票数据
"""

import sys
import json
import re
import requests
from datetime import datetime


def fetch_a_share_sina(symbol: str) -> dict | None:
    """通过新浪财经获取 A 股实时行情"""
    # 转换代码格式: 002594.SZ → sz002594, 600519.SS → sh600519
    code = symbol.split('.')[0]
    suffix = symbol.split('.')[1] if '.' in symbol else ''

    if suffix == 'SS':
        sina_code = f'sh{code}'
    elif suffix == 'SZ':
        sina_code = f'sz{code}'
    else:
        return None

    url = f'https://hq.sinajs.cn/list={sina_code}'
    headers = {
        'Referer': 'https://finance.sina.com.cn',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }

    try:
        resp = requests.get(url, headers=headers, timeout=10)
        resp.encoding = 'gbk'
        text = resp.text.strip()

        # 解析: var hq_str_sh600519="贵州茅台,1829.00,1831.98,...";
        match = re.search(r'"(.+)"', text)
        if not match:
            return None

        fields = match.group(1).split(',')
        if len(fields) < 32:
            return None

        name = fields[0]
        open_price = float(fields[1]) if fields[1] else 0
        prev_close = float(fields[2]) if fields[2] else 0
        current = float(fields[3]) if fields[3] else 0
        high = float(fields[4]) if fields[4] else 0
        low = float(fields[5]) if fields[5] else 0
        volume = int(float(fields[8])) if fields[8] else 0  # 成交量（手）
        turnover = float(fields[9]) if fields[9] else 0  # 成交额（元）
        date = fields[30]
        time = fields[31]

        change = current - prev_close
        change_pct = (change / prev_close * 100) if prev_close > 0 else 0

        market = 'A股沪市' if suffix == 'SS' else 'A股深市'

        return {
            'symbol': symbol,
            'name': name,
            'market': market,
            'updated_at': f'{date}T{time}',
            'price': {
                'current': current,
                'open': open_price,
                'prev_close': prev_close,
                'high': high,
                'low': low,
                'change': round(change, 2),
                'change_pct': f'{"+" if change_pct >= 0 else ""}{change_pct:.2f}%',
            },
            'volume': volume,
            'turnover': round(turnover, 2),
            '_source': 'sina_finance',
        }
    except Exception as e:
        print(f'[WARN] Sina A-share fetch failed: {e}', file=sys.stderr)
        return None


def fetch_a_share_eastmoney(symbol: str) -> dict | None:
    """通过东方财富获取 A 股详细数据（基本面+资金流向）"""
    code = symbol.split('.')[0]
    suffix = symbol.split('.')[1] if '.' in symbol else ''

    if suffix == 'SS':
        secid = f'1.{code}'
        market_id = 1
    elif suffix == 'SZ':
        secid = f'0.{code}'
        market_id = 0
    else:
        return None

    # 实时行情
    url = 'https://push2.eastmoney.com/api/qt/stock/get'
    params = {
        'secid': secid,
        'fields': 'f43,f44,f45,f46,f47,f48,f50,f51,f52,f55,f57,f58,f60,f116,f117,f162,f167,f170,f171,f173',
        'ut': 'fa5fd1943c7b386f172d6893dbbd1567',
    }

    try:
        resp = requests.get(url, params=params, timeout=10)
        data = resp.json().get('data', {})
        if not data:
            return None

        name = data.get('f58', '')
        current = data.get('f43', 0) / 1000 if data.get('f43') else 0
        prev_close = data.get('f60', 0) / 1000 if data.get('f60') else 0
        open_price = data.get('f46', 0) / 1000 if data.get('f46') else 0
        high = data.get('f44', 0) / 1000 if data.get('f44') else 0
        low = data.get('f45', 0) / 1000 if data.get('f45') else 0
        volume = data.get('f47', 0)
        turnover = data.get('f48', 0)
        high_52w = data.get('f51', 0) / 1000 if data.get('f51') else None
        low_52w = data.get('f52', 0) / 1000 if data.get('f52') else None
        pe = data.get('f167', None)
        pb = data.get('f173', None)
        total_mv = data.get('f116', None)  # 总市值
        circ_mv = data.get('f117', None)   # 流通市值
        turnover_rate = data.get('f170', None)

        if pe:
            pe = pe / 100
        if pb:
            pb = pb / 100
        if turnover_rate:
            turnover_rate = turnover_rate / 100

        change = current - prev_close if current and prev_close else 0
        change_pct = (change / prev_close * 100) if prev_close > 0 else 0

        result = {
            'symbol': symbol,
            'name': name,
            'market': 'A股沪市' if suffix == 'SS' else 'A股深市',
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
            'volume': volume,
            'turnover': turnover,
            '_source': 'eastmoney',
        }

        if high_52w and low_52w:
            result['range_52w'] = {'high': high_52w, 'low': low_52w}
        if pe is not None:
            result['pe_ratio'] = round(pe, 2)
        if pb is not None:
            result['pb_ratio'] = round(pb, 2)
        if total_mv:
            result['market_cap'] = total_mv
        if circ_mv:
            result['circ_market_cap'] = circ_mv
        if turnover_rate is not None:
            result['turnover_rate'] = f'{turnover_rate:.2f}%'

        return result
    except Exception as e:
        print(f'[WARN] EastMoney fetch failed: {e}', file=sys.stderr)
        return None


def fetch_hk_stock(symbol: str) -> dict | None:
    """获取港股实时行情"""
    code = symbol.replace('.HK', '').lstrip('0')
    sina_code = f'hk{code.zfill(5)}'

    url = f'https://hq.sinajs.cn/list={sina_code}'
    headers = {
        'Referer': 'https://finance.sina.com.cn',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }

    try:
        resp = requests.get(url, headers=headers, timeout=10)
        resp.encoding = 'gbk'
        text = resp.text.strip()

        match = re.search(r'"(.+)"', text)
        if not match:
            return None

        fields = match.group(1).split(',')
        if len(fields) < 17:
            return None

        # 港股新浪格式
        name_cn = fields[1]
        open_price = float(fields[2]) if fields[2] else 0
        prev_close = float(fields[3]) if fields[3] else 0
        high = float(fields[4]) if fields[4] else 0
        low = float(fields[5]) if fields[5] else 0
        current = float(fields[6]) if fields[6] else 0
        change = float(fields[7]) if fields[7] else 0
        change_pct_val = float(fields[8]) if fields[8] else 0
        volume = int(float(fields[12])) if fields[12] else 0
        turnover = float(fields[11]) if fields[11] else 0
        pe = float(fields[14]) if fields[14] and fields[14] != '0' else None
        high_52w = float(fields[15]) if fields[15] else None
        low_52w = float(fields[16]) if fields[16] else None
        date = fields[17] if len(fields) > 17 else ''
        time = fields[18] if len(fields) > 18 else ''

        result = {
            'symbol': symbol,
            'name': name_cn or f'HK{code}',
            'market': '港股',
            'updated_at': f'{date}T{time}' if date else datetime.now().isoformat(),
            'price': {
                'current': current,
                'open': open_price,
                'prev_close': prev_close,
                'high': high,
                'low': low,
                'change': change,
                'change_pct': f'{"+" if change_pct_val >= 0 else ""}{change_pct_val:.2f}%',
            },
            'volume': volume,
            'turnover': turnover,
            '_source': 'sina_finance',
        }

        if high_52w and low_52w:
            result['range_52w'] = {'high': high_52w, 'low': low_52w}
        if pe:
            result['pe_ratio'] = round(pe, 2)

        return result
    except Exception as e:
        print(f'[WARN] HK stock fetch failed: {e}', file=sys.stderr)
        return None


def fetch_us_stock(symbol: str) -> dict | None:
    """获取美股实时行情"""
    sina_code = f'gb_{symbol.lower()}'

    url = f'https://hq.sinajs.cn/list={sina_code}'
    headers = {
        'Referer': 'https://finance.sina.com.cn',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }

    try:
        resp = requests.get(url, headers=headers, timeout=10)
        resp.encoding = 'gbk'
        text = resp.text.strip()

        match = re.search(r'"(.+)"', text)
        if not match:
            return None

        fields = match.group(1).split(',')
        if len(fields) < 26:
            return None

        # 美股新浪格式
        name_cn = fields[0]
        current = float(fields[1]) if fields[1] else 0
        change = float(fields[2]) if fields[2] else 0
        change_pct_str = fields[3]
        timestamp = fields[25] if len(fields) > 25 else ''
        volume = int(float(fields[10])) if fields[10] else 0
        high = float(fields[6]) if fields[6] else 0
        low = float(fields[7]) if fields[7] else 0
        open_price = float(fields[5]) if fields[5] else 0
        prev_close = float(fields[26]) if len(fields) > 26 and fields[26] else current - change
        pe = float(fields[12]) if len(fields) > 12 and fields[12] else None
        high_52w = float(fields[8]) if fields[8] else None
        low_52w = float(fields[9]) if fields[9] else None
        market_cap = float(fields[13]) if len(fields) > 13 and fields[13] else None
        eps = float(fields[11]) if len(fields) > 11 and fields[11] else None

        result = {
            'symbol': symbol,
            'name': name_cn or symbol,
            'market': '美股',
            'updated_at': timestamp or datetime.now().isoformat(),
            'price': {
                'current': current,
                'open': open_price,
                'prev_close': round(prev_close, 2),
                'high': high,
                'low': low,
                'change': change,
                'change_pct': change_pct_str if '%' in str(change_pct_str) else f'{change_pct_str}%',
            },
            'volume': volume,
            '_source': 'sina_finance',
        }

        if high_52w and low_52w:
            result['range_52w'] = {'high': high_52w, 'low': low_52w}
        if pe:
            result['pe_ratio'] = round(pe, 2)
        if market_cap:
            result['market_cap'] = market_cap
        if eps:
            result['eps'] = eps

        return result
    except Exception as e:
        print(f'[WARN] US stock fetch failed: {e}', file=sys.stderr)
        return None


def fetch_stock(symbol: str) -> dict:
    """根据代码格式自动选择数据源"""
    symbol = symbol.strip().upper()

    if symbol.endswith('.SS') or symbol.endswith('.SZ'):
        # A 股：优先东方财富（数据更全），回退新浪
        result = fetch_a_share_eastmoney(symbol)
        if not result:
            result = fetch_a_share_sina(symbol)
    elif symbol.endswith('.HK'):
        result = fetch_hk_stock(symbol)
    elif re.match(r'^[A-Z]+$', symbol):
        result = fetch_us_stock(symbol)
    else:
        result = None

    if result:
        return result

    return {
        'symbol': symbol,
        'error': f'无法获取 {symbol} 的行情数据',
        'updated_at': datetime.now().isoformat(),
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': '请提供股票代码，例如: python3 fetch_stock.py 002594.SZ'}))
        sys.exit(1)

    symbols = sys.argv[1:]

    if len(symbols) == 1:
        result = fetch_stock(symbols[0])
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        results = [fetch_stock(s) for s in symbols]
        print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
