/**
 * OpenLiate Catalog — Neon Scheduled Function Triggers
 * Reference: https://neon.com/docs/compute/functions/triggers/schedule
 * 
 * Enables scheduled function execution right next to Neon Postgres compute.
 * Provides Hono scheduled route handlers with attestation validation,
 * cron validation, and programmatic trigger management via the Neon API.
 */

export interface NeonScheduledPayload<T = Record<string, any>> {
  data: {
    scheduled_at: string;
    [key: string]: any;
  };
  trigger?: string;
  invocation_id?: string;
}

export interface NeonScheduledContext<T = Record<string, any>> {
  scheduledAt: string;
  invocationId?: string;
  trigger?: string;
  data: T;
  rawBody: NeonScheduledPayload<T>;
  headers: Record<string, string>;
  c: any;
}

export type NeonScheduledHandler = (
  event: NeonScheduledContext
) => Promise<any> | any;

/**
 * Creates a Hono-compatible route handler for scheduled Neon Function Triggers.
 * Neon delivers scheduled triggers as unauthenticated POST requests with the
 * 'X-Neon-Trigger-Invocation-Id' header, which attests the call originated from Neon.
 */
export function createScheduledHandler(handler: NeonScheduledHandler) {
  return async (c: any) => {
    // 1. Attestation Check: Neon strips client-set X-Neon-* headers,
    // so the presence of X-Neon-Trigger-Invocation-Id confirms trigger provenance.
    const invocationId =
      c.req.header("x-neon-trigger-invocation-id") ||
      c.req.header("X-Neon-Trigger-Invocation-Id");

    if (!invocationId) {
      return c.json({ error: "not a trigger call" }, 403);
    }

    // 2. Parse scheduled occurrence payload
    let body: NeonScheduledPayload;
    try {
      body = await c.req.json();
    } catch {
      body = { data: { scheduled_at: new Date().toISOString() } };
    }

    const scheduledAt = body?.data?.scheduled_at || new Date().toISOString();
    const trigger = body?.trigger;

    // 3. Collect headers
    const headers: Record<string, string> = {};
    if (typeof c.req.header === "function") {
      headers["x-neon-trigger-invocation-id"] = invocationId;
    }

    // 4. Execute scheduled task
    const result = await handler({
      scheduledAt,
      invocationId,
      trigger,
      data: (body?.data || {}) as any,
      rawBody: body,
      headers,
      c
    });

    return c.json({
      ok: true,
      scheduled_at: scheduledAt,
      invocation_id: invocationId,
      result: result ?? null
    });
  };
}

export interface NeonTriggerSchedule {
  cron: string;
}

export interface NeonTriggerRecord {
  type: "schedule" | "object_storage";
  trigger_id: string;
  function_slug: string;
  name: string;
  function_path: string;
  schedule?: NeonTriggerSchedule;
  enabled: boolean;
  version: number;
  next_run_at: string | null;
  inherited: boolean;
}

export interface CreateScheduleTriggerOptions {
  projectId?: string;
  branchId?: string;
  functionSlug: string;
  name: string;
  cron: string;
  functionPath?: string;
  enabled?: boolean;
  apiKey?: string;
  apiUrl?: string;
}

export interface TriggerQueryOptions {
  projectId?: string;
  branchId?: string;
  apiKey?: string;
  apiUrl?: string;
}

/**
 * Validates a five-field numeric cron expression for Neon Function Triggers.
 * Neon requires strictly five numeric fields (minute, hour, day of month, month, day of week) in UTC.
 */
export function validateNeonCron(cron: string): { valid: boolean; error?: string } {
  if (!cron || typeof cron !== "string") {
    return { valid: false, error: "Cron expression is required" };
  }

  // Neon disallows macros like @daily or @hourly
  if (cron.trim().startsWith("@")) {
    return { valid: false, error: "cron: macro expressions (@daily, @hourly) are not supported" };
  }

  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    if (parts.length === 6) {
      return { valid: false, error: "cron: seconds field (* * * * * *) is not supported, use 5 fields" };
    }
    return { valid: false, error: `cron: expected 5 fields, received ${parts.length}` };
  }

  // Check for step 0
  if (cron.includes("/0")) {
    return { valid: false, error: "cron: zero step (*/0) is invalid" };
  }

  // Check for named month/day
  const alphaRegex = /[a-zA-Z]/;
  if (alphaRegex.test(cron)) {
    return { valid: false, error: "cron: named days or months (e.g. MON, JAN) are not supported, use numeric fields" };
  }

  return { valid: true };
}

/**
 * Neon Triggers Management Client
 * Communicates with Neon Console API ($API/projects/$PROJECT_ID/branches/$BRANCH_ID/triggers)
 */
export class NeonTriggers {
  private defaultApiUrl: string;

  constructor(apiUrl: string = "https://console.neon.tech/api/v2") {
    this.defaultApiUrl = apiUrl;
  }

  private resolveAuth(opts: { apiKey?: string; projectId?: string; branchId?: string }) {
    const apiKey = opts.apiKey || process.env.NEON_API_KEY;
    const projectId = opts.projectId || process.env.PROJECT_ID || process.env.NEON_PROJECT_ID;
    const branchId = opts.branchId || process.env.BRANCH_ID || process.env.NEON_BRANCH_ID;

    if (!apiKey) {
      throw new Error("Missing NEON_API_KEY for Neon Triggers API operations.");
    }
    if (!projectId) {
      throw new Error("Missing PROJECT_ID for Neon Triggers API operations.");
    }
    if (!branchId) {
      throw new Error("Missing BRANCH_ID for Neon Triggers API operations.");
    }

    return { apiKey, projectId, branchId };
  }

  /**
   * Creates a scheduled function trigger via the Neon API
   */
  public async createScheduleTrigger(
    options: CreateScheduleTriggerOptions
  ): Promise<{ trigger: NeonTriggerRecord }> {
    const cronCheck = validateNeonCron(options.cron);
    if (!cronCheck.valid) {
      throw new Error(`Invalid cron for Neon schedule trigger: ${cronCheck.error}`);
    }

    const { apiKey, projectId, branchId } = this.resolveAuth(options);
    const apiUrl = options.apiUrl || this.defaultApiUrl;
    const url = `${apiUrl}/projects/${projectId}/branches/${branchId}/triggers`;

    const payload = {
      type: "schedule",
      function_slug: options.functionSlug,
      name: options.name,
      schedule: { cron: options.cron },
      function_path: options.functionPath || "/",
      enabled: options.enabled ?? true
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Neon create trigger failed (${res.status}): ${err}`);
    }

    return res.json();
  }

  /**
   * Lists all function triggers configured on a Neon branch
   */
  public async listTriggers(
    options: TriggerQueryOptions = {}
  ): Promise<{ triggers: NeonTriggerRecord[] }> {
    const { apiKey, projectId, branchId } = this.resolveAuth(options);
    const apiUrl = options.apiUrl || this.defaultApiUrl;
    const url = `${apiUrl}/projects/${projectId}/branches/${branchId}/triggers`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Neon list triggers failed (${res.status}): ${err}`);
    }

    return res.json();
  }

  /**
   * Retrieves a single trigger by ID
   */
  public async getTrigger(
    triggerId: string,
    options: TriggerQueryOptions = {}
  ): Promise<{ trigger: NeonTriggerRecord }> {
    const { apiKey, projectId, branchId } = this.resolveAuth(options);
    const apiUrl = options.apiUrl || this.defaultApiUrl;
    const url = `${apiUrl}/projects/${projectId}/branches/${branchId}/triggers/${triggerId}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Neon get trigger failed (${res.status}): ${err}`);
    }

    return res.json();
  }

  /**
   * Partially updates a trigger (cron, enabled status, etc.)
   */
  public async updateTrigger(
    triggerId: string,
    patch: { cron?: string; enabled?: boolean; name?: string; functionPath?: string },
    options: TriggerQueryOptions = {}
  ): Promise<{ trigger: NeonTriggerRecord }> {
    if (patch.cron) {
      const cronCheck = validateNeonCron(patch.cron);
      if (!cronCheck.valid) {
        throw new Error(`Invalid cron for Neon schedule trigger: ${cronCheck.error}`);
      }
    }

    const { apiKey, projectId, branchId } = this.resolveAuth(options);
    const apiUrl = options.apiUrl || this.defaultApiUrl;
    const url = `${apiUrl}/projects/${projectId}/branches/${branchId}/triggers/${triggerId}`;

    const bodyPayload: any = { type: "schedule" };
    if (patch.cron) bodyPayload.schedule = { cron: patch.cron };
    if (patch.enabled !== undefined) bodyPayload.enabled = patch.enabled;
    if (patch.name) bodyPayload.name = patch.name;
    if (patch.functionPath) bodyPayload.function_path = patch.functionPath;

    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(bodyPayload)
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Neon update trigger failed (${res.status}): ${err}`);
    }

    return res.json();
  }

  /**
   * Disables a schedule trigger without deleting it
   */
  public async disableTrigger(
    triggerId: string,
    options: TriggerQueryOptions = {}
  ): Promise<{ trigger: NeonTriggerRecord }> {
    return this.updateTrigger(triggerId, { enabled: false }, options);
  }

  /**
   * Enables a disabled schedule trigger
   */
  public async enableTrigger(
    triggerId: string,
    options: TriggerQueryOptions = {}
  ): Promise<{ trigger: NeonTriggerRecord }> {
    return this.updateTrigger(triggerId, { enabled: true }, options);
  }

  /**
   * Deletes a trigger from the branch
   */
  public async deleteTrigger(
    triggerId: string,
    options: TriggerQueryOptions = {}
  ): Promise<boolean> {
    const { apiKey, projectId, branchId } = this.resolveAuth(options);
    const apiUrl = options.apiUrl || this.defaultApiUrl;
    const url = `${apiUrl}/projects/${projectId}/branches/${branchId}/triggers/${triggerId}`;

    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });

    if (!res.ok && res.status !== 204) {
      const err = await res.text();
      throw new Error(`Neon delete trigger failed (${res.status}): ${err}`);
    }

    return true;
  }
}

/**
 * Alias for NeonTriggers aligning with Neon "Schedule a function" terminology
 */
export const NeonScheduler = NeonTriggers;

