const STORAGE_KEY = 'pending_attendance';
const TEACHERS_KEY = 'pending_teachers';
const ABSENCES_KEY = 'pending_absences';
const STUDENTS_KEY = 'pending_students';
const STUDENT_ATTENDANCE_KEY = 'pending_student_attendance';

/**
 * Ayudante para peticiones fetch consistentes
 */
async function safeFetch(url: string, data: any) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      const json = await res.json();
      if (!res.ok) return { success: false, error: json.error || 'Error en el servidor' };
      return json;
    } else {
      const text = await res.text();
      return { success: false, error: `Error del servidor: ${res.status}` };
    }
  } catch (e) {
    throw e; // Lanza para que el catch del llamador active el modo offline
  }
}

/**
 * Intenta registrar la asistencia. Si falla (sin red), la guarda en LocalStorage.
 */
export async function registerAttendance(teacherId: string, type: 'ENTRADA' | 'SALIDA', status: string = 'PUNTUAL') {
  const now = new Date();
  const attendanceData = {
    teacherId,
    type,
    manualDate: new Intl.DateTimeFormat('en-CA', { 
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Lima' 
    }).format(now),
    manualTime: new Intl.DateTimeFormat('en-GB', { 
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'America/Lima' 
    }).format(now),
    status,
    offlineId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  };

  try {
    return await safeFetch('/api/attendance', attendanceData);
  } catch (error) {
    console.warn("⚠️ Sin conexión. Guardando en LocalStorage...");
    const pending = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    pending.push(attendanceData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pending));
    return { success: true, offline: true, teacherName: "Guardado localmente (sin internet)" };
  }
}

/**
 * Guarda un nuevo docente localmente si no hay red.
 */
export async function registerTeacher(teacherData: any) {
  try {
    return await safeFetch('/api/teachers', teacherData);
  } catch (error) {
    const pending = JSON.parse(localStorage.getItem(TEACHERS_KEY) || '[]');
    pending.push(teacherData);
    localStorage.setItem(TEACHERS_KEY, JSON.stringify(pending));
    return { success: true, offline: true };
  }
}

/**
 * Guarda una falta localmente si no hay red.
 */
export async function registerAbsence(absenceData: any) {
  try {
    return await safeFetch('/api/absences', absenceData);
  } catch (error) {
    const pending = JSON.parse(localStorage.getItem(ABSENCES_KEY) || '[]');
    pending.push(absenceData);
    localStorage.setItem(ABSENCES_KEY, JSON.stringify(pending));
    return { success: true, offline: true };
  }
}

/**
 * Registra asistencia de estudiante con soporte offline.
 */
export async function registerStudentAttendance(studentId: string, type: 'ENTRADA' | 'SALIDA', status: string = 'PUNTUAL') {
  const now = new Date();
  const attendanceData = {
    studentId,
    type,
    manualDate: new Intl.DateTimeFormat('en-CA', { 
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Lima' 
    }).format(now),
    manualTime: new Intl.DateTimeFormat('en-GB', { 
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'America/Lima' 
    }).format(now),
    status,
    offlineId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  };

  try {
    return await safeFetch('/api/student-attendance', attendanceData);
  } catch (error) {
    console.warn("⚠️ Sin conexión (Estudiante). Guardando localmente...");
    const pending = JSON.parse(localStorage.getItem(STUDENT_ATTENDANCE_KEY) || '[]');
    pending.push(attendanceData);
    localStorage.setItem(STUDENT_ATTENDANCE_KEY, JSON.stringify(pending));
    return { success: true, offline: true, studentName: "Guardado localmente (Offline)" };
  }
}

export async function registerStudentAbsence(absenceData: any) {
  try {
    return await safeFetch('/api/student-absences', absenceData);
  } catch (error) {
    const pending = JSON.parse(localStorage.getItem('pending_student_absences') || '[]');
    pending.push(absenceData);
    localStorage.setItem('pending_student_absences', JSON.stringify(pending));
    return { success: true, offline: true };
  }
}

export async function registerStudent(studentData: any) {
  try {
    return await safeFetch('/api/students', studentData);
  } catch (error) {
    const pending = JSON.parse(localStorage.getItem(STUDENTS_KEY) || '[]');
    pending.push(studentData);
    localStorage.setItem(STUDENTS_KEY, JSON.stringify(pending));
    return { success: true, offline: true };
  }
}

/**
 * Envía los registros pendientes al servidor cuando vuelve la conexión.
 */
export async function syncOfflineData() {
  if (!navigator.onLine) return;
  
  // Cargamos todo lo pendiente
  const queue = {
    teachers: JSON.parse(localStorage.getItem(TEACHERS_KEY) || '[]'),
    students: JSON.parse(localStorage.getItem(STUDENTS_KEY) || '[]'),
    attendance: JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'),
    absences: JSON.parse(localStorage.getItem(ABSENCES_KEY) || '[]'),
    studentAtt: JSON.parse(localStorage.getItem(STUDENT_ATTENDANCE_KEY) || '[]')
  };

  if (Object.values(queue).every(arr => arr.length === 0)) return;
  console.log("🔄 Iniciando sincronización de datos pendientes...");

  // 1. Sincronizar Entidades primero (Docentes y Estudiantes)
  // Es vital subirlos antes que sus asistencias para evitar errores de clave foránea.
  for (const t of queue.teachers) {
    try {
      const res = await fetch('/api/teachers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t) });
      if (res.ok || res.status === 400) { // 400 suele ser "ya existe"
        queue.teachers = queue.teachers.filter((item: any) => item.id !== t.id);
        localStorage.setItem(TEACHERS_KEY, JSON.stringify(queue.teachers));
      }
    } catch (e) { break; } // Si falla la red, paramos este bucle
  }

  for (const s of queue.students) {
    try {
      const res = await fetch('/api/students', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
      if (res.ok || res.status === 400) {
        queue.students = queue.students.filter((item: any) => item.id !== s.id);
        localStorage.setItem(STUDENTS_KEY, JSON.stringify(queue.students));
      }
    } catch (e) { break; }
  }

  // 2. Sincronizar Eventos (Asistencias y Faltas)
  const syncEvent = async (url: string, item: any, key: string, idField: string) => {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
      if (res.ok || res.status === 400) {
        const current = JSON.parse(localStorage.getItem(key) || '[]');
        localStorage.setItem(key, JSON.stringify(current.filter((i: any) => i[idField] !== item[idField])));
        return true;
      }
    } catch (e) { return false; }
    return false;
  };

  for (const att of queue.attendance) {
    if (!(await syncEvent('/api/attendance', att, STORAGE_KEY, 'offlineId'))) break;
  }

  for (const abs of queue.absences) {
    // Para faltas no tenemos un offlineId único, usamos combinación de id y fecha
    try {
      const res = await fetch('/api/absences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(abs) });
      if (res.ok || res.status === 400) {
        const current = JSON.parse(localStorage.getItem(ABSENCES_KEY) || '[]');
        localStorage.setItem(ABSENCES_KEY, JSON.stringify(current.filter((i: any) => !(i.teacherId === abs.teacherId && i.date === abs.date))));
      }
    } catch (e) { break; }
  }

  for (const sAtt of queue.studentAtt) {
    if (!(await syncEvent('/api/student-attendance', sAtt, STUDENT_ATTENDANCE_KEY, 'offlineId'))) break;
  }

  console.log("✅ Sincronización finalizada.");
}

// Sincronizar automáticamente cuando el navegador detecta internet
if (typeof window !== 'undefined') {
  window.addEventListener('online', syncOfflineData);
}