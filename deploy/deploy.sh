#!/bin/bash
# ============================================================
#  LeafletAI – VPS Deployment Script
#  Target: Ubuntu 20.04/22.04/24.04  |  IP: 145.79.14.142
#  Domain: leafletai.ai
# ============================================================
set -e

DOMAIN="leafletai.ai"
APP_DIR="/var/www/leafletai"
REPO_DIR="$APP_DIR/app"
DATA_DIR="$APP_DIR/data"
NODE_VERSION="20"
DEPLOY_BACKUP_DIR="$APP_DIR/deploy-backups/$(date +%Y%m%d-%H%M%S)"

echo "======================================================"
echo " LeafletAI Deployment Script"
echo "======================================================"

# ── 1. System update ───────────────────────────────────────
echo "[1/10] Updating system packages..."
apt-get update -y && apt-get upgrade -y
apt-get install -y curl git unzip nginx certbot python3-certbot-nginx ufw

# ── 2. Install Node.js ─────────────────────────────────────
echo "[2/10] Installing Node.js $NODE_VERSION..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs
node -v && npm -v

# ── 3. Install PM2 ────────────────────────────────────────
echo "[3/10] Installing PM2..."
npm install -g pm2
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

# ── 4. Create app directory ────────────────────────────────
echo "[4/10] Preparing app directory..."
mkdir -p "$APP_DIR"
mkdir -p "$DATA_DIR"
mkdir -p /var/www/certbot

# ── 5. Upload / pull project files ─────────────────────────
# If you are uploading via SCP (rsync), this step is skipped.
# If you use git, uncomment and set your repo URL:
# echo "[5/10] Cloning repository..."
# if [ -d "$REPO_DIR/.git" ]; then
#   cd "$REPO_DIR" && git pull
# else
#   git clone https://github.com/YOUR_USER/leaflet_store.git "$REPO_DIR"
# fi
echo "[5/10] Skipping git clone (upload via SCP/rsync assumed)."
echo "       Files should be at: $REPO_DIR"

# Preserve production runtime data before changing dependencies/build output.
# The rsync commands in DEPLOY_GUIDE.md exclude these files, but this backup is
# an extra safety net before each server restart.
echo "[5b/10] Backing up runtime data..."
mkdir -p "$DEPLOY_BACKUP_DIR"
for item in \
  "$REPO_DIR/server/leafletai.db" \
  "$REPO_DIR/server/leafletai.db-wal" \
  "$REPO_DIR/server/leafletai.db-shm" \
  "$DATA_DIR/leafletai.db" \
  "$DATA_DIR/leafletai.db-wal" \
  "$DATA_DIR/leafletai.db-shm" \
  "$REPO_DIR/server/.env" \
  "$REPO_DIR/server/uploads" \
  "$REPO_DIR/server/pdf_exports" \
  "$REPO_DIR/server/backups" \
  "$DATA_DIR/uploads" \
  "$DATA_DIR/pdf_exports" \
  "$DATA_DIR/backups"
do
  if [ -e "$item" ]; then
    cp -a "$item" "$DEPLOY_BACKUP_DIR/"
  fi
done
echo "Runtime backup saved to $DEPLOY_BACKUP_DIR"

# Keep runtime data outside the code directory so future deploys cannot replace it.
echo "[5c/10] Ensuring persistent data directory..."
for item in leafletai.db leafletai.db-wal leafletai.db-shm; do
  if [ ! -e "$DATA_DIR/$item" ] && [ -e "$REPO_DIR/server/$item" ]; then
    cp -a "$REPO_DIR/server/$item" "$DATA_DIR/$item"
  fi
done
for dir in uploads pdf_exports backups; do
  mkdir -p "$DATA_DIR/$dir"
  if [ -d "$REPO_DIR/server/$dir" ]; then
    cp -an "$REPO_DIR/server/$dir/." "$DATA_DIR/$dir/"
  fi
done

# ── 6. Install dependencies & build frontend ───────────────
echo "[6/10] Installing dependencies and building frontend..."
cd "$REPO_DIR"
npm install

# Build Vite frontend
npm run build
echo "Frontend built → $REPO_DIR/dist"

# Copy dist to web root
mkdir -p "$APP_DIR/dist"
cp -r "$REPO_DIR/dist/." "$APP_DIR/dist/"

# ── 7. Set up environment variables ───────────────────────
echo "[7/10] Setting up .env for server..."
if [ -f "$REPO_DIR/server/.env" ]; then
  echo "Existing $REPO_DIR/server/.env found; preserving production secrets."
  if ! grep -q '^DATA_DIR=' "$REPO_DIR/server/.env"; then
    printf '\nDATA_DIR=%s\n' "$DATA_DIR" >> "$REPO_DIR/server/.env"
    echo "Added DATA_DIR=$DATA_DIR to existing server/.env"
  fi
else
  cat > "$REPO_DIR/server/.env" <<'ENVEOF'
PORT=4000
DATA_DIR=/var/www/leafletai/data
JWT_SECRET=CHANGE_ME_TO_A_STRONG_RANDOM_SECRET
STRIPE_SECRET_KEY=sk_live_YOUR_STRIPE_SECRET
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET
STRIPE_PRICE_STARTER=price_YOUR_STARTER_ID
STRIPE_PRICE_PRO=price_YOUR_PRO_ID
STRIPE_PRICE_BUSINESS=price_YOUR_BUSINESS_ID
NODE_ENV=production
ENVEOF
fi
mkdir -p "$REPO_DIR/server/uploads" "$REPO_DIR/server/pdf_exports" "$REPO_DIR/server/backups"
echo "  ⚠  Edit $REPO_DIR/server/.env with real values before starting!"

# ── 8. Configure Nginx ─────────────────────────────────────
echo "[8/10] Configuring Nginx..."
cp "$REPO_DIR/deploy/nginx.conf" /etc/nginx/sites-available/$DOMAIN
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl reload nginx
echo "Nginx configured."

# ── 9. Start Node server with PM2 ─────────────────────────
echo "[9/10] Starting Node.js server with PM2..."
cd "$REPO_DIR"
pm2 delete leafletai 2>/dev/null || true
pm2 start server/index.cjs --name leafletai --env production
pm2 save
echo "Server running on port 4000."

# ── 10. Firewall ──────────────────────────────────────────
echo "[10/10] Configuring UFW firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
ufw status

echo ""
echo "======================================================"
echo " Deployment complete!"
echo " Next: run SSL setup with certbot (see DEPLOY_GUIDE.md)"
echo "======================================================"
