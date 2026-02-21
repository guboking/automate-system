// Agent Team - 多 Agent 协作编排器

import type { ModelOrchestrator } from '../models/orchestrator.js';
import type { AgentMessage, TaskPlan, TaskStep, TeamResult } from '../types/agent.js';
import type { BaseAgent } from './base.js';
import { CoordinatorAgent } from './coordinator.js';
import { ResearcherAgent } from './researcher.js';
import { AnalystAgent } from './analyst.js';

export class AgentTeam {
  private agents: Map<string, BaseAgent> = new Map();
  private coordinator: CoordinatorAgent;
  private llm: ModelOrchestrator;
  private maxRounds: number;
  private log: AgentMessage[] = [];

  constructor(llm: ModelOrchestrator, maxRounds = 10) {
    this.llm = llm;
    this.maxRounds = maxRounds;

    // 初始化协调者
    this.coordinator = new CoordinatorAgent();
    this.coordinator.injectDependencies(llm);

    // 注册默认 Agent
    this.registerAgent(new ResearcherAgent());
    this.registerAgent(new AnalystAgent());
  }

  registerAgent(agent: BaseAgent): void {
    agent.injectDependencies(this.llm);
    this.agents.set(agent.profile.role, agent);
    console.log(`Agent registered: ${agent.profile.name} (${agent.profile.role})`);
  }

  getAgent(role: string): BaseAgent | undefined {
    return this.agents.get(role);
  }

  listAgents(): string[] {
    return Array.from(this.agents.entries()).map(
      ([role, agent]) => `${agent.profile.name} (${role})`
    );
  }

  // 执行团队任务
  async execute(goal: string): Promise<TeamResult> {
    console.log(`\n🏁 Team task: ${goal}`);
    this.resetAll();

    const agentOutputs: Record<string, string> = {};
    let rounds = 0;

    try {
      // 1. 协调者分解任务
      const availableRoles = Array.from(this.agents.keys());
      console.log(`📋 Planning with roles: ${availableRoles.join(', ')}`);

      const plan = await this.coordinator.planTask(goal, availableRoles);
      console.log(`📋 Plan: ${plan.steps.length} steps`);

      // 2. 按依赖顺序执行步骤
      while (this.hasPendingSteps(plan) && rounds < this.maxRounds) {
        rounds++;
        const readySteps = this.getReadySteps(plan);

        if (readySteps.length === 0) {
          break; // 无法继续（循环依赖或全部完成）
        }

        // 并行执行没有依赖冲突的步骤
        const results = await Promise.all(
          readySteps.map(step => this.executeStep(step, plan, agentOutputs))
        );

        // 记录结果
        for (let i = 0; i < readySteps.length; i++) {
          const step = readySteps[i];
          const result = results[i];
          step.result = result;
          step.status = 'done';
          agentOutputs[`${step.assignee}:${step.id}`] = result;
          console.log(`  ✅ ${step.id}: ${step.description.slice(0, 50)}`);
        }
      }

      // 3. 协调者汇总结果
      console.log(`📝 Synthesizing results...`);
      const finalOutput = await this.coordinator.synthesize(goal, agentOutputs);

      return {
        success: true,
        goal,
        output: finalOutput,
        agentOutputs,
        rounds,
      };
    } catch (error) {
      return {
        success: false,
        goal,
        output: '',
        agentOutputs,
        rounds,
        error: (error as Error).message,
      };
    }
  }

  private async executeStep(
    step: TaskStep,
    plan: TaskPlan,
    previousResults: Record<string, string>
  ): Promise<string> {
    const agent = this.agents.get(step.assignee);
    if (!agent) {
      return `[错误] 找不到角色为 ${step.assignee} 的 Agent`;
    }

    step.status = 'running';

    // 构建上下文：包含依赖步骤的结果
    const depContext = step.dependencies
      .map(depId => {
        const depStep = plan.steps.find(s => s.id === depId);
        if (!depStep) return '';
        const key = `${depStep.assignee}:${depStep.id}`;
        return previousResults[key]
          ? `[${depStep.description}]:\n${previousResults[key]}`
          : '';
      })
      .filter(Boolean)
      .join('\n\n');

    const taskContent = depContext
      ? `任务: ${step.description}\n\n参考信息:\n${depContext}`
      : `任务: ${step.description}`;

    const message: AgentMessage = {
      from: 'coordinator',
      to: agent.profile.id,
      type: 'task',
      content: taskContent,
      timestamp: new Date(),
    };

    this.log.push(message);
    const response = await agent.handleMessage(message);
    this.log.push(response);

    return response.content;
  }

  private hasPendingSteps(plan: TaskPlan): boolean {
    return plan.steps.some(s => s.status === 'pending');
  }

  private getReadySteps(plan: TaskPlan): TaskStep[] {
    return plan.steps.filter(step => {
      if (step.status !== 'pending') return false;
      // 检查所有依赖是否已完成
      return step.dependencies.every(depId => {
        const dep = plan.steps.find(s => s.id === depId);
        return dep && dep.status === 'done';
      });
    });
  }

  private resetAll(): void {
    this.coordinator.reset();
    for (const agent of this.agents.values()) {
      agent.reset();
    }
    this.log = [];
  }
}
