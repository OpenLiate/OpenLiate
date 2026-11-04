/**
 * OpenLiate Catalog — OmniRoute Free Token Gateway Entrypoint
 */

export * from "./models";
export * from "./gateway";

import { OmniRouteGatewayClient } from "./gateway";
import { OMNIROUTE_MODELS } from "./models";

/**
 * Universal OmniRoute Catalog Facade
 */
export class OmniRoute {
  public static readonly models = OMNIROUTE_MODELS;

  public static gateway(apiKey?: string, baseUrl?: string): OmniRouteGatewayClient {
    return new OmniRouteGatewayClient(apiKey, baseUrl);
  }
}

