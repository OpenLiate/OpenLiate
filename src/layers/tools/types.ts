import type { AgentContext } from "../agent/types";

export interface LlmToolSchema {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface McpServerConfig {
  id: string;
  name: string;
  description?: string;
  transport?: "stdio" | "sse" | "http";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface ToolExecutorResult {
  toolName: string;
  result: string;
  error?: string;
}

export interface ParsedToolSpec {
  raw: string;
  isMcp: boolean;
  isBuiltin?: boolean;
  serverName?: string;
  selectedTools?: string[];
}

