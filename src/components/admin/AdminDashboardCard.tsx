import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface AdminDashboardCardProps {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
  tag?: string;
  stats?: string;
  iconColor?: string;
  disabled?: boolean;
  delay?: number;
}

export default function AdminDashboardCard({ 
  href, 
  icon: Icon, 
  title, 
  description,
  tag,
  stats,
  iconColor = 'text-[#20c58f]',
  disabled = false,
  delay = 0
}: AdminDashboardCardProps) {
  const content = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: delay,
        ease: "easeOut"
      }}
      className={`h-full bg-slate-900 p-6 rounded-xl border border-slate-800 ${
        !disabled ? 'hover:border-[#20c58f]/50 hover:bg-slate-800/40 transition-all duration-300 hover:shadow-lg hover:shadow-slate-900/20' : 'opacity-50'
      } flex flex-col group`}
      whileHover={!disabled ? { 
        y: -4,
        transition: { duration: 0.2 }
      } : {}}
    >
      <div className="flex justify-between items-start">
        <motion.div 
          className="p-3 bg-slate-800/80 border border-slate-700 rounded-lg"
          whileHover={!disabled ? { 
            scale: 1.05,
            backgroundColor: "rgba(51, 65, 85, 0.9)"
          } : {}}
          transition={{ duration: 0.2 }}
        >
          <Icon className={`w-7 h-7 ${iconColor} transition-colors duration-200 ${!disabled ? 'group-hover:brightness-110' : ''}`} />
        </motion.div>
        {tag && (
          <motion.span 
            className={`${
              disabled ? 'bg-slate-700/20 text-slate-500' : 'bg-[#20c58f]/10 text-[#20c58f]'
            } text-xs font-bold px-3 py-1 rounded-full`}
            whileHover={!disabled ? { scale: 1.05 } : {}}
            transition={{ duration: 0.2 }}
          >
            {tag}
          </motion.span>
        )}
      </div>
      <div className="mt-4 flex-grow">
        <h3 className="text-xl font-bold text-white group-hover:text-slate-100 transition-colors duration-200">{title}</h3>
        <p className="mt-2 text-slate-400 group-hover:text-slate-300 transition-colors duration-200">{description}</p>
        {stats && (
          <p className="mt-2 text-sm text-slate-500 group-hover:text-slate-400 transition-colors duration-200">{stats}</p>
        )}
      </div>
      {!disabled && (
        <motion.div
          className="mt-5 text-sm font-medium text-[#20c58f] flex items-center gap-2"
          initial={{ opacity: 0, x: -10 }}
          whileHover={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          Öppna verktyg 
          <motion.div
            animate={{ x: [0, 3, 0] }}
            transition={{ 
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <ArrowRight size={16} />
          </motion.div>
        </motion.div>
      )}
    </motion.div>
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