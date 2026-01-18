// src/pages/shared/Larosate.tsx
// BeGone Lärosäte - Internt kunskapscenter för alla anställda

import { useState, useMemo } from 'react';
import { GraduationCap, BookOpen, Search as SearchIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { guides, filterGuides, type GuideCategory } from '../../components/larosate/guideData';
import GuideCard from '../../components/larosate/GuideCard';
import CategoryFilter from '../../components/larosate/CategoryFilter';
import GuideSearch from '../../components/larosate/GuideSearch';

export default function Larosate() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<GuideCategory | 'all'>('all');

  // Filtrera guider baserat på sök och kategori
  const filteredGuides = useMemo(
    () => filterGuides(searchTerm, selectedCategory),
    [searchTerm, selectedCategory]
  );

  // Beräkna antal guider per kategori
  const categoryCounts = useMemo(() => {
    const counts: Record<GuideCategory | 'all', number> = {
      all: guides.length,
      communication: guides.filter(g => g.category === 'communication').length,
      cases: guides.filter(g => g.category === 'cases').length,
      equipment: guides.filter(g => g.category === 'equipment').length,
    };
    return counts;
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                BeGone Lärosäte
              </h1>
              <p className="text-slate-400 text-sm sm:text-base">
                Guider och instruktioner för alla system
              </p>
            </div>
          </div>
        </motion.div>

        {/* Sökfält */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <GuideSearch
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Sök bland guider..."
          />
        </motion.div>

        {/* Kategori-filter */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-6"
        >
          <CategoryFilter
            selected={selectedCategory}
            onChange={setSelectedCategory}
            counts={categoryCounts}
          />
        </motion.div>

        {/* Resultat-info */}
        {(searchTerm || selectedCategory !== 'all') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-4 text-sm text-slate-500"
          >
            Visar {filteredGuides.length} av {guides.length} guider
            {searchTerm && <span> för "{searchTerm}"</span>}
          </motion.div>
        )}

        {/* Guide-lista */}
        {filteredGuides.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
            {filteredGuides.map((guide, index) => (
              <GuideCard key={guide.id} guide={guide} index={index} />
            ))}
          </div>
        ) : (
          // Tom-tillstånd
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-800/50 flex items-center justify-center">
              <SearchIcon className="w-8 h-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              Inga guider hittades
            </h3>
            <p className="text-slate-400 max-w-sm mx-auto">
              Försök med en annan sökterm eller välj en annan kategori.
            </p>
            {(searchTerm || selectedCategory !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                }}
                className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700
                           text-slate-300 rounded-lg transition-colors"
              >
                Rensa filter
              </button>
            )}
          </motion.div>
        )}

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-12 pt-6 border-t border-slate-700/50 text-center"
        >
          <div className="flex items-center justify-center gap-2 text-slate-500 text-sm mb-2">
            <BookOpen className="w-4 h-4" />
            <span>{guides.length} guider tillgängliga</span>
          </div>
          <p className="text-sm text-slate-600">
            Hittar du inte det du söker? Kontakta IT-support för hjälp.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
