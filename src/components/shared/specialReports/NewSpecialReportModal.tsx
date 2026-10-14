// src/components/shared/specialReports/NewSpecialReportModal.tsx
// Ny specialrapport: sök och koppla ett ärende, välj upplägg (tomt, karta,
// en sektion per besök eller kopia av tidigare rapport), titel och dokumenttyp.
// Skapa leder direkt till redigeraren.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import Modal from '../../ui/Modal'
import Select from '../../ui/Select'
import { Icon, type IconName } from '../../icons/Icon'
import { SpecialReportService } from '../../../services/specialReportService'
import type {
  SpecialReportCaseOption,
  SpecialReportDocType,
  SpecialReportListItem,
  SpecialReportStart,
} from '../../../types/specialReport'
import { DOC_TYPES, FALT, PRIMAR_KNAPP, SEKUNDAR_KNAPP, useSpecialReportBase } from './specialReportUtils'

interface NewSpecialReportModalProps {
  isOpen: boolean
  onClose: () => void
  /** Förifylld sökning, t.ex. ärendenumret när modalen öppnas från ett ärende */
  initialQuery?: string
  /** Välj ärendet direkt om det finns bland träffarna */
  initialCaseId?: string
}

const STARTVAL: { id: SpecialReportStart; icon: IconName; rubrik: string; text: string }[] = [
  { id: 'tom', icon: 'rapport.tom', rubrik: 'Börja tomt', text: 'Lägg till sektioner efter hand' },
  { id: 'karta', icon: 'rapport.omrade', rubrik: 'Börja med kartan', text: 'Varje område du ritar blir en sektion' },
  { id: 'per_besok', icon: 'rapport.besok', rubrik: 'En sektion per besök', text: 'Ärendets besök hämtas in' },
  { id: 'kopia', icon: 'rapport.kopia', rubrik: 'Utgå från tidigare rapport', text: 'Samma struktur, nya händelser' },
]


export default function NewSpecialReportModal({ isOpen, onClose, initialQuery = '', initialCaseId }: NewSpecialReportModalProps) {
  const navigate = useNavigate()
  const base = useSpecialReportBase()

  const [query, setQuery] = useState(initialQuery)
  const [traffar, setTraffar] = useState<SpecialReportCaseOption[]>([])
  const [soker, setSoker] = useState(false)
  const [valt, setValt] = useState<SpecialReportCaseOption | null>(null)
  const [start, setStart] = useState<SpecialReportStart>('tom')
  const [kopiaFran, setKopiaFran] = useState('')
  const [tidigare, setTidigare] = useState<SpecialReportListItem[] | null>(null)
  const [titel, setTitel] = useState('')
  const titelRord = useRef(false)
  const [docType, setDocType] = useState<SpecialReportDocType>('Saneringsrapport')
  const [skapar, setSkapar] = useState(false)

  // Nollställ när modalen öppnas
  useEffect(() => {
    if (!isOpen) return
    setQuery(initialQuery)
    setTraffar([])
    setValt(null)
    setStart('tom')
    setKopiaFran('')
    setTitel('')
    titelRord.current = false
    setDocType('Saneringsrapport')
  }, [isOpen, initialQuery])

  // Sök ärenden med fördröjning
  useEffect(() => {
    if (!isOpen) return
    const q = query.trim()
    if (q.length < 2) { setTraffar([]); return }
    let aktuell = true
    const t = setTimeout(async () => {
      setSoker(true)
      try {
        const res = await SpecialReportService.searchCases(q)
        if (!aktuell) return
        setTraffar(res)
        // Öppnad från ett ärende: välj det direkt
        if (initialCaseId && !valt) {
          const traff = res.find(r => r.case_id === initialCaseId)
          if (traff) valjArende(traff)
        }
      } catch (e) {
        if (aktuell) toast.error(e instanceof Error ? e.message : 'Kunde inte söka ärenden')
      } finally {
        if (aktuell) setSoker(false)
      }
    }, 300)
    return () => { aktuell = false; clearTimeout(t) }
    // valjArende är stabil nog; valt läses bara för förvalet
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, isOpen, initialCaseId])

  // Tidigare rapporter laddas först när kopia väljs
  useEffect(() => {
    if (start !== 'kopia' || tidigare) return
    SpecialReportService.list()
      .then(setTidigare)
      .catch(e => toast.error(e instanceof Error ? e.message : 'Kunde inte hämta rapporterna'))
  }, [start, tidigare])

  function valjArende(a: SpecialReportCaseOption) {
    setValt(a)
    if (!titelRord.current) {
      const namn = a.customer_name || a.title || ''
      setTitel(namn ? `${a.service ? `${a.service} hos ` : ''}${namn}` : '')
    }
  }

  const kopiaAlternativ = useMemo(
    () => (tidigare ?? []).map(r => ({
      value: r.id,
      label: `${r.title}${r.customer_name ? ` · ${r.customer_name}` : ''}`,
    })),
    [tidigare],
  )

  const kanSkapa = !!valt && titel.trim().length > 0 && (start !== 'kopia' || !!kopiaFran)

  async function skapa() {
    if (!valt || !kanSkapa) return
    setSkapar(true)
    try {
      const id = await SpecialReportService.create({
        caseOption: valt,
        title: titel.trim(),
        docType,
        start,
        copyFromReportId: start === 'kopia' ? kopiaFran : undefined,
      })
      toast.success('Rapporten är skapad')
      onClose()
      navigate(`${base}/${id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte skapa rapporten')
    } finally {
      setSkapar(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Ny specialrapport"
      subtitle="Koppla till ett ärende så hämtas kunden till rapporten"
      size="lg"
      usePortal
      mobilHelskarm
      footer={
        <div className="flex justify-end gap-2 px-4 py-2.5">
          <button type="button" className={SEKUNDAR_KNAPP} onClick={onClose} disabled={skapar}>Avbryt</button>
          <button type="button" className={PRIMAR_KNAPP} onClick={skapa} disabled={!kanSkapa || skapar}>
            {skapar && <Loader2 className="w-4 h-4 animate-spin" />}
            Skapa rapport
            <Icon name="allman.chevron" size={16} />
          </button>
        </div>
      }
    >
      <div className="p-4 space-y-5">
        {/* 1. Ärende */}
        <section className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-slate-500">1. Ärende</h3>
          <label className="flex h-11 items-center gap-2.5 rounded-xl border border-slate-700 bg-slate-800/50 px-3 text-slate-400 focus-within:ring-2 focus-within:ring-[#20c58f]/50">
            <Icon name="allman.sok" size={16} />
            <input
              aria-label="Sök ärende"
              value={query}
              onChange={e => { setQuery(e.target.value); setValt(null) }}
              placeholder="BE-nummer, kund eller kontaktperson"
              className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
              autoFocus={!initialQuery}
            />
            {soker && <Loader2 className="w-4 h-4 animate-spin" />}
          </label>

          {valt ? (
            <div className="flex gap-3 rounded-xl border-[1.5px] border-[#20c58f] bg-[#20c58f]/5 p-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#20c58f] text-[#04140d]">
                <Icon name="rapport.lank" size={20} />
              </span>
              <div className="grid flex-1 grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                <p className="sm:col-span-2 font-semibold text-white">
                  {valt.customer_name || valt.title || 'Okänd kund'}{' '}
                  <span className="font-mono text-xs font-normal text-slate-400">{valt.case_number}</span>
                </p>
                {valt.customer_number && <p className="text-slate-400">Kundnummer <span className="text-slate-200">{valt.customer_number}</span></p>}
                {valt.service && <p className="text-slate-400">Tjänst <span className="text-slate-200">{valt.service}</span></p>}
                {valt.address && <p className="text-slate-400">Adress <span className="text-slate-200">{valt.address}</span></p>}
                {valt.contact_name && <p className="text-slate-400">Kontakt <span className="text-slate-200">{valt.contact_name}</span></p>}
              </div>
              <button
                type="button"
                onClick={() => setValt(null)}
                aria-label="Byt ärende"
                className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <Icon name="allman.stang" size={16} />
              </button>
            </div>
          ) : traffar.length > 0 ? (
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {traffar.map(a => (
                <li key={`${a.case_type}-${a.case_id}`}>
                  <button
                    type="button"
                    onClick={() => valjArende(a)}
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-800/20 px-3 py-2 text-left hover:border-[#20c58f]/60"
                  >
                    <Icon name="arende.arende" size={16} className="text-slate-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-white">{a.customer_name || a.title || 'Okänd kund'}</span>
                      <span className="block truncate text-xs text-slate-500">
                        <span className="font-mono">{a.case_number}</span>
                        {a.address ? ` · ${a.address}` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : query.trim().length >= 2 && !soker ? (
            <p className="text-xs text-slate-500">Inga ärenden hittades.</p>
          ) : null}
        </section>

        {/* 2. Upplägg */}
        <section className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-slate-500">2. Upplägg</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {STARTVAL.map(v => {
              const aktiv = start === v.id
              return (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={aktiv}
                  onClick={() => setStart(v.id)}
                  className={`flex min-h-[72px] items-center gap-3 rounded-xl border-[1.5px] px-3.5 py-3 text-left transition-colors ${
                    aktiv ? 'border-[#20c58f] bg-[#20c58f]/5' : 'border-slate-700/60 bg-slate-800/30 hover:border-slate-600'
                  }`}
                >
                  <Icon name={v.icon} size={24} className={aktiv ? 'text-[#20c58f]' : 'text-slate-400'} />
                  <span>
                    <span className="block text-sm font-semibold text-slate-100">{v.rubrik}</span>
                    <span className="block text-xs text-slate-400">{v.text}</span>
                  </span>
                </button>
              )
            })}
          </div>
          {start === 'kopia' && (
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1">Rapport att utgå från</p>
              <Select
                value={kopiaFran}
                onChange={setKopiaFran}
                options={kopiaAlternativ}
                placeholder={tidigare ? (tidigare.length ? 'Välj rapport' : 'Inga tidigare rapporter') : 'Hämtar rapporter...'}
                disabled={!tidigare || tidigare.length === 0}
              />
            </div>
          )}
          <p className="text-xs text-slate-500">Startvalet låser ingenting. Sektioner av alla slag kan blandas i samma rapport.</p>
        </section>

        {/* 3. Rapporten */}
        <section className="space-y-2">
          <h3 className="text-xs uppercase tracking-wider text-slate-500">3. Rapporten</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="sm:col-span-2 block">
              <span className="block text-xs font-medium text-slate-400 mb-1">Titel</span>
              <input
                value={titel}
                onChange={e => { titelRord.current = true; setTitel(e.target.value) }}
                placeholder="Till exempel: Råttor i Brf Solgläntan, augusti till oktober"
                className={FALT}
              />
            </label>
            <div>
              <span className="block text-xs font-medium text-slate-400 mb-1">Dokumenttyp</span>
              <Select
                value={docType}
                onChange={v => setDocType(v as SpecialReportDocType)}
                options={DOC_TYPES.map(d => ({ value: d, label: d }))}
              />
            </div>
          </div>
        </section>
      </div>
    </Modal>
  )
}
