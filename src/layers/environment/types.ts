export interface EnvironmentSecrets {
  [key: string]: string | undefined;
}

export interface SandboxGuardrails {
  maxExecutionTimeMs?: number;
  allowedDomains?: string[];
  blockNetwork?: boolean;
}

export interface ResolvedEnvironment {
  secrets: Record<string, string>;
  guardrails: SandboxGuardrails;
}

export interface SandboxConfig {
  allowedDomains: string[];
  denyNetwork: boolean;
  timeoutMs?: number;
  maxExecutionTimeMs?: number;
  env: Record<string, string>;
}

