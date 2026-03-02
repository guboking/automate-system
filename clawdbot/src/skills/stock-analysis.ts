// 股票分析技能 - 支持 Apify 实时数据抓取

import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseSkill } from './base.js';
import { ApifyClient } from '../services/apify.js';
import type { SkillManifest, SkillResult, ConversationContext, Permission } from '../types/index.js';

interface StockData {
  symbol: string;
  name: string;
  market: string;
  updated_at: string;
  price?: {
    current: number;
    prev_close: number;
    change_pct: string;
    range_day?: [number, number];
    range_52w?: [number, number];
    volume?: string;
    turnover?: string;
  };
  fundamentals?: {
    revenue_ytd?: string;
    revenue_growth?: string;
    net_profit_ytd?: string;
    profit_growth?: string;
    gross_margin?: string;
    pe_ratio?: number | null;
    pb_ratio?: number | null;
  };
  analyst?: {
    target_price_avg?: number;
    target_price_high?: number;
    target_price_low?: number;
    buy_ratings?: number;
    hold_ratings?: number;
    sell_ratings?: number;
    upside?: string;
  };
  capital_flow?: {
    main_net?: string;
    retail_net?: string;
    north_net?: string | null;
  };
  news?: { title: string; url: string; date: string }[];
  [key: string]: unknown;
}

// 常见股票名称映射
const STOCK_NAME_MAP: Record<string, string> = {
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
};

export class StockAnalysisSkill extends BaseSkill {
  manifest: SkillManifest = {
    name: 'stock-analysis',
    version: '2.0.0',
    description: '股票分析技能 - 支持 A 股、港股、美股的行情分析，集成 Apify 实时数据',
    author: 'Clawdbot',
    triggers: {
      patterns: [
        '分析\\s*(.+?)\\s*(?:股票)?$',
        '看看\\s*(.+)',
        '(.+?)\\s*怎么样',
        '刷新\\s*(.+?)\\s*数据',
        '更新\\s*(.+?)\\s*数据',
        '/stock\\s+(.+)',
      ],
      intents: ['stock_analysis'],
      commands: ['/stock', '/analyze'],
    },
    permissions: [
      'file:read' as Permission,
      'file:write' as Permission,
      'network:http' as Permission,
    ],
    limits: {
      timeout: 120000,
      memory: 512,
      fileAccess: ['./stock_cache/*'],
      networkAccess: ['*'],
    },
  };

  private cacheDir = './stock_cache/data';
  private apify!: ApifyClient;

  async onLoad(): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true });
    this.apify = new ApifyClient();
  }

  async execute(
    params: Record<string, unknown>,
    _context: ConversationContext
  ): Promise<SkillResult> {
    const text = params.text as string || '';
    const matches = params.matches as string[] || [];

    // 提取股票标识
    const stockInput = matches[0] || this.extractStockName(text);
    if (!stockInput) {
      return {
        success: false,
        error: '无法识别股票名称',
        response: { text: '请提供股票名称或代码，例如: 分析比亚迪' },
      };
    }

    const symbol = this.normalizeSymbol(stockInput.trim());
    const forceRefresh = text.includes('刷新') || text.includes('更新');

    try {
      // 检查缓存
      let stockData = await this.loadCache(symbol);

      if (!stockData || forceRefresh || this.isExpired(stockData)) {
        // 使用 LLM 生成模拟数据（实际应从 API 获取）
        stockData = await this.fetchStockData(symbol);
        await this.saveCache(symbol, stockData);
      }

      // 生成分析报告
      const report = await this.generateReport(stockData);

      return {
        success: true,
        data: stockData,
        response: { text: report },
        followUp: {
          suggestions: [
            `刷新 ${stockData.name} 数据`,
            `${stockData.name} 的技术分析`,
          ],
        },
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        response: { text: `分析 ${symbol} 时出错: ${(error as Error).message}` },
      };
    }
  }

  private extractStockName(text: string): string | null {
    // 尝试从各种模式中提取
    const patterns = [
      /分析\s*(.+?)\s*(?:股票)?$/,
      /看看\s*(.+)/,
      /(.+?)\s*怎么样/,
      /\/stock\s+(.+)/,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    return null;
  }

  private normalizeSymbol(input: string): string {
    // 检查名称映射
    if (STOCK_NAME_MAP[input]) {
      return STOCK_NAME_MAP[input];
    }

    // 纯数字：根据前缀判断市场
    if (/^\d{6}$/.test(input)) {
      if (input.startsWith('6') || input.startsWith('68')) {
        return `${input}.SS`;
      }
      return `${input}.SZ`;
    }

    // 港股
    if (/^\d{4,5}$/.test(input)) {
      return `${input.padStart(5, '0')}.HK`;
    }

    // 美股
    if (/^[A-Z]+$/i.test(input)) {
      return input.toUpperCase();
    }

    return input;
  }

  private async loadCache(symbol: string): Promise<StockData | null> {
    try {
      const filePath = path.join(this.cacheDir, `${symbol}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async saveCache(symbol: string, data: StockData): Promise<void> {
    const filePath = path.join(this.cacheDir, `${symbol}.json`);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  private isExpired(data: StockData): boolean {
    const updatedAt = new Date(data.updated_at).getTime();
    const age = Date.now() - updatedAt;
    return age > 24 * 60 * 60 * 1000; // 24小时
  }

  private async fetchStockData(symbol: string): Promise<StockData> {
    const name = Object.entries(STOCK_NAME_MAP).find(([_, v]) => v === symbol)?.[0] || symbol;

    let market = '未知';
    if (symbol.endsWith('.SS')) market = 'A股沪市';
    else if (symbol.endsWith('.SZ')) market = 'A股深市';
    else if (symbol.endsWith('.HK')) market = '港股';
    else if (/^[A-Z]+$/.test(symbol)) market = '美股';

    // 优先使用 Apify 获取实时数据
    if (this.apify.isConfigured()) {
      try {
        return await this.fetchViaApify(symbol, name, market);
      } catch (error) {
        console.warn(`[StockAnalysis] Apify 抓取失败，回退到 LLM: ${(error as Error).message}`);
      }
    }

    // 回退：使用 LLM 生成分析（标记为非实时数据）
    return this.fetchViaLLM(symbol, name, market);
  }

  // 通过 Apify 获取实时股票数据
  private async fetchViaApify(symbol: string, name: string, market: string): Promise<StockData> {
    // 构建搜索 URL 列表
    const searchUrls = this.buildFinanceUrls(symbol, name);

    // 使用 Cheerio Scraper 抓取财经页面
    const result = await this.apify.runActor({
      actorId: 'apify/cheerio-scraper',
      input: {
        startUrls: searchUrls.map(url => ({ url })),
        maxRequestsPerCrawl: 5,
        pageFunction: `async function pageFunction(context) {
          const { $, request } = context;
          const title = $('title').text();
          const bodyText = $('body').text().replace(/\\s+/g, ' ').substring(0, 5000);
          return { url: request.url, title, content: bodyText };
        }`,
      },
      timeout: 120,
      waitForFinish: 60,
    });

    // 用 Google Search 补充更多信息
    const searchResult = await this.apify.runActor({
      actorId: 'apify/google-search-scraper',
      input: {
        queries: `${name} ${symbol} 股票 最新行情 分析`,
        maxPagesPerQuery: 1,
        resultsPerPage: 10,
        languageCode: market.includes('A股') ? 'zh-CN' : 'en',
      },
      timeout: 60,
      waitForFinish: 30,
    });

    // 合并数据，使用 LLM 提取结构化信息
    const rawData = [
      ...(result.items || []),
      ...(searchResult.items || []),
    ];

    const extractionPrompt = `从以下原始网页数据中，为股票 ${name}（${symbol}）提取结构化信息。

原始数据:
${JSON.stringify(rawData.slice(0, 5), null, 2).substring(0, 4000)}

请严格按照以下 JSON 格式返回（只返回 JSON，不要其他内容）:
{
  "price": {
    "current": 数字或null,
    "prev_close": 数字或null,
    "change_pct": "百分比字符串或null",
    "volume": "成交量字符串或null"
  },
  "fundamentals": {
    "revenue_ytd": "营收字符串或null",
    "revenue_growth": "增速字符串或null",
    "net_profit_ytd": "净利润字符串或null",
    "profit_growth": "增速字符串或null",
    "pe_ratio": 数字或null,
    "pb_ratio": 数字或null
  },
  "analyst": {
    "target_price_avg": 数字或null,
    "buy_ratings": 数字或null,
    "sell_ratings": 数字或null,
    "upside": "涨幅字符串或null"
  },
  "news": [{ "title": "标题", "url": "链接", "date": "日期" }],
  "summary": "一句话概要"
}

如果某些字段无法从数据中提取，设为 null。`;

    const extracted = await this.llm.chat(extractionPrompt, {
      systemPrompt: '你是金融数据提取专家。只返回有效的 JSON，不要其他内容。',
      temperature: 0.1,
    });

    let structuredData: Record<string, unknown> = {};
    try {
      const jsonMatch = extracted.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        structuredData = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // JSON 解析失败，使用空数据
    }

    return {
      symbol,
      name,
      market,
      updated_at: new Date().toISOString(),
      dataSource: 'apify',
      price: structuredData.price as StockData['price'],
      fundamentals: structuredData.fundamentals as StockData['fundamentals'],
      analyst: structuredData.analyst as StockData['analyst'],
      news: structuredData.news as StockData['news'],
      analysis: structuredData.summary as string,
    };
  }

  // 回退方案：通过 LLM 生成分析
  private async fetchViaLLM(symbol: string, name: string, market: string): Promise<StockData> {
    const prompt = `请为股票 ${name}（${symbol}）提供一个简要的投资分析摘要，包括：
1. 当前大致股价区间
2. 公司主营业务
3. 近期表现
4. 简要投资观点

请用简洁的中文回复，不超过200字。`;

    const response = await this.llm.chat(prompt, {
      systemPrompt: '你是专业的股票分析师，提供客观、简洁的分析。',
    });

    return {
      symbol,
      name,
      market,
      updated_at: new Date().toISOString(),
      dataSource: 'llm',
      analysis: response,
    };
  }

  // 根据股票代码和市场构建财经网站 URL
  private buildFinanceUrls(symbol: string, name: string): string[] {
    const urls: string[] = [];

    if (symbol.endsWith('.SS') || symbol.endsWith('.SZ')) {
      // A 股 - 东方财富
      const code = symbol.replace(/\.(SS|SZ)$/, '');
      const prefix = symbol.endsWith('.SS') ? '1' : '0';
      urls.push(`https://quote.eastmoney.com/${symbol.endsWith('.SS') ? 'sh' : 'sz'}${code}.html`);
      urls.push(`https://finance.yahoo.com/quote/${code}.${symbol.endsWith('.SS') ? 'SS' : 'SZ'}/`);
    } else if (symbol.endsWith('.HK')) {
      // 港股
      const code = symbol.replace('.HK', '');
      urls.push(`https://finance.yahoo.com/quote/${code}.HK/`);
    } else {
      // 美股
      urls.push(`https://finance.yahoo.com/quote/${symbol}/`);
    }

    return urls;
  }

  private async generateReport(data: StockData): Promise<string> {
    const lines: string[] = [
      `📊 **${data.name}** (${data.symbol})`,
      '',
      `📍 市场: ${data.market} | 🕐 ${new Date(data.updated_at).toLocaleString('zh-CN')}`,
    ];

    // 数据来源标记
    if (data.dataSource === 'apify') {
      lines.push('🔗 数据来源: Apify 实时抓取');
    } else {
      lines.push('⚠️ 数据来源: AI 分析（非实时数据，仅供参考）');
    }
    lines.push('', '---', '');

    // 📊 股价概览
    if (data.price) {
      lines.push('### 📊 股价概览');
      if (data.price.current) lines.push(`- 现价: **${data.price.current}**`);
      if (data.price.change_pct) lines.push(`- 涨跌幅: ${data.price.change_pct}`);
      if (data.price.range_52w) {
        lines.push(`- 52周区间: ${data.price.range_52w[0]} - ${data.price.range_52w[1]}`);
      }
      if (data.price.volume) lines.push(`- 成交量: ${data.price.volume}`);
      lines.push('');
    }

    // 📈 基本面
    if (data.fundamentals) {
      lines.push('### 📈 基本面分析');
      const f = data.fundamentals;
      if (f.revenue_ytd) lines.push(`- 营收: ${f.revenue_ytd} (${f.revenue_growth || 'N/A'})`);
      if (f.net_profit_ytd) lines.push(`- 净利润: ${f.net_profit_ytd} (${f.profit_growth || 'N/A'})`);
      if (f.pe_ratio) lines.push(`- PE: ${f.pe_ratio}`);
      if (f.pb_ratio) lines.push(`- PB: ${f.pb_ratio}`);
      lines.push('');
    }

    // 🎯 机构观点
    if (data.analyst) {
      lines.push('### 🎯 机构观点');
      const a = data.analyst;
      if (a.target_price_avg) lines.push(`- 目标均价: ${a.target_price_avg}`);
      if (a.buy_ratings) lines.push(`- 买入评级: ${a.buy_ratings}`);
      if (a.sell_ratings) lines.push(`- 卖出评级: ${a.sell_ratings}`);
      if (a.upside) lines.push(`- 潜在涨幅: ${a.upside}`);
      lines.push('');
    }

    // 💰 资金流向
    if (data.capital_flow) {
      lines.push('### 💰 资金流向');
      const c = data.capital_flow;
      if (c.main_net) lines.push(`- 主力净流入: ${c.main_net}`);
      if (c.retail_net) lines.push(`- 散户净流入: ${c.retail_net}`);
      if (c.north_net) lines.push(`- 北向资金: ${c.north_net}`);
      lines.push('');
    }

    // 📰 最新新闻
    if (data.news && data.news.length > 0) {
      lines.push('### 📰 最新资讯');
      for (const item of data.news.slice(0, 5)) {
        lines.push(`- [${item.title}](${item.url}) (${item.date})`);
      }
      lines.push('');
    }

    // 分析摘要
    if (data.analysis) {
      lines.push('### 💡 分析摘要');
      lines.push(data.analysis as string);
      lines.push('');
    }

    // 风险提示
    lines.push('### ⚠️ 风险提示');
    lines.push('- 以上数据和分析仅供参考，不构成投资建议');
    lines.push('- 投资有风险，入市需谨慎');

    return lines.join('\n');
  }
}
