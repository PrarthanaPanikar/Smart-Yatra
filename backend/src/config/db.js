/**
 * SmartYatra — SQLite database layer (better-sqlite3)
 * Drop-in replacement for the PostgreSQL pg layer.
 * Exposes: query(sql, params), runInTransaction(fn), db
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs   = require('fs');

// Ensure data dir exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'smartyatra.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/** Convert $1,$2 → ? for SQLite */
function toSqlite(sql) {
  return sql.replace(/\$\d+/g, '?');
}

/**
 * query(sql, params) — async wrapper.
 * Returns { rows: Array, rowCount: number }
 */
const query = async (sql, params = []) => {
  const s = toSqlite(sql);
  const upper = s.trimStart().toUpperCase();
  try {
    if (upper.startsWith('SELECT') || upper.startsWith('WITH')) {
      const rows = db.prepare(s).all(...params);
      return { rows, rowCount: rows.length };
    }
    const info = db.prepare(s).run(...params);
    return { rows: [], rowCount: info.changes, lastID: info.lastInsertRowid };
  } catch (err) {
    console.error('[DB]', err.message, '|', s.slice(0, 120));
    throw err;
  }
};

/**
 * queryOne(sql, params) — returns first row or null
 */
const queryOne = async (sql, params = []) => {
  const s = toSqlite(sql);
  try {
    return db.prepare(s).get(...params) || null;
  } catch (err) {
    console.error('[DB]', err.message);
    throw err;
  }
};

/**
 * runInTransaction(fn) — run fn(txQuery) inside BEGIN/COMMIT.
 * txQuery(sql, params) is sync-wrapped for the transaction.
 * Usage:
 *   await runInTransaction(async (tx) => {
 *     await tx('UPDATE ...', [...])
 *     await tx('INSERT ...', [...])
 *   })
 */
const runInTransaction = async (fn) => {
  const txQuery = async (sql, params = []) => {
    const s = toSqlite(sql);
    const upper = s.trimStart().toUpperCase();
    if (upper.startsWith('SELECT') || upper.startsWith('WITH')) {
      const rows = db.prepare(s).all(...params);
      return { rows, rowCount: rows.length };
    }
    const info = db.prepare(s).run(...params);
    return { rows: [], rowCount: info.changes, lastID: info.lastInsertRowid };
  };

  db.prepare('BEGIN').run();
  try {
    const result = await fn(txQuery);
    db.prepare('COMMIT').run();
    return result;
  } catch (err) {
    db.prepare('ROLLBACK').run();
    throw err;
  }
};

// Legacy shim: getClient() used in booking/parcel controllers
// Returns an object with .query() and .release()
const getClient = async () => {
  let begun = false;
  return {
    async query(sql, params = []) {
      const s = toSqlite(sql);
      const upper = s.trimStart().toUpperCase();
      if (!begun && (upper.startsWith('BEGIN') || upper.startsWith('START'))) {
        db.prepare('BEGIN').run();
        begun = true;
        return { rows: [], rowCount: 0 };
      }
      if (upper.startsWith('COMMIT')) {
        if (begun) db.prepare('COMMIT').run();
        begun = false;
        return { rows: [], rowCount: 0 };
      }
      if (upper.startsWith('ROLLBACK')) {
        if (begun) db.prepare('ROLLBACK').run();
        begun = false;
        return { rows: [], rowCount: 0 };
      }
      if (upper.startsWith('SELECT') || upper.startsWith('WITH')) {
        const rows = db.prepare(s).all(...(params || []));
        return { rows, rowCount: rows.length };
      }
      const info = db.prepare(s).run(...(params || []));
      return { rows: [], rowCount: info.changes, lastID: info.lastInsertRowid };
    },
    release() {},
  };
};

module.exports = { query, queryOne, getClient, runInTransaction, db };
