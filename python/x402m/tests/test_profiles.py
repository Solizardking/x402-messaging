import json
from pathlib import Path

import httpx
import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from x402m import X402mClient
from x402m.core import profiles as P

V = json.loads((Path(__file__).resolve().parents[3] / "spec/v0.1/vectors/x402m-conformance.json").read_text())["contentProfiles"]


def test_format_vectors():
    assert all(P.is_profile(p) for p in V["format"]["valid"])
    assert not any(P.is_profile(p) for p in V["format"]["invalid"])
    assert P.parse_profile("x402m.offer/v1") == {"name": "x402m.offer", "major": 1}


@pytest.mark.parametrize("v", V["negotiation"], ids=lambda v: v["name"])
def test_negotiation_vectors(v):
    assert P.check_content_profile(v["profile"], v["supported"]) == v["expect"]


@pytest.mark.parametrize("v", V["offerQuote"], ids=lambda v: v["name"])
def test_offer_quote_vectors(v):
    assert P.check_offer_quote(v["quote"], now=v["now"], unit=v["unit"]) == v["expect"]


def _client(descriptor, posts):
    def handler(request):
        if request.method == "POST":
            posts.append(json.loads(request.content))
            return httpx.Response(200, json={"data": {"ok": True}})
        return httpx.Response(200, json=descriptor)
    return X402mClient("a", Ed25519PrivateKey.generate(), transport=httpx.MockTransport(handler))


SEND = {"to": "@peer", "requestId": "r1", "kind": "request", "content": "hi", "contentProfile": "x402m.offer/v1"}


async def test_client_withholds_unadvertised_profile():
    posts = []
    async with _client({"protocol": "x402m/1", "contentProfiles": []}, posts) as c:
        with pytest.raises(P.UnsupportedProfileError) as e:
            await c.execute("x402m.send", SEND)
    assert e.value.code == "unsupported_profile" and e.value.supported == [] and posts == []


async def test_client_sends_advertised_profile():
    posts = []
    async with _client({"contentProfiles": ["x402m.offer/v1"]}, posts) as c:
        await c.execute("x402m.send", SEND)
    assert posts[0]["arguments"]["contentProfile"] == "x402m.offer/v1"
