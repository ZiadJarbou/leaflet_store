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
PERSISTENT_ENV="$DATA_DIR/.env"
LEGACY_ENV="$REPO_DIR/server/.env"
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
  "$LEGACY_ENV" \
  "$PERSISTENT_ENV" \
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

if [ ! -f "$PERSISTENT_ENV" ] && [ -f "$LEGACY_ENV" ]; then
  cp -a "$LEGACY_ENV" "$PERSISTENT_ENV"
  echo "Migrated production .env to $PERSISTENT_ENV"
fi

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
echo "[7/10] Verifying production environment and data..."
if [ -f "$PERSISTENT_ENV" ]; then
  echo "Using persistent production environment: $PERSISTENT_ENV"
  if ! grep -q '^DATA_DIR=' "$PERSISTENT_ENV"; then
    printf '\nDATA_DIR=%s\n' "$DATA_DIR" >> "$PERSISTENT_ENV"
    echo "Added DATA_DIR=$DATA_DIR to persistent .env"
  fi
elif [ -f "$LEGACY_ENV" ]; then
  cp -a "$LEGACY_ENV" "$PERSISTENT_ENV"
  if ! grep -q '^DATA_DIR=' "$PERSISTENT_ENV"; then
    printf '\nDATA_DIR=%s\n' "$DATA_DIR" >> "$PERSISTENT_ENV"
  fi
  echo "Copied legacy server .env to persistent data folder."
else
  echo "ERROR: No production .env found at $PERSISTENT_ENV or $LEGACY_ENV."
  echo "Refusing to create placeholder production credentials during deployment."
  exit 1
fi

if [ ! -f "$DATA_DIR/leafletai.db" ]; then
  echo "ERROR: Production database not found at $DATA_DIR/leafletai.db."
  echo "Refusing to deploy an empty database. Restore the existing DB before restarting."
  exit 1
fi

if grep -q 'CHANGE_ME_TO_A_STRONG_RANDOM_SECRET' "$PERSISTENT_ENV"; then
  echo "ERROR: Placeholder JWT_SECRET detected in $PERSISTENT_ENV."
  echo "Refusing to start production with reset credentials."
  exit 1
fi

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
