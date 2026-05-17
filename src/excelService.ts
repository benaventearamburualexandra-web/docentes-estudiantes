import * as XLSX from 'xlsx';

/**
 * Genera y descarga un archivo Excel a partir de un array de datos.
 */
export const exportToExcel = (data: any[], filename: string) => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Reporte");
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

/**
 * Prepara los datos crudos para el formato de exportación amigable de Excel.
 */
export const prepareExportData = (records: any[], absences: any[], isDocente: boolean) => {
  const safeRecords = Array.isArray(records) ? records : [];
  const safeAbsences = Array.isArray(absences) ? absences : [];

  return [
    ...safeRecords.map((r: any) => ({
      'Categoría': isDocente ? 'DOCENTE' : 'ESTUDIANTE',
      'Tipo': 'ASISTENCIA',
      'Nombre': (r.teacher_name || r.student_name || 'DESCONOCIDO').toUpperCase(), 
      'ID/DNI': r.teacher_id || r.student_id || '-', 
      'Evento': r.type || 'S/D',
      'Fecha': r.date || '-', 
      'Hora': r.time || '-', 
      'Estado': r.status || 'PUNTUAL'
    })),
    ...safeAbsences.map((a: any) => ({
      'Categoría': isDocente ? 'DOCENTE' : 'ESTUDIANTE',
      'Tipo': 'FALTA',
      'Nombre': (a.teacher_name || a.student_name || 'Desconocido').toUpperCase(), 
      'ID/DNI': a.teacher_id || a.student_id || '-', 
      'Evento': a.status || 'INJUSTIFICADA',
      'Fecha': a.date || '-', 
      'Hora': '-', 
      'Motivo': a.reason || 'Sin motivo'
    }))
  ].sort((a, b) => String(b.Fecha).localeCompare(String(a.Fecha)));
};