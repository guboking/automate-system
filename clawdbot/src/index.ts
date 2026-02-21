// Clawdbot - AI Agent Framework
// 主入口文件

import 'dotenv/config';
import { CLIAdapter } from './adapters/cli.js';
import { ModelOrchestrator } from './models/orchestrator.js';
import { SkillRegistry } from './skills/registry.js';
import { StockAnalysisSkill } from './skills/stock-analysis.js';
import { TeamAgent, type TeamConfig } from './agents/team.js';
import { STOCK_ANALYSIS_TEAM, RESEARCH_TEAM, DEBATE_TEAM } from './agents/roles.js';
import type { UnifiedMessage, ConversationContext } from './types/index.js';

class Clawdbot {
  private adapter: CLIAdapter;
  private llm: ModelOrchestrator;
  private skills: SkillRegistry;
  private teams: Map<string, TeamAgent> = new Map();
  private context: ConversationContext;

  constructor() {
    // 初始化模型层
    this.llm = new ModelOrchestrator();

    // 初始化技能注册表
    this.skills = new SkillRegistry(this.llm);

    // 初始化 CLI 适配器
    this.adapter = new CLIAdapter();

    // 初始化会话上下文
    this.context = {
      sessionId: `session-${Date.now()}`,
      userId: 'local-user',
      platform: 'cli',
      history: [],
      variables: {},
    };
  }

  async start(): Promise<void> {
    // 注册技能
    await this.skills.register(new StockAnalysisSkill());

    // 注册预设团队
    this.registerTeam(STOCK_ANALYSIS_TEAM);
    this.registerTeam(RESEARCH_TEAM);
    this.registerTeam(DEBATE_TEAM);

    // 设置消息处理器
    this.adapter.onMessage(this.handleMessage.bind(this));

    // 启动适配器
    await this.adapter.connect();
  }

  registerTeam(config: TeamConfig): void {
    const team = new TeamAgent(config, this.llm);
    this.teams.set(config.name, team);
    console.log(`Team registered: ${config.name} [${config.strategy}] - ${team.listAgents().join(', ')}`);
  }

  private async handleMessage(message: UnifiedMessage): Promise<string | null> {
    const text = message.content.text || '';

    // 保存到历史
    this.context.history.push(message);

    // 团队命令: /team <团队名> <任务>
    if (text.startsWith('/team')) {
      return this.handleTeamCommand(text);
    }

    // 列出团队: /teams
    if (text === '/teams') {
      return this.listTeams();
    }

    // 深度分析触发: "深度分析 XXX" 或 "团队分析 XXX"
    const teamAnalysisMatch = text.match(/^(?:深度分析|团队分析)\s+(.+)/);
    if (teamAnalysisMatch) {
      const task = teamAnalysisMatch[1];
      const team = this.teams.get('股票分析团队');
      if (team) {
        const result = await team.execute(`请深度分析: ${task}`);
        return this.formatTeamResult(result);
      }
    }

    // 辩论分析触发: "辩论分析 XXX"
    const debateMatch = text.match(/^辩论分析\s+(.+)/);
    if (debateMatch) {
      const task = debateMatch[1];
      const team = this.teams.get('辩论分析团队');
      if (team) {
        const result = await team.execute(`请从多角度分析: ${task}`);
        return this.formatTeamResult(result);
      }
    }

    // 尝试匹配技能
    const skillMatch = this.skills.findMatch(text);

    if (skillMatch) {
      const result = await skillMatch.skill.execute(skillMatch.params, this.context);
      return result.response?.text || null;
    }

    // 没有匹配的技能，使用通用对话
    const teamList = Array.from(this.teams.keys()).join(', ');
    const response = await this.llm.chat(text, {
      systemPrompt: `你是 Clawdbot，一个智能助手。你可以：
- 分析股票（例如：分析比亚迪、看看茅台怎么样）
- 深度分析（例如：深度分析 比亚迪）- 多 Agent 团队协作分析
- 辩论分析（例如：辩论分析 新能源行业前景）- 多角度辩论式分析
- /teams - 查看可用团队
- /team <团队名> <任务> - 指定团队执行任务
- 回答各种问题
- 进行日常对话

当前可用技能: ${this.skills.listSkills().join(', ')}
当前可用团队: ${teamList}

请用简洁、友好的中文回复。`,
    });

    return response;
  }

  private async handleTeamCommand(text: string): Promise<string> {
    const parts = text.replace('/team', '').trim().split(/\s+/);
    const teamName = parts[0];
    const task = parts.slice(1).join(' ');

    if (!teamName) {
      return `请指定团队名称。可用团队: ${Array.from(this.teams.keys()).join(', ')}`;
    }

    const team = this.teams.get(teamName);
    if (!team) {
      return `未找到团队「${teamName}」。可用团队: ${Array.from(this.teams.keys()).join(', ')}`;
    }

    if (!task) {
      return `请提供任务内容。用法: /team ${teamName} <任务描述>`;
    }

    const result = await team.execute(task);
    return this.formatTeamResult(result);
  }

  private listTeams(): string {
    const lines = ['📋 **可用团队列表**\n'];
    for (const [name, team] of this.teams) {
      lines.push(`**${name}** [${team.config.strategy}]`);
      lines.push(`  ${team.config.description}`);
      lines.push(`  成员: ${team.listAgents().join(', ')}`);
      lines.push('');
    }
    lines.push('---');
    lines.push('用法: `/team <团队名> <任务>` 或 `深度分析 <主题>` 或 `辩论分析 <主题>`');
    return lines.join('\n');
  }

  private formatTeamResult(result: import('./agents/team.js').TeamResult): string {
    const lines = [
      `🤝 **${result.team}** 分析完成 [${result.strategy}模式, ${result.rounds}轮]`,
      '',
      result.finalOutput,
      '',
      '---',
      `📌 参与 Agent: ${result.agentResults.map(r => r.agent).filter((v, i, a) => a.indexOf(v) === i).join(', ')}`,
    ];
    return lines.join('\n');
  }
}

// 启动
const bot = new Clawdbot();
bot.start().catch(console.error);
