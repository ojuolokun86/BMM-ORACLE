// database/sqliteAuthState.js
const path = require('path');
const Database = require('better-sqlite3');
const { initAuthCreds, makeCacheableSignalKeyStore, BufferJSON } = require('@whiskeysockets/baileys');
const { saveSessionToSupabase, loadSessionFromSupabase, listSessionsFromSupabase } = require('./supabaseAuthState');
const supabase = require('../../supabaseClient');

const dbPath = path.join(__dirname, '../../sessions.sqlite');
const db = new Database(dbPath);

// Ensure table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    phoneNumber TEXT PRIMARY KEY,
    creds TEXT NOT NULL,
    keys TEXT NOT NULL,
    authId TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

/**
 * Save session to SQLite
 */
function saveSessionToSQLite(phoneNumber, creds, keys, authId) {
  const serializedCreds = JSON.stringify(creds, BufferJSON.replacer);
  const serializedKeys = {};
  for (const category in keys) {
    serializedKeys[category] = {};
    for (const id in keys[category]) {
      serializedKeys[category][id] = JSON.stringify(keys[category][id], BufferJSON.replacer);
    }
  }
  const stmt = db.prepare(`
    INSERT INTO sessions (phoneNumber, creds, keys, authId, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(phoneNumber) DO UPDATE SET
      creds = excluded.creds,
      keys = excluded.keys,
      authId = excluded.authId,
      updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(phoneNumber, serializedCreds, JSON.stringify(serializedKeys), authId);
}

/**
 * Load session from SQLite
 */
function loadSessionFromSQLite(phoneNumber) {
  const stmt = db.prepare(`SELECT creds, keys, authId FROM sessions WHERE phoneNumber = ?`);
  const row = stmt.get(phoneNumber);
  if (!row) return null;

  const creds = JSON.parse(row.creds, BufferJSON.reviver);
  const rawKeys = JSON.parse(row.keys);
  const keys = {};
  for (const category in rawKeys) {
    keys[category] = {};
    for (const id in rawKeys[category]) {
      keys[category][id] = JSON.parse(rawKeys[category][id], BufferJSON.reviver);
    }
  }
  return { creds, keys, authId: row.authId };
}

/**
 * Delete session from SQLite
 */
function deleteSessionFromSQLite(phoneNumber) {
  const stmt = db.prepare(`DELETE FROM sessions WHERE phoneNumber = ?`);
  const info = stmt.run(phoneNumber);
  if (info.changes > 0) {
    console.log(`🗑️ Session for ${phoneNumber} deleted from SQLite`);
  } else {
    console.warn(`⚠️ No session found for ${phoneNumber} in SQLite to delete`);
  }
};

/**
 * Delete all sessions from SQLite
 */
function deleteAllSessionsFromSQLite() {
    db.prepare('DELETE FROM sessions').run();
    console.log('🗑️ All sessions deleted from SQLite');
}

/**
 * List all sessions from SQLite
 */
function listSessionsFromSQLite() {
  const stmt = db.prepare(`SELECT phoneNumber, authId FROM sessions`);
  return stmt.all();
}

/**
 * Baileys-compatible auth handler using SQLite
 */
async function useSQLiteAuthState(phoneNumber, authId) {
  let session = loadSessionFromSQLite(phoneNumber);

  if (!session) {
    session = { creds: initAuthCreds(), keys: {}, authId };
  } else {
    session.authId = authId; // update latest
  }

  const wrappedKeys = makeCacheableSignalKeyStore({
    get: async (type, ids) => {
      const result = {};
      if (session.keys[type]) {
        for (const id of ids) {
          if (session.keys[type][id]) result[id] = session.keys[type][id];
        }
      }
      return result;
    },
    set: async (data) => {
      for (const category in data) {
        if (!session.keys[category]) session.keys[category] = {};
        for (const id in data[category]) {
          session.keys[category][id] = data[category][id];
        }
      }
      saveSessionToSQLite(phoneNumber, session.creds, session.keys, session.authId);
    },
  });

  return {
    state: {
      creds: session.creds,
      keys: wrappedKeys,
    },
    saveCreds: async () => {
      saveSessionToSQLite(phoneNumber, session.creds, session.keys, session.authId);
    }
  };
}

/**
 * Sync all sessions from SQLite to Supabase
 */
async function syncSQLiteToSupabase() {
    const sessions = listSessionsFromSQLite();
    for (const { phoneNumber } of sessions) {
        const session = loadSessionFromSQLite(phoneNumber);
        if (session && session.creds && session.keys) {
            await saveSessionToSupabase(phoneNumber, {
                creds: session.creds,
                keys: session.keys,
                authId: session.authId,
            });
        }
    }
    console.log(`✅ Synced ${sessions.length} sessions from SQLite to Supabase`);
}

/**
 * Load all sessions from Supabase into SQLite for this server
 */
async function loadAllSessionsToSQLite() {
    const sessions = await listSessionsFromSupabase();
   for (const { phoneNumber } of sessions) {
    const session = await loadSessionFromSupabase(phoneNumber);
    if (session && session.creds && session.keys && session.authId) {
        saveSessionToSQLite(phoneNumber, session.creds, session.keys, session.authId);
    } else {
        console.warn(`❌ Not saving session for ${phoneNumber}: missing creds, keys, or authId`);
    }
}
    console.log(`✅ Loaded ${sessions.length} sessions from Supabase into SQLite`);
}

/**
 * Cleanup orphaned sessions in SQLite
 */
const SERVER_ID = process.env.SERVER_ID;

async function cleanupOrphanedSessionsInSQLite() {
    const localSessions = listSessionsFromSQLite();
    for (const { phoneNumber } of localSessions) {
        const { data, error } = await supabase
            .from('sessions')
            .select('server_id')
            .eq('phoneNumber', phoneNumber)
            .single();
        if (error || !data || data.server_id !== SERVER_ID) {
            deleteSessionFromSQLite(phoneNumber);
            console.log(`🗑️ Deleted orphaned session ${phoneNumber} from SQLite`);
        }
    }
}
module.exports = {
  useSQLiteAuthState,
  saveSessionToSQLite,
  loadSessionFromSQLite,
  deleteSessionFromSQLite,
  deleteAllSessionsFromSQLite,
  listSessionsFromSQLite,
  syncSQLiteToSupabase,
  loadAllSessionsToSQLite,
  cleanupOrphanedSessionsInSQLite,
};
