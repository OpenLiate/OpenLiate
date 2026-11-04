/**
 * OpenLiate Catalog — Supabase Edge & Database Entrypoint
 * Powered by official '@supabase/supabase-js' SDK and Supabase MCP.
 */

export * from "./client";
export * from "./oauth";

import { SupabaseDatabase, type SupabaseConfig } from "./client";
import { SupabaseMcpOAuth, SupabaseMcpClient, runSupabaseLinkFlow } from "./oauth";

export { createClient } from "@supabase/supabase-js";

/**
 * Universal Supabase Catalog Facade
 */
export class Supabase {
  public static db(config?: SupabaseConfig): SupabaseDatabase {
    return new SupabaseDatabase(config);
  }

  public static readonly oauth = SupabaseMcpOAuth;

  public static client(token?: string): SupabaseMcpClient {
    return new SupabaseMcpClient(token);
  }

  public static deploy(key?: string) {
    return runSupabaseLinkFlow(key);
  }
}

