/**
 * OpenLiate Catalog — Vercel Serverless & Daemon Module Entrypoint
 * Powered by official '@vercel/sdk' and Vercel MCP.
 */

export * from "./oauth";
import { Vercel as VercelSDK } from "@vercel/sdk";
import { VercelMcpOAuth, VercelMcpClient, runVercelLinkFlow } from "./oauth";
import { ConfigManager } from "../../core/config";

export { Vercel as VercelSDK } from "@vercel/sdk";

/**
 * Universal Vercel Catalog Facade
 */
export class Vercel {
  public static readonly oauth = VercelMcpOAuth;

  public static client(token?: string): VercelMcpClient {
    return new VercelMcpClient(token);
  }

  public static sdk(bearerToken?: string): VercelSDK {
    const token =
      bearerToken ||
      process.env.VERCEL_TOKEN ||
      VercelMcpOAuth.loadSavedToken()?.access_token ||
      ConfigManager.getKey("VERCEL_TOKEN") ||
      "";
    return new VercelSDK({ bearerToken: token });
  }

  public static deploy(key?: string, isDaemon: boolean = false) {
    return runVercelLinkFlow(key, isDaemon);
  }
}
