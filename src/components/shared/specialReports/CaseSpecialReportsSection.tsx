// src/components/shared/specialReports/CaseSpecialReportsSection.tsx
// Specialrapporter i ärendemodalerna (3.56.0): ärendets rapporter med status,
// senaste utskick, omfång och två ikonknappar (ladda ner PDF, öppna rapporten),
// plus en ikonknapp som skapar en ny rapport förvald med ärendet.
// readOnly (admins kundkort) visar listan utan plusknapp.
// Osparade ändringar i ärendet frågas om innan rapporten öppnas, eftersom
// navigeringen stänger ärendemodalen.

import { useCallback, useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import Modal from '../../ui/Modal'
import { Icon } from '../../icons/Icon'
import { SpecialReportService } from '../../../services/specialReportService'
import type { SpecialReportCaseType, SpecialReportListItem } from '../../../types/specialReport'
import NewSpecialReportModal from './NewSpecialReportModal'
import {
  IKON_KNAPP_LATT,
  PRIMAR_KNAPP,
  SEKUNDAR_KNAPP,
  STATUS_FARG,
  datumAv,
  laddaNed,
  rapportStatus,
  useSpecialReportBase,
  type RapportStatus,
} from './specialReportUtils'

/** Ärendemodalens osparade ändringar, frågas om innan rapporten öppnas */
export interface OsparatIArendet {
  /** Finns det ändringar i formuläret som inte sparats */
  finns: () => boolean
  /** Spara ärendet. Sant om sparningen gick igenom */
  spara: () => Promise<boolean>
}

/** Det som skickas med till redigeraren så att tillbaka leder hit igen */
export interface SpecialReportTillbaka {
  pathname: string
  caseId?: string
  caseType?: SpecialReportCaseType
}

interface CaseSpecialReportsSectionProps {
  caseId: string
  caseType: SpecialReportCaseType
  caseNumber?: string | null
  /** Bara läsning: ingen plusknapp, öppna och PDF fungerar */
  readOnly?: boolean
  osparat?: OsparatIArendet
}

const STATUS_ORD: Record<RapportStatus, string> = {
  skickad: 'Skickad',
  pagar: 'Ändrad sedan utskicket',
  utkast: 'Utkast',
}

/** Brandgrön ikonknapp utan ram, minst 44 px (samma mått som IKON_KNAPP_LATT) */
const OPPNA_KNAPP =
  'inline-flex items-center justify-center w-11 h-11 flex-shrink-0 rounded-lg text-[#20c58f] hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]/60'

function antal(n: number, en: string, flera: string): string {
  return `${n} ${n === 1 ? en : flera}`
}

/** "anna@brf.se" eller "anna@brf.se och 2 till" */
function mottagare(lista: string[]): string {
  if (lista.length === 0) return ''
  return lista.length === 1 ? lista[0] : `${lista[0]} och ${lista.length - 1} till`
}

function andradAv(r: SpecialReportListItem): string {
  return `ändrad ${datumAv(r.updated_at)}${r.updated_by_name ? ` av ${r.updated_by_name}` : ''}`
}

function detaljer(r: SpecialReportListItem, s: RapportStatus): string {
  const skickad = datumAv(r.last_sent_at)
  if (s === 'skickad') {
    const till = mottagare(r.last_sent_to)
    return till ? `version ${r.last_sent_version} till ${till} ${skickad}` : `version ${r.last_sent_version} skickad ${skickad}`
  }
  if (s === 'pagar') return `version ${r.last_sent_version} skickad ${skickad}, ${andradAv(r)}`
  return andradAv(r)
}

function pdfEtikett(r: SpecialReportListItem, s: RapportStatus): string {
  if (s === 'skickad') return `Ladda ner PDF, version ${r.last_sent_version}`
  if (s === 'pagar') return 'Ladda ner PDF med ändringarna'
  return 'Ladda ner utkastet som PDF'
}

/** Samma filnamn som servern ger (utan tecken som inte tål filsystemet) */
function filnamn(titel: string, version: number | null): string {
  const namn = titel.replace(/[/\\:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() || 'Rapport'
  return `${namn}, version ${version ?? 1}.pdf`
}

export default function CaseSpecialReportsSection({
  caseId,
  caseType,
  caseNumber,
  readOnly = false,
  osparat,
}: CaseSpecialReportsSectionProps) {
  const base = useSpecialReportBase()
  const location = useLocation()
  const navigate = useNavigate()
  const [rapporter, setRapporter] = useState<SpecialReportListItem[] | null>(null)
  const [laddningsfel, setLaddningsfel] = useState(false)
  const [visaNy, setVisaNy] = useState(false)
  const [hamtarPdf, setHamtarPdf] = useState<string | null>(null)
  const [fraga, setFraga] = useState<string | null>(null)
  const [sparar, setSparar] = useState(false)

  const hamta = useCallback(async () => {
    try {
      const lista = await SpecialReportService.listForCase(caseId, caseType)
      setRapporter(lista)
      setLaddningsfel(false)
    } catch {
      setLaddningsfel(true)
      setRapporter(prev => prev ?? [])
    }
  }, [caseId, caseType])

  useEffect(() => {
    setRapporter(null)
    void hamta()
  }, [hamta])

  // Tillbaka i fliken (t.ex. efter en rapport i en annan flik): hämta om
  useEffect(() => {
    const vidSynlig = () => {
      if (document.visibilityState === 'visible') void hamta()
    }
    document.addEventListener('visibilitychange', vidSynlig)
    return () => document.removeEventListener('visibilitychange', vidSynlig)
  }, [hamta])

  // Läsvyn (kundkortet) öppnar inget ärende vid tillbaka, den visar bara sidan igen
  const tillbaka: SpecialReportTillbaka = readOnly
    ? { pathname: location.pathname + location.search }
    : { pathname: location.pathname + location.search, caseId, caseType }
  const mal = (id: string) => `${base}/${id}`

  const oppna = (id: string) => navigate(mal(id), { state: { tillbaka } })

  // Länkarna navigerar själva, utom när ärendet har osparade ändringar
  const vidLank = (e: MouseEvent<HTMLAnchorElement>, id: string) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (osparat?.finns()) {
      e.preventDefault()
      setFraga(id)
    }
  }

  const sparaOchOppna = async () => {
    if (!fraga || !osparat) return
    setSparar(true)
    try {
      const ok = await osparat.spara()
      if (ok) {
        const id = fraga
        setFraga(null)
        oppna(id)
      }
    } finally {
      setSparar(false)
    }
  }

  const laddaNedPdf = async (r: SpecialReportListItem) => {
    if (hamtarPdf) return
    setHamtarPdf(r.id)
    const s = rapportStatus(r)
    const t = toast.loading('Tar fram PDF:en…')
    try {
      if (s === 'skickad' && r.last_sent_version_id) {
        const url = await SpecialReportService.getVersionPdfUrl(r.last_sent_version_id)
        await laddaNed(url, filnamn(r.title, r.last_sent_version))
      } else {
        const { url, filename } = await SpecialReportService.downloadPdf(r.id)
        await laddaNed(url, filename)
      }
      toast.success('PDF:en är nedladdad', { id: t })
    } catch (e) {
      // Nätverksfel ("Failed to fetch") säger användaren ingenting
      const text = e instanceof Error && e.message && !/fetch|network/i.test(e.message) ? e.message : null
      toast.error(text ?? 'PDF:en kunde inte tas fram. Försök igen om en stund.', { id: t })
    } finally {
      setHamtarPdf(null)
    }
  }

  const plusKnapp = !readOnly && (
    <button
      type="button"
      onClick={() => setVisaNy(true)}
      aria-label="Skapa specialrapport"
      title="Skapa specialrapport"
      className={`${IKON_KNAPP_LATT} -my-2 -mr-2`}
    >
      <Icon name="allman.plus" size={20} />
    </button>
  )

  const rubrik = (
    <h3 className="flex flex-shrink-0 items-center gap-1.5 text-sm font-semibold text-white">
      <Icon name="rapport.rapport" size={16} className="text-[#20c58f]" />
      Specialrapporter
    </h3>
  )

  const tomt = !rapporter || rapporter.length === 0

  return (
    <section className="p-3 rounded-xl border bg-slate-800/30 border-slate-700">
      {tomt ? (
        <div className="flex items-center gap-2">
          {rubrik}
          <p className="min-w-0 flex-1 text-xs leading-snug text-slate-500">
            {rapporter === null
              ? 'Hämtar…'
              : laddningsfel
                ? 'Rapporterna kunde inte hämtas.'
                : 'Ingen än. En fri rapport med delar, händelser och bilder.'}
          </p>
          {plusKnapp}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            {rubrik}
            <span className="text-xs text-slate-500">{rapporter.length}</span>
            <span className="flex-1" />
            {plusKnapp}
          </div>
          <ul className="mt-1.5 divide-y divide-slate-700/60">
            {rapporter.map(r => {
              const s = rapportStatus(r)
              const laddar = hamtarPdf === r.id
              return (
                <li key={r.id} className="flex min-h-[52px] items-center gap-1 py-1">
                  <Link
                    to={mal(r.id)}
                    state={{ tillbaka }}
                    onClick={e => vidLank(e, r.id)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1 pr-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]/60"
                  >
                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${STATUS_FARG[s].punkt}`} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-100">{r.title}</span>
                      <span className="block truncate text-xs text-slate-400">
                        <span className={STATUS_FARG[s].text}>{STATUS_ORD[s]}</span>
                        {' · '}
                        {detaljer(r, s)}
                        {' · '}
                        {antal(r.section_count, 'del', 'delar')}, {antal(r.event_count, 'händelse', 'händelser')}
                      </span>
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => laddaNedPdf(r)}
                    disabled={!!hamtarPdf}
                    aria-label={pdfEtikett(r, s)}
                    title={pdfEtikett(r, s)}
                    aria-busy={laddar}
                    className={IKON_KNAPP_LATT}
                  >
                    {laddar ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon name="rapport.ladda-pdf" size={20} />}
                  </button>
                  <Link
                    to={mal(r.id)}
                    state={{ tillbaka }}
                    onClick={e => vidLank(e, r.id)}
                    aria-label="Öppna rapporten"
                    title="Öppna rapporten"
                    className={OPPNA_KNAPP}
                  >
                    <Icon name="rapport.oppna" size={20} />
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {!readOnly && (
        <NewSpecialReportModal
          isOpen={visaNy}
          onClose={() => setVisaNy(false)}
          initialQuery={caseNumber ?? ''}
          initialCaseId={caseId}
          initialCaseType={caseType}
        />
      )}

      <Modal
        isOpen={!!fraga}
        onClose={() => { if (!sparar) setFraga(null) }}
        title="Osparade ändringar"
        size="sm"
        usePortal
        zIndex={120}
        footer={
          <div className="flex flex-col-reverse gap-2 px-4 py-2.5 sm:flex-row sm:justify-end">
            <button type="button" className={SEKUNDAR_KNAPP} onClick={() => setFraga(null)} disabled={sparar}>
              Avbryt
            </button>
            <button
              type="button"
              className={SEKUNDAR_KNAPP}
              onClick={() => { const id = fraga; setFraga(null); if (id) oppna(id) }}
              disabled={sparar}
            >
              Öppna utan att spara
            </button>
            <button type="button" className={PRIMAR_KNAPP} onClick={sparaOchOppna} disabled={sparar}>
              {sparar && <Loader2 className="h-4 w-4 animate-spin" />}
              Spara och öppna
            </button>
          </div>
        }
      >
        <div className="p-4">
          <p className="text-sm text-slate-300">Du har osparade ändringar i ärendet. Spara först?</p>
        </div>
      </Modal>
    </section>
  )
}
