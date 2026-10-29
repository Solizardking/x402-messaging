FROM node:24-bookworm-slim
ENV NODE_ENV=production X402M_RESPONDER_ENABLED=0 X402M_STORAGE_DIR=/data PORT=8080
WORKDIR /app
# Build context: x402m-bot. No wallets, npm tree or unrelated app sources.
# Copy every top-level runtime module so new imports (e.g. auth.mjs) are never missed.
# Tests, secrets and node_modules are excluded by x402m-bot/.dockerignore.
COPY *.mjs ./
COPY docs/ ./docs/
COPY hosted/*.mjs ./hosted/
RUN mkdir -p /data && chmod 700 /data
EXPOSE 8080
CMD ["node", "hosted/server.mjs"]
