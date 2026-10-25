## What changed

<!-- Behavior changed and why. Link related issues. -->

## Verification

- [ ] `npm test`
- [ ] `npm run verify` (if Python / harness touched)
- [ ] Docs/spec updated if message schemas, auth scopes or delivery semantics changed

## Safety checklist

- [ ] No keys, tokens, `.env` files, wallet/keypair files, journals or private URLs committed
- [ ] Tests use fixtures or temporary identities only (no real messages, paid inference, wallet signatures or broadcasts)
- [ ] Messages still never carry spending authority
