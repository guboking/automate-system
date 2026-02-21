// Agent 基类 - 所有 Agent 的基础

import type { ModelOrchestrator, Message } from '../models/orchestrator.js';
import type { AgentProfile, AgentMessage } from '../types/agent.js';

export abstract class BaseAgent {
  abstract profile: AgentProfile;

  protected llm!: ModelOrchestrator;
  protected messageLog: AgentMessage[] = [];

  injectDependencies(llm: ModelOrchestrator): void {
    this.llm = llm;
  }

  // 接收消息并处理
  async handleMessage(message: AgentMessage): Promise<AgentMessage> {
    this.messageLog.push(message);

    const response = await this.think(message);

    const reply: AgentMessage = {
      from: this.profile.id,
      to: message.from,
      type: 'result',
      content: response,
      timestamp: new Date(),
    };

    this.messageLog.push(reply);
    return reply;
  }

  // 核心思考方法 - 子类实现具体逻辑
  protected abstract think(message: AgentMessage): Promise<string>;

  // 调用 LLM
  protected async ask(prompt: string, context?: string): Promise<string> {
    const messages: Message[] = [];

    if (context) {
      messages.push({ role: 'user', content: context });
      messages.push({ role: 'assistant', content: '好的，我已了解上下文。请告诉我需要做什么。' });
    }

    messages.push({ role: 'user', content: prompt });

    const result = await this.llm.complete(messages, {
      systemPrompt: this.profile.systemPrompt,
      model: this.profile.model,
    });

    return result.text;
  }

  // 获取消息历史摘要
  protected getMessageSummary(): string {
    return this.messageLog
      .map(m => `[${m.from} → ${m.to}] ${m.content.slice(0, 100)}`)
      .join('\n');
  }

  // 重置状态
  reset(): void {
    this.messageLog = [];
  }
}
