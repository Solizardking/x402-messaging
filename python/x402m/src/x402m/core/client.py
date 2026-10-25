"""Agent Auth transport matching x402m-bot/client.mjs; no wallet signing."""
import base64
import json
import os
import stat
from pathlib import Path
from urllib.parse import urlsplit

import httpx
from .auth import private_key_from_jwk, sign_agent_jwt, assert_messaging_capabilities, assert_not_payment_authorization
from ..types.config import PROVIDER, CAPABILITIES


def encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def compact(value) -> bytes:
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode()


class X402mClient:
    def __init__(self, agent_id=None, private_key=None, provider=PROVIDER, transport=None):
        url = urlsplit(provider)
        if (url.scheme != "https" and not (url.scheme == "http" and url.hostname in ("localhost", "127.0.0.1"))):
            raise ValueError("HTTPS required")
        if not url.hostname or url.username or url.password or url.path not in ("", "/") or url.query or url.fragment:
            raise ValueError("provider must be an origin")
        self.provider = provider.rstrip("/")
        self.agent_id, self.key = agent_id, private_key
        self.http = httpx.AsyncClient(transport=transport, timeout=30, follow_redirects=False)

    @classmethod
    def from_env(cls, env=None, **kwargs):
        env = os.environ if env is None else env
        key = None
        if env.get("X402M_KEY_FILE"):
            with Path(env["X402M_KEY_FILE"]).open("rb") as handle:
                info = os.fstat(handle.fileno())
                if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077:
                    raise ValueError("X402M_KEY_FILE must be private (chmod 600)")
                jwk = json.load(handle)
            key = private_key_from_jwk(jwk)  # Ed25519 (EdDSA) or secp256k1 (ES256K)
        return cls(env.get("X402M_AGENT_ID"), key, env.get("X402M_PROVIDER", PROVIDER), **kwargs)

    async def read(self, path):
        if not path.startswith("/") or path.startswith("//"):
            raise ValueError("origin-relative path required")
        response = await self.http.get(self.provider + path)
        response.raise_for_status()
        return response.json()

    async def discover(self):
        return {"protocol": await self.read("/api/x402m/discovery"), "directory": await self.read("/api/x402m/agents")}

    async def execute(self, capability, arguments=None):
        if capability not in CAPABILITIES:
            raise ValueError("Unknown messaging capability")
        if not self.agent_id or not self.key:
            raise ValueError("Agent enrollment required; set X402M_AGENT_ID and X402M_KEY_FILE")
        url = self.provider + "/api/auth/capability/execute"
        body = compact({"capability": capability, "arguments": {} if arguments is None else arguments})
        assert_messaging_capabilities([capability])
        assert_not_payment_authorization({"body": {"arguments": arguments or {}}})
        token = sign_agent_jwt(self.key, self.agent_id, url, body, capability)
        response = await self.http.post(url, content=body, headers={"content-type": "application/json", "authorization": "Bearer " + token})
        response.raise_for_status()
        result = response.json()
        return result.get("data", result)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        await self.http.aclose()
