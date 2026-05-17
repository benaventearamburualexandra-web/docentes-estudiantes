import { pool } from "./database";

export async function processAutomaticAbsences() {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(now).toLowerCase();
  const currentMins = now.getHours() * 60 + now.getMinutes();

  try {
    // Procesar Docentes
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

    // Procesar Estudiantes
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
              console.log(`📌 Falta automática registrada para estudiante: ${s.id}`);
            }
          }
        }
      }
    }
  } catch (e) {
    console.error("Error en faltas automáticas:", e);
  }
}