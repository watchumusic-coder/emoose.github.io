/**
 * config/database.js
 * ------------------------------------------------------------
 * Mengelola koneksi SQLite (emoose.db) dan membuat seluruh tabel
 * yang dibutuhkan dashboard EMOOSE secara otomatis apabila belum ada.
 * Semua query database di seluruh proyek WAJIB lewat modul ini.
 * ------------------------------------------------------------
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '..', 'database');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const DB_PATH = path.join(DB_DIR, 'emoose.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('[DATABASE] Gagal membuka emoose.db:', err.message);
  } else {
    console.log('[DATABASE] Terhubung ke', DB_PATH);
  }
});

// Aktifkan foreign key & WAL untuk konkurensi baca/tulis yang lebih baik
db.serialize(() => {
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS sensor_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      temperature REAL,
      humidity REAL,
      mq135 INTEGER,
      water REAL,
      pir INTEGER,
      fan TEXT,
      pump TEXT,
      sg90 TEXT,
      mg996r TEXT,
      status TEXT,
      fan_percent INTEGER,
      safe_mode INTEGER,
      predicted_temp REAL,
      predicted_mq135 INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS event_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      event TEXT NOT NULL,
      description TEXT,
      level TEXT DEFAULT 'INFO',
      source TEXT DEFAULT 'ESP32'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS access_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      ip TEXT,
      username TEXT,
      success INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      language TEXT DEFAULT 'id',
      dark_mode INTEGER DEFAULT 1,
      telegram_enable INTEGER DEFAULT 1,
      alarm_enable INTEGER DEFAULT 1
    )
  `);

  db.run(`
    INSERT OR IGNORE INTO settings (id, language, dark_mode, telegram_enable, alarm_enable)
    VALUES (1, 'id', 1, 1, 1)
  `);

  // Antrian perintah manual (Manual Control) dari dashboard -> dijemput ESP32
  db.run(`
    CREATE TABLE IF NOT EXISTS commands (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL,
      acked_at TEXT
    )
  `);

  // Migrasi aman: tambah kolom baru ke sensor_logs jika database lama sudah ada
  // (firmware v2 mengirim field tambahan: fanPercent, safeMode, prediksi)
  const newColumns = [
    'fan_percent INTEGER',
    'safe_mode INTEGER',
    'predicted_temp REAL',
    'predicted_mq135 INTEGER'
  ];
  newColumns.forEach((colDef) => {
    db.run(`ALTER TABLE sensor_logs ADD COLUMN ${colDef}`, () => {
      // Diamkan errornya jika kolom sudah ada ("duplicate column name") - itu normal
    });
  });

  // Index untuk mempercepat query histori & log yang sering diakses dashboard
  db.run('CREATE INDEX IF NOT EXISTS idx_sensor_timestamp ON sensor_logs (timestamp)');
  db.run('CREATE INDEX IF NOT EXISTS idx_event_timestamp ON event_logs (timestamp)');
});

// ------------------------------------------------------------
// Promise wrappers agar bisa dipakai dengan async/await
// ------------------------------------------------------------
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

module.exports = { db, run, get, all, DB_PATH };
