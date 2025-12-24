# DeepSeek MCP Server

Claude Code 的 DeepSeek API 集成，提供验证和批量处理能力。

## 功能

| 工具 | 用途 | 模型 |
|------|------|------|
| `deepseek_chat` | 通用对话/分析 | deepseek-chat |
| `deepseek_verify` | 结论交叉验证 | deepseek-chat |
| `deepseek_batch` | 批量数据处理 | deepseek-chat |
| `deepseek_calculate` | 数学/金融计算 | deepseek-reasoner (R1) |

## 安装

```bash
# 安装依赖
pip install -r mcp_servers/requirements.txt

# 配置 API Key
export DEEPSEEK_API_KEY="sk-your-key-here"
```

## 配置

API Key 获取：https://platform.deepseek.com/

在 `.mcp.json` 中已配置：

```json
{
  "mcpServers": {
    "deepseek": {
      "command": "python3",
      "args": ["mcp_servers/deepseek_mcp.py"],
      "env": {
        "DEEPSEEK_API_KEY": "${DEEPSEEK_API_KEY}"
      }
    }
  }
}
```

## 使用示例

在 Claude Code 中：

```
"帮我用 DeepSeek 验证一下这个结论对不对"
→ 调用 deepseek_verify

"把这 50 只股票的基本面数据整理成表格"
→ 调用 deepseek_batch

"计算一下这个期权的 Black-Scholes 定价"
→ 调用 deepseek_calculate (R1)
```

## 分工模式

```
Claude（主脑）
    ├→ 理解意图、规划步骤、最终输出
    └→ DeepSeek（验证+批量）
         ├→ 事实交叉验证
         ├→ 批量处理（50只股票初筛）
         └→ 数学/逻辑推理（R1）
```
