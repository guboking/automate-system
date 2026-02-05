// Skill仓库 - 持久化存储和管理生成的Skills

import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash } from 'crypto';
import type {
  GeneratedSkill,
  SkillRepositoryEntry,
  SkillVersion,
  SkillTemplate,
} from '../types/evolution.js';
import type { SkillManifest } from '../types/skill.js';

/**
 * Skill仓库索引文件结构
 */
interface RepositoryIndex {
  version: string;
  updatedAt: string;
  skills: Record<string, SkillRepositoryEntry>;
}

/**
 * Skill仓库 - 管理自动生成的Skills
 */
export class SkillRepository {
  private basePath: string;
  private indexPath: string;
  private index: RepositoryIndex;
  private initialized: boolean = false;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.indexPath = path.join(basePath, 'repository-index.json');
    this.index = {
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
      skills: {},
    };
  }

  /**
   * 初始化仓库
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.basePath, { recursive: true });
      await fs.mkdir(path.join(this.basePath, 'skills'), { recursive: true });
      await fs.mkdir(path.join(this.basePath, 'templates'), { recursive: true });

      // 尝试加载现有索引
      try {
        const indexContent = await fs.readFile(this.indexPath, 'utf-8');
        this.index = JSON.parse(indexContent);
      } catch {
        // 创建新索引
        await this.saveIndex();
      }

      this.initialized = true;
    } catch (error) {
      console.error('初始化Skill仓库失败:', error);
      throw error;
    }
  }

  /**
   * 添加新的Skill
   */
  async add(skill: GeneratedSkill): Promise<SkillRepositoryEntry> {
    await this.ensureInitialized();

    const entry = this.createEntry(skill);
    this.index.skills[skill.id] = entry;

    // 保存文件
    await this.saveSkillFiles(skill, entry);
    await this.saveIndex();

    return entry;
  }

  /**
   * 获取Skill
   */
  async get(skillId: string): Promise<SkillRepositoryEntry | null> {
    await this.ensureInitialized();
    return this.index.skills[skillId] || null;
  }

  /**
   * 根据名称获取Skill
   */
  async getByName(name: string): Promise<SkillRepositoryEntry | null> {
    await this.ensureInitialized();

    for (const entry of Object.values(this.index.skills)) {
      if (entry.manifest.name === name) {
        return entry;
      }
    }

    return null;
  }

  /**
   * 列出所有Skills
   */
  async list(): Promise<SkillRepositoryEntry[]> {
    await this.ensureInitialized();
    return Object.values(this.index.skills);
  }

  /**
   * 列出启用的Skills
   */
  async listEnabled(): Promise<SkillRepositoryEntry[]> {
    const all = await this.list();
    return all.filter(e => e.enabled);
  }

  /**
   * 更新Skill条目
   */
  async updateEntry(
    skillId: string,
    updates: Partial<SkillRepositoryEntry>
  ): Promise<void> {
    await this.ensureInitialized();

    const entry = this.index.skills[skillId];
    if (!entry) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    Object.assign(entry, updates);
    entry.stats.updatedAt = new Date();

    await this.saveIndex();
  }

  /**
   * 更新Skill代码（新版本）
   */
  async updateSkill(
    skillId: string,
    skill: GeneratedSkill,
    changelog: string
  ): Promise<void> {
    await this.ensureInitialized();

    const entry = this.index.skills[skillId];
    if (!entry) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    // 创建新版本
    const newVersion = this.incrementVersion(entry.currentVersion);
    const codeHash = this.hashCode(skill.code.typescript);

    const version: SkillVersion = {
      version: newVersion,
      timestamp: new Date(),
      changelog,
      author: skill.template.author,
      hash: codeHash,
    };

    entry.versions.push(version);
    entry.currentVersion = newVersion;
    entry.template = skill.template;
    entry.manifest = this.templateToManifest(skill.template);
    entry.stats.updatedAt = new Date();

    // 保存新代码
    await this.saveSkillFiles(skill, entry);
    await this.saveIndex();
  }

  /**
   * 弃用Skill
   */
  async deprecate(skillId: string): Promise<void> {
    await this.updateEntry(skillId, { enabled: false });
  }

  /**
   * 删除Skill
   */
  async remove(skillId: string): Promise<void> {
    await this.ensureInitialized();

    const entry = this.index.skills[skillId];
    if (!entry) return;

    // 删除文件
    try {
      if (entry.paths.markdown) {
        await fs.unlink(entry.paths.markdown).catch(() => {});
      }
      if (entry.paths.typescript) {
        await fs.unlink(entry.paths.typescript).catch(() => {});
      }
      if (entry.paths.compiled) {
        await fs.unlink(entry.paths.compiled).catch(() => {});
      }
    } catch {
      // 忽略文件删除错误
    }

    delete this.index.skills[skillId];
    await this.saveIndex();
  }

  /**
   * 读取Skill代码
   */
  async readSkillCode(skillId: string): Promise<string | null> {
    const entry = await this.get(skillId);
    if (!entry?.paths.typescript) return null;

    try {
      return await fs.readFile(entry.paths.typescript, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * 读取Skill模板
   */
  async readSkillTemplate(skillId: string): Promise<string | null> {
    const entry = await this.get(skillId);
    if (!entry?.paths.markdown) return null;

    try {
      return await fs.readFile(entry.paths.markdown, 'utf-8');
    } catch {
      return null;
    }
  }

  /**
   * 搜索Skills
   */
  async search(query: string): Promise<SkillRepositoryEntry[]> {
    await this.ensureInitialized();

    const lowerQuery = query.toLowerCase();
    const results: SkillRepositoryEntry[] = [];

    for (const entry of Object.values(this.index.skills)) {
      const searchText = [
        entry.manifest.name,
        entry.manifest.description,
        ...entry.template.triggers.intents,
        ...entry.template.triggers.examples,
      ].join(' ').toLowerCase();

      if (searchText.includes(lowerQuery)) {
        results.push(entry);
      }
    }

    return results;
  }

  /**
   * 获取统计信息
   */
  count(): number {
    return Object.keys(this.index.skills).length;
  }

  /**
   * 获取仓库统计
   */
  async getStats(): Promise<{
    totalSkills: number;
    enabledSkills: number;
    totalExecutions: number;
    averageSuccessRate: number;
  }> {
    await this.ensureInitialized();

    const entries = Object.values(this.index.skills);
    const enabledSkills = entries.filter(e => e.enabled).length;
    const totalExecutions = entries.reduce((sum, e) => sum + e.stats.executionCount, 0);

    const successRates = entries
      .filter(e => e.stats.executionCount > 0)
      .map(e => e.stats.successRate);

    const averageSuccessRate = successRates.length > 0
      ? successRates.reduce((a, b) => a + b, 0) / successRates.length
      : 0;

    return {
      totalSkills: entries.length,
      enabledSkills,
      totalExecutions,
      averageSuccessRate,
    };
  }

  /**
   * 记录Skill执行
   */
  async recordExecution(
    skillId: string,
    success: boolean,
    executionTime: number
  ): Promise<void> {
    const entry = this.index.skills[skillId];
    if (!entry) return;

    entry.stats.executionCount++;
    entry.stats.lastUsed = new Date();

    // 更新平均执行时间
    const oldAvg = entry.stats.averageExecutionTime;
    const n = entry.stats.executionCount;
    entry.stats.averageExecutionTime = oldAvg + (executionTime - oldAvg) / n;

    // 更新成功率
    if (success) {
      entry.stats.successRate =
        (entry.stats.successRate * (n - 1) + 1) / n;
    } else {
      entry.stats.successRate =
        (entry.stats.successRate * (n - 1)) / n;
    }

    await this.saveIndex();
  }

  /**
   * 清理旧版本
   */
  async cleanupOldVersions(keepVersions: number = 5): Promise<void> {
    await this.ensureInitialized();

    for (const entry of Object.values(this.index.skills)) {
      if (entry.versions.length > keepVersions) {
        entry.versions = entry.versions.slice(-keepVersions);
      }
    }

    await this.saveIndex();
  }

  /**
   * 导出仓库
   */
  async export(): Promise<RepositoryIndex> {
    await this.ensureInitialized();
    return { ...this.index };
  }

  /**
   * 导入仓库
   */
  async import(data: RepositoryIndex): Promise<void> {
    await this.ensureInitialized();

    // 合并而不是覆盖
    for (const [id, entry] of Object.entries(data.skills)) {
      if (!this.index.skills[id]) {
        this.index.skills[id] = entry;
      }
    }

    await this.saveIndex();
  }

  // ============ 私有方法 ============

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async saveIndex(): Promise<void> {
    this.index.updatedAt = new Date().toISOString();
    await fs.writeFile(
      this.indexPath,
      JSON.stringify(this.index, null, 2)
    );
  }

  private async saveSkillFiles(
    skill: GeneratedSkill,
    entry: SkillRepositoryEntry
  ): Promise<void> {
    // 保存TypeScript代码
    await fs.writeFile(entry.paths.typescript, skill.code.typescript);

    // 保存Markdown模板
    const markdownContent = this.templateToMarkdown(skill.template);
    await fs.writeFile(entry.paths.markdown, markdownContent);
  }

  private createEntry(skill: GeneratedSkill): SkillRepositoryEntry {
    const baseName = this.sanitizeName(skill.template.name);
    const codeHash = this.hashCode(skill.code.typescript);

    const entry: SkillRepositoryEntry = {
      id: skill.id,
      manifest: this.templateToManifest(skill.template),
      template: skill.template,
      paths: {
        markdown: path.join(this.basePath, 'templates', `${baseName}.md`),
        typescript: path.join(this.basePath, 'skills', `${baseName}.ts`),
      },
      versions: [
        {
          version: skill.template.version,
          timestamp: new Date(),
          changelog: '初始版本',
          author: skill.template.author,
          hash: codeHash,
        },
      ],
      currentVersion: skill.template.version,
      stats: {
        createdAt: new Date(),
        updatedAt: new Date(),
        executionCount: 0,
        successRate: 0,
        averageExecutionTime: 0,
      },
      enabled: skill.status === 'deployed',
      loadState: 'unloaded',
    };

    return entry;
  }

  private templateToManifest(template: SkillTemplate): SkillManifest {
    return {
      name: template.name,
      version: template.version,
      description: template.description,
      author: template.author,
      triggers: {
        patterns: template.triggers.patterns,
        intents: template.triggers.intents,
        commands: template.triggers.commands,
      },
      permissions: template.permissions,
      limits: {
        timeout: 60000,
        memory: 256,
        fileAccess: ['./evolved_skills/*'],
        networkAccess: ['*'],
      },
    };
  }

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

## 测试用例

\`\`\`json
${JSON.stringify(template.testCases, null, 2)}
\`\`\`

---
*此文件由自进化引擎自动生成*
`;
  }

  private sanitizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'unnamed-skill';
  }

  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex').substring(0, 16);
  }

  private incrementVersion(version: string): string {
    const parts = version.split('.').map(Number);
    parts[2] = (parts[2] || 0) + 1;
    return parts.join('.');
  }
}
