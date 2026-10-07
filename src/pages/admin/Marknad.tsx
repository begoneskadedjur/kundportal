// src/pages/admin/Marknad.tsx
// Sidan Marknad: Google Ads, webbförfrågningar och cookiesamtycke. Nås från Leads (Webb) på
// /admin/leads-webb/marknad, /koordinator/leads-webb/marknad och /saljare/leads-webb/marknad.
// Åtkomst: profiles.can_view_marketing (Marknadsansvarig, sätts av admin under Användarkonton).
// RPC:erna kontrollerar samma flagga i databasen; vyn här är bara ett skal.

import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, Lock, Megaphone, RefreshCw } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import DateField from '../../components/ui/DateField'
import {
  marknadService,
  SaknarBehorighetError,
  type MarknadLeads,
  type MarknadOversikt,
  type MarknadSoktermer,
  type MarknadUtfall,
} from '../../services/marknadService'
import {
  datumTid,
  dagarMellan,
  foregaende,
  forandring,
  kr,
  kvot,
  periodFor,
  procent,
  tal,
  type PeriodVal,
} from '../../components/admin/marknad/marknadFormat'
import { Forandring, Nyckeltal, Sektion } from '../../components/admin/marknad/MarknadUi'
import { TrendDiagram } from '../../components/admin/marknad/MarknadDiagram'
import { KampanjTabell } from '../../components/admin/marknad/MarknadKampanjer'
import { LeadsSektion } from '../../components/admin/marknad/MarknadLeads'
import { SamtyckeSektion } from '../../components/admin/marknad/MarknadSamtycke'
import { SoktermTabell } from '../../components/admin/marknad/MarknadSoktermer'

const SNABBVAL: Array<[PeriodVal, string]> = [
  ['7', '7 dagar'],
  ['30', '30 dagar'],
  ['90', '90 dagar'],
  ['manad', 'Denna månad'],
  ['egen', 'Egen period'],
]

// Kända glapp i mätningen (docs/begone-se/ads/LAGE.md)
const MATGLAPP = { fran: '2026-09-23', till: '2026-10-05' }
const FORMULAR_LIVE = '2026-10-06'

interface Data {
  oversikt: MarknadOversikt
  fore: MarknadOversikt | null
  leads: MarknadLeads
  utfall: MarknadUtfall
  utfallFore: MarknadUtfall | null
  sok: MarknadSoktermer
}

function Last() {
  return (
    <div className="max-w-lg mx-auto mt-16 text-center bg-slate-800/40 border border-slate-700 rounded-xl p-8">
      <Lock className="w-8 h-8 mx-auto text-slate-500" aria-hidden="true" />
      <h1 className="mt-3 text-lg font-semibold text-white">Kräver behörigheten Marknadsansvarig</h1>
      <p className="mt-2 text-sm text-slate-400">
        Sidan visar annonskostnader, förfrågningar och samtycken. En administratör kan ge behörigheten under
        Användarkonton, Personal.
      </p>
    </div>
  )
}

export default function Marknad() {
  const { profile } = useAuth()
  const location = useLocation()
  const tillbaka = location.pathname.replace(/\/marknad\/?$/, '')

  const [val, setVal] = useState<PeriodVal>('30')
  const [egen, setEgen] = useState(() => periodFor('30'))
  const [jamfor, setJamfor] = useState(true)
  const [data, setData] = useState<Data | null>(null)
  const [laddar, setLaddar] = useState(false)
  const [fel, setFel] = useState<string | null>(null)
  const [nekad, setNekad] = useState(false)
  const [omladdning, setOmladdning] = useState(0)

  const { fran, till } = useMemo(() => (val === 'egen' ? egen : periodFor(val)), [val, egen])
  const giltig = !!fran && !!till && fran <= till
  const fore = useMemo(() => (giltig ? foregaende(fran, till) : null), [fran, till, giltig])
  const behorig = !!profile?.can_view_marketing

  useEffect(() => {
    if (!behorig || !giltig) return
    let aktiv = true
    setLaddar(true)
    setFel(null)
    Promise.all([
      marknadService.oversikt(fran, till),
      jamfor && fore ? marknadService.oversikt(fore.fran, fore.till) : Promise.resolve(null),
      marknadService.leads(fran, till),
      marknadService.utfall(fran, till),
      jamfor && fore ? marknadService.utfall(fore.fran, fore.till) : Promise.resolve(null),
      marknadService.soktermer(fran, till, 50),
    ])
      .then(([oversikt, foreOversikt, leads, utfall, utfallFore, sok]) => {
        if (!aktiv) return
        setData({ oversikt, fore: foreOversikt, leads, utfall, utfallFore, sok })
      })
      .catch((e: Error) => {
        if (!aktiv) return
        if (e instanceof SaknarBehorighetError) setNekad(true)
        else setFel(e.message)
      })
      .finally(() => {
        if (aktiv) setLaddar(false)
      })
    return () => {
      aktiv = false
    }
  }, [behorig, giltig, fran, till, jamfor, fore, omladdning])

  if (!profile) return null
  if (!behorig || nekad) return <Last />

  const o = data?.oversikt
  const t = o?.totalt
  const ft = data?.fore?.totalt
  const typ = (k: 'formular' | 'samtal_annons' | 'samtal_webb') => o?.konv_typer[k]?.antal ?? 0
  const jmf = (nu: number | null | undefined, f: number | null | undefined) =>
    jamfor && ft && nu != null && f != null ? forandring(nu, f) : null

  const ctr = t ? kvot(t.klick, t.visningar) : null
  const cpc = t ? kvot(t.kostnad, t.klick) : null
  const kpk = t ? kvot(t.kostnad, t.konverteringar) : null
  const fctr = ft ? kvot(ft.klick, ft.visningar) : null
  const fcpc = ft ? kvot(ft.kostnad, ft.klick) : null
  const fkpk = ft ? kvot(ft.kostnad, ft.konverteringar) : null

  const ads = data?.utfall.google_ads
  const adsFore = data?.utfallFore?.google_ads
  const avkastningVarde = ads ? ads.genomfort_varde || ads.bokat_varde : 0
  const avkastning = t && avkastningVarde ? kvot(avkastningVarde, t.kostnad) : null
  const avkastningGrund = ads?.genomfort_varde ? 'genomförda uppdrag' : 'bokade uppdrag'

  const overlapparGlapp = giltig && fran <= MATGLAPP.till && till >= MATGLAPP.fran
  const fore_formular = giltig && fran < FORMULAR_LIVE
  const adsSaknasFore = o?.data.forsta_datum && fran < o.data.forsta_datum
  const ingenUppladdning = data && data.utfall.uppladdning_totalt === 0

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={tillbaka} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white">
            <ArrowLeft className="w-3.5 h-3.5" /> Leads (Webb)
          </Link>
          <h1 className="mt-1 text-xl font-semibold text-white flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-[#20c58f]" aria-hidden="true" /> Marknad
          </h1>
          <p className="text-sm text-slate-400">Google Ads, webbförfrågningar och cookiesamtycke för begone.se</p>
        </div>
        <button
          type="button"
          onClick={() => setOmladdning((n) => n + 1)}
          disabled={laddar}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${laddar ? 'animate-spin' : ''}`} /> Uppdatera
        </button>
      </div>

      {/* Period */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div role="tablist" aria-label="Period" className="flex flex-wrap gap-x-4 border-b border-slate-700 text-sm">
          {SNABBVAL.map(([v, text]) => (
            <button
              key={v}
              role="tab"
              aria-selected={val === v}
              onClick={() => {
                if (v === 'egen' && val !== 'egen') setEgen({ fran, till })
                setVal(v)
              }}
              className={`pb-2 -mb-px border-b-2 ${val === v ? 'border-[#20c58f] text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
            >
              {text}
            </button>
          ))}
        </div>
        {val === 'egen' && (
          <div className="flex items-center gap-2">
            <DateField value={egen.fran} onChange={(v) => setEgen((p) => ({ ...p, fran: v }))} className="pl-9 w-36" aria-label="Från" />
            <span className="text-slate-500">till</span>
            <DateField value={egen.till} onChange={(v) => setEgen((p) => ({ ...p, till: v }))} className="pl-9 w-36" aria-label="Till" />
          </div>
        )}
        <label className="inline-flex items-center gap-2 text-sm text-slate-300 cursor-pointer pb-2">
          <input type="checkbox" className="accent-[#20c58f]" checked={jamfor} onChange={(e) => setJamfor(e.target.checked)} />
          Jämför med föregående period
        </label>
      </div>

      <div className="text-xs text-slate-400 space-y-1">
        {giltig ? (
          <p>
            {fran} till {till} ({tal(dagarMellan(fran, till))} dagar)
            {jamfor && fore && <> jämfört med {fore.fran} till {fore.till}</>}.{' '}
            {o?.data.hamtad_at && <>Ads-data hämtad {datumTid(o.data.hamtad_at)}, uppdateras varje natt.</>}
          </p>
        ) : (
          <p className="text-amber-400">Välj ett giltigt datumintervall.</p>
        )}
        {adsSaknasFore && <p className="text-amber-400/90">Ads-data finns från {o?.data.forsta_datum}. Dagar före det räknas som noll.</p>}
        {overlapparGlapp && (
          <p className="text-amber-400/90">
            Perioden innehåller {MATGLAPP.fran} till {MATGLAPP.till}: ingen konverteringsmätning på begone.se och annonserna var i stort sett
            avstängda när WordPress-sajten byttes ut. Siffrorna från de dagarna säger inget om konvertering.
          </p>
        )}
        {fore_formular && (
          <p>Konverteringen Formulär ifyllt mäts med den nya taggen sedan {FORMULAR_LIVE}; äldre konverteringar kommer från BrightBid-tiden.</p>
        )}
      </div>

      {fel && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">{fel}</div>}
      {!data && laddar && <div className="py-16 text-center text-sm text-slate-500">Laddar …</div>}

      {data && o && t && (
        <>
          {/* (a) Översikt */}
          <Sektion titel="Översikt" under="Google Ads för hela kontot. Bokat och genomfört räknas ur kundportalen för förfrågningar från Google Ads.">
            <div className={`grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 ${laddar ? 'opacity-60' : ''}`}>
              <Nyckeltal etikett="Kostnad" varde={kr(t.kostnad)} forandring={jamfor && <Forandring varde={jmf(t.kostnad, ft?.kostnad)} neutral />} />
              <Nyckeltal etikett="Visningar" varde={tal(t.visningar)} forandring={jamfor && <Forandring varde={jmf(t.visningar, ft?.visningar)} />} />
              <Nyckeltal etikett="Klick" varde={tal(t.klick)} forandring={jamfor && <Forandring varde={jmf(t.klick, ft?.klick)} />} />
              <Nyckeltal etikett="CTR" varde={procent(ctr, 2)} forandring={jamfor && <Forandring varde={jmf(ctr, fctr)} />} />
              <Nyckeltal etikett="Snitt-CPC" varde={kr(cpc, 2)} forandring={jamfor && <Forandring varde={jmf(cpc, fcpc)} omvand />} />
              <Nyckeltal
                etikett="Konverteringar"
                varde={tal(t.konverteringar, t.konverteringar % 1 ? 1 : 0)}
                forandring={jamfor && <Forandring varde={jmf(t.konverteringar, ft?.konverteringar)} />}
                under={
                  <span className="block w-full">
                    formulär {tal(typ('formular'))}, samtal annons {tal(typ('samtal_annons'))}, samtal webbplats {tal(typ('samtal_webb'))}
                  </span>
                }
              />
              <Nyckeltal
                etikett="Kostnad per konvertering"
                varde={kr(kpk)}
                forandring={jamfor && <Forandring varde={jmf(kpk, fkpk)} omvand />}
                saknas={t.konverteringar ? undefined : 'Inga konverteringar'}
              />
              <Nyckeltal
                etikett="Bokat uppdrag"
                varde={ads ? `${tal(ads.bokat)} st` : '–'}
                under={<span>{ads?.bokat_varde ? kr(ads.bokat_varde) : 'inget värde än'}</span>}
                forandring={jamfor && adsFore && <Forandring varde={forandring(ads?.bokat ?? 0, adsFore.bokat)} />}
              />
              <Nyckeltal
                etikett="Genomfört uppdrag"
                varde={ads ? `${tal(ads.genomfort)} st` : '–'}
                under={<span>{ads?.genomfort_varde ? kr(ads.genomfort_varde) : 'inget värde än'}</span>}
                forandring={jamfor && adsFore && <Forandring varde={forandring(ads?.genomfort ?? 0, adsFore.genomfort)} />}
              />
              <Nyckeltal
                etikett="Avkastning (värde / kostnad)"
                varde={avkastning != null ? tal(avkastning, 2) : '–'}
                under={avkastning != null ? <span>på {avkastningGrund}</span> : undefined}
                saknas={avkastning == null ? 'Inga bokade uppdrag från Google Ads under perioden' : undefined}
              />
            </div>
            {ingenUppladdning && (
              <p className="mt-3 text-xs text-amber-400/90">
                Inga uppdrag är uppladdade till Google Ads än (nattjobbet för Bokat och Genomfört uppdrag går i torrläge första veckan).
                Bokat och genomfört ovan räknas därför bara ur kundportalen.
              </p>
            )}
          </Sektion>

          {/* (b) Trend */}
          <Sektion titel="Trend per dag" under="Konverteringar räknas på klickdagen, som i Google Ads. Formulär och samtal inklusive sekundära.">
            <TrendDiagram dagar={o.per_dag} />
          </Sektion>

          {/* (c) Per kampanj */}
          <Sektion titel="Per kampanj och tjänst" under="Klicka på en kolumnrubrik för att sortera.">
            <KampanjTabell kampanjer={o.per_kampanj} />
          </Sektion>

          {/* (d) Webbförfrågningar */}
          <Sektion titel="Webbförfrågningar" under="Förfrågningar från formulären på begone.se (Leads Webb), per källa och tjänst.">
            <LeadsSektion leads={data.leads} utfall={data.utfall} />
          </Sektion>

          {/* (e) Cookiesamtycke */}
          <Sektion titel="Cookiesamtycke" under="Val i cookiebannern på begone.se. Ingen IP-adress sparas.">
            <SamtyckeSektion fran={fran} till={till} />
          </Sektion>

          {/* (f) Söktermer */}
          <Sektion titel="Topp söktermer" under="Vad folk faktiskt sökte på när annonserna visades, sorterat på kostnad.">
            <SoktermTabell data={data.sok} />
          </Sektion>
        </>
      )}
    </div>
  )
}
