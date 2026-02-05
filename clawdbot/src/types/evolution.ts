// 自进化系统类型定义

import type { Permission, SkillManifest } from './skill.js';

/**
 * 能力缺口 - 当Agent无法完成任务时识别的缺失能力
 */
export interface CapabilityGap {
  id: string;
  timestamp: Date;

  // 触发缺口识别的上下文
  context: {
    userRequest: string;          // 用户原始请求
    attemptedActions: string[];   // Agent尝试过的操作
    failureReason: string;        // 失败原因
  };

  // 缺失能力的描述
  requiredCapability: {
    description: string;          // 需要什么能力
    category: SkillCategory;      // 能力类别
    suggestedTools?: string[];    // 建议使用的工具
    complexity: 'low' | 'medium' | 'high';
  };

  // 状态追踪
  status: 'identified' | 'generating' | 'validating' | 'resolved' | 'failed';
}

/**
 * 技能类别
 */
export type SkillCategory =
  | 'data-analysis'       // 数据分析
  | 'web-scraping'        // 网页抓取
  | 'api-integration'     // API集成
  | 'file-processing'     // 文件处理
  | 'automation'          // 自动化任务
  | 'code-generation'     // 代码生成
  | 'communication'       // 通讯/通知
  | 'security'            // 安全相关
  | 'utility'             // 通用工具
  | 'domain-specific';    // 领域特定

/**
 * Skill模板 - Markdown格式的skill定义
 */
export interface SkillTemplate {
  // 元信息
  name: string;
  version: string;
  description: string;
  author: string;
  category: SkillCategory;

  // 触发器定义
  triggers: {
    patterns: string[];           // 正则表达式模式
    intents: string[];            // 意图描述
    commands: string[];           // 命令格式
    examples: string[];           // 示例输入
  };

  // 权限需求
  permissions: Permission[];

  // 执行逻辑（伪代码或自然语言描述）
  logic: {
    steps: LogicStep[];
    errorHandling: ErrorHandler[];
  };

  // 依赖项
  dependencies: {
    skills: string[];             // 依赖的其他skills
    tools: string[];              // 依赖的外部工具
    apis: string[];               // 依赖的API
  };

  // 测试用例
  testCases: TestCase[];
}

/**
 * 逻辑步骤
 */
export interface LogicStep {
  id: string;
  description: string;
  action: string;                 // 操作类型
  params?: Record<string, unknown>;
  condition?: string;             // 条件表达式
  onSuccess?: string;             // 成功后跳转
  onFailure?: string;             // 失败后跳转
}

/**
 * 错误处理器
 */
export interface ErrorHandler {
  errorType: string;
  action: 'retry' | 'fallback' | 'abort' | 'notify';
  maxRetries?: number;
  fallbackStep?: string;
  message?: string;
}

/**
 * 测试用例
 */
export interface TestCase {
  id: string;
  name: string;
  input: string;
  expectedOutput?: string | RegExp;
  expectedBehavior: string;
  tags: string[];
}

/**
 * 生成的Skill代码
 */
export interface GeneratedSkill {
  id: string;
  template: SkillTemplate;

  // 生成的代码
  code: {
    typescript: string;           // TypeScript源码
    compiled?: string;            // 编译后的JS（如需要）
  };

  // 生成元信息
  generation: {
    timestamp: Date;
    model: string;                // 使用的LLM模型
    prompt: string;               // 使用的prompt
    iterations: number;           // 生成迭代次数
  };

  // 验证结果
  validation: {
    status: 'pending' | 'passed' | 'failed';
    syntaxValid: boolean;
    typeCheckPassed: boolean;
    testResults: TestResult[];
    securityReview: SecurityReviewResult;
  };

  // 状态
  status: 'draft' | 'validated' | 'deployed' | 'deprecated';
}

/**
 * 测试结果
 */
export interface TestResult {
  testCaseId: string;
  passed: boolean;
  actualOutput?: string;
  error?: string;
  executionTime: number;
}

/**
 * 安全审查结果
 */
export interface SecurityReviewResult {
  passed: boolean;
  risks: SecurityRisk[];
  recommendations: string[];
}

/**
 * 安全风险
 */
export interface SecurityRisk {
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  description: string;
  location?: string;
  mitigation?: string;
}

/**
 * Skill仓库条目
 */
export interface SkillRepositoryEntry {
  id: string;
  manifest: SkillManifest;
  template: SkillTemplate;

  // 文件路径
  paths: {
    markdown: string;             // .md 模板文件
    typescript: string;           // .ts 源码文件
    compiled?: string;            // 编译后的 .js 文件
  };

  // 版本历史
  versions: SkillVersion[];
  currentVersion: string;

  // 使用统计
  stats: {
    createdAt: Date;
    updatedAt: Date;
    executionCount: number;
    successRate: number;
    averageExecutionTime: number;
    lastUsed?: Date;
  };

  // 状态
  enabled: boolean;
  loadState: 'unloaded' | 'loading' | 'loaded' | 'error';
}

/**
 * Skill版本
 */
export interface SkillVersion {
  version: string;
  timestamp: Date;
  changelog: string;
  author: string;
  hash: string;                   // 代码hash用于完整性校验
}

/**
 * 进化事件 - 记录自进化系统的所有活动
 */
export interface EvolutionEvent {
  id: string;
  timestamp: Date;
  type: EvolutionEventType;

  // 事件详情
  details: {
    gap?: CapabilityGap;
    skill?: GeneratedSkill;
    action: string;
    result: 'success' | 'failure';
    error?: string;
  };

  // 关联的用户会话
  sessionId?: string;
  userId?: string;
}

export type EvolutionEventType =
  | 'gap_identified'              // 发现能力缺口
  | 'generation_started'          // 开始生成skill
  | 'generation_completed'        // 生成完成
  | 'validation_started'          // 开始验证
  | 'validation_passed'           // 验证通过
  | 'validation_failed'           // 验证失败
  | 'skill_deployed'              // skill部署上线
  | 'skill_repaired'              // skill修复
  | 'skill_deprecated';           // skill弃用

/**
 * 自进化配置
 */
export interface EvolutionConfig {
  // 是否启用自动进化
  autoEvolve: boolean;

  // 生成配置
  generation: {
    model: string;                // 使用的LLM模型
    maxIterations: number;        // 最大迭代次数
    timeout: number;              // 生成超时（ms）
  };

  // 验证配置
  validation: {
    runTests: boolean;            // 是否运行测试
    typeCheck: boolean;           // 是否类型检查
    securityReview: boolean;      // 是否安全审查
    minTestCoverage: number;      // 最小测试覆盖率
  };

  // 部署配置
  deployment: {
    autoApprove: boolean;         // 是否自动批准部署
    sandboxFirst: boolean;        // 是否先在沙箱测试
    notifyOnDeploy: boolean;      // 部署时是否通知
  };

  // 仓库配置
  repository: {
    path: string;                 // skills存储路径
    maxSkills: number;            // 最大skill数量
    cleanupOldVersions: boolean;  // 是否清理旧版本
  };

  // 安全配置
  security: {
    allowedPermissions: Permission[];  // 允许的权限
    blockedPatterns: string[];         // 禁止的代码模式
    requireReview: boolean;            // 是否需要人工审核
  };
}

/**
 * 默认进化配置
 */
export const DEFAULT_EVOLUTION_CONFIG: EvolutionConfig = {
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
    allowedPermissions: [
      'file:read' as Permission,
      'file:write' as Permission,
      'network:http' as Permission,
    ],
    blockedPatterns: [
      'eval\\(',
      'Function\\(',
      'child_process',
      'require\\([\'"]fs[\'"]\\)',
    ],
    requireReview: true,
  },
};
