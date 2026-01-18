// src/components/larosate/GuideCard.tsx
// Återanvändbart guide-kort för BeGone Lärosäte

import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Guide } from './guideData';

interface GuideCardProps {
  guide: Guide;
  index?: number;
}

export default function GuideCard({ guide, index = 0 }: GuideCardProps) {
  const Icon = guide.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
    >
      <Link
        to={guide.path}
        className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/50 hover:bg-slate-800
                   border border-slate-700/50 hover:border-slate-600
                   transition-all duration-200 group min-h-[88px]"
      >
        {/* Ikon */}
        <div className={`w-12 h-12 rounded-xl ${guide.iconBgColor} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-6 h-6 ${guide.iconColor}`} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-white group-hover:text-emerald-400 transition-colors">
              {guide.title}
            </h3>
            {guide.isNew && (
              <span className="px-2 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded-full">
                Ny
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 line-clamp-2 mt-0.5">
            {guide.description}
          </p>
        </div>

        {/* Pil */}
        <ChevronRight
          className="w-5 h-5 text-slate-500 group-hover:text-emerald-400
                     group-hover:translate-x-1 transition-all flex-shrink-0"
        />
      </Link>
    </motion.div>
  );
}
