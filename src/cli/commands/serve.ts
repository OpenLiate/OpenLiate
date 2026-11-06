import { EnvironmentResolver } from "../../layers/environment/sandbox";
import { startRuntimeServer } from "../../cloud/runtime/hono";

export async function handleServeCommand(args: string[]): Promise<void> {
  let port = 7071;
  const portIdx = args.indexOf("--port");
  if (portIdx !== -1 && args[portIdx + 1]) {
    port = parseInt(args[portIdx + 1], 10) || 7071;
  }

  EnvironmentResolver.loadEnv();
  startRuntimeServer({ port });
  console.log(`Ready to serve autonomous agents via HTTP cURL, Webhooks, Python SDK, and LAPI endpoints.`);
}

