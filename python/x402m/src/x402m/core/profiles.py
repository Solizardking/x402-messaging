"""Content profiles (informative); mirrors x402m-bot/profiles.mjs.

Senders MUST NOT send ``contentProfile`` to a service that does not list it in
discovery ``contentProfiles``. Profiles never change the payment boundary.
"""
import re

PROFILE_RE = re.compile(r"^[a-z][a-z0-9.-]{0,62}/v(0|[1-9][0-9]{0,5})$")
PROFILE_MAX = 72
_AMOUNT = re.compile(r"^(0|[1-9][0-9]*)(\.[0-9]+)?$")


def is_profile(p):
    return isinstance(p, str) and len(p) <= PROFILE_MAX and PROFILE_RE.fullmatch(p) is not None


def parse_profile(p):
    if not is_profile(p):
        raise ValueError("contentProfile must be <name>/v<major>")
    name, major = p.rsplit("/v", 1)
    return {"name": name, "major": int(major)}


def advertised_profiles(descriptor):
    lst = (descriptor or {}).get("contentProfiles")
    return [p for p in lst if is_profile(p)] if isinstance(lst, list) else []


def check_content_profile(profile, supported):
    if is_profile(profile) and profile in supported:
        return None
    return {"code": "unsupported_profile", "profile": str(profile), "supported": list(supported)}


class UnsupportedProfileError(ValueError):
    def __init__(self, body):
        super().__init__(f"unsupported_profile: {body['profile']} (supported: {', '.join(body['supported']) or 'none'})")
        self.code, self.profile, self.supported = body["code"], body["profile"], body["supported"]


def check_offer_quote(quote, now, unit=None):
    """Draft x402m.offer/v1 receiver-side quote check. Quotes are non-binding."""
    if (not isinstance(quote, dict) or not isinstance(quote.get("amount"), str) or not _AMOUNT.fullmatch(quote["amount"])
            or not isinstance(quote.get("unit"), str) or type(quote.get("expiresAt")) is not int):
        return {"code": "invalid_quote"}
    if now >= quote["expiresAt"]:
        return {"code": "expired_quote", "expiresAt": quote["expiresAt"]}
    if unit is not None and quote["unit"] != unit:
        return {"code": "unit_mismatch", "expected": unit, "received": quote["unit"]}
    return None
