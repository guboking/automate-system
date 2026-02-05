// Clawdbot - AI Agent Framework
// 主入口文件 - 集成自进化系统

import 'dotenv/config';
import { CLIAdapter } from './adapters/cli.js';
import { ModelOrchestrator } from './models/orchestrator.js';
import { SkillRegistry } from './skills/registry.js';
import { StockAnalysisSkill } from './skills/stock-analysis.js';
import { EvolutionSkill } from './skills/evolution-skill.js';
import { SelfEvolutionEngine } from './evolution/self-evolution-engine.js';
import type { UnifiedMessage, ConversationContext } from './types/index.js';

class Clawdbot {
  private adapter: CLIAdapter;
  private llm: ModelOrchestrator;
  private skills: SkillRegistry;
  private context: ConversationContext;
  private evolutionEngine: SelfEvolutionEngine;

  constructor() {
    // 初始化模型层
    this.llm = new ModelOrchestrator();

    // 初始化技能注册表
    this.skills = new SkillRegistry(this.llm);

    // 初始化自进化引擎
    this.evolutionEngine = new SelfEvolutionEngine(this.llm, {
      autoEvolve: true,
      deployment: {
        autoApprove: false,
        sandboxFirst: true,
        notifyOnDeploy: true,
      },
    });

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
    console.log('🤖 Clawdbot 启动中...\n');

    // 初始化自进化引擎
    await this.evolutionEngine.initialize();

    // 注册核心技能
    await this.skills.register(new StockAnalysisSkill());
    await this.skills.register(new EvolutionSkill());

    // 监听技能部署事件，自动注册新技能
    this.evolutionEngine.on('skill-deployed', async (skill) => {
      console.log(`\n🆕 新技能已部署: ${skill.template.name}`);
      // 可以在这里动态加载新生成的技能
    });

    // 设置消息处理器
    this.adapter.onMessage(this.handleMessage.bind(this));

    console.log('\n📋 可用技能:', this.skills.listSkills().join(', '));
    console.log('💡 输入 "/evolve help" 了解自进化系统\n');

    // 启动适配器
    await this.adapter.connect();
  }

  private async handleMessage(message: UnifiedMessage): Promise<string | null> {
    const text = message.content.text || '';

    // 保存到历史
    this.context.history.push(message);

    // 尝试匹配技能（包括惰性加载的技能）
    let skillMatch = this.skills.findMatch(text);

    // 如果没有立即匹配，尝试异步匹配（惰性加载）
    if (!skillMatch) {
      skillMatch = await this.skills.findMatchAsync(text);
    }

    if (skillMatch) {
      try {
        const result = await skillMatch.skill.execute(skillMatch.params, this.context);
        return result.response?.text || null;
      } catch (error) {
        // 技能执行失败，记录能力缺口
        await this.evolutionEngine.reportFailure(
          text,
          [`尝试执行技能: ${skillMatch.skill.manifest.name}`],
          String(error),
          this.skills.listSkills()
        );
        return `❌ 技能执行失败: ${error}\n\n系统已记录此问题，将尝试自动修复。`;
      }
    }

    // 没有匹配的技能，使用通用对话
    try {
      const response = await this.llm.chat(text, {
        systemPrompt: `你是 Clawdbot，一个支持自进化的智能助手。

## 核心能力
- 分析股票（例如：分析比亚迪、看看茅台怎么样）
- 自进化系统（/evolve 命令）- 可以自动创建新技能
- 回答各种问题
- 进行日常对话

## 当前可用技能
${this.skills.listSkills().join(', ')}

## 自进化系统
如果用户需要的功能不存在，可以建议使用 "/evolve <功能描述>" 来创建新技能。

请用简洁、友好的中文回复。`,
      });

      return response;
    } catch (error) {
      // LLM调用失败，记录能力缺口
      await this.evolutionEngine.reportFailure(
        text,
        ['尝试使用LLM进行通用对话'],
        String(error),
        this.skills.listSkills()
      );
      return `❌ 处理失败: ${error}`;
    }
  }
}

// 启动
const bot = new Clawdbot();
bot.start().catch(console.error);
