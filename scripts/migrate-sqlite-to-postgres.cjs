#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const Database = require('better-sqlite3');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../server/.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const root = path.resolve(__dirname, '..');
const sqlitePath = process.env.SQLITE_DB_PATH || path.join(root, 'server', 'leafletai.db');
const databaseUrl = process.env.DATABASE_URL || '';
const reset = process.argv.includes('--reset');
const driver = process.env.PG_DRIVER || 'pg';

if (!databaseUrl) {
  console.error('DATABASE_URL is required. Add it to .env or pass it in the environment.');
  process.exit(1);
}

const schemaSql = fs.readFileSync(path.join(root, 'database', 'postgres-schema.sql'), 'utf8');
const tables = [
  'users',
  'leaflets',
  'leaflet_products',
  'product_clicks',
  'stripe_plan_prices',
  'leaflet_pdf_exports',
  'card_layout_templates',
  'help_article_groups',
  'help_articles',
  'icon_library',
  'icon_preset_overrides',
  'seo_pages',
  'site_settings',
  'page_content',
  'db_migrations',
];

function pgIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function sqliteColumns(sqlite, table) {
  return sqlite.pragma(`table_info(${table})`).map(col => col.name);
}

function normalizeRow(table, row) {
  const next = { ...row };
  if (table === 'help_articles' && next.image_url == null) next.image_url = '';
  return next;
}

async function copyTable(sqlite, pg, table) {
  let rows = sqlite.prepare(`SELECT * FROM ${table}`).all().map(row => normalizeRow(table, row));
  if (table === 'product_clicks') {
    rows = rows.filter(row => row.user_id > 0 && row.leaflet_id > 0 && row.product_id > 0);
  }
  if (!rows.length) return { table, count: 0 };

  const cols = Object.keys(rows[0]);
  const quotedCols = cols.map(pgIdent).join(', ');
  let copied = 0;
  const batchSize = Number(process.env.PG_MIGRATE_BATCH_SIZE || 50);

  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const values = [];
    const rowPlaceholders = batch.map((row) => {
      const placeholders = cols.map((col) => {
        values.push(row[col]);
        return `$${values.length}`;
      }).join(', ');
      return `(${placeholders})`;
    }).join(', ');
    await pg.query(
      `INSERT INTO ${pgIdent(table)} (${quotedCols}) VALUES ${rowPlaceholders} ON CONFLICT DO NOTHING`,
      values,
    );
    copied += batch.length;
  }

  return { table, count: copied };
}

async function resetSequences(pg) {
  const sequenceTables = tables.filter(table => table !== 'site_settings' && table !== 'icon_preset_overrides' && table !== 'db_migrations');
  for (const table of sequenceTables) {
    await pg.query(`
      SELECT setval(
        pg_get_serial_sequence($1, 'id'),
        COALESCE((SELECT MAX(id) FROM ${pgIdent(table)}), 0) + 1,
        false
      )
    `, [table]);
  }
}

async function createPgClient() {
  if (driver === 'neon-http') {
    const { neon } = await import('@neondatabase/serverless');
    const sql = neon(databaseUrl);
    return {
      supportsTransactions: false,
      async connect() {},
      async query(text, params = []) {
        const rows = await sql.query(text, params);
        return { rows };
      },
      async end() {},
    };
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
  });
  client.supportsTransactions = true;
  return client;
}

async function applySchema(pg) {
  if (driver === 'neon-http') {
    const statements = schemaSql
      .replace(/^\s*BEGIN;\s*/i, '')
      .replace(/\s*COMMIT;\s*$/i, '')
      .split(';')
      .map(statement => statement.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await pg.query(statement);
    }
    return;
  }

  await pg.query(schemaSql);
}

(async () => {
  const sqlite = new Database(sqlitePath, { readonly: true });
  const pg = await createPgClient();

  try {
    await pg.connect();
    if (reset) {
      await pg.query('DROP SCHEMA IF EXISTS public CASCADE');
      await pg.query('CREATE SCHEMA public');
    }
    await applySchema(pg);
    if (pg.supportsTransactions) await pg.query('BEGIN');

    for (const table of tables) {
      try {
        sqliteColumns(sqlite, table);
      } catch {
        console.warn(`[skip] SQLite table not found: ${table}`);
        continue;
      }
      const result = await copyTable(sqlite, pg, table);
      console.log(`[copy] ${result.table}: ${result.count}`);
    }

    await resetSequences(pg);
    if (pg.supportsTransactions) await pg.query('COMMIT');
    console.log('SQLite to Postgres migration complete.');
  } catch (err) {
    if (pg.supportsTransactions) await pg.query('ROLLBACK').catch(() => null);
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    sqlite.close();
    await pg.end().catch(() => null);
  }
})();
