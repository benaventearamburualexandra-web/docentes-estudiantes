export interface Teacher {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string;
  photo_url?: string;
  schedule?: Record<string, { enabled: boolean; start?: string; end?: string; slots?: { start: string, end: string }[] }>;
}

export interface Student {
  id: string;
  first_name: string;
  last_name: string;
  grade_section: string;
  parent_phone: string;
  schedule?: Record<string, { enabled: boolean; start?: string; end?: string; slots?: { start: string, end: string }[] }>;
}

export interface AttendanceRecord {
  id: number | string;
  teacher_name?: string;
  student_name?: string;
  teacher_id?: string;
  student_id?: string;
  type: string;
  date: string;
  time: string;
  status: string;
}

export interface AbsenceRecord {
  id: number | string;
  teacher_id?: string;
  teacher_name?: string;
  date: string;
  status: 'JUSTIFICADA' | 'INJUSTIFICADA';
  reason: string;
  offline?: boolean;
}