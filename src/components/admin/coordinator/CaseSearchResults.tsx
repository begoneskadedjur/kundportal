// 📁 src/components/admin/coordinator/CaseSearchResults.tsx
// ⭐ Sökresultatkomponent för koordinatorns dashboard ⭐

import React from 'react';
import { BeGoneCaseRow } from '../../../types/database';
import { User, MapPin, AlertCircle, Calendar, DollarSign, Users, Building2, Clock } from 'lucide-react';
import { formatCurrency, formatDate } from '../../../utils/formatters';

interface CaseSearchResultsProps {
  results: BeGoneCaseRow[];
  onCaseClick: (caseData: BeGoneCaseRow) => void;
  loading?: boolean;
}

const formatAddress = (address: any): string => {
  if (!address) return 'Adress saknas';
  if (typeof address === 'string') {
    try {
      const parsed = JSON.parse(address);
      return parsed.formatted_address || address;
    } catch (e) { 
      return address; 
    }
  }
  return address.formatted_address || 'Adress saknas';
};

const getStatusColor = (status: string): string => {
  const ls = status?.toLowerCase() || '';
  if (ls.includes('avslutat')) return 'bg-green-500/20 text-green-400 border-green-500/40';
  if (ls.startsWith('återbesök')) return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
  if (ls.includes('bokad') || ls.includes('bokat') || ls.includes('signerad')) return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
  if (ls.includes('öppen') || ls.includes('offert')) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
  if (ls.includes('review')) return 'bg-purple-500/20 text-purple-400 border-purple-500/40';
  if (ls.includes('stängt')) return 'bg-slate-600/50 text-slate-400 border-slate-600/50';
  return 'bg-slate-500/20 text-slate-400 border-slate-500/40';
};

const getCaseTypeIcon = (caseType: string) => {
  if (caseType === 'private') return <User className="w-4 h-4 text-blue-400" />;
  if (caseType === 'business') return <Building2 className="w-4 h-4 text-green-400" />;
  return <Clock className="w-4 h-4 text-purple-400" />;
};

const CaseSearchResultItem: React.FC<{ caseData: BeGoneCaseRow; onClick: () => void }> = ({ caseData, onClick }) => {
  const { 
    title, 
    kontaktperson, 
    adress, 
    skadedjur, 
    status, 
    case_type,
    start_date,
    due_date,
    pris,
    primary_assignee_name,
    secondary_assignee_name,
    tertiary_assignee_name
  } = caseData;

  const fullAddress = formatAddress(adress);
  const statusColorClass = getStatusColor(status);
  const price = pris || (caseData as any).case_price || 0;
  
  // Samla alla tekniker
  const assignees = [primary_assignee_name, secondary_assignee_name, tertiary_assignee_name]
    .filter(Boolean)
    .join(', ');

  const displayDate = due_date ? formatDate(due_date) : (start_date ? formatDate(start_date) : 'Inget datum');

  return (
    <div 
      onClick={onClick} 
      className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg hover:bg-slate-800/70 hover:border-slate-600 transition-all cursor-pointer"
    >
      {/* Header med titel och status */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {getCaseTypeIcon(case_type)}
          <h4 className="font-semibold text-white text-sm truncate">{title}</h4>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusColorClass} ml-2 whitespace-nowrap`}>
          {status}
        </span>
      </div>

      {/* Detaljer grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
        {/* Vänster kolumn */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <User className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="truncate">{kontaktperson || 'Kontaktperson saknas'}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="truncate">{fullAddress}</span>
          </div>
          
          {skadedjur && (
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3 h-3 text-slate-500 shrink-0" />
              <span className="truncate">{skadedjur}</span>
            </div>
          )}
        </div>

        {/* Höger kolumn */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
            <span>{displayDate}</span>
          </div>
          
          {price > 0 && (
            <div className="flex items-center gap-2">
              <DollarSign className="w-3 h-3 text-slate-500 shrink-0" />
              <span className="font-medium text-green-400">{formatCurrency(price)}</span>
            </div>
          )}
          
          {assignees && (
            <div className="flex items-center gap-2">
              <Users className="w-3 h-3 text-slate-500 shrink-0" />
              <span className="truncate text-blue-300">{assignees}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function CaseSearchResults({ results, onCaseClick, loading }: CaseSearchResultsProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-4 bg-slate-800/30 border border-slate-700 rounded-lg animate-pulse">
            <div className="h-4 bg-slate-700 rounded w-3/4 mb-3"></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="h-3 bg-slate-700 rounded w-full"></div>
                <div className="h-3 bg-slate-700 rounded w-5/6"></div>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-slate-700 rounded w-4/5"></div>
                <div className="h-3 bg-slate-700 rounded w-3/5"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-8 px-4 bg-slate-800/30 rounded-lg border border-dashed border-slate-700">
        <AlertCircle className="mx-auto w-8 h-8 text-slate-600 mb-2" />
        <h3 className="text-sm font-semibold text-slate-300">Inga resultat</h3>
        <p className="text-xs text-slate-500">Försök med andra söktermer.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto">
      {results.map(caseData => (
        <CaseSearchResultItem 
          key={caseData.id} 
          caseData={caseData} 
          onClick={() => onCaseClick(caseData)} 
        />
      ))}
      {results.length >= 15 && (
        <div className="text-center py-2 px-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-xs text-blue-400">
            Visar första 15 resultaten. Förfina sökningen för fler träffar.
          </p>
        </div>
      )}
    </div>
  );
}