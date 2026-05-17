import React from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

interface AbsenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  type: 'docente' | 'estudiante';
  data: any;
  setData: (val: any) => void;
  teachers: any[];
  students: any[];
}

export const AbsenceModal: React.FC<AbsenceModalProps> = ({ 
  isOpen, onClose, onSubmit, type, data, setData, teachers, students 
}) => {
  if (!isOpen) return null;
  const isDocente = type === 'docente';
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl relative">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
        <h2 className="text-2xl font-extrabold mb-6">{data.id ? 'Modificar' : 'Registrar'} Falta {isDocente ? 'Docente' : 'Estudiante'}</h2>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase">{isDocente ? 'Docente' : 'Estudiante'}</label>
            <select required disabled={!!data.id} value={isDocente ? (data.teacherId || data.teacher_id) : (data.studentId || data.student_id)} onChange={e => isDocente ? setData({...data, teacherId: e.target.value}) : setData({...data, studentId: e.target.value})} className="w-full px-6 py-4 bg-[#F1F1F1] border-2 border-[#D9D9D9] rounded-2xl outline-none focus:border-[#24157A] disabled:opacity-50">
              <option value="">Seleccionar...</option>
              {isDocente 
                ? teachers.map(t => <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>)
                : students.map(s => <option key={s.id} value={s.id}>{s.last_name}, {s.first_name}</option>)
              }
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input type="date" required disabled={!!data.id} value={data.date} onChange={e => setData({...data, date: e.target.value})} className="w-full px-6 py-4 bg-[#F1F1F1] border-2 border-[#D9D9D9] rounded-2xl outline-none focus:border-[#24157A] disabled:opacity-50" />
            <select value={data.status} onChange={e => setData({...data, status: e.target.value})} className="w-full px-6 py-4 bg-[#F1F1F1] border-2 border-[#D9D9D9] rounded-2xl outline-none focus:border-[#24157A]">
              <option value="INJUSTIFICADA">Injustificada</option>
              <option value="JUSTIFICADA">Justificada</option>
            </select>
          </div>
          <textarea value={data.reason} onChange={e => setData({...data, reason: e.target.value})} className="w-full px-6 py-4 bg-[#F1F1F1] border-2 border-[#D9D9D9] rounded-2xl outline-none h-24 resize-none" placeholder="Motivo..." />
          <button type="submit" className="w-full bg-[#24157A] text-white py-5 rounded-2xl font-black shadow-lg hover:bg-[#2E1A8A] transition-colors">
            {data.id ? 'ACTUALIZAR REGISTRO' : 'GUARDAR FALTA'}
          </button>
        </form>
      </motion.div>
    </div>
  );
};