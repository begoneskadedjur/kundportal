import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

interface AdminDashboardCardProps {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
  tag?: string;
  stats?: string;
  iconColor?: string;
  disabled?: boolean;
}

export default function AdminDashboardCard({ 
  href, 
  icon: Icon, 
  title, 
  description,
  tag,
  stats,
  iconColor = 'text-[#20c58f]',
  disabled = false
}: AdminDashboardCardProps) {
  const content = (
    <div className={`h-full bg-slate-900 p-6 rounded-xl border border-slate-800 ${
      !disabled ? 'hover:border-[#20c58f]/50 hover:bg-slate-800/40 transition-all duration-300 transform hover:-translate-y-1' : 'opacity-50'
    } flex flex-col`}>
      <div className="flex justify-between items-start">
        <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-lg">
          <Icon className={`w-7 h-7 ${iconColor}`} />
        </div>
        {tag && (
          <span className={`${
            disabled ? 'bg-slate-700/20 text-slate-500' : 'bg-[#20c58f]/10 text-[#20c58f]'
          } text-xs font-bold px-3 py-1 rounded-full`}>
            {tag}
          </span>
        )}
      </div>
      <div className="mt-4 flex-grow">
        <h3 className="text-xl font-bold text-white">{title}</h3>
        <p className="mt-2 text-slate-400">{description}</p>
        {stats && (
          <p className="mt-2 text-sm text-slate-500">{stats}</p>
        )}
      </div>
      {!disabled && (
        <div className="mt-5 text-sm font-medium text-[#20c58f] flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          Öppna verktyg <ArrowRight size={16} />
        </div>
      )}
    </div>
  );

  if (disabled) {
    return (
      <div className="block h-full cursor-not-allowed">
        {content}
      </div>
    );
  }

  return (
    <Link 
      to={href} 
      className="group block h-full focus:outline-none focus:ring-2 focus:ring-[#20c58f] focus:ring-offset-2 focus:ring-offset-slate-950 rounded-xl"
      aria-label={`Öppna ${title} - ${description}`}
    >
      {content}
    </Link>
  );
}