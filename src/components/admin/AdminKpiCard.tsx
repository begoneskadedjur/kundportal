import React from 'react';
import { ChevronRight } from 'lucide-react';

interface AdminKpiCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  onClick?: () => void;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

const AdminKpiCard = ({ title, value, icon: Icon, onClick, trend, trendValue }: AdminKpiCardProps) => (
  <div 
    className={`bg-slate-900 p-5 rounded-xl border border-slate-800 flex items-center gap-4 transition-all duration-200 ${
      onClick ? 'cursor-pointer hover:border-slate-600 hover:bg-slate-800/50 group' : ''
    }`}
    onClick={onClick}
  >
    <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700">
      <Icon className="w-6 h-6 text-[#20c58f]" />
    </div>
    <div className="flex-1">
      <div className="text-3xl font-bold text-white">{value}</div>
      <div className="text-sm text-slate-500">{title}</div>
      {trend && trendValue && (
        <div className={`text-xs mt-1 ${
          trend === 'up' ? 'text-green-400' : 
          trend === 'down' ? 'text-red-400' : 
          'text-slate-400'
        }`}>
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
        </div>
      )}
    </div>
    {onClick && (
      <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-slate-400 transition-colors" />
    )}
  </div>
);

export default AdminKpiCard;