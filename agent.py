import sys
import os
import json

# Auto-load local .env if present
if os.path.exists(".env"):
    with open(".env") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

# Add sdk/python/src to sys.path so it works directly from repo root
sys.path.insert(0, os.path.abspath("sdk/python/src"))

from openliate import liate

class HelloAgent(liate):
    L = "sarvam/sarvam-105b"
    I = {"memory": "sessions/hello-agent"}
    A = {"name": "hello_agent", "intent": "Autonomous Sovereign Agent"}
    T = {
        "fetch": {
            "command": "uvx",
            "args": ["mcp-server-fetch"],
            "tools": ["*"]
        }
    }
    E = {"SARVAM_API_KEY": os.environ.get("SARVAM_API_KEY", "$SARVAM_API_KEY")}

def main():
    agent = HelloAgent()
    print("=== [agent.py] Agent Unified Module (AUM) ===")
    print(json.dumps(agent.to_module(), indent=2))

    print("\n=== [agent.py] Executing via Orchestration Module (OM) ===")
    try:
        result = agent.run("Introduce yourself in one sentence and say Namaste.")
        print("\nAgent Output:\n" + result.response)
    except ConnectionError as e:
        print("\nNote: Liate API daemon connection notice:")
        print(str(e))
    except Exception as e:
        print("\nExecution result / note:", str(e))

if __name__ == "__main__":
    main()

