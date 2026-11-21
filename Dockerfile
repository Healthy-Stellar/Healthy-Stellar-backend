# Build with the repo's pinned pnpm and keep development dependencies out of runtime.
FROM node:22-alpine AS base
RUN corepack enable

FROM base AS builder

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN apk add --no-cache python3 make g++
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

FROM base AS production-deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN apk add --no-cache python3 make g++
RUN pnpm install --prod --frozen-lockfile && pnpm store prune

FROM base AS production

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=production-deps --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --chown=nestjs:nodejs package.json ./
COPY --chown=nestjs:nodejs .env.example ./

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode >= 200 && res.statusCode < 400 ? 0 : 1) }).on('error', () => process.exit(1))"

# Default to main application, but allow override for worker
CMD ["node", "dist/main"]