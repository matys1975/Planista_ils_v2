# ============================================
# Planista ILS — Instrukcja Przenoszenia
# ============================================
#
# WYMAGANIA NA DOCELOWEJ MASZYNIE:
#   - Node.js 20+ (curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - && sudo apt install -y nodejs)
#   - Docker + Docker Compose (dla PostgreSQL i Redis)
#   - PM2 (npm install -g pm2)
#   - Nginx (sudo apt install -y nginx)
#
# ============================================

# ── KROK 1: Skopiuj projekt na docelową maszynę ─────────────────
# Opcja A: Git (zalecane)
git clone <twoje-repo-url> ~/planista
cd ~/planista

# Opcja B: ZIP / SCP (jeśli nie masz repo)
# Na PC: tar -czf planista.tar.gz --exclude=node_modules --exclude=.git "Plan zajęć"
# Na RPi: scp user@pc-ip:~/planista.tar.gz . && tar -xzf planista.tar.gz

# ── KROK 2: Uruchom bazę danych ─────────────────────────────────
docker compose -f docker-compose.prod.yml up -d

# ── KROK 3: Zainstaluj zależności i zbuduj ───────────────────────
npm ci
npx prisma generate --schema=packages/database/prisma/schema.prisma
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
npx tsx packages/database/prisma/seed.ts

# Zbuduj frontend (pliki statyczne)
npm run build --workspace=apps/web

# ── KROK 4: Skonfiguruj zmienne środowiskowe ────────────────────
cat > apps/api/.env << 'EOF'
DATABASE_URL=postgresql://planista:planista2026@localhost:5432/plan_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=ZMIEN-NA-LOSOWY-CIAG-MIN-32-ZNAKOW
NODE_ENV=production
PORT=3001
EOF

# ── KROK 5: Uruchom API przez PM2 ───────────────────────────────
pm2 start "npx ts-node-dev --transpile-only apps/api/src/server.ts" --name planista-api
pm2 save
pm2 startup  # Autostart po restarcie maszyny

# ── KROK 6: Skonfiguruj Nginx ───────────────────────────────────
sudo tee /etc/nginx/sites-available/planista << 'NGINX'
server {
    listen 80;
    server_name _;

    # Frontend (pliki statyczne z Vite build)
    root /home/$USER/planista/apps/web/dist;
    index index.html;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/planista /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

# ── GOTOWE! ──────────────────────────────────────────────────────
echo "✅ Planista ILS dostępny pod: http://$(hostname -I | awk '{print $1}')"
