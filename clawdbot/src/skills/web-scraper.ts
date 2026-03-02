// Web 数据抓取技能 - 基于 Apify 的结构化数据抓取

import { BaseSkill } from './base.js';
import { ApifyClient, APIFY_ACTORS } from '../services/apify-client.js';
import type { SkillManifest, SkillResult, ConversationContext, Permission } from '../types/index.js';

export class WebScraperSkill extends BaseSkill {
  manifest: SkillManifest = {
    name: 'web-scraper',
    version: '1.0.0',
    description: '网页数据抓取技能 - 基于 Apify 实现结构化数据抓取与分析',
    author: 'Clawdbot',
    triggers: {
      patterns: [
        '抓取\\s*(.+?)\\s*(?:数据|信息)?$',
        '爬取\\s*(.+)',
        'scrape\\s+(.+)',
        '/scrape\\s+(.+)',
        '采集\\s*(.+?)\\s*(?:数据|信息)?$',
      ],
      intents: ['web_scraping', 'data_collection'],
      commands: ['/scrape', '/crawl'],
    },
    permissions: [
      'network:http' as Permission,
      'file:write' as Permission,
    ],
    limits: {
      timeout: 300000,
      memory: 512,
      fileAccess: ['./scrape_cache/*'],
      networkAccess: ['api.apify.com'],
    },
  };

  private apify!: ApifyClient;

  async onLoad(): Promise<void> {
    this.apify = new ApifyClient();
  }

  async execute(
    params: Record<string, unknown>,
    _context: ConversationContext
  ): Promise<SkillResult> {
    const text = params.text as string || '';
    const matches = params.matches as string[] || [];
    const target = matches[0] || text;

    if (!this.apify.isConfigured) {
      return {
        success: false,
        error: 'Apify API Token 未配置',
        response: {
          text: [
            '⚠️ **Apify 未配置**',
            '',
            '请在 `clawdbot/.env` 中设置 `APIFY_API_TOKEN`：',
            '',
            '```',
            'APIFY_API_TOKEN=apify_api_xxxxx',
            '```',
            '',
            '获取 Token: https://console.apify.com/account/integrations',
          ].join('\n'),
        },
      };
    }

    // 使用 LLM 分析用户意图并选择合适的 Actor
    const actorSelection = await this.selectActor(target);

    if (!actorSelection) {
      return {
        success: false,
        error: '无法确定抓取目标',
        response: {
          text: [
            '❓ 无法确定要使用的抓取工具。',
            '',
            '**可用的抓取器：**',
            ...this.apify.listAvailableActors().map(a => `- \`${a.name}\`: ${a.description}`),
            '',
            '**使用示例：**',
            '- 抓取 Google Maps 上海餐厅数据',
            '- 爬取 Amazon 手机壳价格',
            '- scrape TikTok #AI 热门视频',
          ].join('\n'),
        },
      };
    }

    // 执行抓取
    const result = await this.apify.runByName(
      actorSelection.actorName,
      actorSelection.input,
      { maxItems: 50, timeoutSecs: 120 }
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        response: { text: `❌ 抓取失败: ${result.error}` },
      };
    }

    // 使用 LLM 分析抓取结果
    const analysis = await this.analyzeResults(target, result.items);

    return {
      success: true,
      data: {
        itemCount: result.items.length,
        items: result.items.slice(0, 10), // 返回前10条作为示例
        stats: result.stats,
      },
      response: {
        text: [
          `✅ **数据抓取完成**`,
          '',
          `📊 共获取 **${result.items.length}** 条结构化数据`,
          `🔧 使用: ${APIFY_ACTORS[actorSelection.actorName]?.description || actorSelection.actorName}`,
          '',
          '---',
          '',
          analysis,
        ].join('\n'),
      },
      followUp: {
        suggestions: [
          '导出为 CSV',
          '更详细的分析',
          '抓取更多数据',
        ],
      },
    };
  }

  /**
   * 使用 LLM 根据用户描述选择合适的 Actor 和输入参数
   */
  private async selectActor(target: string): Promise<{
    actorName: string;
    input: Record<string, unknown>;
  } | null> {
    const actorList = this.apify.listAvailableActors()
      .map(a => `- ${a.name}: ${a.description} (Actor ID: ${a.id})`)
      .join('\n');

    const prompt = `You are a data scraping assistant. Based on the user's request, select the most appropriate Apify actor and generate the input parameters.

Available actors:
${actorList}

User request: "${target}"

Respond in JSON format ONLY (no markdown, no explanation):
{
  "actorName": "the-actor-name",
  "input": { ... appropriate input parameters for the actor ... }
}

Common input patterns:
- google-maps: { "searchStringsArray": ["query"], "maxCrawledPlacesPerSearch": 20 }
- google-search: { "queries": "search query", "maxPagesPerQuery": 1 }
- web-scraper: { "startUrls": [{"url": "https://..."}], "pageFunction": "..." }
- tiktok: { "hashtags": ["tag"], "resultsPerPage": 20 }
- amazon: { "keyword": "product name", "maxItems": 20 }
- yahoo-finance: { "symbols": ["AAPL"], "startDate": "2024-01-01" }
- website-content: { "startUrls": [{"url": "https://..."}], "maxCrawlPages": 10 }

If no actor matches, respond with: { "actorName": null }`;

    try {
      const response = await this.llm.chat(prompt, {
        temperature: 0.1,
        systemPrompt: 'You are a JSON-only response bot. Only output valid JSON, nothing else.',
      });

      // 提取 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.actorName || parsed.actorName === null) return null;

      return {
        actorName: parsed.actorName,
        input: parsed.input || {},
      };
    } catch {
      return null;
    }
  }

  /**
   * 使用 LLM 分析抓取结果
   */
  private async analyzeResults(
    target: string,
    items: Record<string, unknown>[]
  ): Promise<string> {
    if (items.length === 0) {
      return '未获取到数据，请检查抓取条件或稍后重试。';
    }

    // 取前5条数据作为样本
    const sample = items.slice(0, 5);
    const sampleStr = JSON.stringify(sample, null, 2).slice(0, 3000);

    const prompt = `用户请求抓取："${target}"

已获取 ${items.length} 条数据，以下是样本数据：

${sampleStr}

请基于这些真实数据提供：
1. 数据概要（包含哪些关键字段）
2. 关键发现（3-5个要点）
3. 数据质量评估

用简洁的中文 Markdown 格式回复，300字以内。`;

    try {
      return await this.llm.chat(prompt, {
        systemPrompt: '你是数据分析师，负责对抓取的结构化数据进行分析。只基于真实数据回答，不要编造。',
      });
    } catch {
      return `共获取 ${items.length} 条数据。请检查数据内容进行后续分析。`;
    }
  }
}
