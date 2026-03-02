// Apify 客户端服务 - 封装 Apify API 调用

export interface ApifyRunInput {
  [key: string]: unknown;
}

export interface ApifyDatasetItem {
  [key: string]: unknown;
}

export interface ApifyRunResult {
  success: boolean;
  datasetId?: string;
  items: ApifyDatasetItem[];
  error?: string;
  stats?: {
    itemCount: number;
    runTimeSecs: number;
    costUsd: number;
  };
}

// 预置的 Apify Actor 映射（常用爬虫）
export const APIFY_ACTORS: Record<string, { id: string; description: string }> = {
  'google-maps': {
    id: 'compass/crawler-google-places',
    description: 'Google Maps 商户数据抓取',
  },
  'google-search': {
    id: 'apify/google-search-scraper',
    description: 'Google 搜索结果抓取',
  },
  'web-scraper': {
    id: 'apify/web-scraper',
    description: '通用网页抓取器',
  },
  'cheerio-scraper': {
    id: 'apify/cheerio-scraper',
    description: '轻量级 HTML 抓取器（无浏览器）',
  },
  'tiktok': {
    id: 'clockworks/free-tiktok-scraper',
    description: 'TikTok 视频和用户数据抓取',
  },
  'amazon': {
    id: 'junglee/amazon-crawler',
    description: 'Amazon 商品数据抓取',
  },
  'instagram': {
    id: 'apify/instagram-scraper',
    description: 'Instagram 帖子和用户数据抓取',
  },
  'youtube': {
    id: 'bernardo/youtube-scraper',
    description: 'YouTube 视频和频道数据抓取',
  },
  'twitter': {
    id: 'quacker/twitter-scraper',
    description: 'Twitter/X 推文数据抓取',
  },
  'linkedin': {
    id: 'anchor/linkedin-scraper',
    description: 'LinkedIn 公司和职位数据抓取',
  },
  'website-content': {
    id: 'apify/website-content-crawler',
    description: '网站内容批量抓取（支持 Markdown 输出）',
  },
  'yahoo-finance': {
    id: 'mscraper/yahoo-finance-scraper',
    description: 'Yahoo Finance 股票数据抓取',
  },
};

export class ApifyClient {
  private apiToken: string;
  private baseUrl = 'https://api.apify.com/v2';

  constructor(apiToken?: string) {
    this.apiToken = apiToken || process.env.APIFY_API_TOKEN || '';
    if (!this.apiToken) {
      console.warn('[ApifyClient] APIFY_API_TOKEN not set. Apify features will be unavailable.');
    }
  }

  get isConfigured(): boolean {
    return !!this.apiToken;
  }

  /**
   * 运行指定的 Apify Actor 并等待结果
   */
  async runActor(actorId: string, input: ApifyRunInput, options?: {
    timeoutSecs?: number;
    memoryMbytes?: number;
    maxItems?: number;
  }): Promise<ApifyRunResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        items: [],
        error: 'APIFY_API_TOKEN is not configured. Please set it in .env file.',
      };
    }

    try {
      // 启动 Actor 并等待完成
      const runResponse = await this.request(
        `/acts/${actorId}/run-sync-get-dataset-items`,
        'POST',
        input,
        {
          timeout: (options?.timeoutSecs || 120) * 1000,
          queryParams: {
            ...(options?.memoryMbytes ? { memory: String(options.memoryMbytes) } : {}),
            ...(options?.maxItems ? { limit: String(options.maxItems) } : {}),
          },
        }
      );

      const items = Array.isArray(runResponse) ? runResponse : [];

      return {
        success: true,
        items,
        stats: {
          itemCount: items.length,
          runTimeSecs: 0,
          costUsd: 0,
        },
      };
    } catch (error) {
      // 如果同步调用超时，尝试异步方式
      if ((error as Error).message.includes('timeout')) {
        return this.runActorAsync(actorId, input, options);
      }

      return {
        success: false,
        items: [],
        error: `Actor run failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 异步运行 Actor（用于耗时较长的任务）
   */
  private async runActorAsync(actorId: string, input: ApifyRunInput, options?: {
    timeoutSecs?: number;
    memoryMbytes?: number;
    maxItems?: number;
  }): Promise<ApifyRunResult> {
    try {
      // Step 1: 启动 Actor
      const startResponse = await this.request(
        `/acts/${actorId}/runs`,
        'POST',
        input,
        {
          queryParams: {
            ...(options?.memoryMbytes ? { memory: String(options.memoryMbytes) } : {}),
          },
        }
      );

      const runId = startResponse?.data?.id;
      if (!runId) {
        return { success: false, items: [], error: 'Failed to start actor run' };
      }

      // Step 2: 轮询等待完成
      const maxWait = (options?.timeoutSecs || 300) * 1000;
      const startTime = Date.now();
      let status = 'RUNNING';

      while (status === 'RUNNING' || status === 'READY') {
        if (Date.now() - startTime > maxWait) {
          return { success: false, items: [], error: 'Actor run timed out' };
        }

        await this.sleep(3000);

        const runInfo = await this.request(`/acts/${actorId}/runs/${runId}`, 'GET');
        status = runInfo?.data?.status;
      }

      if (status !== 'SUCCEEDED') {
        return { success: false, items: [], error: `Actor run failed with status: ${status}` };
      }

      // Step 3: 获取数据集
      const datasetId = startResponse?.data?.defaultDatasetId;
      const items = await this.getDatasetItems(datasetId, options?.maxItems);

      return {
        success: true,
        datasetId,
        items,
        stats: {
          itemCount: items.length,
          runTimeSecs: Math.round((Date.now() - startTime) / 1000),
          costUsd: 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        items: [],
        error: `Async actor run failed: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 获取数据集中的项目
   */
  async getDatasetItems(datasetId: string, limit?: number): Promise<ApifyDatasetItem[]> {
    try {
      const queryParams: Record<string, string> = {};
      if (limit) queryParams.limit = String(limit);

      const response = await this.request(
        `/datasets/${datasetId}/items`,
        'GET',
        undefined,
        { queryParams }
      );

      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error(`Failed to fetch dataset items: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * 通过预置名称运行 Actor
   */
  async runByName(name: string, input: ApifyRunInput, options?: {
    timeoutSecs?: number;
    maxItems?: number;
  }): Promise<ApifyRunResult> {
    const actor = APIFY_ACTORS[name];
    if (!actor) {
      return {
        success: false,
        items: [],
        error: `Unknown actor name: "${name}". Available: ${Object.keys(APIFY_ACTORS).join(', ')}`,
      };
    }

    return this.runActor(actor.id, input, options);
  }

  /**
   * 列出所有可用的预置 Actor
   */
  listAvailableActors(): { name: string; id: string; description: string }[] {
    return Object.entries(APIFY_ACTORS).map(([name, info]) => ({
      name,
      ...info,
    }));
  }

  /**
   * HTTP 请求封装
   */
  private async request(
    path: string,
    method: 'GET' | 'POST',
    body?: unknown,
    options?: {
      timeout?: number;
      queryParams?: Record<string, string>;
    }
  ): Promise<any> {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.set('token', this.apiToken);

    if (options?.queryParams) {
      for (const [key, value] of Object.entries(options.queryParams)) {
        url.searchParams.set(key, value);
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      options?.timeout || 120000
    );

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
