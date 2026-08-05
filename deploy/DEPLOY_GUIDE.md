# Deployment Guide — leafletai.ai

## Overview

- **VPS IP**: `145.79.14.142`
- **Domain registrar**: Hostinger
- **Domain**: `leafletai.ai`
- **Stack**: React (Vite) + Node.js (Express) + SQLite + Nginx + PM2

---

## Step 1 — Point DNS to your VPS (Hostinger)

1. Log in to [hpanel.hostinger.com](https://hpanel.hostinger.com)
2. Go to **Domains → leafletai.ai → DNS / Nameservers**
3. Delete any existing **A** records for `@` and `www`
4. Add two **A** records:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A | `@` | `145.79.14.142` | 300 |
| A | `www` | `145.79.14.142` | 300 |

5. Save changes. DNS propagation takes **5–30 minutes** (up to 48 h worldwide).

> Verify with: `nslookup leafletai.ai` — it should return `145.79.14.142`

---

## Step 2 — SSH into your VPS

```bash
ssh root@145.79.14.142
```

---

## Step 3 — Upload the project files

On your **local machine** (PowerShell), run:

```powershell
# Create the remote directory first
ssh root@145.79.14.142 "mkdir -p /var/www/leafletai/app"

# Upload the project (rsync preferred; use scp if rsync not available)
rsync -avz `
  --exclude node_modules `
  --exclude .git `
  --exclude dist `
  --exclude .env `
  --exclude server/.env `
  --exclude "server/*.db" `
  --exclude "server/*-wal" `
  --exclude "server/*-shm" `
  --exclude server/uploads `
  --exclude server/pdf_exports `
  --exclude server/backups `
  "C:\Users\User\Documents\verdent-projects\leaflet_store/" `
  root@145.79.14.142:/var/www/leafletai/app/
```

---

## Step 4 — Run the deployment script

On the **VPS**:

```bash
cd /var/www/leafletai/app
chmod +x deploy/deploy.sh
bash deploy/deploy.sh
```

---

## Step 5 — Configure environment variables

```bash
nano /var/www/leafletai/app/server/.env
```

Fill in real values:

```env
PORT=4000
DATA_DIR=/var/www/leafletai/data
JWT_SECRET=your_strong_random_secret_here
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_BUSINESS=price_...
NODE_ENV=production
```

Restart the server after saving:

```bash
pm2 restart leafletai
```

---

## Step 6 — Issue SSL certificate (HTTPS)

Once DNS is pointing correctly and nginx is running:

```bash
certbot --nginx -d leafletai.ai -d www.leafletai.ai
```

Follow the prompts:
- Enter your email
- Agree to terms
- Choose option **2** (redirect HTTP → HTTPS)

Certbot will auto-edit `/etc/nginx/sites-available/leafletai.ai` and reload nginx.

Test auto-renewal:

```bash
certbot renew --dry-run
```

---

## Step 7 — Verify everything works

```bash
# Check Node server
pm2 status
pm2 logs leafletai --lines 20

# Check nginx
systemctl status nginx

# Test API
curl https://leafletai.ai/api/health
```

Open https://leafletai.ai in a browser — the platform should load.

---

## Re-deploying after code changes

Production runtime data is stored outside the code folder in
`/var/www/leafletai/data`. This includes users, user plans, user-created
leaflets, uploaded images, PDF exports, and backups. Do not delete or overwrite
that folder during deployment.

The upload command below also preserves old deployments that still have runtime
data under `server/`. Do not remove the excludes for `server/*.db`,
`server/uploads`, `server/pdf_exports`, `server/backups`, or env files unless
you intentionally want to replace live data. The deploy script creates a
timestamped safety copy at `/var/www/leafletai/deploy-backups/` before restart.

On your **local machine**, push updated files:

```powershell
rsync -avz `
  --exclude node_modules `
  --exclude .git `
  --exclude dist `
  --exclude .env `
  --exclude server/.env `
  --exclude "server/*.db" `
  --exclude "server/*-wal" `
  --exclude "server/*-shm" `
  --exclude server/uploads `
  --exclude server/pdf_exports `
  --exclude server/backups `
  "C:\Users\User\Documents\verdent-projects\leaflet_store/" `
  root@145.79.14.142:/var/www/leafletai/app/
```

On the **VPS**:

```bash
cd /var/www/leafletai/app

# Rebuild frontend
npm install
npm run build
cp -r dist/. /var/www/leafletai/dist/

# Re-apply the SPA fallback config so direct refreshes load React
cp deploy/nginx.conf /etc/nginx/sites-available/leafletai.ai
nginx -t && systemctl reload nginx

# Restart server
pm2 restart leafletai
```

---

## PM2 Cheat Sheet

| Command | Purpose |
|---------|---------|
| `pm2 status` | Show running processes |
| `pm2 logs leafletai` | Tail live logs |
| `pm2 restart leafletai` | Restart server |
| `pm2 stop leafletai` | Stop server |
| `pm2 save` | Save process list for reboot |

---

## Folder Structure on VPS

```
/var/www/leafletai/
├── app/              ← full project source
│   ├── server/
│   │   ├── index.cjs
│   │   └── .env
│   ├── src/
│   ├── deploy/
│   └── ...
├── data/             ← persistent production runtime data
│   ├── leafletai.db
│   ├── uploads/
│   ├── pdf_exports/
│   └── backups/
└── dist/             ← built React frontend (served by nginx)
```

---

## Stripe Webhook (production)

After going live, register the webhook in the Stripe Dashboard:

- **URL**: `https://leafletai.ai/api/webhook`
- **Events**: `checkout.session.completed`, `customer.subscription.deleted`, `customer.subscription.updated`

Copy the signing secret and set it as `STRIPE_WEBHOOK_SECRET` in `.env`.
