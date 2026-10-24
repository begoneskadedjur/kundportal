// src/pages/shared/intranet/guider/guide-kontrollrapport.tsx
// Guidemodul: Skicka kontrollrapporten till kunden (tekniker, nya arbetsvyn, telefon och dator).
// Etiketterna följer EditContractCaseModal i stegflödet (steget Rapport för service_type
// inspection med HjalpText Rapport, Arbetsrapport, InspectionReportSection) och
// InspectionReportSection (Kontrollrapport, Kontrollrunda avslutad, PDF, Excel, Skicka
// till kund, Mottagare, Skicka, Skicka kontrollrapporten som PDF till X?, Avbryt,
// Bekräfta och skicka, Rapporten skickas från noreply@begone.se med svar till
// info@begone.se. Bilagor över 8 MB skickas inte., toasten Kontrollrapporten skickad
// till X). Kunden: CustomerPortalLayout Rapporter, SanitationReports fliken
// Kontrollrapporter. Kontrollerat 2026-10-24. Påhittad kund.

import { useState } from 'react'
import { Icon } from '../../../../components/icons/Icon'
import { Markor, OvningRam, type OvningSvar } from '../skarmkit'
import { NyArende, NyGrupp, NyRad, NySkarm, useGuideEnhet } from '../skarmkit/nyvy'
import type { StegId } from '../../../../components/technician/ny/steg/stegKonfig'
import type { GuideModul } from './registry'
import { Hjalp, KlartAvslutat, Toast, mk } from './_nyvy_stationer'

const KUND_EPOST = 'info@exempelgarden.se'
const FORVALTARE = 'forvaltning@exempelgarden.se'

interface Lage {
  steg: StegId
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
  return (
    <NySkarm sida="arenden" titel="Mina ärenden" under="3 att ta hand om nu" onRam={tryck}
      over={<>
        <NyArende typ="inspection" aktivt={l.steg} nr="BE-0004620" status="Avslutat" statusFarg="bg-[#20c58f]"
          kund="Brf Exempelgården, Exempelvägen 3, Gävle" onNasta={() => tryck('nasta')} onTillbaka={() => tryck('tillbaka')}
          onSteg={id => tryck(`steg:${id}`)} onIkon={tryck} markor={ramMal}>
          {l.steg === 'klart' && <KlartAvslutat />}
          {l.steg === 'rapport' && <Rapport l={l} tryck={tryck} markera={markera} nr={nr} />}
          {l.steg !== 'klart' && l.steg !== 'rapport' && <p className="text-[11px] text-slate-400">Gå till steget Rapport.</p>}
        </NyArende>
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

const BAS: Lage = { steg: 'klart', skicka: false, mottagare: KUND_EPOST, bekrafta: false, toast: null }
const VISNING: { lage: Lage; markera: string }[] = [
  { lage: BAS, markera: 'steg:rapport' },
  { lage: { ...BAS, steg: 'rapport' }, markera: 'pdf' },
  { lage: { ...BAS, steg: 'rapport', toast: 'PDF nedladdad' }, markera: 'skicka-kund' },
  { lage: { ...BAS, steg: 'rapport', skicka: true }, markera: 'mottagare' },
  { lage: { ...BAS, steg: 'rapport', skicka: true }, markera: 'skicka' },
  { lage: { ...BAS, steg: 'rapport', skicka: true, bekrafta: true }, markera: 'bekrafta' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning: skicka till förvaltaren ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Kontrollen hos Brf Exempelgården är klarmarkerad och du står i steget Klart. Leta upp kontrollrapporten.' }

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
    if (l.steg !== 'rapport') {
      if (id === 'steg:rapport') { setL({ ...l, steg: 'rapport', toast: null }); tips('Rätt steg', 'Kortet Kontrollrapport finns här. Skicka den till förvaltaren.') }
      else miss('Kontrollrapporten ligger i steget Rapport. Tryck på dess ikon i stegraden överst, den tredje från vänster.')
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
