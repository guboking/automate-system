#!/usr/bin/env python3
"""
DeepSeek MCP Server for Claude Code

Provides DeepSeek API integration for:
- Cross-validation of conclusions
- Batch processing of stock data
- Mathematical/logical reasoning (R1 model)
"""

import os
import sys
import json
import asyncio
from typing import Any

# MCP Protocol implementation using stdio
import httpx

# Configuration
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
DEEPSEEK_API_BASE = "https://api.deepseek.com/v1"

# Available models
MODELS = {
    "chat": "deepseek-chat",       # General purpose, fast
    "coder": "deepseek-coder",     # Code-focused
    "r1": "deepseek-reasoner",     # Deep reasoning (R1)
}


async def call_deepseek(
    prompt: str,
    model: str = "deepseek-chat",
    system_prompt: str = "",
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> dict[str, Any]:
    """Call DeepSeek API with given prompt."""

    if not DEEPSEEK_API_KEY:
        return {"error": "DEEPSEEK_API_KEY environment variable not set"}

    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            response = await client.post(
                f"{DEEPSEEK_API_BASE}/chat/completions",
                headers={
                    "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                },
            )
            response.raise_for_status()
            data = response.json()

            return {
                "content": data["choices"][0]["message"]["content"],
                "model": model,
                "usage": data.get("usage", {}),
            }
        except httpx.HTTPStatusError as e:
            return {"error": f"API error: {e.response.status_code} - {e.response.text}"}
        except Exception as e:
            return {"error": f"Request failed: {str(e)}"}


async def verify_conclusion(
    conclusion: str,
    context: str = "",
) -> dict[str, Any]:
    """Use DeepSeek to verify a conclusion with cross-validation."""

    system = """You are a fact-checker and logical validator.
Analyze the given conclusion and provide:
1. Whether the conclusion is logically sound
2. Any factual errors or questionable claims
3. Alternative interpretations
4. Confidence level (high/medium/low)
Be concise but thorough."""

    prompt = f"""Please verify this conclusion:

{conclusion}

{"Context: " + context if context else ""}

Provide your analysis in a structured format."""

    return await call_deepseek(prompt, system_prompt=system, temperature=0.3)


async def batch_process(
    items: list[str],
    task: str,
    output_format: str = "table",
) -> dict[str, Any]:
    """Process multiple items in batch with DeepSeek."""

    format_instructions = {
        "table": "Output as a markdown table",
        "json": "Output as JSON array",
        "list": "Output as numbered list with key points",
    }

    system = f"""You are a data processing assistant.
{format_instructions.get(output_format, format_instructions['table'])}
Be efficient and consistent in your output format."""

    items_text = "\n".join(f"- {item}" for item in items)
    prompt = f"""Task: {task}

Items to process:
{items_text}

Process all items and output in the requested format."""

    return await call_deepseek(prompt, system_prompt=system, temperature=0.2, max_tokens=8192)


async def calculate(
    problem: str,
    show_steps: bool = True,
) -> dict[str, Any]:
    """Use DeepSeek R1 for mathematical/financial calculations."""

    model = MODELS["r1"]

    system = """You are a quantitative analyst.
Solve mathematical and financial problems with precision.
Show your work step by step.
Double-check calculations before providing final answers."""

    prompt = problem
    if show_steps:
        prompt += "\n\nPlease show detailed calculation steps."

    return await call_deepseek(prompt, model=model, system_prompt=system, temperature=0.1)


# MCP Server Implementation
class MCPServer:
    """Simple MCP server using stdio."""

    def __init__(self):
        self.tools = {
            "deepseek_chat": {
                "description": "Send a prompt to DeepSeek for general chat/analysis",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "prompt": {"type": "string", "description": "The prompt to send"},
                        "model": {
                            "type": "string",
                            "enum": ["deepseek-chat", "deepseek-coder", "deepseek-reasoner"],
                            "default": "deepseek-chat",
                            "description": "Model to use"
                        },
                        "system_prompt": {"type": "string", "description": "Optional system prompt"},
                        "temperature": {"type": "number", "default": 0.7},
                    },
                    "required": ["prompt"],
                },
            },
            "deepseek_verify": {
                "description": "Verify a conclusion using DeepSeek for cross-validation",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "conclusion": {"type": "string", "description": "The conclusion to verify"},
                        "context": {"type": "string", "description": "Additional context"},
                    },
                    "required": ["conclusion"],
                },
            },
            "deepseek_batch": {
                "description": "Process multiple items in batch (e.g., 50 stocks)",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "items": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "List of items to process"
                        },
                        "task": {"type": "string", "description": "Task to perform on each item"},
                        "output_format": {
                            "type": "string",
                            "enum": ["table", "json", "list"],
                            "default": "table"
                        },
                    },
                    "required": ["items", "task"],
                },
            },
            "deepseek_calculate": {
                "description": "Use DeepSeek R1 for mathematical/financial calculations",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "problem": {"type": "string", "description": "The math/finance problem"},
                        "show_steps": {"type": "boolean", "default": True},
                    },
                    "required": ["problem"],
                },
            },
        }

    async def handle_request(self, request: dict) -> dict:
        """Handle incoming MCP request."""
        method = request.get("method", "")
        req_id = request.get("id")
        params = request.get("params", {})

        if method == "initialize":
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {"tools": {}},
                    "serverInfo": {"name": "deepseek-mcp", "version": "1.0.0"},
                },
            }

        elif method == "tools/list":
            tools_list = [
                {"name": name, **spec} for name, spec in self.tools.items()
            ]
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {"tools": tools_list},
            }

        elif method == "tools/call":
            tool_name = params.get("name", "")
            arguments = params.get("arguments", {})

            try:
                result = await self.execute_tool(tool_name, arguments)
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False, indent=2)}]
                    },
                }
            except Exception as e:
                return {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {"code": -32000, "message": str(e)},
                }

        elif method == "notifications/initialized":
            return None  # No response for notifications

        else:
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "error": {"code": -32601, "message": f"Method not found: {method}"},
            }

    async def execute_tool(self, name: str, args: dict) -> dict:
        """Execute a tool and return result."""

        if name == "deepseek_chat":
            return await call_deepseek(
                prompt=args["prompt"],
                model=args.get("model", "deepseek-chat"),
                system_prompt=args.get("system_prompt", ""),
                temperature=args.get("temperature", 0.7),
            )

        elif name == "deepseek_verify":
            return await verify_conclusion(
                conclusion=args["conclusion"],
                context=args.get("context", ""),
            )

        elif name == "deepseek_batch":
            return await batch_process(
                items=args["items"],
                task=args["task"],
                output_format=args.get("output_format", "table"),
            )

        elif name == "deepseek_calculate":
            return await calculate(
                problem=args["problem"],
                show_steps=args.get("show_steps", True),
            )

        else:
            raise ValueError(f"Unknown tool: {name}")

    async def run(self):
        """Run the MCP server using stdio."""
        reader = asyncio.StreamReader()
        protocol = asyncio.StreamReaderProtocol(reader)
        await asyncio.get_event_loop().connect_read_pipe(lambda: protocol, sys.stdin)

        writer_transport, writer_protocol = await asyncio.get_event_loop().connect_write_pipe(
            asyncio.streams.FlowControlMixin, sys.stdout
        )
        writer = asyncio.StreamWriter(writer_transport, writer_protocol, reader, asyncio.get_event_loop())

        while True:
            try:
                line = await reader.readline()
                if not line:
                    break

                request = json.loads(line.decode())
                response = await self.handle_request(request)

                if response:
                    writer.write((json.dumps(response) + "\n").encode())
                    await writer.drain()

            except json.JSONDecodeError:
                continue
            except Exception as e:
                error_response = {
                    "jsonrpc": "2.0",
                    "id": None,
                    "error": {"code": -32700, "message": f"Parse error: {str(e)}"},
                }
                writer.write((json.dumps(error_response) + "\n").encode())
                await writer.drain()


def main():
    """Entry point."""
    server = MCPServer()
    asyncio.run(server.run())


if __name__ == "__main__":
    main()
