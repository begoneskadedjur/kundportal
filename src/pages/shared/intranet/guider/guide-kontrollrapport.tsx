// src/pages/shared/intranet/guider/guide-kontrollrapport.tsx
// Guidemodul: Skicka kontrollrapporten till kunden (tekniker, nya arbetsvyn, telefon och dator).
// Två vägar, båda i EditContractCaseModal i stegflödet för service_type inspection:
//  1. Steget Klart när kontrollen är klarmarkerad: rutan Rapporten är klar (KlartRapport med
//     useKontrollRapport, 3.132.0): Skicka till kund med kundens adress, frågan Skicka till kund?
//     (SkickaTillKundArk: Avbryt, Skicka), toasten Kontrollrapporten skickad till X, och rutan
//     Kontrollrapporten är skickad / Skickad till X. Skärmdelarna ligger i _rapporter.tsx.
//  2. Steget Rapport, kortet Kontrollrapport (InspectionReportSection: Kontrollrunda avslutad,
//     PDF, Excel, Skicka till kund, Mottagare, Skicka, Skicka kontrollrapporten som PDF till X?,
//     Avbryt, Bekräfta och skicka, Rapporten skickas från noreply@begone.se med svar till
//     info@begone.se. Bilagor över 8 MB skickas inte.). Här går adressen att ändra.
// Kunden: CustomerPortalLayout Rapporter, SanitationReports fliken Kontrollrapporter.
// Kontrollerat 2026-10-24, Klart-rutan 2026-11-13. Påhittad kund.

import { useState } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { Markor, OvningRam, type OvningSvar } from '../skarmkit'
import { NyArende, NyGrupp, NyRad, NySkarm, useGuideEnhet } from '../skarmkit/nyvy'
import type { StegId } from '../../../../components/technician/ny/steg/stegKonfig'
import type { GuideModul } from './registry'
import { Hjalp, KlartAvslutat, Toast, mk } from './_nyvy_stationer'
import { RapportKlarRuta, SkickaKundArk, type RutaLage } from './_rapporter'

const KUND_EPOST = 'info@exempelgarden.se'
const FORVALTARE = 'forvaltning@exempelgarden.se'
const MIN_EPOST = 'anna@exempel.se'
const NR = 'BE-0004620'

interface Lage {
  steg: StegId
  /** Rutan i Klart */
  ruta: RutaLage
  /** Frågan Skicka till kund? från rutan i Klart */
  ark: boolean
  skicka: boolean
  mottagare: string
  bekrafta: boolean
  toast: string | null
}

function Rapport({ l, tryck, markera, nr }: { l: Lage; tryck: (id: string) => void; markera?: string; nr: number }) {
  const enhet = useGuideEnhet()
  const knapp = (id: string, text: string, ikon: 'rapport.ladda' | 'allman.lista' | 'kontakt.mejl', prim?: boolean) => (
    <Markor markor={mk(markera, id, nr)}>
      <button type="button" onClick={() => tryck(id)}
        className={`inline-flex h-7 items-center gap-1 rounded-lg px-2 text-[10.5px] font-semibold ${prim ? 'bg-[#20c58f] text-[#04281c]' : 'border border-slate-600 text-slate-200'}`}>
        <Icon name={ikon} size={16} className="h-3.5 w-3.5" />{text}
      </button>
    </Markor>
  )
  return (
    <div className="grid gap-1.5">
      <Hjalp rubrik="Rapport">{enhet === 'dator' ? 'Kontrollrapporten visas här när kontrollrundan är avslutad. Där laddar du ned den som PDF eller Excel och skickar den till kunden.' : undefined}</Hjalp>
      <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-2">
        <p className="text-[11px] font-semibold text-white">Arbetsrapport</p>
        <p className="mt-0.5 rounded border border-slate-700 bg-slate-800/50 px-1.5 py-1 text-[10.5px] text-slate-200">Kontrollerat 6/6 stationer.</p>
      </div>
      <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-white"><Icon name="station.klar" size={16} className="h-3.5 w-3.5 text-[#20c58f]" />Kontrollrapport</p>
        <p className="mt-1 flex items-center gap-1.5 text-[10.5px] text-slate-300"><span className="h-1.5 w-1.5 rounded-full bg-[#20c58f]" />Kontrollrunda avslutad 2026-10-26 <span className="text-slate-500">· Anna Exempel</span></p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {knapp('pdf', 'PDF', 'rapport.ladda')}
          {knapp('excel', 'Excel', 'allman.lista')}
          {knapp('skicka-kund', 'Skicka till kund', 'kontakt.mejl', true)}
        </div>
        {l.skicka && (
          <div className="mt-1.5 grid gap-1 rounded-lg border border-slate-700/50 bg-slate-800/20 p-1.5">
            <p className="text-[10px] font-medium text-slate-400">Mottagare</p>
            <div className="flex gap-1">
              <Markor markor={mk(markera, 'mottagare', nr)} block>
                <button type="button" onClick={() => tryck('mottagare')} className="flex h-7 w-full items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/50 px-1.5 text-left text-[10.5px] text-white">
                  <Icon name="kontakt.mejl" size={16} className="h-3 w-3 text-slate-500" /><span className="truncate">{l.mottagare}</span>
                </button>
              </Markor>
              {!l.bekrafta && (
                <Markor markor={mk(markera, 'skicka', nr)}>
                  <button type="button" onClick={() => tryck('skicka')} className="h-7 rounded-lg bg-[#20c58f] px-2 text-[10.5px] font-semibold text-[#04281c]">Skicka</button>
                </Markor>
              )}
            </div>
            {l.bekrafta && (
              <div className="grid gap-1 border-t border-slate-700/50 pt-1">
                <p className="text-[10.5px] text-slate-300">Skicka kontrollrapporten som PDF till <span className="font-medium text-white">{l.mottagare}</span>?</p>
                <div className="flex justify-end gap-1">
                  <button type="button" onClick={() => tryck('avbryt')} className="h-7 rounded-lg px-2 text-[10.5px] text-slate-300">Avbryt</button>
                  <Markor markor={mk(markera, 'bekrafta', nr)}>
                    <button type="button" onClick={() => tryck('bekrafta')} className="h-7 rounded-lg bg-[#20c58f] px-2 text-[10.5px] font-semibold text-[#04281c]">Bekräfta och skicka</button>
                  </Markor>
                </div>
              </div>
            )}
            <p className="text-[9px] text-slate-500">Rapporten skickas från noreply@begone.se med svar till info@begone.se. Bilagor över 8 MB skickas inte.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Skarm({ l, tryck, markera, nr }: { l: Lage; tryck: (id: string) => void; markera?: string; nr: number }) {
  const ramMal = markera && (markera.startsWith('steg:') || markera === 'nasta') ? { pa: true, nr, mal: markera } : undefined
  const m = (id: string) => mk(markera, id, nr)
  return (
    <NySkarm sida="arenden" titel="Mina ärenden" under="3 att ta hand om nu" onRam={tryck}
      over={<>
        <NyArende typ="inspection" aktivt={l.steg} nr={NR} status="Avslutat" statusFarg="bg-[#20c58f]"
          kund="Brf Exempelgården, Exempelvägen 3, Gävle" onNasta={() => tryck('nasta')} onTillbaka={() => tryck('tillbaka')}
          onSteg={id => tryck(`steg:${id}`)} onIkon={tryck} markor={ramMal}>
          {l.steg === 'klart' && (
            <KlartAvslutat>
              <RapportKlarRuta lage={l.ruta} rapportNamn="Kontrollrapport" kundEpost={KUND_EPOST} minEpost={MIN_EPOST} excel mk={m} tryck={tryck} />
            </KlartAvslutat>
          )}
          {l.steg === 'rapport' && <Rapport l={l} tryck={tryck} markera={markera} nr={nr} />}
          {l.steg !== 'klart' && l.steg !== 'rapport' && <p className="text-[11px] text-slate-400">Gå till steget Rapport eller Klart.</p>}
        </NyArende>
        {l.ark && <SkickaKundArk rapportNamn="Kontrollrapport" arendeNr={NR} epost={KUND_EPOST} mk={m} tryck={tryck} />}
        {l.toast && <Toast text={l.toast} />}
      </>}>
      <NyGrupp titel="Den här veckan" antal={2}>
        <NyRad titel="Brf Exempelgården" tid="Idag 08:00" under="Kontrollbesök" status="Avslutat" statusFarg="bg-[#20c58f]" />
        <NyRad titel="Exempel AB" tid="Idag 10:30" under="Kontrollbesök" status="Bokad" />
      </NyGrupp>
    </NySkarm>
  )
}

// ─── Visning ───

const BAS: Lage = { steg: 'klart', ruta: 'val', ark: false, skicka: false, mottagare: KUND_EPOST, bekrafta: false, toast: null }
const VISNING: { lage: Lage; markera: string }[] = [
  { lage: BAS, markera: 'rk-kund' },
  { lage: { ...BAS, ark: true }, markera: 'ark-skicka' },
  { lage: { ...BAS, ruta: 'skickad', toast: `Kontrollrapporten skickad till ${KUND_EPOST}` }, markera: 'steg:rapport' },
  { lage: { ...BAS, steg: 'rapport' }, markera: 'skicka-kund' },
  { lage: { ...BAS, steg: 'rapport', skicka: true }, markera: 'mottagare' },
  { lage: { ...BAS, steg: 'rapport', skicka: true, mottagare: FORVALTARE }, markera: 'skicka' },
  { lage: { ...BAS, steg: 'rapport', skicka: true, mottagare: FORVALTARE, bekrafta: true }, markera: 'bekrafta' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning: skicka till förvaltaren ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Kontrollen hos Brf Exempelgården är klarmarkerad och du står i steget Klart. Kunden vill att förvaltaren får kontrollrapporten, inte kundens vanliga adress.' }

const KLART_TIPS: Record<string, string> = {
  'rk-kund': `Skicka till kund går alltid till kundens adress, ${KUND_EPOST}. Adressen går inte att ändra här. Förvaltaren skickar du till från kortet Kontrollrapport i steget Rapport.`,
  'rk-mig': 'Skicka till mig går till din egen e-post. Förvaltaren ska ha rapporten.',
  'rk-pdf': 'Bra att ha, men uppdraget var att mejla rapporten till förvaltaren.',
  'rk-excel': 'Bra att ha, men uppdraget var att mejla rapporten till förvaltaren.',
  'rk-intenu': 'Skicka inte nu fäller bara ihop rutan. Förvaltaren ska ha rapporten nu.',
  'rk-ga': 'Under Rapporter på datorn kan du skriva en annan adress, men nu står du redan i ärendet. Gå till steget Rapport.',
}

function Ovning() {
  const enhet = useGuideEnhet()
  const [l, setL] = useState<Lage>(BAS)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)
  const [klar, setKlar] = useState(false)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (klar) return
    if (l.ark) {
      setL({ ...l, ark: false })
      if (id === 'ark-skicka') miss(`Då hade rapporten gått till ${KUND_EPOST}. Tryck Avbryt nästa gång och gå till steget Rapport, där du kan skriva förvaltarens adress.`)
      else tips('Avbrutet', 'Inget skickades. Förvaltarens adress skriver du i steget Rapport.')
      return
    }
    if (l.steg !== 'rapport') {
      if (id === 'steg:rapport') { setL({ ...l, steg: 'rapport', toast: null }); tips('Rätt steg', 'Kortet Kontrollrapport finns här. Där kan du ändra mottagaren.') }
      else if (id === 'rk-kund') { setL({ ...l, ark: true }); miss(KLART_TIPS['rk-kund']) }
      else if (id === 'rk-visaval') setL({ ...l, ruta: 'val' })
      else if (id === 'rk-intenu') { setL({ ...l, ruta: 'inte-nu' }); miss(KLART_TIPS['rk-intenu']) }
      else miss(KLART_TIPS[id] ?? 'Förvaltarens adress skriver du i kortet Kontrollrapport i steget Rapport. Tryck på dess ikon i stegraden, den tredje från vänster.')
      return
    }
    if (id === 'pdf' || id === 'excel') { setL({ ...l, toast: id === 'pdf' ? 'PDF nedladdad' : 'Excel nedladdad' }); tips('Nedladdad', 'Bra att ha, men uppdraget var att mejla rapporten. Tryck Skicka till kund.'); return }
    if (id === 'skicka-kund') { setL({ ...l, skicka: !l.skicka, bekrafta: false, toast: null }); tips('Mottagare', `Fältet har kundens adress ${KUND_EPOST}. Förvaltaren ska ha rapporten.`); return }
    if (id === 'mottagare') {
      setL({ ...l, mottagare: FORVALTARE, bekrafta: false })
      tips('Adressen ändrad', `Du skrev ${FORVALTARE}. Tryck Skicka.`)
      return
    }
    if (id === 'skicka') {
      if (l.mottagare !== FORVALTARE) miss('Förvaltaren ska ha rapporten. Tryck på fältet Mottagare och skriv förvaltarens adress först.')
      else { setL({ ...l, bekrafta: true }); tips('Kontrollera', 'Portalen frågar en gång till. Stämmer adressen?') }
      return
    }
    if (id === 'avbryt') { setL({ ...l, bekrafta: false }); tips('Avbrutet', 'Inget skickades.'); return }
    if (id === 'bekrafta') {
      setL({ ...l, toast: `Kontrollrapporten skickad till ${FORVALTARE}`, bekrafta: false, skicka: false })
      setKlar(true)
      setSvar({ typ: 'ok', titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart', text: `Förvaltaren får rapporten som PDF från noreply@begone.se. Kunden ser samma rapport i sin portal under Rapporter, Kontrollrapporter.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'}, det gör inget.` : ''}` })
      return
    }
    miss('Allt du behöver finns i kortet Kontrollrapport.')
  }

  const framsteg = klar ? 5 : l.steg !== 'rapport' ? 0 : !l.skicka ? 1 : l.mottagare !== FORVALTARE ? 2 : l.bekrafta ? 4 : 3
  return (
    <OvningRam framsteg={framsteg} totalt={5} svar={svar} onBorjaOm={() => { setL(BAS); setSvar(BORJA); setFel(0); setKlar(false) }} bred={enhet === 'dator'}>
      <Skarm l={l} tryck={tryck} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
