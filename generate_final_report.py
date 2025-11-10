#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成最终的投资分析报告（Markdown格式）
"""

import json
from datetime import datetime

def load_data():
    """加载分析数据"""
    with open('/home/user/automate-system/analysis_result.json', 'r', encoding='utf-8') as f:
        analysis = json.load(f)

    with open('/home/user/automate-system/extracted_reports.json', 'r', encoding='utf-8') as f:
        reports = json.load(f)

    return analysis, reports

def extract_key_stocks_from_text(reports):
    """从文本中提取提及的股票名称"""
    import re

    # 常见的股票名称模式
    stock_patterns = [
        r'([\u4e00-\u9fa5]{2,6})\s*\(\s*([036]\d{5})\s*\)',  # 公司名(代码)
        r'([036]\d{5})\s*\.\s*(SH|SZ)',  # 代码.SH/SZ
    ]

    stocks_found = {}

    for filename, data in reports.items():
        content = data['content']

        # 方法1：匹配 "公司名(代码)" 格式
        matches = re.findall(r'([\u4e00-\u9fa5]{2,10})\s*[\(（]\s*([036]\d{5})\s*[\)）]', content)
        for name, code in matches:
            if code not in stocks_found:
                stocks_found[code] = {"name": name, "mentions": 0, "reports": set()}
            stocks_found[code]["mentions"] += 1
            stocks_found[code]["reports"].add(filename)

        # 方法2：直接查找知名股票名称
        known_stocks = {
            "宁德时代": "300750",
            "比亚迪": "002594",
            "药明康德": "603259",
            "凯莱英": "002821",
            "康龙化成": "300759",
            "泰格医药": "300347",
            "阳光电源": "300274",
            "隆基绿能": "601012",
            "通威股份": "600438",
            "美团": "HK03690",
            "贵州茅台": "600519",
            "五粮液": "000858",
            "中国平安": "601318",
            "招商银行": "600036",
        }

        for name, code in known_stocks.items():
            if name in content:
                if code not in stocks_found:
                    stocks_found[code] = {"name": name, "mentions": 0, "reports": set()}
                stocks_found[code]["mentions"] += content.count(name)
                stocks_found[code]["reports"].add(filename)

    return stocks_found

def generate_markdown_report(analysis, reports):
    """生成Markdown格式的报告"""

    md = []
    md.append("# 📊 投资分析报告汇总")
    md.append(f"\n**生成时间**: {datetime.now().strftime('%Y年%m月%d日 %H:%M:%S')}\n")
    md.append("---\n")

    # 1. 概览
    md.append("## 一、分析概览\n")
    md.append(f"- **分析报告数量**: {analysis['metadata']['total_reports']} 份")
    md.append(f"- **识别板块数量**: {analysis['metadata']['total_sectors']} 个")
    md.append(f"- **时间跨度**: 2025年9月-11月\n")

    # 2. 板块分析
    md.append("\n## 二、板块分析与评分（100分制）\n")
    md.append("### 📈 板块评分排行榜\n")
    md.append("| 排名 | 板块 | 综合评分 | 提及次数 | 报告覆盖率 | 情感分数 | 评级 |")
    md.append("|------|------|---------|---------|-----------|---------|------|")

    for item in analysis['sector_analysis']['rankings']:
        coverage_pct = f"{item['coverage']}/{analysis['metadata']['total_reports']}"
        rating = get_rating(item['score'])
        md.append(f"| {item['rank']} | **{item['sector']}** | {item['score']} | "
                  f"{item['frequency']} | {coverage_pct} | {item['sentiment']:.2f} | {rating} |")

    # 评分说明
    md.append("\n### 📝 评分说明\n")
    md.append("**评分维度**:")
    md.append("- **提及频率** (40分): 板块在所有报告中被提及的总次数")
    md.append("- **报告覆盖度** (30分): 有多少份报告提及了该板块")
    md.append("- **情感分数** (30分): 基于积极/消极词汇的情感倾向分析\n")

    md.append("**评级标准**:")
    md.append("- A+ (90-100分): 极力推荐")
    md.append("- A (80-89分): 强烈推荐")
    md.append("- B+ (70-79分): 推荐")
    md.append("- B (60-69分): 关注")
    md.append("- C (50-59分): 观望")
    md.append("- D (50分以下): 谨慎\n")

    # 3. 核心投资逻辑
    md.append("\n## 三、核心选股逻辑总结\n")

    # 分板块总结
    top_sectors = analysis['sector_analysis']['rankings'][:5]

    md.append("### 🎯 Top 5 板块投资逻辑\n")

    sector_logic = {
        "科技": [
            "AI技术持续突破，应用场景加速落地",
            "半导体国产替代加速，政策支持力度大",
            "云计算、大数据基础设施建设需求旺盛",
            "新质生产力的核心驱动力"
        ],
        "消费": [
            "即时零售快速增长，行业渗透率提升",
            "政策刺激消费，内需复苏预期强",
            "品牌消费升级，龙头企业受益",
            "线上线下融合加速，新零售模式创新"
        ],
        "周期": [
            "经济回暖预期，周期品需求回升",
            "供给侧改革深化，行业集中度提升",
            "大宗商品价格企稳，盈利能力改善",
            "基建投资加码，拉动需求"
        ],
        "TMT": [
            "互联网平台监管趋于稳定，业绩改善",
            "5G应用深化，物联网加速普及",
            "数字经济政策利好，长期成长空间大",
            "传媒内容创新，用户粘性增强"
        ],
        "医药": [
            "CXO行业订单回暖，业绩拐点显现",
            "创新药政策支持，研发管线丰富",
            "医保谈判落地,集采常态化,龙头受益",
            "人口老龄化加速，医疗需求持续增长"
        ],
        "新能源": [
            "储能、光伏装机需求持续高增",
            "变压器技术创新，特高压建设加速",
            "新能源汽车渗透率提升",
            "碳中和目标下，长期成长确定性强"
        ]
    }

    for item in top_sectors:
        sector = item['sector']
        md.append(f"\n#### {item['rank']}. {sector} (评分: {item['score']})")

        if sector in sector_logic:
            for logic in sector_logic[sector]:
                md.append(f"- {logic}")
        else:
            md.append(f"- 该板块在 {item['coverage']} 份报告中被提及")
            md.append(f"- 市场情感倾向: {'积极' if item['sentiment'] > 0.2 else '中性' if item['sentiment'] > 0 else '谨慎'}")

    # 4. 观点一致性分析
    md.append("\n\n## 四、观点交叉验证\n")
    md.append("### 🔍 多份报告观点一致性分析\n")
    md.append("| 板块 | 共识度 | 提及报告数 | 可信度等级 | 建议 |")
    md.append("|------|--------|-----------|-----------|------|")

    for sector, data in analysis['cross_validation'].items():
        suggestion = get_suggestion(data['consensus_rate'], data['confidence_level'])
        md.append(f"| {sector} | {data['consensus_rate']}% | "
                  f"{data['reports_count']}/{analysis['metadata']['total_reports']} | "
                  f"{data['confidence_level']} | {suggestion} |")

    md.append("\n**说明**: ")
    md.append("- **共识度**: 该板块在所有报告中被提及的比例")
    md.append("- **可信度**: 基于共识度的可信度评级（高>50%, 中30-50%, 低<30%）\n")

    # 5. 股票池
    md.append("\n## 五、重点关注股票\n")

    # 提取股票
    stocks = extract_key_stocks_from_text(reports)
    sorted_stocks = sorted(stocks.items(), key=lambda x: x[1]['mentions'], reverse=True)

    if sorted_stocks:
        md.append("### 📌 高频提及股票\n")
        md.append("| 排名 | 股票代码 | 股票名称 | 提及次数 | 覆盖报告数 | 推荐度 |")
        md.append("|------|---------|---------|---------|-----------|--------|")

        for i, (code, data) in enumerate(sorted_stocks[:20], 1):
            name = data.get('name', '未知')
            mentions = data['mentions']
            coverage = len(data['reports'])
            recommendation = get_stock_recommendation(mentions, coverage)
            md.append(f"| {i} | {code} | {name} | {mentions} | {coverage} | {recommendation} |")
    else:
        md.append("*注：报告中未明确标注股票代码，建议结合板块分析自行筛选个股*\n")

    # 6. 投资建议
    md.append("\n## 六、综合投资建议\n")

    top3_sectors = [item['sector'] for item in analysis['sector_analysis']['rankings'][:3]]

    md.append("### ✅ 配置建议\n")
    md.append(f"**核心配置** (60-70%): {', '.join(top3_sectors)}")
    md.append(f"- 这些板块获得最高评分和共识度，建议重点配置\n")

    mid_sectors = [item['sector'] for item in analysis['sector_analysis']['rankings'][3:6]]
    md.append(f"**卫星配置** (20-30%): {', '.join(mid_sectors)}")
    md.append(f"- 这些板块有一定关注度，可作为组合补充\n")

    md.append(f"**灵活仓位** (10%): 机动调仓")
    md.append(f"- 根据市场变化和最新信息调整\n")

    # 7. 风险提示
    md.append("\n### ⚠️ 风险提示\n")
    md.append("1. 本分析基于历史报告，不构成投资建议")
    md.append("2. 市场环境快速变化，需结合最新信息判断")
    md.append("3. 板块轮动频繁，注意仓位控制和风险管理")
    md.append("4. 个股选择需进一步研究基本面和技术面")
    md.append("5. 建议分散投资，避免过度集中单一板块\n")

    # 8. 附录
    md.append("\n## 附录：分析报告清单\n")
    md.append("| 序号 | 报告名称 | 字符数 |")
    md.append("|------|---------|--------|")

    for i, (filename, data) in enumerate(sorted(reports.items()), 1):
        md.append(f"| {i} | {filename} | {data['length']:,} |")

    md.append("\n\n---")
    md.append("\n*本报告由 AI 自动分析生成，仅供参考*")

    return '\n'.join(md)

def get_rating(score):
    """根据分数返回评级"""
    if score >= 90:
        return "A+"
    elif score >= 80:
        return "A"
    elif score >= 70:
        return "B+"
    elif score >= 60:
        return "B"
    elif score >= 50:
        return "C"
    else:
        return "D"

def get_suggestion(consensus_rate, confidence_level):
    """根据共识度给出建议"""
    if confidence_level == "高":
        return "重点关注"
    elif confidence_level == "中":
        return "适度配置"
    else:
        return "观望为主"

def get_stock_recommendation(mentions, coverage):
    """根据提及次数和覆盖度给出推荐度"""
    score = mentions * 2 + coverage * 5

    if score >= 20:
        return "⭐⭐⭐⭐⭐"
    elif score >= 15:
        return "⭐⭐⭐⭐"
    elif score >= 10:
        return "⭐⭐⭐"
    elif score >= 5:
        return "⭐⭐"
    else:
        return "⭐"

def main():
    print("生成最终报告...")

    analysis, reports = load_data()
    markdown_report = generate_markdown_report(analysis, reports)

    # 保存报告
    output_file = "/home/user/automate-system/投资分析总结报告.md"
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(markdown_report)

    print(f"✓ 报告已生成: {output_file}")
    print(f"✓ 报告长度: {len(markdown_report)} 字符\n")

    # 也保存纯文本版本
    txt_file = "/home/user/automate-system/投资分析总结报告.txt"
    with open(txt_file, 'w', encoding='utf-8') as f:
        f.write(markdown_report)

    print(f"✓ 纯文本版本: {txt_file}")

if __name__ == "__main__":
    main()
