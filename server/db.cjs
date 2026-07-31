const fs = require('fs');
const path = require('path');
const SqliteDatabase = require('better-sqlite3');
const { Pool } = require('pg');

function compactParams(args) {
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  return args;
}

function replaceQuestionParams(sql) {
  let index = 0;
  let inSingle = false;
  let inDouble = false;
  let out = '';

  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (ch === "'" && !inDouble) {
      out += ch;
      if (inSingle && next === "'") {
        out += next;
        i += 1;
      } else {
        inSingle = !inSingle;
      }
      continue;
    }
    if (ch === '"' && !inSingle) inDouble = !inDouble;
    if (ch === '?' && !inSingle && !inDouble) {
      index += 1;
      out += `$${index}`;
    } else {
      out += ch;
    }
  }

  return out;
}

function normalizePostgresSql(sql) {
  let next = String(sql).trim();
  next = next.replace(/datetime\('now'\s*,\s*'-([0-9]+) days'\)/gi, "now() - interval '$1 days'");
  next = next.replace(/datetime\('now'\s*,\s*'-([0-9]+) day'\)/gi, "now() - interval '$1 day'");
  next = next.replace(/datetime\(([^,]+)\s*,\s*'-([0-9]+) year'\)/gi, "($1::timestamptz - interval '$2 year')");
  next = next.replace(/datetime\(([^,]+)\s*,\s*'-([0-9]+) month'\)/gi, "($1::timestamptz - interval '$2 month')");
  next = next.replace(/datetime\('now'\)/gi, 'now()');
  next = next.replace(/DEFAULT\s*\(\s*now\(\)\s*\)/gi, 'DEFAULT now()');
  next = next.replace(/INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi, 'BIGSERIAL PRIMARY KEY');
  next = next.replace(/help_articles\s*\(([^)]*)\bdesc\b/gi, (match) => match.replace(/\bdesc\b/i, '"desc"'));
  next = next.replace(/\bdesc\s*=\s*/gi, '"desc" = ');
  next = next.replace(/INSERT\s+OR\s+IGNORE\s+INTO\s+/gi, 'INSERT INTO ');
  next = next.replace(/INSERT\s+OR\s+REPLACE\s+INTO\s+/gi, 'INSERT INTO ');
  next = replaceQuestionParams(next);

  if (/^INSERT\s+INTO\s+site_settings\s*\(/i.test(next) && !/ON\s+CONFLICT/i.test(next)) {
    next += ' ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value';
  } else if (/^INSERT\s+INTO\s+page_content\s*\(/i.test(next) && !/ON\s+CONFLICT/i.test(next)) {
    next += ' ON CONFLICT (page, section, field) DO UPDATE SET value = EXCLUDED.value';
  } else if (/^INSERT\s+INTO\s+seo_pages\s*\(/i.test(next) && !/ON\s+CONFLICT/i.test(next)) {
    next += ' ON CONFLICT (page_key) DO NOTHING';
  } else if (/^INSERT\s+INTO\s+db_migrations\s*\(/i.test(next) && !/ON\s+CONFLICT/i.test(next)) {
    next += ' ON CONFLICT (name) DO NOTHING';
  } else if (/^INSERT\s+INTO\s+/i.test(next) && /OR\s+IGNORE/i.test(sql) && !/ON\s+CONFLICT/i.test(next)) {
    next += ' ON CONFLICT DO NOTHING';
  }

  const insertsIntoTableWithoutId = /^INSERT\s+INTO\s+(site_settings|db_migrations|icon_preset_overrides)\b/i.test(next);
  if (/^INSERT\s+INTO\s+/i.test(next) && !insertsIntoTableWithoutId && !/\bRETURNING\b/i.test(next)) {
    next += ' RETURNING id';
  }

  return next;
}

function createSqliteDb(sqlitePath) {
  const db = new SqliteDatabase(sqlitePath);
  db.pragma('journal_mode = WAL');
  const api = {
    kind: 'sqlite',
    isPostgres: false,
    async connect() {},
    async close() { db.close(); },
    async exec(sql) { db.exec(sql); },
    async all(sql, ...args) { return db.prepare(sql).all(...compactParams(args)); },
    async get(sql, ...args) { return db.prepare(sql).get(...compactParams(args)); },
    async run(sql, ...args) {
      const result = db.prepare(sql).run(...compactParams(args));
      return { ...result, rowCount: result.changes, rows: [] };
    },
    async backup(filePath) { await db.backup(filePath); },
    async columns(table) {
      return db.pragma(`table_info(${table})`).map(col => col.name);
    },
    async transaction(fn) {
      const tx = db.transaction((...args) => fn(api, ...args));
      return (...args) => tx(...args);
    },
  };
  return api;
}

function createPostgresDb(databaseUrl) {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: /sslmode=(require|verify-ca|verify-full)/i.test(databaseUrl) ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.PG_POOL_MAX || 10),
  });

  async function query(sql, params = []) {
    return pool.query(normalizePostgresSql(sql), params);
  }

  return {
    kind: 'postgres',
    isPostgres: true,
    async connect() {
      const client = await pool.connect();
      client.release();
    },
    async close() { await pool.end(); },
    async exec(sql) {
      const schemaPath = path.resolve(__dirname, '../database/postgres-schema.sql');
      if (/CREATE\s+TABLE|ALTER\s+TABLE|CREATE\s+INDEX/i.test(sql) && fs.existsSync(schemaPath)) {
        return;
      }
      const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
      for (const statement of statements) await query(statement);
    },
    async all(sql, ...args) {
      const result = await query(sql, compactParams(args));
      return result.rows;
    },
    async get(sql, ...args) {
      const result = await query(sql, compactParams(args));
      return result.rows[0];
    },
    async run(sql, ...args) {
      const result = await query(sql, compactParams(args));
      return {
        rowCount: result.rowCount,
        changes: result.rowCount,
        lastInsertRowid: result.rows?.[0]?.id,
        rows: result.rows || [],
      };
    },
    async columns(table) {
      const result = await query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
        [table],
      );
      return result.rows.map(row => row.column_name);
    },
    async transaction(fn) {
      return async (...args) => {
        const client = await pool.connect();
        const txQuery = async (sql, params = []) => client.query(normalizePostgresSql(sql), params);
        const txDb = {
          isPostgres: true,
          all: async (sql, ...params) => (await txQuery(sql, compactParams(params))).rows,
          get: async (sql, ...params) => (await txQuery(sql, compactParams(params))).rows[0],
          run: async (sql, ...params) => {
            const result = await txQuery(sql, compactParams(params));
            return {
              rowCount: result.rowCount,
              changes: result.rowCount,
              lastInsertRowid: result.rows?.[0]?.id,
              rows: result.rows || [],
            };
          },
        };
        try {
          await client.query('BEGIN');
          const value = await fn(txDb, ...args);
          await client.query('COMMIT');
          return value;
        } catch (err) {
          await client.query('ROLLBACK').catch(() => null);
          throw err;
        } finally {
          client.release();
        }
      };
    },
  };
}

function createNeonHttpDb(databaseUrl) {
  let sql = null;

  async function query(text, params = []) {
    if (!sql) throw new Error('Neon HTTP database is not connected.');
    const rows = await sql.query(normalizePostgresSql(text), params);
    return { rows, rowCount: Array.isArray(rows) ? rows.length : 0 };
  }

  const api = {
    kind: 'neon-http',
    isPostgres: true,
    async connect() {
      const mod = await import('@neondatabase/serverless');
      sql = mod.neon(databaseUrl);
      await sql.query('SELECT 1');
    },
    async close() {},
    async exec(text) {
      const schemaPath = path.resolve(__dirname, '../database/postgres-schema.sql');
      if (/CREATE\s+TABLE|ALTER\s+TABLE|CREATE\s+INDEX/i.test(text) && fs.existsSync(schemaPath)) {
        return;
      }
      const statements = text.split(';').map(s => s.trim()).filter(Boolean);
      for (const statement of statements) await query(statement);
    },
    async all(text, ...args) {
      const result = await query(text, compactParams(args));
      return result.rows;
    },
    async get(text, ...args) {
      const result = await query(text, compactParams(args));
      return result.rows[0];
    },
    async run(text, ...args) {
      const result = await query(text, compactParams(args));
      return {
        rowCount: result.rowCount,
        changes: result.rowCount,
        lastInsertRowid: result.rows?.[0]?.id,
        rows: result.rows || [],
      };
    },
    async columns(table) {
      const result = await query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
        [table],
      );
      return result.rows.map(row => row.column_name);
    },
    async transaction(fn) {
      return async (...args) => fn(api, ...args);
    },
  };

  return api;
}

function createDb({ sqlitePath, databaseUrl, driver }) {
  if (!databaseUrl) return createSqliteDb(sqlitePath);
  if (driver === 'neon-http') return createNeonHttpDb(databaseUrl);
  return createPostgresDb(databaseUrl);
}

module.exports = { createDb };
