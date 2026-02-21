// 调研 Agent - 负责信息搜集和数据获取

import { BaseAgent } from './base.js';
import type { AgentProfile, AgentMessage } from '../types/agent.js';

export class ResearcherAgent extends BaseAgent {
  profile: AgentProfile = {
    id: 'researcher',
    name: '调研员',
    role: 'researcher',
    description: '负责信息搜集、数据获取、资料整理',
    systemPrompt: `你是一个专业的调研员。你的职责是：
1. 根据任务要求，搜集相关信息和数据
2. 整理信息，提取关键事实和数据点
3. 以结构化的格式输出调研结果

输出要求：
- 列出关键发现（用数据说话）
- 标注信息来源和可信度
- 区分事实和推测
- 保持客观中立`,
    capabilities: ['web-search', 'data-collection', 'fact-checking'],
  };

  protected async think(message: AgentMessage): Promise<string> {
    const context = this.messageLog.length > 0
      ? `之前的对话:\n${this.getMessageSummary()}`
      : undefined;

    const prompt = `请执行以下调研任务:

${message.content}

请提供结构化的调研结果，包括：
1. 关键发现（列表形式）
2. 相关数据和事实
3. 信息可信度评估`;

    return this.ask(prompt, context);
  }
}
