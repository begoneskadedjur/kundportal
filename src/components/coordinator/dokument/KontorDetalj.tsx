// src/components/coordinator/dokument/KontorDetalj.tsx
// Valt dokument i kontorets Dokumentsignering (koordinator och admin).
//
// Överst namn, typ, belopp, nummer, säljare, skickad och frist, Öppna i Oneflow och
// en meny (Dölj, Ångra avskrivning, Radera). Kontaktuppgifter och länkar till
// ursprungsärendet (/koordinator/schema?openCase=) och kunden
// (/koordinator/befintliga-kunder/:id). Sedan nästa steg-rutan med EN primär knapp
// (Boka in, Svara kunden, Ring kunden, Påminn teknikern, Förläng frist, Granska och
// skicka, Öppna ärendet) och övriga åtgärder bredvid, dokumentets väg och flikarna
// Kontaktlogg och Innehåll. Ingen koordinatorstatus.
//
// Delar med teknikerns vy (components/technician/ny/dokument): DokumentVag,
// Konversation (skrivrutan, med kontaktloggen som lista), Innehall, ForlangPaminn,
// LoggaSamtal (med kanal), knapparna och statuspunkten.
//
// Dator: panel bredvid listan. Telefon: egen vy (?id=) med Tillbaka och ett fast
// åtgärdsfält ovanför koordinatorns bottenmeny.

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Icon, type IconName } from '../../icons/Icon'
import Modal from '../../ui/Modal'
import OneflowPdfFrame from '../../shared/OneflowPdfFrame'
import { OfferFollowUpService, type FollowUpOffer } from '../../../services/offerFollowUpService'
import { OneflowDraftService } from '../../../services/oneflowDraftService'
import { useCaseComments } from '../../../hooks/useCaseComments'
import type { ArendeRef } from '../../technician/ny/OppnaArende'
import { kr, svDatum, type Behorighet, type Bokning } from '../../technician/ny/dokument/dokumentData'
import { DokumentVag } from '../../technician/ny/dokument/DokumentVag'
import { Konversation, type Kanal } from '../../technician/ny/dokument/Konversation'
import { Innehall } from '../../technician/ny/dokument/AktivitetInnehall'
import { ForlangPaminn } from '../../technician/ny/dokument/ForlangPaminn'
import { LoggaSamtal } from '../../technician/ny/dokument/LoggaSamtal'
import { IKONKNAPP, KNAPP_PRIMAR, KNAPP_SEKUNDAR, Punkt, RADKNAPP, RAM_IKONKNAPP, RUTA, telUrl } from '../../technician/ny/dokument/dokumentUi'
import { Kontaktlogg } from './Kontaktlogg'
import { PaminnTekniker, SkrivAv } from './KontorPaneler'
import {
  avskrivenPost, bokningPost, dokTekniker, fornamn, hamtaSigneringshandelser, hamtaUrsprungetsKontakt,
  kommentarTillPost, kontorNastaSteg, oneflowTillPost, samtalTillPost,
  type KontaktPost, type Kontaktlage, type KontorPlats, type SamtalRad,
} from './kontorData'

type Flik = 'kontakt' | 'innehall'
type Panel = 'paminn' | 'forlang' | 'samtal' | 'skrivav' | null

export interface KontorDetaljRef {
  fokusera: () => void
}

interface Props {
  offer: FollowUpOffer
  plats: KontorPlats
  bokning?: Bokning
  kontaktlage?: Kontaktlage
  behorighet: Behorighet
  userId: string | null
  userName: string | null
  userEmail: string | null
  arDator: boolean
  onAndrat: () => void
  onDolj: (o: FollowUpOffer) => void
  onVisaIgen: (o: FollowUpOffer) => void
  onAngraAvskrivning: (o: FollowUpOffer) => void
  onRadera: (o: FollowUpOffer) => void
  onBokaIn: (o: FollowUpOffer) => void
  onOppnaArende: (a: ArendeRef) => void
  onTillbaka: () => void
}

type OneflowInlagg = Awaited<ReturnType<typeof OfferFollowUpService.getOneflowConversation>>

export const KontorDetalj = forwardRef<KontorDetaljRef, Props>(function KontorDetalj({
  offer: o, plats, bokning, kontaktlage, behorighet: b, userId, userName, userEmail, arDator,
  onAndrat, onDolj, onVisaIgen, onAngraAvskrivning, onRadera, onBokaIn, onOppnaArende, onTillbaka,
}, ref) {
  const rubrikRef = useRef<HTMLHeadingElement>(null)
  const skrivRef = useRef<HTMLTextAreaElement>(null)
  useImperativeHandle(ref, () => ({
    fokusera: () => {
      rubrikRef.current?.focus()
      rubrikRef.current?.scrollIntoView({ block: 'nearest' })
    },
  }), [])

  const [flik, setFlik] = useState<Flik>('kontakt')
  const [oneflow, setOneflow] = useState<OneflowInlagg>([])
  const [samtal, setSamtal] = useState<SamtalRad[]>([])
  const [handelser, setHandelser] = useState<KontaktPost[]>([])
  const [ursprung, setUrsprung] = useState<KontaktPost[]>([])
  const [kanal, setKanal] = useState<Kanal>('internal')
  const [utkast, setUtkast] = useState('')
  const [skickar, setSkickar] = useState(false)
  const [panel, setPanel] = useState<Panel>(null)
  const [meny, setMeny] = useState(false)
  const [visaPdf, setVisaPdf] = useState(false)
  const [publicerar, setPublicerar] = useState(false)
  const menyRef = useRef<HTMLDivElement>(null)

  const { comments: interna, addComment, isLoading: internaLaddar, refresh: laddaOmInterna } = useCaseComments({
    caseId: o.id,
    caseType: 'contract',
    caseTitle: o.company_name || undefined,
  })

  // Nollställ och ladda vid dokumentbyte
  useEffect(() => {
    let avbruten = false
    setFlik('kontakt')
    setUtkast('')
    setPanel(null)
    setMeny(false)
    setVisaPdf(false)
    setKanal(kontaktlage?.oneflow?.arKund && b.oneflow ? 'oneflow' : 'internal')

    OfferFollowUpService.getOneflowConversation(o.oneflow_contract_id)
      .then(d => { if (!avbruten) setOneflow(d) })
      .catch(() => { if (!avbruten) setOneflow([]) })
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
    hamtaSigneringshandelser(o.id).then(d => { if (!avbruten) setHandelser(d) })
    hamtaUrsprungetsKontakt(o).then(d => { if (!avbruten) setUrsprung(d) })
    return () => { avbruten = true }
    // Bara vid byte av dokument, inte när listan läses om
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.id])

  // Kundinlägg markeras lästa efter 2 s i kontaktloggen (samma som gamla vyn)
  useEffect(() => {
    if (!userId || flik !== 'kontakt' || o.unread_customer_comments === 0) return
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
    document.querySelector('[data-kontor-nasta]')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [panel, arDator])

  // ─── Kontaktloggen ───
  const poster = useMemo<KontaktPost[]>(() => {
    const lista: KontaktPost[] = [
      ...handelser,
      ...oneflow.map(c => oneflowTillPost(c)),
      ...samtal.map(samtalTillPost),
      ...ursprung,
    ]
    for (const c of interna) {
      const p = kommentarTillPost({
        id: c.id,
        case_id: o.id,
        author_name: c.author_name,
        content: c.content,
        is_system_comment: c.is_system_comment ?? false,
        created_at: c.created_at,
      })
      if (p) lista.push(p)
    }
    const av = avskrivenPost(o)
    if (av) lista.push(av)
    if (!lista.some(p => p.typ === 'bokad')) {
      const bp = bokningPost(o, bokning)
      if (bp) lista.push(bp)
    }
    return lista.sort((a, c) => a.at.localeCompare(c.at))
  }, [handelser, oneflow, samtal, ursprung, interna, o, bokning])

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
        onAndrat()
      }
      setUtkast('')
    } catch (err) {
      console.error('Skicka meddelande:', err)
      toast.error('Kunde inte skicka meddelandet')
    } finally {
      setSkickar(false)
    }
  }, [utkast, skickar, kanal, addComment, o.oneflow_contract_id, userName, onAndrat])

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

  /** Mejl och sms loggas som anteckning på dokumentet, samma text som schemats låda */
  const loggaAnnanKanal = useCallback(async (k: 'mejl' | 'sms', anteckning: string | null, ringAter: string | null) => {
    const etikett = k === 'mejl' ? 'E-post' : 'SMS'
    await addComment(anteckning ? `Kontaktförsök via ${etikett}: ${anteckning}` : `Kontaktförsök via ${etikett}`)
    if (ringAter) await OfferFollowUpService.setFollowUp(o.id, ringAter, anteckning)
  }, [addComment, o.id])

  // ─── Härledda värden ───
  const namn = o.company_name || o.contact_person || 'Namnlös'
  const kontakt = o.contact_person || o.company_name || 'kunden'
  const tek = dokTekniker(o)
  const tekFornamn = fornamn(tek.namn) || 'teknikern'
  const minEpost = (userEmail || '').toLowerCase()
  const avskriven = !!o.action?.dismissed_at
  const utkastDok = o.status === 'draft'
  const pagaende = o.status === 'pending' || o.status === 'overdue'
  const kanPaminna = b.atgarder && !!tek.epost && tek.epost !== minEpost && o.status !== 'signed' && o.status !== 'declined' && !avskriven
  const steg = kontorNastaSteg(o, plats, kontaktlage, bokning, kanPaminna)
  const typ = o.type === 'offer' ? 'Offert' : 'Avtal'
  const belopp = kr(o.total_value)
  const dold = !!userId && (o.hidden_by || []).includes(userId)
  const kanRadera = b.oneflow && (utkastDok || (o.status === 'overdue' && !avskriven))
  const kanSkrivaAv = b.atgarder && pagaende && !avskriven
  const kanForlanga = b.oneflow && pagaende && !avskriven
  const frist = o.signing_deadline
    ? (o.status === 'overdue' ? `fristen gick ut ${o.signing_deadline}` : o.status === 'pending' ? `fristen går ut ${o.signing_deadline}` : null)
    : null
  const ursprungLank = o.source_id && (o.source_type === 'private_case' || o.source_type === 'business_case')
    ? `/koordinator/schema?openCase=${o.source_id}&comm=0`
    : null
  const oneflowLank = `https://app.oneflow.com/contracts/${o.oneflow_contract_id}`

  const vaxla = (p: Exclude<Panel, null>) => setPanel(x => x === p ? null : p)
  const svara = () => {
    setFlik('kontakt')
    setKanal(b.oneflow ? 'oneflow' : 'internal')
    setTimeout(() => { skrivRef.current?.focus(); skrivRef.current?.scrollIntoView({ block: 'center' }) }, 50)
  }

  const bredd = arDator ? '' : 'w-full'
  const knapp = (primar: boolean, ikon: IconName, text: string, onClick: () => void, aria?: boolean) => (
    <button type="button" onClick={onClick} aria-expanded={aria} className={`${primar ? KNAPP_PRIMAR : KNAPP_SEKUNDAR} ${bredd}`}>
      <Icon name={ikon} size={20} />{text}
    </button>
  )
  const ringKnapp = (primar: boolean) => o.contact_phone ? (
    <a href={telUrl(o.contact_phone)} onClick={() => setPanel('samtal')} className={`${primar ? KNAPP_PRIMAR : KNAPP_SEKUNDAR} ${bredd}`}>
      <Icon name="kontakt.telefon" size={20} />
      {arDator ? `Ring ${kontakt}` : `Ring ${fornamn(kontakt)}`}
    </a>
  ) : null

  const atgard = (a: typeof steg.primar, primar: boolean): ReactNode => {
    switch (a) {
      case 'bokaIn': return knapp(primar, 'arendelista.boka', 'Boka in', () => onBokaIn(o))
      case 'svara': return knapp(primar, 'dok.konversation', 'Svara kunden', svara)
      case 'ring': return ringKnapp(primar)
      case 'paminn': return knapp(primar, 'upphandling.notis', `Påminn ${tekFornamn}`, () => vaxla('paminn'), panel === 'paminn')
      case 'forlang': return knapp(primar, 'upphandling.forlangning', 'Förläng frist', () => vaxla('forlang'), panel === 'forlang')
      case 'skicka': return knapp(primar, 'rapport.oppna', 'Granska och skicka', () => setVisaPdf(true))
      case 'oppnaBokning': return bokning ? knapp(primar, 'arende.arende', bokning.arendenummer ? `Öppna ärende ${bokning.arendenummer}` : 'Öppna ärendet', () => onOppnaArende({ kalla: bokning.kalla, id: bokning.id })) : null
      default: return null
    }
  }

  const primarKnapp = atgard(steg.primar, true)
  // Övriga åtgärder i fast ordning, den primära visas inte två gånger
  const ovriga: ReactNode[] = []
  if (steg.primar !== 'ring' && !utkastDok && o.contact_phone) ovriga.push(<span key="ring" className="contents">{ringKnapp(false)}</span>)
  if (!utkastDok) {
    ovriga.push(
      <button key="logga" type="button" onClick={() => vaxla('samtal')} aria-expanded={panel === 'samtal'} className={`${KNAPP_SEKUNDAR} ${bredd}`}>
        <Icon name="allman.anteckning" size={20} />
        Logga kontakt
      </button>,
    )
  }
  if (kanPaminna && steg.primar !== 'paminn' && plats.grupp === 'fastnat') ovriga.push(<span key="paminn" className="contents">{atgard('paminn', false)}</span>)
  if (kanForlanga && steg.primar !== 'forlang') ovriga.push(<span key="forlang" className="contents">{atgard('forlang', false)}</span>)
  if (utkastDok && steg.primar !== 'skicka') ovriga.push(<span key="skicka" className="contents">{atgard('skicka', false)}</span>)
  if (steg.primar !== 'svara' && b.oneflow && !utkastDok && pagaende) ovriga.push(<span key="svara" className="contents">{atgard('svara', false)}</span>)
  if (kanSkrivaAv) {
    ovriga.push(
      <button key="skrivav" type="button" onClick={() => vaxla('skrivav')} aria-expanded={panel === 'skrivav'} className={`${KNAPP_SEKUNDAR} ${bredd}`}>
        <Icon name="allman.arkiv" size={20} />
        Skriv av
      </button>,
    )
  }

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
          {b.dolja && (
            <MenyVal ikon="dok.dolj" onClick={() => { setMeny(false); if (dold) onVisaIgen(o); else onDolj(o) }}>
              {dold ? 'Visa i min lista igen' : 'Dölj i min lista'}
            </MenyVal>
          )}
          {avskriven && b.atgarder && (
            <MenyVal ikon="allman.aterstall" onClick={() => { setMeny(false); onAngraAvskrivning(o) }}>
              Ångra avskrivningen
            </MenyVal>
          )}
          {kanRadera && (
            <>
              <div aria-hidden="true" className="h-px my-1 mx-1.5 bg-slate-700" />
              <MenyVal ikon="allman.radera" fara onClick={() => { setMeny(false); onRadera(o) }}>Radera dokumentet i Oneflow</MenyVal>
            </>
          )}
          {!b.dolja && !(avskriven && b.atgarder) && !kanRadera && (
            <p className="px-2.5 py-2 text-sm text-slate-400">Inga fler val för det här dokumentet.</p>
          )}
        </div>
      )}
    </div>
  )

  const lankar = (
    <div className="flex flex-wrap items-center gap-2">
      {ursprungLank && (
        <Link to={ursprungLank} className={RADKNAPP}>
          <Icon name="arende.arende" size={20} />
          {o.source_case_number ? `Ursprungsärende ${o.source_case_number}` : 'Ursprungsärendet'}
        </Link>
      )}
      {o.customer_id ? (
        <Link to={`/koordinator/befintliga-kunder/${o.customer_id}`} className={RADKNAPP}>
          <Icon name="allman.foretag" size={20} />
          Kund
        </Link>
      ) : o.type === 'contract' && o.status === 'signed' ? (
        <span className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-medium text-amber-500">
          <Icon name="dok.ny-kund" size={20} />
          Kunden lades inte upp automatiskt
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 min-h-[44px] text-sm text-slate-400">
          <Icon name="dok.ny-kund" size={20} />
          {o.type === 'offer' ? 'Ingen kund, offert' : 'Kunden läggs upp vid signering'}
        </span>
      )}
    </div>
  )

  const huvud = (
    <div className="flex flex-col gap-3 p-4 lg:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <h2 ref={rubrikRef} tabIndex={-1} className="text-[22px] font-bold leading-tight text-white break-words focus:outline-none">{namn}</h2>
          <p className="text-sm text-slate-300">
            {typ}{belopp && <>, <span className="font-mono">{belopp}</span></>}
            {o.source_case_number ? <>, <span className="font-mono">{o.source_case_number}</span></> : o.quote_reference_number ? <>, <span className="font-mono">{o.quote_reference_number}</span></> : null}
            {tek.namn && <>, säljare {tek.namn}</>}
          </p>
          <p className="text-sm text-slate-400">
            {utkastDok ? 'Skapat' : 'Skickad'} <span className="font-mono">{svDatum(o.created_at)}</span>
            {(o.created_by_name || o.begone_employee_name) ? ` av ${o.created_by_name || o.begone_employee_name}` : ''}
            {frist ? `, ${frist}` : ''}
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {o.contact_person && <span className="inline-flex items-center gap-1.5 text-white"><Icon name="rapport.person" size={16} className="text-slate-400" />{o.contact_person}</span>}
        {o.contact_phone && <a href={telUrl(o.contact_phone)} onClick={() => setPanel('samtal')} className="inline-flex items-center gap-1.5 min-h-[44px] font-medium text-[#20c58f] hover:underline"><Icon name="kontakt.telefon" size={16} /><span className="font-mono">{o.contact_phone}</span></a>}
        {o.contact_email && <a href={`mailto:${o.contact_email}`} className="inline-flex items-center gap-1.5 min-h-[44px] text-slate-300 hover:text-white break-all"><Icon name="kontakt.mejl" size={16} className="text-slate-400" />{o.contact_email}</a>}
      </div>
      {lankar}
    </div>
  )

  const nastaRuta = (
    <div className={`mx-4 lg:mx-5 p-4 rounded-2xl border flex flex-col gap-3 ${RUTA[steg.ton]}`} data-kontor-nasta>
      <div className="flex flex-col gap-1">
        <Punkt ton={steg.ton} stor>{steg.status}</Punkt>
        {steg.text && (
          <p className="text-[15px] leading-relaxed text-white"><strong className="font-semibold">Nästa steg:</strong> {steg.text}</p>
        )}
      </div>
      {arDator && primarKnapp && !(panel !== null && panel === steg.primar) && <div className="flex flex-wrap items-center gap-2">{primarKnapp}</div>}
      {panel === 'paminn' && (
        <PaminnTekniker offer={o} userId={userId} userName={userName} onStang={() => setPanel(null)} onKlart={() => { setPanel(null); laddaOmInterna(); onAndrat() }} />
      )}
      {panel === 'forlang' && (
        <ForlangPaminn offer={o} userId={userId} userName={userName} onStang={() => setPanel(null)} onKlart={() => { setPanel(null); laddaOmInterna(); onAndrat() }} />
      )}
      {panel === 'samtal' && (
        <LoggaSamtal
          contractId={o.id}
          kund={kontakt}
          byName={userName}
          byEmail={userEmail}
          behorighet={b}
          onAnnanKanal={loggaAnnanKanal}
          onStang={() => setPanel(null)}
          onSparat={() => { setPanel(null); OfferFollowUpService.getCallLogs(o.id).then(setSamtal).catch(() => {}); onAndrat() }}
        />
      )}
      {panel === 'skrivav' && (
        <SkrivAv offer={o} userId={userId} onStang={() => setPanel(null)} onKlart={() => { setPanel(null); onAndrat() }} />
      )}
      {ovriga.length > 0 && (
        <div className={arDator ? 'flex flex-wrap items-center gap-2' : 'grid grid-cols-1 gap-2'}>
          {ovriga}
        </div>
      )}
      <p className="text-sm text-slate-400">
        Samtal, förlängning och påminnelse hamnar i kontaktloggen.{kanSkrivaAv ? ' Skriv av är för döda affärer: du anger en anledning och dokumentet flyttas till Klara.' : ''}
      </p>
    </div>
  )

  const flikar: { key: Flik; text: string; ikon: IconName; antal?: number }[] = [
    { key: 'kontakt', text: 'Kontaktlogg', ikon: 'allman.historik', antal: poster.length },
    { key: 'innehall', text: 'Innehåll', ikon: 'falt.pris' },
  ]

  return (
    <article aria-labelledby="kontor-detalj-rubrik" className={`flex flex-col ${arDator ? 'rounded-2xl bg-slate-900 border border-slate-700/60' : 'pb-36'}`}>
      {!arDator && (
        <div className="sticky top-14 z-20 h-14 flex items-center gap-1 px-1.5 bg-slate-900 border-b border-slate-700/60">
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
      <span id="kontor-detalj-rubrik" className="sr-only">{namn}</span>

      {huvud}
      {nastaRuta}

      <div className="px-4 lg:px-5 pt-5 pb-4">
        <DokumentVag offer={o} bokning={bokning} arMitt={false} />
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
      <div className={flik === 'kontakt' ? '' : 'hidden'}>
        <Konversation
          ref={skrivRef}
          inlagg={[]}
          laddar={internaLaddar}
          kanal={kanal}
          onKanal={setKanal}
          kanOneflow={b.oneflow}
          utkast={utkast}
          onUtkast={setUtkast}
          skickar={skickar}
          onSkicka={skicka}
          kontakt={kontakt}
          lista={<Kontaktlogg poster={poster} laddar={internaLaddar} minNamn={userName} />}
          internText={tek.epost && tek.epost !== minEpost ? `Syns för kontoret och ${tekFornamn}, inte för kunden.` : 'Syns för kontoret, inte för kunden.'}
        />
      </div>
      <div className={flik === 'innehall' ? '' : 'hidden'}>
        {flik === 'innehall' && <Innehall offer={o} />}
      </div>

      {/* Telefon: fast åtgärdsfält ovanför bottenmenyn */}
      {!arDator && primarKnapp && panel === null && (
        <div className="lg:hidden fixed inset-x-0 z-30 bottom-[calc(4rem+env(safe-area-inset-bottom))] flex flex-col gap-2 px-4 pt-3 pb-3 bg-slate-900 border-t border-slate-700/60 shadow-[0_-8px_24px_rgba(0,0,0,0.25)]">
          {primarKnapp}
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

export default KontorDetalj
