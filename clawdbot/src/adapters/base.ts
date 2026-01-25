// 适配器基类

import type { UnifiedMessage, MessageContent, Platform } from '../types/index.js';

export type MessageHandler = (message: UnifiedMessage) => Promise<string | null>;

export abstract class BaseAdapter {
  abstract platform: Platform;

  // 生命周期
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  // 消息处理
  abstract onMessage(handler: MessageHandler): void;
  abstract sendMessage(channelId: string, content: MessageContent): Promise<void>;

  // 统一格式转换
  protected abstract toUnified(raw: unknown): UnifiedMessage;
}
