/**
 * OpenLiate Catalog — Neon pgvector Memory & Semantic Search
 * Powered by official '@neondatabase/serverless' and Postgres pgvector extension.
 */

import { NeonDatabase } from "./pg";

export interface VectorEmbeddingItem {
  id: string;
  agentName: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, any>;
}

export class NeonVectorStore {
  private db: NeonDatabase;
  private tableName: string;

  constructor(db: NeonDatabase, tableName: string = "openliate_agent_embeddings") {
    this.db = db;
    this.tableName = tableName;
  }

  /**
   * Enables pgvector extension and creates vector embeddings table
   */
  public async init(dimensions: number = 1536): Promise<void> {
    const query = this.db.sql;
    await query`CREATE EXTENSION IF NOT EXISTS vector;`;
    
    // We execute table creation query
    await query`
      CREATE TABLE IF NOT EXISTS openliate_agent_embeddings (
        id VARCHAR(255) PRIMARY KEY,
        agent_name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        embedding vector(1536),
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
  }
}

