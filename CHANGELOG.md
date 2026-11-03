# Changelog

All notable changes to the **OpenLiate** platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-11-03 — OpenLiate v0.1.0: Sarvam AI Sovereign Agent, Neon Cron Triggers, and Public Launch

Major public milestone establishing the open-source backend layer for sovereign AI agents.

### Sovereign Indic AI & Sarvam Integration
- **Sarvam AI Sovereign Agent (`hub/agents/sarvam-agent`):** Pre-configured sovereign Indic AI agent powered by `sarvam/sarvam-105b` and `sarvam/sarvam-2b`.
- **Native Sarvam MCP Protocol (`mcp:sarvam`):** Built-in Model Context Protocol client for Sarvam AI tools and token factory infrastructure.
- **Provider-Agnostic BYOAI Key Injection:** Generic on-the-fly execution supporting arbitrary inference providers (`SARVAM_API_KEY`, etc.) with zero vendor markup.

### Cloud Automation & Scaling
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
