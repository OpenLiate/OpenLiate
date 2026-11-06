"""
OpenLiate Python LAPI Client
Connects to OpenLiate Orchestration Module (OM) via standard LAPI /run protocol.
"""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
import json
import urllib.request
import urllib.error
import time

@dataclass
class AgentRunResult:
    """
    Standard OpenLiate execution response object.
    """
    response: str
    steps: List[Dict[str, Any]] = field(default_factory=list)
    execution_time_ms: float = 0.0
    session_id: Optional[str] = None
    agent: Optional[str] = None
    raw: Dict[str, Any] = field(default_factory=dict)

    def __str__(self) -> str:
        return self.response

class LapiClient:
    """
    HTTP client for communicating with OpenLiate LAPI endpoint.
    Supports both standard library urllib (zero dependencies) and httpx (async).
    """
    def __init__(self, endpoint: str = "http://localhost:7071"):
        self.endpoint = endpoint.rstrip("/")

    def run(self, manifest: Dict[str, Any], prompt: str, session_id: Optional[str] = None) -> AgentRunResult:
        """
        Synchronous run via standard urllib.
        """
        url = f"{self.endpoint}/run"
        payload = {
            "manifest": manifest,
            "prompt": prompt
        }
        if session_id:
            payload["sessionId"] = session_id

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"}
        )

        start_time = time.time()
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                status = resp.status
                body = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8")
            try:
                err_json = json.loads(err_body)
                err_msg = err_json.get("error", err_body)
            except Exception:
                err_msg = err_body
            raise RuntimeError(f"[OpenLiate LAPI Error HTTP {e.code}]: {err_msg}") from e
        except urllib.error.URLError as e:
            raise ConnectionError(
                f"[OpenLiate Connection Error]: Unable to reach LAPI engine at {self.endpoint}. "
                f"Ensure the OpenLiate engine is running (e.g. `openliate serve` or deployed URL)."
            ) from e

        duration_ms = (time.time() - start_time) * 1000.0

        return AgentRunResult(
            response=body.get("text", body.get("response", body.get("output", ""))),
            steps=body.get("steps", []),
            execution_time_ms=body.get("latencyMs", body.get("executionTimeMs", duration_ms)),
            session_id=body.get("sessionId", session_id),
            agent=body.get("agent", manifest.get("A", {}).get("name", "agent")),
            raw=body
        )

    async def arun(self, manifest: Dict[str, Any], prompt: str, session_id: Optional[str] = None) -> AgentRunResult:
        """
        Asynchronous run via httpx.
        """
        try:
            import httpx
        except ImportError:
            raise ImportError(
                "httpx is required for asynchronous arun(). Install with: pip install httpx"
            )

        url = f"{self.endpoint}/run"
        payload = {
            "manifest": manifest,
            "prompt": prompt
        }
        if session_id:
            payload["sessionId"] = session_id

        start_time = time.time()
        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                body = resp.json()
            except httpx.HTTPStatusError as e:
                raise RuntimeError(f"[OpenLiate LAPI Error HTTP {e.response.status_code}]: {e.response.text}") from e
            except httpx.RequestError as e:
                raise ConnectionError(
                    f"[OpenLiate Connection Error]: Unable to reach LAPI engine at {self.endpoint}. "
                    f"Ensure OpenLiate is running (`openliate serve` or cloud endpoint)."
                ) from e

        duration_ms = (time.time() - start_time) * 1000.0

        return AgentRunResult(
            response=body.get("text", body.get("response", body.get("output", ""))),
            steps=body.get("steps", []),
            execution_time_ms=body.get("latencyMs", body.get("executionTimeMs", duration_ms)),
            session_id=body.get("sessionId", session_id),
            agent=body.get("agent", manifest.get("A", {}).get("name", "agent")),
            raw=body
        )

