# Leaflet Store

## Production Deployment Safety

Production deployments must deploy application code only. The production database, `.env`, uploaded files, PDF exports, and backups must stay on the production server unchanged.

Use:

```bash
npm run deploy:production
```

This builds the frontend and prepares `deploy/production-code-only/`. Upload the contents of that folder to production.

Do not upload or replace any of these production runtime files or directories:

- `.env` or any environment credential file
- `server/leafletai.db`, `*.db`, `*.sqlite`, `*.sqlite3`
- `*-wal`, `*-shm`
- `server/uploads/`
- `server/pdf_exports/`
- `server/backups/`
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
