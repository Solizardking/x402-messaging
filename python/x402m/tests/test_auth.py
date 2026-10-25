import json
import re
from pathlib import Path

import httpx
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from x402m import X402mClient
from x402m.core import auth as A

V = json.loads((Path(__file__).resolve().parents[3] / "spec/v0.1/vectors/x402m-conformance.json").read_text())


def test_caip_vectors():
    assert all(A.is_caip2(s) for s in V["caip2"]["valid"])
    assert not any(A.is_caip2(s) for s in V["caip2"]["invalid"])
    for v in V["caip10"]["valid"]:
        assert A.parse_caip10(v["id"]) == {"network": v["network"], "address": v["address"]}
    for s in V["caip10"]["invalid"]:
        with pytest.raises(ValueError):
            A.parse_caip10(s)
    for v in V["caip19"]["valid"]:
        assert A.parse_caip19(v["id"]) == {k: v[k] for k in v if k != "id"}
    for s in V["caip19"]["invalid"]:
        with pytest.raises(ValueError):
            A.parse_caip19(s)
    assert A.key_family_for_network("eip155:8453") == "ES256K"


def test_capability_and_payment_boundary_vectors():
    A.assert_messaging_capabilities(V["capabilities"]["messaging"])
    for c in V["capabilities"]["rejected"]:
        with pytest.raises(ValueError):
            A.assert_messaging_capabilities([c])
    for v in V["paymentBoundary"]:
        if v["allowed"]:
            assert A.assert_not_payment_authorization(v["request"])
        else:
            with pytest.raises(ValueError, match="payment authorization"):
                A.assert_not_payment_authorization(v["request"])


def test_profile_selection_vectors():
    for v in V["profileSelection"]:
        if v["expect"] is None:
            with pytest.raises(ValueError):
                A.select_auth_profile(v["descriptor"], alg=v["alg"])
        else:
            assert A.select_auth_profile(v["descriptor"], alg=v["alg"])["id"] == v["expect"]


@pytest.mark.parametrize("v", V["agentJwt"], ids=lambda v: v["name"])
def test_agent_jwt_vectors_cross_language(v):
    kwargs = dict(public_jwk=v["publicJwk"], url=v["url"], body=v["body"], pinned_alg=v.get("pinnedAlg", v["alg"]), now=v["now"])
    if v["valid"]:
        assert A.verify_agent_jwt(v["token"], **kwargs)["alg"] == v["alg"]
    else:
        with pytest.raises(ValueError, match=re.compile(v["error"])):
            A.verify_agent_jwt(v["token"], **kwargs)


def _jwk(key):
    if isinstance(key, Ed25519PrivateKey):
        return {"kty": "OKP", "crv": "Ed25519", "x": A.b64(key.public_key().public_bytes_raw())}
    n = key.public_key().public_numbers()
    return {"kty": "EC", "crv": "secp256k1", "x": A.b64(n.x.to_bytes(32, "big")), "y": A.b64(n.y.to_bytes(32, "big"))}


@pytest.mark.parametrize("make,alg", [(Ed25519PrivateKey.generate, "EdDSA"), (lambda: ec.generate_private_key(ec.SECP256K1()), "ES256K")])
async def test_client_signs_both_algorithms_and_refuses_payments(make, alg):
    key = make(); seen = set()
    def respond(request):
        r = A.verify_agent_jwt(request.headers["authorization"].split()[1], _jwk(key), str(request.url), request.content, pinned_alg=alg, seen=seen)
        assert r["alg"] == alg
        return httpx.Response(200, json={"data": {"ok": True}})
    async with X402mClient("agent", key, transport=httpx.MockTransport(respond)) as client:
        assert await client.execute("x402m.inbox") == {"ok": True}
        with pytest.raises(ValueError, match="payment authorization"):
            await client.execute("x402m.send", {"paymentPayload": {}})
    assert len(seen) == 1


def test_secp256k1_private_jwk_from_env(tmp_path):
    key = ec.generate_private_key(ec.SECP256K1())
    jwk = {**_jwk(key), "d": A.b64(key.private_numbers().private_value.to_bytes(32, "big"))}
    path = tmp_path / "agent.private.jwk"; path.write_text(json.dumps(jwk)); path.chmod(0o600)
    client = X402mClient.from_env({"X402M_KEY_FILE": str(path), "X402M_AGENT_ID": "a"})
    assert A.algorithm_for_key(client.key) == "ES256K"
    jwk["y"] = A.b64(bytes(32)); path.write_text(json.dumps(jwk))
    with pytest.raises(ValueError, match="mismatch"):
        X402mClient.from_env({"X402M_KEY_FILE": str(path)})
