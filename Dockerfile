# Multi-stage Dockerfile for Hospital Management System
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN apk add --no-cache python3 make g++
RUN npm ci --only=production --legacy-peer-deps && npm cache clean --force

COPY . .
RUN npm run build

FROM node:22-alpine AS production

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --chown=nestjs:nodejs package*.json ./

USER nestjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Default to main application, but allow override for worker
CMD ["node", "dist/main"]