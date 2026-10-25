"""x402m/1 auth profiles, ES256K/EdDSA agent JWTs and CAIP ids (mirrors x402m-bot/auth.mjs).

Messaging keys only: no messaging credential can authorize a payment.
"""
import base64
import hashlib
import json
import re
import time
import uuid

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature, encode_dss_signature

AUTH_PROFILES = ("agent-jwt", "better-auth-agent-auth", "reason-network")
TOKEN_PROFILES = ("agent-jwt", "better-auth-agent-auth")  # reason-network is informative only
MAX_LIFETIME = 60
_PAYMENT_FIELDS = ("x-payment", "payment-signature", "paymentPayload", "PaymentPayload", "facilitator", "spend", "payment")
_CAP = re.compile(r"^x402m\.[a-z]+$")


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def unb64(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def _compact(value) -> bytes:
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode()


def algorithm_for_key(key) -> str:
    if isinstance(key, (Ed25519PrivateKey, Ed25519PublicKey)):
        return "EdDSA"
    if isinstance(key, (ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey)) and isinstance(key.curve, ec.SECP256K1):
        return "ES256K"
    raise ValueError("Unsupported agent key type")


def private_key_from_jwk(jwk):
    if not jwk.get("d"):
        raise ValueError("Expected private agent JWK, not a wallet key")
    if jwk.get("kty") == "OKP" and jwk.get("crv") == "Ed25519":
        key = Ed25519PrivateKey.from_private_bytes(unb64(jwk["d"]))
        if jwk.get("x") != b64(key.public_key().public_bytes_raw()):
            raise ValueError("Ed25519 public/private JWK mismatch")
        return key
    if jwk.get("kty") == "EC" and jwk.get("crv") == "secp256k1":
        key = ec.derive_private_key(int.from_bytes(unb64(jwk["d"]), "big"), ec.SECP256K1())
        nums = key.public_key().public_numbers()
        if jwk.get("x") != b64(nums.x.to_bytes(32, "big")) or jwk.get("y") != b64(nums.y.to_bytes(32, "big")):
            raise ValueError("secp256k1 public/private JWK mismatch")
        return key
    raise ValueError("Unsupported agent key: expected Ed25519 or secp256k1 JWK")


def public_key_from_jwk(jwk):
    if jwk.get("kty") == "OKP" and jwk.get("crv") == "Ed25519":
        return Ed25519PublicKey.from_public_bytes(unb64(jwk["x"]))
    if jwk.get("kty") == "EC" and jwk.get("crv") == "secp256k1":
        return ec.EllipticCurvePublicNumbers(int.from_bytes(unb64(jwk["x"]), "big"), int.from_bytes(unb64(jwk["y"]), "big"), ec.SECP256K1()).public_key()
    raise ValueError("Unsupported agent key: expected Ed25519 or secp256k1 JWK")


def _sign(key, data: bytes) -> bytes:
    if algorithm_for_key(key) == "EdDSA":
        return key.sign(data)
    r, s = decode_dss_signature(key.sign(data, ec.ECDSA(hashes.SHA256())))
    return r.to_bytes(32, "big") + s.to_bytes(32, "big")


def _verify(key, data: bytes, sig: bytes) -> bool:
    try:
        if algorithm_for_key(key) == "EdDSA":
            key.verify(sig, data)
        else:
            if len(sig) != 64:
                return False
            key.verify(encode_dss_signature(int.from_bytes(sig[:32], "big"), int.from_bytes(sig[32:], "big")), data, ec.ECDSA(hashes.SHA256()))
        return True
    except InvalidSignature:
        return False


def assert_messaging_capabilities(capabilities):
    if not isinstance(capabilities, list) or not capabilities:
        raise ValueError("capabilities required")
    for cap in capabilities:
        if not isinstance(cap, str) or not _CAP.match(cap):
            raise ValueError(f"Messaging credential cannot carry capability {cap}")


def assert_not_payment_authorization(request):
    headers = {k.lower() for k in (request.get("headers") or {})}
    if headers & {"x-payment", "payment-signature"}:
        raise ValueError("Messaging requests must not carry payment authorization")
    args = (request.get("body") or {}).get("arguments") or {}
    if any(f in args for f in _PAYMENT_FIELDS):
        raise ValueError("Messaging arguments must not carry payment authorization")
    return True


def sign_agent_jwt(key, agent_id, url, body: bytes, capability, now=None, jti=None) -> str:
    assert_messaging_capabilities([capability])
    now = int(time.time()) if now is None else now
    claims = {"sub": agent_id, "aud": url, "iat": now, "exp": now + MAX_LIFETIME, "jti": jti or str(uuid.uuid4()),
              "capabilities": [capability], "htm": "POST", "htu": url, "ath": b64(hashlib.sha256(body).digest())}
    unsigned = b64(_compact({"alg": algorithm_for_key(key), "typ": "agent+jwt"})) + "." + b64(_compact(claims))
    return unsigned + "." + b64(_sign(key, unsigned.encode()))


def verify_agent_jwt(token, public_jwk, url, body=None, pinned_alg=None, now=None, seen=None):
    parts = str(token).split(".")
    if len(parts) != 3:
        raise ValueError("malformed token")
    header, claims = json.loads(unb64(parts[0])), json.loads(unb64(parts[1]))
    if header.get("typ") != "agent+jwt":
        raise ValueError("wrong typ")
    key = public_key_from_jwk(public_jwk)
    alg = algorithm_for_key(key)
    if header.get("alg") != alg or (pinned_alg and header["alg"] != pinned_alg):
        raise ValueError("algorithm does not match pinned key")
    if not _verify(key, (parts[0] + "." + parts[1]).encode(), unb64(parts[2])):
        raise ValueError("bad signature")
    if claims.get("aud") != url or claims.get("htu") != url or claims.get("htm") != "POST":
        raise ValueError("audience mismatch")
    now = int(time.time()) if now is None else now
    if not claims.get("exp", 0) > now or claims.get("iat", 0) > now + 5 or claims["exp"] - claims["iat"] > MAX_LIFETIME:
        raise ValueError("expired or overlong token")
    seen = set() if seen is None else seen
    if not claims.get("jti") or claims["jti"] in seen:
        raise ValueError("jti replay")
    if body is not None:
        raw = body.encode() if isinstance(body, str) else body
        if claims.get("ath") != b64(hashlib.sha256(raw).digest()):
            raise ValueError("body hash mismatch")
    assert_messaging_capabilities(claims.get("capabilities"))
    seen.add(claims["jti"])
    return {"agentId": claims["sub"], "capabilities": claims["capabilities"], "alg": alg}


def select_auth_profile(descriptor, supported=TOKEN_PROFILES, alg="EdDSA"):
    for p in (descriptor or {}).get("authProfiles") or [{"id": "agent-jwt", "algorithms": ["EdDSA"]}]:
        if p.get("id") not in TOKEN_PROFILES or p["id"] not in supported:
            continue
        if p["id"] == "agent-jwt" and alg not in p.get("algorithms", ["EdDSA"]):
            continue
        if p["id"] == "better-auth-agent-auth" and alg != "EdDSA":
            continue
        return p
    raise ValueError("No mutually supported auth profile")


_NS, _REF = r"[-a-z0-9]{3,8}", r"[-_a-zA-Z0-9]{1,32}"
_CAIP2 = re.compile(rf"^{_NS}:{_REF}$")
_CAIP10 = re.compile(rf"^{_NS}:{_REF}:[-.%a-zA-Z0-9]{{1,128}}$")
_CAIP19 = re.compile(rf"^{_NS}:{_REF}/{_NS}:[-.%a-zA-Z0-9]{{1,128}}(/[-.%a-zA-Z0-9]{{1,78}})?$")


def is_caip2(s):
    return isinstance(s, str) and bool(_CAIP2.match(s))


def is_caip10(s):
    return isinstance(s, str) and bool(_CAIP10.match(s))


def is_caip19(s):
    return isinstance(s, str) and bool(_CAIP19.match(s))


def parse_caip10(s):
    if not is_caip10(s):
        raise ValueError("invalid CAIP-10 account id")
    network, _, address = s.rpartition(":")
    return {"network": network, "address": address}


def parse_caip19(s):
    if not is_caip19(s):
        raise ValueError("invalid CAIP-19 asset id")
    parts = s.split("/")
    ns, ref = parts[1].split(":", 1)
    out = {"network": parts[0], "assetNamespace": ns, "assetReference": ref}
    if len(parts) == 3:
        out["tokenId"] = parts[2]
    return out


def key_family_for_network(network):
    return "ES256K" if network.startswith("eip155:") else "EdDSA"
