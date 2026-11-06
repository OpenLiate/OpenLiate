"""
Core Engine: OM (Orchestration Module)
Matches AUM (Agent Unified Manifest) specification across 5 orthogonal layers:
L[LM] · I[ntegration] · A[gent] · T[ools] · E[nvironment]
"""
from typing import Any, Dict, List, Optional, Union
import os
from .client import LapiClient, AgentRunResult

class liate:
    """
    OM (Orchestration Module) — Python OOP Base Class for AI Agents.
    Supports pure LIATE authoring across 3 styles:
    1. Shorthand: L · I · A · T · E
    2. Full Name: LLM · Integration · Agent · Tools · Environment
    3. Lowercase: llm · integration · agent · tools · environment

    Example:
    ```python
    from openliate import liate

    class HelloAgent(liate):
        LLM = "sarvam/sarvam-105b"
        Integration = {"memory": "sessions/hello-agent"}
        Agent = {"name": "hello_agent"}
        Tools = ["fetch"]
        Environment = {"SARVAM_API_KEY": "$SARVAM_API_KEY"}

    agent = HelloAgent()
    result = agent.run("Namaste world!")
    print(result)
    ```
    """
    # 1. Shorthand
    L: Optional[Union[str, Dict[str, Any]]] = None
    I: Optional[Dict[str, Any]] = None
    A: Optional[Union[str, Dict[str, Any]]] = None
    T: Optional[List[Any]] = None
    E: Optional[Dict[str, str]] = None

    # 2. Full Name
    LLM: Optional[Union[str, Dict[str, Any]]] = None
    Integration: Optional[Dict[str, Any]] = None
    Agent: Optional[Union[str, Dict[str, Any]]] = None
    Tools: Optional[List[Any]] = None
    Environment: Optional[Dict[str, str]] = None

    # 3. Lowercase
    llm: Optional[Union[str, Dict[str, Any]]] = None
    integration: Optional[Dict[str, Any]] = None
    agent: Optional[Union[str, Dict[str, Any]]] = None
    tools: Optional[List[Any]] = None
    environment: Optional[Dict[str, str]] = None

    def __init__(self, endpoint: Optional[str] = None):
        self._endpoint = endpoint or os.environ.get("OPENLIATE_ENDPOINT", "http://localhost:7071")
        self._client = LapiClient(endpoint=self._endpoint)

    def to_manifest(self) -> Dict[str, Any]:
        """
        Exports the declarative AUM (Agent Unified Manifest) dictionary.
        """
        l_val = self.L if self.L is not None else (self.LLM if self.LLM is not None else self.llm)
        i_val = self.I if self.I is not None else (self.Integration if self.Integration is not None else self.integration)
        a_val = self.A if self.A is not None else (self.Agent if self.Agent is not None else self.agent)
        t_val = self.T if self.T is not None else (self.Tools if self.Tools is not None else self.tools)
        e_val = self.E if self.E is not None else (self.Environment if self.Environment is not None else self.environment)

        if not l_val:
            raise ValueError(
                f"[OpenLiate Error]: Missing required Layer [L] (LLM) in class '{self.__class__.__name__}'. "
                f"Declare 'L', 'LLM', or 'llm' on your class. "
                f"OpenLiate never hardcodes or falls back to silent model defaults."
            )

        name = self.__class__.__name__
        agent_a = a_val or {"name": name}
        if isinstance(agent_a, str):
            agent_a = {"name": agent_a}

        return {
            "L": l_val,
            "I": i_val or {},
            "A": agent_a,
            "T": t_val or [],
            "E": e_val or {}
        }

    def run(self, prompt: str, session_id: Optional[str] = None) -> AgentRunResult:
        """
        Executes the agent via OpenLiate LAPI.
        """
        manifest = self.to_manifest()
        return self._client.run(manifest=manifest, prompt=prompt, session_id=session_id)

    async def arun(self, prompt: str, session_id: Optional[str] = None) -> AgentRunResult:
        """
        Asynchronously executes the agent via OpenLiate LAPI.
        """
        manifest = self.to_manifest()
        return await self._client.arun(manifest=manifest, prompt=prompt, session_id=session_id)

