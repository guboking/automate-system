// 股票分析技能

import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseSkill } from './base.js';
import { ApifyClient } from '../services/apify-client.js';
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
  };
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
  private apify!: ApifyClient;
  manifest: SkillManifest = {
    name: 'stock-analysis',
    version: '1.0.0',
    description: '股票分析技能 - 支持 A 股、港股、美股的行情分析',
    author: 'Clawdbot',
    triggers: {
      patterns: [
        '分析\\s*(.+?)\\s*(?:股票)?$',
        '看看\\s*(.+)',
        '(.+?)\\s*怎么样',
        '刷新\\s*(.+?)\\s*数据',
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
      timeout: 60000,
      memory: 256,
      fileAccess: ['./stock_cache/*'],
      networkAccess: ['*'],
    },
  };

  private cacheDir = './stock_cache/data';

  async onLoad(): Promise<void> {
    // 确保缓存目录存在
    await fs.mkdir(this.cacheDir, { recursive: true });
    // 初始化 Apify 客户端
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
    // 从映射反查名称
    const name = Object.entries(STOCK_NAME_MAP).find(([_, v]) => v === symbol)?.[0] || symbol;

    // 确定市场
    let market = '未知';
    if (symbol.endsWith('.SS')) market = 'A股沪市';
    else if (symbol.endsWith('.SZ')) market = 'A股深市';
    else if (symbol.endsWith('.HK')) market = '港股';
    else if (/^[A-Z]+$/.test(symbol)) market = '美股';

    // 优先使用 Apify 获取真实数据
    if (this.apify.isConfigured) {
      try {
        const realData = await this.fetchViaApify(symbol, name, market);
        if (realData) return realData;
      } catch (error) {
        console.warn(`Apify fetch failed for ${symbol}, falling back to LLM: ${(error as Error).message}`);
      }
    }

    // 回退：使用 LLM 生成分析（无实时数据时）
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
      analysis: response,
    };
  }

  /**
   * 通过 Apify 获取真实股票数据
   */
  private async fetchViaApify(symbol: string, name: string, market: string): Promise<StockData | null> {
    // 转换为 Yahoo Finance 格式的代码
    const yahooSymbol = this.toYahooSymbol(symbol);

    const result = await this.apify.runByName('yahoo-finance', {
      symbols: [yahooSymbol],
    }, { timeoutSecs: 60, maxItems: 1 });

    if (!result.success || result.items.length === 0) {
      return null;
    }

    const item = result.items[0];

    // 构建标准化的股票数据
    const stockData: StockData = {
      symbol,
      name: (item.shortName as string) || (item.longName as string) || name,
      market,
      updated_at: new Date().toISOString(),
      price: {
        current: Number(item.regularMarketPrice) || 0,
        prev_close: Number(item.regularMarketPreviousClose) || 0,
        change_pct: item.regularMarketChangePercent
          ? `${Number(item.regularMarketChangePercent) >= 0 ? '+' : ''}${Number(item.regularMarketChangePercent).toFixed(2)}%`
          : '0%',
      },
      _source: 'apify',
    };

    // 添加可用的扩展数据
    if (item.fiftyTwoWeekLow !== undefined) {
      stockData.range_52w = {
        low: Number(item.fiftyTwoWeekLow),
        high: Number(item.fiftyTwoWeekHigh),
      };
    }
    if (item.marketCap !== undefined) {
      stockData.market_cap = item.marketCap;
    }
    if (item.trailingPE !== undefined) {
      stockData.pe_ratio = Number(item.trailingPE);
    }
    if (item.priceToBook !== undefined) {
      stockData.pb_ratio = Number(item.priceToBook);
    }
    if (item.volume !== undefined) {
      stockData.volume = item.volume;
    }

    // 使用 LLM 基于真实数据生成分析
    const analysisPrompt = `基于以下真实市场数据，为 ${name}（${symbol}）提供简要投资分析：

${JSON.stringify(item, null, 2)}

请给出：1. 现价与趋势 2. 估值水平 3. 简要投资建议
用简洁的中文回复，200字以内。注意：这些都是真实数据，不要编造。`;

    try {
      stockData.analysis = await this.llm.chat(analysisPrompt, {
        systemPrompt: '你是专业的股票分析师。基于提供的真实数据进行分析，不要编造任何数据。',
      });
    } catch {
      stockData.analysis = '数据已获取，分析生成失败。';
    }

    return stockData;
  }

  /**
   * 将内部代码转换为 Yahoo Finance 格式
   */
  private toYahooSymbol(symbol: string): string {
    // A股沪市: 600519.SS → 600519.SS (Yahoo 同格式)
    // A股深市: 002594.SZ → 002594.SZ (Yahoo 同格式)
    // 港股: 01211.HK → 1211.HK (Yahoo 去前导零)
    // 美股: TSLA → TSLA (直接使用)
    if (symbol.endsWith('.HK')) {
      const code = symbol.replace('.HK', '').replace(/^0+/, '');
      return `${code}.HK`;
    }
    return symbol;
  }

  private async generateReport(data: StockData): Promise<string> {
    const lines = [
      `📊 **${data.name}** (${data.symbol})`,
      ``,
      `📍 市场: ${data.market}`,
      `🕐 更新时间: ${new Date(data.updated_at).toLocaleString('zh-CN')}`,
      `📡 数据来源: ${data._source === 'apify' ? 'Apify 实时数据' : 'AI 分析'}`,
      ``,
    ];

    // 如果有真实行情数据，展示详细信息
    if (data.price && data.price.current) {
      lines.push(
        `---`,
        ``,
        `### 📊 股价概览`,
        `- 现价: **${data.price.current}**`,
        `- 昨收: ${data.price.prev_close}`,
        `- 涨跌幅: ${data.price.change_pct}`,
      );

      if (data.range_52w) {
        const range = data.range_52w as { low: number; high: number };
        const position = ((data.price.current - range.low) / (range.high - range.low) * 100).toFixed(0);
        lines.push(`- 52周区间: ${range.low} ~ ${range.high} (当前位于 ${position}%)`);
      }

      if (data.pe_ratio) lines.push(`- PE: ${data.pe_ratio}`);
      if (data.pb_ratio) lines.push(`- PB: ${data.pb_ratio}`);
      if (data.volume) lines.push(`- 成交量: ${data.volume}`);

      lines.push(``);
    }

    lines.push(
      `---`,
      ``,
      data.analysis as string || '暂无分析数据',
    );

    return lines.join('\n');
  }
}
