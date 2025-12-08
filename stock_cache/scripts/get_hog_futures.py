#!/usr/bin/env python3
"""
生猪期货数据获取脚本
使用东方财富/新浪接口获取LH合约行情
"""

import requests
import json
import re
from datetime import datetime

def get_from_eastmoney():
    """从东方财富获取生猪期货数据"""
    print("=" * 70)
    print("尝试东方财富接口...")
    print("=" * 70)

    # 生猪合约列表
    contracts = ['lh2501', 'lh2503', 'lh2505', 'lh2507', 'lh2509', 'lh2511', 'lhm']

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://quote.eastmoney.com/"
    }

    results = []
    for contract in contracts:
        url = f"https://push2.eastmoney.com/api/qt/stock/get?secid=114.{contract}&fields=f43,f44,f45,f46,f47,f48,f50,f57,f58,f60,f116,f117"
        try:
            resp = requests.get(url, headers=headers, timeout=10)
            data = resp.json()
            if data.get('data'):
                d = data['data']
                results.append({
                    'code': d.get('f57', contract),
                    'name': d.get('f58', ''),
                    'price': d.get('f43', 0) / 100 if d.get('f43') else 0,
                    'change': d.get('f60', 0) / 100 if d.get('f60') else 0,
                    'high': d.get('f44', 0) / 100 if d.get('f44') else 0,
                    'low': d.get('f45', 0) / 100 if d.get('f45') else 0,
                    'open': d.get('f46', 0) / 100 if d.get('f46') else 0,
                    'volume': d.get('f47', 0),
                    'amount': d.get('f48', 0),
                    'position': d.get('f116', 0),
                })
        except Exception as e:
            print(f"获取 {contract} 失败: {e}")

    return results

def get_from_sina():
    """从新浪财经获取生猪期货数据"""
    print("=" * 70)
    print("尝试新浪财经接口...")
    print("=" * 70)

    contracts = ['LH0', 'LH2501', 'LH2503', 'LH2505', 'LH2507', 'LH2509', 'LH2511']
    symbols = ','.join([f'nf_{c}' for c in contracts])

    url = f"https://hq.sinajs.cn/list={symbols}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://finance.sina.com.cn/"
    }

    try:
        resp = requests.get(url, headers=headers, timeout=10)
        resp.encoding = 'gbk'

        results = []
        lines = resp.text.strip().split('\n')
        for line in lines:
            if '=' not in line:
                continue

            match = re.search(r'hq_str_nf_(\w+)="([^"]*)"', line)
            if match:
                code = match.group(1)
                data = match.group(2).split(',')

                if len(data) >= 15:
                    results.append({
                        'code': code,
                        'name': data[0] if data[0] else f'生猪{code}',
                        'open': float(data[2]) if data[2] else 0,
                        'high': float(data[3]) if data[3] else 0,
                        'low': float(data[4]) if data[4] else 0,
                        'price': float(data[6]) if data[6] else 0,  # 最新价
                        'settle': float(data[5]) if data[5] else 0,  # 结算价
                        'prev_settle': float(data[7]) if data[7] else 0,  # 昨结算
                        'position': int(float(data[13])) if data[13] else 0,  # 持仓量
                        'volume': int(float(data[14])) if data[14] else 0,  # 成交量
                    })

        return results
    except Exception as e:
        print(f"新浪接口失败: {e}")
        return []

def get_from_dce():
    """尝试从大商所官网获取"""
    print("=" * 70)
    print("尝试大商所官网接口...")
    print("=" * 70)

    url = "http://www.dce.com.cn/publicweb/quotesdata/dayQuotesCh.html"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    }

    try:
        # 获取当日行情
        params = {
            "dayQuotes.variety": "lh",
            "dayQuotes.trade_type": "0"
        }
        resp = requests.post(url, data=params, headers=headers, timeout=10)
        print(f"大商所响应: {resp.status_code}")
        return resp.text[:500]
    except Exception as e:
        print(f"大商所接口失败: {e}")
        return None

def print_results(results, source):
    """打印结果表格"""
    if not results:
        print(f"{source}: 无数据")
        return

    print(f"\n{source} 生猪期货行情 ({datetime.now().strftime('%Y-%m-%d %H:%M')})")
    print("-" * 70)
    print(f"{'合约':<10} {'最新价':<10} {'涨跌':<10} {'开盘':<10} {'最高':<10} {'最低':<10} {'持仓量':<12}")
    print("-" * 70)

    for r in results:
        change_str = f"{r.get('change', 0):+.0f}" if r.get('change') else "-"
        print(f"{r['code']:<10} {r.get('price', 0):<10.0f} {change_str:<10} {r.get('open', 0):<10.0f} {r.get('high', 0):<10.0f} {r.get('low', 0):<10.0f} {r.get('position', 0):<12}")

def save_to_json(results, filename):
    """保存到JSON文件"""
    output = {
        "updated_at": datetime.now().isoformat(),
        "contracts": results
    }
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\n数据已保存到: {filename}")

if __name__ == "__main__":
    print("\n" + "=" * 70)
    print("生猪期货数据获取工具")
    print("=" * 70 + "\n")

    # 尝试新浪接口
    sina_results = get_from_sina()
    if sina_results:
        print_results(sina_results, "新浪财经")
        save_to_json(sina_results, "../data/LH_realtime.json")

    # 尝试东方财富接口
    em_results = get_from_eastmoney()
    if em_results:
        print_results(em_results, "东方财富")

    if not sina_results and not em_results:
        print("\n所有接口均获取失败，请检查网络或稍后重试")
        print("也可以尝试:")
        print("1. 访问 https://quote.eastmoney.com/qihuo/lhm.html")
        print("2. 访问 https://finance.sina.com.cn/futures/quotes/LH2507.shtml")
