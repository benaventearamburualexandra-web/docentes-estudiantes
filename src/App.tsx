import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Toaster, toast } from 'react-hot-toast';
import { 
  QrCode, Camera, Keyboard, UserCheck, LogOut, LogIn, Loader2, 
  CheckCircle2, AlertCircle, Settings, Download, UserPlus, X, 
  Users, LayoutDashboard, FileText, Printer, Trash2, GraduationCap,
  ClipboardList, BarChart3, TrendingUp, TrendingDown, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO, getISOWeek, getISOWeekYear } from 'date-fns';
import { 
  registerAttendance, 
  syncOfflineData, 
  registerTeacher, 
  registerAbsence,
  registerStudent,
  registerStudentAttendance,
  registerStudentAbsence
} from '../offlineSync';

import { Teacher, Student, AttendanceRecord, AbsenceRecord } from '../index';
import { StatsPanel } from '../StatsPanel';
import { INITIAL_SCHEDULE, DAY_LABELS } from './constants';
import { LoginModal } from './LoginModal';
import { TeacherModal } from './TeacherModal';
import { StudentModal } from './StudentModal';
import { AbsenceModal } from './AbsenceModal';
import { QRModal } from './QRModal';
import { exportToExcel, prepareExportData } from './excelService';

export default function App() {
  const [adminUser, setAdminUser] = useState<{username: string, name: string} | null>(() => {
    try {
      const saved = localStorage.getItem('admin_session');
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });
  
  const [activeTab, setActiveTab] = useState<'panel' | 'asistencia' | 'docentes' | 'reportes' | 'faltas' | 'estudiantes'>('panel');
  const [mode, setMode] = useState<'scan' | 'manual'>('scan');
  const [attendanceType, setAttendanceType] = useState<'ENTRADA' | 'SALIDA'>('ENTRADA');
  const attendanceTypeRef = useRef(attendanceType);
  const [teacherId, setTeacherId] = useState('');
  const [offlineTrigger, setOfflineTrigger] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isWakingUp, setIsWakingUp] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [entityType, setEntityType] = useState<'docente' | 'estudiante'>('docente');
  const entityTypeRef = useRef(entityType);

  useEffect(() => {
    entityTypeRef.current = entityType;
  }, [entityType]);

  // Estados con carga de Caché Local inmediata
  const [teachers, setTeachers] = useState<Teacher[]>(() => {
    try { return JSON.parse(localStorage.getItem('cache_teachers') || '[]'); } catch (e) { return []; }
  });
  const teachersRef = useRef(teachers);
  useEffect(() => { teachersRef.current = teachers; }, [teachers]);

  const [students, setStudents] = useState<Student[]>(() => {
    try { return JSON.parse(localStorage.getItem('cache_students') || '[]'); } catch (e) { return []; }
  });
  const studentsRef = useRef(students);
  useEffect(() => { studentsRef.current = students; }, [students]);

  const [records, setRecords] = useState<AttendanceRecord[]>(() => {
    try { return JSON.parse(localStorage.getItem('cache_records') || '[]'); } catch (e) { return []; }
  });
  const [absences, setAbsences] = useState<AbsenceRecord[]>(() => {
    try { return JSON.parse(localStorage.getItem('cache_absences') || '[]'); } catch (e) { return []; }
  });
  const [admins, setAdmins] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem('cache_admins') || '[]'); } catch (e) { return []; }
  });

  const [isWrongPort, setIsWrongPort] = useState(false);

  const [showLogin, setShowLogin] = useState(false);
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [showAddStudentAbsence, setShowAddStudentAbsence] = useState(false);
  const [showEditTeacher, setShowEditTeacher] = useState(false);
  const [showAddAbsence, setShowAddAbsence] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [loginUsername, setLoginUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [newTeacher, setNewTeacher] = useState({ id: '', first_name: '', last_name: '', specialty: '', photo_url: '', schedule: INITIAL_SCHEDULE });
  const [newStudent, setNewStudent] = useState({ id: '', first_name: '', last_name: '', grade_section: '', parent_phone: '', schedule: INITIAL_SCHEDULE });
  const [studentRecords, setStudentRecords] = useState<any[]>([]);
  const [studentAbsences, setStudentAbsences] = useState<any[]>([]);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [newAbsence, setNewAbsence] = useState({ teacherId: '', date: new Date().toISOString().split('T')[0], status: 'INJUSTIFICADA', reason: '' });
  const [newStudentAbsence, setNewStudentAbsence] = useState({ studentId: '', date: new Date().toISOString().split('T')[0], status: 'INJUSTIFICADA', reason: '' });
  const [selectedTeacherQR, setSelectedTeacherQR] = useState<Teacher | null>(null);
  const [selectedStudentQR, setSelectedStudentQR] = useState<Student | null>(null);
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [reportWeek, setReportWeek] = useState('');

  const [isSyncing, setIsSyncing] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const scannerRef = useRef<any>(null);
  const isInitializingRef = useRef<boolean>(false);
  const lastScannedRef = useRef<{ id: string, time: number }>({ id: '', time: 0 });
  const [dbStatus, setDbStatus] = useState<'connected' | 'error' | 'checking' | 'reconnecting'>('checking');
  const [dbErrorMessage, setDbErrorMessage] = useState<string | null>(null);

  const stats = useMemo(() => {
    const now = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    const today = last7Days[6];
    const totalMembers = (Array.isArray(teachers) ? teachers.length : 0) + (Array.isArray(students) ? students.length : 0);
    
    const allRecords = [...(Array.isArray(records) ? records : []), ...(Array.isArray(studentRecords) ? studentRecords : [])].filter(Boolean);
    const allAbsences = [...(Array.isArray(absences) ? absences : []), ...(Array.isArray(studentAbsences) ? studentAbsences : [])].filter(Boolean);

    const attToday = allRecords.filter(r => r && r.date === today && r.type === 'ENTRADA').length;
    
    const totalEntries = allRecords.filter(r => r && r.type === 'ENTRADA').length;
    const punctualCount = allRecords.filter(r => r && r.type === 'ENTRADA' && r.status === 'PUNTUAL').length;
    const punctualityRate = totalEntries > 0 ? ((punctualCount / totalEntries) * 100).toFixed(2) : "0.00";

    const totalFaltas = Array.isArray(allAbsences) ? allAbsences.length : 0;
    const totalPossible = totalEntries + totalFaltas;
    const absenceRate = totalPossible > 0 ? ((totalFaltas / totalPossible) * 100).toFixed(2) : "0.00";

    // Cálculo de tendencias para los gráficos de barras
    const trends = {
      events: last7Days.map(date => allRecords.filter(r => r && r.date === date).length),
      punctuality: last7Days.map(date => {
        const dayEntries = allRecords.filter(r => r && r.date === date && r.type === 'ENTRADA');
        return dayEntries.length > 0 ? (dayEntries.filter(r => r && r.status === 'PUNTUAL').length / dayEntries.length) * 100 : 0;
      }),
      absences: last7Days.map(date => allAbsences.filter(a => a && a.date === date).length),
      activeUsers: last7Days.map(date => {
        const ids = allRecords.filter(r => r && r.date === date).map(r => r?.teacher_id || (r as any)?.student_id);
        return new Set(ids.filter(Boolean)).size;
      })
    };

    return {
      totalMembers,
      attToday,
      punctualityRate,
      absenceRate,
      totalEvents: allRecords.length,
      trends
    };
  }, [records, studentRecords, teachers, students, absences, studentAbsences]);

  const MiniBarChart = ({ data, color }: { data: number[], color: string }) => {
    const max = Math.max(...data, 5);
    return (
      <div className="flex items-end gap-1 h-8 mt-4">
        {data.map((val, i) => (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            animate={{ height: `${Math.max((val / max) * 100, 10)}%` }}
            style={{ backgroundColor: color }}
            className="flex-1 rounded-t-sm opacity-40 hover:opacity-100 transition-all cursor-help"
            title={`Valor: ${val.toFixed(0)}`}
          />
        ))}
      </div>
    );
  };

  useEffect(() => {
    attendanceTypeRef.current = attendanceType;
  }, [attendanceType]);

  useEffect(() => {
    const handleStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);

    if (window.location.port === '5173') setIsWrongPort(true);

    // Capturar el evento de instalación de PWA
    const handleBeforeInstall = (e: any) => {
      console.log('✅ PWA: Evento beforeinstallprompt capturado.');
      e.preventDefault();
      setDeferredPrompt(e);
    };

    // Escuchamos el evento inmediatamente
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(reg => {
          // Forzar actualización si hay un nuevo SW
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  toast("Nueva versión disponible. Cierra y abre la app.", { icon: '🔄' });
                }
              };
            }
          };
        })
        .catch(err => console.error('SW error:', err));
    }

    // Diferimos la sincronización para liberar el hilo principal durante la carga inicial
    const syncAndFetch = async () => {
      setIsSyncing(true);
      await syncOfflineData();
      await fetchData(false);
      setIsSyncing(false);
    };

    const initTimeout = setTimeout(syncAndFetch, 2500); // Dar más tiempo al navegador para estabilizarse

    return () => {
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      clearTimeout(initTimeout);
    };
  }, []);

  // --- FUNCIONES DE QR (CARGA DINÁMICA) ---
  const stopScanner = async () => {
    if (!scannerRef.current) return;
    try {
      await scannerRef.current.stop().catch(() => {});
      await scannerRef.current.clear();
    } finally {
      scannerRef.current = null;
      setIsCameraActive(false);
    }
    isInitializingRef.current = false;
  };

  const startScanner = async () => {
    if (isInitializingRef.current || scannerRef.current) return;
    isInitializingRef.current = true;
    const element = document.getElementById("reader");
    if (!element) { isInitializingRef.current = false; return; }
    setScannerError(null);

    try {
      if (scannerRef.current) { try { await scannerRef.current.stop(); } catch (e) {} }
      // Si el usuario ya cambió de pestaña mientras cargaba el módulo, abortamos
      if (activeTab !== 'asistencia') return;

      scannerRef.current = new Html5Qrcode("reader");

      const config = {
        fps: 30, // Aumentamos a 30 FPS para detección ultra rápida
        qrbox: { width: 250, height: 250 }, // Caja fija para evitar cálculos costosos
        aspectRatio: 1.0,
        formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ], // Solo buscar QRs
        experimentalFeatures: { useBarCodeDetectorIfSupported: true } // Usa aceleración nativa si existe
      };

      await scannerRef.current.start(
        { facingMode: "environment" },
        config,
        (text) => {
          if (activeTab !== 'asistencia') return;
          const now = Date.now();
          if (lastScannedRef.current.id === text && (now - lastScannedRef.current.time) < 2000) return;
          lastScannedRef.current = { id: text, time: now };
          
          if ('vibrate' in navigator) navigator.vibrate(200);
          entityTypeRef.current === 'docente' ? handleAttendance(text) : handleStudentAttendance(text);
        },
        () => {}
      );
      setIsCameraActive(true);
    } catch (err) {
      setScannerError("Error al iniciar cámara. Verifica los permisos del navegador.");
      setIsCameraActive(false);
      toast.error("No se pudo acceder a la cámara", {
        icon: '📷',
        style: { borderRadius: '15px', background: '#333', color: '#fff' }
      });
    } finally { 
      isInitializingRef.current = false; 
    }
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm('¿Eliminar a este estudiante?')) return;
    try {
      const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Estudiante eliminado');
        fetchData();
      }
    } catch (e) { toast.error('Error al conectar'); }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    console.log('✅ PWA: Prompt de instalación mostrado al usuario.');
    setDeferredPrompt(null); // Limpiamos el prompt sin importar el resultado
  };

  const deleteAbsence = async (id: number | string) => {
    if (!confirm('¿Eliminar este registro de falta?')) return;
    try {
      const res = await fetch(`/api/absences/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Registro eliminado');
        fetchData();
      }
    } catch (e) { toast.error('Error al eliminar'); }
  };

  const handleDeleteTeacher = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar a este docente? Se borrarán también sus registros de asistencia.')) return;
    try {
      const res = await fetch(`/api/teachers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Docente eliminado correctamente');
        fetchData();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Error al eliminar');
      }
    } catch (e) { toast.error('Error de conexión'); }
  };

  const handleUpdateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;
    const loading = toast.loading('Actualizando docente...');
    try {
      const res = await fetch(`/api/teachers/${editingTeacher.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingTeacher),
      });
      if (res.ok) { toast.success('Datos actualizados', { id: loading }); setShowEditTeacher(false); fetchData(); }
      else { toast.error('Error al actualizar', { id: loading }); }
    } catch (e) { toast.error('Fallo de conexión', { id: loading }); }
  };

  const downloadQRCode = () => {
    const entity = selectedTeacherQR || selectedStudentQR;
    if (!entity) return;
    const svg = document.getElementById("teacher-qr-code");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = 400;
      canvas.height = 450;
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, 400, 450);
        ctx.drawImage(img, 50, 50, 300, 300);
        
        ctx.fillStyle = "black";
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`${entity.first_name} ${entity.last_name}`, 200, 380);
        ctx.font = "14px monospace";
        ctx.fillText(`ID: ${entity.id}`, 200, 410);
      }
      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = `QR_${entity.last_name}_${entity.first_name}.png`;
      link.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  useEffect(() => {
    // Si no estamos en asistencia/scan, apagamos la cámara inmediatamente
    if (activeTab !== 'asistencia' || mode !== 'scan') {
      stopScanner();
      return;
    }

    const timer = setTimeout(() => startScanner(), 500); // Damos un poco más de tiempo al DOM
    return () => {
      clearTimeout(timer);
      stopScanner();
    };
  }, [activeTab, mode]); // Eliminamos isOnline para evitar reinicios innecesarios

  const fetchData = async (showLoader = false, retries = 0) => {
    if (!navigator.onLine && window.location.hostname !== 'localhost') {
      setDbStatus('connected');
      setIsLoading(false);
      return;
    }
    
    if (showLoader) setIsLoading(true);
    setDbStatus('checking');
    let wakeupTimer = setTimeout(() => { if (showLoader) setIsWakingUp(true); }, 1500);

    try {
      const timestamp = Date.now();
      const responses = await Promise.allSettled([
        fetch(`/api/teachers?t=${timestamp}`),
        fetch(`/api/report?t=${timestamp}`),
        fetch(`/api/absences?t=${timestamp}`),
        fetch(`/api/health?t=${timestamp}`),
        fetch(`/api/admins?t=${timestamp}`),         // 4
        fetch(`/api/students?t=${timestamp}`),       // 5
        fetch(`/api/student-report?t=${timestamp}`), // 6
        fetch(`/api/student-absences?t=${timestamp}`) // 7
      ]);

      const safeJson = async (resPromise: any) => {
        if (resPromise.status === 'fulfilled' && resPromise.value.ok) {
          try { return await resPromise.value.json(); } catch (e) { return null; }
        }
        return null;
      };

      const hResPromise = responses[3];
      if (hResPromise.status === 'fulfilled' && hResPromise.value.ok) {
        const health = await safeJson(hResPromise);
        if (health && (health.status === 'ok' || health.db === 'connected')) {
          setDbStatus('connected');
          setDbErrorMessage(null);
        }
      }

      const [tData, rData, aData, admData, sData, srData, saData] = await Promise.all([
        safeJson(responses[0]),
        safeJson(responses[1]),
        safeJson(responses[2]),
        safeJson(responses[4]),
        safeJson(responses[5]),
        safeJson(responses[6]),
        safeJson(responses[7])
      ]);

      if (Array.isArray(tData)) { setTeachers(tData); localStorage.setItem('cache_teachers', JSON.stringify(tData)); }
      if (Array.isArray(sData)) { setStudents(sData); localStorage.setItem('cache_students', JSON.stringify(sData)); }
      if (Array.isArray(rData)) { setRecords(rData); localStorage.setItem('cache_records', JSON.stringify(rData)); }
      if (Array.isArray(srData)) { setStudentRecords(srData); }
      if (Array.isArray(aData)) { setAbsences(aData); localStorage.setItem('cache_absences', JSON.stringify(aData)); }
      if (Array.isArray(saData)) { setStudentAbsences(saData); }
      if (Array.isArray(admData)) { 
        setAdmins(admData); 
        localStorage.setItem('cache_admins', JSON.stringify(admData)); 
      } else {
        setAdmins([]);
      }
    } catch (error) {
      console.error("Fetch error:", error);
      if (retries < 2) {
        console.log(`Reintentando conexión... (${retries + 1})`);
        setTimeout(() => fetchData(showLoader, retries + 1), 3000);
      } else {
        setDbStatus('error');
        setDbErrorMessage("El servidor está tardando en responder. Por favor, refresca la página.");
      }
    } finally {
      clearTimeout(wakeupTimer);
      setIsWakingUp(false);
      setIsLoading(false);
    }
  };

  // --- EXPORTAR EXCEL (DINÁMICO) ---
  const downloadExcel = async () => {
    const loading = toast.loading('Generando reporte Excel...');
    try {
      const isDocente = entityType === 'docente';
      const recordsToExport = isDocente ? combinedRecords : combinedStudentRecords;
      const absencesToExport = isDocente ? combinedAbsences : combinedStudentAbsences;

      const data = prepareExportData(recordsToExport, absencesToExport, isDocente);
      exportToExcel(data, `Reporte_${isDocente ? 'Docentes' : 'Estudiantes'}_${reportMonth}`);
      
      toast.success('Excel descargado', { id: loading });
    } catch (error) {
      toast.error('Error al generar Excel', { id: loading });
    }
  };

  // Procesa datos de estudiantes (Servidor + Offline)
  const combinedStudentRecords = useMemo(() => {
    try {
      if (!Array.isArray(students)) return [];
      let pending = [];
      try {
        const raw = localStorage.getItem('pending_student_attendance');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) pending = parsed;
        }
      } catch (e) { pending = []; }

      const studentMap = new Map(students.filter(s => s && s?.id).map(s => [s.id.toString(), s]));

      const mappedPending = pending.map((item: any): AttendanceRecord | null => {
        if (!item) return null;
        const sId = item.studentId?.toString() || '';
        const sObj = studentMap.get(sId);
        return {
          id: item.offlineId || Math.random().toString(),
          student_name: sObj ? `${sObj.first_name} ${sObj.last_name}` : (sId || 'Desconocido'),
          student_id: sId,
          type: item.type || 'S/D',
          date: item.manualDate || new Date().toISOString().split('T')[0],
          time: item.manualTime || new Date().toLocaleTimeString('en-GB'),
          status: item.status || 'PENDIENTE'
        };
      }).filter((r): r is AttendanceRecord => r !== null && !!r.student_id);

      const allRecords = [...(Array.isArray(studentRecords) ? studentRecords : []), ...mappedPending];
      return allRecords
        .filter(r => r && r.date && (reportWeek ? isDateInWeek(r.date, reportWeek) : (reportMonth ? r.date.startsWith(reportMonth) : true)))
        .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || ''))
        .slice(0, 100);
    } catch (err) {
      console.error("Error en combinedStudentRecords:", err);
      return [];
    }
  }, [studentRecords, students, reportMonth, reportWeek, offlineTrigger]);

  const combinedStudentAbsences = useMemo(() => {
    return (Array.isArray(studentAbsences) ? studentAbsences : [])
      .filter(a => a && a.date && (reportWeek ? isDateInWeek(a.date, reportWeek) : (reportMonth ? a.date.startsWith(reportMonth) : true)))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [studentAbsences, reportMonth, reportWeek]);

  // --- LÓGICA DE DATOS COMBINADOS (OFFLINE + ONLINE) ---
  const combinedRecords = useMemo(() => {
    try {
      if (!Array.isArray(teachers)) return [];
      let pending = [];
      try {
        const raw = localStorage.getItem('pending_attendance');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) pending = parsed;
        }
      } catch (e) { pending = []; }

      const teacherMap = new Map(teachers.filter(t => t && t?.id).map(t => [t.id.toString(), t]));

      const mappedPending = pending.map((item: any): AttendanceRecord | null => {
        if (!item) return null;
        const tId = item.teacherId?.toString() || '';
        const tObj = teacherMap.get(tId);
        return {
          id: item.offlineId || Math.random().toString(),
          teacher_name: tObj ? `${tObj.first_name} ${tObj.last_name}` : (tId || 'Desconocido'),
          teacher_id: tId,
          type: item.type || 'S/D',
          date: item.manualDate || '',
          time: item.manualTime || '',
          status: item.status || 'PENDIENTE'
        };
      }).filter((r): r is AttendanceRecord => r !== null && !!r.teacher_id);

      const allRecords = [...(Array.isArray(records) ? records : []), ...mappedPending];
      return allRecords
        .filter(r => r && r.date && (reportWeek ? isDateInWeek(r.date, reportWeek) : (reportMonth ? r.date.startsWith(reportMonth) : true)))
        .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.time || '').localeCompare(a.time || ''))
        .slice(0, 100);
    } catch (err) {
      console.error("Error en combinedRecords:", err);
      return [];
    }
  }, [records, teachers, reportMonth, reportWeek, offlineTrigger]);

  const combinedAbsences = useMemo(() => {
    try {
      if (!Array.isArray(teachers)) return [];
      let pending = [];
      try {
        const raw = localStorage.getItem('pending_absences');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) pending = parsed;
        }
      } catch (e) { pending = []; }

      const teacherMap = new Map(teachers.filter(t => t && t?.id).map(t => [t.id.toString(), t]));

      const mappedPending = pending.map((item: any): AbsenceRecord | null => {
        if (!item) return null;
        const tId = item.teacherId?.toString() || '';
        const tObj = teacherMap.get(tId);
        return {
          id: 'pending-' + Math.random(),
          teacher_id: tId,
          teacher_name: tObj ? `${tObj.first_name} ${tObj.last_name}` : (tId || 'Desconocido'),
          date: item.date || '',
          status: item.status || 'INJUSTIFICADA',
          reason: item.reason || '',
          offline: true
        };
      }).filter((a): a is AbsenceRecord => a !== null && !!a.teacher_id);

      const allAbsences = [...(Array.isArray(absences) ? absences : []), ...mappedPending];
      return allAbsences
        .filter(a => a && a.date && (reportWeek ? isDateInWeek(a.date, reportWeek) : (reportMonth ? a.date.startsWith(reportMonth) : true)))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    } catch (err) {
      console.error("Error en combinedAbsences:", err);
      return [];
    }
  }, [absences, teachers, reportMonth, reportWeek, offlineTrigger]);

  // --- ACCIONES ---
  const handleAttendance = async (id: string) => {
    const tid = id.trim();
    if (isSubmitting || !tid) return;
    setIsSubmitting(true);
    
    // --- LÓGICA DE TARDANZA INTEGRADA ---
    let calculatedStatus = 'PUNTUAL';
    if (attendanceTypeRef.current === 'ENTRADA') {
      // 1. Buscamos en los docentes ya sincronizados
      let teacher = teachersRef.current.find(t => t.id === tid);
      
      // 2. MEJORA OFFLINE: Si no existe, buscamos en los docentes agregados offline 
      // que aún no se han subido al servidor.
      if (!teacher) {
        try {
          const pending = JSON.parse(localStorage.getItem('pending_teachers') || '[]');
          teacher = pending.find((t: any) => t.id === tid);
        } catch (e) {
          console.warn("No se pudo acceder a los docentes pendientes offline");
        }
      }

      if (teacher && teacher.schedule) {
        const now = new Date();
        const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'America/Lima' }).format(now).toLowerCase();
        const daySchedule = teacher.schedule[dayName];
        
        if (daySchedule?.enabled) {
          const peruTimeStr = new Intl.DateTimeFormat('en-GB', { 
            hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' 
          }).format(now);
          const [currH, currM] = peruTimeStr.split(':').map(Number);
          const currentTime = currH * 60 + currM;

          let referenceStartMins = null;
          let minDiff = Infinity;

          if (daySchedule.slots && daySchedule.slots.length > 0) {
            daySchedule.slots.forEach((slot: any) => {
              const [h, m] = slot.start.split(':').map(Number);
              const slotMins = h * 60 + m;
              const diff = Math.abs(currentTime - slotMins);
              if (diff < minDiff) {
                minDiff = diff;
                referenceStartMins = slotMins;
              }
            });
          } else if (daySchedule.start) {
            const [h, m] = daySchedule.start.split(':').map(Number);
            referenceStartMins = h * 60 + m;
          }

          if (referenceStartMins !== null && currentTime > referenceStartMins) {
            calculatedStatus = 'TARDE';
          }
        }
      }
    }

    const loading = toast.loading(`Registrando ${attendanceTypeRef.current}...`);
    try {
      const data = await registerAttendance(tid, attendanceTypeRef.current, calculatedStatus);
      if (data.success) {
        const msg = `${attendanceTypeRef.current} ${calculatedStatus} ${data.offline ? '(Modo Offline)' : ''}`;
        toast.success(msg, { id: loading, duration: 4000 });
        setTeacherId('');
        setOfflineTrigger(prev => prev + 1);
        fetchData();
      } else throw new Error(data.error);
    } catch (error: any) {
      toast.error(error.message || 'Error de conexión', { id: loading });
    } finally { setIsSubmitting(false); }
  };

  const handleStudentAttendance = async (id: string) => {
    const sid = id.trim();
    if (isSubmitting || !sid) return;
    setIsSubmitting(true);

    let calculatedStatus = 'PUNTUAL';
    if (attendanceTypeRef.current === 'ENTRADA') {
      const student = studentsRef.current.find(s => s.id === sid);
      if (student?.schedule) {
        const now = new Date();
        const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'America/Lima' }).format(now).toLowerCase();
        const daySched = student.schedule[dayName];
        if (daySched?.enabled) {
          const timeStr = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' }).format(now);
          let startStr = (daySched.slots && daySched.slots.length > 0) ? daySched.slots[0].start : (daySched as any).start;
          if (startStr && timeStr > startStr) calculatedStatus = 'TARDE';
        }
      }
    }

    const loading = toast.loading(`Registrando ${attendanceTypeRef.current}...`);
    try {
      const data = await registerStudentAttendance(sid, attendanceTypeRef.current, calculatedStatus);
      if (data.success) {
        toast.success(`${data.studentName || 'Estudiante'}: ${attendanceTypeRef.current} ${calculatedStatus}`, { id: loading });
        setTeacherId('');
        setOfflineTrigger(prev => prev + 1);
        fetchData();
      } else throw new Error(data.error);
    } catch (error: any) { toast.error(error.message || 'Error', { id: loading }); }
    finally { setIsSubmitting(false); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const loading = toast.loading('Verificando...');
    try {
      const res = await fetch('/api/login', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ username: loginUsername, password }) 
      });
      if (res.ok) {
        const data = await res.json();
        setAdminUser(data.user);
        localStorage.setItem('admin_session', JSON.stringify(data.user));
        setShowLogin(false);
        toast.success(`Bienvenido ${data.user.name}`, { id: loading });
      } else {
        toast.error('Credenciales incorrectas', { id: loading });
      }
    } catch (e) { toast.error('Error de conexión', { id: loading }); }
  };

  const onAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    const loading = toast.loading('Guardando...');
    try {
      const data = await registerTeacher(newTeacher);
      if (data.success) {
        toast.success('Docente registrado', { id: loading });
        setShowAddTeacher(false);
        setNewTeacher({ id: '', first_name: '', last_name: '', specialty: '', photo_url: '', schedule: INITIAL_SCHEDULE });
        fetchData();
      } else throw new Error(data.error);
    } catch (e: any) { toast.error(e.message, { id: loading }); }
  };

  const onAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const loading = toast.loading('Registrando...');
    try {
      const data = await registerStudent(newStudent);
      if (data.success) {
        const message = data.offline 
          ? '⚠️ Guardado localmente (Se sincronizará al detectar internet)' 
          : '✅ Estudiante registrado en la base de datos';
        toast.success(message, { id: loading });
        
        // Forzamos la generación del QR con una copia profunda de los datos actuales
        const studentToQR = JSON.parse(JSON.stringify(newStudent));
        setSelectedStudentQR(studentToQR);

        setShowAddStudent(false);
        setNewStudent({ id: '', first_name: '', last_name: '', grade_section: '', parent_phone: '', schedule: INITIAL_SCHEDULE });
        fetchData();
      } else throw new Error(data.error);
    } catch (e: any) { toast.error(e.message, { id: loading }); }
  };

  const onAddAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    const loading = toast.loading('Guardando...');
    try {
      let data;
      if (newAbsence.id) {
        // Modo edición
        const res = await fetch(`/api/absences/${newAbsence.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newAbsence)
        });
        data = await res.json();
      } else {
        // Modo nuevo
        data = await registerAbsence(newAbsence);
      }

      if (data.success) {
        toast.success(newAbsence.id ? 'Falta actualizada' : 'Falta registrada', { id: loading });
        setShowAddAbsence(false);
        setNewAbsence({ teacherId: '', date: new Date().toISOString().split('T')[0], status: 'INJUSTIFICADA', reason: '' });
        fetchData();
      }
    } catch (e) { toast.error('Error al registrar', { id: loading }); }
  };

  const onAddStudentAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    const loading = toast.loading('Guardando...');
    try {
      let data;
      if (newStudentAbsence.id) {
        const res = await fetch(`/api/student-absences/${newStudentAbsence.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newStudentAbsence)
        });
        data = await res.json();
      } else {
        data = await registerStudentAbsence(newStudentAbsence);
      }

      if (data.success || data.offline) {
        toast.success(newStudentAbsence.id ? 'Falta actualizada' : 'Falta registrada', { id: loading });
        setShowAddStudentAbsence(false);
        setNewStudentAbsence({ studentId: '', date: new Date().toISOString().split('T')[0], status: 'INJUSTIFICADA', reason: '' });
        fetchData();
      }
    } catch (e) { toast.error('Error', { id: loading }); }
  };

  const handleLogout = () => { 
    setAdminUser(null); 
    localStorage.removeItem('admin_session'); 
    setActiveTab('asistencia'); 
    toast.success('Sesión cerrada'); 
  };

  const isDateInWeek = (dateStr: string, weekStr: string) => {
    try {
      const [y, w] = weekStr.split('-W');
      const d = parseISO(dateStr);
      return getISOWeek(d) === parseInt(w) && getISOWeekYear(d) === parseInt(y);
    } catch (e) { return false; }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#11116E] via-[#00BFA6] to-[#E7F26B] text-[#1A1A1A] font-sans flex flex-col md:flex-row overflow-hidden">
      <Toaster position="top-center" />
      
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[150] bg-[#F4CD18] text-[#24157A] text-[10px] font-black uppercase py-1 text-center shadow-lg">
          ⚠️ MODO OFFLINE ACTIVO: Los datos se subirán al detectar internet.
        </div>
      )}

      {/* Sidebar Navigation */}
      <nav className="w-full md:w-64 bg-white border-r border-[#D9D9D9] flex flex-col h-auto md:h-screen sticky top-0 z-50">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#24157A] rounded-xl flex items-center justify-center text-white shadow-lg">
            <UserCheck size={24} />
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-800">EduControl</h1>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-tighter">{isOnline ? 'En línea' : 'Modo Offline'}</p>
          </div>
        </div>

        <div className="flex-1 px-4 py-2 space-y-1 flex md:flex-col overflow-x-auto custom-scrollbar">
          <button onClick={() => setActiveTab('panel')} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'panel' ? 'bg-[#F1F1F1] text-[#24157A]' : 'text-slate-800 hover:bg-[#F1F1F1]'}`}><BarChart3 size={20} /><span>Panel</span></button>
          <button onClick={() => setActiveTab('asistencia')} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'asistencia' ? 'bg-[#F1F1F1] text-[#24157A]' : 'text-slate-800 hover:bg-[#F1F1F1]'}`}><QrCode size={20} /><span>Escáner</span></button>
          {adminUser && (
            <>
              <button onClick={() => setActiveTab('docentes')} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'docentes' ? 'bg-[#F1F1F1] text-[#24157A]' : 'text-slate-800 hover:bg-[#F1F1F1]'}`}><Users size={20} /><span>Docentes</span></button>
              <button onClick={() => setActiveTab('estudiantes')} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'estudiantes' ? 'bg-[#F1F1F1] text-[#24157A]' : 'text-slate-800 hover:bg-[#F1F1F1]'}`}><GraduationCap size={20} /><span>Estudiantes</span></button>
              <button onClick={() => setActiveTab('reportes')} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'reportes' ? 'bg-[#F1F1F1] text-[#24157A]' : 'text-slate-800 hover:bg-[#F1F1F1]'}`}><FileText size={20} /><span>Reportes</span></button>
              <button onClick={() => setActiveTab('faltas')} className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'faltas' ? 'bg-[#F1F1F1] text-[#24157A]' : 'text-slate-800 hover:bg-[#F1F1F1]'}`}><AlertCircle size={20} /><span>Faltas</span></button>
            </>
          )}
        </div>

        <div className="p-4 border-t border-gray-100">
          {adminUser ? (
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-rose-700 hover:bg-rose-50"><LogOut size={20} /><span>Cerrar Sesión</span></button>
          ) : (
            <button onClick={() => setShowLogin(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-slate-700 hover:bg-[#F1F1F1]"><Settings size={20} /><span>Admin Login</span></button>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 h-screen overflow-y-auto p-4 md:p-8">
        <div className="relative flex-1">
          {activeTab === 'panel' && stats && <StatsPanel stats={stats} MiniBarChart={MiniBarChart} />}
          
          {activeTab === 'asistencia' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 max-w-2xl mx-auto">
              {/* Selectores de Tipo de Registro */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-2 rounded-3xl border border-[#D9D9D9] flex shadow-sm">
                  <button 
                    onClick={() => setAttendanceType('ENTRADA')} 
                    className={`flex-1 py-3 rounded-2xl font-black text-xs transition-all ${attendanceType === 'ENTRADA' ? 'bg-[#24157A] text-white' : 'text-slate-400'}`}
                  >ENTRADA</button>
                  <button 
                    onClick={() => setAttendanceType('SALIDA')} 
                    className={`flex-1 py-3 rounded-2xl font-black text-xs transition-all ${attendanceType === 'SALIDA' ? 'bg-rose-600 text-white' : 'text-slate-400'}`}
                  >SALIDA</button>
                </div>
                <div className="bg-white p-2 rounded-3xl border border-[#D9D9D9] flex shadow-sm">
                  <button 
                    onClick={() => setEntityType('docente')} 
                    className={`flex-1 py-3 rounded-2xl font-black text-xs transition-all ${entityType === 'docente' ? 'bg-[#24157A] text-white' : 'text-slate-400'}`}
                  >DOCENTE</button>
                  <button 
                    onClick={() => setEntityType('estudiante')} 
                    className={`flex-1 py-3 rounded-2xl font-black text-xs transition-all ${entityType === 'estudiante' ? 'bg-[#59C65B] text-white' : 'text-slate-400'}`}
                  >ALUMNO</button>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] shadow-2xl border border-[#D9D9D9] overflow-hidden">
                <div className="flex border-b border-[#D9D9D9]">
                  <button 
                    onClick={() => { setMode('scan'); setTimeout(startScanner, 100); }} 
                    className={`flex-1 py-4 font-bold ${mode === 'scan' ? 'bg-[#F1F1F1] text-[#24157A] border-b-4 border-[#24157A]' : 'text-slate-500'}`}
                  >Escáner QR</button>
                  <button 
                    onClick={() => { setMode('manual'); stopScanner(); }} 
                    className={`flex-1 py-4 font-bold ${mode === 'manual' ? 'bg-[#F1F1F1] text-[#24157A] border-b-4 border-[#24157A]' : 'text-slate-500'}`}
                  >Ingreso Manual</button>
                </div>
                <div className="p-10">
                  {mode === 'scan' ? (
                    <div className="flex flex-col items-center">
                      <div className="w-full max-w-xs aspect-square bg-slate-50 rounded-[2.5rem] border-4 border-dashed border-slate-200 overflow-hidden relative">
                        <div id="reader" className="w-full h-full"></div>
                        {!isCameraActive && (
                          <button onClick={startScanner} className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/80 hover:bg-white transition-colors" aria-label="Activar cámara para escanear QR">
                            <Camera size={40} className="text-indigo-600" />
                            <span className="font-bold text-gray-700">Activar Cámara</span>
                          </button>
                        )}
                      </div>
                    {isCameraActive && (
                      <p className="text-center text-[10px] font-black text-[#24157A] animate-pulse">
                        SISTEMA LISTO: MUESTRA EL CÓDIGO QR
                      </p>
                    )}
                    </div>
                  ) : (
                    <form onSubmit={(e) => { e.preventDefault(); entityType === 'docente' ? handleAttendance(teacherId) : handleStudentAttendance(teacherId); }} className="space-y-6">
                      <input type="text" value={teacherId} onChange={(e) => setTeacherId(e.target.value.replace(/\D/g, ''))} className="w-full px-8 py-5 bg-[#F1F1F1] border-2 border-[#D9D9D9] rounded-3xl focus:border-[#24157A] outline-none text-2xl font-mono text-center" placeholder="ID / DNI" />
                      <button type="submit" disabled={isSubmitting || !teacherId} className="w-full bg-[#24157A] text-white py-5 rounded-3xl font-black text-lg shadow-xl hover:bg-[#2E1A8A] transition-all">REGISTRAR {attendanceType}</button>
                    </form>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'docentes' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <h2 className="text-2xl font-black text-slate-800">Personal Docente</h2>
                <button onClick={() => setShowAddTeacher(true)} className="bg-[#24157A] text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-[#2E1A8A] transition-all">
                  <UserPlus size={20} /> Nuevo Docente
                </button>
              </div>
              <div className="bg-white rounded-[2.5rem] border border-[#D9D9D9] overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-gray-100">
                      <th className="p-6 text-[10px] font-black text-slate-400 uppercase">Docente</th>
                      <th className="p-6 text-[10px] font-black text-slate-400 uppercase">Cargo</th>
                      <th className="p-6 text-[10px] font-black text-slate-400 uppercase text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {Array.isArray(teachers) && teachers.filter(Boolean).map(t => (
                      <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-6">
                          <p className="font-bold text-slate-800">{t.first_name} {t.last_name}</p>
                          <p className="text-xs font-mono text-slate-400">{t.id}</p>
                        </td>
                        <td className="p-6">
                          <span className="px-3 py-1 bg-indigo-50 text-[#24157A] text-[10px] font-black rounded-full border border-indigo-100">{t.specialty}</span>
                        </td>
                        <td className="p-6 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setSelectedTeacherQR(t)} className="p-3 text-slate-400 hover:text-[#24157A]"><QrCode size={18} /></button>
                            <button onClick={() => { setEditingTeacher(t); setShowEditTeacher(true); }} className="p-3 text-slate-400 hover:text-[#24157A]"><Settings size={18} /></button>
                            <button onClick={() => handleDeleteTeacher(t.id)} className="p-3 text-slate-400 hover:text-rose-600"><Trash2 size={18} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'estudiantes' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <h2 className="text-2xl font-black text-slate-800">Alumnado</h2>
                <button onClick={() => setShowAddStudent(true)} className="bg-[#59C65B] text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-[#6EDB63] transition-all">
                  <UserPlus size={20} /> Nuevo Estudiante
                </button>
              </div>
              <div className="bg-white rounded-[2.5rem] border border-[#D9D9D9] overflow-hidden shadow-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-gray-100">
                      <th className="p-6 text-[10px] font-black text-slate-400 uppercase">Estudiante</th>
                      <th className="p-6 text-[10px] font-black text-slate-400 uppercase">Grado / Sección</th>
                      <th className="p-6 text-[10px] font-black text-slate-400 uppercase">Apoderado</th>
                      <th className="p-6 text-[10px] font-black text-slate-400 uppercase text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {Array.isArray(students) && students.filter(Boolean).map(s => (
                      <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-6">
                          <p className="font-bold text-slate-800">{s.last_name}, {s.first_name}</p>
                          <p className="text-xs font-mono text-slate-400">{s.id}</p>
                        </td>
                        <td className="p-6 font-bold text-slate-600 text-sm">{s.grade_section}</td>
                        <td className="p-6 font-medium text-slate-500 text-sm">{s.parent_phone || 'S/N'}</td>
                        <td className="p-6 text-right flex justify-end gap-2">
                          <button onClick={() => setSelectedStudentQR(s)} className="p-3 text-slate-400 hover:text-[#59C65B]"><QrCode size={18} /></button>
                          <button onClick={() => handleDeleteStudent(s.id)} className="p-3 text-slate-400 hover:text-rose-600"><Trash2 size={18} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'reportes' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="bg-white p-8 rounded-[2.5rem] border border-[#D9D9D9] shadow-xl space-y-6">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex bg-slate-100 p-1 rounded-2xl w-fit">
                    <button onClick={() => setEntityType('docente')} className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${entityType === 'docente' ? 'bg-white text-[#24157A] shadow-sm' : 'text-slate-500'}`}>Docentes</button>
                    <button onClick={() => setEntityType('estudiante')} className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${entityType === 'estudiante' ? 'bg-white text-[#24157A] shadow-sm' : 'text-slate-500'}`}>Estudiantes</button>
                  </div>
                  <div className="flex gap-3">
                    <input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none" />
                    <button onClick={downloadExcel} className="bg-[#59C65B] text-white px-6 py-2 rounded-xl font-bold text-xs flex items-center gap-2 hover:bg-[#6EDB63] transition-all shadow-md"><Download size={16} /> Exportar</button>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-gray-100">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase">Nombre</th>
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase">Evento</th>
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase">Fecha / Hora</th>
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(entityType === 'docente' ? combinedRecords : combinedStudentRecords).map((r: any) => (
                        <tr key={r.id} className="text-sm">
                          <td className="p-4 font-bold text-slate-800">{r.teacher_name || r.student_name}</td>
                          <td className="p-4 font-black text-[10px] uppercase text-slate-500">{r.type}</td>
                          <td className="p-4 text-slate-500">{r.date} <span className="font-mono text-xs opacity-60">{r.time}</span></td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-md text-[10px] font-black ${r.status === 'TARDE' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{r.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'faltas' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="bg-white p-8 rounded-[2.5rem] border border-[#D9D9D9] shadow-xl space-y-6">
                <div className="flex justify-between items-center">
                  <div className="flex bg-slate-100 p-1 rounded-2xl w-fit">
                    <button onClick={() => setEntityType('docente')} className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${entityType === 'docente' ? 'bg-white text-[#24157A] shadow-sm' : 'text-slate-500'}`}>Docentes</button>
                    <button onClick={() => setEntityType('estudiante')} className={`px-6 py-2 rounded-xl font-bold text-xs transition-all ${entityType === 'estudiante' ? 'bg-white text-[#24157A] shadow-sm' : 'text-slate-500'}`}>Estudiantes</button>
                  </div>
                  <button onClick={() => entityType === 'docente' ? setShowAddAbsence(true) : setShowAddStudentAbsence(true)} className="bg-[#24157A] text-white px-6 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 hover:bg-[#2E1A8A] transition-all">
                    <AlertCircle size={16} /> Registrar Falta
                  </button>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-gray-100">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase">Nombre</th>
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase">Fecha</th>
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase">Estado</th>
                        <th className="p-4 text-[10px] font-black text-slate-400 uppercase">Motivo</th>
                        <th className="p-4 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {(entityType === 'docente' ? combinedAbsences : combinedStudentAbsences).map((a: any) => (
                        <tr key={a.id} className="text-sm">
                          <td className="p-4 font-bold text-slate-800">{a.teacher_name || a.student_name}</td>
                          <td className="p-4 text-slate-500">{a.date}</td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-md text-[10px] font-black ${a.status === 'JUSTIFICADA' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>{a.status}</span>
                          </td>
                          <td className="p-4 text-slate-500 text-xs italic">{a.reason || 'Sin motivo'}</td>
                          <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => {
                                if (entityType === 'docente') { setNewAbsence(a); setShowAddAbsence(true); } 
                                else { setNewStudentAbsence(a); setShowAddStudentAbsence(true); }
                              }} 
                              className="text-indigo-400 hover:text-indigo-600 transition-colors"
                            ><Settings size={16} /></button>
                            <button onClick={() => deleteAbsence(a.id)} className="text-rose-400 hover:text-rose-600"><Trash2 size={16} /></button>
                          </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* Modals Centralizados */}
      <AnimatePresence>
        <LoginModal 
          isOpen={showLogin} 
          onClose={() => setShowLogin(false)} 
          onSubmit={handleLogin}
          username={loginUsername} setUsername={setLoginUsername}
          password={password} setPassword={setPassword}
        />

        <TeacherModal 
          isOpen={showAddTeacher || showEditTeacher} 
          onClose={() => { setShowAddTeacher(false); setShowEditTeacher(false); }} 
          onSubmit={showEditTeacher && editingTeacher ? handleUpdateTeacher : onAddTeacher}
          teacher={showEditTeacher ? editingTeacher : newTeacher}
          setTeacher={showEditTeacher ? setEditingTeacher : setNewTeacher}
          isEdit={showEditTeacher}
        />

        <StudentModal 
          isOpen={showAddStudent} 
          onClose={() => setShowAddStudent(false)} 
          onSubmit={onAddStudent}
          student={newStudent} setStudent={setNewStudent}
        />

        <AbsenceModal 
          isOpen={showAddAbsence || showAddStudentAbsence} 
          onClose={() => { setShowAddAbsence(false); setShowAddStudentAbsence(false); }} 
          onSubmit={showAddStudentAbsence ? onAddStudentAbsence : onAddAbsence}
          type={showAddStudentAbsence ? 'estudiante' : 'docente'}
          data={showAddStudentAbsence ? newStudentAbsence : newAbsence}
          setData={showAddStudentAbsence ? setNewStudentAbsence : setNewAbsence}
          teachers={teachers} students={students}
        />

        <QRModal 
          entity={selectedTeacherQR || selectedStudentQR} 
          type={selectedTeacherQR ? 'docente' : 'estudiante'}
          onClose={() => { setSelectedTeacherQR(null); setSelectedStudentQR(null); }}
          onDownload={downloadQRCode}
        />
      </AnimatePresence>
    </div>
  );
}