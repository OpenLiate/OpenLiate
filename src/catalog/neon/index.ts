/**
 * OpenLiate Catalog — Neon Cloud Module Entrypoint
 * Powered by official '@neondatabase/serverless' and Neon MCP.
 */

export * from "./pg";
export * from "./pgvector";
export * from "./oauth";

import { NeonDatabase, type NeonDatabaseConfig } from "./pg";
import { NeonVectorStore } from "./pgvector";
import { NeonMcpOAuth, NeonMcpClient } from "./oauth";

export { neon, Pool, Client } from "@neondatabase/serverless";

/**
 * Universal Neon Catalog Facade
 */
export class Neon {
  public static db(config?: NeonDatabaseConfig): NeonDatabase {
    return new NeonDatabase(config);
  }

  public static vector(db: NeonDatabase, tableName?: string): NeonVectorStore {
    return new NeonVectorStore(db, tableName);
  }

  public static readonly mcp = {
    oauth: NeonMcpOAuth,
    client: (token?: string) => new NeonMcpClient(token)
  };
}

