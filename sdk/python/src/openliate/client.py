"""
OpenLiate Python Client
Connects to OpenLiate Orchestration Module (OM) via standard Agent Protocol Interface / Liate API /run protocol.
"""
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
import json
import urllib.request
import urllib.error
from urllib.parse import urlparse
import time
import os
import socket
import ssl

def _resolve_via_doh(hostname: str) -> Optional[str]:
    """
    Resilient DNS resolver using Cloudflare (1.1.1.1) and Google (8.8.8.8) DNS-over-HTTPS.
    Protects developers on restrictive local CGNAT or corporate routers from NXDOMAIN / Query Refused errors.
    """
    try:
        import certifi
        ctx = ssl.create_default_context(cafile=certifi.where())
    except Exception:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

    providers = [
        f"https://cloudflare-dns.com/dns-query?name={hostname}&type=A",
        f"https://dns.google/resolve?name={hostname}&type=A"
    ]
    for p_url in providers:
        try:
            req = urllib.request.Request(
                p_url, 
                headers={"Accept": "application/dns-json", "User-Agent": "OpenLiate-SDK/0.1.2"}
            )
            with urllib.request.urlopen(req, context=ctx, timeout=5) as r:
                data = json.loads(r.read().decode("utf-8"))
                for ans in data.get("Answer", []):
                    if ans.get("type") == 1 and ans.get("data"):
                        return ans.get("data")
        except Exception:
            continue
    return None

def _dispatch_direct_sni(ip: str, host: str, path: str, payload_bytes: bytes, timeout: int = 120) -> Dict[str, Any]:
    """
    Dispatches request directly to resolved IP with explicit TLS SNI server_hostname.
    """
    sock = socket.create_connection((ip, 443), timeout=timeout)
    ctx = ssl.create_default_context()
    ssock = ctx.wrap_socket(sock, server_hostname=host)
    wire = (
        f"POST {path} HTTP/1.1\r\n"
        f"Host: {host}\r\n"
        f"Content-Type: application/json\r\n"
        f"Content-Length: {len(payload_bytes)}\r\n"
        f"User-Agent: OpenLiate-Python-SDK/0.1.2\r\n"
        f"Connection: close\r\n\r\n"
    ).encode("utf-8") + payload_bytes
    ssock.sendall(wire)
    chunks = []
    while True:
        buf = ssock.recv(4096)
        if not buf:
            break
        chunks.append(buf)
    ssock.close()
    raw = b"".join(chunks).decode("utf-8", errors="ignore")
    parts = raw.split("\r\n\r\n", 1)
    body = parts[1] if len(parts) > 1 else raw

    # Robust JSON extraction supporting chunked transfer encoding
    start_brace = body.find("{")
    end_brace = body.rfind("}")
    if start_brace != -1 and end_brace != -1:
        json_str = body[start_brace:end_brace + 1]
        return json.loads(json_str)

    return json.loads(body)

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

class LiateApiClient:
    """
    HTTP client for communicating with OpenLiate Liate API endpoint (Agent Protocol Interface).
    Supports both standard library urllib (zero dependencies) and httpx (async).
    """
    def __init__(self, endpoint: str = "http://localhost:7071"):
        self.endpoint = endpoint.rstrip("/")

    def run(self, module: Dict[str, Any], prompt: str, session_id: Optional[str] = None) -> AgentRunResult:
        """
        Synchronous run via standard urllib.
        """
        url = f"{self.endpoint}/run"
        payload = {
            "module": module,
            "prompt": prompt
        }
        if session_id:
            payload["sessionId"] = session_id

        # Dynamically resolve BYOAI keys from environment
        keys = {}
        for k, v in module.get("E", {}).items():
            if isinstance(v, str) and v.startswith("$"):
                var_name = v[1:]
                keys[k] = os.environ.get(var_name, "")
            else:
                keys[k] = v
        payload["keys"] = keys

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
            raise RuntimeError(f"[OpenLiate API Error HTTP {e.code}]: {err_msg}") from e
        except urllib.error.URLError as e:
            # Direct resolution for DNS issues on restrictive routers / unpropagated subdomains
            parsed = urlparse(url)
            hostname = parsed.hostname or ""
            doh_ip = _resolve_via_doh(hostname) if hostname else None
            if doh_ip:
                try:
                    body = _dispatch_direct_sni(doh_ip, hostname, parsed.path or "/run", data, timeout=120)
                except Exception as sni_err:
                    raise ConnectionError(
                        f"[OpenLiate Connection Error]: Unable to reach Liate API engine at {self.endpoint} "
                        f"(Direct SNI connection via {doh_ip} failed: {sni_err})."
                    ) from e
            else:
                raise ConnectionError(
                    f"[OpenLiate Connection Error]: Unable to reach Liate API engine at {self.endpoint}. "
                    f"Ensure the OpenLiate engine is running (e.g. `openliate serve` or deployed URL)."
                ) from e

        duration_ms = (time.time() - start_time) * 1000.0

        return AgentRunResult(
            response=body.get("text", body.get("response", body.get("output", ""))),
            steps=body.get("steps", []),
            execution_time_ms=body.get("latencyMs", body.get("executionTimeMs", duration_ms)),
            session_id=body.get("sessionId", session_id),
            agent=body.get("agent", module.get("A", {}).get("name", "agent")),
            raw=body
        )

    async def arun(self, module: Dict[str, Any], prompt: str, session_id: Optional[str] = None) -> AgentRunResult:
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
            "module": module,
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
                raise RuntimeError(f"[OpenLiate API Error HTTP {e.response.status_code}]: {e.response.text}") from e
            except httpx.RequestError as e:
                raise ConnectionError(
                    f"[OpenLiate Connection Error]: Unable to reach Liate API engine at {self.endpoint}. "
                    f"Ensure OpenLiate is running (`openliate serve` or cloud endpoint)."
                ) from e

        duration_ms = (time.time() - start_time) * 1000.0

        return AgentRunResult(
            response=body.get("text", body.get("response", body.get("output", ""))),
            steps=body.get("steps", []),
            execution_time_ms=body.get("latencyMs", body.get("executionTimeMs", duration_ms)),
            session_id=body.get("sessionId", session_id),
            agent=body.get("agent", module.get("A", {}).get("name", "agent")),
            raw=body
        )

