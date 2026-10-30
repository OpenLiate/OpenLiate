export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface AgentMessage {
  role: MessageRole;
  content: string;
  name?: string;
  toolCallId?: string;
  reasoningContent?: string;
  timestamp?: number;
}

export interface SessionData {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
  messages: AgentMessage[];
  state: Record<string, any>;
}

export interface MemoryProvider {
  readonly sessionId: string;
  load(): Promise<SessionData>;
  save(): Promise<void>;
  getMessages(): AgentMessage[];
  append(message: AgentMessage | AgentMessage[]): Promise<void>;
  getState(key: string): any;
  setState(key: string, value: any): Promise<void>;
  clear(): Promise<void>;
}
