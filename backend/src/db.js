
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.resolve(dataDir, 'app.db');
export const db = new Database(dbPath);

export function ensureSchema() {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'driver',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registration TEXT UNIQUE NOT NULL,
      model TEXT NOT NULL,
      folder_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS trailers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      vehicle_id INTEGER NOT NULL,
      trailer_id INTEGER,
      active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
      FOREIGN KEY(trailer_id) REFERENCES trailers(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS checklist_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      items_json TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS checklist_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      vehicle_id INTEGER NOT NULL,
      trailer_id INTEGER,
      template_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      answers_json TEXT NOT NULL,
      pdf_drive_file_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(vehicle_id) REFERENCES vehicles(id),
      FOREIGN KEY(trailer_id) REFERENCES trailers(id),
      FOREIGN KEY(template_id) REFERENCES checklist_templates(id)
    );
  `);

  const count = db.prepare('SELECT COUNT(*) as c FROM checklist_templates').get().c;
  if (!count) {
    const sampleItems = [
      "Lights working (headlights, indicators, brake lights)",
      "Tyres condition & pressure",
      "Mirrors and windscreen clean & intact",
      "Brakes functional",
      "Horn working",
      "Fluids (oil, coolant, washer) at proper levels",
      "Tachograph functioning",
      "Fire extinguisher present",
      "First aid kit present",
      "Trailer coupling secure"
    ];
    db.prepare('INSERT INTO checklist_templates (name, items_json) VALUES (?, ?)').run('Standard Daily Check', JSON.stringify(sampleItems));
  }
}
