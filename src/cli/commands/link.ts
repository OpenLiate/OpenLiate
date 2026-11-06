import { link, relink, unlink } from "../../link/index";

export async function handleLinkCommand(args: string[]): Promise<void> {
  const isNeon = args.includes("--neon") || args.includes("neon");
  const isVercelDaemon = args.includes("--vercel-daemons") || args.includes("--vercel-daemon") || (args.includes("--vercel") && (args.includes("--daemons") || args.includes("--daemon")));
  const isVercel = args.includes("--vercel") || args.includes("vercel") || isVercelDaemon;
  const isSupabase = args.includes("--supabase") || args.includes("supabase");
  const isAll = args.includes("--all") || args.includes("all");
  const isRelink = args.includes("--relink") || args.includes("--force") || args.includes("-f");
  const keyIdx = args.indexOf("--key");
  const key = keyIdx !== -1 ? args[keyIdx + 1] : undefined;

  if (!isNeon && !isVercel && !isSupabase && !isAll) {
    console.log(`
===========================================================
  OpenLiate Link — Multi-Cloud Infrastructure (BYOC)
===========================================================

Please specify a cloud provider to link:
  liate link neon         Link Neon Serverless Postgres & pgvector
  liate link vercel       Link Vercel Functions & Compute
  liate link supabase     Link Supabase Database & Auth

Usage:
  liate link <neon|vercel|supabase>
`);
    return;
  }

  let provider: "neon" | "vercel" | "supabase" | "all" = "all";
  if (isNeon) {
    provider = "neon";
  } else if (isVercel) {
    provider = "vercel";
  } else if (isSupabase) {
    provider = "supabase";
  } else if (isAll) {
    provider = "all";
  }

  try {
    await link({ provider, key, isDaemon: isVercelDaemon, relink: isRelink });
  } catch (err: any) {
    console.error(`\n[Link Error]: ${err.message}`);
    process.exit(1);
  }
}

export async function handleRelinkCommand(args: string[]): Promise<void> {
  const isNeon = args.includes("--neon") || args.includes("neon");
  const isVercelDaemon = args.includes("--vercel-daemons") || args.includes("--vercel-daemon") || (args.includes("--vercel") && (args.includes("--daemons") || args.includes("--daemon")));
  const isVercel = args.includes("--vercel") || args.includes("vercel") || isVercelDaemon;
  const isSupabase = args.includes("--supabase") || args.includes("supabase");
  const isAll = args.includes("--all") || args.includes("all");
  const keyIdx = args.indexOf("--key");
  const key = keyIdx !== -1 ? args[keyIdx + 1] : undefined;

  if (!isNeon && !isVercel && !isSupabase && !isAll) {
    console.log(`
===========================================================
  OpenLiate Relink — Refresh Cloud OAuth Credentials
===========================================================

Please specify a cloud provider to relink:
  liate relink neon       Relink Neon via fresh OAuth & redeploy
  liate relink vercel     Relink Vercel via fresh OAuth & redeploy
  liate relink supabase   Relink Supabase via fresh OAuth & redeploy
  liate relink all        Relink all connected clouds

Usage:
  liate relink <neon|vercel|supabase|all>
`);
    return;
  }

  let provider: "neon" | "vercel" | "supabase" | "all" = "all";
  if (isNeon) {
    provider = "neon";
  } else if (isVercel) {
    provider = "vercel";
  } else if (isSupabase) {
    provider = "supabase";
  } else if (isAll) {
    provider = "all";
  }

  try {
    await relink({ provider, key, isDaemon: isVercelDaemon });
  } catch (err: any) {
    console.error(`\n[Relink Error]: ${err.message}`);
    process.exit(1);
  }
}

export async function handleUnlinkCommand(args: string[]): Promise<void> {
  const isNeon = args.includes("--neon") || args.includes("neon");
  const isVercel = args.includes("--vercel") || args.includes("vercel");
  const isSupabase = args.includes("--supabase") || args.includes("supabase");
  const isAll = args.includes("--all") || args.includes("all");

  if (!isNeon && !isVercel && !isSupabase && !isAll) {
    console.log(`
===========================================================
  OpenLiate Unlink — Disconnect Cloud Provider
===========================================================

Please specify a cloud provider to unlink:
  liate unlink neon       Unlink Neon & clear saved credentials
  liate unlink vercel     Unlink Vercel & clear saved credentials
  liate unlink supabase   Unlink Supabase & clear saved credentials
  liate unlink all        Unlink all connected clouds

Usage:
  liate unlink <neon|vercel|supabase|all>
`);
    return;
  }

  let provider: "neon" | "vercel" | "supabase" | "all" = "all";
  if (isNeon) {
    provider = "neon";
  } else if (isVercel) {
    provider = "vercel";
  } else if (isSupabase) {
    provider = "supabase";
  } else if (isAll) {
    provider = "all";
  }

  try {
    await unlink(provider);
  } catch (err: any) {
    console.error(`\n[Unlink Error]: ${err.message}`);
    process.exit(1);
  }
}

