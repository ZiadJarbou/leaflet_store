# Leaflet Store

## Production Deployment Safety

Production deployments must deploy application code only. The production database, `.env`, uploaded files, PDF exports, and backups must stay on the production server unchanged.

The root cause of production users disappearing was that the app previously defaulted to `server/leafletai.db`, which is inside the deployable code folder. Replacing that folder during deployment can remove the live SQLite database and make the app create a new empty one. Production now uses a persistent data folder by default and refuses to start if the production database is missing.

Use:

```bash
npm run deploy:production
```

This builds the frontend and prepares `deploy/production-code-only/`. Upload the contents of that folder to production.

Do not upload or replace any of these production runtime files or directories:

- `.env` or any environment credential file
- `server/leafletai.db`, `*.db`, `*.sqlite`, `*.sqlite3`
- `/var/www/leafletai/data/leafletai.db`
- `*-wal`, `*-shm`
- `server/uploads/`
- `server/pdf_exports/`
- `server/backups/`
- `/var/www/leafletai/data/uploads/`
- `/var/www/leafletai/data/pdf_exports/`
- `/var/www/leafletai/data/backups/`
- seed scripts such as `server/seed-help-center.cjs` or `server/seed-default-layout.cjs`

Never run destructive database commands in production, including:

- `migrate:fresh`
- `migrate:refresh`
- `db:wipe`
- `DROP TABLE`
- `TRUNCATE`
- any database reset script

Do not run seeders in production unless explicitly requested and approved. Production seed scripts are blocked by default unless `ALLOW_PRODUCTION_SEEDING=I_UNDERSTAND_THIS_SEEDS_PRODUCTION` is deliberately set for that one command.

If schema changes are needed, use safe incremental migrations only, such as `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ADD COLUMN`, or `CREATE INDEX IF NOT EXISTS`. These migrations must preserve all existing rows for users, leaflets, subscriptions, products, uploads, and exports.

The production app blocks database backup import/restore while `NODE_ENV=production`, because that operation replaces the active database file.

Production also blocks silent empty database creation. For an existing production install, `DATA_DIR` should point to the persistent folder, for example:

```env
DATA_DIR=/var/www/leafletai/data
```

If production returns 503 after this safety check, check that `/var/www/leafletai/data/leafletai.db` exists. The deploy script and app startup will recover it from the newest `/var/www/leafletai/deploy-backups/*/leafletai.db` when available. If no backup exists on the server, restore the last real production database backup to that path before restarting PM2.

On Hostinger hBuilds, production releases live under `hbuilds/versions/<version-id>`. That folder is replaced on deploy, so runtime data must be stored at the domain root, for example `/home/<account>/domains/leafletai.ai/data/leafletai.db`, not inside `hbuilds/versions/<version-id>/data`.
