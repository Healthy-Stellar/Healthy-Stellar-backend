# ─── Stage 1: Builder ────────────────────────────────────────────────────────
FROM node:22-alpine AS base
RUN corepack enable

FROM base AS builder

WORKDIR /app

# Install dependencies (including dev) for compilation
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN apk add --no-cache python3 make g++
RUN pnpm install --frozen-lockfile

# Copy source and compile TypeScript
COPY tsconfig*.json ./
COPY src ./src
RUN pnpm run build

FROM base AS production-deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN apk add --no-cache python3 make g++
RUN pnpm install --prod --frozen-lockfile

# ─── Stage 3: Production ─────────────────────────────────────────────────────
FROM base AS production

# Create non-root user
RUN addgroup -S nestjs && adduser -S nestjs -G nestjs

WORKDIR /app

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist
COPY --from=production-deps /app/node_modules ./node_modules

# Set ownership
RUN chown -R nestjs:nestjs /app

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode >= 200 && r.statusCode < 400 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/main.js"]
