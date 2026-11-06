/**
 * OpenLiate — WebAssembly Runtime Engine (Fastly Compute WASM)
 *
 * Dedicated WASM entrypoint compiled via js-compute-runtime into bin/main.wasm.
 * Native Web Standards: Request, Response, Fetch API.
 */
import app from "./hono";

declare const addEventListener: (type: string, handler: (event: any) => void) => void;

if (typeof addEventListener !== "undefined") {
  try {
    addEventListener("fetch", (event: any) => {
      event.respondWith(app.fetch(event.request));
    });
  } catch {}
}

export default {
  fetch(request: Request, env?: any, ctx?: any) {
    return app.fetch(request, env, ctx);
  }
};

