#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
深度分析科技板块的细分领域
"""

import json
import re
from collections import defaultdict

class TechSubsectorAnalyzer:
    def __init__(self, reports_file):
        with open(reports_file, 'r', encoding='utf-8') as f:
            self.reports = json.load(f)

        # 科技细分板块关键词（更详细）
        self.tech_subsectors = {
            "人工智能/AI": [
                "人工智能", "AI", "大模型", "ChatGPT", "GPT", "深度学习",
                "机器学习", "算法", "智能算力", "算力", "AI应用", "AIGC",
                "自然语言", "计算机视觉", "语音识别", "智能化"
            ],
            "半导体/芯片": [
                "半导体", "芯片", "集成电路", "晶圆", "光刻机", "EDA",
                "存储芯片", "功率半导体", "MCU", "GPU", "CPU", "封装测试",
                "国产替代", "芯片设计", "晶圆制造", "ASML", "台积电"
            ],
            "云计算": [
                "云计算", "云服务", "云基础设施", "数据中心", "服务器",
                "IDC", "算力中心", "边缘计算", "混合云", "私有云", "公有云",
                "云原生", "SaaS", "PaaS", "IaaS"
            ],
            "软件": [
                "软件", "操作系统", "数据库", "中间件", "工业软件",
                "办公软件", "ERP", "CRM", "CAD", "CAE", "PLM",
                "信创", "国产软件", "金蝶", "用友", "鸿蒙"
            ],
            "网络安全": [
                "网络安全", "信息安全", "数据安全", "网络安全", "防火墙",
                "态势感知", "安全防护", "网安", "等保", "密码"
            ],
            "5G/通信": [
                "5G", "6G", "通信", "基站", "光通信", "光模块", "光纤",
                "通信设备", "天线", "射频", "物联网", "IoT", "蜂窝"
            ],
            "大数据": [
                "大数据", "数据分析", "数据治理", "数据中台",
                "商业智能", "BI", "数据挖掘", "数据可视化"
            ],
            "工业互联网": [
                "工业互联网", "工业4.0", "智能制造", "数字孪生",
                "MES", "智能工厂", "柔性制造", "工业物联网"
            ],
            "信创/国产化": [
                "信创", "国产化", "自主可控", "去IOE", "国产替代",
                "操作系统国产化", "芯片国产化", "软件国产化"
            ],
            "卫星互联网": [
                "卫星互联网", "低轨卫星", "星链", "卫星通信",
                "北斗", "导航", "遥感卫星"
            ],
            "消费电子": [
                "消费电子", "智能手机", "可穿戴", "TWS", "VR", "AR",
                "元宇宙", "智能音箱", "平板电脑", "智能家居"
            ],
            "量子计算": [
                "量子计算", "量子通信", "量子科技", "量子芯片"
            ]
        }

        # 知名科技公司/股票
        self.tech_companies = {
            # AI
            "科大讯飞": "002230",
            "寒武纪": "688256",
            "海光信息": "688041",
            "拓尔思": "300229",

            # 半导体
            "中芯国际": "688981",
            "北方华创": "002371",
            "华虹公司": "688347",
            "韦尔股份": "603501",
            "兆易创新": "603986",
            "卓胜微": "300782",
            "三安光电": "600703",
            "长电科技": "600584",
            "紫光国微": "002049",

            # 云计算/服务器
            "浪潮信息": "000977",
            "紫光股份": "000938",
            "中科曙光": "603019",
            "宝信软件": "600845",

            # 软件
            "用友网络": "600588",
            "金蝶国际": "HK00268",
            "广联达": "002410",
            "恒生电子": "600570",
            "中望软件": "688083",

            # 5G/通信
            "中兴通讯": "000063",
            "烽火通信": "600498",
            "中际旭创": "300308",
            "新易盛": "300502",
            "天孚通信": "300394",

            # 网络安全
            "深信服": "300454",
            "启明星辰": "002439",
            "奇安信": "688561",
            "安恒信息": "688023",

            # 消费电子
            "立讯精密": "002475",
            "歌尔股份": "002241",
            "京东方A": "000725",
            "TCL科技": "000100",
        }

        self.subsector_data = defaultdict(lambda: {
            "count": 0,
            "reports": [],
            "context": [],
            "related_stocks": set(),
            "keywords_matched": set()
        })

    def analyze_sentiment(self, text):
        """分析情感倾向"""
        positive_words = [
            "看好", "推荐", "买入", "增持", "超配", "配置", "机会", "上涨", "强势",
            "突破", "反弹", "底部", "低估", "优质", "龙头", "核心", "重点", "持续",
            "受益", "景气", "高增长", "确定性", "可期", "积极", "超预期", "加速",
            "领先", "创新", "突破"
        ]

        negative_words = [
            "回调", "下跌", "风险", "谨慎", "减持", "卖出", "弱势", "压力",
            "高估", "泡沫", "恐慌", "警惕", "避免", "下行", "疲软", "放缓"
        ]

        pos_count = sum(1 for word in positive_words if word in text)
        neg_count = sum(1 for word in negative_words if word in text)

        total = pos_count + neg_count
        if total == 0:
            return 0
        return (pos_count - neg_count) / total

    def extract_context(self, content, keyword, window=100):
        """提取关键词周围的上下文"""
        pattern = f'.{{0,{window}}}{re.escape(keyword)}.{{0,{window}}}'
        matches = re.findall(pattern, content)
        return matches[:3]  # 最多返回3个上下文

    def analyze_all_reports(self):
        """分析所有报告中的科技细分领域"""
        for filename, data in self.reports.items():
            content = data['content']

            # 遍历每个细分领域
            for subsector, keywords in self.tech_subsectors.items():
                for keyword in keywords:
                    if keyword in content:
                        count = content.count(keyword)
                        self.subsector_data[subsector]["count"] += count
                        self.subsector_data[subsector]["reports"].append(filename)
                        self.subsector_data[subsector]["keywords_matched"].add(keyword)

                        # 提取上下文
                        contexts = self.extract_context(content, keyword)
                        self.subsector_data[subsector]["context"].extend(contexts)

            # 识别提及的科技公司
            for company, code in self.tech_companies.items():
                if company in content or code in content:
                    # 判断这个公司属于哪个细分领域
                    self._assign_company_to_subsector(company, code, content)

    def _assign_company_to_subsector(self, company, code, content):
        """将公司分配到对应的细分领域"""
        # 简单的映射规则
        company_sector_map = {
            # AI
            "科大讯飞": "人工智能/AI", "寒武纪": "人工智能/AI",
            "海光信息": "人工智能/AI", "拓尔思": "人工智能/AI",

            # 半导体
            "中芯国际": "半导体/芯片", "北方华创": "半导体/芯片",
            "华虹公司": "半导体/芯片", "韦尔股份": "半导体/芯片",
            "兆易创新": "半导体/芯片", "卓胜微": "半导体/芯片",
            "三安光电": "半导体/芯片", "长电科技": "半导体/芯片",
            "紫光国微": "半导体/芯片",

            # 云计算
            "浪潮信息": "云计算", "紫光股份": "云计算",
            "中科曙光": "云计算", "宝信软件": "云计算",

            # 软件
            "用友网络": "软件", "金蝶国际": "软件",
            "广联达": "软件", "恒生电子": "软件",
            "中望软件": "软件",

            # 5G/通信
            "中兴通讯": "5G/通信", "烽火通信": "5G/通信",
            "中际旭创": "5G/通信", "新易盛": "5G/通信",
            "天孚通信": "5G/通信",

            # 网络安全
            "深信服": "网络安全", "启明星辰": "网络安全",
            "奇安信": "网络安全", "安恒信息": "网络安全",

            # 消费电子
            "立讯精密": "消费电子", "歌尔股份": "消费电子",
            "京东方A": "消费电子", "TCL科技": "消费电子",
        }

        if company in company_sector_map:
            subsector = company_sector_map[company]
            self.subsector_data[subsector]["related_stocks"].add(f"{company}({code})")

    def calculate_scores(self):
        """计算各细分领域的评分"""
        scores = {}

        max_count = max([v["count"] for v in self.subsector_data.values()]) if self.subsector_data else 1
        total_reports = len(self.reports)

        for subsector, data in self.subsector_data.items():
            if data["count"] == 0:
                continue

            # 提及频率得分 (40分)
            frequency_score = (data["count"] / max_count) * 40

            # 报告覆盖度 (30分)
            unique_reports = len(set(data["reports"]))
            coverage_score = (unique_reports / total_reports) * 30

            # 情感分数 (30分)
            total_sentiment = sum([self.analyze_sentiment(ctx) for ctx in data["context"]])
            avg_sentiment = total_sentiment / len(data["context"]) if data["context"] else 0
            sentiment_score = ((avg_sentiment + 1) / 2) * 30

            total_score = frequency_score + coverage_score + sentiment_score

            scores[subsector] = {
                "score": round(total_score, 2),
                "frequency": data["count"],
                "coverage": unique_reports,
                "sentiment": round(avg_sentiment, 2),
                "keywords": list(data["keywords_matched"]),
                "stocks": list(data["related_stocks"]),
                "key_contexts": data["context"][:3]
            }

        return scores

    def generate_report(self):
        """生成报告"""
        self.analyze_all_reports()
        scores = self.calculate_scores()

        # 排序
        sorted_subsectors = sorted(scores.items(), key=lambda x: x[1]["score"], reverse=True)

        return {
            "total_subsectors": len(sorted_subsectors),
            "subsector_rankings": sorted_subsectors,
            "summary": self._generate_summary(sorted_subsectors)
        }

    def _generate_summary(self, sorted_subsectors):
        """生成摘要"""
        if not sorted_subsectors:
            return "未识别到科技细分领域"

        top3 = [s[0] for s in sorted_subsectors[:3]]
        return f"科技板块最热门的三大细分领域：{', '.join(top3)}"


def generate_markdown_report(result):
    """生成 Markdown 报告"""
    md = []

    md.append("# 🔬 科技板块细分领域深度分析\n")
    md.append(f"**分析时间**: {__import__('datetime').datetime.now().strftime('%Y年%m月%d日 %H:%M:%S')}\n")
    md.append("---\n")

    md.append("## 一、概览\n")
    md.append(f"- **识别细分领域数量**: {result['total_subsectors']} 个")
    md.append(f"- **核心发现**: {result['summary']}\n")

    md.append("\n## 二、细分领域评分排行（100分制）\n")
    md.append("| 排名 | 细分领域 | 综合评分 | 提及次数 | 报告覆盖 | 情感分数 | 评级 |")
    md.append("|------|---------|---------|---------|---------|---------|------|")

    for i, (subsector, data) in enumerate(result['subsector_rankings'], 1):
        rating = get_rating(data['score'])
        md.append(f"| {i} | **{subsector}** | {data['score']} | {data['frequency']} | "
                  f"{data['coverage']}/13 | {data['sentiment']:.2f} | {rating} |")

    md.append("\n### 评级说明")
    md.append("- **A+** (90-100分): 极力推荐，行业热点")
    md.append("- **A** (80-89分): 强烈推荐，高景气度")
    md.append("- **B+** (70-79分): 推荐配置")
    md.append("- **B** (60-69分): 值得关注")
    md.append("- **C** (50-59分): 观望")
    md.append("- **D** (50分以下): 谨慎\n")

    md.append("\n## 三、各细分领域详细分析\n")

    for i, (subsector, data) in enumerate(result['subsector_rankings'][:10], 1):  # Top 10
        md.append(f"\n### {i}. {subsector}")
        md.append(f"**综合评分**: {data['score']} | **评级**: {get_rating(data['score'])}\n")

        # 基本指标
        md.append("#### 📊 关键指标")
        md.append(f"- **提及次数**: {data['frequency']} 次")
        md.append(f"- **报告覆盖**: {data['coverage']}/13 份")
        md.append(f"- **市场情绪**: {'积极 📈' if data['sentiment'] > 0.2 else '中性 ➡️' if data['sentiment'] > -0.1 else '谨慎 📉'}")
        md.append(f"- **情感分数**: {data['sentiment']:.2f}\n")

        # 相关股票
        if data['stocks']:
            md.append("#### 🎯 相关标的")
            for stock in data['stocks']:
                md.append(f"- {stock}")
            md.append("")

        # 匹配关键词
        if data['keywords']:
            md.append("#### 🔑 关键词")
            keywords_str = "、".join(list(data['keywords'])[:10])
            md.append(f"{keywords_str}\n")

        # 核心观点
        if data['key_contexts']:
            md.append("#### 💡 核心观点摘录")
            for j, ctx in enumerate(data['key_contexts'][:2], 1):
                cleaned_ctx = ctx.strip()[:150]  # 限制长度
                if cleaned_ctx:
                    md.append(f"{j}. {cleaned_ctx}...")
            md.append("")

        md.append("---\n")

    md.append("\n## 四、投资建议\n")

    top_tier = [s[0] for s in result['subsector_rankings'] if s[1]['score'] >= 70]
    mid_tier = [s[0] for s in result['subsector_rankings'] if 60 <= s[1]['score'] < 70]

    if top_tier:
        md.append(f"### ✅ 重点配置领域 (评分≥70)")
        for subsector in top_tier:
            md.append(f"- **{subsector}**")
        md.append("")

    if mid_tier:
        md.append(f"### 👀 关注领域 (评分60-70)")
        for subsector in mid_tier:
            md.append(f"- {subsector}")
        md.append("")

    md.append("\n### 📈 配置建议")
    md.append("- **核心持仓**: 选择评分最高的2-3个细分领域")
    md.append("- **卫星配置**: 适当布局1-2个中等评分领域")
    md.append("- **分散风险**: 避免过度集中单一细分领域")
    md.append("- **动态调整**: 关注政策变化和技术突破\n")

    md.append("\n---\n")
    md.append("*本报告基于AI分析生成，仅供参考*")

    return '\n'.join(md)


def get_rating(score):
    """评级"""
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


def main():
    print("开始分析科技板块细分领域...\n")

    analyzer = TechSubsectorAnalyzer("/home/user/automate-system/extracted_reports.json")
    result = analyzer.generate_report()

    # 生成 Markdown 报告
    markdown = generate_markdown_report(result)

    # 保存报告
    output_file = "/home/user/automate-system/科技板块细分分析.md"
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(markdown)

    # 保存 JSON
    json_file = "/home/user/automate-system/tech_subsector_analysis.json"
    with open(json_file, 'w', encoding='utf-8') as f:
        # 转换为可序列化的格式
        serializable_result = {
            "total_subsectors": result['total_subsectors'],
            "summary": result['summary'],
            "subsector_rankings": [
                {
                    "subsector": subsector,
                    "data": {
                        "score": data['score'],
                        "frequency": data['frequency'],
                        "coverage": data['coverage'],
                        "sentiment": data['sentiment'],
                        "keywords": data['keywords'],
                        "stocks": data['stocks']
                    }
                }
                for subsector, data in result['subsector_rankings']
            ]
        }
        json.dump(serializable_result, f, ensure_ascii=False, indent=2)

    print(f"✓ Markdown报告已保存: {output_file}")
    print(f"✓ JSON数据已保存: {json_file}\n")

    # 打印摘要
    print("="*80)
    print("科技板块细分领域 TOP 10")
    print("="*80)
    print(f"{'排名':<6} {'细分领域':<20} {'评分':<8} {'提及次数':<10} {'覆盖率':<10} {'情感':<8}")
    print("-"*80)

    for i, (subsector, data) in enumerate(result['subsector_rankings'][:10], 1):
        print(f"{i:<6} {subsector:<20} {data['score']:<8} {data['frequency']:<10} "
              f"{data['coverage']}/13      {data['sentiment']:<8.2f}")

    print("="*80)

if __name__ == "__main__":
    main()
