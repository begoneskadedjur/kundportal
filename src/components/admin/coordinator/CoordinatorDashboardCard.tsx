import React from 'react';
// ✅ ÄNDRING: Importerar nu Link från 'react-router-dom' istället för 'next/link'
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

interface CoordinatorDashboardCardProps {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
  tag?: string;
}

export default function CoordinatorDashboardCard({ 
  href, 
  icon: Icon, 
  title, 
  description,
  tag
}: CoordinatorDashboardCardProps) {
  return (
    // ✅ ÄNDRING: Använder "to" istället för "href" och har tagit bort den onödiga <a>-taggen.
    // ClassName flyttas direkt till Link-komponenten.
    <Link 
      to={href} 
      className="group block h-full focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-950 rounded-xl"
      aria-label={`Öppna ${title} - ${description}`}
    >
      <div className="h-full bg-slate-900 p-6 rounded-xl border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-800/40 transition-all duration-300 transform hover:-translate-y-1 flex flex-col">
        <div className="flex justify-between items-start">
          <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-lg">
            <Icon className="w-7 h-7 text-emerald-400" />
          </div>
          {tag && (
            <span className="bg-emerald-500/10 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full">
              {tag}
            </span>
          )}
        </div>
        <div className="mt-4 flex-grow">
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <p className="mt-2 text-slate-400">{description}</p>
        </div>
        <div className="mt-5 text-sm font-medium text-emerald-400 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          Öppna verktyg <ArrowRight size={16} />
        </div>
      </div>
    </Link>
  );
}