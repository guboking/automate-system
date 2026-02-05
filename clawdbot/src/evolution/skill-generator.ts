// Skill生成器 - 根据能力缺口自动生成新的Skill

import { randomUUID } from 'crypto';
import type { ModelOrchestrator } from '../models/orchestrator.js';
import type {
  CapabilityGap,
  SkillTemplate,
  GeneratedSkill,
  LogicStep,
  TestCase,
  EvolutionConfig,
} from '../types/evolution.js';
import { Permission } from '../types/skill.js';

/**
 * Skill生成器 - 使用LLM自动生成新技能
 */
export class SkillGenerator {
  private llm: ModelOrchestrator;
  private config: EvolutionConfig;

  constructor(llm: ModelOrchestrator, config: EvolutionConfig) {
    this.llm = llm;
    this.config = config;
  }

  /**
   * 分析用户请求，识别是否存在能力缺口
   */
  async analyzeCapabilityGap(
    userRequest: string,
    attemptedActions: string[],
    failureReason: string,
    existingSkills: string[]
  ): Promise<CapabilityGap | null> {
    const analysisPrompt = `
你是一个AI能力分析专家。分析以下情况，判断是否存在能力缺口。

## 用户请求
${userRequest}

## 已尝试的操作
${attemptedActions.map((a, i) => `${i + 1}. ${a}`).join('\n')}

## 失败原因
${failureReason}

## 现有技能
${existingSkills.join(', ') || '无'}

## 分析要求
1. 判断是否需要新的技能来完成此任务
2. 如果需要，描述需要什么能力
3. 评估实现复杂度

请以JSON格式返回分析结果：
\`\`\`json
{
  "needsNewSkill": true/false,
  "description": "需要的能力描述",
  "category": "data-analysis|web-scraping|api-integration|file-processing|automation|code-generation|communication|security|utility|domain-specific",
  "suggestedTools": ["工具1", "工具2"],
  "complexity": "low|medium|high",
  "reasoning": "分析原因"
}
\`\`\`

只返回JSON，不要其他内容。
`;

    try {
      const response = await this.llm.chat(analysisPrompt, {
        model: this.config.generation.model,
        temperature: 0.3,
      });

      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (!jsonMatch) return null;

      const analysis = JSON.parse(jsonMatch[1]);

      if (!analysis.needsNewSkill) return null;

      return {
        id: randomUUID(),
        timestamp: new Date(),
        context: {
          userRequest,
          attemptedActions,
          failureReason,
        },
        requiredCapability: {
          description: analysis.description,
          category: analysis.category,
          suggestedTools: analysis.suggestedTools,
          complexity: analysis.complexity,
        },
        status: 'identified',
      };
    } catch (error) {
      console.error('分析能力缺口失败:', error);
      return null;
    }
  }

  /**
   * 根据能力缺口生成Skill模板
   */
  async generateSkillTemplate(gap: CapabilityGap): Promise<SkillTemplate> {
    const templatePrompt = `
你是一个专业的AI Skill设计师。根据以下能力需求，设计一个完整的Skill模板。

## 能力需求
- 描述: ${gap.requiredCapability.description}
- 类别: ${gap.requiredCapability.category}
- 复杂度: ${gap.requiredCapability.complexity}
- 建议工具: ${gap.requiredCapability.suggestedTools?.join(', ') || '无'}

## 原始请求上下文
- 用户请求: ${gap.context.userRequest}
- 失败原因: ${gap.context.failureReason}

## Skill模板要求

请设计一个JSON格式的Skill模板，包含：

1. **基本信息**: name, version, description, author, category
2. **触发器**: 正则表达式模式、意图描述、命令格式、示例输入
3. **权限**: 需要的系统权限（file:read, file:write, network:http等）
4. **执行逻辑**: 分步骤的执行流程
5. **错误处理**: 常见错误的处理策略
6. **测试用例**: 至少3个测试用例

返回格式：
\`\`\`json
{
  "name": "skill-name",
  "version": "1.0.0",
  "description": "技能描述",
  "author": "self-evolution-engine",
  "category": "${gap.requiredCapability.category}",
  "triggers": {
    "patterns": ["正则表达式1", "正则表达式2"],
    "intents": ["意图1", "意图2"],
    "commands": ["/command1", "/command2"],
    "examples": ["示例输入1", "示例输入2"]
  },
  "permissions": ["file:read", "network:http"],
  "logic": {
    "steps": [
      {
        "id": "step1",
        "description": "步骤描述",
        "action": "操作类型",
        "params": {},
        "onSuccess": "step2",
        "onFailure": "error1"
      }
    ],
    "errorHandling": [
      {
        "errorType": "NetworkError",
        "action": "retry",
        "maxRetries": 3,
        "message": "网络错误，正在重试..."
      }
    ]
  },
  "dependencies": {
    "skills": [],
    "tools": [],
    "apis": []
  },
  "testCases": [
    {
      "id": "test1",
      "name": "测试名称",
      "input": "测试输入",
      "expectedBehavior": "预期行为描述",
      "tags": ["basic"]
    }
  ]
}
\`\`\`

只返回JSON，确保语法正确。
`;

    const response = await this.llm.chat(templatePrompt, {
      model: this.config.generation.model,
      temperature: 0.5,
      maxTokens: 4000,
    });

    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (!jsonMatch) {
      throw new Error('无法解析Skill模板');
    }

    const template = JSON.parse(jsonMatch[1]) as SkillTemplate;

    // 验证并规范化模板
    return this.normalizeTemplate(template);
  }

  /**
   * 根据模板生成TypeScript代码
   */
  async generateSkillCode(template: SkillTemplate): Promise<string> {
    const codePrompt = `
你是一个专业的TypeScript开发者。根据以下Skill模板生成完整的TypeScript代码。

## Skill模板
\`\`\`json
${JSON.stringify(template, null, 2)}
\`\`\`

## 基类参考
\`\`\`typescript
import type { SkillManifest, SkillResult, ConversationContext } from '../types/index.js';
import type { ModelOrchestrator } from '../models/orchestrator.js';

export abstract class BaseSkill {
  abstract manifest: SkillManifest;
  protected llm!: ModelOrchestrator;

  injectDependencies(llm: ModelOrchestrator): void {
    this.llm = llm;
  }

  async onLoad(): Promise<void> {}
  async onUnload(): Promise<void> {}

  abstract execute(params: Record<string, unknown>, context: ConversationContext): Promise<SkillResult>;

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
\`\`\`

## 代码要求
1. 继承BaseSkill类
2. 实现manifest属性
3. 实现execute方法，包含完整的业务逻辑
4. 包含错误处理
5. 使用this.llm进行AI调用
6. 添加适当的注释
7. 代码必须是有效的TypeScript

返回完整的TypeScript代码文件，用代码块包裹：
\`\`\`typescript
// 代码内容
\`\`\`

只返回代码，不要其他解释。
`;

    const response = await this.llm.chat(codePrompt, {
      model: this.config.generation.model,
      temperature: 0.3,
      maxTokens: 8000,
    });

    const codeMatch = response.match(/```typescript\s*([\s\S]*?)\s*```/);
    if (!codeMatch) {
      throw new Error('无法解析生成的代码');
    }

    return codeMatch[1].trim();
  }

  /**
   * 完整的Skill生成流程
   */
  async generateSkill(gap: CapabilityGap): Promise<GeneratedSkill> {
    const skillId = randomUUID();
    let iterations = 0;

    // 1. 生成模板
    const template = await this.generateSkillTemplate(gap);

    // 2. 生成代码（带重试）
    let code = '';
    let lastError: Error | null = null;

    while (iterations < this.config.generation.maxIterations) {
      iterations++;
      try {
        code = await this.generateSkillCode(template);

        // 基础语法检查
        if (this.basicSyntaxCheck(code)) {
          break;
        }
      } catch (error) {
        lastError = error as Error;
        console.log(`生成迭代 ${iterations} 失败，重试中...`);
      }
    }

    if (!code) {
      throw lastError || new Error('代码生成失败');
    }

    // 3. 构建GeneratedSkill对象
    const generatedSkill: GeneratedSkill = {
      id: skillId,
      template,
      code: {
        typescript: code,
      },
      generation: {
        timestamp: new Date(),
        model: this.config.generation.model,
        prompt: `Gap: ${gap.requiredCapability.description}`,
        iterations,
      },
      validation: {
        status: 'pending',
        syntaxValid: false,
        typeCheckPassed: false,
        testResults: [],
        securityReview: {
          passed: false,
          risks: [],
          recommendations: [],
        },
      },
      status: 'draft',
    };

    return generatedSkill;
  }

  /**
   * 修复失败的Skill
   */
  async repairSkill(
    skill: GeneratedSkill,
    errorMessage: string
  ): Promise<GeneratedSkill> {
    const repairPrompt = `
你是一个TypeScript专家。以下代码有问题，请修复它。

## 当前代码
\`\`\`typescript
${skill.code.typescript}
\`\`\`

## 错误信息
${errorMessage}

## Skill模板参考
\`\`\`json
${JSON.stringify(skill.template, null, 2)}
\`\`\`

请修复代码并返回完整的修复后版本：
\`\`\`typescript
// 修复后的代码
\`\`\`

只返回代码，不要解释。
`;

    const response = await this.llm.chat(repairPrompt, {
      model: this.config.generation.model,
      temperature: 0.2,
      maxTokens: 8000,
    });

    const codeMatch = response.match(/```typescript\s*([\s\S]*?)\s*```/);
    if (!codeMatch) {
      throw new Error('无法解析修复后的代码');
    }

    skill.code.typescript = codeMatch[1].trim();
    skill.generation.iterations++;

    return skill;
  }

  /**
   * 基础语法检查
   */
  private basicSyntaxCheck(code: string): boolean {
    // 检查必要的结构
    const checks = [
      /class\s+\w+\s+extends\s+BaseSkill/,
      /manifest\s*[:=]/,
      /async\s+execute\s*\(/,
      /export/,
    ];

    return checks.every((check) => check.test(code));
  }

  /**
   * 规范化模板
   */
  private normalizeTemplate(template: SkillTemplate): SkillTemplate {
    // 确保所有必要字段存在
    return {
      name: template.name || 'unnamed-skill',
      version: template.version || '1.0.0',
      description: template.description || '',
      author: template.author || 'self-evolution-engine',
      category: template.category || 'utility',
      triggers: {
        patterns: template.triggers?.patterns || [],
        intents: template.triggers?.intents || [],
        commands: template.triggers?.commands || [],
        examples: template.triggers?.examples || [],
      },
      permissions: (template.permissions || []).map((p) => {
        // 将字符串权限转换为枚举
        if (typeof p === 'string') {
          return p as Permission;
        }
        return p;
      }),
      logic: {
        steps: template.logic?.steps || [],
        errorHandling: template.logic?.errorHandling || [],
      },
      dependencies: {
        skills: template.dependencies?.skills || [],
        tools: template.dependencies?.tools || [],
        apis: template.dependencies?.apis || [],
      },
      testCases: template.testCases || [],
    };
  }
}
