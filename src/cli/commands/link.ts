import { link, relink, unlink } from "../../cloud/link";

export async function handleLinkCommand(args: string[]): Promise<void> {
  const isNeon = args.includes("--neon") || args.includes("neon");
  const isVercelDaemon = args.includes("--vercel-daemons") || args.includes("--vercel-daemon") || (args.includes("--vercel") && (args.includes("--daemons") || args.includes("--daemon")));
  const isVercel = args.includes("--vercel") || args.includes("vercel") || isVercelDaemon;
  const isSupabase = args.includes("--supabase") || args.includes("supabase");
  const isCloudflare = args.includes("--cloudflare") || args.includes("cloudflare");
  const isAzion = args.includes("--azion") || args.includes("azion");
  const isFastly = args.includes("--fastly") || args.includes("fastly");
  const isAll = args.includes("--all") || args.includes("all");
  const isRelink = args.includes("--relink") || args.includes("--force") || args.includes("-f");
  const keyIdx = args.indexOf("--key");
  const key = keyIdx !== -1 ? args[keyIdx + 1] : undefined;

  if (!isNeon && !isVercel && !isSupabase && !isCloudflare && !isAzion && !isFastly && !isAll) {
    console.log(`
===========================================================
  OpenLiate Link — Multi-Cloud Sovereign Grid (BYOC)
===========================================================

Regional Cloud (Co-Located Postgres & Compute):
  liate link --neon            Link Neon Serverless Postgres & pgvector (1M runs)
  liate link --vercel          Link Vercel Functions & Daemons (1M runs)
  liate link --supabase        Link Supabase Database & Edge Functions (500k runs)

Worldwide Edge Cloud (Phase 2 Expansion · Anycast BGP Edge Grid):
  liate link --cloudflare      Link Cloudflare Workers V8 Isolates (3M runs)
  liate link --azion           Link Azion Edge Functions 500+ PoPs (3M runs)
  liate link --fastly          Link Fastly WASM Compute via API Key (10M runs)

Universal:
  liate link --all             Link all configured cloud providers

Usage:
  liate link <provider> [--key <token>]
`);
    return;
  }

  let provider: "neon" | "vercel" | "supabase" | "cloudflare" | "azion" | "fastly" | "all" = "all";
  if (isNeon) {
    provider = "neon";
  } else if (isVercel) {
    provider = "vercel";
  } else if (isSupabase) {
    provider = "supabase";
  } else if (isCloudflare) {
    provider = "cloudflare";
  } else if (isAzion) {
    provider = "azion";
  } else if (isFastly) {
    provider = "fastly";
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
  const isCloudflare = args.includes("--cloudflare") || args.includes("cloudflare");
  const isAzion = args.includes("--azion") || args.includes("azion");
  const isFastly = args.includes("--fastly") || args.includes("fastly");
  const isAll = args.includes("--all") || args.includes("all");
  const keyIdx = args.indexOf("--key");
  const key = keyIdx !== -1 ? args[keyIdx + 1] : undefined;

  if (!isNeon && !isVercel && !isSupabase && !isCloudflare && !isAzion && !isFastly && !isAll) {
    console.log(`
===========================================================
  OpenLiate Relink — Refresh Cloud Credentials
===========================================================

Please specify a cloud provider to relink:
  liate relink --neon          Relink Neon via fresh OAuth
  liate relink --vercel        Relink Vercel via fresh OAuth
  liate relink --supabase      Relink Supabase via fresh OAuth
  liate relink --cloudflare    Relink Cloudflare Workers
  liate relink --azion         Relink Azion Edge Functions
  liate relink --fastly        Relink Fastly Compute
  liate relink --all           Relink all connected clouds

Usage:
  liate relink <provider>
`);
    return;
  }

  let provider: "neon" | "vercel" | "supabase" | "cloudflare" | "azion" | "fastly" | "all" = "all";
  if (isNeon) {
    provider = "neon";
  } else if (isVercel) {
    provider = "vercel";
  } else if (isSupabase) {
    provider = "supabase";
  } else if (isCloudflare) {
    provider = "cloudflare";
  } else if (isAzion) {
    provider = "azion";
  } else if (isFastly) {
    provider = "fastly";
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
  const isCloudflare = args.includes("--cloudflare") || args.includes("cloudflare");
  const isAzion = args.includes("--azion") || args.includes("azion");
  const isFastly = args.includes("--fastly") || args.includes("fastly");
  const isAll = args.includes("--all") || args.includes("all");

  if (!isNeon && !isVercel && !isSupabase && !isCloudflare && !isAzion && !isFastly && !isAll) {
    console.log(`
===========================================================
  OpenLiate Unlink — Disconnect Cloud Provider
===========================================================

Please specify a cloud provider to unlink:
  liate unlink --neon          Unlink Neon & clear saved credentials
  liate unlink --vercel        Unlink Vercel & clear saved credentials
  liate unlink --supabase      Unlink Supabase & clear saved credentials
  liate unlink --cloudflare    Unlink Cloudflare Workers credentials
  liate unlink --azion         Unlink Azion credentials
  liate unlink --fastly        Unlink Fastly credentials
  liate unlink --all           Unlink all connected clouds

Usage:
  liate unlink <provider>
`);
    return;
  }

  let provider: "neon" | "vercel" | "supabase" | "cloudflare" | "azion" | "fastly" | "all" = "all";
  if (isNeon) {
    provider = "neon";
  } else if (isVercel) {
    provider = "vercel";
  } else if (isSupabase) {
    provider = "supabase";
  } else if (isCloudflare) {
    provider = "cloudflare";
  } else if (isAzion) {
    provider = "azion";
  } else if (isFastly) {
    provider = "fastly";
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
