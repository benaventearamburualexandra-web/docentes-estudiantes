import React from 'react';
import { motion } from 'motion/react';
import { X, Trash2 } from 'lucide-react';
import { DAY_LABELS } from './constants';

interface TeacherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  teacher: any;
  setTeacher: (val: any) => void;
  isEdit?: boolean;
}

export const TeacherModal: React.FC<TeacherModalProps> = ({ 
  isOpen, onClose, onSubmit, teacher, setTeacher, isEdit 
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="bg-white rounded-[2.5rem] w-full max-w-md relative z-10 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <form onSubmit={onSubmit} className="flex flex-col h-full overflow-hidden">
          <div className="p-8 pb-4 flex justify-between items-center border-b border-gray-50 bg-white">
            <h2 className="text-2xl font-extrabold">{isEdit ? 'Editar Docente' : 'Nuevo Docente'}</h2>
            <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full"><X size={24} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-widest px-1">Nombres</label>
              <input type="text" required value={teacher.first_name} onChange={e => setTeacher({ ...teacher, first_name: e.target.value })} className="w-full px-6 py-4 bg-[#F1F1F1] border-2 border-[#D9D9D9] rounded-2xl focus:border-[#24157A] outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-widest px-1">Apellidos</label>
              <input type="text" required value={teacher.last_name} onChange={e => setTeacher({ ...teacher, last_name: e.target.value })} className="w-full px-6 py-4 bg-[#F1F1F1] border-2 border-[#D9D9D9] rounded-2xl focus:border-[#24157A] outline-none" />
            </div>
            {!isEdit && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-widest px-1">DNI / ID</label>
                <input type="text" required value={teacher.id} onChange={e => setTeacher({ ...teacher, id: e.target.value.replace(/\D/g, '') })} className="w-full px-6 py-4 bg-[#F1F1F1] border-2 border-[#D9D9D9] rounded-2xl focus:border-[#24157A] outline-none font-mono" maxLength={12} />
              </div>
            )}
            
            <div className="space-y-4 bg-[#F1F1F1] p-6 rounded-3xl border border-[#D9D9D9]">
              <label className="text-xs font-bold text-[#24157A] uppercase tracking-widest block mb-2">Horario de Trabajo</label>
              {Object.entries(teacher?.schedule || {}).map(([day, data]: [string, any]) => (
                <div key={day} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={data.enabled} onChange={e => setTeacher({ ...teacher, schedule: { ...teacher.schedule, [day]: { ...data, enabled: e.target.checked } } })} className="w-5 h-5 rounded text-[#24157A]" />
                      <span className="font-bold text-slate-700 uppercase text-xs">{DAY_LABELS[day]}</span>
                    </div>
                    {data.enabled && (
                      <button type="button" onClick={() => { 
                        const currentSlots = data.slots || [];
                        setTeacher({ ...teacher, schedule: { ...teacher.schedule, [day]: { ...data, slots: [...currentSlots, { start: '07:45', end: '14:05' }] } } });
                      }} className="text-[10px] font-bold text-[#24157A] hover:bg-[#F1F1F1] px-2 py-1 rounded-lg transition-colors">+ Bloque</button>
                    )}
                  </div>

                  {data.enabled && (data.slots || []).map((slot: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 pt-2 border-t border-gray-50">
                      <div className="grid grid-cols-2 gap-2 flex-1">
                        <input type="time" value={slot.start} onChange={e => {
                          const newSlots = [...data.slots]; newSlots[idx].start = e.target.value;
                          setTeacher({ ...teacher, schedule: { ...teacher.schedule, [day]: { ...data, slots: newSlots } } });
                        }} className="text-xs p-2 bg-gray-50 rounded-lg border-none" />
                        <input type="time" value={slot.end} onChange={e => {
                          const newSlots = [...data.slots]; newSlots[idx].end = e.target.value;
                          setTeacher({ ...teacher, schedule: { ...teacher.schedule, [day]: { ...data, slots: newSlots } } });
                        }} className="text-xs p-2 bg-gray-50 rounded-lg border-none" />
                      </div>
                      <button type="button" onClick={() => { 
                        const newSlots = data.slots.filter((_: any, i: number) => i !== idx);
                        setTeacher({ ...teacher, schedule: { ...teacher.schedule, [day]: { ...data, slots: newSlots } } });
                      }} className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-widest px-1">Especialidad o Cargo</label>
              <input type="text" required value={teacher.specialty} onChange={e => setTeacher({ ...teacher, specialty: e.target.value })} className="w-full px-6 py-4 bg-[#F1F1F1] border-2 border-[#D9D9D9] rounded-2xl focus:border-[#24157A] outline-none" />
            </div>
          </div>
          <div className="p-8 pt-4 border-t border-gray-50 bg-white">
            <button type="submit" className="w-full bg-[#24157A] text-white py-5 rounded-2xl font-black text-lg shadow-xl hover:bg-[#2E1A8A] transition-all">{isEdit ? 'Guardar Cambios' : 'Guardar Docente'}</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};