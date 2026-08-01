const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// En un PaaS (Railway, etc.) DATA_DIR debe apuntar al volumen persistente
// que montes (p. ej. "/data"); si no, cada despliegue nuevo borraría los votos.
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'votacion.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// El modo WAL deja parte de los datos recientes en un archivo -wal aparte;
// esto vuelca todo al .db principal para que una copia de ese único archivo
// sea siempre completa y válida.
function checkpoint() {
  db.pragma('wal_checkpoint(TRUNCATE)');
}

db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS editions (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  date TEXT,
  names TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  timer_started_at INTEGER,
  timer_duration_sec INTEGER DEFAULT 600,
  published INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  edition_id TEXT NOT NULL,
  voter_id TEXT NOT NULL,
  candidate_index INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(edition_id, voter_id)
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, value);
}

function getActiveEditionId() {
  return getSetting('active_edition_id');
}

function rowToEdition(row) {
  if (!row) return null;
  return {
    id: row.id,
    year: row.year,
    date: row.date,
    names: JSON.parse(row.names),
    status: row.status,
    timerStartedAt: row.timer_started_at,
    timerDurationSec: row.timer_duration_sec,
    published: !!row.published,
    createdAt: row.created_at
  };
}

function getEdition(id) {
  return rowToEdition(db.prepare('SELECT * FROM editions WHERE id = ?').get(id));
}

function listEditions() {
  return db.prepare('SELECT * FROM editions ORDER BY year DESC').all().map(rowToEdition);
}

// Crea la edición si no existe, o la sustituye (y borra sus votos) si ya existía.
function upsertEdition({ id, year, date, names }) {
  const existing = db.prepare('SELECT id FROM editions WHERE id = ?').get(id);
  if (existing) {
    db.prepare(
      'UPDATE editions SET year = ?, date = ?, names = ?, status = ?, timer_started_at = NULL, published = 0 WHERE id = ?'
    ).run(year, date, JSON.stringify(names), 'draft', id);
    db.prepare('DELETE FROM votes WHERE edition_id = ?').run(id);
  } else {
    db.prepare(
      'INSERT INTO editions (id, year, date, names, status, timer_duration_sec, published, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)'
    ).run(id, year, date, JSON.stringify(names), 'draft', 600, Date.now());
  }
  return getEdition(id);
}

function startVoting(id) {
  db.prepare('UPDATE editions SET status = ?, timer_started_at = ?, timer_duration_sec = ? WHERE id = ?').run(
    'voting',
    Date.now(),
    600,
    id
  );
  return getEdition(id);
}

function closeVoting(id) {
  db.prepare('UPDATE editions SET status = ? WHERE id = ?').run('closed', id);
  return getEdition(id);
}

function setPublished(id, published) {
  db.prepare('UPDATE editions SET published = ? WHERE id = ?').run(published ? 1 : 0, id);
  return getEdition(id);
}

function getVoteCounts(editionId) {
  const rows = db
    .prepare('SELECT candidate_index, COUNT(*) as n FROM votes WHERE edition_id = ? GROUP BY candidate_index')
    .all(editionId);
  const counts = [0, 0, 0, 0, 0];
  let total = 0;
  for (const r of rows) {
    if (r.candidate_index >= 0 && r.candidate_index <= 4) {
      counts[r.candidate_index] = r.n;
      total += r.n;
    }
  }
  return { counts, total };
}

function getVoteStatus(editionId, voterId) {
  const row = db
    .prepare('SELECT candidate_index FROM votes WHERE edition_id = ? AND voter_id = ?')
    .get(editionId, voterId);
  return row ? { voted: true, candidateIndex: row.candidate_index } : { voted: false, candidateIndex: null };
}

function insertVote(editionId, voterId, candidateIndex) {
  db.prepare('INSERT INTO votes (edition_id, voter_id, candidate_index, created_at) VALUES (?, ?, ?, ?)').run(
    editionId,
    voterId,
    candidateIndex,
    Date.now()
  );
}

function createAdmin(username, passwordHash) {
  db.prepare('INSERT INTO admins (username, password_hash, created_at) VALUES (?, ?, ?)').run(
    username,
    passwordHash,
    Date.now()
  );
}

function getAdminByUsername(username) {
  return db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
}

module.exports = {
  DB_PATH,
  checkpoint,
  getSetting,
  setSetting,
  getActiveEditionId,
  getEdition,
  listEditions,
  upsertEdition,
  startVoting,
  closeVoting,
  setPublished,
  getVoteCounts,
  getVoteStatus,
  insertVote,
  createAdmin,
  getAdminByUsername
};
