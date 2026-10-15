// src/pages/admin/procurement/BidsBoardPage.tsx
// Anbudstavlan (docs/upphandlingsportal-ux-plan.md avsnitt 2 och 5, etapp 4):
// kolumnerna Bedöms, Anbud pågår, Lämnat och Avgjort med räknare och summa
// årsvärde. Dra kort mellan kolumnerna på dator (inbyggd HTML5 drag and drop,
// inget bibliotek), statusmeny på varje kort (mobil och tangentbord). Släpp i
// Avgjort frågar Vunnen eller Förlorad. Statusbytet går genom updateNotice
// och loggas som händelse, precis som på detaljsidan.
//
// På mobil blir kolumnerna undertabbar och en kolumn visas åt gången.
// Kolumnernas statusar ligger i src/shared/procurementBoard.ts.
//
// Sedan 3.65.0: knappen Ny post skapar en direktupphandling, ett avrop från
// ramavtal eller en offertförfrågan (NewPostDialog). Egna poster visar typen
// med ikon överst på kortet.

import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import LoadingSpinner from '../../../components/shared/LoadingSpinner'
import { Icon } from '../../../components/icons/Icon'
import { ProcurementService, type NoticeWithRelations, type ProcurementManagerProfile } from '../../../services/procurementService'
import { addDaysIso, annualValueOf, swedishDate, todaySwedish } from '../../../shared/procurementRules'
import { BOARD_COLUMNS, BOARD_MENU_STATUSES, BOARD_STATUSES, DECIDED_DAYS, columnOf, needsOutcomeChoice, statusForDrop, type BoardColumnKey } from '../../../shared/procurementBoard'
import { MANUAL_TYPE_ICON, MANUAL_TYPE_LABEL, OUR_STATUS_DOT, OUR_STATUS_LABEL, ourStatusChoice, type ProcurementManualType, type ProcurementOurStatus } from '../../../types/procurement'
import NewPostDialog, { NewPostButton } from '../../../components/admin/procurement/NewPostDialog'
import { useAuth } from '../../../contexts/AuthContext'
import { IconButton, PrimaryButton, SecondaryButton } from '../../../components/admin/procurement/ui'
import StatusMenu from '../../../components/admin/procurement/StatusMenu'
import { daysUntil, fmtDate, fmtKrShort, fmtNum, fmtRelativeDays } from '../../../components/admin/procurement/uiFormat'
import { errMsg, personName } from '../../../components/admin/procurement/detail/helpers'
import { exportXlsx } from '../../../components/admin/procurement/excelExport'
import { noticePath } from '../../../lib/procurementPortal'

const DRAG_TYPE = 'application/x-begone-notice'

function annualOf(n: NoticeWithRelations): number | null {
  return n.annual_value ?? annualValueOf(n.estimated_value, n.duration_months)
}

function daysTone(days: number | null): string {
  if (days == null) return 'text-slate-500'
  if (days < 4) return 'text-red-400'
  if (days < 8) return 'text-amber-400'
  return 'text-slate-500'
}

function initials(name: string): string {
  if (!name || name === '–') return 'Ej satt'
  const parts = name.split(/[\s@.]+/).filter(Boolean)
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
}

/** Kortets fotrad till vänster: dagar kvar, tilldelning väntas eller utfallets datum */
function cardWhen(n: NoticeWithRelations): { text: string; tone: string } {
  const col = columnOf(n.our_status)
  if (col === 'avgjort') return { text: `${OUR_STATUS_LABEL[n.our_status]} ${fmtDate(n.updated_at)}`, tone: n.our_status === 'won' ? 'text-[#20c58f]' : 'text-red-400' }
  if (col === 'lamnat') {
    return n.award_decision_at ? { text: `tilldelning ${fmtDate(n.award_decision_at)}`, tone: 'text-slate-500' } : { text: 'väntar på tilldelning', tone: 'text-slate-500' }
  }
  const d = daysUntil(n.tender_deadline)
  if (d == null) return { text: 'sista dag okänd', tone: 'text-slate-500' }
  if (d < 0) return { text: `sista dag passerad ${fmtDate(n.tender_deadline)}`, tone: 'text-red-400' }
  return { text: fmtRelativeDays(n.tender_deadline), tone: daysTone(d) }
}

export default function BidsBoardPage() {
  const [notices, setNotices] = useState<NoticeWithRelations[]>([])
  const [managers, setManagers] = useState<ProcurementManagerProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<BoardColumnKey | null>(null)
  const [outcomeFor, setOutcomeFor] = useState<NoticeWithRelations | null>(null)
  const [mobileCol, setMobileCol] = useState<BoardColumnKey>('pagar')
  const [exporting, setExporting] = useState(false)
  const [newType, setNewType] = useState<ProcurementManualType | null>(null)
  const navigate = useNavigate()
  const { user } = useAuth()

  const load = useCallback(async () => {
    try {
      const list = await ProcurementService.listNotices({ statuses: BOARD_STATUSES, limit: 1000 })
      setNotices(list)
      setError(null)
    } catch (e) {
      const msg = errMsg(e, 'Kunde inte hämta anbuden')
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    ProcurementService.listManagers()
      .then(setManagers)
      .catch(() => setManagers([]))
  }, [load])

  const columns = useMemo(() => {
    const since = addDaysIso(todaySwedish(), -DECIDED_DAYS)
    return BOARD_COLUMNS.map((c) => {
      const cards = notices
        .filter((n) => c.statuses.includes(n.our_status))
        .filter((n) => c.key !== 'avgjort' || (swedishDate(n.updated_at) ?? '') >= since)
        .sort((a, b) =>
          c.key === 'avgjort'
            ? b.updated_at.localeCompare(a.updated_at)
            : (a.tender_deadline ?? '9999').localeCompare(b.tender_deadline ?? '9999')
        )
      const sum = cards.reduce((s, n) => s + (annualOf(n) ?? 0), 0)
      return { ...c, cards, sum }
    })
  }, [notices])

  const setStatus = async (n: NoticeWithRelations, status: ProcurementOurStatus) => {
    if (ourStatusChoice(n.our_status) === status) return
    setBusy(n.id)
    const prev = n.our_status
    // Optimistiskt: kortet flyttar direkt och flyttar tillbaka vid fel
    setNotices((list) => list.map((x) => (x.id === n.id ? { ...x, our_status: status, updated_at: new Date().toISOString() } : x)))
    try {
      await ProcurementService.updateNotice(n.id, { our_status: status }, `Status: ${OUR_STATUS_LABEL[status]}`)
      if (status === 'declined') {
        setNotices((list) => list.filter((x) => x.id !== n.id))
        toast.success('Avstår. Posten är borttagen från tavlan.')
      } else toast.success(`${OUR_STATUS_LABEL[status]}: ${n.title}`)
    } catch (e) {
      setNotices((list) => list.map((x) => (x.id === n.id ? { ...x, our_status: prev } : x)))
      toast.error(errMsg(e, 'Kunde inte byta status'))
    } finally {
      setBusy(null)
    }
  }

  const onDrop = (e: DragEvent, col: BoardColumnKey) => {
    e.preventDefault()
    setOver(null)
    const id = e.dataTransfer.getData(DRAG_TYPE) || dragId
    setDragId(null)
    const n = notices.find((x) => x.id === id)
    if (!n) return
    if (needsOutcomeChoice(n.our_status, col)) {
      setOutcomeFor(n)
      return
    }
    const next = statusForDrop(n.our_status, col)
    if (next) void setStatus(n, next)
  }

  const exportBoard = async () => {
    const all = columns.flatMap((c) => c.cards.map((n) => ({ n, col: c.label })))
    if (all.length === 0) {
      toast.error('Tavlan är tom')
      return
    }
    setExporting(true)
    try {
      await exportXlsx({
        fileBase: 'Anbud',
        sheetName: 'Anbud',
        title: 'Anbud, tavlan',
        columns: [
          { header: 'Kolumn', width: 14 },
          { header: 'Status', width: 14 },
          { header: 'Typ', width: 18 },
          { header: 'BGU', width: 10 },
          { header: 'Upphandling', width: 56 },
          { header: 'Köpare', width: 32 },
          { header: 'Sista anbudsdag', width: 16 },
          { header: 'Årsvärde (kr)', width: 14, numFmt: '# ##0' },
          { header: 'Ansvarig', width: 22 },
        ],
        rows: all.map(({ n, col }) => [
          col,
          OUR_STATUS_LABEL[n.our_status],
          n.manual_type ? MANUAL_TYPE_LABEL[n.manual_type] : 'Annons',
          `BGU-${n.bgu_number}`,
          n.title,
          n.buyer?.name ?? n.buyer_name ?? '',
          n.tender_deadline ? fmtDate(n.tender_deadline) : '',
          annualOf(n),
          n.owner_id ? personName(managers, n.owner_id) : '',
        ]),
      })
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte skapa Excel-filen'))
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="py-16 flex justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  const menuOptions = BOARD_MENU_STATUSES.map((s) => ({ value: s, label: OUR_STATUS_LABEL[s], dot: OUR_STATUS_DOT[s] }))

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-[12.5px] text-slate-500">Dra kort mellan kolumnerna, eller byt status i kortets meny. Avgjort visar det senaste året.</p>
        <div className="flex items-center gap-1 shrink-0">
          <IconButton icon={<Icon name="upphandling.excel" size={20} />} label="Exportera till Excel" onClick={() => void exportBoard()} disabled={exporting} />
          <NewPostButton onPick={setNewType} />
        </div>
      </div>

      {/* Mobil: en kolumn i taget */}
      <nav className="lg:hidden flex gap-5 border-b border-slate-800 mb-3 overflow-x-auto" aria-label="Kolumner">
        {columns.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setMobileCol(c.key)}
            aria-current={mobileCol === c.key ? 'true' : undefined}
            className={`-mb-px inline-flex items-center gap-1.5 pb-2.5 pt-1 min-h-[44px] text-[14px] whitespace-nowrap border-b-2 ${
              mobileCol === c.key ? 'border-[#20c58f] text-slate-100 font-medium' : 'border-transparent text-slate-400'
            }`}
          >
            {c.label}
            <span className="text-[12px] tabular-nums text-slate-500">{fmtNum(c.cards.length)}</span>
          </button>
        ))}
      </nav>

      {error && <p className="mb-3 text-[13px] text-red-400">Kunde inte hämta anbuden. {error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3.5">
        {columns.map((c) => (
          <section
            key={c.key}
            aria-label={c.label}
            onDragOver={(e) => {
              if (!dragId) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              if (over !== c.key) setOver(c.key)
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((o) => (o === c.key ? null : o))
            }}
            onDrop={(e) => onDrop(e, c.key)}
            className={`${mobileCol === c.key ? '' : 'hidden'} lg:block min-w-0 rounded-[10px] border p-2.5 transition-colors ${
              over === c.key ? 'border-[#20c58f] bg-[#20c58f]/5' : 'border-slate-800 bg-slate-900/30'
            }`}
          >
            <div className="flex items-baseline justify-between gap-2 px-1 pt-1 pb-2">
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-100">
                <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                {c.label}
                <span className="font-normal tabular-nums text-slate-500">{fmtNum(c.cards.length)}</span>
              </span>
              <span className="text-[12px] tabular-nums text-slate-500">{c.sum > 0 ? `${fmtKrShort(c.sum)}/år` : ''}</span>
            </div>
            {c.cards.length === 0 ? (
              <p className="px-1 py-4 text-[12px] text-slate-500">
                {c.key === 'bedoms' ? 'Inget att bedöma. Ta upp annonser under Annonser.' : c.key === 'avgjort' ? 'Inget avgjort det senaste året.' : 'Inga kort här ännu.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {c.cards.map((n) => {
                  const when = cardWhen(n)
                  const annual = annualOf(n)
                  const owner = n.owner_id ? personName(managers, n.owner_id) : '–'
                  return (
                    <li
                      key={n.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DRAG_TYPE, n.id)
                        e.dataTransfer.effectAllowed = 'move'
                        setDragId(n.id)
                      }}
                      onDragEnd={() => {
                        setDragId(null)
                        setOver(null)
                      }}
                      className={`rounded-lg border border-slate-800 bg-slate-950/60 hover:border-slate-700 px-3 py-2.5 transition-opacity ${dragId === n.id ? 'opacity-50' : ''} ${busy === n.id ? 'opacity-60' : ''} lg:cursor-grab`}
                    >
                      <Link to={noticePath(n.id)} className="block group" draggable={false}>
                        {n.manual_type && (
                          <div className="mb-1 inline-flex items-center gap-1.5 text-[11.5px] text-slate-400">
                            <Icon name={MANUAL_TYPE_ICON[n.manual_type]} size={16} />
                            {MANUAL_TYPE_LABEL[n.manual_type]}
                          </div>
                        )}
                        <div className="text-[13px] leading-snug font-medium text-slate-100 group-hover:text-[#20c58f]">{n.title}</div>
                        <div className="text-[12px] text-slate-500 mt-0.5 truncate">{n.buyer?.name ?? n.buyer_name ?? 'Okänd köpare'}</div>
                      </Link>
                      <div className="mt-2 flex items-center justify-between gap-2 text-[12px] tabular-nums">
                        <span className={`min-w-0 truncate ${when.tone}`}>{when.text}</span>
                        <span className="shrink-0 text-slate-400" title={owner !== '–' ? `Ansvarig ${owner}` : 'Ingen ansvarig'}>
                          {annual != null ? fmtKrShort(annual) : '–'} · {initials(owner)}
                        </span>
                      </div>
                      <div className="-mb-2 -ml-0.5">
                        <StatusMenu
                          size="sm"
                          value={ourStatusChoice(n.our_status)}
                          label={OUR_STATUS_LABEL[n.our_status]}
                          dot={OUR_STATUS_DOT[n.our_status]}
                          options={menuOptions}
                          onChange={(s) => void setStatus(n, s)}
                          disabled={busy === n.id}
                          ariaLabel={`Byt status för ${n.title}`}
                        />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        ))}
      </div>

      {newType && (
        <NewPostDialog
          type={newType}
          managers={managers}
          defaultOwnerId={managers.some((m) => m.user_id === user?.id) ? user?.id ?? null : null}
          onClose={() => setNewType(null)}
          onCreated={(id) => {
            setNewType(null)
            navigate(noticePath(id))
          }}
        />
      )}

      {outcomeFor && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="utfall-titel" onClick={() => setOutcomeFor(null)}>
          <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 id="utfall-titel" className="text-[15px] font-semibold text-slate-100">Hur gick det?</h2>
            <p className="mt-1 text-[13px] text-slate-400">{outcomeFor.title}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <PrimaryButton
                onClick={() => {
                  const n = outcomeFor
                  setOutcomeFor(null)
                  void setStatus(n, 'won')
                }}
              >
                <Icon name="upphandling.utfall" size={20} />
                Vunnen
              </PrimaryButton>
              <SecondaryButton
                onClick={() => {
                  const n = outcomeFor
                  setOutcomeFor(null)
                  void setStatus(n, 'lost')
                }}
              >
                Förlorad
              </SecondaryButton>
              <button type="button" onClick={() => setOutcomeFor(null)} className="ml-auto min-h-[44px] px-2 text-[13px] text-slate-400 hover:text-slate-200">
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
