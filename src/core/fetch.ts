/**
 * Resilient fetch with fallback DNS resolver (8.8.8.8 / 1.1.1.1).
 * Seamlessly resolves deep cloud subdomains (e.g. Neon AI Gateway endpoints)
 * when local router or ISP DNS queries fail or are refused.
 */
export async function resilientFetch(url: string | URL, init?: any): Promise<any> {
  const urlStr = typeof url === "string" ? url : url.toString();

  try {
    return await fetch(urlStr, init as any);
  } catch (err: any) {
    const isDnsError =
      err?.message?.includes("ENOTFOUND") ||
      err?.cause?.code === "ENOTFOUND" ||
      err?.message?.includes("getaddrinfo");

    if (!isDnsError) {
      throw err;
    }

    // Attempt node:dns + node:https fallback if in Node/Bun environment
    try {
      const dns = await import("node:dns");
      const https = await import("node:https");
      const http = await import("node:http");

      const parsed = new URL(urlStr);
      const isHttps = parsed.protocol === "https:";
      const client = isHttps ? https : http;

      const resolver = new dns.promises.Resolver();
      resolver.setServers(["8.8.8.8", "1.1.1.1"]);
      const addrs = await resolver.resolve4(parsed.hostname);

      if (!addrs || addrs.length === 0) {
        throw err;
      }

      return new Promise((resolve, reject) => {
        const headers: Record<string, any> = {};
        if (init?.headers) {
          if (typeof init.headers.forEach === "function") {
            init.headers.forEach((v: string, k: string) => { headers[k] = v; });
          } else if (Array.isArray(init.headers)) {
            for (const [k, v] of init.headers) { headers[k] = v; }
          } else {
            Object.assign(headers, init.headers);
          }
        }

        const bodyData = typeof init?.body === "string"
          ? Buffer.from(init.body)
          : (init?.body ? Buffer.from(JSON.stringify(init.body)) : null);

        if (bodyData && !headers["Content-Length"]) {
          headers["Content-Length"] = String(bodyData.byteLength);
        }

        const req = client.request(urlStr, {
          method: init?.method || "GET",
          headers,
          lookup: (_hostname: string, opts: any, cb: any) => {
            if (typeof opts === "function") {
              cb = opts;
              opts = {};
            }
            if (opts?.all) {
              cb(null, addrs.map((a) => ({ address: a, family: 4 })));
            } else {
              cb(null, addrs[0], 4);
            }
          }
        }, (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (d) => chunks.push(d));
          res.on("end", () => {
            const buf = Buffer.concat(chunks);
            const textContent = buf.toString("utf-8");
            resolve({
              ok: (res.statusCode ?? 500) >= 200 && (res.statusCode ?? 500) < 300,
              status: res.statusCode ?? 500,
              statusText: res.statusMessage ?? "",
              headers: new Headers(res.headers as any),
              text: async () => textContent,
              json: async () => JSON.parse(textContent)
            });
          });
        });

        if (init?.signal) {
          if (init.signal.aborted) {
            req.destroy(init.signal.reason);
            return reject(init.signal.reason);
          }
          init.signal.addEventListener("abort", () => {
            req.destroy(init.signal?.reason);
            reject(init.signal?.reason);
          });
        }

        req.on("error", reject);
        if (bodyData) {
          req.write(bodyData);
        }
        req.end();
      });
    } catch {
      throw err;
    }
  }
}
