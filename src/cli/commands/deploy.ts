import { deploy } from "../../link/index";

export async function handleDeployCommand(args: string[]): Promise<void> {
  // args[0] is "deploy"
  const rawTarget = args[1];

  if (!rawTarget) {
    console.log(`
===========================================================
  OpenLiate Deploy — Cloud Deployment (Serverless Functions)
===========================================================

Deploy Universal Runtime Engine:
  liate deploy neon                                    Deploy OpenLiate Runtime to Neon Cloud
  liate deploy vercel                                  Deploy OpenLiate Runtime to Vercel Fluid Compute
  liate deploy supabase                                Deploy OpenLiate Runtime to Supabase Edge Functions

Deploy Dedicated Micro-Agent:
  liate deploy sarvam-agent --to neon                  Deploy dedicated Sarvam Agent to Neon
  liate deploy indiaai-agent --to neon                 Deploy dedicated IndiaAI Agent to Neon
  liate deploy <agent.json|agent-name> [--to <cloud>]  Deploy any custom agent

Usage:
  liate deploy [neon|vercel|supabase]
  liate deploy <agent> [--to neon|vercel|supabase]
`);
    return;
  }

  // Check if rawTarget is a known provider (runtime deploy)
  const isNeon = rawTarget === "neon" || rawTarget === "--neon";
  const isVercel = rawTarget === "vercel" || rawTarget === "--vercel";
  const isSupabase = rawTarget === "supabase" || rawTarget === "--supabase";
  const isAll = rawTarget === "all" || rawTarget === "--all";

  if (isNeon || isVercel || isSupabase || isAll) {
    const provider: "neon" | "vercel" | "supabase" | "all" = isNeon ? "neon" : isVercel ? "vercel" : isSupabase ? "supabase" : "all";
    try {
      await deploy({ provider });
    } catch (err: any) {
      console.error(`\n[Deploy Error]: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // Otherwise, rawTarget is an agent name or manifest file
  const agentName = rawTarget;
  let provider: "neon" | "vercel" | "supabase" = "neon";

  const toIdx = args.indexOf("--to");
  if (toIdx !== -1 && args[toIdx + 1]) {
    const targetProvider = args[toIdx + 1].toLowerCase();
    if (targetProvider === "vercel") provider = "vercel";
    else if (targetProvider === "supabase") provider = "supabase";
    else provider = "neon";
  } else if (args.includes("vercel") || args.includes("--vercel")) {
    provider = "vercel";
  } else if (args.includes("supabase") || args.includes("--supabase")) {
    provider = "supabase";
  }

  try {
    await deploy({ provider, agent: agentName });
  } catch (err: any) {
    console.error(`\n[Deploy Error]: ${err.message}`);
    process.exit(1);
  }
}

