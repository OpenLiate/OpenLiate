# Changelog

All notable changes to the **Liate** platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- **Session State Management:** Key-value state tracking alongside conversation message history.

---

## [0.0.1] - 2026-10-30 — [L] Large Models Layer

First-class support for sovereign Indian foundation models and universal LLM providers.

- **Sarvam AI /v2 Client:** Native REST client for Sarvam AI `/v2` endpoint using Web Standard `fetch`.
- **Sarvam 105B Support:** Integrated Sarvam's flagship `sarvam-105b` foundation model with native reasoning and tool calling.
- **Dynamic Model Hub (`hub/llm/`):** Declarative JSON model specifications (`sarvam.json`) with zero hardcoded model configurations.
- **Token Factory & Model Normalization:** Dynamic provider and model parser (`normalizeModelConfig`).

---

## [0.0.0] - 2026-10-29 — [0] Liate Begin

Open Source Backend Layer for AI Agents.  
*"If Stripe did payments in 7 lines of code, why not AI Agents in 5 lines of code?"*  
*"Don't build AI agents. Integrate by parts." — L[LM] · I[ntegration] · A[gent] · T[ools] · E[nvironment]*  
**Slogan:** *"Let's Try Liate."*

- **5 Lines of Code (`agent.json`):** Define an agent, run it, scale it — build any AI agent in just 5 lines.
- **AUM (Agent Unified Manifest):** Declarative 5-pillar specification contract for AI agents.
- **OM (Orchestration Module):** Autonomous core engine executing the 5 orthogonal layers (`L · I · A · T · E`).
- **Mathematical Inspiration:** Just like the LIATE rule in calculus breaks down complex problems by parts, LIATE makes building agents simple.
- **NVIDIA Alignment:** 1-to-1 match with Jensen Huang's 5 agent elements: *Model (`L`), Knowledge (`I`), Harness (`A`), Tools (`T`), Sandbox (`E`)*.
- **Milestone:** Selected for the **Sarvam AI Startup Program 2026** (India).
- **Open Source Foundation:** Initialized repository under MIT License at `openliate/liate`.
