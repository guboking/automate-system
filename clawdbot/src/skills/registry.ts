// 技能注册表 - 支持惰性加载

import type { BaseSkill } from './base.js';
import type { ModelOrchestrator } from '../models/orchestrator.js';
import type { SkillManifest } from '../types/skill.js';

/**
 * 惰性加载的Skill条目
 */
interface LazySkillEntry {
  manifest: SkillManifest;
  loader: () => Promise<BaseSkill>;
  instance?: BaseSkill;
  loadState: 'unloaded' | 'loading' | 'loaded' | 'error';
  lastError?: string;
}

/**
 * 技能注册表 - 支持即时注册和惰性加载
 */
export class SkillRegistry {
  private skills: Map<string, BaseSkill> = new Map();
  private lazySkills: Map<string, LazySkillEntry> = new Map();
  private llm: ModelOrchestrator;

  constructor(llm: ModelOrchestrator) {
    this.llm = llm;
  }

  /**
   * 立即注册技能（传统方式）
   */
  async register(skill: BaseSkill): Promise<void> {
    skill.injectDependencies(this.llm);
    await skill.onLoad();
    this.skills.set(skill.manifest.name, skill);
    console.log(`✅ Skill registered: ${skill.manifest.name} v${skill.manifest.version}`);
  }

  /**
   * 注册惰性加载的技能
   */
  registerLazy(manifest: SkillManifest, loader: () => Promise<BaseSkill>): void {
    this.lazySkills.set(manifest.name, {
      manifest,
      loader,
      loadState: 'unloaded',
    });
    console.log(`📋 Lazy skill registered: ${manifest.name} v${manifest.version}`);
  }

  /**
   * 加载惰性技能
   */
  async loadLazySkill(name: string): Promise<BaseSkill | null> {
    const entry = this.lazySkills.get(name);
    if (!entry) return null;

    // 已加载
    if (entry.instance && entry.loadState === 'loaded') {
      return entry.instance;
    }

    // 正在加载
    if (entry.loadState === 'loading') {
      // 等待加载完成
      await new Promise(resolve => setTimeout(resolve, 100));
      return entry.instance || null;
    }

    // 开始加载
    entry.loadState = 'loading';
    try {
      console.log(`⏳ Loading skill: ${name}...`);
      const skill = await entry.loader();
      skill.injectDependencies(this.llm);
      await skill.onLoad();

      entry.instance = skill;
      entry.loadState = 'loaded';

      // 移到已加载的技能中
      this.skills.set(name, skill);

      console.log(`✅ Skill loaded: ${name}`);
      return skill;
    } catch (error) {
      entry.loadState = 'error';
      entry.lastError = String(error);
      console.error(`❌ Failed to load skill ${name}:`, error);
      return null;
    }
  }

  /**
   * 卸载技能
   */
  async unregister(name: string): Promise<void> {
    const skill = this.skills.get(name);
    if (skill) {
      await skill.onUnload();
      this.skills.delete(name);
    }

    // 重置惰性加载状态
    const lazyEntry = this.lazySkills.get(name);
    if (lazyEntry) {
      lazyEntry.instance = undefined;
      lazyEntry.loadState = 'unloaded';
    }
  }

  /**
   * 获取已加载的技能
   */
  get(name: string): BaseSkill | undefined {
    return this.skills.get(name);
  }

  /**
   * 获取技能（自动加载惰性技能）
   */
  async getAsync(name: string): Promise<BaseSkill | undefined> {
    let skill = this.skills.get(name);
    if (skill) return skill;

    // 尝试加载惰性技能
    skill = await this.loadLazySkill(name) || undefined;
    return skill;
  }

  /**
   * 根据输入文本找到匹配的技能
   */
  findMatch(text: string): { skill: BaseSkill; params: Record<string, unknown> } | null {
    // 先检查已加载的技能
    for (const skill of this.skills.values()) {
      const result = skill.matches(text);
      if (result.matched) {
        return { skill, params: result.params };
      }
    }
    return null;
  }

  /**
   * 根据输入文本找到匹配的技能（包括惰性技能）
   */
  async findMatchAsync(text: string): Promise<{ skill: BaseSkill; params: Record<string, unknown> } | null> {
    // 先检查已加载的技能
    const immediateMatch = this.findMatch(text);
    if (immediateMatch) return immediateMatch;

    // 检查惰性技能的manifest
    for (const [name, entry] of this.lazySkills.entries()) {
      if (entry.loadState === 'loaded') continue; // 已检查过

      // 检查触发器
      for (const pattern of entry.manifest.triggers.patterns) {
        const regex = new RegExp(pattern, 'i');
        const match = text.match(regex);
        if (match) {
          // 加载技能
          const skill = await this.loadLazySkill(name);
          if (skill) {
            return {
              skill,
              params: {
                text,
                matches: match.slice(1),
                fullMatch: match[0],
              },
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * 列出所有技能（包括未加载的）
   */
  listSkills(): string[] {
    const loaded = Array.from(this.skills.keys());
    const lazy = Array.from(this.lazySkills.keys()).filter(n => !loaded.includes(n));
    return [...loaded, ...lazy];
  }

  /**
   * 列出已加载的技能
   */
  listLoadedSkills(): string[] {
    return Array.from(this.skills.keys());
  }

  /**
   * 列出惰性技能状态
   */
  listLazySkillsStatus(): Array<{ name: string; state: string; error?: string }> {
    return Array.from(this.lazySkills.entries()).map(([name, entry]) => ({
      name,
      state: entry.loadState,
      error: entry.lastError,
    }));
  }

  /**
   * 预加载所有惰性技能
   */
  async preloadAll(): Promise<void> {
    const promises = Array.from(this.lazySkills.keys()).map(name =>
      this.loadLazySkill(name).catch(e => {
        console.error(`Failed to preload ${name}:`, e);
      })
    );
    await Promise.all(promises);
  }

  /**
   * 获取技能数量统计
   */
  getStats(): { loaded: number; lazy: number; total: number } {
    return {
      loaded: this.skills.size,
      lazy: this.lazySkills.size,
      total: this.skills.size + Array.from(this.lazySkills.values())
        .filter(e => e.loadState !== 'loaded').length,
    };
  }
}
