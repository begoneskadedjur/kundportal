// src/pages/technician/ny/NyDokumentsignering.tsx
// Dokumentsignering i nya arbetsvyn (bara profiles.ny_arbetsvy, se VyVaxel i App.tsx).
// Koordinator, säljare och tekniker utan flaggan har kvar OfferFollowUp oförändrad.
//
// Samma data som gamla vyn: OfferFollowUpService.getDashboardData(ownDocsEmail, userId),
// alltså teknikerns egna dokument (avsändare eller skapare). Kön ordnas efter vem som
// gör nästa steg (se components/technician/ny/dokument/dokumentData.ts):
//   Att göra, Väntar på kunden, Signerade och Klara (hopfälld).
// "Att göra" i sidhuvudet räknar inte signerade som väntar på kontoret.
//
// Dator: listan och valt dokument bredvid. Pil upp och ned bläddrar, Enter går till
// valt dokument, / söker, Escape stänger menyer. Telefon: tryck öppnar dokumentet som
// egen vy (?id=), telefonens bakåtknapp går tillbaka till listan.
// Direktlänk ?id=<contracts.id> (global sök) öppnar dokumentet och nollställer filtren.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../../contexts/AuthContext'
import { Icon } from '../../../components/icons/Icon'
import { OfferFollowUpService, type FollowUpOffer } from '../../../services/offerFollowUpService'
import DocumentStatsView from '../../../components/coordinator/follow-up/DocumentStatsView'
import DeleteOfferConfirmDialog from '../../../components/coordinator/follow-up/DeleteOfferConfirmDialog'
import OppnaArende, { type ArendeRef } from '../../../components/technician/ny/OppnaArende'
import { Genomgang, type GenomgangSteg } from '../../../components/technician/ny/hjalp/Genomgang'
import { useNySidhuvud } from '../../../components/technician/ny/layout/NySidhuvud'
import { useArDator } from '../../../components/technician/ny/arenden/useArDator'
import { Laddar } from '../../../components/technician/ny/arenden/ArendeSektion'
import { Vaxel } from '../../../components/technician/ny/utrustning/Vaxel'
import { DokumentLista } from '../../../components/technician/ny/dokument/DokumentLista'
import { DokumentDetalj, type DokumentDetaljRef } from '../../../components/technician/ny/dokument/DokumentDetalj'
import {
  behorighet, gruppera, hamtaBokningar, hamtaSamtal, ordning, placera, statistik90, svTid,
  type Bokning, type SamtalInfo,
} from '../../../components/technician/ny/dokument/dokumentData'
import { RADKNAPP } from '../../../components/technician/ny/dokument/dokumentUi'

type Vy = 'ko' | 'statistik'
type Typ = 'all' | 'offer' | 'contract'

const GENOMGANG_DATOR: GenomgangSteg[] = [
  { rubrik: 'Att göra först', text: 'Överst det som väntar på dig: kunden har skrivit, förfallna, dokument som väntat länge, samtal du planerat och utkast att skicka.', mal: 'dok-attgora' },
  { rubrik: 'Nästa steg', text: 'Rutan säger vad som ska göras och har en knapp för det, till exempel Svara kunden eller Förläng och påminn.', mal: 'dok-nasta' },
  { rubrik: 'Signerade', text: 'Signerade dokument bokar kontoret in. Du behöver inte göra något, men här ser du när det är bokat.', mal: 'dok-signerade' },
  { rubrik: 'Sök och tangenter', text: 'Tryck / för att söka. Pil upp och ned bläddrar i listan och Enter går till valt dokument.', mal: 'dok-sok' },
]
const GENOMGANG_MOBIL: GenomgangSteg[] = [
  GENOMGANG_DATOR[0],
  { rubrik: 'Tryck för att öppna', text: 'Dokumentet öppnas som egen sida med nästa steg överst och knapparna längst ned. Tillbaka tar dig till listan.', mal: 'dok-attgora' },
  GENOMGANG_DATOR[2],
]

export default function NyDokumentsignering() {
  const { profile, user } = useAuth()
  const userId = user?.id ?? null
  const ownDocsEmail = profile?.technicians?.email || profile?.email || undefined
  const userName = profile?.display_name || profile?.technicians?.name || null
  const minTeknikerId = profile?.technician_id ?? null
  const b = useMemo(() => behorighet(profile ?? null), [profile])
  const arDator = useArDator()
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const idParam = params.get('id')

  const [offers, setOffers] = useState<FollowUpOffer[]>([])
  const [samtal, setSamtal] = useState<Map<string, SamtalInfo>>(new Map())
  const [bokningar, setBokningar] = useState<Map<string, Bokning>>(new Map())
  const [laddar, setLaddar] = useState(true)
  const [uppdaterar, setUppdaterar] = useState(false)
  const [fel, setFel] = useState<string | null>(null)
  const [uppdaterad, setUppdaterad] = useState<string | null>(null)

  const [vy, setVy] = useState<Vy>('ko')
  const [typ, setTyp] = useState<Typ>('all')
  const [sok, setSok] = useState('')
  const [visaDolda, setVisaDolda] = useState(false)
  const [klaraOppen, setKlaraOppen] = useState(false)
  const [raderas, setRaderas] = useState<FollowUpOffer | null>(null)
  const [oppetArende, setOppetArende] = useState<ArendeRef | null>(null)
  const [visaMig, setVisaMig] = useState(false)
  const detaljRef = useRef<DokumentDetaljRef>(null)

  // ─── Hämta ───
  const hamta = useCallback(async (tyst = false) => {
    if (tyst) setUppdaterar(true); else setLaddar(true)
    try {
      const data = await OfferFollowUpService.getDashboardData(ownDocsEmail, userId ?? undefined)
      const [s, bk] = await Promise.all([
        hamtaSamtal(data.offers.map(o => o.id)),
        hamtaBokningar(data.offers.map(o => o.booked_case_id).filter((x): x is string => !!x)),
      ])
      setOffers(data.offers)
      setSamtal(s)
      setBokningar(bk)
      setUppdaterad(svTid(new Date().toISOString()))
      setFel(null)
    } catch (err) {
      console.error('NyDokumentsignering:', err)
      if (!tyst) setFel('Kunde inte hämta dina dokument')
      else toast.error('Kunde inte uppdatera dokumenten')
    } finally {
      setLaddar(false)
      setUppdaterar(false)
    }
  }, [ownDocsEmail, userId])

  useEffect(() => { hamta() }, [hamta])
  const uppdatera = useCallback(() => { hamta(true) }, [hamta])

  // ─── Filter och grupper ───
  const q = sok.trim().toLowerCase()
  const filtrerade = useMemo(() => offers.filter(o => {
    if (typ !== 'all' && o.type !== typ) return false
    if (!visaDolda && userId && (o.hidden_by || []).includes(userId)) return false
    if (q) {
      const text = [o.company_name, o.contact_person, o.contact_email, o.quote_reference_number, o.source_case_number, o.technician_name, o.begone_employee_name, o.created_by_name]
        .filter(Boolean).join(' ').toLowerCase()
      if (!text.includes(q)) return false
    }
    return true
  }), [offers, typ, visaDolda, userId, q])

  const g = useMemo(() => gruppera(filtrerade, bokningar), [filtrerade, bokningar])
  // Räknarna i sidhuvudet gäller alla synliga dokument, oberoende av sökning och typ
  const gAlla = useMemo(
    () => gruppera(offers.filter(o => !(userId && (o.hidden_by || []).includes(userId))), bokningar),
    [offers, bokningar, userId],
  )
  const doldaAntal = useMemo(() => (userId ? offers.filter(o => (o.hidden_by || []).includes(userId)).length : 0), [offers, userId])
  const stat = useMemo(() => statistik90(offers), [offers])
  const soker = q.length > 0
  const lista = useMemo(() => ordning(g, klaraOppen || soker), [g, klaraOppen, soker])

  const oppnaVisaMig = useCallback(() => setVisaMig(true), [])
  const underrubrik = laddar && offers.length === 0
    ? undefined
    : arDator
      ? `${gAlla.antal.attgora} att göra, ${gAlla.antal.vantar} väntar på kunden, ${gAlla.antal.signerade} signerade`
      : `${gAlla.antal.attgora} att göra, ${gAlla.antal.vantar} väntar, ${gAlla.antal.signerade} signerade`
  useNySidhuvud({ underrubrik, onVisaMig: oppnaVisaMig })

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

  // Direktlänk ?id= (global sök): nollställ filtren så att dokumentet syns
  const hanterad = useRef<string | null>(null)
  useEffect(() => {
    if (!idParam) { hanterad.current = null; return }
    if (laddar || hanterad.current === idParam) return
    hanterad.current = idParam
    if (valtAvMig.current === idParam) return
    const mal = offers.find(o => o.id === idParam)
    if (!mal) {
      toast.error('Dokumentet finns inte i din dokumentlista')
      valjId(null)
      return
    }
    setVy('ko')
    setTyp('all')
    setSok('')
    if (userId && (mal.hidden_by || []).includes(userId)) setVisaDolda(true)
    if (placera(mal, bokningar).grupp === 'klara') setKlaraOppen(true)
    setTimeout(() => document.querySelector(`[data-queue-row="${mal.id}"]`)?.scrollIntoView({ block: 'nearest' }), 100)
  }, [idParam, laddar, offers, userId, bokningar, valjId])

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
        // Enter på en knapp eller länk gör knappens sak, annars går vi till valt dokument
        if (t.tagName === 'BUTTON' || t.tagName === 'A') return
        if (!valt && lista[0]) valjId(lista[0].id)
        e.preventDefault()
        setTimeout(() => detaljRef.current?.fokusera(), 0)
      } else if (e.key === '/') {
        e.preventDefault()
        document.getElementById('dok-sok')?.focus()
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

  const skrivAv = useCallback(async (o: FollowUpOffer) => {
    if (!userId) return
    if (!window.confirm(`Skriva av ${o.company_name || o.contact_person || 'dokumentet'}? Det flyttas till Klara.`)) return
    try {
      const { CasePipelineService } = await import('../../../services/casePipelineService')
      await CasePipelineService.dismissOffer(o.id, userId)
      toast.success('Dokumentet är avskrivet')
      hamta(true)
    } catch {
      toast.error('Kunde inte skriva av dokumentet')
    }
  }, [userId, hamta])

  // ─── Delar ───
  const statistikRad = (
    <button
      type="button"
      onClick={() => setVy('statistik')}
      aria-label={`Din statistik, senaste 90 dagarna: ${stat.skickade} skickade, ${stat.signerade} signerade. Öppna Statistik`}
      className="flex flex-wrap items-center gap-x-4 gap-y-1 min-h-[44px] px-3.5 py-2 rounded-2xl bg-slate-900 border border-slate-700/60 text-left text-sm text-slate-300 hover:bg-slate-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
    >
      <span className="text-slate-400">Senaste 90 dagarna</span>
      {arDator ? (
        <>
          <span><span className="font-mono font-bold text-white">{stat.skickade}</span> skickade</span>
          <span><span className="font-mono font-bold text-white">{stat.signerade}</span> signerade</span>
          <span>signeringsgrad <span className="font-mono font-bold text-[#20c58f]">{stat.grad !== null ? `${stat.grad} %` : '–'}</span></span>
          <span><span className="font-mono font-bold text-white">{stat.dagarTillSignering !== null ? stat.dagarTillSignering.toFixed(1).replace('.', ',') : '–'}</span> dagar till signering</span>
        </>
      ) : (
        <span>
          <span className="font-mono font-bold text-white">{stat.signerade}</span> av <span className="font-mono font-bold text-white">{stat.skickade}</span> signerade
          {stat.grad !== null && <>, <span className="font-mono font-bold text-[#20c58f]">{stat.grad} %</span></>}
        </span>
      )}
      <Icon name="allman.chevron" size={16} className="text-slate-400" />
    </button>
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
            className={`h-11 px-3 rounded-lg text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
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
    <label data-genomgang="dok-sok" className="relative flex-1 min-w-0 block">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"><Icon name="allman.sok" size={20} /></span>
      <input
        id="dok-sok"
        type="search"
        value={sok}
        onChange={e => setSok(e.target.value)}
        placeholder={arDator ? 'Sök kund, kontaktperson eller ärendenummer' : 'Sök'}
        aria-label="Sök på kund, kontaktperson, mejl eller ärendenummer"
        onKeyDown={e => { if (e.key === 'Escape') { setSok(''); (e.target as HTMLInputElement).blur() } }}
        className="w-full h-11 pl-10 pr-10 rounded-xl bg-slate-900 border border-slate-700 text-[15px] text-white placeholder:text-slate-500 focus:outline-none focus:border-[#20c58f] focus:ring-2 focus:ring-[#20c58f]/30"
      />
      {arDator && (
        <span aria-hidden="true" title="Tryck / för att söka" className="absolute right-3 top-1/2 -translate-y-1/2 px-1.5 rounded-md border border-slate-600 font-mono text-sm text-slate-400">/</span>
      )}
    </label>
  )

  const detalj = valt && (
    <DokumentDetalj
      ref={detaljRef}
      offer={valt}
      plats={g.plats.get(valt.id) ?? placera(valt, bokningar)}
      bokning={valt.booked_case_id ? bokningar.get(valt.booked_case_id) : undefined}
      samtalInfo={samtal.get(valt.id)}
      behorighet={b}
      userId={userId}
      userName={userName}
      userEmail={ownDocsEmail ?? null}
      arDator={arDator}
      onAndrat={uppdatera}
      onDolj={dolj}
      onVisaIgen={visaIgen}
      onSkrivAv={skrivAv}
      onRadera={setRaderas}
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
            <div className="lg:ml-auto flex items-center gap-2">
              {uppdaterad && <span className="text-sm text-slate-400">Uppdaterad {uppdaterad}</span>}
              <button type="button" onClick={uppdatera} disabled={uppdaterar} className={RADKNAPP}>
                <Icon name="utrustning.uppdatera" size={20} className={uppdaterar ? 'animate-spin' : ''} />
                Uppdatera
              </button>
              <Link to="/technician/oneflow" className={`${RADKNAPP} hidden lg:inline-flex`}>
                <Icon name="dok.offert" size={20} />
                Skapa avtal eller offert
              </Link>
            </div>
          </div>

          {vy === 'statistik' ? (
            <div className="rounded-2xl bg-slate-900 border border-slate-700/60 overflow-hidden">
              <DocumentStatsView isCoordinator={false} ownDocsEmail={ownDocsEmail} />
            </div>
          ) : (
            <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_520px] xl:grid-cols-[minmax(0,1fr)_560px] lg:gap-6 lg:items-start">
              <div className="min-w-0 space-y-5">
                <div className="flex items-center gap-2">
                  {sokFalt}
                  {typVal}
                </div>
                <DokumentLista
                  g={g}
                  valdId={arDator ? valt?.id ?? null : null}
                  onValj={valj}
                  samtal={samtal}
                  bokningar={bokningar}
                  minTeknikerId={minTeknikerId}
                  klaraOppen={klaraOppen}
                  onKlara={() => setKlaraOppen(v => !v)}
                  doldaAntal={doldaAntal}
                  visaDolda={visaDolda}
                  onVisaDolda={() => setVisaDolda(v => !v)}
                  soker={soker}
                  filtrerat={soker || typ !== 'all'}
                />
              </div>
              {arDator && (
                <aside aria-label="Valt dokument" className="sticky top-[4.5rem] max-h-[calc(100vh-5.5rem)] overflow-y-auto rounded-2xl">
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
      {!(laddar && offers.length === 0) && (
        <Genomgang id={arDator ? 'ny-dokumentsignering-dator' : 'ny-dokumentsignering'} steg={arDator ? GENOMGANG_DATOR : GENOMGANG_MOBIL} tvinga={visaMig} onStang={() => setVisaMig(false)} />
      )}
    </div>
  )
}
