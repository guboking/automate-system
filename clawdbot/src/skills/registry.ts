// 技能注册表

import type { BaseSkill } from './base.js';
import type { ModelOrchestrator } from '../models/orchestrator.js';

export class SkillRegistry {
  private skills: Map<string, BaseSkill> = new Map();
  private llm: ModelOrchestrator;

  constructor(llm: ModelOrchestrator) {
    this.llm = llm;
  }

  async register(skill: BaseSkill): Promise<void> {
    skill.injectDependencies(this.llm);
    await skill.onLoad();
    this.skills.set(skill.manifest.name, skill);
    console.log(`Skill registered: ${skill.manifest.name} v${skill.manifest.version}`);
  }

  async unregister(name: string): Promise<void> {
    const skill = this.skills.get(name);
    if (skill) {
      await skill.onUnload();
      this.skills.delete(name);
    }
  }

  get(name: string): BaseSkill | undefined {
    return this.skills.get(name);
  }

  // 根据输入文本找到匹配的技能
  findMatch(text: string): { skill: BaseSkill; params: Record<string, unknown> } | null {
    for (const skill of this.skills.values()) {
      const result = skill.matches(text);
      if (result.matched) {
        return { skill, params: result.params };
      }
    }
    return null;
  }

  listSkills(): string[] {
    return Array.from(this.skills.keys());
  }
}
