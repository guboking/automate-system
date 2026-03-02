// Apify API 客户端服务
// 提供与 Apify 平台交互的能力，实现确定性的数据抓取

const APIFY_BASE_URL = 'https://api.apify.com/v2';

export interface ApifyRunOptions {
  actorId: string;
  input: Record<string, unknown>;
  timeout?: number;       // 运行超时（秒），默认 300
  memory?: number;        // 内存分配（MB），默认 256
  waitForFinish?: number; // 等待完成的超时（秒），默认 120
}

export interface ApifyRunResult {
  success: boolean;
  runId: string;
  status: 'SUCCEEDED' | 'FAILED' | 'TIMED-OUT' | 'ABORTED' | 'RUNNING';
  datasetId?: string;
  items: unknown[];
  stats: {
    durationMs: number;
    itemCount: number;
    cost?: number;
  };
  error?: string;
}

export interface ApifyDatasetItem {
  [key: string]: unknown;
}

// Apify API 响应类型
interface ApifyRunData {
  id: string;
  status: string;
  defaultDatasetId: string;
  [key: string]: unknown;
}

interface ApifyApiResponse {
  data?: ApifyRunData & { items?: Record<string, unknown>[] };
  [key: string]: unknown;
}

export class ApifyClient {
  private token: string;
  private baseUrl: string;

  constructor(token?: string) {
    this.token = token || process.env.APIFY_API_TOKEN || '';
    this.baseUrl = APIFY_BASE_URL;

    if (!this.token) {
      console.warn('[Apify] 警告: 未设置 APIFY_API_TOKEN，数据抓取功能将不可用');
    }
  }

  // 检查 Token 是否已配置
  isConfigured(): boolean {
    return this.token.length > 0;
  }

  // 运行 Actor 并等待结果
  async runActor(options: ApifyRunOptions): Promise<ApifyRunResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        runId: '',
        status: 'FAILED',
        items: [],
        stats: { durationMs: 0, itemCount: 0 },
        error: 'APIFY_API_TOKEN 未配置，请在 .env 文件中设置',
      };
    }

    const startTime = Date.now();
    const waitSecs = options.waitForFinish ?? 120;

    try {
      // 1. 启动 Actor Run
      const runResponse = await this.request(
        `POST`,
        `/acts/${encodeURIComponent(options.actorId)}/runs`,
        {
          body: options.input,
          params: {
            timeout: String(options.timeout ?? 300),
            memory: String(options.memory ?? 256),
            waitForFinish: String(waitSecs),
          },
        }
      );

      const runData = runResponse.data as ApifyRunData | undefined;
      const runId = runData?.id || '';
      const status = runData?.status || 'FAILED';

      // 2. 如果还在运行，轮询等待
      let finalStatus = status;
      if (status === 'RUNNING' || status === 'READY') {
        finalStatus = await this.waitForRun(runId, waitSecs * 1000);
      }

      // 3. 获取结果数据
      if (finalStatus === 'SUCCEEDED') {
        const datasetId = runData?.defaultDatasetId || '';
        const items = await this.getDatasetItems(datasetId);

        return {
          success: true,
          runId,
          status: 'SUCCEEDED',
          datasetId,
          items,
          stats: {
            durationMs: Date.now() - startTime,
            itemCount: items.length,
          },
        };
      }

      return {
        success: false,
        runId,
        status: finalStatus as ApifyRunResult['status'],
        items: [],
        stats: {
          durationMs: Date.now() - startTime,
          itemCount: 0,
        },
        error: `Actor 运行失败，状态: ${finalStatus}`,
      };
    } catch (error) {
      return {
        success: false,
        runId: '',
        status: 'FAILED',
        items: [],
        stats: {
          durationMs: Date.now() - startTime,
          itemCount: 0,
        },
        error: `Apify 请求失败: ${(error as Error).message}`,
      };
    }
  }

  // 获取 Dataset 中的所有条目
  async getDatasetItems(datasetId: string, limit = 1000): Promise<ApifyDatasetItem[]> {
    const response = await this.request(
      'GET',
      `/datasets/${datasetId}/items`,
      { params: { limit: String(limit), format: 'json' } }
    );
    return Array.isArray(response) ? response : [];
  }

  // 获取 Actor 运行状态
  async getRunStatus(runId: string): Promise<string> {
    const response = await this.request('GET', `/actor-runs/${runId}`);
    const data = response.data as ApifyRunData | undefined;
    return data?.status || 'UNKNOWN';
  }

  // 列出可用的 Actor
  async listMyActors(): Promise<{ id: string; name: string; description: string }[]> {
    const response = await this.request('GET', '/acts', {
      params: { limit: '100', my: 'true' },
    });
    const data = response.data as (ApifyRunData & { items?: Record<string, unknown>[] }) | undefined;
    return (data?.items || []).map((item: Record<string, unknown>) => ({
      id: item.id as string,
      name: item.name as string,
      description: (item.description as string) || '',
    }));
  }

  // 轮询等待 Actor 运行完成
  private async waitForRun(runId: string, timeoutMs: number): Promise<string> {
    const startTime = Date.now();
    const pollInterval = 3000; // 3 秒轮询一次

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getRunStatus(runId);
      if (status !== 'RUNNING' && status !== 'READY') {
        return status;
      }
      await this.sleep(pollInterval);
    }

    return 'TIMED-OUT';
  }

  // 通用 HTTP 请求方法
  private async request(
    method: string,
    path: string,
    options?: {
      body?: Record<string, unknown>;
      params?: Record<string, string>;
    }
  ): Promise<ApifyApiResponse> {
    const url = new URL(`${this.baseUrl}${path}`);

    // 添加 token
    url.searchParams.set('token', this.token);

    // 添加额外参数
    if (options?.params) {
      for (const [key, value] of Object.entries(options.params)) {
        url.searchParams.set(key, value);
      }
    }

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (options?.body && (method === 'POST' || method === 'PUT')) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(url.toString(), fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Apify API ${response.status}: ${errorText}`);
    }

    return response.json() as Promise<ApifyApiResponse>;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
