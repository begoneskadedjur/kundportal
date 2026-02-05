import { ChevronRight, User, Building2, FileText } from 'lucide-react';

interface CaseLinkProps {
  caseType: 'private' | 'business' | 'contract';
  caseId: string;
  title: string;
  onClick: () => void;
}

export function CaseLink({ caseType, caseId, title, onClick }: CaseLinkProps) {
  const config = {
    private: {
      icon: User,
      label: 'Privat',
      bgColor: 'bg-blue-600 hover:bg-blue-700',
      borderColor: 'border-blue-500/50'
    },
    business: {
      icon: Building2,
      label: 'Företag',
      bgColor: 'bg-purple-600 hover:bg-purple-700',
      borderColor: 'border-purple-500/50'
    },
    contract: {
      icon: FileText,
      label: 'Avtal',
      bgColor: 'bg-emerald-600 hover:bg-emerald-700',
      borderColor: 'border-emerald-500/50'
    }
  };

  const { icon: Icon, label, bgColor, borderColor } = config[caseType];

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-1.5
                 ${bgColor} text-white text-sm rounded-lg
                 transition-colors border ${borderColor}
                 hover:shadow-lg hover:shadow-black/20`}
      title={`Öppna ${label.toLowerCase()}ärende: ${title}`}
    >
      <Icon className="w-4 h-4" />
      <span className="max-w-[200px] truncate">{title}</span>
      <ChevronRight className="w-4 h-4 opacity-50" />
    </button>
  );
}

// Utility function to parse CASE links from text
export function parseCaseLinks(text: string): Array<{
  fullMatch: string;
  caseType: 'private' | 'business' | 'contract';
  caseId: string;
  title: string;
  startIndex: number;
  endIndex: number;
}> {
  const caseRegex = /\[CASE\|([^|]+)\|([^|]+)\|([^\]]+)\]/g;
  const matches: Array<{
    fullMatch: string;
    caseType: 'private' | 'business' | 'contract';
    caseId: string;
    title: string;
    startIndex: number;
    endIndex: number;
  }> = [];

  let match;
  while ((match = caseRegex.exec(text)) !== null) {
    const type = match[1] as 'private' | 'business' | 'contract';
    if (['private', 'business', 'contract'].includes(type)) {
      matches.push({
        fullMatch: match[0],
        caseType: type,
        caseId: match[2],
        title: match[3],
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }
  }

  return matches;
}
