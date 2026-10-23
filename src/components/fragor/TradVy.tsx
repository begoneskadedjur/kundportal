// src/components/fragor/TradVy.tsx
// En tråd i Tickets: ärendet som kort med Öppna ärendet och Visa i ärendets
// kommunikation, Vem är med, konversationen med läskvitton och Nytt sedan du läste,
// och svarsrutan. Svar sparas med samma kod som kommunikationspanelen (skickaKommentar),
// så tråden är densamma här och i ärendet.

import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Icon } from '../icons/Icon'
import type { AuthorRole, CaseComment } from '../../types/communication'
import type { InkorgKvitto } from '../../services/communicationService'
import { deleteComment, markCommentAsRead, updateComment, updateCommentStatus } from '../../services/communicationService'
import { skickaKommentar } from '../../hooks/useCaseComments'
import { useBilagaUrl } from '../communication/useBilagaUrl'
import type { TrackedMention } from '../../hooks/useMentions'
import {
  datumTid, fornamn, fragorITrad, kanAndraStatus, kanTaDen, lastAvText, rollMottagare, rollText,
  amne as amneFor, dagarSedan, GUL_EFTER_DAGAR, arendeTypText,
  type Mig, type Status, type Trad,
} from './fragorLogik'
import { IKONKNAPP, Initial, KNAPP_PRIMAR, KNAPP_SEKUNDAR, StatusText, TextMedNamningar } from './fragorUi'
import SvarsRuta from './SvarsRuta'

interface Props {
  trad: Trad
  status: Status
  /** Första olästa kommentaren när tråden öppnades */
  forstaOlasta: string | null
  mig: Mig
  kvitton: Map<string, InkorgKvitto[]>
  /** Profilens primära roll, sparas som author_role */
  minRoll: AuthorRole
  onTillbaka?: () => void
  onOppnaArende: () => void
  onVisaIKommunikation: () => void
  onAndrat: () => void
}

interface Deltagare {
  nyckel: string
  namn: string
  beskrivning: string
  lage: Status
}

function deltagare(trad: Trad, mig: Mig): Deltagare[] {
  const fr = fragorITrad(trad)
  const ut: Deltagare[] = []
  const sett = new Set<string>()
  const r = trad.root
  const arMig = (id: string) => id === mig.id

  // Den som startade
  const rotFragor = fr.filter(f => f.kommentar.author_id === r.author_id && !f.besvarad && !f.tog)
  ut.push({
    nyckel: r.author_id,
    namn: arMig(r.author_id) ? 'Du' : r.author_name,
    beskrivning: `${rollText(r.author_role) ? `${rollText(r.author_role).charAt(0).toUpperCase()}${rollText(r.author_role).slice(1)}, ` : ''}startade tråden`,
    lage: rotFragor.length > 0
      ? { ton: 'gra', text: 'Väntar på svar' }
      : { ton: 'gra', text: '' },
  })
  sett.add(r.author_id)

  // Personer som frågats eller tog den
  for (const f of fr.filter(x => x.typ === 'person')) {
    const id = f.till as string
    if (sett.has(id) && !f.tog) continue
    const senaste = fr.filter(x => x.typ === 'person' && x.till === id)
    const obesvarad = senaste.find(x => !x.besvarad)
    const tog = senaste.some(x => x.tog)
    const idx = ut.findIndex(d => d.nyckel === id)
    const lage: Status = obesvarad
      ? (dagarSedan(obesvarad.kommentar.created_at) >= GUL_EFTER_DAGAR
        ? { ton: 'gul', text: `Inte svarat på ${dagarSedan(obesvarad.kommentar.created_at)} dagar` }
        : { ton: arMig(id) ? 'bla' : 'gra', text: arMig(id) ? 'Väntar på dig' : 'Inte svarat än' })
      : { ton: 'gron', text: 'Har svarat' }
    const d: Deltagare = {
      nyckel: id,
      namn: arMig(id) ? 'Du' : (f.tillNamn || 'Okänd'),
      beskrivning: tog ? 'Tog den' : 'Tillfrågad',
      lage,
    }
    if (idx >= 0) {
      if (tog) ut[idx] = { ...ut[idx], beskrivning: `${ut[idx].beskrivning}, tog den`, lage }
    } else {
      ut.push(d)
    }
    sett.add(id)
  }

  // Grupper
  const grupper = new Map<string, boolean>()
  for (const f of fr) {
    if (f.typ === 'person') continue
    const nyckel = f.typ === 'alla' ? 'alla' : (f.roll || '')
    grupper.set(nyckel, (grupper.get(nyckel) ?? true) && f.besvarad)
  }
  for (const [nyckel, besvarad] of grupper) {
    const namn = nyckel === 'alla' ? 'Alla' : rollMottagare(nyckel)
    ut.push({
      nyckel: `grupp:${nyckel}`,
      namn: `${namn.charAt(0).toUpperCase()}${namn.slice(1)}`,
      beskrivning: 'Grupp',
      lage: besvarad ? { ton: 'gron', text: 'Någon har svarat' } : { ton: 'gra', text: 'Ingen har svarat' },
    })
  }

  // Övriga som skrivit
  for (const c of trad.svar) {
    if (sett.has(c.author_id)) continue
    sett.add(c.author_id)
    ut.push({
      nyckel: c.author_id,
      namn: arMig(c.author_id) ? 'Du' : c.author_name,
      beskrivning: 'Skrev i tråden',
      lage: { ton: 'gra', text: '' },
    })
  }
  return ut
}

function Bilagor({ kommentar }: { kommentar: CaseComment }) {
  if (!kommentar.attachments?.length) return null
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {kommentar.attachments.map(a => (
        <li key={a.url}><Bilaga bilaga={a} /></li>
      ))}
    </ul>
  )
}

function Bilaga({ bilaga: a }: { bilaga: NonNullable<CaseComment['attachments']>[number] }) {
  const url = useBilagaUrl(a.url)
  if (a.mimetype?.startsWith('image/')) {
    if (!url) return <div className="w-28 h-28 rounded-lg border border-slate-700 bg-slate-800 animate-pulse" />
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]">
        <img src={url} alt={a.filename} className="w-28 h-28 object-cover" loading="lazy" />
      </a>
    )
  }
  return (
    <a
      href={url ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={!url}
      className="min-h-[44px] inline-flex items-center gap-2 px-3 rounded-lg border border-slate-700 text-sm text-slate-200 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
    >
      <Icon name="rapport.gem" size={16} className="text-slate-400" />
      <span className="truncate max-w-[220px]">{a.filename}</span>
    </a>
  )
}

export default function TradVy({
  trad, status, forstaOlasta, mig, kvitton, minRoll,
  onTillbaka, onOppnaArende, onVisaIKommunikation, onAndrat,
}: Props) {
  const [skickar, setSkickar] = useState(false)
  const [andrarStatus, setAndrarStatus] = useState(false)
  const [redigerar, setRedigerar] = useState<string | null>(null)
  const [redText, setRedText] = useState('')
  const [tarBort, setTarBort] = useState<string | null>(null)
  const nyttRef = useRef<HTMLLIElement | null>(null)

  // "Nytt sedan du läste" fryses när tråden öppnas, annars försvinner den direkt
  const [nyttFran, setNyttFran] = useState<string | null>(forstaOlasta)
  useEffect(() => {
    setNyttFran(forstaOlasta)
    setRedigerar(null)
    setTarBort(null)
    // bara när en annan tråd väljs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trad.id])

  // Markera andras repliker som lästa när tråden visas
  const olastaIds = useMemo(
    () => trad.alla.filter(c => c.author_id !== mig.id && !(kvitton.get(c.id) || []).some(k => k.userId === mig.id)).map(c => c.id),
    [trad.alla, kvitton, mig.id]
  )
  useEffect(() => {
    if (olastaIds.length === 0) return
    const t = setTimeout(() => {
      Promise.all(olastaIds.map(id => markCommentAsRead(id, mig.id))).catch(() => {})
    }, 800)
    return () => clearTimeout(t)
  }, [olastaIds, mig.id])

  useEffect(() => {
    if (!nyttFran) return
    const t = setTimeout(() => nyttRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 200)
    return () => clearTimeout(t)
  }, [nyttFran, trad.id])

  const arKlar = trad.root.status === 'resolved'
  const farAndra = kanAndraStatus(trad, mig)
  const farTa = kanTaDen(trad, mig)
  const arAdmin = mig.roller.includes('admin')
  const med = deltagare(trad, mig)
  const a = trad.arende
  const sistaAnnan = [...trad.alla].reverse().find(c => c.author_id !== mig.id)

  const skicka = async (text: string, filer: File[], namningar: TrackedMention[], tyst = false): Promise<boolean> => {
    setSkickar(true)
    try {
      await skickaKommentar({
        userId: mig.id,
        role: minRoll,
        caseId: trad.caseId,
        caseType: trad.caseType,
        caseTitle: a.kund,
        content: text,
        attachments: filer,
        mentions: namningar,
        parentCommentId: trad.root.id,
      })
      if (!tyst) toast.success(arKlar ? 'Svaret skickades och tråden öppnades igen' : 'Svaret skickades')
      onAndrat()
      return true
    } catch (e) {
      console.error('[TradVy] skicka', e)
      toast.error('Svaret kunde inte skickas')
      return false
    } finally {
      setSkickar(false)
    }
  }

  const andraStatus = async () => {
    setAndrarStatus(true)
    try {
      await updateCommentStatus(trad.root.id, arKlar ? 'open' : 'resolved')
      toast.success(arKlar ? 'Tråden är öppen igen' : 'Markerad som klar')
      onAndrat()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Statusen kunde inte ändras')
    } finally {
      setAndrarStatus(false)
    }
  }

  const taDen = async () => {
    const ok = await skicka('Jag tar den.', [], [{ type: 'user', userId: mig.id, displayName: mig.namn || 'Jag' }], true)
    if (ok) toast.success('Tråden väntar nu på dig')
  }

  const sparaRedigering = async (id: string) => {
    if (!redText.trim()) {
      toast.error('Texten kan inte vara tom')
      return
    }
    try {
      await updateComment(id, { content: redText.trim() })
      setRedigerar(null)
      toast.success('Ändringen sparades')
      onAndrat()
    } catch {
      toast.error('Ändringen kunde inte sparas')
    }
  }

  const taBortKommentar = async (id: string) => {
    try {
      await deleteComment(id)
      setTarBort(null)
      toast.success(id === trad.root.id ? 'Tråden togs bort' : 'Repliken togs bort')
      onAndrat()
    } catch {
      toast.error('Kunde inte ta bort')
    }
  }

  return (
    <article aria-labelledby="trad-rubrik" className="flex flex-col gap-5">
      {onTillbaka && (
        <button type="button" onClick={onTillbaka} className="self-start min-h-[44px] -ml-2 px-2 inline-flex items-center gap-1 rounded-xl text-[15px] font-medium text-slate-300 hover:text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]">
          <Icon name="allman.chevron-vanster" size={20} />
          Tickets
        </button>
      )}

      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="trad-rubrik" className="text-xl font-bold text-white leading-snug break-words">{amneFor(trad)}</h2>
            <div className="mt-1"><StatusText ton={status.ton}>{status.text}</StatusText></div>
          </div>
        </div>
        {(farAndra || farTa) && (
          <div className="flex flex-wrap gap-2">
            {farTa && (
              <button type="button" onClick={taDen} disabled={skickar} className={KNAPP_SEKUNDAR}>
                <Icon name="allman.hand" size={20} />
                Jag tar den
              </button>
            )}
            {farAndra && (
              <button type="button" onClick={andraStatus} disabled={andrarStatus} className={arKlar ? KNAPP_SEKUNDAR : KNAPP_PRIMAR}>
                <Icon name={arKlar ? 'allman.aterstall' : 'allman.bock'} size={20} />
                {arKlar ? 'Öppna igen' : 'Markera som klar'}
              </button>
            )}
          </div>
        )}
        {farAndra && !arKlar && (
          <p className="text-sm text-slate-400">Klar flyttar tråden till Klara för alla. Ett nytt svar öppnar den igen.</p>
        )}
      </header>

      {/* Ärendet */}
      <section aria-label="Ärendet" className="rounded-2xl border border-slate-700 bg-slate-900 p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="w-10 h-10 flex-shrink-0 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center">
            <Icon name={a.typ === 'contract' ? 'kund.avtal' : a.typ === 'business' ? 'allman.foretag' : 'arende.privat'} size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-white break-words">
              {a.kund}
              {a.nummer && <span className="ml-2 font-mono text-sm font-normal text-slate-400">{a.nummer}</span>}
            </p>
            {(a.skadedjur || a.adress) && (
              <p className="text-sm text-slate-300 break-words">{[a.skadedjur, a.adress].filter(Boolean).join(', ')}</p>
            )}
            <p className="text-sm text-slate-400">
              {arendeTypText(a.typ)}
              {a.bokad ? `, bokat ${datumTid(a.bokad)}${a.tekniker ? ` hos ${a.tekniker === mig.namn ? 'dig' : fornamn(a.tekniker)}` : ''}` : ', inte bokat'}
              {a.status ? `, ${a.status.toLowerCase()}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onOppnaArende} className={KNAPP_SEKUNDAR}>
            <Icon name="rapport.oppna" size={20} />
            Öppna ärendet
          </button>
          <button type="button" onClick={onVisaIKommunikation} className={KNAPP_SEKUNDAR}>
            <Icon name="dok.konversation" size={20} />
            Visa i ärendets kommunikation
          </button>
        </div>
      </section>

      {/* Vem är med */}
      <section aria-labelledby="trad-med" className="flex flex-col gap-2">
        <h3 id="trad-med" className="text-base font-semibold text-white">Vem är med</h3>
        <ul className="rounded-2xl border border-slate-700 bg-slate-900 divide-y divide-slate-700/60">
          {med.map(d => (
            <li key={d.nyckel} className="flex items-center gap-3 px-4 py-3">
              {d.nyckel.startsWith('grupp:') ? (
                <span aria-hidden="true" className="w-9 h-9 flex-shrink-0 rounded-full bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center">
                  <Icon name="dok.omnamnd" size={16} />
                </span>
              ) : <Initial namn={d.namn} />}
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-white truncate">{d.namn}</span>
                <span className="block text-sm text-slate-400 truncate">{d.beskrivning}</span>
              </span>
              {d.lage.text && <StatusText ton={d.lage.ton} className="text-right">{d.lage.text}</StatusText>}
            </li>
          ))}
        </ul>
      </section>

      {/* Konversation */}
      <section aria-labelledby="trad-konv" className="flex flex-col gap-2">
        <h3 id="trad-konv" className="text-base font-semibold text-white">
          Konversation <span className="font-normal text-slate-400">{trad.alla.length}</span>
        </h3>
        <ol className="flex flex-col gap-3">
          {trad.alla.map(c => {
            const egen = c.author_id === mig.id
            const lastText = egen ? lastAvText(kvitton.get(c.id) || [], mig) : ''
            const minLast = (kvitton.get(c.id) || []).find(k => k.userId === mig.id)
            return (
              <li key={c.id} ref={c.id === nyttFran ? nyttRef : undefined} className="flex flex-col gap-3">
                {c.id === nyttFran && c.id !== trad.root.id && (
                  <div className="flex items-center gap-3" role="separator">
                    <span className="h-px flex-1 bg-sky-500/50" />
                    <span className="text-sm font-semibold text-sky-400">Nytt sedan du läste</span>
                    <span className="h-px flex-1 bg-sky-500/50" />
                  </div>
                )}
                <div className={`rounded-2xl border p-4 ${egen ? 'border-[#20c58f]/30 bg-[#20c58f]/5' : 'border-slate-700 bg-slate-900'}`}>
                  <div className="flex items-start gap-3">
                    <Initial namn={c.author_name} />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-[15px] font-semibold text-white">{egen ? 'Du' : c.author_name}</span>
                        {!egen && rollText(c.author_role) && <span className="text-sm text-slate-400">{rollText(c.author_role)}</span>}
                        <span className="font-mono text-sm text-slate-400">{datumTid(c.created_at)}</span>
                        {c.is_edited && <span className="text-sm text-slate-500">ändrad</span>}
                      </p>
                      {redigerar === c.id ? (
                        <div className="mt-2 flex flex-col gap-2">
                          <label htmlFor={`red-${c.id}`} className="sr-only">Ändra texten</label>
                          <textarea
                            id={`red-${c.id}`}
                            value={redText}
                            onChange={e => setRedText(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 rounded-xl border border-slate-600 bg-slate-950 text-[15px] text-white focus:outline-none focus:border-[#20c58f]"
                          />
                          <div className="flex gap-2">
                            <button type="button" className={KNAPP_PRIMAR} onClick={() => sparaRedigering(c.id)}>Spara</button>
                            <button type="button" className={KNAPP_SEKUNDAR} onClick={() => setRedigerar(null)}>Avbryt</button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-1 text-[15px] leading-relaxed text-slate-200 whitespace-pre-wrap break-words">
                          <TextMedNamningar kommentar={c} />
                        </p>
                      )}
                      <Bilagor kommentar={c} />
                      {tarBort === c.id && (
                        <div className="mt-3 flex flex-wrap items-center gap-2" role="alert">
                          <span className="text-sm text-slate-300">
                            {c.id === trad.root.id ? 'Ta bort hela tråden? Svaren försvinner också.' : 'Ta bort repliken?'}
                          </span>
                          <button type="button" className={KNAPP_SEKUNDAR} onClick={() => taBortKommentar(c.id)}>Ta bort</button>
                          <button type="button" className={KNAPP_SEKUNDAR} onClick={() => setTarBort(null)}>Avbryt</button>
                        </div>
                      )}
                    </div>
                    {(egen || arAdmin) && redigerar !== c.id && (
                      <div className="flex -mr-2 -mt-2">
                        {egen && (
                          <button type="button" className={IKONKNAPP} aria-label="Ändra texten" title="Ändra texten" onClick={() => { setRedigerar(c.id); setRedText(c.content) }}>
                            <Icon name="rapport.penna" size={20} />
                          </button>
                        )}
                        <button type="button" className={IKONKNAPP} aria-label="Ta bort" title="Ta bort" onClick={() => setTarBort(c.id)}>
                          <Icon name="allman.radera" size={20} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {(lastText || (!egen && minLast)) && (
                  <p className="-mt-1 px-4 text-sm text-slate-500">
                    {lastText || `Läst av dig ${datumTid(minLast!.readAt).slice(11)}`}
                  </p>
                )}
              </li>
            )
          })}
        </ol>
      </section>

      <SvarsRuta
        onSkicka={(t, f, n) => skicka(t, f, n)}
        skickar={skickar}
        etikett={sistaAnnan ? `Svar till ${fornamn(sistaAnnan.author_name)}` : 'Svar'}
        knappText="Skicka svar"
        hint={farTa ? 'Jag tar den gör tråden din' : undefined}
      />
    </article>
  )
}
