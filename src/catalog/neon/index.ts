/**
 * OpenLiate Catalog — Neon Cloud Module Entrypoint
 * Powered by official '@neondatabase/serverless', 'neon-new' (Claimable Postgres),
 * Neon Schedule (Schedule a function), and Neon MCP OAuth.
 */

export * from "./pg";
export * from "./pgvector";
export * from "./claimable";
export * from "./schedule";
export * from "../../link/neon";

import { NeonDatabase, type NeonDatabaseConfig } from "./pg";
import { NeonVectorStore } from "./pgvector";
import { createClaimableDatabase, type ClaimableNeonOptions, type ClaimableNeonResult } from "./claimable";
import { createScheduledHandler, NeonScheduler, NeonTriggers, type NeonScheduledHandler } from "./schedule";
import { NeonMcpOAuth, NeonMcpClient } from "../../link/neon";

export { neon, Pool, Client } from "@neondatabase/serverless";

/**
 * Universal Neon Catalog Facade
 */
export class Neon {
  /**
   * Initializes a serverless Neon database client
   */
  public static db(config?: NeonDatabaseConfig): NeonDatabase {
    return new NeonDatabase(config);
  }

  /**
   * Initializes a pgvector semantic search store on Neon Postgres
   */
  public static vector(db: NeonDatabase, tableName?: string): NeonVectorStore {
    return new NeonVectorStore(db, tableName);
  }

  /**
   * Provisions an ephemeral 72-hour Claimable Postgres database via 'neon-new'
   * without requiring an account, credit card, or manual registration.
   */
  public static async claimable(options?: ClaimableNeonOptions): Promise<ClaimableNeonResult> {
    return createClaimableDatabase(options);
  }

  /**
   * Alias for claimable database
   */
  public static async instant(options?: ClaimableNeonOptions): Promise<ClaimableNeonResult> {
    return createClaimableDatabase(options);
  }

  /**
   * Creates a Hono-compatible route handler for Neon Scheduled Functions
   * with X-Neon-Trigger-Invocation-Id provenance verification.
   * Reference: https://neon.com/docs/compute/functions/triggers/schedule
   */
  public static schedule(handler: NeonScheduledHandler) {
    return createScheduledHandler(handler);
  }

  /**
   * Backward-compatible alias for Neon.schedule
   */
  public static scheduled(handler: NeonScheduledHandler) {
    return createScheduledHandler(handler);
  }

  /**
   * Neon Schedule & Triggers management API client
   */
  public static scheduler(apiUrl?: string): NeonScheduler {
    return new NeonScheduler(apiUrl);
  }

  /**
   * Backward-compatible alias for Neon.scheduler
   */
  public static triggers(apiUrl?: string): NeonTriggers {
    return new NeonTriggers(apiUrl);
  }

  /**
   * Neon MCP OAuth & SSE client
   */
  public static readonly mcp = {
    oauth: NeonMcpOAuth,
    client: (token?: string) => new NeonMcpClient(token)
  };
}
