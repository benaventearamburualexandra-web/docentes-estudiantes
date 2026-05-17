import React from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { DAY_LABELS } from './constants';

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  student: any;
  setStudent: (val: any) => void;
}

export const StudentModal: React.FC<StudentModalProps> = ({ 
  isOpen, onClose, onSubmit, student, setStudent 
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full"><X size={24} /></button>
        <h2 className="text-2xl font-extrabold mb-6">Registro de Estudiante</h2>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">DNI / Código Estudiante</label>
            <input type="text" required value={student.id} onChange={e => setStudent({...student, id: e.target.value.replace(/\D/g, '')})} className="w-full px-6 py-4 bg-[#F1F1F1] border-2 border-[#D9D9D9] rounded-2xl focus:border-[#24157A] outline-none font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Nombres</label>
              <input type="text" required value={student.first_name} onChange={e => setStudent({...student, first_name: e.target.value})} className="w-full px-6 py-4 bg-[#F1F1F1] border-2 border-[#D9D9D9] rounded-2xl focus:border-[#24157A] outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Apellidos</label>
              <input type="text" required value={student.last_name} onChange={e => setStudent({...student, last_name: e.target.value})} className="w-full px-6 py-4 bg-[#F1F1F1] border-2 border-[#D9D9D9] rounded-2xl focus:border-[#24157A] outline-none" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Grado y Sección</label>
            <input type="text" required value={student.grade_section} onChange={e => setStudent({...student, grade_section: e.target.value})} className="w-full px-6 py-4 bg-[#F1F1F1] border-2 border-[#D9D9D9] rounded-2xl focus:border-[#24157A] outline-none" placeholder="Ej: 5to Secundaria 'A'" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">Teléfono del Apoderado</label>
            <input type="tel" value={student.parent_phone} onChange={e => setStudent({...student, parent_phone: e.target.value})} className="w-full px-6 py-4 bg-[#F1F1F1] border-2 border-[#D9D9D9] rounded-2xl focus:border-[#24157A] outline-none" placeholder="Ej: 987654321" />
          </div>
          <div className="space-y-4 bg-[#F1F1F1] p-5 rounded-3xl border border-[#D9D9D9]">
            <label className="text-[10px] font-black text-[#24157A] uppercase block">Horario de Ingreso y Salida</label>
            {Object.entries(student?.schedule || {}).map(([day, data]: [string, any]) => (
              <div key={day} className="bg-white p-3 rounded-2xl border border-gray-100 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={data.enabled} onChange={e => setStudent({ ...student, schedule: { ...student.schedule, [day]: { ...data, enabled: e.target.checked } } })} className="w-4 h-4 rounded text-[#24157A]" />
                  <span className="font-bold text-slate-700 text-xs">{DAY_LABELS[day]}</span>
                </label>
                {data.enabled && (data.slots || []).map((slot: any, idx: number) => (
                  <div key={idx} className="flex gap-2">
                    <input type="time" value={slot.start} onChange={e => { const newSlots = [...data.slots]; newSlots[idx].start = e.target.value; setStudent({ ...student, schedule: { ...student.schedule, [day]: { ...data, slots: newSlots } } }); }} className="flex-1 text-[10px] p-2 bg-slate-50 rounded-lg border-none" />
                    <input type="time" value={slot.end} onChange={e => { const newSlots = [...data.slots]; newSlots[idx].end = e.target.value; setStudent({ ...student, schedule: { ...student.schedule, [day]: { ...data, slots: newSlots } } }); }} className="flex-1 text-[10px] p-2 bg-slate-50 rounded-lg border-none" />
                  </div>
                ))}
              </div>
            ))}
          </div>
          <button type="submit" className="w-full bg-[#59C65B] text-white py-5 rounded-2xl font-black shadow-lg hover:bg-[#6EDB63] transition-all">REGISTRAR ESTUDIANTE</button>
        </form>
      </motion.div>
    </div>
  );
};