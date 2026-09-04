#!/bin/sh
set -e

echo "=== Planista ILS — Starting ==="

# Z powrotem zmieniono na db push, ponieważ schemat ulega zmianom (dodawanie kolumn) bez generowania migracji
echo "Pushing database schema..."
./packages/database/node_modules/.bin/prisma db push --accept-data-loss --schema=packages/database/prisma/schema.prisma

# Ensure default admin exists (creates one only if DB has no users)
echo "Checking for default admin user..."
node packages/database/dist/ensure-admin.js || echo "Admin check completed."

# Seed database (only if SEED_DB=true)
if [ "$SEED_DB" = "true" ]; then
  echo "Seeding database..."
  ./node_modules/.bin/prisma db seed --schema=packages/database/prisma/schema.prisma || echo "Seed skipped or already applied."
fi

# Start the API server (serves both API and static frontend)
echo "Starting API server on port ${PORT:-3001}..."
exec node apps/api/dist/server.js
