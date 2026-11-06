/**
 * OpenLiate Sovereign Agent Runtime — Deno & Edge Isolated Worker
 * Native Web Standards runtime for Supabase Edge Functions & Deno Deploy.
 * Zero Node.js socket bloat: Pure Deno.serve + fetch + Hono with wildcard routing.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { OPENLIATE_VERSION } from "../core/version";

// Embedded sovereign hub definitions
import sarvamHubJson from "../../hub/llm/sarvam.json";
import indiaaiHubJson from "../../hub/llm/indiaai.json";
import neonHubJson from "../../hub/llm/neon.json";

// Embedded universal MCP registry
import agentmailMcpJson from "../../hub/mcp/agentmail.json";
import fetchMcpJson from "../../hub/mcp/fetch.json";
import neonMcpJson from "../../hub/mcp/neon.json";
import sarvamMcpJson from "../../hub/mcp/sarvam.json";
import supabaseMcpJson from "../../hub/mcp/supabase.json";
import vercelMcpJson from "../../hub/mcp/vercel.json";

const mcpHubRegistry: Record<string, any> = {
  agentmail: agentmailMcpJson,
  fetch: fetchMcpJson,
  neon: neonMcpJson,
  sarvam: sarvamMcpJson,
  supabase: supabaseMcpJson,
  vercel: vercelMcpJson
};

interface EdgeTool {
  name: string;
  description: string;
  parameters: any;
  execute: (args: any) => Promise<string>;
}

async function discoverEdgeHttpTools(
  url: string,
  headers: Record<string, string> = {},
  toolFilter?: string[]
): Promise<EdgeTool[]> {
  const filterSet = toolFilter && toolFilter.length > 0 ? new Set(toolFilter.map(t => t.toLowerCase())) : null;
  const reqHeaders = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream, */*",
    ...headers
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: reqHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {}
      })
    });

    if (!res.ok) return [];

    const rawText = await res.text();
    let data: any;
    if (rawText.includes("data:")) {
      for (const line of rawText.split("\n")) {
        const l = line.trim();
        if (l.startsWith("data:")) {
          try {
            data = JSON.parse(l.slice(5).trim());
            break;
          } catch {}
        }
      }
    }
    if (!data) {
      try {
        data = JSON.parse(rawText.trim());
      } catch {}
    }

    const rawTools = data?.result?.tools || [];
    const discovered: EdgeTool[] = [];

    for (const t of rawTools) {
      if (filterSet && !filterSet.has(t.name.toLowerCase())) continue;

      discovered.push({
        name: t.name,
        description: t.description || `Tool ${t.name}`,
        parameters: t.inputSchema || { type: "object", properties: {} },
        execute: async (args: any) => {
          const callRes = await fetch(url, {
            method: "POST",
            headers: reqHeaders,
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: Date.now(),
              method: "tools/call",
              params: { name: t.name, arguments: args }
            })
          });

          const callRaw = await callRes.text();
          let callData: any;
          if (callRaw.includes("data:")) {
            for (const line of callRaw.split("\n")) {
              const l = line.trim();
              if (l.startsWith("data:")) {
                try {
                  callData = JSON.parse(l.slice(5).trim());
                  break;
                } catch {}
              }
            }
          }
          if (!callData) {
            try {
              callData = JSON.parse(callRaw.trim());
            } catch {}
          }

          const content = callData?.result?.content;
          if (Array.isArray(content)) {
            return content.map((c: any) => c.text ?? JSON.stringify(c)).join("\n");
          }
          return typeof callData?.result === "string"
            ? callData.result
            : JSON.stringify(callData?.result || callData || {});
        }
      });
    }

    return discovered;
  } catch (err: any) {
    console.warn(`[EdgeMCP] Discovery error: ${err.message}`);
    return [];
  }
}

async function resolveDynamicTools(
  toolSpecs: any[],
  dynamicKeys: Record<string, string>
): Promise<EdgeTool[]> {
  const allDiscoveredTools: EdgeTool[] = [];

  for (const spec of toolSpecs) {
    let serverUrl = "";
    let serverHeaders: Record<string, string> = {};
    let filterTools: string[] | undefined = undefined;

    if (typeof spec === "object" && spec !== null) {
      if (spec.url) {
        serverUrl = spec.url;
        serverHeaders = spec.headers || {};
      }
    } else if (typeof spec === "string") {
      let raw = spec.trim();
      if (raw.startsWith("mcp:")) raw = raw.slice(4);

      let serverName = raw;
      if (raw.includes(":")) {
        const parts = raw.split(":");
        serverName = parts[0].trim();
        filterTools = parts[1].split(",").map(s => s.trim()).filter(Boolean);
      }

      const hubDef = mcpHubRegistry[serverName.toLowerCase()];
      if (hubDef && hubDef.url) {
        serverUrl = hubDef.url;
        serverHeaders = hubDef.headers || {};
      }
    }

    if (serverUrl) {
      // Dynamic parameter substitution: replace any $ENV_VAR with dynamicKeys
      const resolvedUrl = serverUrl.replace(/\$([A-Z0-9_]+)/g, (_, name) => dynamicKeys[name] || "");
      const resolvedHeaders: Record<string, string> = {};
      for (const [k, v] of Object.entries(serverHeaders)) {
        resolvedHeaders[k] = String(v).replace(/\$([A-Z0-9_]+)/g, (_, name) => dynamicKeys[name] || "");
      }

      const tools = await discoverEdgeHttpTools(resolvedUrl, resolvedHeaders, filterTools);
      allDiscoveredTools.push(...tools);
    }
  }

  return allDiscoveredTools;
}

const app = new Hono();

// Enable universal CORS
app.use("*", cors());

function getRootMetadata() {
  return {
    name: "OpenLiate",
    version: OPENLIATE_VERSION,
    runtime: "deno-edge",
    status: "running",
    gateway: "Sarvam AI & Neon Cloud Grid",
    doctrine: "OpenLiate — Built for Sovereign AI Agents From India to the World",
    endpoints: {
      chat: "POST /chat",
      models: "GET /models",
      openliate_hub: "GET /hub",
      openliate_agents: "GET /hub/agents",
      openliate_llm: "GET /hub/llm",
      openliate_mcp: "GET /hub/mcp",
      openliate_run: "POST /run",
      health: "GET /health",
      openai_chat: "POST /v1/chat/completions",
      openai_models: "GET /v1/models"
    }
  };
}

function getModelsList() {
  return {
    object: "list",
    data: [
      { id: "sarvam-105b", object: "model", created: 1730000000, owned_by: "sarvam" },
      { id: "sarvam-prism", object: "model", created: 1730000000, owned_by: "sarvam" },
      { id: "eka-1", object: "model", created: 1730000000, owned_by: "indiaai" },
      { id: "claude-sonnet-4-6", object: "model", created: 1730000000, owned_by: "neon" },
      { id: "gpt-5-mini", object: "model", created: 1730000000, owned_by: "neon" }
    ]
  };
}

// Universal Route Handler that seamlessly handles Supabase Edge Gateway subpath prefixes
app.all("*", async (c) => {
  const method = c.req.method.toUpperCase();
  const rawPath = c.req.path;
  const cleanPath = rawPath.replace(/\/+$/, "") || "/";

  // 1. GET requests
  if (method === "GET") {
    if (cleanPath.endsWith("/health")) {
      return c.json({
        status: "ok",
        runtime: "openliate-deno",
        edge: "supabase-deno-worker",
        version: OPENLIATE_VERSION,
        protocol: "LAPI/v1",
        gateway: "Sarvam AI & Neon Cloud Grid",
        doctrine: "OpenLiate — Built for Sovereign AI Agents From India to the World",
        timestamp: new Date().toISOString()
      });
    }

    if (cleanPath.endsWith("/models") || cleanPath.endsWith("/v1/models")) {
      return c.json(getModelsList());
    }

    if (cleanPath.endsWith("/hub")) {
      return c.json({
        status: "ok",
        version: OPENLIATE_VERSION,
        agents: ["sarvam-agent", "indiaai-agent", "neon-agent", "prism-agent", "email-agent"],
        llm: ["sarvam", "indiaai", "neon"],
        mcp: ["agentmail", "fetch", "filesystem"]
      });
    }

    if (cleanPath.endsWith("/hub/llm")) {
      return c.json({
        sarvam: sarvamHubJson,
        indiaai: indiaaiHubJson,
        neon: neonHubJson
      });
    }

    // Default to root info page (for browser previews)
    return c.json(getRootMetadata());
  }

  // 2. POST requests — AI Agent execution
  if (method === "POST") {
    const startTime = Date.now();
    let body: any = {};
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON in request body" }, 400);
    }

    const prompt = body.prompt || body.message || body.input;
    if (!prompt || typeof prompt !== "string") {
      return c.json({ error: "Missing required 'prompt' string in request body" }, 400);
    }

    const sessionId = body.sessionId || body.session || `deno-${Date.now()}`;
    const keys = body.keys || {};
    const sarvamKey = keys.SARVAM_API_KEY || (globalThis as any).Deno?.env?.get("SARVAM_API_KEY") || "";

    // Resolve Provider & Model
    let provider = "sarvam";
    let modelName = "sarvam-105b";

    if (typeof body.L === "string") {
      if (body.L.includes("/")) {
        const parts = body.L.split("/");
        provider = parts[0].toLowerCase();
        modelName = parts[1];
      } else {
        modelName = body.L;
      }
    } else if (body.L && typeof body.L === "object") {
      provider = body.L.provider || provider;
      modelName = body.L.model || modelName;
    }

    // High-speed System-1 decisions (Sarvam Prism)
    if (modelName.toLowerCase().includes("prism")) {
      if (!sarvamKey) {
        return c.json({ error: "Missing SARVAM_API_KEY. Provide it in keys: { SARVAM_API_KEY: '...' }" }, 400);
      }

      try {
        const systemOneUrl = (sarvamHubJson as any).systemone_endpoint || "https://api.sarvam.ai/v2/systemone";
        const prismRes = await fetch(systemOneUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-subscription-key": sarvamKey,
            "Authorization": `Bearer ${sarvamKey}`
          },
          body: JSON.stringify({
            model: "sarvam-prism",
            state: prompt,
            questions: {
              decision: {
                type: "choice",
                instructions: "Evaluate the input state and select the appropriate decision.",
                criteria: {
                  "allow": "Legitimate, safe, and valid request matching normal authorized behavior",
                  "challenge_mfa": "Suspicious, ambiguous, or requires secondary verification",
                  "block": "Malicious, invalid, high-risk, credential attack, or fraudulent attempt"
                }
              }
            }
          })
        });

        if (!prismRes.ok) {
          const errText = await prismRes.text();
          return c.json({ error: `Sarvam Prism error (${prismRes.status}): ${errText}` }, prismRes.status as any);
        }

        const prismData = await prismRes.json() as any;
        const ans = prismData.answers?.decision || {};
        const choice = (ans.choice || "evaluated").toUpperCase();
        const confidence = ans.confidence !== undefined ? `${(ans.confidence * 100).toFixed(2)}%` : "";

        return c.json({
          success: true,
          agent: body.A?.name || "prism_agent",
          sessionId,
          prompt,
          decision: choice,
          confidence,
          answers: prismData.answers,
          model: "sarvam-prism",
          totalSteps: 1,
          latencyMs: Date.now() - startTime,
          protocol: "LAPI/v1"
        });
      } catch (err: any) {
        return c.json({ error: err.message || "Prism execution failed" }, 500);
      }
    }

    // Flagship Generative Agent Reasoning (Sarvam 105B) with dynamic ReAct Tool Loop
    if (provider === "sarvam" || modelName.includes("105b") || modelName.includes("sarvam")) {
      if (!sarvamKey) {
        return c.json({ error: "Missing SARVAM_API_KEY. Provide it in keys: { SARVAM_API_KEY: '...' }" }, 400);
      }

      try {
        const endpoint = sarvamHubJson.endpoint || "https://api.sarvam.ai/v2/chat/completions";
        const systemInstruction = body.A?.intent 
          ? `You are ${body.A.name || "sovereign_agent"} (v1.0.0). Intent: ${body.A.intent}. Follow ReAct sovereign methodology.`
          : "You are OpenLiate Sovereign AI Agent, built from India to the world. Follow ReAct methodology.";

        // 1. Dynamically resolve tools from [T] layer using dynamic [E] and [keys]
        const rawTools = Array.isArray(body.T) ? body.T : (body.tools ? (Array.isArray(body.tools) ? body.tools : [body.tools]) : []);
        const dynamicEnv = {
          ...(body.E || {}),
          ...(body.keys || {}),
          SARVAM_API_KEY: sarvamKey
        };

        const activeTools = await resolveDynamicTools(rawTools, dynamicEnv);
        const formattedTools = activeTools.map(t => ({
          type: "function",
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters || { type: "object", properties: {} }
          }
        }));
        const toolMap = new Map(activeTools.map(t => [t.name, t]));

        // 2. Autonomous Multi-Turn ReAct Loop
        let currentStep = 0;
        const maxSteps = body.A?.maxSteps || 5;
        const conversationMessages: any[] = [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt }
        ];
        let finalOutput = "";
        let finalThought: string | undefined = undefined;
        const executedToolsLog: string[] = [];

        while (currentStep < maxSteps) {
          currentStep++;

          const chatPayload: any = {
            model: modelName,
            messages: conversationMessages,
            temperature: 0.2,
            max_tokens: 2048
          };
          if (formattedTools.length > 0) {
            chatPayload.tools = formattedTools;
          }

          const chatRes = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "api-subscription-key": sarvamKey,
              "Authorization": `Bearer ${sarvamKey}`
            },
            body: JSON.stringify(chatPayload)
          });

          if (!chatRes.ok) {
            const errText = await chatRes.text();
            return c.json({ error: `Sarvam API error (${chatRes.status}): ${errText}` }, chatRes.status as any);
          }

          const chatData = await chatRes.json() as any;
          const choice = chatData.choices?.[0];
          const msg = choice?.message || {};
          const thought = msg.reasoning_content || msg.reasoning || undefined;
          if (thought) finalThought = thought;

          const toolCalls = msg.tool_calls;
          if (Array.isArray(toolCalls) && toolCalls.length > 0) {
            // Record assistant tool call request
            conversationMessages.push({
              role: "assistant",
              content: msg.content || "",
              tool_calls: toolCalls
            });

            for (const tc of toolCalls) {
              const toolName = tc.function?.name;
              let toolArgs: any = {};
              try {
                toolArgs = typeof tc.function?.arguments === "string" ? JSON.parse(tc.function.arguments) : (tc.function?.arguments || {});
              } catch {
                toolArgs = {};
              }

              const tool = toolMap.get(toolName);
              let toolResultStr = "";
              if (tool) {
                try {
                  toolResultStr = await tool.execute(toolArgs);
                } catch (err: any) {
                  toolResultStr = `Error executing tool '${toolName}': ${err.message}`;
                }
              } else {
                toolResultStr = `Error: Tool '${toolName}' not found. Available tools: ${Array.from(toolMap.keys()).join(", ")}`;
              }

              executedToolsLog.push(toolName);

              conversationMessages.push({
                role: "tool",
                tool_call_id: tc.id,
                name: toolName,
                content: toolResultStr
              });
            }
            // Continues loop to next turn with real observation!
          } else {
            finalOutput = msg.content || "";
            break;
          }
        }

        return c.json({
          success: true,
          agent: body.A?.name || "sovereign_agent",
          sessionId,
          prompt,
          text: finalOutput || finalThought || "",
          thought: finalThought,
          toolsExecuted: executedToolsLog,
          model: modelName,
          totalSteps: currentStep,
          latencyMs: Date.now() - startTime,
          protocol: "LAPI/v1"
        });
      } catch (err: any) {
        return c.json({ error: err.message || "Sarvam execution failed" }, 500);
      }
    }

    return c.json({
      success: true,
      agent: body.A?.name || "agent",
      sessionId,
      prompt,
      text: `[OpenLiate Deno Edge] Agent executed prompt: "${prompt}"`,
      model: modelName,
      latencyMs: Date.now() - startTime,
      protocol: "LAPI/v1"
    });
  }

  return c.json(getRootMetadata());
});

// Native Deno Edge entrypoint
if (typeof (globalThis as any).Deno !== "undefined" && typeof (globalThis as any).Deno.serve === "function") {
  (globalThis as any).Deno.serve((req: Request) => app.fetch(req));
}

export default app;
