// TeamAgent - 多 Agent 协作协调器
//
// 工作流程:
// 1. Coordinator 接收用户任务
// 2. 将任务分解并分配给专业 Agent
// 3. 各 Agent 独立处理，结果汇总
// 4. Summarizer 综合输出最终结果

import type { ModelOrchestrator } from '../models/orchestrator.js';
import { Agent, type AgentConfig, type AgentResult, type AgentMessage } from './base.js';

export type TeamStrategy = 'sequential' | 'parallel' | 'debate';

export interface TeamConfig {
  name: string;
  description: string;
  strategy: TeamStrategy;
  agents: AgentConfig[];
  maxRounds?: number;
}

export interface TeamResult {
  team: string;
  strategy: TeamStrategy;
  agentResults: AgentResult[];
  finalOutput: string;
  rounds: number;
}

export class TeamAgent {
  readonly config: TeamConfig;
  private agents: Agent[] = [];
  private llm: ModelOrchestrator;

  constructor(config: TeamConfig, llm: ModelOrchestrator) {
    this.config = config;
    this.llm = llm;

    // 创建团队成员
    for (const agentConfig of config.agents) {
      this.agents.push(new Agent(agentConfig, llm));
    }
  }

  get name(): string {
    return this.config.name;
  }

  async execute(task: string): Promise<TeamResult> {
    switch (this.config.strategy) {
      case 'sequential':
        return this.executeSequential(task);
      case 'parallel':
        return this.executeParallel(task);
      case 'debate':
        return this.executeDebate(task);
      default:
        return this.executeSequential(task);
    }
  }

  // 顺序执行：每个 Agent 按顺序处理，后一个可以看到前一个的输出
  private async executeSequential(task: string): Promise<TeamResult> {
    const results: AgentResult[] = [];
    let context = '';

    for (const agent of this.agents) {
      // 把前面 Agent 的输出作为上下文传递
      const result = await agent.process(task, context);
      results.push(result);

      // 累积上下文
      context += `\n\n[${agent.name} (${agent.role})的分析]:\n${result.output}`;

      // 广播消息给后续 Agent
      const message: AgentMessage = {
        from: agent.name,
        to: 'team',
        content: result.output,
        timestamp: new Date(),
      };
      for (const other of this.agents) {
        if (other.name !== agent.name) {
          other.receiveMessage(message);
        }
      }
    }

    // 生成最终综合结果
    const finalOutput = await this.synthesize(task, results);

    this.clearAllMemory();

    return {
      team: this.config.name,
      strategy: 'sequential',
      agentResults: results,
      finalOutput,
      rounds: 1,
    };
  }

  // 并行执行：所有 Agent 同时处理，最后汇总
  private async executeParallel(task: string): Promise<TeamResult> {
    const promises = this.agents.map(agent => agent.process(task));
    const results = await Promise.all(promises);

    const finalOutput = await this.synthesize(task, results);

    this.clearAllMemory();

    return {
      team: this.config.name,
      strategy: 'parallel',
      agentResults: results,
      finalOutput,
      rounds: 1,
    };
  }

  // 辩论模式：Agent 之间多轮交互，最后达成共识
  private async executeDebate(task: string): Promise<TeamResult> {
    const maxRounds = this.config.maxRounds || 2;
    const allResults: AgentResult[] = [];
    let roundContext = '';

    for (let round = 0; round < maxRounds; round++) {
      const roundResults: AgentResult[] = [];

      for (const agent of this.agents) {
        const prompt = round === 0
          ? task
          : `原始任务: ${task}\n\n请基于其他成员的观点，补充或修正你的分析:\n${roundContext}`;

        const result = await agent.process(prompt);
        roundResults.push(result);

        // 广播本轮结果
        const message: AgentMessage = {
          from: agent.name,
          to: 'team',
          content: result.output,
          timestamp: new Date(),
          metadata: { round },
        };
        for (const other of this.agents) {
          if (other.name !== agent.name) {
            other.receiveMessage(message);
          }
        }
      }

      allResults.push(...roundResults);
      roundContext = roundResults
        .map(r => `[${r.agent} (${r.role})]:\n${r.output}`)
        .join('\n\n---\n\n');
    }

    const finalOutput = await this.synthesize(task, allResults);

    this.clearAllMemory();

    return {
      team: this.config.name,
      strategy: 'debate',
      agentResults: allResults,
      finalOutput,
      rounds: maxRounds,
    };
  }

  // 综合所有 Agent 结果，生成最终输出
  private async synthesize(task: string, results: AgentResult[]): Promise<string> {
    const agentOutputs = results
      .map(r => `### ${r.agent} (${r.role})\n${r.output}`)
      .join('\n\n---\n\n');

    const prompt = `你是一个团队协调者。以下是团队各成员针对任务的分析结果。
请综合所有观点，生成一份结构清晰、内容完整的最终报告。

## 原始任务
${task}

## 各成员分析
${agentOutputs}

## 要求
- 综合各方观点，取其精华
- 如有分歧，客观呈现不同观点
- 输出结构化的最终报告
- 用中文回复`;

    return this.llm.chat(prompt, {
      systemPrompt: '你是专业的团队协调者，擅长综合多方观点生成高质量报告。',
    });
  }

  private clearAllMemory(): void {
    for (const agent of this.agents) {
      agent.clearMemory();
    }
  }

  listAgents(): string[] {
    return this.agents.map(a => `${a.name} (${a.role})`);
  }
}
