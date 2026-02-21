// CLI 适配器 - 命令行交互

import * as readline from 'readline';
import chalk from 'chalk';
import { BaseAdapter, type MessageHandler } from './base.js';
import type { UnifiedMessage, MessageContent, Platform } from '../types/index.js';

export class CLIAdapter extends BaseAdapter {
  platform: Platform = 'cli';
  private rl: readline.Interface | null = null;
  private handler: MessageHandler | null = null;
  private messageCounter = 0;

  async connect(): Promise<void> {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log(chalk.cyan('\n╔════════════════════════════════════════╗'));
    console.log(chalk.cyan('║') + chalk.bold.white('        Clawdbot CLI v1.0.0            ') + chalk.cyan('║'));
    console.log(chalk.cyan('╠════════════════════════════════════════╣'));
    console.log(chalk.cyan('║') + chalk.gray(' 输入消息与 AI 交互，输入 /quit 退出   ') + chalk.cyan('║'));
    console.log(chalk.cyan('╚════════════════════════════════════════╝\n'));

    this.startInputLoop();
  }

  async disconnect(): Promise<void> {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    console.log(chalk.yellow('\n再见！'));
  }

  onMessage(handler: MessageHandler): void {
    this.handler = handler;
  }

  async sendMessage(_channelId: string, content: MessageContent): Promise<void> {
    if (content.text) {
      console.log(chalk.green('\n🤖 ') + chalk.white(content.text) + '\n');
    }
  }

  protected toUnified(raw: string): UnifiedMessage {
    this.messageCounter++;

    // 检查是否是命令
    const isCommand = raw.startsWith('/');

    return {
      id: `cli-${Date.now()}-${this.messageCounter}`,
      platform: 'cli',
      channelId: 'terminal',
      userId: 'local-user',
      content: isCommand
        ? {
            type: 'command',
            text: raw,
            command: {
              name: raw.split(' ')[0].slice(1),
              args: raw.split(' ').slice(1),
              raw,
            },
          }
        : {
            type: 'text',
            text: raw,
          },
      timestamp: new Date(),
      metadata: {},
    };
  }

  private startInputLoop(): void {
    const prompt = () => {
      this.rl?.question(chalk.blue('你: '), async (input) => {
        const trimmed = input.trim();

        if (!trimmed) {
          prompt();
          return;
        }

        // 退出命令
        if (trimmed === '/quit' || trimmed === '/exit') {
          await this.disconnect();
          process.exit(0);
        }

        // 帮助命令
        if (trimmed === '/help') {
          this.printHelp();
          prompt();
          return;
        }

        // 调用消息处理器
        if (this.handler) {
          const message = this.toUnified(trimmed);

          console.log(chalk.gray('思考中...'));

          try {
            const response = await this.handler(message);
            if (response) {
              console.log(chalk.green('\n🤖 ') + response + '\n');
            }
          } catch (error) {
            console.error(chalk.red('\n❌ 错误: ') + (error as Error).message + '\n');
          }
        }

        prompt();
      });
    };

    prompt();
  }

  private printHelp(): void {
    console.log(chalk.cyan('\n可用命令:'));
    console.log(chalk.white('  /help      ') + chalk.gray('显示帮助'));
    console.log(chalk.white('  /quit      ') + chalk.gray('退出程序'));
    console.log(chalk.white('  /stock     ') + chalk.gray('股票分析 (例: /stock 比亚迪)'));
    console.log(chalk.white('  /team      ') + chalk.gray('多 Agent 协作 (例: /team 分析A股趋势)'));
    console.log(chalk.white('  /agents    ') + chalk.gray('列出可用 Agent'));
    console.log(chalk.cyan('\n直接输入文字与 AI 对话\n'));
  }
}
