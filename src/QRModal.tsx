import React from 'react';
import { motion } from 'motion/react';
import { X, QrCode, GraduationCap, Printer, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface QRModalProps {
  entity: any;
  type: 'docente' | 'estudiante';
  onClose: () => void;
  onDownload: () => void;
}

export const QRModal: React.FC<QRModalProps> = ({ 
  entity, type, onClose, onDownload 
}) => {
  if (!entity) return null;
  const isDocente = type === 'docente';
  
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="bg-white rounded-[3rem] p-12 w-full max-w-sm relative z-10 shadow-2xl text-center">
        <button onClick={onClose} className="absolute top-8 right-8 p-2 hover:bg-gray-100 rounded-full transition-colors text-slate-400"><X size={24} /></button>
        <div className="mb-8">
          <div className={`w-20 h-20 ${isDocente ? 'bg-[#24157A]' : 'bg-[#59C65B]'} rounded-3xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl`}>
            {isDocente ? <QrCode size={40} /> : <GraduationCap size={40} />}
          </div>
          <h2 className="text-2xl font-black text-slate-800 leading-tight">{entity.first_name}<br/>{entity.last_name}</h2>
          <p className="text-sm font-bold text-[#24157A] mt-2">{isDocente ? entity.specialty : entity.grade_section}</p>
          <p className="text-xs font-mono text-slate-400 mt-1 uppercase tracking-widest">{entity.id}</p>
        </div>
        <div className="bg-white p-6 rounded-[2.5rem] border-4 border-slate-50 inline-block mb-10 shadow-inner">
          <QRCodeSVG id="teacher-qr-code" value={entity.id} size={200} level="H" includeMargin={true} />
        </div>
        <div className="flex flex-col gap-3">
          <button onClick={() => window.print()} className="w-full bg-slate-100 text-slate-900 py-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-slate-200 transition-all shadow-sm">
            <Printer size={20} /> Imprimir Código
          </button>
          <button onClick={onDownload} className="w-full bg-[#24157A] text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-[#2E1A8A] transition-all shadow-lg">
            <Download size={20} /> Descargar Imagen
          </button>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-4">Este código es personal e intransferible</p>
        </div>
      </motion.div>
    </div>
  );
};