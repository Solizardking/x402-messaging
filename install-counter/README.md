# musebot install counter

Opt-in, anonymous install check-ins for the musebot template (`REFgpQ-Emk9iKSarRm6Kj`).

- `POST /v1/install` `{template, installId (UUID), ts}`. Extra fields are rejected. Re-posting an installId does not double count. No IP, user agent, or headers are stored.
- `GET /v1/stats` returns `{total, last24h, byDay}` (UTC days), aggregate only.
- `DELETE /v1/install/:id` with `Authorization: Bearer $ADMIN_TOKEN` removes a row (for test cleanup).

Env: `DATABASE_URL` (Postgres; in-memory if unset), `ADMIN_TOKEN`, `PORT`. Test: `npm test`.
