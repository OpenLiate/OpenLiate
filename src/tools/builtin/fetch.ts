import type { AgentTool } from "../../agent/types";

export const fetchTool: AgentTool = {
  name: "fetch",
  description: "Make an HTTP request (GET, POST, PUT, DELETE) to an external URL or API endpoint.",
  parameters: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "The complete HTTP or HTTPS URL to fetch"
      },
      method: {
        type: "string",
        enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
        description: "HTTP method to use (defaults to GET)"
      },
      headers: {
        type: "object",
        description: "Key-value pairs of request headers"
      },
      body: {
        type: "string",
        description: "Request body string (for POST/PUT requests)"
      }
    },
    required: ["url"]
  },
  execute: async (args: Record<string, any>) => {
    const url = args.url;
    if (!url || typeof url !== "string") {
      throw new Error("Missing or invalid 'url' parameter for fetch tool");
    }

    const method = (args.method || "GET").toUpperCase();
    const headers: Record<string, string> = args.headers || {};
    const fetchOptions: RequestInit = {
      method,
      headers
    };

    if (args.body && (method === "POST" || method === "PUT" || method === "PATCH")) {
      fetchOptions.body = typeof args.body === "string" ? args.body : JSON.stringify(args.body);
      if (!headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
    }

    try {
      const response = await fetch(url, fetchOptions);
      const contentType = response.headers.get("content-type") || "";

      let bodyText: string;
      if (contentType.includes("application/json")) {
        const json = await response.json();
        bodyText = JSON.stringify(json, null, 2);
      } else {
        bodyText = await response.text();
      }

      return `Status: ${response.status} ${response.statusText}\nBody:\n${bodyText.slice(0, 4000)}`;
    } catch (err: any) {
      return `HTTP Request failed for ${url}: ${err.message}`;
    }
  }
};
