# OpenLiate Autonomous Runtime - Universal Production Container
# Supports Dual-MCP: Stdio (Node.js/npx + Python/uvx) & Remote HTTP/SSE
FROM oven/bun:latest AS builder

WORKDIR /app

# Install dependencies and compile runtime
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build:runtime

# Runtime Stage: Node 24 + Python + uv / uvx + npx
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=7071

# 1. Install Python 3, pip, curl, bash, and git for local tool execution
RUN apk add --no-cache python3 py3-pip curl bash git

# 2. Copy official Astral uv and uvx binaries for instant Python MCP execution
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# 3. Copy compiled runtime bundle, hub definitions, and package.json
COPY --from=builder /app/dist/runtime ./dist/runtime
COPY --from=builder /app/hub ./hub
COPY --from=builder /app/package.json ./package.json

EXPOSE 7071

# Start OpenLiate Runtime (Agent Protocol Interface)
CMD ["node", "dist/runtime/index.js"]
