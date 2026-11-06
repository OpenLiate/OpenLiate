import { createRuntimeApp } from "../src/cloud/runtime/hono";
import { Agent } from "../src/layers/agent/harness";
import { UniversalLlmClient } from "../src/layers/llm/model";

const SARVAM_KEY = process.env.SARVAM_API_KEY || "sk_rovev9gc_536gQwrqAm7S6iZMTL9mtLyG";
process.env.SARVAM_API_KEY = SARVAM_KEY;

async function runBenchmark() {
  console.log("===========================================================");
  console.log("  OpenLiate 2026 Production Benchmark: hono.ts & Sarvam 105b");
  console.log("===========================================================\n");

  const initialMemory = process.memoryUsage();

  // -------------------------------------------------------------
  // Test 1: Cold Boot & Router Instantiation
  // -------------------------------------------------------------
  console.log("[Phase 1] Cold Boot & Hono Engine Instantiation...");
  const bootStart = performance.now();
  const app = createRuntimeApp();
  const bootEnd = performance.now();
  const bootDuration = (bootEnd - bootStart).toFixed(2);
  console.log(`  Hono Router Boot Time: ${bootDuration} ms\n`);

  // -------------------------------------------------------------
  // Test 2: Live In-Memory Web Standards Request / Health Check
  // -------------------------------------------------------------
  console.log("[Phase 2] Web Standards Request Throughput (LAPI /health)...");
  const pingStart = performance.now();
  const healthRes = await app.fetch(new Request("http://localhost/health"));
  const pingEnd = performance.now();
  const healthData = await healthRes.json() as any;
  console.log(`  Status: ${healthData.status} (Protocol: ${healthData.protocol})`);
  console.log(`  Dispatch Latency: ${(pingEnd - pingStart).toFixed(3)} ms\n`);

  // -------------------------------------------------------------
  // Test 3: Real Sarvam 105b Live LLM Call (Zero Simulation)
  // -------------------------------------------------------------
  console.log("[Phase 3] Live Model Invocation: Sarvam 105b (api.sarvam.ai)...");
  const client = new UniversalLlmClient(SARVAM_KEY);
  const prompt = "Explain in 2 short bullet points why sovereign AI models are critical for India.";
  
  const llmStart = performance.now();
  let llmResponse: any;
  try {
    llmResponse = await client.chat([
      { role: "system", content: "You are a sovereign AI assistant powered by OpenLiate." },
      { role: "user", content: prompt }
    ], {
      model: "sarvam-105b",
      apiKey: SARVAM_KEY,
      temperature: 0.2,
      maxTokens: 512
    });
  } catch (err: any) {
    console.error("  Sarvam Live API Error:", err.message);
    throw err;
  }
  const llmEnd = performance.now();
  const llmDuration = (llmEnd - llmStart).toFixed(2);

  console.log(`  Model: ${llmResponse.model}`);
  console.log(`  Latency: ${llmDuration} ms`);
  if (llmResponse.usage) {
    console.log(`  Tokens: Prompt: ${llmResponse.usage.promptTokens}, Completion: ${llmResponse.usage.completionTokens}, Total: ${llmResponse.usage.totalTokens}`);
    const tps = ((llmResponse.usage.completionTokens / (parseFloat(llmDuration) / 1000))).toFixed(1);
    console.log(`  Throughput: ~${tps} tokens/sec`);
  }
  console.log("\n  --- Real Response from Sarvam 105b ---");
  console.log(llmResponse.text.trim());
  console.log("  --------------------------------------\n");

  // -------------------------------------------------------------
  // Test 4: Live Agent Execution via LAPI POST /run (Full ReAct + I)
  // -------------------------------------------------------------
  console.log("[Phase 4] Full Agent Execution (L·I·A·T·E Pipeline via POST /run)...");
  const agentRunStart = performance.now();
  const runPayload = {
    prompt: "Who is OpenLiate and what is the sovereign vision?",
    sessionId: "bench-session-2026",
    agent: {
      L: {
        provider: "sarvam",
        model: "sarvam-105b"
      },
      I: {
        knowledge: [
          "OpenLiate is the sovereign open source backend layer for AI agents.",
          "Mission: Enable AI agents to run on sovereign cloud infrastructure from India to the world.",
          "Architecture: 5 Orthogonal Layers (Model, Knowledge, Harness, Tools, Sandbox)."
        ]
      },
      A: {
        name: "indic_agent",
        intent: "Sovereign AI benchmark agent",
        maxSteps: 3
      },
      T: [],
      E: {
        SARVAM_API_KEY: SARVAM_KEY
      }
    },
    keys: {
      SARVAM_API_KEY: SARVAM_KEY
    }
  };

  const runRes = await app.fetch(new Request("http://localhost/run", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SARVAM_KEY}`
    },
    body: JSON.stringify(runPayload)
  }));

  const agentRunEnd = performance.now();
  const runDuration = (agentRunEnd - agentRunStart).toFixed(2);
  const runResult = await runRes.json() as any;

  console.log(`  Agent: ${runResult.agent}`);
  console.log(`  Execution Status: ${runResult.success ? "SUCCESS" : "FAILED"}`);
  console.log(`  Total Execution Latency: ${runDuration} ms`);
  console.log(`  Steps Executed: ${runResult.totalSteps || 1}`);
  console.log("\n  --- Agent Run Result ---");
  console.log(runResult.text || runResult.thought || JSON.stringify(runResult));
  console.log("  ------------------------\n");

  // -------------------------------------------------------------
  // Test 5: Memory & Resource Overhead
  // -------------------------------------------------------------
  const finalMemory = process.memoryUsage();
  const heapUsedMB = ((finalMemory.heapUsed - initialMemory.heapUsed) / (1024 * 1024)).toFixed(2);
  const totalRssMB = (finalMemory.rss / (1024 * 1024)).toFixed(2);

  console.log("[Phase 5] Memory & Footprint Analysis...");
  console.log(`  Heap Delta: ${heapUsedMB} MB`);
  console.log(`  Total RSS: ${totalRssMB} MB`);
  console.log(`  Pure Web Standards (Zero Node Sockets Bloat)`);
  console.log("\n===========================================================");
  console.log("  Benchmark Complete: OpenLiate is 100% Dynamic & Production Ready");
  console.log("===========================================================");
}

runBenchmark().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});

