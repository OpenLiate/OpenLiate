import { createRuntimeApp } from "./runtime";
import { serve } from "@hono/node-server";

export * from "./runtime";

const app = createRuntimeApp();

const port = parseInt(typeof process !== "undefined" && process.env?.PORT ? process.env.PORT : "7071", 10);
const host = typeof process !== "undefined" && process.env?.HOST ? process.env.HOST : "0.0.0.0";

// When run in Deno (Supabase Edge Functions)
if (typeof (globalThis as any).Deno !== "undefined" && typeof (globalThis as any).Deno.serve === "function") {
  (globalThis as any).Deno.serve((req: Request) => app.fetch(req));
} else if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
  if ((globalThis as any).Bun?.serve) {
    (globalThis as any).Bun.serve({
      fetch: app.fetch,
      port,
      hostname: host
    });
    console.log(`[OpenLiate] Runtime running on Bun (http://${host}:${port})`);
  } else {
    try {
      serve({
        fetch: app.fetch,
        port,
        hostname: host
      });
      console.log(`[OpenLiate] Runtime running on Node.js (http://${host}:${port})`);
    } catch {}
  }
}

export default app;
