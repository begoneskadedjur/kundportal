import React from 'react';

interface CoordinatorKpiCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
}

const CoordinatorKpiCard = ({ title, value, icon: Icon }: CoordinatorKpiCardProps) => (
  <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 flex items-center gap-4">
    <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700">
      <Icon className="w-6 h-6 text-slate-400" />
    </div>
    <div>
      <div className="text-3xl font-bold text-white">{value}</div>
      <div className="text-sm text-slate-500">{title}</div>
    </div>
  </div>
);

export default CoordinatorKpiCard;