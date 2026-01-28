// Clawdbot - AI Agent Framework
// 主入口文件

import 'dotenv/config';
import { CLIAdapter } from './adapters/cli.js';
import { ModelOrchestrator } from './models/orchestrator.js';
import { SkillRegistry } from './skills/registry.js';
import { StockAnalysisSkill } from './skills/stock-analysis.js';
import type { UnifiedMessage, ConversationContext } from './types/index.js';

class Clawdbot {
  private adapter: CLIAdapter;
  private llm: ModelOrchestrator;
  private skills: SkillRegistry;
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

    // 设置消息处理器
    this.adapter.onMessage(this.handleMessage.bind(this));

    // 启动适配器
    await this.adapter.connect();
  }

  private async handleMessage(message: UnifiedMessage): Promise<string | null> {
    const text = message.content.text || '';

    // 保存到历史
    this.context.history.push(message);

    // 尝试匹配技能
    const skillMatch = this.skills.findMatch(text);

    if (skillMatch) {
      const result = await skillMatch.skill.execute(skillMatch.params, this.context);
      return result.response?.text || null;
    }

    // 没有匹配的技能，使用通用对话
    const response = await this.llm.chat(text, {
      systemPrompt: `你是 Clawdbot，一个智能助手。你可以：
- 分析股票（例如：分析比亚迪、看看茅台怎么样）
- 回答各种问题
- 进行日常对话

当前可用技能: ${this.skills.listSkills().join(', ')}

请用简洁、友好的中文回复。`,
    });

    return response;
  }
}

// 启动
const bot = new Clawdbot();
bot.start().catch(console.error);
