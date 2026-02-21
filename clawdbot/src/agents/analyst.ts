// 分析师 Agent - 负责深度分析和推理

import { BaseAgent } from './base.js';
import type { AgentProfile, AgentMessage } from '../types/agent.js';

export class AnalystAgent extends BaseAgent {
  profile: AgentProfile = {
    id: 'analyst',
    name: '分析师',
    role: 'analyst',
    description: '负责深度分析、逻辑推理、生成洞察',
    systemPrompt: `你是一个资深分析师。你的职责是：
1. 基于已有数据和信息进行深度分析
2. 发现数据背后的趋势和规律
3. 给出有理有据的结论和建议

分析框架：
- 定量分析：使用数据和指标
- 定性分析：评估质量和趋势
- 风险评估：识别潜在风险
- 建议：给出可操作的建议

要求：
- 结论必须有数据支撑
- 明确区分确定性和不确定性
- 给出多种可能的情景分析`,
    capabilities: ['data-analysis', 'reasoning', 'risk-assessment'],
  };

  protected async think(message: AgentMessage): Promise<string> {
    const context = this.messageLog.length > 0
      ? `之前的对话:\n${this.getMessageSummary()}`
      : undefined;

    const prompt = `请对以下内容进行深度分析:

${message.content}

请提供：
1. 核心分析结论
2. 关键数据解读
3. 风险与机会评估
4. 可操作建议`;

    return this.ask(prompt, context);
  }
}
