// src/pages/coordinator/KontorDokumentsignering.tsx
// Dokumentsignering i kontorsläget, för koordinator och admin på
// /koordinator/dokumentsignering (beslut Christian 2026-10-23, skisserna
// Kontor*.dc.html). Säljare har kvar OfferFollowUp och teknikerna sin egen vy
// (pages/technician/ny/NyDokumentsignering).
//
// Data: OfferFollowUpService.getDashboardData utan ownDocsEmail, alltså alla
// dokument, plus senaste kontakt per dokument och bokningarna. Kön ordnas efter
// kontorets arbete (components/coordinator/dokument/kontorData.ts): Att boka in,
// Väntar på kontoret, Fastnat hos tekniker, Bokade, Väntar på kunden och Klara.
// Ingen koordinatorstatus att välja: det kontoret gör syns i kontaktloggen.
//
// Överst: tekniker, typ och sök (/), och en kompakt statistikrad som öppnar
// fliken Statistik (DocumentStatsView med teknikertabellen).
// Dator: listan och valt dokument bredvid. Pil upp och ned bläddrar, Enter går
// till valt dokument. Telefon: tryck öppnar dokumentet som egen vy (?id=).
// Direktlänk ?id=<contracts.id> (global sök, notiser) öppnar dokumentet och
// nollställer filtren. Boka in öppnar BokaIn (components/coordinator/bokaIn).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { Icon } from '../../components/icons/Icon'
import { OfferFollowUpService, type FollowUpOffer } from '../../services/offerFollowUpService'
import { CasePipelineService } from '../../services/casePipelineService'
import { createSystemComment } from '../../services/communicationService'
import DocumentStatsView from '../../components/coordinator/follow-up/DocumentStatsView'
import DeleteOfferConfirmDialog from '../../components/coordinator/follow-up/DeleteOfferConfirmDialog'
import BokaIn from '../../components/coordinator/bokaIn/BokaIn'
import OppnaArende, { type ArendeRef } from '../../components/technician/ny/OppnaArende'
import { useArDator } from '../../components/technician/ny/arenden/useArDator'
import { Laddar } from '../../components/technician/ny/arenden/ArendeSektion'
import { Vaxel } from '../../components/technician/ny/utrustning/Vaxel'
import { behorighet, hamtaBokningar, statistik90, svDatum, svTid, type Bokning } from '../../components/technician/ny/dokument/dokumentData'
import { RADKNAPP } from '../../components/technician/ny/dokument/dokumentUi'
import { KontorLista } from '../../components/coordinator/dokument/KontorLista'
import { KontorDetalj, type KontorDetaljRef } from '../../components/coordinator/dokument/KontorDetalj'
import {
  dokTekniker, forfallna90, fornamn, grupperaKontor, hamtaKontaktlagen, ordningKontor, placeraKontor, skickaPaminnelse,
  type FastnatTekniker, type Kontaktlage,
} from '../../components/coordinator/dokument/kontorData'

type Vy = 'ko' | 'statistik'
type Typ = 'all' | 'offer' | 'contract'

export default function KontorDokumentsignering() {
  const { profile, user } = useAuth()
  const userId = user?.id ?? null
  const userName = profile?.display_name || profile?.technicians?.name || null
  const userEmail = profile?.email || profile?.technicians?.email || null
  const minEpost = (userEmail || '').toLowerCase()
  const b = useMemo(() => behorighet(profile ?? null), [profile])
  const arDator = useArDator()
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const idParam = params.get('id')

  const [offers, setOffers] = useState<FollowUpOffer[]>([])
  const [kontakt, setKontakt] = useState<Map<string, Kontaktlage>>(new Map())
  const [bokningar, setBokningar] = useState<Map<string, Bokning>>(new Map())
  const [laddar, setLaddar] = useState(true)
  const [uppdaterar, setUppdaterar] = useState(false)
  const [fel, setFel] = useState<string | null>(null)
  const [uppdaterad, setUppdaterad] = useState<string | null>(null)

  const [vy, setVy] = useState<Vy>('ko')
  const [typ, setTyp] = useState<Typ>('all')
  const [tekniker, setTekniker] = useState<string>('alla')
  const [sok, setSok] = useState('')
  const [visaDolda, setVisaDolda] = useState(false)
  const [vantarOppen, setVantarOppen] = useState(false)
  const [klaraOppen, setKlaraOppen] = useState(false)
  const [raderas, setRaderas] = useState<FollowUpOffer | null>(null)
  const [bokaIn, setBokaIn] = useState<FollowUpOffer | null>(null)
  const [oppetArende, setOppetArende] = useState<ArendeRef | null>(null)
  const [paminner, setPaminner] = useState<string | null>(null)
  const detaljRef = useRef<KontorDetaljRef>(null)

  // ─── Hämta ───
  const hamta = useCallback(async (tyst = false) => {
    if (tyst) setUppdaterar(true); else setLaddar(true)
    try {
      const data = await OfferFollowUpService.getDashboardData(undefined, userId ?? undefined)
      const [k, bk] = await Promise.all([
        hamtaKontaktlagen(data.offers),
        hamtaBokningar(data.offers.map(o => o.booked_case_id).filter((x): x is string => !!x)),
      ])
      setOffers(data.offers)
      setKontakt(k)
      setBokningar(bk)
      setUppdaterad(svTid(new Date().toISOString()))
      setFel(null)
    } catch (err) {
      console.error('KontorDokumentsignering:', err)
      if (!tyst) setFel('Kunde inte hämta dokumenten')
      else toast.error('Kunde inte uppdatera dokumenten')
    } finally {
      setLaddar(false)
      setUppdaterar(false)
    }
  }, [userId])

  useEffect(() => { hamta() }, [hamta])
  const uppdatera = useCallback(() => { hamta(true) }, [hamta])

  // ─── Tekniker att välja ───
  const teknikerVal = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of offers) {
      const t = dokTekniker(o)
      if (t.nyckel && !m.has(t.nyckel)) m.set(t.nyckel, t.namn)
    }
    return [...m.entries()].sort((a, c) => a[1].localeCompare(c[1], 'sv'))
  }, [offers])

  // ─── Filter och grupper ───
  const q = sok.trim().toLowerCase()
  const avTekniker = useMemo(
    () => tekniker === 'alla' ? offers : offers.filter(o => dokTekniker(o).nyckel === tekniker),
    [offers, tekniker],
  )
  const filtrerade = useMemo(() => avTekniker.filter(o => {
    if (typ !== 'all' && o.type !== typ) return false
    if (!visaDolda && userId && (o.hidden_by || []).includes(userId)) return false
    if (q) {
      const text = [o.company_name, o.contact_person, o.contact_email, o.quote_reference_number, o.source_case_number, o.technician_name, o.begone_employee_name, o.created_by_name]
        .filter(Boolean).join(' ').toLowerCase()
      if (!text.includes(q)) return false
    }
    return true
  }), [avTekniker, typ, visaDolda, userId, q])

  const g = useMemo(() => grupperaKontor(filtrerade, kontakt, bokningar, minEpost), [filtrerade, kontakt, bokningar, minEpost])
  // Räknarna i sidhuvudet gäller alla synliga dokument, oberoende av filter
  const gAlla = useMemo(
    () => grupperaKontor(offers.filter(o => !(userId && (o.hidden_by || []).includes(userId))), kontakt, bokningar, minEpost),
    [offers, kontakt, bokningar, minEpost, userId],
  )
  const doldaAntal = useMemo(() => (userId ? avTekniker.filter(o => (o.hidden_by || []).includes(userId)).length : 0), [avTekniker, userId])
  const stat = useMemo(() => statistik90(avTekniker), [avTekniker])
  const forfallna = useMemo(() => forfallna90(avTekniker), [avTekniker])
  const soker = q.length > 0
  const visaVantar = vantarOppen || soker
  const visaKlara = klaraOppen || soker
  const lista = useMemo(() => ordningKontor(g, visaVantar, visaKlara), [g, visaVantar, visaKlara])

  // ─── Valt dokument ───
  const valtAvMig = useRef<string | null>(null)
  const valjId = useCallback((id: string | null, push = false) => {
    valtAvMig.current = id
    setParams(p => {
      const n = new URLSearchParams(p)
      if (id) n.set('id', id); else n.delete('id')
      return n
    }, push ? { state: { franLista: true } } : { replace: true })
  }, [setParams])

  const valj = useCallback((o: FollowUpOffer) => {
    if (arDator) valjId(o.id)
    else { valjId(o.id, true); window.scrollTo({ top: 0 }) }
  }, [arDator, valjId])

  // Direktlänk ?id= (global sök, notiser): nollställ filtren så att dokumentet syns
  const hanterad = useRef<string | null>(null)
  useEffect(() => {
    if (!idParam) { hanterad.current = null; return }
    if (laddar || hanterad.current === idParam) return
    hanterad.current = idParam
    if (valtAvMig.current === idParam) return
    const mal = offers.find(o => o.id === idParam)
    if (!mal) {
      toast.error('Dokumentet finns inte i dokumentlistan')
      valjId(null)
      return
    }
    setVy('ko')
    setTyp('all')
    setTekniker('alla')
    setSok('')
    if (userId && (mal.hidden_by || []).includes(userId)) setVisaDolda(true)
    const p = placeraKontor(mal, kontakt.get(mal.id), bokningar, minEpost)
    if (p.grupp === 'vantar') setVantarOppen(true)
    if (p.grupp === 'klara') setKlaraOppen(true)
    setTimeout(() => document.querySelector(`[data-queue-row="${mal.id}"]`)?.scrollIntoView({ block: 'nearest' }), 100)
  }, [idParam, laddar, offers, userId, kontakt, bokningar, minEpost, valjId])

  const valt = useMemo(() => {
    if (idParam) return offers.find(o => o.id === idParam) ?? null
    return arDator ? lista[0] ?? null : null
  }, [idParam, offers, arDator, lista])

  const tillbaka = useCallback(() => {
    if ((location.state as { franLista?: boolean } | null)?.franLista) navigate(-1)
    else valjId(null)
  }, [location.state, navigate, valjId])

  // ─── Tangentbord (dator) ───
  useEffect(() => {
    if (!arDator || vy !== 'ko') return
    const tangent = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return
      if (document.querySelector('[role="dialog"]')) return
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (lista.length === 0) return
        e.preventDefault()
        const i = lista.findIndex(o => o.id === valt?.id)
        const nasta = i === -1 ? lista[0] : lista[e.key === 'ArrowDown' ? Math.min(i + 1, lista.length - 1) : Math.max(i - 1, 0)]
        valjId(nasta.id)
        document.querySelector(`[data-queue-row="${nasta.id}"]`)?.scrollIntoView({ block: 'nearest' })
      } else if (e.key === 'Enter') {
        if (t.tagName === 'BUTTON' || t.tagName === 'A') return
        if (!valt && lista[0]) valjId(lista[0].id)
        e.preventDefault()
        setTimeout(() => detaljRef.current?.fokusera(), 0)
      } else if (e.key === '/') {
        e.preventDefault()
        document.getElementById('kontor-sok')?.focus()
      }
    }
    window.addEventListener('keydown', tangent)
    return () => window.removeEventListener('keydown', tangent)
  }, [arDator, vy, lista, valt, valjId])

  // ─── Åtgärder ───
  const dolj = useCallback(async (o: FollowUpOffer) => {
    if (!userId) return
    try {
      await OfferFollowUpService.hideOffer(o.id, userId)
      setOffers(prev => prev.map(x => x.id === o.id ? { ...x, hidden_by: [...(x.hidden_by || []), userId] } : x))
      if (valt?.id === o.id && !visaDolda) {
        if (arDator) valjId(null); else tillbaka()
      }
      toast.success('Dokumentet är dolt i din lista')
    } catch {
      toast.error('Kunde inte dölja dokumentet')
    }
  }, [userId, valt, visaDolda, arDator, valjId, tillbaka])

  const visaIgen = useCallback(async (o: FollowUpOffer) => {
    if (!userId) return
    try {
      await OfferFollowUpService.unhideOffer(o.id, userId)
      setOffers(prev => prev.map(x => x.id === o.id ? { ...x, hidden_by: (x.hidden_by || []).filter(u => u !== userId) } : x))
      toast.success('Dokumentet syns i din lista igen')
    } catch {
      toast.error('Kunde inte visa dokumentet igen')
    }
  }, [userId])

  const angraAvskrivning = useCallback(async (o: FollowUpOffer) => {
    try {
      await CasePipelineService.undismissOffer(o.id)
      toast.success('Avskrivningen är ångrad')
      hamta(true)
    } catch {
      toast.error('Kunde inte ångra avskrivningen')
    }
  }, [hamta])

  const paminnAlla = useCallback(async (t: FastnatTekniker) => {
    if (!userId) return
    const n = t.dokument.length
    const namn = fornamn(t.tekniker.namn) || 'teknikern'
    if (!window.confirm(n === 1
      ? `Skicka en påminnelse till ${namn} om ${t.dokument[0].company_name || t.dokument[0].contact_person || 'dokumentet'}?`
      : `Skicka ${n} påminnelser till ${namn}, en per dokument?`)) return
    setPaminner(t.tekniker.nyckel)
    let ok = 0
    let felText: string | null = null
    for (const o of t.dokument) {
      try {
        await skickaPaminnelse(o, userId, userName || 'Kontoret')
        ok++
      } catch (err) {
        felText = err instanceof Error ? err.message : 'Kunde inte skicka påminnelsen'
        // Saknar teknikern inloggning gäller det alla dokumenten, sluta försöka
        if (ok === 0) break
      }
    }
    setPaminner(null)
    if (ok > 0) toast.success(ok === 1 ? `${namn} har fått påminnelsen` : `${namn} har fått ${ok} påminnelser`)
    if (felText) toast.error(felText)
    if (ok > 0) hamta(true)
  }, [userId, userName, hamta])

  const bokaInKlar = useCallback(async (nyttArendeId: string | null) => {
    const o = bokaIn
    setBokaIn(null)
    if (o && nyttArendeId && userId) {
      // Boka in blir en post i kontaktloggen, med ärendenummer och vem som bokade
      const bk = (await hamtaBokningar([nyttArendeId]).catch(() => new Map<string, Bokning>())).get(nyttArendeId)
      const tid = bk?.start ? `, ${svDatum(bk.start)}${/^\d{4}-\d{2}-\d{2}$/.test(bk.start) ? '' : ` ${svTid(bk.start)}`}` : ''
      createSystemComment(
        o.id, 'contract', 'status_change',
        `Bokad in som ${bk?.arendenummer || 'nytt ärende'}${tid}${bk?.teknikerNamn ? `, ${bk.teknikerNamn}` : ''}, av ${userName || 'kontoret'}`,
        userId, userName || 'Kontoret',
      ).catch(err => console.error('Systemkommentar Boka in:', err))
    }
    hamta(true)
  }, [bokaIn, userId, userName, hamta])

  // ─── Delar ───
  const sidhuvud = (
    <div className="flex flex-col lg:flex-row lg:items-end gap-2 lg:gap-4">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold leading-tight text-white">Dokumentsignering</h1>
        {!(laddar && offers.length === 0) && (
          <p className="text-sm text-slate-300">
            <span className={gAlla.antal.boka > 0 ? 'font-semibold text-white' : ''}>{gAlla.antal.boka} att boka in</span>
            , {gAlla.antal.kontoret} väntar på kontoret
            , <span className={gAlla.antal.fastnat > 0 ? 'font-semibold text-white' : ''}>{gAlla.antal.fastnat} fastnat hos tekniker</span>
            {arDator && <>, {gAlla.antal.bokade} bokade</>}
          </p>
        )}
      </div>
      <div className="lg:ml-auto flex items-center gap-2">
        {uppdaterad && <span className="hidden sm:inline text-sm text-slate-400">Uppdaterad {uppdaterad}</span>}
        <button type="button" onClick={uppdatera} disabled={uppdaterar} className={RADKNAPP} aria-label="Uppdatera">
          <Icon name="utrustning.uppdatera" size={20} className={uppdaterar ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Uppdatera</span>
        </button>
        <Link to="/koordinator/oneflow-contract-creator" className={`${RADKNAPP} hidden lg:inline-flex`}>
          <Icon name="dok.offert" size={20} />
          Skapa avtal eller offert
        </Link>
      </div>
    </div>
  )

  const statistikRad = (
    <button
      type="button"
      onClick={() => setVy('statistik')}
      aria-label={`Senaste 90 dagarna: ${stat.skickade} skickade, ${stat.signerade} signerade, ${forfallna} förfallna. Öppna Statistik`}
      className="flex flex-wrap items-center gap-x-4 gap-y-1 min-h-[44px] px-3.5 py-2 rounded-2xl bg-slate-900 border border-slate-700/60 text-left text-sm text-slate-300 hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
    >
      <span className="text-slate-400">90 dagar, {tekniker === 'alla' ? 'alla' : fornamn(teknikerVal.find(([k]) => k === tekniker)?.[1])}</span>
      {arDator ? (
        <>
          <span><span className="font-mono font-bold text-white">{stat.skickade}</span> skickade</span>
          <span><span className="font-mono font-bold text-white">{stat.signerade}</span> signerade</span>
          <span>signeringsgrad <span className="font-mono font-bold text-[#20c58f]">{stat.grad !== null ? `${stat.grad} %` : 'saknas'}</span></span>
          <span><span className="font-mono font-bold text-white">{stat.dagarTillSignering !== null ? stat.dagarTillSignering.toFixed(1).replace('.', ',') : 'saknas'}</span> dagar till signering</span>
          <span><span className="font-mono font-bold text-white">{forfallna}</span> förfallna</span>
        </>
      ) : (
        <span>
          <span className="font-mono font-bold text-white">{stat.signerade}</span> av <span className="font-mono font-bold text-white">{stat.skickade}</span> signerade
          {stat.grad !== null && <>, <span className="font-mono font-bold text-[#20c58f]">{stat.grad} %</span></>}
          , <span className="font-mono font-bold text-white">{forfallna}</span> förfallna
        </span>
      )}
      <Icon name="allman.chevron" size={16} className="text-slate-400" />
    </button>
  )

  const teknikerValjare = (
    <label className="relative flex-shrink-0 block">
      <span className="sr-only">Tekniker</span>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><Icon name="rapport.person" size={20} /></span>
      <select
        value={tekniker}
        onChange={e => setTekniker(e.target.value)}
        className="h-11 w-full lg:w-56 pl-10 pr-8 rounded-xl bg-slate-900 border border-slate-700 text-[15px] text-white focus:outline-none focus:border-[#20c58f] focus:ring-2 focus:ring-[#20c58f]/30"
      >
        <option value="alla">Alla tekniker</option>
        {teknikerVal.map(([k, namn]) => <option key={k} value={k}>{namn}</option>)}
      </select>
    </label>
  )

  const typVal = (
    <div role="tablist" aria-label="Dokumenttyp" className="flex gap-1 p-1 rounded-xl bg-slate-800 flex-shrink-0">
      {([['all', 'Alla'], ['offer', 'Offerter'], ['contract', 'Avtal']] as const).map(([k, text]) => {
        const aktiv = typ === k
        return (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={aktiv}
            onClick={() => setTyp(k)}
            className={`h-9 px-3 rounded-lg text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
              aktiv ? 'bg-slate-900 border border-slate-600 text-white font-semibold' : 'border border-transparent text-slate-300 hover:text-white font-medium'
            }`}
          >
            {text}
          </button>
        )
      })}
    </div>
  )

  const sokFalt = (
    <label className="relative flex-1 min-w-0 block">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"><Icon name="allman.sok" size={20} /></span>
      <input
        id="kontor-sok"
        type="search"
        value={sok}
        onChange={e => setSok(e.target.value)}
        placeholder={arDator ? 'Sök kund, kontaktperson, ärendenummer eller tekniker' : 'Sök'}
        aria-label="Sök på kund, kontaktperson, mejl, ärendenummer eller tekniker"
        onKeyDown={e => { if (e.key === 'Escape') { setSok(''); (e.target as HTMLInputElement).blur() } }}
        className="w-full h-11 pl-10 pr-10 rounded-xl bg-slate-900 border border-slate-700 text-[15px] text-white placeholder:text-slate-500 focus:outline-none focus:border-[#20c58f] focus:ring-2 focus:ring-[#20c58f]/30"
      />
      {arDator && (
        <span aria-hidden="true" title="Tryck / för att söka" className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 rounded-md border border-slate-600 font-mono text-sm text-slate-400">/</span>
      )}
    </label>
  )

  const detalj = valt && (
    <KontorDetalj
      ref={detaljRef}
      offer={valt}
      plats={g.plats.get(valt.id) ?? placeraKontor(valt, kontakt.get(valt.id), bokningar, minEpost)}
      bokning={valt.booked_case_id ? bokningar.get(valt.booked_case_id) : undefined}
      kontaktlage={kontakt.get(valt.id)}
      behorighet={b}
      userId={userId}
      userName={userName}
      userEmail={userEmail}
      arDator={arDator}
      onAndrat={uppdatera}
      onDolj={dolj}
      onVisaIgen={visaIgen}
      onAngraAvskrivning={angraAvskrivning}
      onRadera={setRaderas}
      onBokaIn={setBokaIn}
      onOppnaArende={setOppetArende}
      onTillbaka={tillbaka}
    />
  )

  const dialoger = (
    <>
      <DeleteOfferConfirmDialog
        isOpen={!!raderas}
        offer={raderas}
        onClose={() => setRaderas(null)}
        onDeleted={() => {
          if (!raderas) return
          const id = raderas.id
          setOffers(prev => prev.filter(o => o.id !== id))
          setRaderas(null)
          if (valt?.id === id) { if (arDator) valjId(null); else tillbaka() }
        }}
      />
      {bokaIn && (
        <BokaIn
          kalla={{ typ: 'dokument', offerId: bokaIn.id }}
          oppen
          onStang={() => setBokaIn(null)}
          onKlar={bokaInKlar}
        />
      )}
      <OppnaArende arende={oppetArende} onClose={() => setOppetArende(null)} onSaved={uppdatera} />
    </>
  )

  // ─── Telefon: dokumentet som egen vy ───
  if (!arDator && idParam && valt) {
    return (
      <div>
        {detalj}
        {dialoger}
      </div>
    )
  }

  return (
    <div className="max-w-[1500px] mx-auto p-4 lg:p-6 space-y-4">
      {sidhuvud}
      {laddar && offers.length === 0 ? (
        <Laddar />
      ) : fel ? (
        <div className="max-w-xl rounded-2xl bg-slate-900 border border-red-500/40 p-4">
          <p className="text-white font-medium">{fel}</p>
          <button type="button" onClick={() => hamta()} className={`${RADKNAPP} mt-3`}>Försök igen</button>
        </div>
      ) : (
        <>
          <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3">
            <Vaxel
              etikett="Vy"
              className="lg:w-auto"
              valt={vy}
              onVal={setVy}
              val={[
                { varde: 'ko', text: 'Arbetskö', ikon: 'falt.attgora' },
                { varde: 'statistik', text: 'Statistik', ikon: 'allman.statistik' },
              ]}
            />
            {vy === 'ko' && statistikRad}
          </div>

          {vy === 'statistik' ? (
            <div className="rounded-2xl bg-slate-900 border border-slate-700/60 overflow-hidden">
              <DocumentStatsView isCoordinator />
            </div>
          ) : (
            <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_540px] xl:grid-cols-[minmax(0,1fr)_600px] lg:gap-6 lg:items-start">
              <div className="min-w-0 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  {teknikerValjare}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {sokFalt}
                    {typVal}
                  </div>
                </div>
                <KontorLista
                  g={g}
                  valdId={arDator ? valt?.id ?? null : null}
                  onValj={valj}
                  kontakt={kontakt}
                  bokningar={bokningar}
                  arDator={arDator}
                  vantarOppen={visaVantar}
                  onVantar={() => setVantarOppen(v => !v)}
                  klaraOppen={visaKlara}
                  onKlara={() => setKlaraOppen(v => !v)}
                  doldaAntal={doldaAntal}
                  visaDolda={visaDolda}
                  onVisaDolda={() => setVisaDolda(v => !v)}
                  filtrerat={soker || typ !== 'all' || tekniker !== 'alla'}
                  onPaminnAlla={b.atgarder ? paminnAlla : null}
                  paminner={paminner}
                />
              </div>
              {arDator && (
                <aside aria-label="Valt dokument" className="sticky top-[4rem] max-h-[calc(100vh-5rem)] overflow-y-auto rounded-2xl">
                  {detalj || (
                    <div className="rounded-2xl border border-dashed border-slate-700 px-6 py-12 flex flex-col items-center text-center gap-2">
                      <Icon name="falt.klart" size={32} className="text-[#20c58f]" />
                      <p className="text-[15px] font-semibold text-white">Inget att visa</p>
                      <p className="max-w-sm text-sm text-slate-400">Välj ett dokument i listan.</p>
                    </div>
                  )}
                </aside>
              )}
            </div>
          )}
        </>
      )}

      {dialoger}
    </div>
  )
}
