# Changelog

All notable changes to the **OpenLiate** platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.0.18] - 2026-11-04 — Entry to OpenLiate: Runway is ready

Milestone establishing `src/liate.ts` as the single hero entrypoint for OpenLiate, preparing the runway for developers and direct YC demo parity.

### Unified Hero Entrypoint (`src/liate.ts`)
- **Dual-Duty Architecture**: Single branded file serving both as the programmatic SDK export hub and direct execution entrypoint (`bun run src/liate.ts run ...`).
- **Retired Generic Roots**: Fully eliminated generic `src/index.ts` in favor of the branded `src/liate.ts`.
- **Runway Ready**: Verified end-to-end live execution with FastMCP stdio transport and Sarvam 105B reasoning.

---

## [0.0.17] - 2026-11-04 — Isolated Workspace (.openliate/), Local MCP Cache, and Cloud Link Credentials

Architecture and developer experience milestone establishing the dedicated `.openliate/` workspace directory, local MCP server caching, user-created agent discovery, and isolated cloud link credentials.

### Isolated Workspace Architecture (`.openliate/`)
- **User Custom Agents (`.openliate/agents/`):**
  - `openliate create` automatically writes user-defined agents into `.openliate/agents/<name>/agent.json`.
  - Manifest resolution in CLI (`openliate run <name>`) and Runtime Server (`POST /run`) inspects `.openliate/agents/` first before checking built-in `hub/agents/`.
  - Hub agent discovery endpoints (`GET /hub/agents`, `GET /hub/agents/:id`) dynamically list and inspect user-created agents alongside official Hub agents.
- **Local MCP Cache & Custom Server Registry (`.openliate/mcp.json`):**
  - Automatically initialized during `openliate join`.
  - Serves as a persistent cache for MCP servers (`sarvam`, `fetch`, `agentmail`, `neon`) and allows direct registration of custom MCP tools without modifying repository hub files.
- **Isolated Cloud Link Storage (`.openliate/link/`):**
  - Cloud credentials and OAuth tokens for Neon (`neon.json`), Vercel (`vercel.json`), and Supabase (`supabase.json`) are stored cleanly in `.openliate/link/`.
  - Entire `.openliate/` directory is git-ignored, protecting sensitive keys and credentials from repository commits.
- **Session Memory Routing (`.openliate/sessions/`):**
  - Session files (`sessions/<name>.json`) automatically serialize to `.openliate/sessions/<name>.json`, eliminating loose root directories.

### OpenLiate Join Flow
- **Modernized Terminal Flow:** Clean setup banner `OpenLiate Join - Sovereign AI Agents` configuring primary AI gateway and local workspace.
- **Removed Legacy Terminology:** Cleaned out all references to "Mesh" and standalone placeholders.

### Stability & Verification
- 66/66 passing unit and integration tests across 14 test suites with 299 assertions.
- Production bundles: `dist/bin.js` (2.37 MB), `dist/cli/openliate.exe` (native binary), and `dist/runtime/index.js` (1.31 MB).

---

## [0.0.16] - 2026-11-04 — Polished of OpenLiate : Runtime Server, Hub Endpoints, Dynamic Models, and Clean Architecture

Major architecture and platform polish release establishing the OpenLiate Runtime Server, comprehensive Hub Registry API, dynamic model discovery, and clean decoupled versioning.

### OpenLiate Hub Registry API (`/hub`)
- **Complete Hub Manifest (`GET /hub`):** Returns all available assets in the OpenLiate Hub across agents, LLMs, and MCP tools with aggregate resource counts.
- **Granular Hub Endpoints:**
  - `GET /hub/agents` and `GET /agents`: Lists all pre-configured autonomous agents with models, versions, and intents.
  - `GET /hub/agents/:id` and `GET /agents/:id`: Returns the full parsed manifest (`agent.json`) for individual inspection.
  - `GET /hub/llm` and `GET /hub/models`: Dynamic catalog of sovereign LLM definitions.
  - `GET /hub/mcp` and `GET /hub/tools`: Dynamic catalog of Model Context Protocol tool servers.

### Runtime Server Modernization
- **Direct Runtime Server (`src/server/runtime.ts`):** Shifted from legacy `engine` to direct `runtime` server (`createRuntimeApp`, `startRuntimeServer`).
- **Production Bundles in `dist/runtime/`:** Updated build pipelines, Dockerfile, and docker-compose to target `dist/runtime/index.js` as `openliate-runtime`.
- **Cloud Orchestration Updates:** Updated Neon, Vercel, and Supabase deployment handlers to `deployRuntime` and `dist/runtime`.

### Dynamic Layer [L] & Neon AI Gateway
- **Zero Model Hardcoding:** Removed all hardcoded model arrays and fallback strings; dynamically resolves models via `hub/llm/*.json`.
- **Official Neon AI Gateway (`hub/llm/neon.json`):** Integrated native Neon AI Gateway model definitions with branch-scoped bearer authentication.
- **Dynamic Routing:** Requests across `/chat` and `/v1/chat/completions` route dynamically through `LLMRouter` with generic header forwarding.

### Clean Naming & Decoupled Versioning
- **Zero-Alias Architecture:** Eliminated legacy aliases (`LiateMcp`, `createEngineApp`). Exposes pure, modern APIs: `Agent`, `createAgent`, `create`, `MCP`, and `createRuntimeApp`.
- **Decoupled Agent Manifest Lifecycle:** OpenLiate release version (`0.0.16`) is maintained in `package.json` and `src/core/version.ts`, while individual agent manifests (`hub/agents/*/agent.json`, root `agent.json`) manage their own versioning starting at `0.0.1`.
- **Dynamic Agent MCP Exposer:** `createAgentMcpServer(agent)` dynamically exposes the agent's individual version (`agent.version || "0.0.1"`).
- **Brand Harmonization:** Unified `OpenLiate` casing across all terminal banners, deployment logs, and docstrings.

### Stability & Verification
- 65/65 passing unit and integration tests across 14 test suites with 291 assertions.
- Production bundles: `dist/bin.js` (2.36 MB), `dist/cli/openliate.exe` (native binary), and `dist/runtime/index.js` (1.31 MB).

---

## [0.0.15] - 2026-11-04 — OpenLiate v0.0.15: Phase 1 [Half] — LIATE 5-Layer Restructure & Sovereign Gateway Consolidation

Major architecture milestone hardening OpenLiate's core into 5 decoupled layers matching NVIDIA's 5 agent elements.

### LIATE 5-Layer Architecture (`src/layers/`)
- **[L] Model (`src/layers/llm/model.ts`):** Token factory routing for Sarvam AI Sovereign Models (`sarvam-105b`, `sarvam-2b`) and Neon AI Gateway.
- **[I] Knowledge (`src/layers/integration/knowledge.ts`):** Dynamic state, session resolution, and memory provider lifecycle (`IntegrationResolver`).
- **[A] Harness (`src/layers/agent/harness.ts`):** Autonomous ReAct harness and loop execution engine.
- **[T] Tools (`src/layers/tools/registry.ts`):** MCP specification parser and tool registry for Model Context Protocol v2.
- **[E] Sandbox (`src/layers/environment/sandbox.ts`):** Environmental sandboxing, environment variable loading, and domain boundary guardrails.

### Sovereign Gateway & Provider Consolidation
- **Purged Scraping Layer:** Completely eliminated OmniRoute scrapers, headless browser dependencies, and unauthenticated proxy logic.
- **Neon AI Gateway Integration:** Native client for Neon AI Gateway with branch-scoped tokens (`NEON_AI_GATEWAY_TOKEN`, `NEON_AI_GATEWAY_BASE_URL`).
- **Sarvam AI Token Factory:** Standardized Layer [L] on official Sarvam AI `/v2` OpenAI-compatible chat completions.

### Stability & Builds
- 58/58 tests passing across 14 test suites with zero breaking changes to public SDK exports.
- Clean production bundles: `dist/bin.js` (2.34 MB) and `dist/engine/index.js` (1.30 MB).

---

## [0.0.10] - 2026-11-03 — OpenLiate v0.0.10: Phase 1 Begins — Brand Unification, .openliate System Config, and Sarvam AI Sovereign Agent

Major public milestone establishing the open-source backend layer for sovereign AI agents.

### Sovereign Indic AI & Sarvam Integration
- **Sarvam AI Sovereign Agent (`hub/agents/sarvam-agent`):** Pre-configured sovereign Indic AI agent powered by `sarvam/sarvam-105b` and `sarvam/sarvam-2b`.
- **Native Sarvam MCP Protocol (`mcp:sarvam`):** Built-in Model Context Protocol client for Sarvam AI tools and token factory infrastructure.
- **Provider-Agnostic BYOAI Key Injection:** Generic on-the-fly execution supporting arbitrary inference providers (`SARVAM_API_KEY`, etc.) with zero vendor markup.

### Brand Unification & System-Level Configuration
- **Brand Unification:** Unified brand identity strictly as **OpenLiate** across all cloud endpoints, CLI binaries, OAuth 2.1 metadata, and health checks.
- **System-Level `.openliate` Configuration:** Global configuration stored in `~/.openliate/config.json` with multi-project fallback, eliminating duplicate API key prompts.
- **Direct Unscoped Package:** Distributed as `openliate` with `openliate` and `liate` dual binary aliases.
- **Neon Function Triggers:** Native integration with Neon Postgres for scale-to-zero scheduled background cron triggers.
- **OpenLiate Brand Standardization:** Unified brand identity across all cloud endpoints, CLI binaries, OAuth 2.1 metadata, and health checks (`@openliate/liate`).
- **Open Source Sponsorship:** Added `.github/FUNDING.yml` for community GitHub Sponsors.

---

## [0.0.9] - 2026-11-02 — Developer Documentation Suite & Architecture Specification

Complete developer documentation and architecture specification suite.

### Comprehensive Mintlify Documentation (`docs.openliate.tech`)
- **Full Architecture Suite:** 20 in-depth MDX documentation pages covering:
  - **Doctrine & Manifesto:** *"Class is an Agent. Agent is a Function. Function is an API."*
  - **The 5 Architectural Layers:** Large Models (`[L]`), Integration Memory (`[I]`), Agent ReAct Loop (`[A]`), Tools & MCP (`[T]`), and Environment Sandbox (`[E]`).
  - **Runtime & Execution Guides:** Quickstart, Agent Unified Manifest (AUM) specification, CLI reference, and Docker deployment.
  - **LAPI REST API Reference:** Full OpenAPI-style endpoint documentation for `/health`, `/agents`, and `/run`.

---

## [0.0.8] - 2026-11-02 — Multi-Cloud Link Mesh, Docker Stack, and RFC 9562 UUIDv7

Multi-cloud deployment grid and time-ordered distributed identifiers.

### Multi-Cloud Link Mesh (`liate link`)
- **1-Click Multi-Cloud Mesh (`liate link`):** Link Neon, Vercel, and Supabase accounts in a single command, unlocking **2,500,000 Free AI Agent Runs / Month** ($0.00/mo).
- **Neon Cloud (`liate link --neon`):** Provisions regional serverless Postgres with co-located Linux compute (2 vCPU, 8 GB RAM) for 1,000,000 Free Runs/mo via automated RFC 7591 dynamic client registration and RFC 7636 PKCE loopback flow (`http://127.0.0.1:54321/callback`).
- **Vercel Cloud (`liate link --vercel` / `liate link --vercel-daemons`):** Deploys serverless HTTP engine (1M runs) and 24/7 background worker daemons via loopback port `54322`.
- **Supabase Cloud (`liate link --supabase`):** Deploys pure Deno V8 Edge Functions co-located with `pgvector` store for 500,000 Free Runs/mo on loopback port `54323`.
- **Credential Lifecycle:** Added `liate relink` and `liate unlink` to safely refresh or purge cached tokens.

### Standards & Containers
- **RFC 9562 Monotonic UUIDv7 (`src/core/uuid.ts`):** High-throughput, time-ordered distributed UUID generation with zero external dependencies.
- **Universal Multi-Runtime Docker Stack:** Containerized environment bundling Node 24, Python 3.14, Astral `uv` / `uvx`, and `npx`.
- **Automated Verification:** 46 unit test suites with 196 passing assertions.

---

## [0.0.7] - 2026-10-31 — LAPI Pure Engine Server and Sovereign Identity

High-performance HTTP server interface and Indian sovereign compliance verification.

### LAPI Engine Server (`liate serve`)
- **Liate Agent Protocol Interface (LAPI):** High-performance HTTP server (`src/server/engine.ts`) built on Hono.
- **Endpoints:**
  - `GET /health`: Engine status, version, LAPI protocol specifications, and core doctrine.
  - `GET /agents`: Auto-discovers and lists pre-configured agents from Liate Hub.
  - `POST /run`: Executes agents on the fly from raw prompts or declarative manifests with session-based memory retention.

### Sovereign Identity Verification
- **Aadhaar & PAN Verification Tool (`src/tools/builtin/identity.ts`):** Indian Sovereign Aadhaar 12-digit Verhoeff checksum algorithm and Income Tax Department PAN format classifier with automatic credential masking.

---

## [0.0.6] - 2026-10-31 — Liate CLI and Liate Hub

Autonomous execution CLI runner and OpenLiate Hub pre-built reference agents.

- **Unified CLI Runner (`src/cli.ts`):** Single hero command `liate run <agent.json|agent-name> "<prompt>"` that executes any local manifest or Hub agent.
- **Liate Hub Agents (`hub/agents/`):** Pre-configured reference agents ready to run out of the box:
  - `research-agent`: Web research and markdown content extraction via `mcp:fetch`.
  - `email-agent`: Autonomous inbox and thread management via `mcp:agentmail`.
  - `identity-agent`: Indian sovereign Aadhaar (Verhoeff checksum) and PAN verification.
  - `general-agent`: Core architecture and reasoning agent.
- **Automatic Manifest Resolution:** Seamlessly resolves manifest files by path or agent name from `hub/agents/`.
- **Automatic .env Discovery:** CLI boots and expands environment variables without manual shell exports.

---

## [0.0.5] - 2026-10-31 — [E] Environment and Sandbox Layer

Environment secrets, sandbox guardrails, and automated configuration discovery.

- **Automated .env Loader (`EnvironmentResolver.loadEnv`):** Scans working directory, manifest directory, parent directories, and home directory (`~/.liate/.env`) with zero external dependencies.
- **Dynamic Secret Expansion:** Safely interpolates `$VAR` syntax in manifests and MCP configs at runtime.
- **Secret Masking:** Automatically masks sensitive API keys in logs and traces (`sk_l***5678`).
- **Sandbox Guardrails:** Configurable network domain allowlisting (`allowedDomains`), timeouts, and network isolation toggles.

---

## [0.0.4] - 2026-10-31 — [T] Tools and MCP v2 Layer

Model Context Protocol (MCP v2) client and server integration with native edge tools.

- **Official MCP v2 Client:** Powered by `@modelcontextprotocol/client` and `@modelcontextprotocol/client/stdio` (v2.4.0) with standard JSON-RPC 2.0 protocol negotiation (`initialize` and `notifications/initialized`).
- **Persistent Stdio Transport:** Persistent subprocess lifecycle management (`uvx mcp-server-fetch`) avoiding per-call process recreation.
- **Remote HTTP / SSE Transport:** Zero-dependency HTTP JSON-RPC 2.0 streaming transport supporting Server-Sent Events (tested live on AgentMail).
- **Native Built-in Tools:**
  - `fetch`: Sub-millisecond C-level isolate REST API and webhook caller.
  - `verify_identity`: Indian Sovereign Aadhaar 12-digit Verhoeff checksum algorithm and Income Tax Department PAN format classifier with automatic credential masking.
- **Agent as an MCP Server (`createAgentMcpServer`):** Exposes any Liate agent as an MCP server with `<agent>_run` and `<agent>_health` tools for Claude Desktop, Cursor, and Antigravity.
- **Resource Lifecycle Management (`LiateMcp.closeAll`):** Clean termination of active child processes and stream handles in execution cleanup blocks.

---

## [0.0.3] - 2026-10-30 — [A] Agent Harness and ReAct Loop Layer

Autonomous cognitive execution harness implementing the ReAct methodology.

- **ReAct Loop Engine (`src/agent/loop.ts`):** Autonomous multi-turn Think -> Act -> Observe -> Answer cycle.
- **OpenAI Tool Call Protocol:** Formats tools into OpenAI-compliant function definitions and handles tool responses.
- **Step Guardrails:** Enforces `maxSteps` boundaries to prevent infinite reasoning loops.
- **Trajectory Persistence:** Captures thoughts, tool calls, and observations into session memory.

---

## [0.0.2] - 2026-10-30 — [I] Integration and Memory Layer

Pluggable memory providers and session persistence for sovereign AI agents.

- **Dual Memory Backends:**
  - `InMemorySession`: Ephemeral, ultra-fast memory provider for stateless execution.
  - `FileSessionMemory`: Persistent JSON session storage on disk with atomic serialization.
- **Dynamic Resolver (`IntegrationResolver`):** Parses Layer `[I]` configs (`:memory:` vs file path).

---

## [0.0.1] - 2026-10-29 — [L] Large Models & Core LIATE Architecture

Initial architectural foundation defining the sovereign agent manifest and LLM inference abstraction.

- **Agent Unified Manifest (AUM):** Formally defined the 5-element schema: `L · I · A · T · E`.
- **Sarvam AI & OpenAI Compatible Provider:** Pluggable LLM interface supporting local and cloud inference with system prompt injection and streaming capabilities.
- **Monorepo Structure:** Zero-dependency standalone TypeScript design compiling to standalone binaries via Bun.
