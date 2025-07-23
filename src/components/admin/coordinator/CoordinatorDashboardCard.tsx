import React from 'react';
import Link from 'next/link'; // Använder Next.js <Link>, byt om du använder en annan router
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
    <Link href={href} passHref>
      <a className="group block h-full">
        <div className="h-full bg-slate-900 p-6 rounded-xl border border-slate-800 hover:border-blue-500/50 hover:bg-slate-800/40 transition-all duration-300 transform hover:-translate-y-1 flex flex-col">
          <div className="flex justify-between items-start">
            <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-lg">
              <Icon className="w-7 h-7 text-blue-400" />
            </div>
            {tag && (
              <span className="bg-blue-500/10 text-blue-400 text-xs font-bold px-3 py-1 rounded-full">
                {tag}
              </span>
            )}
          </div>
          <div className="mt-4 flex-grow">
            <h3 className="text-xl font-bold text-white">{title}</h3>
            <p className="mt-2 text-slate-400">{description}</p>
          </div>
          <div className="mt-5 text-sm font-medium text-blue-400 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            Öppna verktyg <ArrowRight size={16} />
          </div>
        </div>
      </a>
    </Link>
  );
}