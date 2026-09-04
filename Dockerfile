# ============================================================
# Stage 1: Install dependencies & build everything
# ============================================================
FROM node:20-slim AS builder

WORKDIR /app

# Copy package manifests first (cache layer)
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/database/package.json packages/database/

# Install dependencies for Prisma and other tools
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN npm install

# Copy full source
COPY . .

# Generate Prisma client and build database utilities
RUN npm run db:generate --workspace=@plan/database
RUN npm run build --workspace=@plan/database

# Build API (TypeScript → JavaScript)
RUN npm run build --workspace=apps/api

# Build Web (Vite → static files)
RUN npm run build --workspace=apps/web

# ============================================================
# Stage 2: Production image (minimal)
# ============================================================
FROM node:20-slim AS production

WORKDIR /app

# Zainstaluj klienta Postgres 16, aby uniknąć problemów z wersjami (mismatch) przy backupach
RUN apt-get update && apt-get install -y curl ca-certificates gnupg \
    && curl https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor | tee /etc/apt/trusted.gpg.d/apt.postgresql.org.gpg >/dev/null \
    && echo "deb http://apt.postgresql.org/pub/repos/apt/ bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update && apt-get install -y openssl postgresql-client-16 && rm -rf /var/lib/apt/lists/*

# Copy package manifests
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/database/package.json packages/database/

# Install production dependencies only
RUN npm install --omit=dev --ignore-scripts --workspace=apps/api --workspace=@plan/database && npm cache clean --force

# Copy built API
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy Prisma schema + migrations (needed for migrate deploy & client)
COPY --from=builder /app/packages/database ./packages/database

# Copy built frontend (static files served by Fastify)
COPY --from=builder /app/apps/web/dist ./apps/web/dist

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
# Fix Windows CRLF line endings if present (ensures compatibility on all platforms)
RUN tr -d '\r' < /docker-entrypoint.sh > /docker-entrypoint.sh.tmp && mv /docker-entrypoint.sh.tmp /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Backup directory (mounted as volume)
RUN mkdir -p /app/backups

# Audyt #10: Non-root user — ograniczenie uprawnień w kontenerze
RUN useradd -m -s /bin/bash appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 3001

ENTRYPOINT ["/docker-entrypoint.sh"]
