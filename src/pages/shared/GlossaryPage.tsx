// src/pages/shared/GlossaryPage.tsx
// Ordlistan (3.52.0, skiss V3-Ordlista): ord som Snygga till aldrig rättar.
// Namnen på artiklar, tjänster, produkter, preparat och stationstyper hämtas
// automatiskt (triggers i databasen); personalen lägger till egna ord.
// Automatiska ord stängs av och slås på (de tas inte bort, synken skulle lägga
// tillbaka dem); manuella ord går att ta bort. Sidan finns för koordinator och
// admin (/koordinator/ordlista och /admin/ordlista).

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import ConfirmModal from '../../components/ui/ConfirmModal'
import { Icon } from '../../components/icons/Icon'
import { TextPolishService, type GlossaryEntryWithAuthor } from '../../services/textPolishService'
import { GLOSSARY_SOURCE_LABEL, type GlossarySource } from '../../types/textPolish'
import {
  FALT,
  IKON_KNAPP_LATT,
  PRIMAR_KNAPP,
  SEKUNDAR_KNAPP,
  datumAv,
} from '../../components/shared/specialReports/specialReportUtils'

type Filter = 'alla' | GlossarySource | 'avstangda'

const FILTER_VAL: { value: Filter; label: string }[] = [
  { value: 'alla', label: 'Alla källor' },
  { value: 'manuell', label: 'Tillagda av er' },
  { value: 'artikel', label: 'Artiklar' },
  { value: 'produkt', label: 'Produkter' },
  { value: 'tjanst', label: 'Tjänster' },
  { value: 'preparat', label: 'Preparat' },
  { value: 'stationstyp', label: 'Stationstyper' },
  { value: 'avstangda', label: 'Avstängda' },
]

/** Översiktsrutorna: källor som räknas ihop */
const RUTOR: { namn: string; kallor: GlossarySource[]; under: string; filter: Filter }[] = [
  { namn: 'Artiklar och produkter', kallor: ['artikel', 'produkt'], under: 'Hämtas automatiskt', filter: 'artikel' },
  { namn: 'Tjänster', kallor: ['tjanst'], under: 'Hämtas automatiskt', filter: 'tjanst' },
  { namn: 'Preparat', kallor: ['preparat'], under: 'Hämtas automatiskt', filter: 'preparat' },
  { namn: 'Stationstyper', kallor: ['stationstyp'], under: 'Hämtas automatiskt', filter: 'stationstyp' },
  { namn: 'Tillagda av er', kallor: ['manuell'], under: 'Går att ta bort', filter: 'manuell' },
]

const MAX_RADER = 300

export default function GlossaryPage() {
  const [ord, setOrd] = useState<GlossaryEntryWithAuthor[] | null>(null)
  const [fel, setFel] = useState<string | null>(null)
  const [sok, setSok] = useState('')
  const [filter, setFilter] = useState<Filter>('alla')
  const [arbetar, setArbetar] = useState<string | null>(null)
  const [visaNytt, setVisaNytt] = useState(false)
  const [nyttOrd, setNyttOrd] = useState('')
  const [sparar, setSparar] = useState(false)
  const [taBort, setTaBort] = useState<GlossaryEntryWithAuthor | null>(null)

  const ladda = useCallback(async () => {
    try {
      setOrd(await TextPolishService.listGlossary())
      setFel(null)
    } catch (e) {
      setFel(e instanceof Error ? e.message : 'Kunde inte hämta ordlistan')
    }
  }, [])

  useEffect(() => {
    document.title = 'Ordlistan'
    void ladda()
  }, [ladda])

  const antal = useMemo(() => {
    const n: Record<GlossarySource, number> = { artikel: 0, tjanst: 0, produkt: 0, preparat: 0, stationstyp: 0, manuell: 0 }
    for (const o of ord ?? []) if (o.active) n[o.source] += 1
    return n
  }, [ord])

  const visade = useMemo(() => {
    const q = sok.trim().toLocaleLowerCase('sv-SE')
    return (ord ?? [])
      .filter(o => (filter === 'alla' ? true : filter === 'avstangda' ? !o.active : o.source === filter))
      .filter(o => !q || o.term.toLocaleLowerCase('sv-SE').includes(q))
      // Manuella först, sedan i bokstavsordning
      .sort((a, b) => Number(b.source === 'manuell') - Number(a.source === 'manuell') || a.term.localeCompare(b.term, 'sv'))
  }, [ord, sok, filter])

  const vaxlaAktiv = async (o: GlossaryEntryWithAuthor) => {
    setArbetar(o.id)
    try {
      await TextPolishService.setActive(o.id, !o.active)
      setOrd(lista => (lista ?? []).map(x => (x.id === o.id ? { ...x, active: !o.active } : x)))
      toast.success(o.active ? `"${o.term}" är avstängt och kan rättas igen` : `"${o.term}" skyddas igen`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte ändra ordet')
    } finally {
      setArbetar(null)
    }
  }

  const bekraftaTaBort = async () => {
    if (!taBort) return
    setArbetar(taBort.id)
    try {
      await TextPolishService.deleteTerm(taBort.id)
      setOrd(lista => (lista ?? []).filter(x => x.id !== taBort.id))
      toast.success(`"${taBort.term}" är borttaget ur ordlistan`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte ta bort ordet')
    } finally {
      setArbetar(null)
      setTaBort(null)
    }
  }

  const laggTill = async () => {
    if (!nyttOrd.trim()) return
    setSparar(true)
    try {
      const utfall = await TextPolishService.addToGlossary(nyttOrd)
      toast.success(utfall === 'fanns' ? 'Ordet finns redan i ordlistan' : utfall === 'aktiverad' ? 'Ordet var avstängt och skyddas nu igen' : 'Tillagt i ordlistan. Rättas aldrig igen.')
      setNyttOrd('')
      setVisaNytt(false)
      await ladda()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte lägga till ordet')
    } finally {
      setSparar(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <Icon name="rapport.ordlista" size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-white">Ordlistan</h1>
            <p className="text-sm text-slate-400">Ord som Snygga till aldrig rättar. Gäller alla rapporter och alla tekniker.</p>
          </div>
        </div>
        <button type="button" onClick={() => setVisaNytt(true)} className={PRIMAR_KNAPP}>
          <Icon name="allman.plus" size={20} />
          Lägg till ord
        </button>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {RUTOR.map(r => (
          <button
            key={r.namn}
            type="button"
            onClick={() => setFilter(f => (f === r.filter ? 'alla' : r.filter))}
            aria-pressed={filter === r.filter}
            className={`flex flex-col gap-1 rounded-xl border p-3.5 text-left transition-colors ${
              filter === r.filter ? 'border-[#20c58f] bg-[#20c58f]/10' : 'border-slate-700/60 bg-slate-900/60 hover:border-slate-600'
            }`}
          >
            <span className="text-xs text-slate-400">{r.namn}</span>
            <span className="text-xl font-bold text-white">{ord ? r.kallor.reduce((n, k) => n + antal[k], 0) : '...'}</span>
            <span className="text-xs text-slate-500">{r.under}</span>
          </button>
        ))}
      </div>
      <p className="-mt-2 text-[13px] text-slate-400">Kundens namn och adress i varje rapport skyddas också, utan att de sparas här.</p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex h-11 min-w-0 flex-1 basis-64 items-center gap-2.5 rounded-xl border border-slate-700/60 bg-slate-900/60 px-3.5 text-slate-500 focus-within:ring-2 focus-within:ring-[#20c58f]/50 sm:max-w-[420px]">
          <Icon name="allman.sok" size={16} />
          <input
            aria-label="Sök i ordlistan"
            placeholder="Sök ord"
            value={sok}
            onChange={e => setSok(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
          />
        </label>
        <Select
          value={filter}
          onChange={v => setFilter(v as Filter)}
          options={FILTER_VAL}
          className="w-48"
        />
      </div>

      {fel ? (
        <div className="py-10 text-center">
          <p className="text-sm text-slate-300">{fel}</p>
          <button type="button" onClick={() => void ladda()} className={`${SEKUNDAR_KNAPP} mt-3`}>Försök igen</button>
        </div>
      ) : !ord ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : visade.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center text-slate-400">
          <Icon name="rapport.ordlista" size={32} />
          <p className="text-sm">{sok || filter !== 'alla' ? 'Inga ord matchar.' : 'Ordlistan är tom.'}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/60">
          <div className="hidden grid-cols-[1.6fr_1fr_1.4fr_0.9fr_150px] gap-4 border-b border-slate-700/60 px-5 py-2.5 text-[11px] uppercase tracking-wider text-slate-500 md:grid">
            <span>Ord</span><span>Källa</span><span>Tillagt av</span><span>Datum</span><span />
          </div>
          <ul>
            {visade.slice(0, MAX_RADER).map(o => {
              const manuell = o.source === 'manuell'
              return (
                <li
                  key={o.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 border-b border-slate-800 px-4 py-2.5 last:border-b-0 md:grid-cols-[1.6fr_1fr_1.4fr_0.9fr_150px] md:px-5"
                >
                  <span className={`min-w-0 break-words text-sm font-semibold ${o.active ? 'text-white' : 'text-slate-500 line-through'}`}>{o.term}</span>
                  <span className="col-start-1 flex items-center gap-1.5 text-[13px] text-slate-400 md:col-start-auto">
                    <span className={`h-[7px] w-[7px] flex-shrink-0 rounded-full ${o.active ? (manuell ? 'bg-[#20c58f]' : 'bg-slate-500') : 'bg-amber-400'}`} aria-hidden="true" />
                    {GLOSSARY_SOURCE_LABEL[o.source]}{o.active ? '' : ', avstängt'}
                  </span>
                  <span className="col-start-1 truncate text-[13px] text-slate-400 md:col-start-auto">{manuell ? o.addedByName ?? 'Okänd' : 'Automatiskt'}</span>
                  <span className="col-start-1 text-[13px] tabular-nums text-slate-400 md:col-start-auto">{datumAv(o.created_at)}</span>
                  <span className="col-start-2 row-span-4 row-start-1 flex justify-end md:col-start-auto md:row-span-1 md:row-start-auto">
                    {manuell ? (
                      <button
                        type="button"
                        onClick={() => setTaBort(o)}
                        disabled={arbetar === o.id}
                        aria-label={`Ta bort ${o.term} ur ordlistan`}
                        title="Ta bort"
                        className={IKON_KNAPP_LATT}
                      >
                        {arbetar === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon name="allman.radera" size={20} />}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => vaxlaAktiv(o)}
                        disabled={arbetar === o.id}
                        aria-label={o.active ? `Stäng av ${o.term}` : `Slå på ${o.term}`}
                        className="inline-flex h-11 items-center gap-1.5 rounded-lg px-2.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                      >
                        {arbetar === o.id && <Loader2 className="h-4 w-4 animate-spin" />}
                        {o.active ? 'Stäng av' : 'Slå på'}
                      </button>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
          {visade.length > MAX_RADER && (
            <p className="border-t border-slate-800 px-5 py-3 text-xs text-slate-500">
              Visar {MAX_RADER} av {visade.length} ord. Sök för att hitta fler.
            </p>
          )}
        </div>
      )}

      <Modal
        isOpen={visaNytt}
        onClose={() => { setVisaNytt(false); setNyttOrd('') }}
        title="Lägg till ord"
        size="sm"
        footer={
          <div className="flex justify-end gap-2.5 px-4 py-2.5">
            <button type="button" onClick={() => { setVisaNytt(false); setNyttOrd('') }} className={SEKUNDAR_KNAPP}>Avbryt</button>
            <button type="button" onClick={laggTill} disabled={sparar || !nyttOrd.trim()} className={PRIMAR_KNAPP}>
              {sparar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon name="allman.plus" size={20} />}
              Lägg till
            </button>
          </div>
        }
      >
        <form className="space-y-2 p-4" onSubmit={e => { e.preventDefault(); void laggTill() }}>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-400">Ord eller namn</span>
            <input
              autoFocus
              value={nyttOrd}
              onChange={e => setNyttOrd(e.target.value)}
              maxLength={200}
              placeholder="Till exempel WiseTrap"
              className={FALT}
            />
          </label>
          <p className="text-xs text-slate-500">Skriv ordet exakt som det ska stavas. Snygga till rättar det aldrig, och skriver det så här om det står med fel versaler.</p>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!taBort}
        onClose={() => setTaBort(null)}
        onConfirm={bekraftaTaBort}
        title="Ta bort ordet?"
        message={`"${taBort?.term ?? ''}" tas bort ur ordlistan och kan rättas av Snygga till igen.`}
        confirmLabel="Ta bort"
        variant="danger"
        loading={!!taBort && arbetar === taBort.id}
      />
    </div>
  )
}
