// Apify 数据抓取技能
// 支持自然语言指令触发各种数据抓取任务

import { BaseSkill } from './base.js';
import { ApifyClient } from '../services/apify.js';
import { APIFY_ACTORS, findBestActor } from '../config/apify-actors.js';
import type { SkillManifest, SkillResult, ConversationContext, Permission } from '../types/index.js';

export class ApifyScraperSkill extends BaseSkill {
  manifest: SkillManifest = {
    name: 'apify-scraper',
    version: '1.0.0',
    description: 'Apify 数据抓取技能 - 支持 Google、TikTok、Amazon 等平台的结构化数据抓取',
    author: 'Clawdbot',
    triggers: {
      patterns: [
        '抓取\\s*(.+)',
        '爬取\\s*(.+)',
        'scrape\\s+(.+)',
        'crawl\\s+(.+)',
        '搜索\\s*(.+?)\\s*(?:数据|信息|资料)',
        '/apify\\s+(.+)',
        '/scrape\\s+(.+)',
      ],
      intents: ['data_scraping', 'web_crawling'],
      commands: ['/apify', '/scrape'],
    },
    permissions: [
      'network:http' as Permission,
      'file:write' as Permission,
    ],
    limits: {
      timeout: 300000,  // 5 分钟超时（Actor 运行可能较长）
      memory: 512,
      fileAccess: ['./scrape_results/*'],
      networkAccess: ['api.apify.com'],
    },
  };

  private client!: ApifyClient;

  async onLoad(): Promise<void> {
    this.client = new ApifyClient();
  }

  async execute(
    params: Record<string, unknown>,
    _context: ConversationContext
  ): Promise<SkillResult> {
    const text = params.text as string || '';
    const matches = params.matches as string[] || [];
    const query = matches[0] || text;

    // 检查 Apify 是否已配置
    if (!this.client.isConfigured()) {
      return {
        success: false,
        error: 'Apify 未配置',
        response: {
          text: [
            '⚠️ **Apify API Token 未配置**',
            '',
            '请按以下步骤配置：',
            '1. 访问 https://console.apify.com/account/integrations 获取 API Token',
            '2. 在 `clawdbot/.env` 文件中添加：',
            '   ```',
            '   APIFY_API_TOKEN=apify_api_xxxxx',
            '   ```',
            '3. 重启服务',
          ].join('\n'),
        },
      };
    }

    // 使用 LLM 解析用户意图，确定要使用的 Actor 和参数
    const taskPlan = await this.planScrapingTask(query);

    if (!taskPlan.actorId) {
      return {
        success: false,
        error: '无法确定合适的数据抓取方案',
        response: {
          text: [
            '🤔 无法确定合适的数据抓取方案。',
            '',
            '**支持的抓取类型：**',
            ...Object.values(APIFY_ACTORS).map(a => `- ${a.name}: ${a.description}`),
            '',
            '请尝试更具体的描述，例如：',
            '- 「抓取 Google Maps 上海咖啡店数据」',
            '- 「爬取 Amazon 上蓝牙耳机的产品信息」',
            '- 「搜索 TikTok 上的 AI 相关热门视频」',
          ].join('\n'),
        },
      };
    }

    // 执行抓取
    const result = await this.client.runActor({
      actorId: taskPlan.actorId,
      input: taskPlan.input,
      timeout: 300,
      waitForFinish: 120,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        response: {
          text: `❌ 数据抓取失败: ${result.error}`,
        },
      };
    }

    // 使用 LLM 分析和总结结果
    const summary = await this.summarizeResults(query, result.items);

    return {
      success: true,
      data: {
        runId: result.runId,
        datasetId: result.datasetId,
        itemCount: result.stats.itemCount,
        durationMs: result.stats.durationMs,
        items: result.items.slice(0, 5), // 只返回前 5 条作为预览
      },
      response: {
        text: [
          `✅ **数据抓取完成**`,
          '',
          `📊 获取 **${result.stats.itemCount}** 条数据 | ⏱️ 耗时 ${(result.stats.durationMs / 1000).toFixed(1)}秒`,
          '',
          '---',
          '',
          summary,
        ].join('\n'),
      },
      followUp: {
        suggestions: [
          '导出完整数据为 CSV',
          '对抓取结果进行深度分析',
          '抓取更多相关数据',
        ],
      },
    };
  }

  // 使用 LLM 规划抓取任务
  private async planScrapingTask(query: string): Promise<{
    actorId: string | null;
    input: Record<string, unknown>;
    description: string;
  }> {
    // 先尝试关键词匹配
    const matched = findBestActor(query);
    if (matched) {
      // 使用 LLM 生成具体参数
      const paramPrompt = `用户需要使用 "${matched.name}" 进行数据抓取。
用户请求: "${query}"

该 Actor 的默认参数如下:
${JSON.stringify(matched.defaultInput, null, 2)}

请根据用户请求生成具体的输入参数（JSON 格式）。只返回 JSON，不要其他内容。
如果需要设置搜索关键词，请从用户请求中提取。
如果需要设置 URL，请根据用户请求构造合理的 URL。`;

      try {
        const paramResponse = await this.llm.chat(paramPrompt, {
          systemPrompt: '你是一个 Apify Actor 参数生成器。只返回有效的 JSON 对象。',
          temperature: 0.1,
        });

        const jsonMatch = paramResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const customInput = JSON.parse(jsonMatch[0]);
          return {
            actorId: matched.id,
            input: { ...matched.defaultInput, ...customInput },
            description: matched.description,
          };
        }
      } catch {
        // 解析失败，使用默认参数
      }

      return {
        actorId: matched.id,
        input: matched.defaultInput,
        description: matched.description,
      };
    }

    // 关键词匹配失败，使用 LLM 推断
    const actorList = Object.entries(APIFY_ACTORS)
      .map(([key, config]) => `- ${key}: ${config.description} (Actor ID: ${config.id})`)
      .join('\n');

    const prompt = `用户请求数据抓取: "${query}"

可用的 Apify Actor 列表:
${actorList}

请选择最合适的 Actor，返回 JSON 格式:
{
  "actorKey": "选中的 actor key",
  "reason": "选择原因"
}

如果没有合适的 Actor，返回:
{ "actorKey": null, "reason": "原因" }`;

    try {
      const response = await this.llm.chat(prompt, {
        systemPrompt: '你是数据抓取专家。只返回有效的 JSON。',
        temperature: 0.1,
      });

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const decision = JSON.parse(jsonMatch[0]);
        if (decision.actorKey && APIFY_ACTORS[decision.actorKey]) {
          const actor = APIFY_ACTORS[decision.actorKey];
          return {
            actorId: actor.id,
            input: actor.defaultInput,
            description: actor.description,
          };
        }
      }
    } catch {
      // 解析失败
    }

    return { actorId: null, input: {}, description: '' };
  }

  // 使用 LLM 总结抓取结果
  private async summarizeResults(query: string, items: unknown[]): Promise<string> {
    if (items.length === 0) {
      return '未获取到数据，请检查抓取参数或稍后重试。';
    }

    const sampleData = JSON.stringify(items.slice(0, 10), null, 2);
    const prompt = `用户的抓取需求: "${query}"

抓取到 ${items.length} 条数据，以下是前 ${Math.min(10, items.length)} 条样本:

${sampleData}

请对抓取结果进行简要分析和总结：
1. 数据概览：包含哪些关键字段
2. 关键发现：从数据中提取的有价值信息
3. 数据质量：数据的完整性和可用性评估

请用中文回复，使用 Markdown 格式，简洁明了。`;

    return this.llm.chat(prompt, {
      systemPrompt: '你是数据分析专家，擅长从结构化数据中提取价值。请简洁地总结数据。',
    });
  }
}
