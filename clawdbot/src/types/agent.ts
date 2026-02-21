// Agent Teams 类型定义

export type AgentRole = 'coordinator' | 'researcher' | 'analyst' | 'executor' | 'custom';

export interface AgentProfile {
  id: string;
  name: string;
  role: AgentRole;
  description: string;
  systemPrompt: string;
  capabilities: string[];
  model?: string;
}

export interface AgentMessage {
  from: string;       // agent id
  to: string;         // agent id or 'team' for broadcast
  type: 'task' | 'result' | 'question' | 'info';
  content: string;
  data?: unknown;
  timestamp: Date;
}

export interface TaskPlan {
  goal: string;
  steps: TaskStep[];
}

export interface TaskStep {
  id: string;
  description: string;
  assignee: string;   // agent role
  dependencies: string[]; // step ids that must complete first
  status: 'pending' | 'running' | 'done' | 'failed';
  result?: string;
}

export interface TeamConfig {
  name: string;
  description: string;
  agents: AgentProfile[];
  maxRounds: number;   // prevent infinite loops
}

export interface TeamResult {
  success: boolean;
  goal: string;
  output: string;
  agentOutputs: Record<string, string>;
  rounds: number;
  error?: string;
}
