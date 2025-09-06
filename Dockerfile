# syntax=docker/dockerfile:1
# Multi-stage build for Feed (Next.js + Prisma + Bun)
# Uses SQLite by default; optional Postgres variant described in README.

FROM oven/bun:1.1 AS builder
WORKDIR /app
ENV NODE_ENV=production 
ENV NEXT_TELEMETRY_DISABLED=1

# Install dependencies (cached layer)
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# Copy application source
COPY prisma ./prisma
COPY tsconfig.json next.config.ts eslint.config.mjs postcss.config.mjs ./
COPY src ./src
COPY public ./public

# Generate Prisma client & build Next app
RUN bunx prisma generate
RUN bun run build

# Production runtime image
FROM oven/bun:1.1 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy built artifacts & dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Expose port
EXPOSE 3000

# Run migrations (SQLite or Postgres) then start server
# For SQLite: creates prisma/dev.db inside mounted volume if not present
CMD ["sh", "-c", "bunx prisma migrate deploy || echo 'Migrate skipped'; bun run start"]
