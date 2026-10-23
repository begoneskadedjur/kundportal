// src/pages/shared/InternAdministration.tsx
// Frågor och uppdrag (tidigare Tickets), samma sida för admin (/admin/tickets),
// koordinator (/koordinator/tickets) och tekniker (/technician/tickets).
//
// En tråd är en rotkommentar i ärendets kommunikation (case_comments). Den skapas här
// (Ny fråga eller uppdrag) eller i ärendets kommunikationspanel genom att nämna någon,
// och är samma tråd på båda ställena. Sidan visar det som kräver något av mig:
//   Väntar på dig (Frågor till dig, Svar till dig), Du väntar på svar,
//   Omnämnd för kännedom och Klara (hopfälld).
// Admin och koordinator har dessutom läget Alla med filter och kontorets grupper.
// Logiken finns i src/components/fragor/fragorLogik.ts.
//
// Djuplänkar: ?thread=<kommentar-id> väljer tråden (även ett svar-id), ?caseId=&caseType=
// väljer senaste tråden i ärendet, ?vy=alla öppnar Alla, ?ny=1 öppnar dialogen.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useNyArbetsvy } from '../../hooks/useNyArbetsvy'
import { useNySidhuvud } from '../../components/technician/ny/layout/NySidhuvud'
import { useArDator } from '../../components/technician/ny/arenden/useArDator'
import { useFragorOchUppdrag, type FragorLage, type FragorRad } from '../../hooks/useFragorOchUppdrag'
import { Icon } from '../../components/icons/Icon'
import TradLista, { type ListGrupp, type ListRad } from '../../components/fragor/TradLista'
import TradVy from '../../components/fragor/TradVy'
import NyFragaDialog from '../../components/fragor/NyFragaDialog'
import OppnaArendeKontor from '../../components/fragor/OppnaArendeKontor'
import OppnaArende from '../../components/technician/ny/OppnaArende'
import { CaseContextCommunicationModal } from '../../components/communication'
import { KNAPP_PRIMAR } from '../../components/fragor/fragorUi'
import {
  arendeTypText, kvittonPerKommentar, matcharSok, rollMottagare, type Trad,
} from '../../components/fragor/fragorLogik'
import type { AuthorRole, CaseType } from '../../types/communication'
import type { InkorgArende } from '../../services/communicationService'

type StatusFilter = 'oppna' | 'klara' | 'alla'

interface KommState {
  caseId: string
  caseType: CaseType
  titel: string
  tradId: string | null
}

const SELECT =
  'h-11 px-3 rounded-xl border border-slate-600 bg-slate-900 text-[15px] text-white focus:outline-none focus:border-[#20c58f] focus-visible:ring-2 focus-visible:ring-[#20c58f]'

export default function InternAdministration() {
  const { profile, activeView } = useAuth()
  const { aktiv: nyAktiv } = useNyArbetsvy()
  const arDator = useArDator()
  const [searchParams, setSearchParams] = useSearchParams()
  const [lage, setLage] = useState<FragorLage>(() => (searchParams.get('vy') === 'alla' ? 'all' : 'mine'))
  const { mig, rader, kvitton, laddar, fel, uppdatera, klaraTotalt, harFlerKlara, visaFlerKlara } = useFragorOchUppdrag(lage)
  const arKontor = !!mig?.arKontor
  const [sok, setSok] = useState('')
  const [nyOppen, setNyOppen] = useState(false)
  const [oppnaArende, setOppnaArende] = useState<{ id: string; typ: CaseType } | null>(null)
  const [komm, setKomm] = useState<KommState | null>(null)
  const sokRef = useRef<HTMLInputElement>(null)

  // Filter i Alla
  const [filterTill, setFilterTill] = useState('')
  const [filterFran, setFilterFran] = useState('')
  const [filterTyp, setFilterTyp] = useState<'' | CaseType>('')
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('oppna')
  const [baraOlasta, setBaraOlasta] = useState(false)

  // Tekniker kan inte ha läget Alla
  useEffect(() => {
    if (!arKontor && lage === 'all') setLage('mine')
  }, [arKontor, lage])

  const valdParam = searchParams.get('thread')
  const caseIdParam = searchParams.get('caseId')
  const caseTypeParam = searchParams.get('caseType') as CaseType | null

  const sattParam = useCallback((andra: (p: URLSearchParams) => void) => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev)
      andra(p)
      return p
    }, { replace: true })
  }, [setSearchParams])

  const valj = useCallback((t: Trad | null) => {
    sattParam(p => {
      p.delete('caseId'); p.delete('caseType')
      if (t) p.set('thread', t.id)
      else p.delete('thread')
    })
  }, [sattParam])

  // ?ny=1 öppnar dialogen direkt
  useEffect(() => {
    if (searchParams.get('ny') === '1') {
      setNyOppen(true)
      sattParam(p => p.delete('ny'))
    }
  }, [searchParams, sattParam])

  const kvittoKarta = useMemo(() => kvittonPerKommentar(kvitton), [kvitton])

  // Vald tråd (thread kan vara ett svar-id från en notis)
  const vald: FragorRad | null = useMemo(() => {
    if (!valdParam) return null
    return rader.find(r => r.trad.id === valdParam || r.trad.alla.some(c => c.id === valdParam)) || null
  }, [rader, valdParam])

  // Djuplänk: rätta thread till rotens id, eller välj senaste tråden i ärendet.
  // Hittas inget i Min inkorg provar kontoret Alla. Annars öppnas ärendets kommunikation.
  const provatAlla = useRef(false)
  useEffect(() => {
    if (laddar) return
    if (valdParam && vald && vald.trad.id !== valdParam) { valj(vald.trad); return }
    const soktFall = !!(caseIdParam && caseTypeParam)
    if ((valdParam && !vald) || (!valdParam && soktFall)) {
      if (!valdParam && soktFall) {
        const iFallet = rader.filter(r => r.trad.caseId === caseIdParam && r.trad.caseType === caseTypeParam && r.min.grupp !== 'anteckning')
        if (iFallet.length > 0) { valj(iFallet[0].trad); return }
      }
      if (arKontor && lage === 'mine' && !provatAlla.current) {
        provatAlla.current = true
        setFilterStatus('alla')
        setLage('all')
        return
      }
      if (soktFall) {
        setKomm({ caseId: caseIdParam!, caseType: caseTypeParam!, titel: '', tradId: valdParam })
      }
      sattParam(p => { p.delete('thread'); p.delete('caseId'); p.delete('caseType') })
    }
  }, [laddar, valdParam, vald, caseIdParam, caseTypeParam, rader, arKontor, lage, valj, sattParam])

  // "/" fokuserar sökningen
  useEffect(() => {
    const tangent = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey) return
      const mal = e.target as HTMLElement | null
      if (mal && (mal.tagName === 'INPUT' || mal.tagName === 'TEXTAREA' || mal.isContentEditable)) return
      e.preventDefault()
      sokRef.current?.focus()
    }
    window.addEventListener('keydown', tangent)
    return () => window.removeEventListener('keydown', tangent)
  }, [])

  // ─── Grupper ───

  const sokta = useMemo(() => rader.filter(r => matcharSok(r.trad, sok)), [rader, sok])

  const minaGrupper: ListGrupp[] = useMemo(() => {
    const till = (r: FragorRad): ListRad => ({ trad: r.trad, status: r.min.status, olasta: r.min.olasta })
    const av = (g: string) => sokta.filter(r => r.min.grupp === g).map(till)
    const fragor = av('fragor')
    const svar = av('svar')
    const vantar = av('vantar')
    const kannedom = av('kannedom')
    const klara = av('klara')
    const ut: ListGrupp[] = [
      {
        nyckel: 'dig', rubrik: 'Väntar på dig', ikon: 'falt.attgora', ikonFarg: 'text-amber-500',
        beskrivning: 'Någon har frågat dig något eller svarat på din fråga.',
        undergrupper: [{ rubrik: 'Frågor till dig', rader: fragor }, { rubrik: 'Svar till dig', rader: svar }],
      },
      {
        nyckel: 'andra', rubrik: 'Du väntar på svar', ikon: 'falt.vantar',
        beskrivning: 'Du har frågat. Svaret hamnar under Väntar på dig.',
        undergrupper: [{ rubrik: '', rader: vantar }],
      },
      {
        nyckel: 'kannedom', rubrik: 'Omnämnd, för kännedom', ikon: 'dok.omnamnd',
        beskrivning: 'Skickat till en grupp du hör till, eller trådar du är med i där inget väntar på dig.',
        undergrupper: [{ rubrik: '', rader: kannedom }],
      },
      {
        nyckel: 'klara', rubrik: 'Klara', ikon: 'falt.klart', ikonFarg: 'text-[#20c58f]', hopfalld: true,
        beskrivning: 'Markerade som klara, senast klara först. Ett nytt svar öppnar tråden igen.',
        undergrupper: [{ rubrik: '', rader: klara }],
        antal: sok ? klara.length : klaraTotalt,
        fler: harFlerKlara && !sok ? { text: 'Visa fler klara', onKlick: visaFlerKlara } : undefined,
      },
    ]
    return ut
  }, [sokta, klaraTotalt, harFlerKlara, visaFlerKlara, sok])

  const kontorFiltrerade = useMemo(() => sokta.filter(r => {
    const root = r.trad.root
    if (filterTyp && r.trad.caseType !== filterTyp) return false
    if (filterFran && root.author_id !== filterFran) return false
    if (baraOlasta && r.kontor.olasta === 0) return false
    if (filterTill) {
      const alla = r.trad.alla
      if (filterTill === 'alla') { if (!alla.some(c => c.mentions_all)) return false }
      else if (filterTill.startsWith('roll:')) { const rl = filterTill.slice(5); if (!alla.some(c => c.mentioned_roles.includes(rl))) return false }
      else if (filterTill.startsWith('person:')) { const id = filterTill.slice(7); if (!alla.some(c => c.mentioned_user_ids.includes(id))) return false }
    }
    if (filterStatus === 'oppna' && r.kontor.grupp === 'klara') return false
    if (filterStatus === 'klara' && r.kontor.grupp !== 'klara') return false
    return true
  }), [sokta, filterTyp, filterFran, baraOlasta, filterTill, filterStatus])

  const kontorGrupper: ListGrupp[] = useMemo(() => {
    const till = (r: FragorRad): ListRad => ({ trad: r.trad, status: r.kontor.status, olasta: r.kontor.olasta })
    const av = (g: string) => kontorFiltrerade.filter(r => r.kontor.grupp === g).map(till)
    const ut: ListGrupp[] = []
    if (filterStatus !== 'klara') {
      ut.push(
        {
          nyckel: 'roll', rubrik: 'Till en roll eller alla, ingen har svarat', ikon: 'dok.omnamnd', ikonFarg: 'text-amber-500',
          beskrivning: 'Skickat till admin, koordinatorerna, alla tekniker eller alla. Svara eller välj Jag tar den.',
          undergrupper: [{ rubrik: '', rader: av('roll') }],
        },
        {
          nyckel: 'person', rubrik: 'Väntar på en person', ikon: 'falt.vantar',
          beskrivning: 'En namngiven kollega är tillfrågad och har inte svarat.',
          undergrupper: [{ rubrik: '', rader: av('person') }],
        },
        {
          nyckel: 'besvarad', rubrik: 'Besvarade, inte klara', ikon: 'dok.konversation',
          beskrivning: 'Någon har svarat. Den som frågade markerar som klar.',
          undergrupper: [{ rubrik: '', rader: av('besvarad') }],
        },
      )
    }
    if (filterStatus !== 'oppna') {
      const klara = av('klara')
      ut.push({
        nyckel: 'klara', rubrik: 'Klara', ikon: 'falt.klart', ikonFarg: 'text-[#20c58f]', hopfalld: filterStatus === 'alla',
        beskrivning: 'Markerade som klara, alla, senast klara först.',
        undergrupper: [{ rubrik: '', rader: klara }],
        antal: sok || filterTill || filterFran || filterTyp || baraOlasta ? klara.length : klaraTotalt,
        fler: harFlerKlara ? { text: 'Visa fler klara', onKlick: visaFlerKlara } : undefined,
      })
    }
    if (filterStatus !== 'klara') {
      ut.push({
        nyckel: 'anteckning', rubrik: 'Anteckningar utan mottagare', ikon: 'allman.anteckning', hopfalld: true,
        beskrivning: 'Noteringar i ärenden, till exempel fakturanummer. Ingen väntar på svar.',
        undergrupper: [{ rubrik: '', rader: av('anteckning') }],
      })
    }
    return ut
  }, [kontorFiltrerade, filterStatus, klaraTotalt, harFlerKlara, visaFlerKlara, sok, filterTill, filterFran, filterTyp, baraOlasta])

  const grupper = lage === 'all' ? kontorGrupper : minaGrupper

  // Filteralternativ ur datan
  const tillVal = useMemo(() => {
    const personer = new Map<string, string>()
    const roller = new Set<string>()
    let alla = false
    for (const r of rader) for (const c of r.trad.alla) {
      c.mentioned_user_ids.forEach((id, i) => { if (id !== c.author_id) personer.set(id, c.mentioned_user_names[i] || 'Okänd') })
      c.mentioned_roles.forEach(rl => roller.add(rl))
      if (c.mentions_all) alla = true
    }
    return {
      personer: [...personer.entries()].sort((a, b) => a[1].localeCompare(b[1], 'sv')),
      roller: [...roller],
      alla,
    }
  }, [rader])
  const franVal = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of rader) m.set(r.trad.root.author_id, r.trad.root.author_name)
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'sv'))
  }, [rader])

  // Platt lista i visningsordning, för automatiskt val på datorn
  const synliga = useMemo(() => grupper.filter(g => !g.hopfalld).flatMap(g => g.undergrupper.flatMap(u => u.rader)), [grupper])
  useEffect(() => {
    if (!arDator || laddar || valdParam || caseIdParam) return
    if (synliga.length > 0) valj(synliga[0].trad)
  }, [arDator, laddar, valdParam, caseIdParam, synliga, valj])

  // ─── Sammanfattning ───

  const raknaMin = (g: string) => rader.filter(r => r.min.grupp === g).length
  const vantarPaMig = raknaMin('fragor') + raknaMin('svar')
  const jagVantar = raknaMin('vantar')
  const raknaKontor = (g: string) => rader.filter(r => r.kontor.grupp === g).length
  const sammanfattning = lage === 'all'
    ? [`${raknaKontor('roll')} till en roll utan svar`, `${raknaKontor('person')} väntar på en person`, `${raknaKontor('besvarad')} besvarade men inte klara`].join(', ')
    : `${vantarPaMig} väntar på dig, du väntar på svar i ${jagVantar}`

  useNySidhuvud({ underrubrik: laddar ? undefined : sammanfattning })

  // Förslag i dialogen: ärenden ur inkorgen
  const inkorgArenden: InkorgArende[] = useMemo(() => {
    const ut: InkorgArende[] = []
    for (const r of rader) {
      if (r.trad.root.status === 'resolved') continue
      if (!ut.some(a => a.id === r.trad.arende.id)) ut.push(r.trad.arende)
      if (ut.length >= 6) break
    }
    return ut
  }, [rader])

  const minRoll: AuthorRole = (['admin', 'koordinator', 'technician'] as const).includes(profile?.role as AuthorRole)
    ? (profile!.role as AuthorRole)
    : ((mig?.roller[0] as AuthorRole) || 'technician')

  if (!mig) return null

  const status = vald ? (lage === 'all' ? vald.kontor.status : vald.min.status) : null
  const tradVy = vald && status ? (
    <TradVy
      key={vald.trad.id}
      trad={vald.trad}
      status={status}
      forstaOlasta={vald.min.forstaOlasta}
      mig={mig}
      kvitton={kvittoKarta}
      minRoll={minRoll}
      onTillbaka={arDator ? undefined : () => valj(null)}
      onOppnaArende={() => setOppnaArende({ id: vald.trad.caseId, typ: vald.trad.caseType })}
      onVisaIKommunikation={() => setKomm({ caseId: vald.trad.caseId, caseType: vald.trad.caseType, titel: vald.trad.arende.kund, tradId: vald.trad.id })}
      onAndrat={uppdatera}
    />
  ) : null

  const visaListan = arDator || !tradVy
  const iTeknikervyn = activeView === 'technician'

  return (
    <div className="max-w-[1500px] mx-auto p-4 lg:p-6 flex flex-col gap-5">
      {visaListan && (
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            {!nyAktiv && <h1 className="text-2xl font-bold text-white leading-tight">Frågor och uppdrag</h1>}
            {!laddar && (
              <p className="mt-1 text-[15px] text-slate-300">
                {lage === 'all' ? sammanfattning : (
                  <>
                    <strong className={`font-semibold ${vantarPaMig > 0 ? 'text-amber-500' : 'text-slate-200'}`}>{vantarPaMig} väntar på dig</strong>
                    , du väntar på svar i {jagVantar}
                  </>
                )}
              </p>
            )}
          </div>
          <button type="button" onClick={() => setNyOppen(true)} className={`${KNAPP_PRIMAR} w-full sm:w-auto`}>
            <Icon name="allman.plus" size={20} />
            Ny fråga eller uppdrag
          </button>
        </header>
      )}

      {fel && (
        <div role="alert" className="rounded-2xl border border-red-500/40 bg-slate-900 p-4 text-[15px] text-red-400">{fel}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(420px,560px)] gap-6 items-start">
        {visaListan && (
          <div className="flex flex-col gap-5 min-w-0">
            {arKontor && (
              <div role="tablist" aria-label="Visa" className="flex gap-6 border-b border-slate-700">
                {([['mine', 'Min inkorg'], ['all', 'Alla']] as const).map(([v, t]) => (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    aria-selected={lage === v}
                    onClick={() => { setLage(v); valj(null) }}
                    className={`min-h-[44px] -mb-px border-b-2 text-[15px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
                      lage === v ? 'border-[#20c58f] text-white' : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}

            <label className="h-11 flex items-center gap-2 px-3 rounded-xl border border-slate-600 bg-slate-900 text-slate-400 focus-within:border-[#20c58f]">
              <Icon name="allman.sok" size={20} />
              <span className="sr-only">Sök i frågor och uppdrag</span>
              <input
                ref={sokRef}
                type="search"
                value={sok}
                onChange={e => setSok(e.target.value)}
                placeholder="Sök text, kund, ärendenummer eller person"
                className="flex-1 min-w-0 bg-transparent text-[15px] text-white placeholder-slate-500 focus:outline-none"
              />
              <kbd aria-hidden="true" title="Tryck / för att söka" className="hidden sm:inline font-mono text-sm text-slate-500 border border-slate-600 rounded-md px-1.5">/</kbd>
            </label>

            {lage === 'all' && (
              <fieldset className="flex flex-wrap items-end gap-3">
                <legend className="sr-only">Filter</legend>
                <label className="flex flex-col gap-1 text-sm text-slate-400">
                  Till
                  <select value={filterTill} onChange={e => setFilterTill(e.target.value)} className={SELECT}>
                    <option value="">Alla mottagare</option>
                    {tillVal.roller.map(r => <option key={r} value={`roll:${r}`}>{rollMottagare(r).charAt(0).toUpperCase() + rollMottagare(r).slice(1)}</option>)}
                    {tillVal.alla && <option value="alla">Alla (@alla)</option>}
                    {tillVal.personer.map(([id, n]) => <option key={id} value={`person:${id}`}>{n}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-slate-400">
                  Från
                  <select value={filterFran} onChange={e => setFilterFran(e.target.value)} className={SELECT}>
                    <option value="">Alla</option>
                    {franVal.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-slate-400">
                  Ärendetyp
                  <select value={filterTyp} onChange={e => setFilterTyp(e.target.value as '' | CaseType)} className={SELECT}>
                    <option value="">Alla</option>
                    {(['private', 'business', 'contract'] as CaseType[]).map(t => <option key={t} value={t}>{arendeTypText(t)}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-slate-400">
                  Status
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as StatusFilter)} className={SELECT}>
                    <option value="oppna">Öppna</option>
                    <option value="klara">Klara</option>
                    <option value="alla">Alla</option>
                  </select>
                </label>
                <label className="h-11 inline-flex items-center gap-2 text-[15px] text-slate-200 cursor-pointer">
                  <input type="checkbox" checked={baraOlasta} onChange={e => setBaraOlasta(e.target.checked)} className="w-5 h-5 accent-[#20c58f]" />
                  Bara olästa
                </label>
              </fieldset>
            )}

            {laddar && rader.length === 0 ? (
              <div className="flex items-center gap-2 py-10 justify-center text-[15px] text-slate-400" role="status">
                <Icon name="allman.laddar" size={20} className="animate-spin" />
                Hämtar frågor och uppdrag...
              </div>
            ) : rader.length === 0 && !fel ? (
              <div className="py-10 flex flex-col items-center text-center gap-2">
                <Icon name="dok.konversation" size={32} className="text-slate-500" />
                <p className="text-[17px] font-semibold text-white">Inga frågor eller uppdrag än</p>
                <p className="max-w-md text-[15px] text-slate-400">
                  Skriv till en kollega med Ny fråga eller uppdrag, eller nämn någon med @ i ett ärendes kommunikation.
                </p>
              </div>
            ) : (
              <TradLista
                grupper={grupper}
                valdId={vald?.trad.id || null}
                onValj={valj}
                mig={mig}
                visaNummer={lage === 'all'}
              />
            )}
          </div>
        )}

        {(arDator || tradVy) && (
          <div className="min-w-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1">
            {tradVy || (
              <div className="hidden lg:flex flex-col items-center justify-center text-center gap-2 rounded-2xl border border-dashed border-slate-700 p-10">
                <Icon name="dok.konversation" size={32} className="text-slate-500" />
                <p className="text-[15px] text-slate-400">Välj en tråd i listan.</p>
              </div>
            )}
          </div>
        )}
      </div>

      <NyFragaDialog
        oppen={nyOppen}
        onClose={() => setNyOppen(false)}
        forslag={inkorgArenden}
        onSkickad={rotId => {
          if (lage !== 'mine') setLage('mine')
          sattParam(p => { p.set('thread', rotId); p.delete('caseId'); p.delete('caseType') })
          uppdatera()
        }}
      />

      {oppnaArende && (iTeknikervyn ? (
        <OppnaArende
          arende={{ kalla: oppnaArende.typ === 'contract' ? 'cases' : oppnaArende.typ, id: oppnaArende.id }}
          onClose={() => setOppnaArende(null)}
          onSaved={uppdatera}
        />
      ) : (
        <OppnaArendeKontor arende={oppnaArende} onClose={() => { setOppnaArende(null); uppdatera() }} />
      ))}

      <CaseContextCommunicationModal
        isOpen={!!komm}
        onClose={() => { setKomm(null); uppdatera() }}
        caseId={komm?.caseId || ''}
        caseType={komm?.caseType || 'private'}
        caseTitle={komm?.titel || ''}
        markeradTradId={komm?.tradId || null}
        onOpenFullCase={(caseId, caseType) => { setKomm(null); setOppnaArende({ id: caseId, typ: caseType }) }}
      />
    </div>
  )
}

