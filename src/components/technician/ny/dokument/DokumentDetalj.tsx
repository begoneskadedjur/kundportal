// src/components/technician/ny/dokument/DokumentDetalj.tsx
// Valt dokument i teknikerns Dokumentsignering.
//
// Överst namn, typ, belopp, nummer, skickad och frist, Öppna i Oneflow och en meny
// (Öppna ärendet, Kundens stationer, Dölj i min lista, Radera). Sedan nästa steg-rutan
// med EN primär knapp (Svara kunden, Förläng och påminn, Ring kunden, Granska och
// skicka, Öppna ärendet), dokumentets väg och flikarna Konversation, Aktivitet, Innehåll.
//
// Dator: panel bredvid listan. Telefon: egen vy (?id=) med Tillbaka och ett fast
// åtgärdsfält ovanför bottenmenyn.
//
// Data och anrop är desamma som DocumentDetailPanel: konversationen ur oneflow_comments
// och synk från Oneflow, interna anteckningar via useCaseComments, samtalslogg,
// kundinlägg markeras lästa efter 2 s, utkast skickas med OneflowDraftService.publish.

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Icon, type IconName } from '../../../icons/Icon'
import Modal from '../../../ui/Modal'
import OneflowPdfFrame from '../../../shared/OneflowPdfFrame'
import { OfferFollowUpService, type FollowUpOffer } from '../../../../services/offerFollowUpService'
import { OneflowDraftService } from '../../../../services/oneflowDraftService'
import { useCaseComments } from '../../../../hooks/useCaseComments'
import type { ArendeRef } from '../OppnaArende'
import {
  UTFALL_TEXT, kallArende, kr, kundHarStationer, nastaSteg, svDatum,
  type Behorighet, type Bokning, type Plats, type SamtalInfo,
} from './dokumentData'
import { DokumentVag } from './DokumentVag'
import { Konversation, type Inlagg, type Kanal } from './Konversation'
import { Aktivitet, Innehall, type Samtalsrad } from './AktivitetInnehall'
import { ForlangPaminn } from './ForlangPaminn'
import { LoggaSamtal } from './LoggaSamtal'
import { IKONKNAPP, KNAPP_PRIMAR, KNAPP_SEKUNDAR, Punkt, RADKNAPP, RAM_IKONKNAPP, RUTA, telUrl } from './dokumentUi'

type Flik = 'konversation' | 'aktivitet' | 'innehall'

export interface DokumentDetaljRef {
  fokusera: () => void
}

interface Props {
  offer: FollowUpOffer
  plats: Plats
  bokning?: Bokning
  samtalInfo?: SamtalInfo
  behorighet: Behorighet
  userId: string | null
  userName: string | null
  userEmail: string | null
  arDator: boolean
  onAndrat: () => void
  onDolj: (o: FollowUpOffer) => void
  onVisaIgen: (o: FollowUpOffer) => void
  onSkrivAv: (o: FollowUpOffer) => void
  onRadera: (o: FollowUpOffer) => void
  onOppnaArende: (a: ArendeRef) => void
  onTillbaka: () => void
}

type OneflowInlagg = Awaited<ReturnType<typeof OfferFollowUpService.getOneflowConversation>>

export const DokumentDetalj = forwardRef<DokumentDetaljRef, Props>(function DokumentDetalj({
  offer: o, plats, bokning, samtalInfo, behorighet: b, userId, userName, userEmail, arDator,
  onAndrat, onDolj, onVisaIgen, onSkrivAv, onRadera, onOppnaArende, onTillbaka,
}, ref) {
  const navigate = useNavigate()
  const rubrikRef = useRef<HTMLHeadingElement>(null)
  const skrivRef = useRef<HTMLTextAreaElement>(null)
  useImperativeHandle(ref, () => ({
    fokusera: () => {
      rubrikRef.current?.focus()
      rubrikRef.current?.scrollIntoView({ block: 'nearest' })
    },
  }), [])

  const [flik, setFlik] = useState<Flik>('konversation')
  const [oneflow, setOneflow] = useState<OneflowInlagg>([])
  const [samtal, setSamtal] = useState<Samtalsrad[]>([])
  const [kanal, setKanal] = useState<Kanal>('internal')
  const [utkast, setUtkast] = useState('')
  const [skickar, setSkickar] = useState(false)
  const [panel, setPanel] = useState<'forlang' | 'samtal' | null>(null)
  const [meny, setMeny] = useState(false)
  const [visaPdf, setVisaPdf] = useState(false)
  const [publicerar, setPublicerar] = useState(false)
  const [stationer, setStationer] = useState(false)
  const menyRef = useRef<HTMLDivElement>(null)

  const { comments: interna, addComment, isLoading: internaLaddar } = useCaseComments({
    caseId: o.id,
    caseType: 'contract',
    caseTitle: o.company_name || undefined,
  })

  // Nollställ och ladda vid dokumentbyte
  useEffect(() => {
    let avbruten = false
    setFlik('konversation')
    setUtkast('')
    setPanel(null)
    setMeny(false)
    setVisaPdf(false)
    setStationer(false)
    setKanal(o.queue_category === 'svar' && b.oneflow ? 'oneflow' : 'internal')

    OfferFollowUpService.getOneflowConversation(o.oneflow_contract_id)
      .then(d => { if (!avbruten) setOneflow(d) })
      .catch(() => { if (!avbruten) setOneflow([]) })
    // Synk från Oneflow kräver Oneflow-behörighet (api/oneflow/comments)
    if (b.oneflow) {
      OfferFollowUpService.syncConversationFromOneflow(o.oneflow_contract_id)
        .then(nytt => {
          if (avbruten || !nytt) return
          return OfferFollowUpService.getOneflowConversation(o.oneflow_contract_id).then(d => { if (!avbruten) setOneflow(d) })
        })
        .catch(() => {})
    }
    OfferFollowUpService.getCallLogs(o.id)
      .then(d => { if (!avbruten) setSamtal(d) })
      .catch(() => { if (!avbruten) setSamtal([]) })
    if (o.customer_id) {
      kundHarStationer(o.customer_id).then(h => { if (!avbruten) setStationer(h) }).catch(() => {})
    }
    return () => { avbruten = true }
    // Bara vid byte av dokument, inte när listan läses om
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.id])

  // Kundinlägg markeras lästa efter 2 s i konversationen (samma som gamla vyn)
  useEffect(() => {
    if (!userId || flik !== 'konversation' || o.unread_customer_comments === 0) return
    const t = setTimeout(async () => {
      const ids = oneflow.filter(c => c.author_type === 'customer').map(c => c.id)
      if (ids.length > 0) {
        await OfferFollowUpService.markCommentsRead(ids, userId)
        onAndrat()
      }
    }, 2000)
    return () => clearTimeout(t)
  }, [o.id, o.unread_customer_comments, flik, oneflow, userId, onAndrat])

  // Menyn stängs med Escape och klick utanför
  useEffect(() => {
    if (!meny) return
    const klick = (e: MouseEvent) => { if (menyRef.current && !menyRef.current.contains(e.target as Node)) setMeny(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setMeny(false) } }
    document.addEventListener('mousedown', klick)
    window.addEventListener('keydown', esc, true)
    return () => { document.removeEventListener('mousedown', klick); window.removeEventListener('keydown', esc, true) }
  }, [meny])

  // Telefon: panelen öppnas i nästa steg-rutan högst upp, visa den
  useEffect(() => {
    if (arDator || !panel) return
    document.querySelector('[data-genomgang="dok-nasta"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [panel, arDator])

  const minEpost = (userEmail || '').toLowerCase()
  const arMitt = !!minEpost && [o.created_by_email, o.begone_employee_email].some(e => (e || '').toLowerCase() === minEpost)

  const inlagg = useMemo<Inlagg[]>(() => {
    const lista: Inlagg[] = oneflow.map(c => ({
      key: `of-${c.id}`,
      kanal: 'oneflow',
      forfattare: c.author_name || 'Okänd',
      arKund: c.author_type === 'customer',
      arMitt: c.author_type === 'internal' && !!userName && c.author_name === userName,
      text: c.body,
      at: c.commented_at,
    }))
    for (const c of interna) {
      if (c.is_system_comment) continue
      lista.push({ key: `in-${c.id}`, kanal: 'internal', forfattare: c.author_name, arKund: false, arMitt: c.author_id === userId, text: c.content, at: c.created_at })
    }
    return lista.sort((a, c) => a.at.localeCompare(c.at))
  }, [oneflow, interna, userName, userId])

  const system = useMemo(
    () => interna.filter(c => c.is_system_comment).map(c => ({ id: c.id, text: c.content, at: c.created_at })),
    [interna],
  )

  const skicka = useCallback(async () => {
    const text = utkast.trim()
    if (!text || skickar) return
    setSkickar(true)
    try {
      if (kanal === 'internal') {
        await addComment(text)
      } else {
        const svar = await OfferFollowUpService.postComment(o.oneflow_contract_id, text)
        await OfferFollowUpService.mirrorPostedComment(o.oneflow_contract_id, { id: svar?.id ?? svar?.data?.id, body: text }, { name: userName })
        await OfferFollowUpService.syncConversationFromOneflow(o.oneflow_contract_id)
        setOneflow(await OfferFollowUpService.getOneflowConversation(o.oneflow_contract_id))
        toast.success('Svaret är skickat i Oneflow')
      }
      setUtkast('')
    } catch (err) {
      console.error('Skicka meddelande:', err)
      toast.error('Kunde inte skicka meddelandet')
    } finally {
      setSkickar(false)
    }
  }, [utkast, skickar, kanal, addComment, o.oneflow_contract_id, userName])

  const publicera = useCallback(async () => {
    if (publicerar) return
    const vad = o.type === 'offer' ? 'offerten' : 'avtalet'
    if (!window.confirm(`Skicka ${vad} till ${o.contact_email || 'kunden'} från info@begone.se?`)) return
    setPublicerar(true)
    try {
      await OneflowDraftService.publish(o.oneflow_contract_id)
      toast.success(o.type === 'offer' ? 'Offerten är skickad' : 'Avtalet är skickat för signering')
      setVisaPdf(false)
      onAndrat()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Kunde inte skicka dokumentet')
    } finally {
      setPublicerar(false)
    }
  }, [o, publicerar, onAndrat])

  // ─── Härledda värden ───
  const namn = o.company_name || o.contact_person || 'Namnlös'
  const kontakt = o.contact_person || o.company_name || 'kunden'
  const fornamn = kontakt.split(/\s+/)[0]
  const steg = nastaSteg(o, plats, b, bokning, kontakt)
  const typ = o.type === 'offer' ? 'Offert' : 'Avtal'
  const belopp = kr(o.total_value)
  const utkastDok = o.status === 'draft'
  const forfallen = o.status === 'overdue' && !o.action?.dismissed_at
  const kalla = kallArende(o)
  const dold = !!userId && (o.hidden_by || []).includes(userId)
  const kanRadera = b.oneflow && (utkastDok || forfallen)
  const kanSkrivaAv = b.atgarder && forfallen
  const sandare = arMitt ? 'av dig' : (o.created_by_name || o.begone_employee_name) ? `av ${o.created_by_name || o.begone_employee_name}` : ''
  const frist = o.signing_deadline
    ? (o.status === 'overdue' ? `fristen gick ut ${o.signing_deadline}` : o.status === 'pending' ? `fristen går ut ${o.signing_deadline}` : null)
    : null
  const samtalRad = samtalInfo && samtalInfo.antal > 0 && samtalInfo.senast
    ? `${samtalInfo.antal} samtal, senast ${svDatum(samtalInfo.senast.at)}: ${UTFALL_TEXT[samtalInfo.senast.outcome] ?? 'loggat'}`
    : null

  const svara = () => {
    setFlik('konversation')
    setKanal(b.oneflow ? 'oneflow' : 'internal')
    setTimeout(() => { skrivRef.current?.focus(); skrivRef.current?.scrollIntoView({ block: 'center' }) }, 50)
  }

  const ringKnapp = (primar: boolean, kort = false) => o.contact_phone ? (
    <a
      href={telUrl(o.contact_phone)}
      onClick={() => setPanel('samtal')}
      className={`${primar ? KNAPP_PRIMAR : KNAPP_SEKUNDAR} ${arDator ? '' : 'w-full'}`}
    >
      <Icon name="kontakt.telefon" size={20} />
      {kort ? `Ring ${fornamn}` : `Ring ${kontakt}`}
    </a>
  ) : null

  const loggaKnapp = !utkastDok && (
    <button type="button" onClick={() => setPanel(p => p === 'samtal' ? null : 'samtal')} aria-expanded={panel === 'samtal'} className={`${KNAPP_SEKUNDAR} ${arDator ? '' : 'w-full'}`}>
      <Icon name="allman.anteckning" size={20} />
      Logga samtal
    </button>
  )

  const primarKnapp = (() => {
    const bas = `${KNAPP_PRIMAR} ${arDator ? '' : 'w-full'}`
    const knapp = (ikon: IconName, text: string, onClick: () => void, aria?: boolean) => (
      <button type="button" onClick={onClick} aria-expanded={aria} className={bas}>
        <Icon name={ikon} size={20} />{text}
      </button>
    )
    switch (steg.primar) {
      case 'svara': return knapp('dok.konversation', 'Svara kunden', svara)
      case 'forlang': return knapp('upphandling.forlangning', 'Förläng och påminn', () => setPanel(p => p === 'forlang' ? null : 'forlang'), panel === 'forlang')
      case 'skicka': return knapp('rapport.oppna', 'Granska och skicka', () => setVisaPdf(true))
      case 'oppnaBokning': return bokning ? knapp('arende.arende', bokning.arendenummer ? `Öppna ärende ${bokning.arendenummer}` : 'Öppna ärendet', () => onOppnaArende({ kalla: bokning.kalla, id: bokning.id })) : null
      case 'ring': return ringKnapp(true, !arDator)
      default: return null
    }
  })()
  const sekundarRing = steg.primar !== 'ring' && !utkastDok ? ringKnapp(false, !arDator) : null

  // ─── Delar ───
  const menyKnapp = (
    <div ref={menyRef} className="relative">
      <button
        type="button"
        onClick={() => setMeny(v => !v)}
        aria-expanded={meny}
        aria-haspopup="menu"
        aria-label="Fler val för dokumentet"
        title="Fler val för dokumentet"
        className={arDator ? RAM_IKONKNAPP : IKONKNAPP}
      >
        <Icon name="allman.meny" size={20} />
      </button>
      {meny && (
        <div role="menu" className="absolute right-0 top-full mt-2 z-40 w-[min(17rem,calc(100vw-2rem))] p-1.5 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl">
          {kalla && (
            <MenyVal ikon="arende.arende" onClick={() => { setMeny(false); onOppnaArende(kalla) }}>
              {o.source_case_number ? `Öppna ärende ${o.source_case_number}` : 'Öppna ursprungsärendet'}
            </MenyVal>
          )}
          {stationer && o.customer_id && (
            <MenyVal ikon="arende.station" onClick={() => { setMeny(false); navigate(`/technician/equipment/customer/${o.customer_id}`) }}>
              Kundens stationer
            </MenyVal>
          )}
          {b.dolja && (
            <MenyVal ikon="dok.dolj" onClick={() => { setMeny(false); if (dold) onVisaIgen(o); else onDolj(o) }}>
              {dold ? 'Visa i min lista igen' : 'Dölj i min lista'}
            </MenyVal>
          )}
          {kanSkrivaAv && (
            <MenyVal ikon="falt.klart" onClick={() => { setMeny(false); onSkrivAv(o) }}>Skriv av</MenyVal>
          )}
          {kanRadera && (
            <>
              <div aria-hidden="true" className="h-px my-1 mx-1.5 bg-slate-700" />
              <MenyVal ikon="allman.radera" fara onClick={() => { setMeny(false); onRadera(o) }}>Radera dokumentet i Oneflow</MenyVal>
            </>
          )}
          {!kalla && !(stationer && o.customer_id) && !b.dolja && !kanSkrivaAv && !kanRadera && (
            <p className="px-2.5 py-2 text-sm text-slate-400">Inga fler val för det här dokumentet.</p>
          )}
        </div>
      )}
    </div>
  )

  const oneflowLank = `https://app.oneflow.com/contracts/${o.oneflow_contract_id}`

  const huvud = (
    <div className="flex flex-col gap-3 p-4 lg:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <h2 ref={rubrikRef} tabIndex={-1} className="text-[22px] font-bold leading-tight text-white break-words focus:outline-none">{namn}</h2>
          <p className="text-sm text-slate-300">
            {typ}{belopp && <>, <span className="font-mono">{belopp}</span></>}
            {o.source_case_number ? <>, ärende <span className="font-mono">{o.source_case_number}</span></> : o.quote_reference_number ? <>, <span className="font-mono">{o.quote_reference_number}</span></> : null}
          </p>
          <p className="text-sm text-slate-400">
            {utkastDok ? 'Skapat' : 'Skickad'} <span className="font-mono">{svDatum(o.created_at)}</span>{sandare ? ` ${sandare}` : ''}{frist ? `, ${frist}` : ''}
          </p>
        </div>
        {arDator && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <a href={oneflowLank} target="_blank" rel="noopener noreferrer" className={RADKNAPP}>
              <Icon name="rapport.oppna" size={20} />
              Öppna i Oneflow
            </a>
            {menyKnapp}
          </div>
        )}
      </div>
      {arDator ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {o.contact_person && <span className="inline-flex items-center gap-1.5 text-white"><Icon name="rapport.person" size={16} className="text-slate-400" />{o.contact_person}</span>}
          {o.contact_phone && <a href={telUrl(o.contact_phone)} onClick={() => setPanel('samtal')} className="inline-flex items-center gap-1.5 min-h-[44px] font-medium text-[#20c58f] hover:underline"><Icon name="kontakt.telefon" size={16} /><span className="font-mono">{o.contact_phone}</span></a>}
          {o.contact_email && <a href={`mailto:${o.contact_email}`} className="inline-flex items-center gap-1.5 min-h-[44px] text-slate-300 hover:text-white break-all"><Icon name="kontakt.mejl" size={16} className="text-slate-400" />{o.contact_email}</a>}
        </div>
      ) : null}
    </div>
  )

  const nastaRuta = (
    <div className={`mx-4 lg:mx-5 p-4 rounded-2xl border flex flex-col gap-3 ${RUTA[steg.ton]}`} data-genomgang="dok-nasta">
      <div className="flex flex-col gap-1">
        <Punkt ton={steg.ton} stor>{steg.status}</Punkt>
        {steg.text && (
          <p className="text-[15px] leading-relaxed text-white"><strong className="font-semibold">Nästa steg:</strong> {steg.text}</p>
        )}
        {!arDator && samtalRad && <p className="text-sm text-slate-400">{samtalRad}</p>}
      </div>
      {panel === 'forlang' && (
        <ForlangPaminn offer={o} userId={userId} userName={userName} onStang={() => setPanel(null)} onKlart={() => { setPanel(null); onAndrat() }} />
      )}
      {panel === 'samtal' && (
        <LoggaSamtal
          contractId={o.id}
          kund={kontakt}
          byName={userName}
          byEmail={userEmail}
          behorighet={b}
          onStang={() => setPanel(null)}
          onSparat={() => { setPanel(null); OfferFollowUpService.getCallLogs(o.id).then(setSamtal).catch(() => {}); onAndrat() }}
        />
      )}
      {arDator && (primarKnapp || sekundarRing || loggaKnapp || kanSkrivaAv) && (
        <div className="flex flex-wrap items-center gap-2">
          {panel !== 'forlang' && primarKnapp}
          {sekundarRing}
          {loggaKnapp}
          {kanSkrivaAv && (
            <button type="button" onClick={() => onSkrivAv(o)} className={KNAPP_SEKUNDAR}>
              <Icon name="falt.klart" size={20} />
              Skriv av
            </button>
          )}
          {samtalRad && <span className="text-sm text-slate-400">{samtalRad}</span>}
        </div>
      )}
      {!arDator && kanSkrivaAv && (
        <button type="button" onClick={() => onSkrivAv(o)} className={`${KNAPP_SEKUNDAR} w-full`}>
          <Icon name="falt.klart" size={20} />
          Skriv av
        </button>
      )}
    </div>
  )

  const mobilKontakt = !arDator && (o.contact_phone || o.contact_email) && (
    <section aria-labelledby="dok-kontakt" className="mx-4 flex flex-col gap-2">
      <h3 id="dok-kontakt" className="flex items-center gap-2 text-base font-semibold text-white">
        <Icon name="rapport.person" size={20} className="text-slate-400" />
        {kontakt}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {o.contact_phone && (
          <a href={telUrl(o.contact_phone)} onClick={() => setPanel('samtal')} aria-label={`Ring ${kontakt}, ${o.contact_phone}`} className={`${KNAPP_SEKUNDAR} w-full`}>
            <Icon name="kontakt.telefon" size={20} />
            <span className="font-mono text-sm truncate">{o.contact_phone}</span>
          </a>
        )}
        {o.contact_email && (
          <a href={`mailto:${o.contact_email}`} aria-label={`Mejla ${o.contact_email}`} className={`${KNAPP_SEKUNDAR} w-full`}>
            <Icon name="kontakt.mejl" size={20} />
            Mejla
          </a>
        )}
      </div>
    </section>
  )

  const flikar: { key: Flik; text: string; ikon: IconName; antal?: number }[] = [
    { key: 'konversation', text: 'Konversation', ikon: 'dok.konversation', antal: inlagg.length },
    { key: 'aktivitet', text: 'Aktivitet', ikon: 'allman.historik', antal: samtal.length + system.length },
    { key: 'innehall', text: 'Innehåll', ikon: 'falt.pris' },
  ]

  return (
    <article aria-labelledby="dok-detalj-rubrik" className={`flex flex-col ${arDator ? 'rounded-2xl bg-slate-900 border border-slate-700/60' : 'pb-48'}`}>
      {!arDator && (
        <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-20 -mx-0 h-14 flex items-center gap-1 px-1.5 bg-slate-900 border-b border-slate-700/60">
          <button type="button" onClick={onTillbaka} aria-label="Tillbaka till Dokumentsignering" className="h-11 flex items-center gap-1 pl-1 pr-3 rounded-xl text-[15px] font-medium text-slate-300 hover:text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]">
            <Icon name="allman.chevron-vanster" size={20} />
            Dokument
          </button>
          <span className="flex-1" />
          <a href={oneflowLank} target="_blank" rel="noopener noreferrer" aria-label="Öppna i Oneflow" title="Öppna i Oneflow" className={IKONKNAPP}>
            <Icon name="rapport.oppna" size={20} />
          </a>
          {menyKnapp}
        </div>
      )}
      <span id="dok-detalj-rubrik" className="sr-only">{namn}</span>

      {huvud}
      {nastaRuta}
      {mobilKontakt && <div className="mt-5">{mobilKontakt}</div>}

      <div className="px-4 lg:px-5 pt-5 pb-4">
        <DokumentVag offer={o} bokning={bokning} arMitt={arMitt} />
      </div>

      <div role="tablist" aria-label="Dokumentets delar" className="flex gap-1 px-2 lg:px-4 border-b border-slate-700/60 overflow-x-auto">
        {flikar.map(f => {
          const aktiv = flik === f.key
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={aktiv}
              onClick={() => setFlik(f.key)}
              className={`h-12 flex items-center gap-2 px-3 border-b-2 text-sm whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f] ${
                aktiv ? 'border-[#20c58f] text-white font-semibold' : 'border-transparent text-slate-300 hover:text-white font-medium'
              }`}
            >
              <Icon name={f.ikon} size={20} className={aktiv ? 'text-[#20c58f]' : 'text-slate-400'} />
              {f.text}
              {f.antal !== undefined && f.antal > 0 && <span className="font-mono font-medium text-slate-400">{f.antal}</span>}
            </button>
          )
        })}
      </div>

      {/* Flikpanelerna göms med hidden, avmonteras aldrig */}
      <div className={flik === 'konversation' ? '' : 'hidden'}>
        <Konversation
          ref={skrivRef}
          inlagg={inlagg}
          laddar={internaLaddar}
          kanal={kanal}
          onKanal={setKanal}
          kanOneflow={b.oneflow}
          utkast={utkast}
          onUtkast={setUtkast}
          skickar={skickar}
          onSkicka={skicka}
          kontakt={kontakt}
        />
      </div>
      <div className={flik === 'aktivitet' ? '' : 'hidden'}>
        <Aktivitet offer={o} samtal={samtal} system={system} />
      </div>
      <div className={flik === 'innehall' ? '' : 'hidden'}>
        {flik === 'innehall' && <Innehall offer={o} />}
      </div>

      {/* Telefon: fast åtgärdsfält ovanför bottenmenyn */}
      {!arDator && (primarKnapp || sekundarRing || loggaKnapp) && panel === null && (
        <div className="lg:hidden fixed inset-x-0 z-30 bottom-[calc(4rem+env(safe-area-inset-bottom))] flex flex-col gap-2 px-4 pt-3 pb-3 bg-slate-900 border-t border-slate-700/60 shadow-[0_-8px_24px_rgba(0,0,0,0.25)]">
          {primarKnapp}
          {(sekundarRing || loggaKnapp) && (
            <div className={`grid gap-2 ${sekundarRing && loggaKnapp ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {sekundarRing}
              {loggaKnapp}
            </div>
          )}
        </div>
      )}

      {utkastDok && (
        <Modal
          isOpen={visaPdf}
          onClose={() => setVisaPdf(false)}
          title={`${typ}, ${namn}`}
          subtitle={`Utkast i Oneflow, id ${o.oneflow_contract_id}`}
          size="xl"
          mobilHelskarm
          footer={
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={() => setVisaPdf(false)} className={`${KNAPP_SEKUNDAR} h-11`}>Stäng</button>
              <button type="button" onClick={publicera} disabled={publicerar} className={`${KNAPP_PRIMAR} h-11 disabled:opacity-60`}>
                {publicerar ? <Icon name="allman.laddar" size={20} className="animate-spin" /> : <Icon name="rapport.skicka" size={20} />}
                {o.type === 'offer' ? 'Skicka offerten' : 'Skicka för signering'}
              </button>
            </div>
          }
        >
          {visaPdf && <OneflowPdfFrame oneflowContractId={o.oneflow_contract_id} title={namn} />}
        </Modal>
      )}
    </article>
  )
})

function MenyVal({ ikon, fara = false, onClick, children }: { ikon: IconName; fara?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`w-full min-h-[44px] flex items-center gap-2.5 px-2.5 rounded-xl text-left text-sm font-medium hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#20c58f] ${fara ? 'text-red-400' : 'text-white'}`}
    >
      <Icon name={ikon} size={20} className={fara ? '' : 'text-slate-400'} />
      {children}
    </button>
  )
}

export default DokumentDetalj
