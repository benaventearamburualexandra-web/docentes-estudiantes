import React from 'react';
import { motion } from 'motion/react';
import { Users, TrendingUp, TrendingDown, Calendar } from 'lucide-react';

interface StatsPanelProps {
  stats: any;
  MiniBarChart: React.FC<{ data: number[], color: string }>;
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ stats, MiniBarChart }) => {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">Panel de Control</h2>
          <p className="text-white/80 font-medium">Estadísticas generales del sistema</p>
        </div>
        <div className="bg-white/20 px-4 py-2 rounded-2xl backdrop-blur-md border border-white/30 text-white flex items-center gap-2">
          <Calendar size={18} />
          <span className="font-bold">{new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long' })}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card Miembros */}
        <div className="bg-white p-6 rounded-[2rem] border border-[#D9D9D9] shadow-sm">
          <div className="w-12 h-12 bg-[#24157A] rounded-2xl flex items-center justify-center text-white mb-4">
            <Users size={24} />
          </div>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-wider">Miembros Activos</p>
          <h3 className="text-4xl font-black text-[#24157A] mt-1">{stats.totalMembers}</h3>
          <p className="text-[10px] text-slate-400 mt-2 font-bold">DOCENTES Y ESTUDIANTES</p>
          <MiniBarChart data={stats.trends.activeUsers} color="#24157A" />
        </div>

        {/* Card Eventos */}
        <div className="bg-white p-6 rounded-[2rem] border border-[#D9D9D9] shadow-sm">
          <div className="w-12 h-12 bg-[#59C65B] rounded-2xl flex items-center justify-center text-white mb-4">
            <TrendingUp size={24} />
          </div>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-wider">Eventos Totales</p>
          <h3 className="text-4xl font-black text-[#59C65B] mt-1">{stats.totalEvents}</h3>
          <p className="text-[10px] text-slate-400 mt-2 font-bold">CONTABILIZADOS</p>
          <MiniBarChart data={stats.trends.events} color="#59C65B" />
        </div>

        {/* Card Puntualidad */}
        <div className="bg-white p-6 rounded-[2rem] border border-[#D9D9D9] shadow-sm">
          <div className="w-12 h-12 bg-[#9A87E8] rounded-2xl flex items-center justify-center text-white mb-4">
            <TrendingUp size={24} />
          </div>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-wider">Tasa Puntualidad</p>
          <h3 className="text-4xl font-black text-[#24157A] mt-1">{stats.punctualityRate}%</h3>
          <p className="text-[10px] text-emerald-500 mt-2 font-bold">REGISTROS A TIEMPO</p>
          <MiniBarChart data={stats.trends.punctuality} color="#9A87E8" />
        </div>

        {/* Card Faltas */}
        <div className="bg-white p-6 rounded-[2rem] border border-[#D9D9D9] shadow-sm">
          <div className="w-12 h-12 bg-[#F4CD18] rounded-2xl flex items-center justify-center text-[#24157A] mb-4">
            <TrendingDown size={24} />
          </div>
          <p className="text-slate-500 font-bold text-xs uppercase tracking-wider">Tasa de Faltas</p>
          <h3 className="text-4xl font-black text-[#24157A] mt-1">{stats.absenceRate}%</h3>
          <p className="text-[10px] text-rose-500 mt-2 font-bold">PROMEDIO MENSUAL</p>
          <MiniBarChart data={stats.trends.absences} color="#F4CD18" />
        </div>
      </div>
    </motion.div>
  );
};