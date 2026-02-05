// Skill编译器 - 将Markdown模板编译为可执行代码

import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { SkillTemplate, GeneratedSkill, EvolutionConfig } from '../types/evolution.js';
import type { ModelOrchestrator } from '../models/orchestrator.js';
import { Permission } from '../types/skill.js';

/**
 * Markdown Skill模板解析器
 */
export class MarkdownSkillParser {
  /**
   * 从Markdown文件解析Skill模板
   */
  async parseFromFile(filePath: string): Promise<SkillTemplate> {
    const content = await fs.readFile(filePath, 'utf-8');
    return this.parse(content);
  }

  /**
   * 从Markdown内容解析Skill模板
   */
  parse(markdown: string): SkillTemplate {
    const sections = this.extractSections(markdown);

    return {
      name: this.extractValue(sections.meta, 'name') || 'unnamed-skill',
      version: this.extractValue(sections.meta, 'version') || '1.0.0',
      description: this.extractValue(sections.meta, 'description') || '',
      author: this.extractValue(sections.meta, 'author') || 'unknown',
      category: this.extractCategory(sections.meta),
      triggers: this.parseTriggers(sections.triggers),
      permissions: this.parsePermissions(sections.permissions),
      logic: this.parseLogic(sections.logic),
      dependencies: this.parseDependencies(sections.dependencies),
      testCases: this.parseTestCases(sections.tests),
    };
  }

  /**
   * 提取Markdown中的各个部分
   */
  private extractSections(markdown: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const lines = markdown.split('\n');

    let currentSection = 'meta';
    let currentContent: string[] = [];

    for (const line of lines) {
      const headerMatch = line.match(/^#+\s+(.+)$/);
      if (headerMatch) {
        // 保存之前的section
        if (currentContent.length > 0) {
          sections[currentSection] = currentContent.join('\n').trim();
        }

        // 开始新section
        const header = headerMatch[1].toLowerCase();
        if (header.includes('trigger') || header.includes('触发')) {
          currentSection = 'triggers';
        } else if (header.includes('permission') || header.includes('权限')) {
          currentSection = 'permissions';
        } else if (header.includes('logic') || header.includes('逻辑') || header.includes('flow') || header.includes('流程')) {
          currentSection = 'logic';
        } else if (header.includes('dependenc') || header.includes('依赖')) {
          currentSection = 'dependencies';
        } else if (header.includes('test') || header.includes('测试')) {
          currentSection = 'tests';
        } else if (header.includes('code') || header.includes('代码')) {
          currentSection = 'code';
        }

        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    // 保存最后一个section
    if (currentContent.length > 0) {
      sections[currentSection] = currentContent.join('\n').trim();
    }

    return sections;
  }

  private extractValue(content: string, key: string): string | undefined {
    const patterns = [
      new RegExp(`^-?\\s*\\*?\\*?${key}\\*?\\*?\\s*[:：]\\s*(.+)$`, 'im'),
      new RegExp(`${key}\\s*[:：]\\s*(.+)`, 'i'),
    ];

    for (const pattern of patterns) {
      const match = content?.match(pattern);
      if (match) {
        return match[1].trim().replace(/^[`'"]+|[`'"]+$/g, '');
      }
    }
    return undefined;
  }

  private extractCategory(content: string): SkillTemplate['category'] {
    const category = this.extractValue(content, 'category') ||
                     this.extractValue(content, '类别') ||
                     'utility';

    const validCategories = [
      'data-analysis', 'web-scraping', 'api-integration', 'file-processing',
      'automation', 'code-generation', 'communication', 'security', 'utility', 'domain-specific'
    ];

    if (validCategories.includes(category)) {
      return category as SkillTemplate['category'];
    }
    return 'utility';
  }

  private parseTriggers(content: string): SkillTemplate['triggers'] {
    const triggers = {
      patterns: [] as string[],
      intents: [] as string[],
      commands: [] as string[],
      examples: [] as string[],
    };

    if (!content) return triggers;

    // 提取代码块中的patterns
    const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
    for (const block of codeBlocks) {
      const inner = block.replace(/```\w*\n?/g, '').trim();
      const lines = inner.split('\n').filter(l => l.trim());
      for (const line of lines) {
        if (line.startsWith('/') || line.match(/^\/\w+/)) {
          triggers.commands.push(line.trim());
        } else if (line.includes('|') || line.includes('?') || line.includes('(')) {
          triggers.patterns.push(line.trim());
        } else {
          triggers.examples.push(line.trim());
        }
      }
    }

    // 提取列表项
    const listItems = content.match(/^[-*]\s+(.+)$/gm) || [];
    for (const item of listItems) {
      const value = item.replace(/^[-*]\s+/, '').trim();
      if (value.startsWith('/')) {
        triggers.commands.push(value);
      } else if (value.match(/^[\u4e00-\u9fa5]/)) {
        // 中文开头，可能是意图或示例
        triggers.intents.push(value);
      } else if (value.includes('|') || value.includes('?')) {
        triggers.patterns.push(value);
      }
    }

    return triggers;
  }

  private parsePermissions(content: string): Permission[] {
    const permissions: Permission[] = [];
    if (!content) return permissions;

    const permissionMap: Record<string, Permission> = {
      'file:read': Permission.FILE_READ,
      'file:write': Permission.FILE_WRITE,
      'file:delete': Permission.FILE_DELETE,
      'process:spawn': Permission.PROCESS_SPAWN,
      'network:http': Permission.NETWORK_HTTP,
      'system:env': Permission.SYSTEM_ENV,
      'model:expensive': Permission.MODEL_EXPENSIVE,
    };

    for (const [key, value] of Object.entries(permissionMap)) {
      if (content.toLowerCase().includes(key) ||
          content.toLowerCase().includes(key.replace(':', '_'))) {
        permissions.push(value);
      }
    }

    return permissions;
  }

  private parseLogic(content: string): SkillTemplate['logic'] {
    const logic = {
      steps: [] as SkillTemplate['logic']['steps'],
      errorHandling: [] as SkillTemplate['logic']['errorHandling'],
    };

    if (!content) return logic;

    // 提取步骤（编号列表）
    const stepMatches = content.match(/^\d+[.、]\s*(.+)$/gm) || [];
    stepMatches.forEach((step, index) => {
      const description = step.replace(/^\d+[.、]\s*/, '').trim();
      logic.steps.push({
        id: `step${index + 1}`,
        description,
        action: this.inferAction(description),
        onSuccess: index < stepMatches.length - 1 ? `step${index + 2}` : undefined,
      });
    });

    return logic;
  }

  private inferAction(description: string): string {
    const actionKeywords: Record<string, string[]> = {
      'llm_query': ['分析', '生成', '理解', 'analyze', 'generate'],
      'http_request': ['获取', '请求', '调用', 'fetch', 'request', 'api'],
      'file_read': ['读取', '加载', 'read', 'load'],
      'file_write': ['写入', '保存', 'write', 'save'],
      'transform': ['转换', '处理', 'transform', 'process'],
      'validate': ['验证', '检查', 'validate', 'check'],
    };

    for (const [action, keywords] of Object.entries(actionKeywords)) {
      if (keywords.some(k => description.toLowerCase().includes(k))) {
        return action;
      }
    }

    return 'custom';
  }

  private parseDependencies(content: string): SkillTemplate['dependencies'] {
    const deps = {
      skills: [] as string[],
      tools: [] as string[],
      apis: [] as string[],
    };

    if (!content) return deps;

    const listItems = content.match(/^[-*]\s+(.+)$/gm) || [];
    for (const item of listItems) {
      const value = item.replace(/^[-*]\s+/, '').trim();
      if (value.includes('api') || value.includes('API') || value.startsWith('http')) {
        deps.apis.push(value);
      } else if (value.includes('skill') || value.includes('技能')) {
        deps.skills.push(value);
      } else {
        deps.tools.push(value);
      }
    }

    return deps;
  }

  private parseTestCases(content: string): SkillTemplate['testCases'] {
    const testCases: SkillTemplate['testCases'] = [];
    if (!content) return testCases;

    // 尝试解析JSON代码块
    const jsonBlocks = content.match(/```json[\s\S]*?```/g) || [];
    for (const block of jsonBlocks) {
      try {
        const json = block.replace(/```json\n?/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) {
          testCases.push(...parsed);
        } else if (parsed.input) {
          testCases.push(parsed);
        }
      } catch {
        // 忽略解析错误
      }
    }

    // 如果没有找到JSON，尝试解析表格或列表
    if (testCases.length === 0) {
      const tableRows = content.match(/\|[^|\n]+\|/g) || [];
      // 跳过表头行
      for (let i = 2; i < tableRows.length; i++) {
        const cells = tableRows[i].split('|').filter(c => c.trim());
        if (cells.length >= 2) {
          testCases.push({
            id: `test${i - 1}`,
            name: `Test ${i - 1}`,
            input: cells[0].trim(),
            expectedBehavior: cells[1].trim(),
            tags: ['auto-generated'],
          });
        }
      }
    }

    return testCases;
  }
}

/**
 * Skill编译器 - 将模板转换为可执行代码
 */
export class SkillCompiler {
  private llm: ModelOrchestrator;
  private config: EvolutionConfig;
  private parser: MarkdownSkillParser;

  constructor(llm: ModelOrchestrator, config: EvolutionConfig) {
    this.llm = llm;
    this.config = config;
    this.parser = new MarkdownSkillParser();
  }

  /**
   * 从Markdown文件编译Skill
   */
  async compileFromMarkdown(markdownPath: string): Promise<GeneratedSkill> {
    const template = await this.parser.parseFromFile(markdownPath);
    return this.compileFromTemplate(template);
  }

  /**
   * 从模板编译Skill
   */
  async compileFromTemplate(template: SkillTemplate): Promise<GeneratedSkill> {
    const code = await this.generateCode(template);

    return {
      id: randomUUID(),
      template,
      code: {
        typescript: code,
      },
      generation: {
        timestamp: new Date(),
        model: this.config.generation.model,
        prompt: `Compile from template: ${template.name}`,
        iterations: 1,
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
  }

  /**
   * 生成TypeScript代码
   */
  private async generateCode(template: SkillTemplate): Promise<string> {
    const prompt = `
你是一个TypeScript专家。根据以下Skill模板生成完整的TypeScript代码。

## Skill模板
\`\`\`json
${JSON.stringify(template, null, 2)}
\`\`\`

## 基类
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
        return { matched: true, params: { text, matches: match.slice(1), fullMatch: match[0] } };
      }
    }
    return { matched: false, params: {} };
  }
}
\`\`\`

## 要求
1. 继承BaseSkill
2. 实现manifest属性（包含触发器正则）
3. 实现execute方法
4. 使用this.llm进行AI调用
5. 包含错误处理
6. 代码简洁、类型安全

返回完整代码：
\`\`\`typescript
// 代码
\`\`\`
`;

    const response = await this.llm.chat(prompt, {
      model: this.config.generation.model,
      temperature: 0.3,
      maxTokens: 6000,
    });

    const match = response.match(/```typescript\s*([\s\S]*?)\s*```/);
    if (!match) {
      throw new Error('无法解析生成的代码');
    }

    return match[1].trim();
  }

  /**
   * 将代码保存到文件
   */
  async saveSkill(
    skill: GeneratedSkill,
    outputDir: string
  ): Promise<{ markdownPath: string; typescriptPath: string }> {
    await fs.mkdir(outputDir, { recursive: true });

    const baseName = this.sanitizeFileName(skill.template.name);

    // 保存Markdown模板
    const markdownPath = path.join(outputDir, `${baseName}.md`);
    await fs.writeFile(markdownPath, this.templateToMarkdown(skill.template));

    // 保存TypeScript代码
    const typescriptPath = path.join(outputDir, `${baseName}.ts`);
    await fs.writeFile(typescriptPath, skill.code.typescript);

    return { markdownPath, typescriptPath };
  }

  /**
   * 将模板转换为Markdown格式
   */
  private templateToMarkdown(template: SkillTemplate): string {
    return `# ${template.name}

## 元信息
- **版本**: ${template.version}
- **描述**: ${template.description}
- **作者**: ${template.author}
- **类别**: ${template.category}

## 触发器

### 正则表达式
\`\`\`
${template.triggers.patterns.join('\n')}
\`\`\`

### 命令
${template.triggers.commands.map(c => `- ${c}`).join('\n') || '无'}

### 示例
${template.triggers.examples.map(e => `- ${e}`).join('\n') || '无'}

## 权限
${template.permissions.map(p => `- ${p}`).join('\n') || '无特殊权限'}

## 执行逻辑

${template.logic.steps.map((s, i) => `${i + 1}. **${s.id}**: ${s.description}`).join('\n')}

## 错误处理

${template.logic.errorHandling.map(e => `- **${e.errorType}**: ${e.action}${e.maxRetries ? ` (最多重试${e.maxRetries}次)` : ''}`).join('\n') || '无特殊处理'}

## 依赖

### 技能依赖
${template.dependencies.skills.map(s => `- ${s}`).join('\n') || '无'}

### 工具依赖
${template.dependencies.tools.map(t => `- ${t}`).join('\n') || '无'}

### API依赖
${template.dependencies.apis.map(a => `- ${a}`).join('\n') || '无'}

## 测试用例

\`\`\`json
${JSON.stringify(template.testCases, null, 2)}
\`\`\`
`;
  }

  private sanitizeFileName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
