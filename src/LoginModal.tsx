import React from 'react';
import { motion } from 'motion/react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  username: string;
  setUsername: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ 
  isOpen, onClose, onSubmit, username, setUsername, password, setPassword 
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-[2.5rem] p-10 w-full max-w-sm shadow-2xl">
        <h2 className="text-2xl font-extrabold mb-6 text-center text-gray-900">Admin Access</h2>
        <form onSubmit={onSubmit} className="space-y-6">
          <input type="text" required value={username} onChange={e => setUsername(e.target.value)} className="w-full px-6 py-4 bg-[#F1F1F1] border-2 border-[#D9D9D9] rounded-2xl outline-none focus:border-[#24157A]" placeholder="Usuario" />
          <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full px-6 py-4 bg-[#F1F1F1] border-2 border-[#D9D9D9] rounded-2xl outline-none focus:border-[#24157A]" placeholder="Contraseña" />
          <button type="submit" className="w-full bg-[#24157A] text-white py-5 rounded-2xl font-black shadow-lg hover:bg-[#2E1A8A] transition-colors">ENTRAR</button>
          <button type="button" onClick={onClose} className="w-full text-slate-600 font-bold text-sm hover:text-slate-800 transition-colors">Cancelar</button>
        </form>
      </motion.div>
    </div>
  );
};