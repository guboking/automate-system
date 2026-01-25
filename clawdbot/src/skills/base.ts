// 技能基类

import type { SkillManifest, SkillResult, ConversationContext } from '../types/index.js';
import type { ModelOrchestrator } from '../models/orchestrator.js';

export abstract class BaseSkill {
  abstract manifest: SkillManifest;

  // 框架注入的依赖
  protected llm!: ModelOrchestrator;

  // 注入依赖
  injectDependencies(llm: ModelOrchestrator): void {
    this.llm = llm;
  }

  // 生命周期钩子
  async onLoad(): Promise<void> {}
  async onUnload(): Promise<void> {}

  // 核心执行方法
  abstract execute(params: Record<string, unknown>, context: ConversationContext): Promise<SkillResult>;

  // 检查是否匹配触发条件
  matches(text: string): { matched: boolean; params: Record<string, unknown> } {
    for (const pattern of this.manifest.triggers.patterns) {
      const regex = new RegExp(pattern, 'i');
      const match = text.match(regex);
      if (match) {
        return {
          matched: true,
          params: {
            text,
            matches: match.slice(1),
            fullMatch: match[0],
          },
        };
      }
    }
    return { matched: false, params: {} };
  }
}
