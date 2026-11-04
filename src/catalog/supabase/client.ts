/**
 * OpenLiate Catalog — Supabase Client & Vector Store
 * Powered by official '@supabase/supabase-js' SDK.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ConfigManager } from "../../core/config";

export interface SupabaseConfig {
  supabaseUrl?: string;
  supabaseKey?: string;
}

export class SupabaseDatabase {
  public readonly client: SupabaseClient;

  constructor(config: SupabaseConfig = {}) {
    const url =
      config.supabaseUrl ||
      process.env.SUPABASE_URL ||
      ConfigManager.getKey("SUPABASE_URL") ||
      "";
    const key =
      config.supabaseKey ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      ConfigManager.getKey("SUPABASE_ANON_KEY") ||
      "";

    if (!url || !key) {
      throw new Error(
        "Missing Supabase configuration. Provide 'supabaseUrl' and 'supabaseKey' or set SUPABASE_URL and SUPABASE_ANON_KEY."
      );
    }
    this.client = createClient(url, key);
  }

  public async getSession(sessionId: string, tableName: string = "openliate_sessions") {
    return await this.client.from(tableName).select("*").eq("session_id", sessionId).single();
  }

  public async saveSession(sessionId: string, agentName: string, state: any, messages: any, tableName: string = "openliate_sessions") {
    return await this.client.from(tableName).upsert({
      session_id: sessionId,
      agent_name: agentName,
      state,
      messages,
      updated_at: new Date().toISOString()
    });
  }
}

