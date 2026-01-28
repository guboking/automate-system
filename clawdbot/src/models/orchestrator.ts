// 模型编排器 - 多模型管理与调用

import Anthropic from '@anthropic-ai/sdk';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface CompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface CompletionResult {
  text: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export class ModelOrchestrator {
  private anthropic: Anthropic;
  private defaultModel: string;

  constructor(apiKey?: string, defaultModel?: string) {
    this.anthropic = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
    this.defaultModel = defaultModel || process.env.DEFAULT_MODEL || 'claude-sonnet-4-20250514';
  }

  async complete(
    messages: Message[],
    options: CompletionOptions = {}
  ): Promise<CompletionResult> {
    const model = options.model || this.defaultModel;
    const systemPrompt = options.systemPrompt || messages.find(m => m.role === 'system')?.content;

    // 过滤掉 system 消息，因为 Anthropic API 用 system 参数
    const chatMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const response = await this.anthropic.messages.create({
      model,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
      system: systemPrompt,
      messages: chatMessages,
    });

    const textContent = response.content.find(c => c.type === 'text');

    return {
      text: textContent?.type === 'text' ? textContent.text : '',
      model: response.model,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }

  async chat(userMessage: string, options: CompletionOptions = {}): Promise<string> {
    const result = await this.complete(
      [{ role: 'user', content: userMessage }],
      options
    );
    return result.text;
  }

  // 根据任务复杂度选择模型
  selectModel(complexity: 'low' | 'medium' | 'high'): string {
    switch (complexity) {
      case 'high':
        return 'claude-opus-4-5-20251101';
      case 'medium':
        return 'claude-sonnet-4-20250514';
      case 'low':
        return 'claude-sonnet-4-20250514'; // 可替换为更便宜的模型
      default:
        return this.defaultModel;
    }
  }
}
