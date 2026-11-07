import { link, relink, unlink } from "../../cloud/link";

export async function handleLinkCommand(args: string[]): Promise<void> {
  const isNeon = args.includes("--neon") || args.includes("neon");
  const isVercel = args.includes("--vercel") || args.includes("vercel");
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
  OpenLiate Link — Multi-Cloud Compute (18.5M Runs)
===========================================================

Available Compute Providers:
  openliate link --fastly          Fastly WASM Compute        (10M runs)
  openliate link --cloudflare      Cloudflare Workers          (3M runs)
  openliate link --azion           Azion Edge Functions        (3M runs)
  openliate link --neon            Neon Cloud Compute          (1M runs)
  openliate link --vercel          Vercel Fluid Compute        (1M runs)
  openliate link --supabase        Supabase Edge Functions   (500k runs)
  openliate link --all             Link All 6 Clouds         (18.5M runs)

Usage:
  openliate link <provider> [--key <token>]
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
    await link({ provider, key, relink: isRelink });
  } catch (err: any) {
    console.error(`\n[Link Error]: ${err.message}`);
    process.exit(1);
  }
}

export async function handleRelinkCommand(args: string[]): Promise<void> {
  const isNeon = args.includes("--neon") || args.includes("neon");
  const isVercel = args.includes("--vercel") || args.includes("vercel");
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
  openliate relink --neon          Relink Neon via fresh OAuth
  openliate relink --vercel        Relink Vercel via fresh OAuth
  openliate relink --supabase      Relink Supabase via fresh OAuth
  openliate relink --cloudflare    Relink Cloudflare Workers
  openliate relink --azion         Relink Azion Edge Functions
  openliate relink --fastly        Relink Fastly Compute
  openliate relink --all           Relink all connected clouds

Usage:
  openliate relink <provider>
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
    await relink({ provider, key });
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
  openliate unlink --neon          Unlink Neon & clear saved credentials
  openliate unlink --vercel        Unlink Vercel & clear saved credentials
  openliate unlink --supabase      Unlink Supabase & clear saved credentials
  openliate unlink --cloudflare    Unlink Cloudflare Workers credentials
  openliate unlink --azion         Unlink Azion credentials
  openliate unlink --fastly        Unlink Fastly credentials
  openliate unlink --all           Unlink all connected clouds

Usage:
  openliate unlink <provider>
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
