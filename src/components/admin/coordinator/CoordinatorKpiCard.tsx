import React from 'react';
import { ChevronRight } from 'lucide-react';

interface CoordinatorKpiCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  onClick?: () => void;
}

const CoordinatorKpiCard = ({ title, value, icon: Icon, onClick }: CoordinatorKpiCardProps) => (
  <div 
    className={`bg-slate-900 p-5 rounded-xl border border-slate-800 flex items-center gap-4 transition-all duration-200 ${
      onClick ? 'cursor-pointer hover:border-slate-600 hover:bg-slate-800/50 group' : ''
    }`}
    onClick={onClick}
  >
    <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700">
      <Icon className="w-6 h-6 text-slate-400" />
    </div>
    <div className="flex-1">
      <div className="text-3xl font-bold text-white">{value}</div>
      <div className="text-sm text-slate-500">{title}</div>
    </div>
    {onClick && (
      <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-slate-400 transition-colors" />
    )}
  </div>
);

export default CoordinatorKpiCard;