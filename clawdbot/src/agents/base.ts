// Agent 基类 - 定义单个 Agent 的行为

import type { ModelOrchestrator, CompletionOptions } from '../models/orchestrator.js';

export type AgentRole = 'researcher' | 'analyst' | 'reviewer' | 'summarizer' | 'custom';

export interface AgentConfig {
  name: string;
  role: AgentRole;
  description: string;
  systemPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AgentMessage {
  from: string;
  to: string;
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface AgentResult {
  agent: string;
  role: AgentRole;
  output: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export class Agent {
  readonly config: AgentConfig;
  private llm: ModelOrchestrator;
  private memory: AgentMessage[] = [];

  constructor(config: AgentConfig, llm: ModelOrchestrator) {
    this.config = config;
    this.llm = llm;
  }

  get name(): string {
    return this.config.name;
  }

  get role(): AgentRole {
    return this.config.role;
  }

  async process(input: string, context?: string): Promise<AgentResult> {
    // 构建包含上下文的 prompt
    const contextBlock = context ? `\n\n参考上下文:\n${context}` : '';
    const memoryBlock = this.memory.length > 0
      ? `\n\n之前的协作消息:\n${this.memory.map(m => `[${m.from}]: ${m.content}`).join('\n')}`
      : '';

    const fullInput = `${input}${contextBlock}${memoryBlock}`;

    const options: CompletionOptions = {
      systemPrompt: this.config.systemPrompt,
      model: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
    };

    const result = await this.llm.chat(fullInput, options);

    return {
      agent: this.config.name,
      role: this.config.role,
      output: result,
    };
  }

  receiveMessage(message: AgentMessage): void {
    this.memory.push(message);
  }

  clearMemory(): void {
    this.memory = [];
  }
}
