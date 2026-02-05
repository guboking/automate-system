# 🧬 AI智能体自进化系统

## 概述

自进化系统是Clawdbot的核心创新功能，让AI智能体具备**自动学习和自制Skills/Tools**的能力。当Agent遇到现有工具无法完成的任务时，能够自动识别能力缺口，生成新的技能代码，并经过验证后部署使用。

这是一个真正的"**从钻木取火到自己造火柴**"的进化 —— Agent不再依赖人工预置技能，而是能够自主扩展能力边界。

## 核心特性

### 1. 🔍 自动发现能力缺口

当Agent执行任务失败时，系统会自动分析：
- 用户的原始请求是什么
- Agent尝试了哪些操作
- 为什么失败了
- 需要什么新能力来解决

```typescript
// 自动触发能力缺口分析
await evolutionEngine.reportFailure(
  userRequest,      // "帮我把这个PDF转成Markdown"
  attemptedActions, // ["尝试使用LLM直接处理"]
  failureReason,    // "无法读取PDF文件内容"
  existingSkills    // ["stock-analysis", "evolution"]
);
```

### 2. 🛠️ 自动生成新技能

基于能力缺口，使用LLM自动生成完整的技能代码：

```
能力缺口识别
    ↓
生成Skill模板（Markdown格式）
    ├── 触发器定义（正则表达式）
    ├── 执行逻辑（步骤分解）
    ├── 错误处理
    └── 测试用例
    ↓
生成TypeScript代码
    ↓
继承BaseSkill，实现execute()方法
```

### 3. 🔬 自动验证与安全审查

生成的代码必须通过多重验证：

| 检查项 | 说明 |
|--------|------|
| 语法验证 | 确保代码结构正确 |
| 类型检查 | TypeScript类型安全 |
| 安全审查 | 检测危险模式（eval、child_process等） |
| 测试执行 | 模拟运行测试用例 |

### 4. 🔧 自我修复

如果验证失败，系统会自动：
1. 收集错误信息
2. 使用LLM分析问题
3. 生成修复后的代码
4. 重新验证

### 5. 📦 惰性加载

采用类似Claude Code Skills的设计：
- 技能只在需要时加载
- 不占用额外的上下文token
- 支持动态注册和卸载

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    SelfEvolutionEngine                       │
│                      (协调中心)                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │SkillGenerator│    │SkillCompiler│    │SkillValidator│     │
│  │   能力分析   │───▶│  代码生成   │───▶│   验证审查   │      │
│  │   模板生成   │    │  MD→TS转换  │    │   测试执行   │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│                                                              │
│                     ┌─────────────┐                          │
│                     │SkillRepository│                         │
│                     │   持久化存储  │                         │
│                     │   版本管理    │                         │
│                     └─────────────┘                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     SkillRegistry                            │
│                   (支持惰性加载)                              │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │  Stock   │  │Evolution │  │ 自动生成  │  │ 自动生成  │     │
│  │ Analysis │  │  Skill   │  │ Skill 1  │  │ Skill N  │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│     预置技能      预置技能      惰性加载      惰性加载          │
└─────────────────────────────────────────────────────────────┘
```

## 使用方法

### 基础命令

```bash
# 查看帮助
/evolve help

# 查看系统状态
/evolve status

# 列出所有技能
/evolve list
列出技能

# 查看能力缺口
/evolve gaps
查看能力缺口

# 创建新技能
/evolve 将PDF文件转换为Markdown格式
创建技能: 自动发送每日股票摘要到邮箱
```

### 示例场景

#### 场景1：创建数据转换技能

```
用户: /evolve 将CSV文件转换为JSON格式

系统: 🧪 开始生成技能...
      🔬 验证生成的技能...
      ✅ 技能生成成功

      名称: csv-to-json-converter
      版本: 1.0.0
      状态: 等待审核

      触发方式:
      - `转换\s*(.+\.csv)\s*(?:为|到|成)?\s*json`
      - `/csv2json (.+)`

      验证结果:
      - 语法验证: ✅
      - 类型检查: ✅
      - 安全审查: ✅
```

#### 场景2：自动修复失败的任务

```
用户: 帮我分析这个PDF文件

系统: ❌ 无法直接处理PDF文件

      🔍 系统已识别能力缺口:
      - 描述: PDF文件解析和内容提取
      - 类别: file-processing
      - 复杂度: medium

      🧪 正在自动生成相关技能...
```

## 配置选项

```typescript
const config: EvolutionConfig = {
  // 是否启用自动进化
  autoEvolve: true,

  // 生成配置
  generation: {
    model: 'claude-sonnet-4-20250514',  // 使用的LLM模型
    maxIterations: 3,                    // 最大重试次数
    timeout: 120000,                     // 超时时间(ms)
  },

  // 验证配置
  validation: {
    runTests: true,          // 运行测试
    typeCheck: true,         // 类型检查
    securityReview: true,    // 安全审查
    minTestCoverage: 0.8,    // 最小测试覆盖率
  },

  // 部署配置
  deployment: {
    autoApprove: false,      // 自动批准（建议false）
    sandboxFirst: true,      // 先在沙箱测试
    notifyOnDeploy: true,    // 部署时通知
  },

  // 安全配置
  security: {
    allowedPermissions: ['file:read', 'file:write', 'network:http'],
    blockedPatterns: ['eval\\(', 'Function\\(', 'child_process'],
    requireReview: true,     // 需要人工审核
  },
};
```

## 安全机制

### 代码安全检查

自动检测以下危险模式：

| 风险级别 | 模式 | 说明 |
|----------|------|------|
| CRITICAL | `eval()` | 代码注入风险 |
| CRITICAL | `new Function()` | 动态代码执行 |
| HIGH | `child_process` | 系统命令执行 |
| MEDIUM | `require('fs')` | 文件系统访问 |
| MEDIUM | `process.env` | 环境变量访问 |
| LOW | `.exec()` | 正则DoS风险 |

### 权限控制

技能必须声明所需权限，超出允许范围的权限将被拒绝：

```typescript
enum Permission {
  FILE_READ = 'file:read',
  FILE_WRITE = 'file:write',
  FILE_DELETE = 'file:delete',
  PROCESS_SPAWN = 'process:spawn',
  NETWORK_HTTP = 'network:http',
  SYSTEM_ENV = 'system:env',
  MODEL_EXPENSIVE = 'model:expensive',
}
```

## 文件结构

```
clawdbot/
├── src/
│   ├── evolution/                    # 自进化模块
│   │   ├── index.ts                  # 模块导出
│   │   ├── self-evolution-engine.ts  # 核心引擎
│   │   ├── skill-generator.ts        # 技能生成器
│   │   ├── skill-compiler.ts         # 代码编译器
│   │   ├── skill-validator.ts        # 验证器
│   │   └── skill-repository.ts       # 持久化仓库
│   ├── skills/
│   │   ├── evolution-skill.ts        # 自进化交互技能
│   │   └── ...
│   └── types/
│       └── evolution.ts              # 类型定义
└── evolved_skills/                   # 自动生成的技能存储
    ├── repository-index.json         # 技能索引
    ├── skills/                       # TypeScript源码
    │   └── *.ts
    └── templates/                    # Markdown模板
        └── *.md
```

## 技术亮点

1. **零人工干预**: Agent边执行任务边给自己造工具
2. **即时编译**: 自然语言需求 → Skill模板 → 可执行代码
3. **能力自举**: 用"skill-writing skill"让AI写skill，实现自我迭代
4. **安全可控**: 多层验证机制，确保生成代码的安全性
5. **惰性加载**: 按需加载，不占用上下文资源

## 未来规划

- [ ] Skill市场 - 共享和发布生成的技能
- [ ] A/B测试 - 对比不同版本的技能效果
- [ ] 性能监控 - 追踪技能执行效率
- [ ] 协作进化 - 多Agent协同生成复杂技能
- [ ] 跨平台同步 - 在不同部署间同步技能

---

*让AI像"钻木取火的猩猩"一样，从被动使用工具进化到主动创造工具。*
