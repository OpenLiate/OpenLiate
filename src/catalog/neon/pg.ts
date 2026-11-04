/**
 * OpenLiate Catalog — Neon Serverless Postgres Client
 * Powered by the official '@neondatabase/serverless' SDK.
 */

import { neon, Pool, Client, type NeonQueryFunction } from "@neondatabase/serverless";
import { ConfigManager } from "../../core/config";

export interface NeonDatabaseConfig {
  connectionString?: string;
  projectId?: string;
}

export class NeonDatabase {
  private connectionString: string;
  private sqlQuery?: NeonQueryFunction<false, false>;

  constructor(config: NeonDatabaseConfig = {}) {
    this.connectionString =
      config.connectionString ||
      process.env.DATABASE_URL ||
      process.env.NEON_DATABASE_URL ||
      ConfigManager.getKey("DATABASE_URL") ||
      ConfigManager.getKey("NEON_DATABASE_URL") ||
      "";
  }

  /**
   * Returns a fast tagged template SQL executor over HTTP/WebSocket
   */
  public get sql() {
    if (!this.sqlQuery) {
      if (!this.connectionString) {
        throw new Error(
          "Missing Neon DATABASE_URL. Run 'openliate link --neon' or 'openliate env set DATABASE_URL=\"postgresql://...\"'."
        );
      }
      this.sqlQuery = neon(this.connectionString);
    }
    return this.sqlQuery;
  }

  /**
   * Creates a connection pool for complex multi-query sessions
   */
  public createPool(): Pool {
    if (!this.connectionString) {
      throw new Error("Missing Neon DATABASE_URL.");
    }
    return new Pool({ connectionString: this.connectionString });
  }

  /**
   * Initializes persistent agent sessions table in Neon Postgres
   */
  public async initSessionTable(tableName: string = "openliate_agent_sessions"): Promise<void> {
    const query = this.sql;
    await query`
      CREATE TABLE IF NOT EXISTS openliate_agent_sessions (
        session_id VARCHAR(255) PRIMARY KEY,
        agent_name VARCHAR(255) NOT NULL,
        state JSONB DEFAULT '{}'::jsonb,
        messages JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
  }
}

