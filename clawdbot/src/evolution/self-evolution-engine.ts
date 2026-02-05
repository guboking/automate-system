// 自进化引擎 - 协调整个自进化流程

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import type { ModelOrchestrator } from '../models/orchestrator.js';
import type {
  CapabilityGap,
  GeneratedSkill,
  EvolutionEvent,
  EvolutionConfig,
  DEFAULT_EVOLUTION_CONFIG,
} from '../types/evolution.js';
import { SkillGenerator } from './skill-generator.js';
import { SkillCompiler } from './skill-compiler.js';
import { SkillValidator } from './skill-validator.js';
import { SkillRepository } from './skill-repository.js';

/**
 * 自进化引擎 - AI智能体的自我进化核心
 *
 * 功能：
 * 1. 监控Agent执行，识别能力缺口
 * 2. 自动生成新的Skills填补缺口
 * 3. 验证和测试生成的Skills
 * 4. 部署和管理Skills生命周期
 * 5. 自我修复失败的Skills
 */
export class SelfEvolutionEngine extends EventEmitter {
  private llm: ModelOrchestrator;
  private config: EvolutionConfig;

  private generator: SkillGenerator;
  private compiler: SkillCompiler;
  private validator: SkillValidator;
  private repository: SkillRepository;

  // 状态追踪
  private pendingGaps: Map<string, CapabilityGap> = new Map();
  private evolutionHistory: EvolutionEvent[] = [];
  private isEvolving: boolean = false;

  constructor(
    llm: ModelOrchestrator,
    config: Partial<EvolutionConfig> = {}
  ) {
    super();
    this.llm = llm;

    // 合并默认配置
    this.config = {
      autoEvolve: config.autoEvolve ?? true,
      generation: { ...getDefaultConfig().generation, ...config.generation },
      validation: { ...getDefaultConfig().validation, ...config.validation },
      deployment: { ...getDefaultConfig().deployment, ...config.deployment },
      repository: { ...getDefaultConfig().repository, ...config.repository },
      security: { ...getDefaultConfig().security, ...config.security },
    };

    // 初始化组件
    this.generator = new SkillGenerator(llm, this.config);
    this.compiler = new SkillCompiler(llm, this.config);
    this.validator = new SkillValidator(llm, this.config);
    this.repository = new SkillRepository(this.config.repository.path);
  }

  /**
   * 初始化引擎
   */
  async initialize(): Promise<void> {
    await this.repository.initialize();
    this.logEvent('engine_initialized', {
      action: 'initialize',
      result: 'success',
    });
    console.log('🧬 自进化引擎已初始化');
  }

  /**
   * 报告执行失败 - 触发能力缺口分析
   */
  async reportFailure(
    userRequest: string,
    attemptedActions: string[],
    failureReason: string,
    existingSkills: string[]
  ): Promise<CapabilityGap | null> {
    if (!this.config.autoEvolve) {
      return null;
    }

    console.log('🔍 分析能力缺口...');

    const gap = await this.generator.analyzeCapabilityGap(
      userRequest,
      attemptedActions,
      failureReason,
      existingSkills
    );

    if (gap) {
      this.pendingGaps.set(gap.id, gap);
      this.logEvent('gap_identified', {
        gap,
        action: 'identify',
        result: 'success',
      });

      console.log(`💡 发现能力缺口: ${gap.requiredCapability.description}`);

      // 如果配置了自动进化，立即开始生成
      if (this.config.autoEvolve) {
        this.evolveSkill(gap.id).catch(console.error);
      }
    }

    return gap;
  }

  /**
   * 进化新技能 - 完整的生成、验证、部署流程
   */
  async evolveSkill(gapId: string): Promise<GeneratedSkill | null> {
    const gap = this.pendingGaps.get(gapId);
    if (!gap) {
      throw new Error(`Gap not found: ${gapId}`);
    }

    if (this.isEvolving) {
      console.log('⏳ 进化引擎正忙，请稍后...');
      return null;
    }

    this.isEvolving = true;
    gap.status = 'generating';

    try {
      console.log(`🧪 开始生成技能: ${gap.requiredCapability.description}`);

      // 1. 生成Skill
      this.logEvent('generation_started', { gap, action: 'generate', result: 'success' });
      const skill = await this.generator.generateSkill(gap);

      // 2. 验证Skill
      console.log('🔬 验证生成的技能...');
      this.logEvent('validation_started', { skill, action: 'validate', result: 'success' });

      const validatedSkill = await this.validator.validate(skill);

      if (validatedSkill.validation.status !== 'passed') {
        // 尝试修复
        console.log('🔧 验证失败，尝试修复...');

        const errors = this.collectValidationErrors(validatedSkill);
        const repairedSkill = await this.generator.repairSkill(validatedSkill, errors);

        // 再次验证
        const revalidatedSkill = await this.validator.validate(repairedSkill);

        if (revalidatedSkill.validation.status !== 'passed') {
          this.logEvent('validation_failed', {
            skill: revalidatedSkill,
            action: 'validate',
            result: 'failure',
            error: '修复后仍未通过验证',
          });

          gap.status = 'failed';
          console.log('❌ 技能生成失败');
          return null;
        }

        Object.assign(skill, revalidatedSkill);
      }

      this.logEvent('validation_passed', { skill, action: 'validate', result: 'success' });

      // 3. 部署Skill
      if (this.config.deployment.autoApprove || !this.config.security.requireReview) {
        await this.deploySkill(skill);
        gap.status = 'resolved';
        console.log(`✅ 新技能已部署: ${skill.template.name}`);
      } else {
        skill.status = 'validated';
        console.log(`📋 技能已验证，等待人工审核: ${skill.template.name}`);
      }

      // 4. 保存到仓库
      await this.repository.add(skill);
      this.pendingGaps.delete(gapId);

      return skill;
    } catch (error) {
      gap.status = 'failed';
      this.logEvent('generation_completed', {
        gap,
        action: 'generate',
        result: 'failure',
        error: String(error),
      });
      console.error('❌ 技能生成异常:', error);
      return null;
    } finally {
      this.isEvolving = false;
    }
  }

  /**
   * 部署技能
   */
  async deploySkill(skill: GeneratedSkill): Promise<void> {
    skill.status = 'deployed';

    // 保存到文件系统
    const paths = await this.compiler.saveSkill(skill, this.config.repository.path);

    // 更新仓库
    await this.repository.updateEntry(skill.id, {
      paths,
      enabled: true,
      loadState: 'unloaded',
    });

    this.logEvent('skill_deployed', {
      skill,
      action: 'deploy',
      result: 'success',
    });

    // 发出部署事件
    this.emit('skill-deployed', skill);

    if (this.config.deployment.notifyOnDeploy) {
      console.log(`📦 技能 ${skill.template.name} 已部署到 ${paths.typescriptPath}`);
    }
  }

  /**
   * 手动创建技能（从用户描述）
   */
  async createSkillFromDescription(description: string): Promise<GeneratedSkill | null> {
    const gap: CapabilityGap = {
      id: randomUUID(),
      timestamp: new Date(),
      context: {
        userRequest: description,
        attemptedActions: [],
        failureReason: '用户主动请求创建新技能',
      },
      requiredCapability: {
        description,
        category: 'utility',
        complexity: 'medium',
      },
      status: 'identified',
    };

    this.pendingGaps.set(gap.id, gap);
    return this.evolveSkill(gap.id);
  }

  /**
   * 从Markdown文件加载技能
   */
  async loadSkillFromMarkdown(markdownPath: string): Promise<GeneratedSkill> {
    const skill = await this.compiler.compileFromMarkdown(markdownPath);
    const validatedSkill = await this.validator.validate(skill);

    if (validatedSkill.validation.status === 'passed') {
      await this.deploySkill(validatedSkill);
    }

    return validatedSkill;
  }

  /**
   * 获取所有已部署的技能
   */
  async getDeployedSkills(): Promise<GeneratedSkill[]> {
    const entries = await this.repository.list();
    return entries
      .filter(e => e.enabled)
      .map(e => ({
        id: e.id,
        template: e.template,
        code: { typescript: '' },
        generation: {
          timestamp: e.stats.createdAt,
          model: '',
          prompt: '',
          iterations: 0,
        },
        validation: {
          status: 'passed' as const,
          syntaxValid: true,
          typeCheckPassed: true,
          testResults: [],
          securityReview: { passed: true, risks: [], recommendations: [] },
        },
        status: 'deployed' as const,
      }));
  }

  /**
   * 获取待处理的能力缺口
   */
  getPendingGaps(): CapabilityGap[] {
    return Array.from(this.pendingGaps.values());
  }

  /**
   * 获取进化历史
   */
  getEvolutionHistory(): EvolutionEvent[] {
    return [...this.evolutionHistory];
  }

  /**
   * 弃用技能
   */
  async deprecateSkill(skillId: string): Promise<void> {
    await this.repository.deprecate(skillId);
    this.logEvent('skill_deprecated', {
      action: 'deprecate',
      result: 'success',
    });
  }

  /**
   * 收集验证错误
   */
  private collectValidationErrors(skill: GeneratedSkill): string {
    const errors: string[] = [];

    if (!skill.validation.syntaxValid) {
      errors.push('语法验证失败');
    }

    if (!skill.validation.typeCheckPassed) {
      errors.push('类型检查失败');
    }

    if (!skill.validation.securityReview.passed) {
      errors.push('安全审查未通过');
      for (const risk of skill.validation.securityReview.risks) {
        errors.push(`- ${risk.severity}: ${risk.description}`);
      }
    }

    const failedTests = skill.validation.testResults.filter(t => !t.passed);
    if (failedTests.length > 0) {
      errors.push(`${failedTests.length}个测试失败`);
      for (const test of failedTests) {
        errors.push(`- ${test.testCaseId}: ${test.error || '未通过'}`);
      }
    }

    return errors.join('\n');
  }

  /**
   * 记录进化事件
   */
  private logEvent(
    type: EvolutionEvent['type'],
    details: Partial<EvolutionEvent['details']>
  ): void {
    const event: EvolutionEvent = {
      id: randomUUID(),
      timestamp: new Date(),
      type,
      details: {
        action: details.action || type,
        result: details.result || 'success',
        ...details,
      },
    };

    this.evolutionHistory.push(event);
    this.emit('evolution-event', event);

    // 保持历史记录在合理范围内
    if (this.evolutionHistory.length > 1000) {
      this.evolutionHistory = this.evolutionHistory.slice(-500);
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalSkills: number;
    pendingGaps: number;
    evolutionEvents: number;
    successRate: number;
  } {
    const successEvents = this.evolutionHistory.filter(
      e => e.details.result === 'success' && e.type === 'skill_deployed'
    ).length;

    const totalAttempts = this.evolutionHistory.filter(
      e => e.type === 'generation_started'
    ).length;

    return {
      totalSkills: this.repository.count(),
      pendingGaps: this.pendingGaps.size,
      evolutionEvents: this.evolutionHistory.length,
      successRate: totalAttempts > 0 ? successEvents / totalAttempts : 0,
    };
  }
}

/**
 * 获取默认配置（避免循环依赖）
 */
function getDefaultConfig(): EvolutionConfig {
  return {
    autoEvolve: true,
    generation: {
      model: 'claude-sonnet-4-20250514',
      maxIterations: 3,
      timeout: 120000,
    },
    validation: {
      runTests: true,
      typeCheck: true,
      securityReview: true,
      minTestCoverage: 0.8,
    },
    deployment: {
      autoApprove: false,
      sandboxFirst: true,
      notifyOnDeploy: true,
    },
    repository: {
      path: './evolved_skills',
      maxSkills: 100,
      cleanupOldVersions: true,
    },
    security: {
      allowedPermissions: ['file:read', 'file:write', 'network:http'] as any[],
      blockedPatterns: ['eval\\(', 'Function\\(', 'child_process'],
      requireReview: true,
    },
  };
}
