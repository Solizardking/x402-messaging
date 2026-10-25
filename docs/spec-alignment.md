# x402m/1 spec alignment (x402 Foundation `agent-messaging`)

This repo tracks the proposed x402 Foundation extension in
[`spec/x402-foundation/agent-messaging.md`](../spec/x402-foundation/agent-messaging.md)
(x402-foundation/x402#3943, PR #3944).

## Agent tokens (`agent-jwt` profile)

| Algorithm | Key | Signature | Clients |
| --- | --- | --- | --- |
| `EdDSA` | Ed25519 JWK (`kty: OKP`) | 64-byte Ed25519 | Node `x402m-bot/auth.mjs`, Python `x402m.core.auth` |
| `ES256K` | secp256k1 JWK (`kty: EC`, `crv: secp256k1`) | 64-byte `r‖s` over SHA-256 (JWS form) | same |

`X402M_KEY_FILE` may hold either key type; the algorithm comes from the key.
Tokens are `typ: agent+jwt`, live ≤ 60 s, carry a fresh `jti`, bind the
body via `ath`, and carry exactly one `x402m.*` capability.
`verifyAgentJwt` / `verify_agent_jwt` are reference verifiers: they enforce
the algorithm pinned at registration, audience, lifetime, `jti` replay and
body hash. Messaging keys are not wallet keys.

## Auth profiles

- `agent-jwt` — native tokens above.
- `better-auth-agent-auth` — Agent Auth Protocol (`@better-auth/agent-auth`),
  discovery at `https://musebook.trade/api/auth/agent-configuration`. Ed25519
  only (plugin default), so ES256K agents fall back to `agent-jwt`.
- `reason-network` — informative identity binding only. Never selected as a
  token profile; a Reason Network message or sign-in proof never authorizes
  `x402m.*` calls.

`selectAuthProfile` / `select_auth_profile` pick the first mutually supported
profile from a discovery descriptor's `authProfiles`.

## Payment invariant

No messaging credential can authorize a payment. Both clients refuse any
non-`x402m.*` capability and any request carrying `X-PAYMENT`,
`PAYMENT-SIGNATURE`, `paymentPayload` or similar fields
(`assertNotPaymentAuthorization` / `assert_not_payment_authorization`).
`payment.request` and `payment.receipt` remain messages: proposals and claims,
never charges.

## CAIP identifiers

`isCaip2`, `parseCaip10`, `parseCaip19` (Python: `is_caip2`, `parse_caip10`,
`parse_caip19`) validate networks, accounts (wallet bindings via
`x402m.link`) and assets. `keyFamilyForNetwork` maps `eip155:*` → ES256K and
everything else (e.g. `solana:*`) → EdDSA.

## Conformance vectors

[`spec/v0.1/vectors/x402m-conformance.json`](../spec/v0.1/vectors/x402m-conformance.json)
covers CAIP parsing, capability scope, profile selection, the payment
boundary and EdDSA/ES256K tokens (valid, tampered body, expired, wrong
audience, wrong pinned algorithm, bad signature). Tokens are signed with
ephemeral keys that are discarded; only public JWKs are stored. Both the
Node (`x402m-bot/auth.test.mjs`) and Python (`tests/test_auth.py`) suites
run the same file, so they check each other. Regenerate with
`node scripts/gen-x402m-vectors.mjs`.
