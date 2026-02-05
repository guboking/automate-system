// 自进化技能 - 让用户与自进化系统交互

import { BaseSkill } from './base.js';
import { Permission } from '../types/skill.js';
import type { SkillManifest, SkillResult, ConversationContext } from '../types/index.js';
import { SelfEvolutionEngine } from '../evolution/self-evolution-engine.js';
import type { ModelOrchestrator } from '../models/orchestrator.js';

/**
 * 自进化技能 - 用户与AI自进化系统的交互入口
 *
 * 功能：
 * 1. 查看已有技能列表
 * 2. 主动创建新技能
 * 3. 查看进化状态和历史
 * 4. 管理技能生命周期
 */
export class EvolutionSkill extends BaseSkill {
  manifest: SkillManifest = {
    name: 'evolution',
    version: '1.0.0',
    description: 'AI智能体自进化系统 - 自动创建和管理技能',
    author: 'clawdbot',
    triggers: {
      patterns: [
        // 查看技能
        '^(?:列出|查看|显示)(?:所有)?技能$',
        '^(?:list|show)\\s*skills?$',
        // 创建技能
        '^(?:创建|生成|新建)(?:一个)?技能[：:]?\\s*(.+)$',
        '^(?:create|generate)\\s+skill[：:]?\\s*(.+)$',
        // 进化状态
        '^(?:进化|evolution)\\s*(?:状态|status)$',
        '^(?:查看)?(?:能力)?缺口$',
        // 帮助
        '^/evolve\\s*(?:help)?$',
        '^/evolve\\s+(.+)$',
      ],
      intents: [
        '查看技能',
        '创建技能',
        '进化状态',
        '能力缺口',
      ],
      commands: ['/evolve', '/skills'],
    },
    permissions: [
      Permission.FILE_READ,
      Permission.FILE_WRITE,
      Permission.NETWORK_HTTP,
      Permission.MODEL_EXPENSIVE,
    ],
    limits: {
      timeout: 180000,  // 3分钟，技能生成需要较长时间
      memory: 512,
      fileAccess: ['./evolved_skills/*'],
      networkAccess: ['*'],
    },
  };

  private evolutionEngine: SelfEvolutionEngine | null = null;

  async onLoad(): Promise<void> {
    // 初始化自进化引擎
    this.evolutionEngine = new SelfEvolutionEngine(this.llm, {
      autoEvolve: true,
      deployment: {
        autoApprove: false,  // 需要人工确认
        sandboxFirst: true,
        notifyOnDeploy: true,
      },
    });

    await this.evolutionEngine.initialize();
    console.log('🧬 自进化技能已加载');
  }

  async onUnload(): Promise<void> {
    this.evolutionEngine = null;
  }

  async execute(
    params: Record<string, unknown>,
    context: ConversationContext
  ): Promise<SkillResult> {
    const text = (params.text as string || '').trim();
    const matches = params.matches as string[] || [];

    // 解析命令
    const command = this.parseCommand(text, matches);

    switch (command.type) {
      case 'list':
        return this.handleListSkills();

      case 'create':
        return this.handleCreateSkill(command.description || '');

      case 'status':
        return this.handleStatus();

      case 'gaps':
        return this.handleShowGaps();

      case 'help':
      default:
        return this.handleHelp();
    }
  }

  private parseCommand(text: string, matches: string[]): {
    type: 'list' | 'create' | 'status' | 'gaps' | 'help';
    description?: string;
  } {
    const lowerText = text.toLowerCase();

    // /evolve 命令解析
    if (lowerText.startsWith('/evolve')) {
      const args = text.slice(7).trim();
      if (!args || args === 'help') {
        return { type: 'help' };
      }
      if (args === 'status') {
        return { type: 'status' };
      }
      if (args === 'list' || args === 'skills') {
        return { type: 'list' };
      }
      if (args === 'gaps') {
        return { type: 'gaps' };
      }
      // 其他都视为创建技能的描述
      return { type: 'create', description: args };
    }

    // 列出技能
    if (lowerText.includes('列出') || lowerText.includes('查看') ||
        lowerText.includes('显示') || lowerText.includes('list') ||
        lowerText.includes('show')) {
      if (lowerText.includes('技能') || lowerText.includes('skill')) {
        return { type: 'list' };
      }
    }

    // 创建技能
    if (lowerText.includes('创建') || lowerText.includes('生成') ||
        lowerText.includes('新建') || lowerText.includes('create') ||
        lowerText.includes('generate')) {
      const description = matches[0] || text.replace(/^.*?[：:]\s*/, '');
      return { type: 'create', description };
    }

    // 进化状态
    if (lowerText.includes('状态') || lowerText.includes('status')) {
      return { type: 'status' };
    }

    // 能力缺口
    if (lowerText.includes('缺口') || lowerText.includes('gap')) {
      return { type: 'gaps' };
    }

    return { type: 'help' };
  }

  private async handleListSkills(): Promise<SkillResult> {
    if (!this.evolutionEngine) {
      return this.errorResult('自进化引擎未初始化');
    }

    const skills = await this.evolutionEngine.getDeployedSkills();

    if (skills.length === 0) {
      return {
        success: true,
        response: {
          text: `## 🧬 已部署的自进化技能

暂无自动生成的技能。

### 如何创建新技能？

使用以下命令：
\`\`\`
创建技能: <描述你需要的功能>
\`\`\`

或：
\`\`\`
/evolve <功能描述>
\`\`\`

例如：
- \`创建技能: 将PDF转换为Markdown格式\`
- \`/evolve 自动发送每日股票摘要到邮箱\`
`,
        },
        followUp: {
          suggestions: [
            '创建技能: 数据格式转换工具',
            '/evolve status',
          ],
        },
      };
    }

    const skillList = skills.map(s => {
      const t = s.template;
      return `### ${t.name} v${t.version}
- **描述**: ${t.description}
- **类别**: ${t.category}
- **触发器**: ${t.triggers.examples.slice(0, 2).join(', ') || t.triggers.patterns[0] || '无'}
`;
    }).join('\n');

    return {
      success: true,
      response: {
        text: `## 🧬 已部署的自进化技能

共 ${skills.length} 个技能：

${skillList}

---
使用 \`/evolve <描述>\` 创建新技能`,
      },
      followUp: {
        suggestions: [
          '/evolve status',
          '查看能力缺口',
        ],
      },
    };
  }

  private async handleCreateSkill(description: string): Promise<SkillResult> {
    if (!this.evolutionEngine) {
      return this.errorResult('自进化引擎未初始化');
    }

    if (!description.trim()) {
      return {
        success: false,
        error: '请提供技能描述',
        response: {
          text: `## ❌ 缺少技能描述

请描述你需要的功能，例如：
\`\`\`
创建技能: 自动分析GitHub仓库的代码质量
\`\`\`
`,
        },
      };
    }

    // 开始创建技能（这是一个异步过程）
    try {
      const response = await this.llm.chat(`
请简要分析以下技能需求，判断可行性：

需求：${description}

以JSON格式返回：
\`\`\`json
{
  "feasible": true/false,
  "complexity": "low|medium|high",
  "estimatedSteps": ["步骤1", "步骤2"],
  "concerns": ["可能的问题"],
  "suggestion": "改进建议（如有）"
}
\`\`\`
`, { temperature: 0.3 });

      let analysis: any = {};
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[1]);
      }

      if (analysis.feasible === false) {
        return {
          success: false,
          error: '技能需求不可行',
          response: {
            text: `## ⚠️ 技能需求评估

**需求**: ${description}

**评估结果**: 可能不可行

**原因**:
${analysis.concerns?.map((c: string) => `- ${c}`).join('\n') || '- 未说明'}

**建议**:
${analysis.suggestion || '请尝试更具体的需求描述'}
`,
          },
        };
      }

      // 开始生成
      const skill = await this.evolutionEngine.createSkillFromDescription(description);

      if (!skill) {
        return {
          success: false,
          error: '技能生成失败',
          response: {
            text: `## ❌ 技能生成失败

无法为以下需求生成技能：
> ${description}

可能的原因：
- 需求描述不够清晰
- 所需功能超出系统能力范围
- 生成过程中遇到错误

请尝试：
1. 提供更详细的功能描述
2. 将复杂需求拆分为多个简单技能
3. 查看 \`/evolve status\` 了解详细错误
`,
          },
        };
      }

      const statusEmoji = skill.status === 'deployed' ? '✅' : '📋';
      const statusText = skill.status === 'deployed' ? '已部署' : '等待审核';

      return {
        success: true,
        data: skill,
        response: {
          text: `## ${statusEmoji} 技能生成成功

**名称**: ${skill.template.name}
**版本**: ${skill.template.version}
**状态**: ${statusText}

### 描述
${skill.template.description}

### 触发方式
${skill.template.triggers.patterns.slice(0, 3).map(p => `- \`${p}\``).join('\n')}

### 示例
${skill.template.triggers.examples.slice(0, 3).map(e => `- ${e}`).join('\n') || '- 暂无示例'}

### 验证结果
- 语法验证: ${skill.validation.syntaxValid ? '✅' : '❌'}
- 类型检查: ${skill.validation.typeCheckPassed ? '✅' : '❌'}
- 安全审查: ${skill.validation.securityReview.passed ? '✅' : '⚠️'}

${skill.status !== 'deployed' ? '\n> 💡 技能已验证，需要人工确认后部署' : ''}
`,
        },
        followUp: {
          suggestions: [
            '列出技能',
            '/evolve status',
          ],
        },
      };
    } catch (error) {
      return this.errorResult(`技能生成异常: ${error}`);
    }
  }

  private async handleStatus(): Promise<SkillResult> {
    if (!this.evolutionEngine) {
      return this.errorResult('自进化引擎未初始化');
    }

    const stats = this.evolutionEngine.getStats();
    const gaps = this.evolutionEngine.getPendingGaps();
    const history = this.evolutionEngine.getEvolutionHistory().slice(-10);

    let historyText = '';
    if (history.length > 0) {
      historyText = history.map(e => {
        const time = new Date(e.timestamp).toLocaleTimeString();
        const emoji = e.details.result === 'success' ? '✅' : '❌';
        return `- ${time} ${emoji} ${e.type}: ${e.details.action}`;
      }).join('\n');
    } else {
      historyText = '暂无记录';
    }

    return {
      success: true,
      data: { stats, gaps, history },
      response: {
        text: `## 🧬 自进化系统状态

### 统计
| 指标 | 数值 |
|------|------|
| 已部署技能 | ${stats.totalSkills} |
| 待处理缺口 | ${stats.pendingGaps} |
| 进化事件总数 | ${stats.evolutionEvents} |
| 成功率 | ${(stats.successRate * 100).toFixed(1)}% |

### 待处理的能力缺口
${gaps.length > 0
  ? gaps.map(g => `- **${g.status}**: ${g.requiredCapability.description}`).join('\n')
  : '暂无'}

### 最近事件
${historyText}

---
使用 \`/evolve <描述>\` 创建新技能`,
      },
      followUp: {
        suggestions: [
          '列出技能',
          '查看能力缺口',
        ],
      },
    };
  }

  private async handleShowGaps(): Promise<SkillResult> {
    if (!this.evolutionEngine) {
      return this.errorResult('自进化引擎未初始化');
    }

    const gaps = this.evolutionEngine.getPendingGaps();

    if (gaps.length === 0) {
      return {
        success: true,
        response: {
          text: `## 🎯 能力缺口

暂无待处理的能力缺口。

### 什么是能力缺口？

当AI在执行任务时发现缺少某种能力，会自动识别并记录为"能力缺口"。
自进化系统会尝试自动生成新的技能来填补这些缺口。

你也可以主动创建技能：
\`\`\`
/evolve <功能描述>
\`\`\`
`,
        },
      };
    }

    const gapList = gaps.map((g, i) => {
      return `### ${i + 1}. ${g.requiredCapability.description}

- **状态**: ${g.status}
- **类别**: ${g.requiredCapability.category}
- **复杂度**: ${g.requiredCapability.complexity}
- **原始请求**: ${g.context.userRequest.slice(0, 100)}...
- **失败原因**: ${g.context.failureReason}
`;
    }).join('\n');

    return {
      success: true,
      data: gaps,
      response: {
        text: `## 🎯 待处理的能力缺口

共 ${gaps.length} 个缺口：

${gapList}

---
系统正在自动处理这些缺口。你也可以手动创建技能来解决。`,
      },
    };
  }

  private handleHelp(): SkillResult {
    return {
      success: true,
      response: {
        text: `## 🧬 自进化系统帮助

### 什么是自进化系统？

自进化系统让AI能够：
1. **自动发现**能力缺口 - 当无法完成任务时识别需要的能力
2. **自动生成**新技能 - 使用LLM生成代码实现新功能
3. **自动验证**技能安全性 - 语法检查、类型检查、安全审查
4. **自动部署**通过验证的技能 - 惰性加载，按需使用

### 可用命令

| 命令 | 说明 |
|------|------|
| \`/evolve help\` | 显示此帮助 |
| \`/evolve status\` | 查看系统状态 |
| \`/evolve list\` | 列出已部署技能 |
| \`/evolve gaps\` | 查看能力缺口 |
| \`/evolve <描述>\` | 创建新技能 |

### 示例

\`\`\`
# 创建一个数据转换技能
/evolve 将CSV文件转换为JSON格式

# 创建一个通知技能
创建技能: 每天早上发送股票摘要到微信

# 查看系统状态
/evolve status
\`\`\`

### 注意事项

- 生成的技能需要通过安全验证才能部署
- 复杂技能可能需要人工审核
- 建议提供详细的功能描述以获得更好的结果
`,
      },
      followUp: {
        suggestions: [
          '/evolve status',
          '列出技能',
          '/evolve 将Markdown转换为HTML',
        ],
      },
    };
  }

  private errorResult(message: string): SkillResult {
    return {
      success: false,
      error: message,
      response: {
        text: `## ❌ 错误

${message}

请稍后重试或联系管理员。`,
      },
    };
  }
}
