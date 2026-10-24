// src/pages/shared/intranet/guider/guide-min-kundresa.tsx
// Guidemodul: Se hur det går för dina offerter och avtal i Min kundresa (tekniker,
// nya arbetsvyn, telefon och dator).
//
// Efterbildning av NyMinKundresa och components/technician/ny/kundresa:
//   Integritet        "Sidan är din." och Vem ser vad (Du, Kontoret, Texterna)
//   växlarna          Dokumenttyp Offerter / Avtal och perioden 30, 90 eller 365 dagar
//   periodraden       "<från> till <till>, jämförs med <från> till <till>" eller ", ingen jämförelse än"
//   flödet            Din kundresa, offerter, sammanfattningen, rutan per del ("x av y skickade, z %"),
//                     teckenförklaringen och Visa flödet som tabell (Steg, Antal, Andel och tid)
//   Vad siffrorna säger, Just nu i din resa, Så räknas siffrorna
// Siffrorna och meningarna räknas med portalens egna funktioner i kundresaData.ts
// (perioder, iPeriod, raknaFlode, insikter, utanJamforelse, justNu) på påhittade dokument,
// med dagens datum satt till 2026-10-26. Påhittade kunder.

import { useMemo, useState, type ReactNode } from 'react'
import { Icon, type IconName } from '../../../../components/icons/Icon'
import {
  ARKIVGRANS, insikter, iPeriod, justNu, pct, perioder, raknaFlode, typOrd, utanJamforelse,
  type DokTyp, type KundresaDok, type PeriodDagar,
} from '../../../../components/technician/ny/kundresa/kundresaData'
import { Markor, OvningRam, type OvningSvar } from '../skarmkit'
import { NySkarm, useGuideEnhet, type GuideEnhet } from '../skarmkit/nyvy'
import type { GuideModul } from './registry'
import { MerSida, Punkt, Vaxlar, ingenMk, mkFor, vagTill, type Mk, type Tryck } from './_nyvy_salja'

// --- Påhittade dokument ---

const IDAG = '2026-10-26'

function dok(id: string, typ: DokTyp, kund: string, skickad: string, slut: { signerad?: number; forfoll?: string; status: string; frist?: string; bokad?: boolean }): KundresaDok {
  const skickadAt = `${skickad}T09:00:00+02:00`
  const signeradAt = slut.signerad !== undefined ? new Date(new Date(skickadAt).getTime() + slut.signerad * 86_400_000).toISOString() : null
  return {
    id, typ, kundnamn: kund, belopp: null, skickad_at: skickadAt, signerad_at: signeradAt,
    forfoll_at: slut.forfoll ? `${slut.forfoll}T09:00:00+02:00` : null, status: slut.status,
    signing_deadline: slut.frist ?? null, booked_case_id: slut.bokad ? 'bokad' : null, bokad_start: slut.bokad ? '2026-10-28T08:00:00+01:00' : null,
  }
}

const OFFERTER: KundresaDok[] = [
  dok('o1', 'offer', 'Familjen Exempel', '2026-10-23', { status: 'pending', frist: '2026-11-06' }),
  dok('o2', 'offer', 'Exempel AB', '2026-10-20', { signerad: 1, status: 'signed' }),
  dok('o3', 'offer', 'Brf Exempelgården', '2026-10-14', { signerad: 2, status: 'signed', bokad: true }),
  dok('o4', 'offer', 'Exempel AB', '2026-10-12', { status: 'pending', frist: '2026-10-28' }),
  dok('o5', 'offer', 'Exempel AB', '2026-10-08', { signerad: 0.5, status: 'signed' }),
  dok('o6', 'offer', 'Familjen Exempel', '2026-10-02', { status: 'overdue', forfoll: '2026-10-16' }),
  dok('o7', 'offer', 'Brf Exempelgården', '2026-09-30', { signerad: 4, status: 'signed' }),
  dok('o8', 'offer', 'Familjen Exempel', '2026-09-28', { status: 'trashed' }),
  dok('o9', 'offer', 'Exempel AB', '2026-09-24', { signerad: 2, status: 'signed' }),
  dok('o10', 'offer', 'Brf Exempelgården', '2026-09-18', { signerad: 5, status: 'signed' }),
  dok('o11', 'offer', 'Familjen Exempel', '2026-09-12', { status: 'overdue', forfoll: '2026-09-26' }),
  dok('o12', 'offer', 'Exempel AB', '2026-09-08', { signerad: 3, status: 'signed' }),
  dok('o13', 'offer', 'Familjen Exempel', '2026-09-03', { status: 'overdue', forfoll: '2026-09-17' }),
  dok('o14', 'offer', 'Brf Exempelgården', '2026-08-30', { signerad: 1, status: 'signed' }),
  dok('o15', 'offer', 'Exempel AB', '2026-08-12', { signerad: 2, status: 'signed' }),
  dok('o16', 'offer', 'Familjen Exempel', '2026-07-20', { status: 'overdue', forfoll: '2026-08-03' }),
]
const AVTAL: KundresaDok[] = [
  dok('a1', 'contract', 'Brf Exempelgården', '2026-10-19', { status: 'pending', frist: '2026-11-02' }),
  dok('a2', 'contract', 'Exempel AB', '2026-10-05', { signerad: 6, status: 'signed' }),
  dok('a3', 'contract', 'Exempel AB', '2026-09-02', { signerad: 2, status: 'signed' }),
]

function useKundresa(typ: DokTyp, dagar: PeriodDagar) {
  return useMemo(() => {
    const alla = typ === 'offer' ? OFFERTER : AVTAL
    const per = perioder(dagar, IDAG)
    const nu = raknaFlode(alla.filter(d => iPeriod(d, per.nu)))
    const fore = raknaFlode(alla.filter(d => iPeriod(d, per.fore)))
    const franNu = per.nuDelvis ? ARKIVGRANS : per.nu.fran
    const franFore = per.jamforelse === 'delvis' ? ARKIVGRANS : per.fore.fran
    return {
      per, nu, fore,
      periodText: `${franNu} till ${per.nu.till}`,
      foreText: `${franFore} till ${per.fore.till}`,
      meningar: insikter(typ, nu, fore, per),
      utan: utanJamforelse(nu, fore, per),
      rader: justNu(alla, IDAG).slice(0, 3),
    }
  }, [typ, dagar])
}

// --- Skärmen ---

type Del = 'topp' | 'flode' | 'mitten' | 'slut'

interface Lage {
  vy: 'start' | 'mer' | 'sida' | 'dokumentsignering'
  del: Del
  typ: DokTyp
  dagar: PeriodDagar
  vemSer: boolean
  ruta: string | null
  tabell: boolean
  saRaknas: boolean
}

const BAS: Lage = { vy: 'sida', del: 'topp', typ: 'offer', dagar: 90, vemSer: false, ruta: null, tabell: false, saRaknas: false }

function Avsnitt({ ikon, farg, titel, under, children }: { ikon: IconName; farg: string; titel: string; under?: string; children: ReactNode }) {
  return (
    <section className="grid gap-1 border-t border-slate-700/60 pt-2">
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-white"><Icon name={ikon} size={16} className={farg} />{titel}</p>
      {under && <p className="text-[10px] text-slate-400">{under}</p>}
      {children}
    </section>
  )
}

function Sida({ l, tryck, mk, dator }: { l: Lage; tryck: Tryck; mk: Mk; dator: boolean }) {
  const k = useKundresa(l.typ, l.dagar)
  const { nu } = k
  const ord = (n: number) => typOrd(l.typ, n)
  const harFore = k.per.jamforelse !== 'ingen'
  const bort = nu.forfoll + nu.raderades + nu.annat
  const delar = [`${nu.signerade} signerades`]
  if (nu.vantar > 0) delar.push(`${nu.vantar} väntar fortfarande på svar`)
  if (bort > 0) delar.push(`${bort} gick inte vidare`)
  const sista = delar.pop() as string
  const sammanfattning = nu.skickade === 0
    ? `Du har inte skickat några ${l.typ === 'offer' ? 'offerter' : 'avtal'} under perioden.`
    : `Du skickade ${nu.skickade} ${ord(nu.skickade)}. ${delar.length ? `${delar.join(', ')} och ${sista}` : sista}.`
  const rad = (n: number) => `${n} av ${nu.skickade} skickade, ${pct(n, nu.skickade)} %`
  const visa = (d: Del) => dator || l.del === d

  const segment = [
    { id: 'signerade', n: nu.signerade, rubrik: 'Signerade', stil: 'bg-[#20c58f]' },
    { id: 'vantar', n: nu.vantar, rubrik: 'Väntar på svar', stil: 'border border-dashed border-[#20c58f] bg-[#20c58f]/30' },
    { id: 'bort', n: bort, rubrik: 'Föll bort', stil: 'bg-slate-500' },
  ].filter(s => s.n > 0)
  const valdRuta = segment.find(s => s.id === l.ruta)

  return (
    <div className="grid gap-2 text-[11px]">
      {visa('topp') && (
        <>
          <section className="flex items-start gap-2">
            <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-[#20c58f]/10 text-[#20c58f]"><Icon name="allman.las" size={16} /></span>
            <div className="min-w-0">
              <p className="leading-snug text-slate-300"><b className="text-white">Sidan är din.</b> Jämförelserna görs bara mot din egen tidigare period, aldrig mot kollegor. Kontoret följer försäljningen på sina egna sidor, inte här.</p>
              <Markor markor={mk('vemser')}>
                <button type="button" onClick={() => tryck('vemser')} className="inline-flex items-center gap-1 py-1 text-[10.5px] font-semibold text-[#20c58f]"><Icon name="kund.info" size={16} className="h-3 w-3" />Vem ser vad</button>
              </Markor>
              {l.vemSer && (
                <ul className="list-disc pl-4 text-[10px] leading-snug text-slate-300">
                  <li><b className="text-white">Du</b> ser allt på sidan, byggt bara på dina egna dokument.</li>
                  <li><b className="text-white">Kontoret</b> ser dina offerter och avtal som vanligt, eftersom de bokar in och fakturerar. Deras översikter visar försäljningen per tekniker.</li>
                  <li><b className="text-white">Texterna</b> under Vad siffrorna säger räknas fram när du öppnar sidan och sparas inte.</li>
                </ul>
              )}
            </div>
          </section>
          <section className="grid gap-1.5 border-t border-slate-700/60 pt-2">
            <div className={dator ? 'grid grid-cols-2 gap-1.5' : 'grid gap-1.5'}>
              <Vaxlar prefix="typ" valt={l.typ} tryck={tryck} mk={mk} val={[{ id: 'offer', text: 'Offerter', ikon: 'dok.offert' }, { id: 'contract', text: 'Avtal', ikon: 'dok.avtal' }]} />
              <Vaxlar prefix="per" valt={String(l.dagar)} tryck={tryck} mk={mk} val={[{ id: '30', text: '30 dagar' }, { id: '90', text: '90 dagar' }, { id: '365', text: '365 dagar' }]} />
            </div>
            <p className="text-[10.5px] text-slate-400"><span className="font-mono">{k.periodText}</span>{harFore ? <>, jämförs med <span className="font-mono">{k.foreText}</span></> : ', ingen jämförelse än'}</p>
          </section>
        </>
      )}
      {(visa('topp') || visa('flode')) && (
        <Avsnitt ikon="lead.nasta-steg" farg="text-[#20c58f]" titel={`Din kundresa, ${l.typ === 'offer' ? 'offerter' : 'avtal'}`}>
          <p className="leading-snug text-slate-300">{sammanfattning}</p>
          {visa('flode') && nu.skickade > 0 && (
            <>
              <div className="relative mt-1">
                <div className="flex h-6 w-full gap-0.5 overflow-hidden rounded">
                    {segment.map(s => (
                      <Markor key={s.id} markor={mk(`flode:${s.id}`)} block>
                        <button type="button" onClick={() => tryck(`flode:${s.id}`)} aria-label={s.rubrik} className={`h-6 w-full ${s.stil}`} style={{ minWidth: `${Math.max(12, (s.n / nu.skickade) * 230)}px` }} />
                      </Markor>
                    ))}
                  </div>
                {valdRuta && (
                  <div className="mt-1 rounded-lg border border-slate-600 bg-slate-800 px-2 py-1">
                    <p className="text-[11px] font-semibold text-white">{valdRuta.rubrik}</p>
                    <p className="text-[10px] text-slate-300">{rad(valdRuta.n)}</p>
                  </div>
                )}
              </div>
              <p className="flex flex-wrap gap-x-2.5 text-[9.5px] text-slate-400">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#20c58f]" />{nu.bokade > 0 ? 'Signerade och bokade' : 'Signerade'}</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm border border-dashed border-[#20c58f] bg-[#20c58f]/30" />Väntar på svar</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-slate-500" />Föll bort</span>
              </p>
              <Markor markor={mk('tabell')}>
                <button type="button" onClick={() => tryck('tabell')} className="inline-flex items-center gap-1 py-0.5 text-[10.5px] font-semibold text-[#20c58f]">{l.tabell ? 'Dölj tabellen' : 'Visa flödet som tabell'}</button>
              </Markor>
              {l.tabell && (
                <table className="w-full text-[10px] text-white">
                  <thead><tr className="text-slate-400"><th className="text-left font-semibold">Steg</th><th className="text-right font-semibold">Antal</th><th className="pl-2 text-left font-semibold">Andel och tid</th></tr></thead>
                  <tbody>
                    <tr className="border-t border-slate-700/60"><td>Skickade</td><td className="text-right font-mono">{nu.skickade}</td><td className="pl-2 text-slate-300">{harFore ? `Perioden före ${k.fore.skickade}` : 'Ingen jämförelse'}</td></tr>
                    <tr className="border-t border-slate-700/60"><td>Signerade</td><td className="text-right font-mono">{nu.signerade}</td><td className="pl-2 text-slate-300">{pct(nu.signerade, nu.skickade)} % av skickade</td></tr>
                    <tr className="border-t border-slate-700/60"><td>Väntar på svar</td><td className="text-right font-mono">{nu.vantar}</td><td className="pl-2 text-slate-300">Fristen är inte ute</td></tr>
                    <tr className="border-t border-slate-700/60"><td>Förföll</td><td className="text-right font-mono">{nu.forfoll}</td><td className="pl-2 text-slate-300">Fristen gick ut</td></tr>
                  </tbody>
                </table>
              )}
            </>
          )}
        </Avsnitt>
      )}
      {visa('mitten') && nu.skickade > 0 && (
        <Avsnitt ikon="guide.bra-att-veta" farg="text-sky-400" titel="Vad siffrorna säger" under={k.utan ? undefined : `Jämfört med din egen period ${k.foreText}`}>
          {k.meningar.slice(0, 2).map((m, i) => (
            <p key={i} className="flex gap-1.5 leading-snug text-slate-300">
              <span className={`mt-[5px] h-1.5 w-1.5 flex-none rounded-full ${m.ton === 'tips' ? 'bg-amber-500' : m.ton === 'bra' ? 'bg-[#20c58f]' : 'bg-sky-500'}`} />
              <span><b className="text-white">{m.fet}</b> {m.text}</span>
            </p>
          ))}
          {k.utan && <p className="flex gap-1.5 text-[10.5px] leading-snug text-slate-400"><Icon name="kund.info" size={16} className="h-3 w-3 flex-none" />{k.utan}</p>}
        </Avsnitt>
      )}
      {visa('mitten') && (
        <Avsnitt ikon="falt.vantar" farg="text-violet-400" titel="Just nu i din resa" under="Väntar på svar, nyss förfallna och signerade, med nästa steg">
          {k.rader.map(r => (
            <Markor key={r.dok.id} markor={mk(`just:${r.dok.id}`)} block>
              <button type="button" onClick={() => tryck(`just:${r.dok.id}`)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-2 border-t border-slate-700/60 py-1 text-left">
                <span className="grid min-w-0 gap-0.5">
                  <span className="truncate text-[11.5px] font-semibold text-white">{r.dok.kundnamn}</span>
                  <Punkt ton={r.ton} liten>{r.status}</Punkt>
                  <span className="text-[10px] leading-snug text-slate-300"><span className="text-slate-400">Nästa steg:</span> {r.nasta}</span>
                </span>
                <span className="text-right text-[10px]"><span className="block font-semibold text-white">{r.steg}</span><span className="text-slate-400">{r.dagar <= 0 ? 'idag' : `${r.dagar} ${r.dagar === 1 ? 'dag' : 'dagar'} sedan`}</span></span>
              </button>
            </Markor>
          ))}
          <p className="flex items-center gap-1 border-t border-slate-700/60 pt-1 text-[10.5px] font-semibold text-[#20c58f]"><Icon name="falt.signera" size={16} className="h-3 w-3" />Allt som väntar finns i Dokumentsignering</p>
        </Avsnitt>
      )}
      {visa('slut') && (
        <section className="border-t border-slate-700/60 pt-2">
          <Markor markor={mk('saraknas')} block>
            <button type="button" onClick={() => tryck('saraknas')} className="flex w-full items-center gap-1.5 text-left text-[12.5px] font-semibold text-white">
              <Icon name="kund.info" size={16} className="text-sky-400" />Så räknas siffrorna
              <Icon name="allman.chevron" size={16} className={`ml-auto text-slate-500 ${l.saRaknas ? 'rotate-90' : ''}`} />
            </button>
          </Markor>
          {l.saRaknas && (
            <dl className="mt-1 grid gap-1 text-[10px] leading-snug">
              <div><dt className="font-semibold text-white">Vilka dokument räknas.</dt><dd className="text-slate-300">Offerter och avtal där du står som avsändare i Oneflow, skickade under perioden. Ett dokument hör till perioden då det skickades, även om kunden signerar senare. Utkast räknas inte.</dd></div>
              <div><dt className="font-semibold text-white">Jämförelsen.</dt><dd className="text-slate-300">Bara mot din egen period före, lika lång. Aldrig mot kollegor. Meningarna skrivs bara när båda perioderna har minst 5 dokument.</dd></div>
              <div><dt className="font-semibold text-white">Arkiverat räknas inte.</dt><dd className="text-slate-300">Dokument skickade före {ARKIVGRANS}, då portalen tog över, och arkiverade dokument räknas inte.</dd></div>
            </dl>
          )}
        </section>
      )}
    </div>
  )
}

function Skarm({ l, mk, tryck, enhet, markor }: { l: Lage; mk: Mk; tryck: Tryck; enhet: GuideEnhet; markor?: { pa: boolean; nr: number; mal: string } }) {
  if (l.vy === 'start' || l.vy === 'mer') {
    return (
      <NySkarm sida={l.vy === 'mer' ? 'mer' : 'idag'} titel={l.vy === 'mer' ? 'Mer' : 'Idag'} under={l.vy === 'mer' ? undefined : 'Måndag 26 oktober, 3 besök'} onRam={tryck} markor={markor}>
        {l.vy === 'mer' ? <MerSida tryck={tryck} mk={mk} grupper={['Hos kunden', 'Sälja', 'Hjälp']} /> : <p className="text-[11px] text-slate-400">Dagens besök visas här.</p>}
      </NySkarm>
    )
  }
  if (l.vy === 'dokumentsignering') {
    return (
      <NySkarm sida="dokumentsignering" titel="Dokumentsignering" under="3 att göra, 2 väntar, 1 signerade" onRam={tryck} markor={markor}>
        <p className="text-[11px] text-slate-300">Dokumentet du tryckte på öppnas här, med nästa steg överst.</p>
      </NySkarm>
    )
  }
  return (
    <NySkarm sida="kundresa" titel="Min kundresa" under="Vad som händer med offerterna och avtalen du skickar" onRam={tryck} markor={markor}>
      <Sida l={l} tryck={tryck} mk={mk} dator={enhet === 'dator'} />
    </NySkarm>
  )
}

// --- Visning ---

const VISNING: { lage: Lage; markera: string }[] = [
  { lage: { ...BAS, vy: 'start' }, markera: 'oppna' },
  { lage: BAS, markera: 'vemser' },
  { lage: { ...BAS, vemSer: true }, markera: 'per:30' },
  { lage: { ...BAS, del: 'flode', dagar: 30 }, markera: 'flode:signerade' },
  { lage: { ...BAS, del: 'flode', dagar: 30, ruta: 'signerade' }, markera: 'tabell' },
  { lage: { ...BAS, del: 'slut', dagar: 30 }, markera: 'saraknas' },
  { lage: { ...BAS, del: 'mitten', dagar: 30 }, markera: 'just:o4' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const enhet = useGuideEnhet()
  return <VisningSteg key={`${steg}-${enhet}`} steg={steg} onNasta={onNasta} enhet={enhet} />
}

function VisningSteg({ steg, onNasta, enhet }: { steg: number; onNasta: () => void; enhet: GuideEnhet }) {
  const [merOppen, setMerOppen] = useState(false)
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  const nr = steg + 1
  if (v.markera === 'oppna') {
    if (enhet === 'dator') return <Skarm l={v.lage} enhet={enhet} mk={ingenMk} markor={{ pa: true, nr, mal: 'nav:Min kundresa' }} tryck={id => { if (id === 'nav:Min kundresa') onNasta() }} />
    if (!merOppen) return <Skarm l={v.lage} enhet={enhet} mk={ingenMk} markor={{ pa: true, nr, mal: 'nav:Mer' }} tryck={id => { if (id === 'nav:Mer') setMerOppen(true) }} />
    return <Skarm l={{ ...v.lage, vy: 'mer' }} enhet={enhet} mk={mkFor('nav:Min kundresa', nr)} tryck={id => { if (id === 'nav:Min kundresa') onNasta() }} />
  }
  return <Skarm l={v.lage} enhet={enhet} mk={mkFor(v.markera, nr)} tryck={id => { if (id === v.markera) onNasta() }} />
}

// --- Övning ---

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Ta reda på hur det har gått för dina avtal det senaste året. Öppna Min kundresa.' }

function Ovning() {
  const enhet = useGuideEnhet()
  const [l, setL] = useState<Lage>({ ...BAS, vy: 'start' })
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)
  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const klar = (n: Lage) => {
    if (n.typ === 'contract' && n.dagar === 365) {
      setSvar({ typ: 'ok', titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart', text: `Du ser dina avtal för 365 dagar. Det står ingen jämförelse än: perioden före ligger före ${ARKIVGRANS}, då portalen tog över.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}` })
      return true
    }
    return false
  }

  const tryck = (id: string) => {
    if (l.vy === 'start') {
      if (id === 'nav:Mer' && enhet === 'mobil') { setL({ ...l, vy: 'mer' }); tips('Mer', 'Min kundresa står under Sälja.') }
      else if (id === 'nav:Min kundresa') { setL({ ...l, vy: 'sida' }); tips('Min kundresa', 'Välj avtal och den längsta perioden.') }
      else miss(vagTill('Min kundresa', enhet))
      return
    }
    if (l.vy === 'mer') {
      if (id === 'nav:Min kundresa') { setL({ ...l, vy: 'sida' }); tips('Min kundresa', 'Välj avtal och den längsta perioden.') }
      else miss('Min kundresa står under Sälja, indraget under Avtal och offerter.')
      return
    }
    if (l.vy !== 'sida') return
    if (id === 'typ:contract' || id === 'typ:offer') {
      const n = { ...l, typ: id.slice(4) as DokTyp }
      setL(n)
      if (!klar(n)) { if (n.typ === 'contract') tips('Avtal', 'Bra. Välj nu det senaste året.'); else miss('Offerter är bra att följa också, men uppdraget gäller avtalen.') }
      return
    }
    if (id.startsWith('per:')) {
      const n = { ...l, dagar: Number(id.slice(4)) as PeriodDagar }
      setL(n)
      if (!klar(n)) { if (n.dagar === 365) tips('Ett år', 'Bra. Byt nu till Avtal.'); else miss(`${n.dagar} dagar är kortare än ett år. Välj 365 dagar.`) }
      return
    }
    if (id === 'vemser') { setL({ ...l, vemSer: !l.vemSer }); tips('Vem ser vad', 'Bra att veta. Sidan är bara din. Välj nu avtal och 365 dagar.'); return }
    miss('Välj Avtal och 365 dagar i växlarna överst.')
  }

  const framsteg = (l.vy === 'sida' ? 1 : 0) + Number(l.typ === 'contract') + Number(l.dagar === 365)
  return (
    <OvningRam framsteg={framsteg} totalt={3} svar={svar} onBorjaOm={() => { setL({ ...BAS, vy: 'start' }); setSvar(BORJA); setFel(0) }} bred={enhet === 'dator'}>
      <Skarm l={l} enhet={enhet} mk={ingenMk} tryck={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
