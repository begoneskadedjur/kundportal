// src/components/larosate/CategoryFilter.tsx
// Kategori-filter för BeGone Lärosäte

import { motion } from 'framer-motion';
import { categories, type GuideCategory } from './guideData';

interface CategoryFilterProps {
  selected: GuideCategory | 'all';
  onChange: (category: GuideCategory | 'all') => void;
  counts: Record<GuideCategory | 'all', number>;
}

export default function CategoryFilter({ selected, onChange, counts }: CategoryFilterProps) {
  const allCategories: { id: GuideCategory | 'all'; label: string; color: string; bgColor: string }[] = [
    { id: 'all', label: 'Alla', color: 'text-slate-400', bgColor: 'bg-slate-500/20' },
    ...categories
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap scrollbar-hide">
      {allCategories.map((cat) => {
        const isActive = selected === cat.id;
        const count = counts[cat.id];

        return (
          <motion.button
            key={cat.id}
            onClick={() => onChange(cat.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                       whitespace-nowrap transition-all flex-shrink-0
                       ${isActive
                         ? `${cat.bgColor} ${cat.color} ring-1 ring-current`
                         : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                       }`}
            whileTap={{ scale: 0.97 }}
          >
            <span>{cat.label}</span>
            <span className={`px-1.5 py-0.5 rounded text-xs font-bold
                           ${isActive ? 'bg-white/10' : 'bg-slate-700/50'}`}>
              {count}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
