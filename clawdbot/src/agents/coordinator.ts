// 协调者 Agent - 分解任务、分配工作、汇总结果

import { BaseAgent } from './base.js';
import type { AgentProfile, AgentMessage, TaskPlan, TaskStep } from '../types/agent.js';

export class CoordinatorAgent extends BaseAgent {
  profile: AgentProfile = {
    id: 'coordinator',
    name: '协调者',
    role: 'coordinator',
    description: '负责分解任务、分配给合适的 Agent、汇总最终结果',
    systemPrompt: `你是一个团队协调者。你的职责是：
1. 分析用户的请求，将其分解为具体的子任务
2. 判断每个子任务应该由哪个角色来完成（researcher=信息搜集, analyst=分析推理, executor=执行操作）
3. 汇总各个 Agent 的工作成果，给出最终回复

你的输出必须清晰、结构化。`,
    capabilities: ['task-decomposition', 'delegation', 'synthesis'],
  };

  // 分解任务为执行计划
  async planTask(goal: string, availableRoles: string[]): Promise<TaskPlan> {
    const prompt = `请将以下任务分解为具体的执行步骤。

任务目标: ${goal}

可用的 Agent 角色:
${availableRoles.map(r => `- ${r}`).join('\n')}

请按以下 JSON 格式输出（不要输出其他内容）:
{
  "goal": "任务目标",
  "steps": [
    {
      "id": "step1",
      "description": "步骤描述",
      "assignee": "角色名称",
      "dependencies": []
    }
  ]
}

注意：
- 每个步骤应该足够具体，可以独立执行
- dependencies 填写必须先完成的步骤 id
- 通常 researcher 先执行，然后 analyst 分析，最后汇总`;

    const response = await this.ask(prompt);

    try {
      // 从响应中提取 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return this.fallbackPlan(goal);
      }

      const parsed = JSON.parse(jsonMatch[0]) as TaskPlan;
      // 确保每个步骤都有 status
      parsed.steps = parsed.steps.map(step => ({
        ...step,
        status: 'pending' as const,
      }));
      return parsed;
    } catch {
      return this.fallbackPlan(goal);
    }
  }

  // 汇总所有 Agent 的结果
  async synthesize(goal: string, results: Record<string, string>): Promise<string> {
    const resultsSummary = Object.entries(results)
      .map(([agent, result]) => `### ${agent} 的输出:\n${result}`)
      .join('\n\n');

    const prompt = `请汇总以下各个 Agent 的工作成果，生成最终回复。

原始任务: ${goal}

各 Agent 的输出:
${resultsSummary}

请生成一个完整、连贯的最终报告，整合所有信息。使用清晰的 Markdown 格式。`;

    return this.ask(prompt);
  }

  protected async think(message: AgentMessage): Promise<string> {
    return this.ask(message.content);
  }

  private fallbackPlan(goal: string): TaskPlan {
    return {
      goal,
      steps: [
        {
          id: 'step1',
          description: `调研: ${goal}`,
          assignee: 'researcher',
          dependencies: [],
          status: 'pending',
        },
        {
          id: 'step2',
          description: `分析调研结果并给出结论`,
          assignee: 'analyst',
          dependencies: ['step1'],
          status: 'pending',
        },
      ],
    };
  }
}
