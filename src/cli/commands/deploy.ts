import { deploy } from "../../cloud/link";

export async function handleDeployCommand(args: string[]): Promise<void> {
  // args[0] is "deploy"
  const rawTarget = args[1];

  if (!rawTarget) {
    console.log(`
===========================================================
  OpenLiate Deploy — Cloud Deployment (Serverless Functions)
===========================================================

Deploy Universal Runtime Engine:
  openliate deploy neon                                    Deploy OpenLiate Runtime to Neon Cloud
  openliate deploy vercel                                  Deploy OpenLiate Runtime to Vercel Fluid Compute
  openliate deploy supabase                                Deploy OpenLiate Runtime to Supabase Edge Functions
  openliate deploy fastly                                  Deploy OpenLiate Runtime to Fastly Compute (WASM)
  openliate deploy cloudflare                              Deploy OpenLiate Runtime to Cloudflare Workers
  openliate deploy azion                                   Deploy OpenLiate Runtime to Azion Edge Functions

Deploy Dedicated Micro-Agent:
  openliate deploy sarvam-agent --to neon                  Deploy dedicated Sarvam Agent to Neon
  openliate deploy prism-agent --to neon                   Deploy dedicated Prism Agent to Neon
  openliate deploy <agent.json|agent-name> [--to <cloud>]  Deploy any custom agent

Usage:
  openliate deploy [neon|vercel|supabase|fastly|cloudflare|azion|all]
  openliate deploy <agent> [--to neon|vercel|supabase|fastly|cloudflare|azion]
`);
    return;
  }

  // Check if rawTarget is a known provider (runtime deploy)
  const isNeon = rawTarget === "neon" || rawTarget === "--neon";
  const isVercel = rawTarget === "vercel" || rawTarget === "--vercel";
  const isSupabase = rawTarget === "supabase" || rawTarget === "--supabase";
  const isFastly = rawTarget === "fastly" || rawTarget === "--fastly";
  const isCloudflare = rawTarget === "cloudflare" || rawTarget === "--cloudflare";
  const isAzion = rawTarget === "azion" || rawTarget === "--azion";
  const isAll = rawTarget === "all" || rawTarget === "--all";

  if (isNeon || isVercel || isSupabase || isFastly || isCloudflare || isAzion || isAll) {
    const provider: "neon" | "vercel" | "supabase" | "fastly" | "cloudflare" | "azion" | "all" = isNeon
      ? "neon"
      : isVercel
      ? "vercel"
      : isSupabase
      ? "supabase"
      : isFastly
      ? "fastly"
      : isCloudflare
      ? "cloudflare"
      : isAzion
      ? "azion"
      : "all";
    try {
      await deploy({ provider });
    } catch (err: any) {
      console.error(`\n[Deploy Error]: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // Otherwise, rawTarget is an agent name or module file
  const agentName = rawTarget;
  let provider: "neon" | "vercel" | "supabase" | "fastly" | "cloudflare" | "azion" = "neon";

  const toIdx = args.indexOf("--to");
  if (toIdx !== -1 && args[toIdx + 1]) {
    const targetProvider = args[toIdx + 1].toLowerCase();
    if (targetProvider === "vercel") provider = "vercel";
    else if (targetProvider === "supabase") provider = "supabase";
    else if (targetProvider === "fastly") provider = "fastly";
    else if (targetProvider === "cloudflare") provider = "cloudflare";
    else if (targetProvider === "azion") provider = "azion";
    else provider = "neon";
  } else if (args.includes("vercel") || args.includes("--vercel")) {
    provider = "vercel";
  } else if (args.includes("supabase") || args.includes("--supabase")) {
    provider = "supabase";
  } else if (args.includes("fastly") || args.includes("--fastly")) {
    provider = "fastly";
  } else if (args.includes("cloudflare") || args.includes("--cloudflare")) {
    provider = "cloudflare";
  } else if (args.includes("azion") || args.includes("--azion")) {
    provider = "azion";
  }

  try {
    await deploy({ provider, agent: agentName });
  } catch (err: any) {
    console.error(`\n[Deploy Error]: ${err.message}`);
    process.exit(1);
  }
}

