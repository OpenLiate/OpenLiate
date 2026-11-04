import { describe, it, expect } from "bun:test";
import { DEFAULT_JOIN_CALLBACK_PORT, JOIN_PORTAL_URL } from "../../src/cli/commands/join";
import { ConfigManager } from "../../src/core/config";

describe("OpenLiate Join & Workspace Setup", () => {
  it("exposes default join port and portal URL", () => {
    expect(DEFAULT_JOIN_CALLBACK_PORT).toBe(54324);
    expect(JOIN_PORTAL_URL).toBe("https://openliate.tech/join");
  });

  it("saves gateway and developer handle configuration", () => {
    const config = ConfigManager.readSystemConfig();
    (config as any).username = "developer";
    (config as any).slot = "openliate.tech/@developer";
    (config as any).primaryGateway = "sarvam";
    ConfigManager.writeSystemConfig(config);

    const reloaded = ConfigManager.readSystemConfig();
    expect((reloaded as any).primaryGateway).toBe("sarvam");
    expect((reloaded as any).slot).toBe("openliate.tech/@developer");
  });
});
