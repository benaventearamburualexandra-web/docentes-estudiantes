import express from "express";
import compression from "compression";
import sqlite3Pkg from "sqlite3";
import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "node:fs";
import * as XLSX from 'xlsx';
import nodemailer from 'nodemailer';

const { Pool } = pg;
const sqlite3 = sqlite3Pkg.verbose();

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// DETECCIÓN DE ENTORNO: Si existe la variable RENDER, estamos en la nube.
const isRender = process.env.RENDER === 'true';
let pool: any;

if (isRender) {
  console.log("☁️ Entorno Render detectado. Usando Supabase (PostgreSQL)...");
  if (!process.env.DATABASE_URL) {
    console.error("❌ ERROR: DATABASE_URL no está definida en las variables de entorno de Render.");
  }
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 20000,
  });
} else {
  console.log("💻 Entorno local detectado. Usando SQLite (Offline)...");
  const dbPath = path.join(__dirname, 'asistencia.db');
  const db = new sqlite3.Database(dbPath);
  db.run("PRAGMA foreign_keys = ON;");

  // Emulador de Pool para SQLite
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
    },
    connect: async () => ({
      query: pool.query,
      release: () => {}
    })
  };
}

// Initialize Database
async function initDb() {
    try {
      console.log(`🔍 Inicializando esquema de base de datos (${isRender ? 'Supabase' : 'SQLite'})...`);
      
      // En Postgres usamos SERIAL, en SQLite usamos AUTOINCREMENT
      const idType = isRender ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';

      const schema = `
        CREATE TABLE IF NOT EXISTS teachers (
          id TEXT PRIMARY KEY,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          specialty TEXT NOT NULL,
          photo_url TEXT,
          schedule TEXT DEFAULT '{}'
        );
        
        CREATE TABLE IF NOT EXISTS attendance (
          id ${idType},
          teacher_id TEXT REFERENCES teachers(id) ON DELETE CASCADE,
          type TEXT,
          date TEXT,
          time TEXT,
          status TEXT DEFAULT 'PUNTUAL',
          UNIQUE(teacher_id, date, type)
        );
  
        CREATE TABLE IF NOT EXISTS absences (
          id ${idType},
          teacher_id TEXT REFERENCES teachers(id) ON DELETE CASCADE,
          date TEXT,
          status TEXT,
          reason TEXT
        );
  
        CREATE TABLE IF NOT EXISTS admins (
          username TEXT PRIMARY KEY,
          password TEXT NOT NULL,
          name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS students (
          id TEXT PRIMARY KEY,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          grade_section TEXT,
          parent_phone TEXT,
          schedule TEXT DEFAULT '{}'
        );

        CREATE TABLE IF NOT EXISTS student_attendance (
          id ${idType},
          student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
          type TEXT,
          date TEXT,
          time TEXT,
          status TEXT DEFAULT 'PUNTUAL',
          UNIQUE(student_id, date, type)
        );

        CREATE TABLE IF NOT EXISTS student_absences (
          id ${idType},
          student_id TEXT REFERENCES students(id) ON DELETE CASCADE,
          date TEXT,
          status TEXT,
          reason TEXT
        );
      `;

      for (const cmd of schema.split(';').filter(c => c.trim())) {
        await pool.query(cmd);
      }

      // Habilitar Row Level Security (RLS) en Supabase para mayor seguridad
      // Esto resuelve la advertencia de "RLS Disabled in Public"
      if (isRender) {
        const tables = ['teachers', 'attendance', 'absences', 'admins', 'students', 'student_attendance', 'student_absences'];
        for (const table of tables) {
          try {
            await pool.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
          } catch (e) {
            // Si falla o ya está activado, continuamos sin detener el servidor
          }
        }
      }

      // Seed default data if needed
      const { rows } = await pool.query("SELECT COUNT(*) as count FROM teachers");
      // En Postgres count es string, en SQLite es number
      const count = parseInt(rows[0].count.toString());
      if (count === 0) {
        await pool.query(`
          INSERT INTO teachers (id, first_name, last_name, specialty) 
          VALUES ('DOC-001', 'Juan', 'Pérez', 'Matemática'), ('DOC-002', 'María', 'García', 'Comunicación')
        `);
      }

      // Crear administrador por defecto si no existe ninguno
      const { rows: adminCount } = await pool.query("SELECT COUNT(*) as count FROM admins");
      const aCount = parseInt(adminCount[0].count.toString());
      if (aCount === 0) {
        await pool.query(
          "INSERT INTO admins (username, password, name) VALUES ($1, $2, $3)",
          ["admin", "admin123", "Administrador Principal"]
        );
        console.log("✅ Usuario administrador creado por defecto (admin / admin123)");
      }

    } catch (err) {
      console.error(`❌ Error al inicializar la base de datos:`, err);
    }
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 10000;

  // Configuración de Middleware y Seguridad
  app.use(compression());
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co;");
    next();
  });
  app.use(express.json({ limit: '10mb' }));

  // --- API ROUTES ---

  app.get("/api/health", async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: "ok", db: "connected", uptime: Math.floor(process.uptime()) + "s" });
    } catch (err) { res.json({ status: "ok", db: "reconnecting" }); }
  });

  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    try {
      const { rows } = await pool.query("SELECT username, name FROM admins WHERE username = $1 AND password = $2", [username, password]);
      if (rows.length > 0) res.json({ success: true, user: rows[0] });
      else res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    } catch (err) { 
      console.error("Login error:", err);
      res.status(500).json({ error: "Error en el servidor" }); 
    }
  });

  app.get("/api/teachers", async (req, res) => {
    try {
      const { rows } = await pool.query("SELECT * FROM teachers");
      res.json(rows.map(r => ({ ...r, schedule: typeof r.schedule === 'string' ? JSON.parse(r.schedule) : r.schedule })));
    } catch (err) { res.status(500).json({ error: "Error" }); }
  });

  app.post("/api/teachers", async (req, res) => {
    const { id, first_name, last_name, specialty, schedule } = req.body;
    try {
      await pool.query("INSERT INTO teachers (id, first_name, last_name, specialty, schedule) VALUES ($1, $2, $3, $4, $5)", [id, first_name, last_name, specialty, JSON.stringify(schedule)]);
      res.json({ success: true });
    } catch (e: any) { res.status(400).json({ error: "El ID ya existe o hay un error en los datos." }); }
  });

  app.put("/api/teachers/:id", async (req, res) => {
    const { id } = req.params;
    const { first_name, last_name, specialty, schedule } = req.body;
    try {
      await pool.query("UPDATE teachers SET first_name = $1, last_name = $2, specialty = $3, schedule = $4 WHERE id = $5", [first_name, last_name, specialty, JSON.stringify(schedule), id]);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Error" }); }
  });

  app.delete("/api/teachers/:id", async (req, res) => {
    try {
      await pool.query("DELETE FROM teachers WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Error" }); }
  });

  // --- ESTUDIANTES ---
  app.get("/api/students", async (req, res) => {
    try {
      const { rows } = await pool.query("SELECT * FROM students ORDER BY last_name ASC");
      res.json(rows.map(r => ({ ...r, schedule: typeof r.schedule === 'string' ? JSON.parse(r.schedule) : r.schedule })));
    } catch (err) { res.status(500).json({ error: "Error" }); }
  });

  app.post("/api/students", async (req, res) => {
    const { id, first_name, last_name, grade_section, parent_phone, schedule } = req.body;
    
    if (!id || !first_name || !last_name) {
      return res.status(400).json({ error: "El ID, Nombres y Apellidos son obligatorios." });
    }

    try {
      const scheduleStr = schedule ? JSON.stringify(schedule) : '{}';
      await pool.query(
        "INSERT INTO students (id, first_name, last_name, grade_section, parent_phone, schedule) VALUES ($1, $2, $3, $4, $5, $6)", 
        [id, first_name, last_name, grade_section || '', parent_phone || '', scheduleStr]
      );
      res.json({ success: true });
    } catch (e: any) { 
      const errorMsg = e.message || '';
      console.error("❌ Error en DB al registrar estudiante:", errorMsg);
      
      const isDuplicate = errorMsg.toLowerCase().includes('unique') || errorMsg.toLowerCase().includes('duplicate');
      
      res.status(400).json({ 
        error: isDuplicate ? "Este ID/DNI ya pertenece a otro estudiante." : "Error al guardar: Verifique que todos los campos sean correctos." 
      }); 
    }
  });

  app.delete("/api/students/:id", async (req, res) => {
    try {
      await pool.query("DELETE FROM students WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Error" }); }
  });

  // --- ASISTENCIA ---
  app.post("/api/attendance", async (req, res) => {
    const { teacherId, type, manualDate, manualTime, status } = req.body;
    try {
      await pool.query("INSERT INTO attendance (teacher_id, type, date, time, status) VALUES ($1, $2, $3, $4, $5)", [teacherId, type, manualDate, manualTime, status]);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Error al registrar" }); }
  });

  app.post("/api/student-attendance", async (req, res) => {
    const { studentId, type, manualDate, manualTime, status } = req.body;
    try {
      const student = await pool.query("SELECT first_name, last_name FROM students WHERE id = $1", [studentId]);
      if (student.rows.length === 0) return res.status(404).json({ error: "No encontrado" });
      
      const date = manualDate || new Date().toISOString().split('T')[0];
      const time = manualTime || new Date().toLocaleTimeString('en-GB');

      await pool.query("INSERT INTO student_attendance (student_id, type, date, time, status) VALUES ($1, $2, $3, $4, $5)", [studentId, type, date, time, status || 'PUNTUAL']);
      res.json({ success: true, studentName: `${student.rows[0].first_name} ${student.rows[0].last_name}` });
    } catch (e) { res.status(500).json({ error: "Error" }); }
  });

  // --- REPORTES Y FALTAS ---
  app.get("/api/report", async (req, res) => {
    try {
      const { rows } = await pool.query("SELECT a.*, (t.first_name || ' ' || t.last_name) as teacher_name FROM attendance a JOIN teachers t ON a.teacher_id = t.id ORDER BY a.date DESC, a.time DESC");
      res.json(rows);
    } catch (err) { res.status(500).json({ error: "Error" }); }
  });

  app.get("/api/student-report", async (req, res) => {
    try {
      const { rows } = await pool.query("SELECT sa.*, (s.first_name || ' ' || s.last_name) as student_name FROM student_attendance sa JOIN students s ON sa.student_id = s.id ORDER BY sa.date DESC");
      res.json(rows);
    } catch (err) { res.status(500).json({ error: "Error" }); }
  });

  app.get("/api/absences", async (req, res) => {
    try {
      const { rows } = await pool.query("SELECT a.*, (t.first_name || ' ' || t.last_name) as teacher_name FROM absences a JOIN teachers t ON a.teacher_id = t.id ORDER BY a.date DESC");
      res.json(rows);
    } catch (err) { res.status(500).json({ error: "Error" }); }
  });

  app.get("/api/student-absences", async (req, res) => {
    try {
      const { rows } = await pool.query("SELECT a.*, (s.first_name || ' ' || s.last_name) as student_name FROM student_absences a JOIN students s ON a.student_id = s.id ORDER BY a.date DESC");
      res.json(rows);
    } catch (err) { res.status(500).json({ error: "Error" }); }
  });

  app.post("/api/absences", async (req, res) => {
    const { teacherId, date, status, reason } = req.body;
    try {
      await pool.query("INSERT INTO absences (teacher_id, date, status, reason) VALUES ($1, $2, $3, $4)", [teacherId, date, status, reason]);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Error" }); }
  });

  app.post("/api/student-absences", async (req, res) => {
    const { studentId, date, status, reason } = req.body;
    try {
      await pool.query("INSERT INTO student_absences (student_id, date, status, reason) VALUES ($1, $2, $3, $4)", [studentId, date, status, reason]);
      res.json({ success: true });
    } catch (e) { res.status(500).json({ error: "Error" }); }
  });

  // --- FALTAS AUTOMÁTICAS ---
  async function processAutomaticAbsences() {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(now).toLowerCase();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    try {
      // Docentes
      const teachers = await pool.query("SELECT id, schedule FROM teachers");
      for (const t of teachers.rows) {
        const sched = typeof t.schedule === 'string' ? JSON.parse(t.schedule) : t.schedule;
        if (sched[dayName]?.enabled) {
          const startStr = sched[dayName].slots?.[0]?.start;
          if (startStr) {
            const startMins = parseInt(startStr.split(':')[0]) * 60 + parseInt(startStr.split(':')[1]);
            if (currentMins > (startMins + 60)) {
              const att = await pool.query("SELECT id FROM attendance WHERE teacher_id = $1 AND date = $2", [t.id, date]);
              const abs = await pool.query("SELECT id FROM absences WHERE teacher_id = $1 AND date = $2", [t.id, date]);
              if (att.rows.length === 0 && abs.rows.length === 0) {
                await pool.query("INSERT INTO absences (teacher_id, date, status, reason) VALUES ($1, $2, 'INJUSTIFICADA', 'SISTEMA: NO REGISTRÓ ENTRADA')", [t.id, date]);
              }
            }
          }
        }
      }
      // Estudiantes
      const students = await pool.query("SELECT id, schedule FROM students");
      for (const s of students.rows) {
        const sched = typeof s.schedule === 'string' ? JSON.parse(s.schedule) : s.schedule;
        if (sched[dayName]?.enabled) {
          const startStr = sched[dayName].slots?.[0]?.start;
          if (startStr) {
            const startMins = parseInt(startStr.split(':')[0]) * 60 + parseInt(startStr.split(':')[1]);
            if (currentMins > (startMins + 60)) {
              const att = await pool.query("SELECT id FROM student_attendance WHERE student_id = $1 AND date = $2", [s.id, date]);
              const abs = await pool.query("SELECT id FROM student_absences WHERE student_id = $1 AND date = $2", [s.id, date]);
              if (att.rows.length === 0 && abs.rows.length === 0) {
                await pool.query("INSERT INTO student_absences (student_id, date, status, reason) VALUES ($1, $2, 'INJUSTIFICADA', 'SISTEMA: NO REGISTRÓ ENTRADA')", [s.id, date]);
              }
            }
          }
        }
      }
    } catch (e) { console.error(e); }
  }
  setInterval(processAutomaticAbsences, 30 * 60 * 1000);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // En producción, el archivo server.js está dentro de la carpeta 'dist'.
    // Por lo tanto, __dirname ya apunta a la carpeta 'dist'.
    console.log(`📁 Sirviendo archivos estáticos desde: ${__dirname}`);

    app.use(express.static(__dirname, { 
      maxAge: '7d', // Aumentamos el tiempo de caché para activos estáticos
      setHeaders: (res, path) => {
        if (path.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      }
    }));

    // Solución al error de SEO: Servir un robots.txt válido
    app.get("/robots.txt", (req, res) => {
      res.type("text/plain");
      res.send("User-agent: *\nAllow: /\nDisallow: /api/");
    });

    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "index.html"));
    });
  }

  // Forzamos la inicialización de la DB ANTES de levantar el servidor
  await initDb();

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`
=================================================
  SERVIDOR ESCUCHANDO EN PUERTO ${PORT}
=================================================
    `);
  });
}

startServer().catch(err => {
  console.error("*****************************************");
  console.error("ERROR CRITICO AL INICIAR EL SERVIDOR:");
  console.error(err);
  console.error("*****************************************");
  process.exit(1);
});
