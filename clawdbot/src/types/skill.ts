// 技能系统类型定义

import type { UnifiedMessage, MessageResponse } from './message.js';

export enum Permission {
  FILE_READ = 'file:read',
  FILE_WRITE = 'file:write',
  FILE_DELETE = 'file:delete',
  PROCESS_SPAWN = 'process:spawn',
  NETWORK_HTTP = 'network:http',
  SYSTEM_ENV = 'system:env',
  MODEL_EXPENSIVE = 'model:expensive',
}

export interface SkillManifest {
  name: string;
  version: string;
  description: string;
  author: string;

  triggers: {
    patterns: string[];
    intents: string[];
    commands: string[];
  };

  permissions: Permission[];

  limits: {
    timeout: number;
    memory: number;
    fileAccess: string[];
    networkAccess: string[];
  };
}

export interface Entity {
  type: string;
  value: string;
  start?: number;
  end?: number;
}

export interface IntentResult {
  skill: string;
  confidence: number;
  entities: Entity[];
  params: Record<string, unknown>;
}

export interface SkillResult {
  success: boolean;
  data?: unknown;
  error?: string;
  response?: MessageResponse;
  followUp?: {
    suggestions: string[];
  };
}

export interface ConversationContext {
  sessionId: string;
  userId: string;
  platform: string;
  history: UnifiedMessage[];
  variables: Record<string, unknown>;
}
