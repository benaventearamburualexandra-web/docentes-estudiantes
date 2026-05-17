import pg from "pg";
import sqlite3Pkg from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const { Pool } = pg;
const sqlite3 = sqlite3Pkg.verbose();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isRender = process.env.RENDER === 'true';
export let pool: any;

if (isRender) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
  });
} else {
  const dbPath = path.join(__dirname, 'asistencia.db');
  const db = new sqlite3.Database(dbPath);
  pool = {
    query: (text: string, params: any[] = []) => {
      return new Promise((resolve, reject) => {
        let sql = text.replace(/\$(\d+)/g, '?');
        if (sql.trim().toUpperCase() === 'BEGIN') sql = 'BEGIN TRANSACTION';
        const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
        if (isSelect) {
          db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve({ rows: rows || [] });
          });
        } else {
          db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ rows: [], lastID: this.lastID });
          });
        }
      });
    }
  };
}

export async function initDb() {
  const idType = isRender ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  const schema = `
    CREATE TABLE IF NOT EXISTS teachers (id TEXT PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL, specialty TEXT NOT NULL, photo_url TEXT, schedule TEXT DEFAULT '{}');
    CREATE TABLE IF NOT EXISTS attendance (id ${idType}, teacher_id TEXT REFERENCES teachers(id) ON DELETE CASCADE, type TEXT, date TEXT, time TEXT, status TEXT DEFAULT 'PUNTUAL', UNIQUE(teacher_id, date, type));
    CREATE TABLE IF NOT EXISTS absences (id ${idType}, teacher_id TEXT REFERENCES teachers(id) ON DELETE CASCADE, date TEXT, status TEXT, reason TEXT);
    CREATE TABLE IF NOT EXISTS admins (username TEXT PRIMARY KEY, password TEXT NOT NULL, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS students (id TEXT PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL, grade_section TEXT, parent_phone TEXT, schedule TEXT DEFAULT '{}');
    CREATE TABLE IF NOT EXISTS student_attendance (id ${idType}, student_id TEXT REFERENCES students(id) ON DELETE CASCADE, type TEXT, date TEXT, time TEXT, status TEXT DEFAULT 'PUNTUAL', UNIQUE(student_id, date, type));
    CREATE TABLE IF NOT EXISTS student_absences (id ${idType}, student_id TEXT REFERENCES students(id) ON DELETE CASCADE, date TEXT, status TEXT, reason TEXT);
  `;

  for (const cmd of schema.split(';').filter(c => c.trim())) {
    await pool.query(cmd);
  }

  if (isRender) {
    const tables = ['teachers', 'attendance', 'absences', 'admins', 'students', 'student_attendance', 'student_absences'];
    for (const table of tables) {
      try { await pool.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`); } catch (e) {}
    }
  }

  const { rows: adminCount } = await pool.query("SELECT COUNT(*) as count FROM admins");
  if (parseInt(adminCount[0].count.toString()) === 0) {
    await pool.query("INSERT INTO admins (username, password, name) VALUES ($1, $2, $3)", ["admin", "admin123", "Administrador Principal"]);
  }
}