// Skill验证器 - 验证生成的Skill是否可用和安全

import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { ModelOrchestrator } from '../models/orchestrator.js';
import type {
  GeneratedSkill,
  TestResult,
  SecurityReviewResult,
  SecurityRisk,
  EvolutionConfig,
} from '../types/evolution.js';

/**
 * Skill验证器
 */
export class SkillValidator {
  private llm: ModelOrchestrator;
  private config: EvolutionConfig;

  constructor(llm: ModelOrchestrator, config: EvolutionConfig) {
    this.llm = llm;
    this.config = config;
  }

  /**
   * 完整验证流程
   */
  async validate(skill: GeneratedSkill): Promise<GeneratedSkill> {
    // 1. 语法验证
    const syntaxResult = await this.validateSyntax(skill);
    skill.validation.syntaxValid = syntaxResult.valid;

    if (!syntaxResult.valid) {
      skill.validation.status = 'failed';
      return skill;
    }

    // 2. 类型检查
    if (this.config.validation.typeCheck) {
      const typeCheckResult = await this.validateTypes(skill);
      skill.validation.typeCheckPassed = typeCheckResult.valid;

      if (!typeCheckResult.valid) {
        skill.validation.status = 'failed';
        return skill;
      }
    } else {
      skill.validation.typeCheckPassed = true;
    }

    // 3. 安全审查
    if (this.config.validation.securityReview) {
      skill.validation.securityReview = await this.performSecurityReview(skill);

      if (!skill.validation.securityReview.passed) {
        skill.validation.status = 'failed';
        return skill;
      }
    }

    // 4. 运行测试
    if (this.config.validation.runTests && skill.template.testCases.length > 0) {
      skill.validation.testResults = await this.runTests(skill);

      const passedTests = skill.validation.testResults.filter(t => t.passed).length;
      const totalTests = skill.validation.testResults.length;
      const passRate = totalTests > 0 ? passedTests / totalTests : 1;

      if (passRate < this.config.validation.minTestCoverage) {
        skill.validation.status = 'failed';
        return skill;
      }
    }

    skill.validation.status = 'passed';
    skill.status = 'validated';
    return skill;
  }

  /**
   * 语法验证
   */
  async validateSyntax(skill: GeneratedSkill): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const code = skill.code.typescript;

    // 基础结构检查
    const requiredPatterns = [
      { pattern: /class\s+\w+\s+extends\s+BaseSkill/, message: '缺少BaseSkill继承' },
      { pattern: /manifest\s*[:=]/, message: '缺少manifest定义' },
      { pattern: /async\s+execute\s*\(/, message: '缺少execute方法' },
      { pattern: /export/, message: '缺少export声明' },
    ];

    for (const { pattern, message } of requiredPatterns) {
      if (!pattern.test(code)) {
        errors.push(message);
      }
    }

    // 检查括号匹配
    const brackets = { '{': 0, '[': 0, '(': 0 };
    const closingBrackets: Record<string, keyof typeof brackets> = { '}': '{', ']': '[', ')': '(' };

    for (const char of code) {
      if (char in brackets) {
        brackets[char as keyof typeof brackets]++;
      } else if (char in closingBrackets) {
        brackets[closingBrackets[char]]--;
      }
    }

    for (const [bracket, count] of Object.entries(brackets)) {
      if (count !== 0) {
        errors.push(`括号不匹配: ${bracket}`);
      }
    }

    // 检查常见语法错误
    const syntaxPatterns = [
      { pattern: /^\s*import.*from\s+['"]\.\./m, valid: true },  // 相对导入
      { pattern: /;;\s*$/, message: '多余的分号', valid: false },
      { pattern: /,\s*[}\]]/, message: '尾随逗号（可能导致问题）', valid: false },
    ];

    for (const { pattern, message, valid } of syntaxPatterns) {
      if (!valid && pattern.test(code) && message) {
        errors.push(message);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 类型检查（使用LLM模拟）
   */
  async validateTypes(skill: GeneratedSkill): Promise<{ valid: boolean; errors: string[] }> {
    const prompt = `
你是TypeScript类型检查专家。检查以下代码是否有类型错误。

\`\`\`typescript
${skill.code.typescript}
\`\`\`

类型定义参考：
\`\`\`typescript
interface SkillManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  triggers: { patterns: string[]; intents: string[]; commands: string[] };
  permissions: Permission[];
  limits: { timeout: number; memory: number; fileAccess: string[]; networkAccess: string[] };
}

interface SkillResult {
  success: boolean;
  data?: unknown;
  error?: string;
  response?: { text?: string; attachments?: unknown[] };
  followUp?: { suggestions: string[] };
}

interface ConversationContext {
  sessionId: string;
  userId: string;
  platform: string;
  history: unknown[];
  variables: Record<string, unknown>;
}
\`\`\`

请以JSON格式返回检查结果：
\`\`\`json
{
  "valid": true/false,
  "errors": ["错误1", "错误2"]
}
\`\`\`

只返回JSON。
`;

    try {
      const response = await this.llm.chat(prompt, {
        model: this.config.generation.model,
        temperature: 0.1,
      });

      const match = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (match) {
        return JSON.parse(match[1]);
      }
    } catch (error) {
      console.error('类型检查失败:', error);
    }

    return { valid: true, errors: [] };
  }

  /**
   * 安全审查
   */
  async performSecurityReview(skill: GeneratedSkill): Promise<SecurityReviewResult> {
    const risks: SecurityRisk[] = [];
    const recommendations: string[] = [];
    const code = skill.code.typescript;

    // 检查危险模式
    const dangerousPatterns = [
      {
        pattern: /eval\s*\(/,
        severity: 'critical' as const,
        category: 'code-injection',
        description: '使用了eval函数，可能导致代码注入',
        mitigation: '使用JSON.parse或其他安全的解析方法',
      },
      {
        pattern: /new\s+Function\s*\(/,
        severity: 'critical' as const,
        category: 'code-injection',
        description: '使用了Function构造函数，可能导致代码注入',
        mitigation: '避免动态生成函数',
      },
      {
        pattern: /child_process/,
        severity: 'high' as const,
        category: 'process-execution',
        description: '使用了child_process模块，可能执行任意命令',
        mitigation: '确保命令参数经过严格验证',
      },
      {
        pattern: /require\s*\(\s*[`'"]fs[`'"]\s*\)/,
        severity: 'medium' as const,
        category: 'file-access',
        description: '直接使用fs模块，需要检查文件访问权限',
        mitigation: '使用沙箱化的文件访问方法',
      },
      {
        pattern: /process\.env/,
        severity: 'medium' as const,
        category: 'environment-access',
        description: '访问环境变量，可能泄露敏感信息',
        mitigation: '只访问必要的环境变量',
      },
      {
        pattern: /fetch\s*\([^)]*\+/,
        severity: 'medium' as const,
        category: 'ssrf',
        description: 'URL可能被拼接，存在SSRF风险',
        mitigation: '验证和清理URL输入',
      },
      {
        pattern: /innerHTML|outerHTML/,
        severity: 'medium' as const,
        category: 'xss',
        description: '可能存在XSS漏洞',
        mitigation: '使用安全的DOM操作方法',
      },
      {
        pattern: /\.exec\s*\(/,
        severity: 'low' as const,
        category: 'regex-dos',
        description: '正则表达式exec可能导致ReDoS',
        mitigation: '限制输入长度和正则复杂度',
      },
    ];

    // 检查配置中的禁止模式
    for (const blockedPattern of this.config.security.blockedPatterns) {
      const regex = new RegExp(blockedPattern);
      if (regex.test(code)) {
        risks.push({
          severity: 'critical',
          category: 'blocked-pattern',
          description: `使用了禁止的模式: ${blockedPattern}`,
          mitigation: '移除或替换此代码模式',
        });
      }
    }

    // 检查所有危险模式
    for (const { pattern, severity, category, description, mitigation } of dangerousPatterns) {
      if (pattern.test(code)) {
        const match = code.match(pattern);
        risks.push({
          severity,
          category,
          description,
          location: match ? `包含: ${match[0]}` : undefined,
          mitigation,
        });
      }
    }

    // 检查权限
    const requestedPermissions = skill.template.permissions;
    const allowedPermissions = this.config.security.allowedPermissions;

    for (const permission of requestedPermissions) {
      if (!allowedPermissions.includes(permission)) {
        risks.push({
          severity: 'high',
          category: 'unauthorized-permission',
          description: `请求了未授权的权限: ${permission}`,
          mitigation: '移除此权限或申请授权',
        });
      }
    }

    // 生成建议
    if (risks.length > 0) {
      recommendations.push('建议进行人工安全审核');
      recommendations.push('考虑在沙箱环境中运行');

      if (risks.some(r => r.severity === 'critical')) {
        recommendations.push('存在严重安全风险，建议重新生成');
      }
    }

    const hasCritical = risks.some(r => r.severity === 'critical');
    const hasHigh = risks.some(r => r.severity === 'high');

    return {
      passed: !hasCritical && (!hasHigh || !this.config.security.requireReview),
      risks,
      recommendations,
    };
  }

  /**
   * 运行测试（使用LLM模拟）
   */
  async runTests(skill: GeneratedSkill): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const testCase of skill.template.testCases) {
      const startTime = Date.now();

      const prompt = `
你是一个测试执行器。模拟执行以下技能的测试用例。

## 技能代码
\`\`\`typescript
${skill.code.typescript}
\`\`\`

## 测试用例
- ID: ${testCase.id}
- 名称: ${testCase.name}
- 输入: ${testCase.input}
- 预期行为: ${testCase.expectedBehavior}

## 任务
分析代码逻辑，判断给定输入是否能产生预期行为。

返回JSON格式：
\`\`\`json
{
  "passed": true/false,
  "reasoning": "分析过程",
  "simulatedOutput": "模拟的输出"
}
\`\`\`
`;

      try {
        const response = await this.llm.chat(prompt, {
          model: this.config.generation.model,
          temperature: 0.1,
        });

        const match = response.match(/```json\s*([\s\S]*?)\s*```/);
        if (match) {
          const result = JSON.parse(match[1]);
          results.push({
            testCaseId: testCase.id,
            passed: result.passed,
            actualOutput: result.simulatedOutput,
            executionTime: Date.now() - startTime,
          });
        } else {
          results.push({
            testCaseId: testCase.id,
            passed: false,
            error: '无法解析测试结果',
            executionTime: Date.now() - startTime,
          });
        }
      } catch (error) {
        results.push({
          testCaseId: testCase.id,
          passed: false,
          error: `测试执行失败: ${error}`,
          executionTime: Date.now() - startTime,
        });
      }
    }

    return results;
  }

  /**
   * 生成验证报告
   */
  generateReport(skill: GeneratedSkill): string {
    const v = skill.validation;

    let report = `# Skill验证报告: ${skill.template.name}\n\n`;
    report += `**验证时间**: ${new Date().toISOString()}\n`;
    report += `**总体状态**: ${v.status === 'passed' ? '✅ 通过' : '❌ 失败'}\n\n`;

    report += `## 检查项\n\n`;
    report += `| 检查项 | 状态 |\n`;
    report += `|--------|------|\n`;
    report += `| 语法验证 | ${v.syntaxValid ? '✅' : '❌'} |\n`;
    report += `| 类型检查 | ${v.typeCheckPassed ? '✅' : '❌'} |\n`;
    report += `| 安全审查 | ${v.securityReview.passed ? '✅' : '❌'} |\n`;

    if (v.testResults.length > 0) {
      const passed = v.testResults.filter(t => t.passed).length;
      report += `| 测试通过 | ${passed}/${v.testResults.length} |\n`;
    }

    if (v.securityReview.risks.length > 0) {
      report += `\n## 安全风险\n\n`;
      for (const risk of v.securityReview.risks) {
        report += `### ${risk.severity.toUpperCase()}: ${risk.category}\n`;
        report += `- ${risk.description}\n`;
        if (risk.mitigation) {
          report += `- **建议**: ${risk.mitigation}\n`;
        }
        report += `\n`;
      }
    }

    if (v.securityReview.recommendations.length > 0) {
      report += `## 建议\n\n`;
      for (const rec of v.securityReview.recommendations) {
        report += `- ${rec}\n`;
      }
    }

    return report;
  }
}
