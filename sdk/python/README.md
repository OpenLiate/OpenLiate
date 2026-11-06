# OpenLiate — Python SDK

### Sovereign AI Agents in 5 Lines: Class is an Agent.
`L[LM] · I[ntegration] · A[gent] · T[ools] · E[nvironment]`

---

## Installation

```bash
pip install openliate
```

---

## Quickstart (`agent.py`)

```python
from openliate import liate

class HelloAgent(liate):
    L = "sarvam/sarvam-105b"
    I = {"memory": "sessions/hello-agent"}
    A = {"name": "hello_agent", "intent": "Autonomous Assistant"}
    T = ["fetch"]
    E = {"SARVAM_API_KEY": "$SARVAM_API_KEY"}

agent = HelloAgent()

# 1. Inspect declarative AUM manifest
print(agent.to_manifest())

# 2. Run agent via OpenLiate engine
result = agent.run("Namaste world!")
print(result.response)
```

---

## Architecture: AUM & OM

Every agent declares the 5 orthogonal layers according to the **Agent Unified Manifest (AUM)** standard:

- **`L` (Model):** Sovereign LLM provider and model (e.g., Sarvam 105B).
- **`I` (Integration):** Memory retention, Postgres, and knowledge repositories.
- **`A` (Agent / Harness):** Agent name, intent, and reasoning loop.
- **`T` (Tools):** Anthropic Model Context Protocol (MCP) and custom tools.
- **`E` (Environment):** Secrets and guardrails.

Execution is powered by the **Orchestration Module (OM)** connecting locally or to deployed cloud endpoints.

---

## License

MIT © [OpenLiate](https://openliate.tech)

