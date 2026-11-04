/**
 * OpenLiate Catalog — Claimable Neon (Instant Ephemeral Postgres)
 * Powered by official 'neon-new' and Neon Claimable Postgres protocol.
 * Ephemeral (72-hour) database provisioning without account, credit card, or sign-up.
 */

import { instantPostgres, type InstantPostgresParams } from "neon-new";
import { NeonDatabase } from "./pg";

export interface ClaimableNeonOptions {
  /**
   * Optional custom seed config (e.g. { type: 'sql-script', path: './init.sql' } or { type: 'sql', sql: '...' })
   */
  seed?: InstantPostgresParams["seed"];
  /**
   * Custom .env file location to persist DATABASE_URL (defaults to .env)
   */
  dotEnvFile?: string;
  /**
   * Custom env key (defaults to DATABASE_URL)
   */
  dotEnvKey?: string;
  /**
   * Custom env prefix
   */
  envPrefix?: string;
  /**
   * Referrer tag (defaults to 'openliate')
   */
  referrer?: string;
  /**
   * Database settings
   */
  settings?: {
    logicalReplication?: boolean;
  };
}

export interface ClaimableNeonResult {
  /**
   * Direct connection string
   */
  databaseUrlDirect: string;
  /**
   * Pooled connection string
   */
  databaseUrl: string;
  /**
   * Web URL where a human user can claim and adopt this database into their Neon organization
   */
  claimUrl: string;
  /**
   * Expiry timestamp for the ephemeral database (typically 72 hours from creation)
   */
  claimExpiresAt: Date;
  /**
   * Pre-configured OpenLiate NeonDatabase client ready to execute queries
   */
  db: NeonDatabase;
}

/**
 * Provisions a claimable ephemeral Neon Postgres database instantly.
 * No account, credit card, or manual registration required.
 * Ideal for autonomous agent testing, CLI onboarding, and temporary task execution.
 */
export async function createClaimableDatabase(
  options: ClaimableNeonOptions = {}
): Promise<ClaimableNeonResult> {
  const params: InstantPostgresParams = {
    referrer: options.referrer || "openliate",
    dotEnvFile: options.dotEnvFile,
    dotEnvKey: options.dotEnvKey,
    envPrefix: options.envPrefix,
    seed: options.seed,
    settings: options.settings || { logicalReplication: false }
  };

  const res = await instantPostgres(params);

  const db = new NeonDatabase({
    connectionString: res.databaseUrl || res.databaseUrlDirect
  });

  return {
    databaseUrlDirect: res.databaseUrlDirect,
    databaseUrl: res.databaseUrl,
    claimUrl: res.claimUrl,
    claimExpiresAt: res.claimExpiresAt,
    db
  };
}

