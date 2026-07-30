# SQLite to Postgres migration

This is phase 1 of moving LeafletAI from SQLite to Postgres.

## 1. Create a Postgres database

Use a managed provider such as Supabase, Neon, Railway, or a Hostinger VPS Postgres instance.

Copy the connection string into `.env`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
```

For local Postgres without SSL, also add:

```env
PGSSLMODE=disable
```

## 2. Migrate the current SQLite data

From the project root:

```bash
npm run db:pg:migrate
```

For Neon, use the HTTP driver if direct Postgres TCP connections are blocked:

```bash
PG_DRIVER=neon-http npm run db:pg:migrate
```

On Windows PowerShell:

```powershell
$env:PG_DRIVER='neon-http'; npm.cmd run db:pg:migrate
```

To drop and recreate the Postgres public schema before importing:

```bash
npm run db:pg:migrate -- --reset
```

The script copies the SQLite tables in dependency order and resets Postgres ID sequences afterward.

## 3. Verify row counts

The migration prints one line per table:

```text
[copy] users: 12
[copy] leaflets: 47
...
SQLite to Postgres migration complete.
```

## 4. Runtime switch

After the data copy is verified, the next phase is changing the Express API from `better-sqlite3` calls to Postgres queries. Do not point production writes to Postgres until that code switch is complete.
