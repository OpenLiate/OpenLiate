import { link, relink, unlink } from "../../link/index";

export async function handleLinkCommand(args: string[]): Promise<void> {
  const isNeon = args.includes("--neon") || args.includes("neon");
  const isVercelDaemon = args.includes("--vercel-daemons") || args.includes("--vercel-daemon") || (args.includes("--vercel") && (args.includes("--daemons") || args.includes("--daemon")));
  const isVercel = args.includes("--vercel") || args.includes("vercel") || isVercelDaemon;
  const isSupabase = args.includes("--supabase") || args.includes("supabase");
  const isBoth = args.includes("--both");
  const isAll = args.includes("--all") || (!isNeon && !isVercel && !isSupabase && !isBoth);
  const isRelink = args.includes("--relink") || args.includes("--force") || args.includes("-f");
  const keyIdx = args.indexOf("--key");
  const key = keyIdx !== -1 ? args[keyIdx + 1] : undefined;

  let provider: "neon" | "vercel" | "supabase" | "both" | "all" = "all";
  if (isAll) {
    provider = "all";
  } else if (isBoth) {
    provider = "both";
  } else if (isSupabase) {
    provider = "supabase";
  } else if (isVercel) {
    provider = "vercel";
  } else if (isNeon) {
    provider = "neon";
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
  const isBoth = args.includes("--both");
  const isAll = args.includes("--all") || (!isNeon && !isVercel && !isSupabase && !isBoth);
  const keyIdx = args.indexOf("--key");
  const key = keyIdx !== -1 ? args[keyIdx + 1] : undefined;

  let provider: "neon" | "vercel" | "supabase" | "both" | "all" = "all";
  if (isAll) {
    provider = "all";
  } else if (isBoth) {
    provider = "both";
  } else if (isSupabase) {
    provider = "supabase";
  } else if (isVercel) {
    provider = "vercel";
  } else if (isNeon) {
    provider = "neon";
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
  let provider: "neon" | "vercel" | "supabase" | "all" = "all";
  if (isNeon && !isVercel && !isSupabase) {
    provider = "neon";
  } else if (isVercel && !isNeon && !isSupabase) {
    provider = "vercel";
  } else if (isSupabase && !isNeon && !isVercel) {
    provider = "supabase";
  }

  try {
    await unlink(provider);
  } catch (err: any) {
    console.error(`\n[Unlink Error]: ${err.message}`);
    process.exit(1);
  }
}

