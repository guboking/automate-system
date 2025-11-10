#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
分析报告内容，提取选股逻辑、板块、股票信息并评分
"""

import json
import re
from collections import defaultdict, Counter
from datetime import datetime

class ReportAnalyzer:
    def __init__(self, reports_file):
        with open(reports_file, 'r', encoding='utf-8') as f:
            self.reports = json.load(f)

        # 定义板块关键词
        self.sectors = {
            "医药": ["医药", "生物", "CXO", "创新药", "药明", "凯莱英", "康龙", "泰格"],
            "新能源": ["新能源", "光伏", "锂电", "储能", "电池", "宁德", "比亚迪", "阳光电源", "变压器", "特高压"],
            "消费": ["消费", "零售", "即时零售", "美团", "饿了么", "电商", "食品饮料"],
            "科技": ["科技", "半导体", "芯片", "AI", "人工智能", "云计算", "软件"],
            "金融": ["金融", "银行", "保险", "证券", "券商"],
            "地产": ["地产", "房地产", "建筑"],
            "周期": ["周期", "钢铁", "煤炭", "化工", "有色"],
            "军工": ["军工", "国防"],
            "汽车": ["汽车", "新能源车", "智能驾驶"],
            "TMT": ["TMT", "传媒", "互联网", "游戏"],
        }

        # 积极/消极情感词
        self.positive_words = [
            "看好", "推荐", "买入", "增持", "超配", "配置", "机会", "上涨", "强势",
            "突破", "反弹", "底部", "低估", "优质", "龙头", "核心", "重点", "持续",
            "受益", "景气", "高增长", "确定性", "可期", "积极", "超预期"
        ]

        self.negative_words = [
            "回调", "下跌", "风险", "谨慎", "减持", "卖出", "弱势", "压力",
            "高估", "泡沫", "恐慌", "警惕", "避免", "下行", "疲软"
        ]

        # 存储分析结果
        self.sector_mentions = defaultdict(lambda: {"count": 0, "reports": [], "sentiment": 0})
        self.stock_mentions = defaultdict(lambda: {"count": 0, "reports": [], "sentiment": 0, "codes": set()})
        self.investment_logic = defaultdict(list)

    def extract_stock_codes(self, text):
        """提取股票代码（6位数字）"""
        # 匹配6位数字的股票代码
        pattern = r'\b[0-9]{6}\b'
        codes = re.findall(pattern, text)
        return codes

    def extract_stock_names(self, text):
        """提取可能的股票名称"""
        # 简单的股票名称匹配（中文2-6字 + 可选的后缀）
        pattern = r'([\u4e00-\u9fa5]{2,6}(?:股份|科技|集团|电气|能源|医药|生物|制药)?)'
        names = re.findall(pattern, text)
        return names

    def analyze_sentiment(self, text):
        """分析情感倾向"""
        pos_count = sum(1 for word in self.positive_words if word in text)
        neg_count = sum(1 for word in self.negative_words if word in text)

        # 返回情感分数 (-1 到 1)
        total = pos_count + neg_count
        if total == 0:
            return 0
        return (pos_count - neg_count) / total

    def extract_investment_logic(self, text, filename):
        """提取投资逻辑"""
        logics = []

        # 查找包含关键逻辑词的句子
        logic_keywords = [
            "逻辑", "原因", "因为", "由于", "驱动", "催化剂", "支撑",
            "基本面", "估值", "业绩", "增长", "盈利", "政策", "预期"
        ]

        sentences = re.split(r'[。！？\n]', text)
        for sentence in sentences:
            for keyword in logic_keywords:
                if keyword in sentence and len(sentence) > 10:
                    logics.append(sentence.strip())
                    break

        return logics[:5]  # 只返回前5条

    def analyze_all_reports(self):
        """分析所有报告"""
        for filename, data in self.reports.items():
            content = data['content']

            # 分析板块
            for sector, keywords in self.sectors.items():
                for keyword in keywords:
                    if keyword in content:
                        self.sector_mentions[sector]["count"] += content.count(keyword)
                        self.sector_mentions[sector]["reports"].append(filename)
                        self.sector_mentions[sector]["sentiment"] += self.analyze_sentiment(content)
                        break

            # 提取股票代码
            codes = self.extract_stock_codes(content)
            for code in codes:
                self.stock_mentions[code]["count"] += 1
                self.stock_mentions[code]["reports"].append(filename)
                self.stock_mentions[code]["codes"].add(code)

                # 获取代码周围的文本进行情感分析
                pattern = f'.{{0,100}}{code}.{{0,100}}'
                matches = re.findall(pattern, content)
                if matches:
                    self.stock_mentions[code]["sentiment"] += self.analyze_sentiment(matches[0])

            # 提取投资逻辑
            logics = self.extract_investment_logic(content, filename)
            self.investment_logic[filename].extend(logics)

    def calculate_scores(self):
        """计算评分（100分制）"""
        scores = {}

        # 板块评分
        max_sector_count = max([v["count"] for v in self.sector_mentions.values()]) if self.sector_mentions else 1

        for sector, data in self.sector_mentions.items():
            # 基础分：提及频率（40分）
            frequency_score = (data["count"] / max_sector_count) * 40

            # 报告覆盖度（30分）
            coverage_score = (len(set(data["reports"])) / len(self.reports)) * 30

            # 情感分数（30分）
            sentiment_score = ((data["sentiment"] / len(data["reports"]) + 1) / 2) * 30 if data["reports"] else 0

            total_score = frequency_score + coverage_score + sentiment_score

            scores[sector] = {
                "score": round(total_score, 2),
                "frequency": data["count"],
                "coverage": len(set(data["reports"])),
                "sentiment": round(data["sentiment"] / len(data["reports"]), 2) if data["reports"] else 0,
                "details": {
                    "frequency_score": round(frequency_score, 2),
                    "coverage_score": round(coverage_score, 2),
                    "sentiment_score": round(sentiment_score, 2)
                }
            }

        # 股票评分
        max_stock_count = max([v["count"] for v in self.stock_mentions.values()]) if self.stock_mentions else 1

        stock_scores = {}
        for stock, data in self.stock_mentions.items():
            if data["count"] >= 2:  # 至少提及2次才评分
                frequency_score = (data["count"] / max_stock_count) * 40
                coverage_score = (len(set(data["reports"])) / len(self.reports)) * 30
                sentiment_score = ((data["sentiment"] / data["count"] + 1) / 2) * 30

                total_score = frequency_score + coverage_score + sentiment_score

                stock_scores[stock] = {
                    "score": round(total_score, 2),
                    "frequency": data["count"],
                    "coverage": len(set(data["reports"])),
                    "sentiment": round(data["sentiment"] / data["count"], 2) if data["count"] > 0 else 0
                }

        return scores, stock_scores

    def generate_report(self):
        """生成分析报告"""
        self.analyze_all_reports()
        sector_scores, stock_scores = self.calculate_scores()

        # 排序
        sorted_sectors = sorted(sector_scores.items(), key=lambda x: x[1]["score"], reverse=True)
        sorted_stocks = sorted(stock_scores.items(), key=lambda x: x[1]["score"], reverse=True)

        report = {
            "metadata": {
                "analysis_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "total_reports": len(self.reports),
                "total_sectors": len(sorted_sectors),
                "total_stocks": len(sorted_stocks)
            },
            "sector_analysis": {
                "rankings": [
                    {
                        "rank": i+1,
                        "sector": sector,
                        "score": data["score"],
                        "frequency": data["frequency"],
                        "coverage": data["coverage"],
                        "sentiment": data["sentiment"],
                        "scoring_details": data["details"]
                    }
                    for i, (sector, data) in enumerate(sorted_sectors)
                ],
                "summary": self._generate_sector_summary(sorted_sectors)
            },
            "stock_analysis": {
                "rankings": [
                    {
                        "rank": i+1,
                        "stock_code": stock,
                        "score": data["score"],
                        "frequency": data["frequency"],
                        "coverage": data["coverage"],
                        "sentiment": data["sentiment"]
                    }
                    for i, (stock, data) in enumerate(sorted_stocks[:30])  # Top 30
                ]
            },
            "investment_logic": self._extract_key_logic(),
            "cross_validation": self._cross_validate_views(sorted_sectors)
        }

        return report

    def _generate_sector_summary(self, sorted_sectors):
        """生成板块总结"""
        if not sorted_sectors:
            return "无板块数据"

        top3 = sorted_sectors[:3]
        summary = f"最受关注的三大板块：{', '.join([s[0] for s in top3])}。"

        high_sentiment = [s[0] for s in sorted_sectors if s[1]["sentiment"] > 0.3]
        if high_sentiment:
            summary += f" 市场情绪最积极的板块：{', '.join(high_sentiment[:3])}。"

        return summary

    def _extract_key_logic(self):
        """提取核心投资逻辑"""
        all_logics = []
        for filename, logics in self.investment_logic.items():
            all_logics.extend(logics)

        # 统计高频逻辑
        logic_counter = Counter(all_logics)
        top_logics = logic_counter.most_common(10)

        return {
            "top_investment_logics": [
                {"logic": logic, "frequency": freq}
                for logic, freq in top_logics
            ]
        }

    def _cross_validate_views(self, sorted_sectors):
        """交叉验证观点"""
        validation = {}

        for sector, data in sorted_sectors[:5]:  # Top 5 sectors
            reports_mentioning = set(self.sector_mentions[sector]["reports"])
            consensus = len(reports_mentioning) / len(self.reports) * 100

            validation[sector] = {
                "consensus_rate": round(consensus, 2),
                "reports_count": len(reports_mentioning),
                "confidence_level": "高" if consensus > 50 else "中" if consensus > 30 else "低"
            }

        return validation


def main():
    print("开始分析报告...")

    analyzer = ReportAnalyzer("/home/user/automate-system/extracted_reports.json")
    report = analyzer.generate_report()

    # 保存分析结果
    output_file = "/home/user/automate-system/analysis_result.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"\n✓ 分析完成！结果已保存到: {output_file}")

    # 打印摘要
    print("\n" + "="*80)
    print("分析摘要")
    print("="*80)
    print(f"\n共分析 {report['metadata']['total_reports']} 份报告")
    print(f"识别 {report['metadata']['total_sectors']} 个板块")
    print(f"识别 {report['metadata']['total_stocks']} 只股票\n")

    print("\n【板块评分 TOP 10】")
    print(f"{'排名':<6} {'板块':<12} {'评分':<8} {'提及次数':<10} {'报告覆盖':<10} {'情感分数':<10}")
    print("-" * 80)
    for item in report['sector_analysis']['rankings'][:10]:
        print(f"{item['rank']:<6} {item['sector']:<12} {item['score']:<8} "
              f"{item['frequency']:<10} {item['coverage']:<10} {item['sentiment']:<10}")

    print("\n\n【股票评分 TOP 20】")
    print(f"{'排名':<6} {'股票代码':<12} {'评分':<8} {'提及次数':<10} {'报告覆盖':<10} {'情感分数':<10}")
    print("-" * 80)
    for item in report['stock_analysis']['rankings'][:20]:
        print(f"{item['rank']:<6} {item['stock_code']:<12} {item['score']:<8} "
              f"{item['frequency']:<10} {item['coverage']:<10} {item['sentiment']:<10}")

    print("\n\n【观点一致性分析】")
    print(f"{'板块':<12} {'共识度%':<12} {'提及报告数':<15} {'可信度':<10}")
    print("-" * 80)
    for sector, data in report['cross_validation'].items():
        print(f"{sector:<12} {data['consensus_rate']:<12} "
              f"{data['reports_count']:<15} {data['confidence_level']:<10}")

    print("\n" + "="*80)

if __name__ == "__main__":
    main()
