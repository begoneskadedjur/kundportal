// src/components/shared/specialReports/CaseSpecialReportsSection.tsx
// Specialrapporter i ärendemodalens Utförande-flik: befintliga rapporter för
// ärendet och en ikonknapp som skapar en ny, förvald med ärendet.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../icons/Icon'
import { SpecialReportService } from '../../../services/specialReportService'
import type { SpecialReportListItem } from '../../../types/specialReport'
import NewSpecialReportModal from './NewSpecialReportModal'
import { IKON_KNAPP_LATT, STATUS_FARG, rapportStatus, useSpecialReportBase } from './specialReportUtils'

interface CaseSpecialReportsSectionProps {
  caseId: string
  caseNumber?: string | null
}

export default function CaseSpecialReportsSection({ caseId, caseNumber }: CaseSpecialReportsSectionProps) {
  const base = useSpecialReportBase()
  const [rapporter, setRapporter] = useState<SpecialReportListItem[]>([])
  const [visaNy, setVisaNy] = useState(false)

  useEffect(() => {
    let aktuell = true
    SpecialReportService.list()
      .then(lista => { if (aktuell) setRapporter(lista.filter(r => r.case_id === caseId)) })
      .catch(() => { /* listan är ett tillägg i modalen, tyst vid fel */ })
    return () => { aktuell = false }
  }, [caseId])

  return (
    <section className="p-3 rounded-xl border bg-slate-800/30 border-slate-700">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-white">
          <Icon name="rapport.rapport" size={16} className="text-[#20c58f]" />
          Specialrapport
        </h3>
        <button
          type="button"
          onClick={() => setVisaNy(true)}
          aria-label="Skapa specialrapport"
          title="Skapa specialrapport"
          className={IKON_KNAPP_LATT}
        >
          <Icon name="allman.plus" size={20} />
        </button>
      </div>
      {rapporter.length === 0 ? (
        <p className="text-xs text-slate-500">En fri rapport med områden, besök och bilder. Skapa en med plusknappen.</p>
      ) : (
        <ul className="mt-1 space-y-1.5">
          {rapporter.map(r => {
            const s = rapportStatus(r)
            return (
              <li key={r.id}>
                <Link
                  to={`${base}/${r.id}`}
                  className="flex min-h-[44px] items-center gap-2.5 rounded-lg border border-slate-700/50 bg-slate-800/20 px-3 py-2 hover:border-[#20c58f]/60"
                >
                  <span className={`h-2 w-2 flex-shrink-0 rounded-full ${STATUS_FARG[s].punkt}`} />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{r.title}</span>
                  <span className="text-xs text-slate-500">version {r.current_version}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      <NewSpecialReportModal
        isOpen={visaNy}
        onClose={() => setVisaNy(false)}
        initialQuery={caseNumber ?? ''}
        initialCaseId={caseId}
      />
    </section>
  )
}
