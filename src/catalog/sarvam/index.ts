/**
 * OpenLiate Catalog — Sarvam AI Sovereign Module Entrypoint
 * Real, official Sarvam AI SDK ('sarvamai' v1.1.15)
 */

export * from "./models";
export * from "./client";

export { SarvamAIClient, SarvamAIError } from "sarvamai";
import { SarvamCatalogClient } from "./client";
import { SARVAM_MODELS } from "./models";

/**
 * Universal Sarvam Catalog Facade
 */
export class Sarvam {
  public static readonly models = SARVAM_MODELS;

  /**
   * Creates a live SarvamCatalogClient wrapping official SarvamAIClient
   */
  public static client(apiKey?: string): SarvamCatalogClient {
    return new SarvamCatalogClient(apiKey);
  }
}
