// 统一消息格式

export type Platform = 'telegram' | 'whatsapp' | 'cli' | 'web' | 'api';

export interface Attachment {
  type: 'image' | 'file' | 'audio' | 'video';
  url?: string;
  path?: string;
  name: string;
  mimeType?: string;
  size?: number;
}

export interface CommandPayload {
  name: string;
  args: string[];
  raw: string;
}

export interface MessageContent {
  type: 'text' | 'image' | 'file' | 'voice' | 'command';
  text?: string;
  attachments?: Attachment[];
  command?: CommandPayload;
}

export interface UnifiedMessage {
  id: string;
  platform: Platform;
  channelId: string;
  userId: string;
  content: MessageContent;
  timestamp: Date;
  replyTo?: string;
  metadata: Record<string, unknown>;
}

export interface MessageResponse {
  text?: string;
  markdown?: string;
  attachments?: Attachment[];
}
