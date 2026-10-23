// src/pages/shared/intranet/guider/guide-roller-och-vyer.tsx
// Guidemodul: Hitta rätt i nya arbetsvyn (tekniker, telefon och dator).
// FACIT för guiderna i nya vyn (2026-10-24): enheter ['mobil','dator'], ramen
// NySkarm ritar telefonens bottenmeny eller datorns sidomeny enligt läsarens val.
// Etiketterna kommer från NyTeknikerLayout (Bottenmeny: Idag, Karta, Skapa, Ärenden,
// Mer; Sidhuvud: sök, tillbud, Tickets, Visa mig hur; datorn: Skapa och sökrutan),
// nyNavConfig (grupperna Min dag, Hos kunden, Sälja, Hjälp), SkapaArk (valen) och
// NyMer (Konto: Mitt konto och visning, Rapportera bugg, Logga ut). Påhittade kunder.

import { useState } from 'react'
import { Icon, type IconName } from '../../../../components/icons/Icon'
import { NY_NAV_GRUPPER } from '../../../../components/technician/ny/layout/nyNavConfig'
import { Ark, OvningRam, type OvningSvar } from '../skarmkit'
import { NyGrupp, NyRad, NySkarm, useGuideEnhet, type NyMarkor, type NySida } from '../skarmkit/nyvy'
import type { GuideModul } from './registry'

type Vy = 'idag' | 'karta' | 'arenden' | 'skapa' | 'mer' | 'tickets' | 'visamig'

const SKAPA: { rubrik: string; text: string; ikon: IconName }[] = [
  { rubrik: 'Avtal eller offert', text: 'Skickas till kunden som signerar i mobilen.', ikon: 'dok.avtal' },
  { rubrik: 'Specialrapport', text: 'Inspektion, sanering eller annan rapport med bilder.', ikon: 'falt.specialrapport' },
  { rubrik: 'Ny station', text: 'Välj kunden på Stationer och placera stationen på kartan.', ikon: 'falt.nystation' },
  { rubrik: 'Tips om ny kund', text: 'Någon som behöver hjälp? Skriv namn och vad det gäller.', ikon: 'lead.tips' },
  { rubrik: 'Ticket till en kollega', text: 'Till en kollega, en roll eller alla, om ett ärende.', ikon: 'dok.konversation' },
  { rubrik: 'Fråga AI-assistenten', text: 'Om skadedjur, metoder eller hur portalen fungerar.', ikon: 'kalla.ai' },
]

const SIDA: Record<Vy, { sida: NySida; titel: string; under?: string }> = {
  idag: { sida: 'idag', titel: 'Idag', under: 'Måndag 26 oktober, 3 besök' },
  karta: { sida: 'karta', titel: 'Karta' },
  arenden: { sida: 'arenden', titel: 'Mina ärenden', under: '4 att ta hand om nu' },
  skapa: { sida: 'idag', titel: 'Idag', under: 'Måndag 26 oktober, 3 besök' },
  mer: { sida: 'mer', titel: 'Mer' },
  tickets: { sida: 'tickets', titel: 'Tickets', under: '1 väntar på dig' },
  visamig: { sida: 'arenden', titel: 'Mina ärenden', under: '4 att ta hand om nu' },
}

function Innehall({ vy, enhet, onRam }: { vy: Vy; enhet: 'mobil' | 'dator'; onRam?: (mal: string) => void }) {
  if (vy === 'karta') {
    return (
      <div className="relative h-full min-h-[300px] overflow-hidden rounded-lg bg-[#1f2a33]">
        <div className="absolute inset-0 opacity-30 [background:repeating-linear-gradient(35deg,#334155_0_2px,transparent_2px_26px)]" />
        {[[30, 40, 1], [55, 30, 2], [70, 62, 3]].map(([x, y, n]) => (
          <span key={n} className="absolute flex h-6 w-6 items-center justify-center rounded-full bg-[#20c58f] text-[11px] font-bold text-[#04281c]" style={{ left: `${x}%`, top: `${y}%` }}>{n}</span>
        ))}
        <div className="absolute inset-x-2 bottom-2 rounded-lg bg-slate-900/95 p-2 text-[11px] text-slate-300">Idag, 3 stopp · Imorgon, 2 stopp</div>
      </div>
    )
  }
  if (vy === 'mer') {
    const iBotten = new Set(['Idag', 'Karta', 'Mina ärenden'])
    return (
      <div className="grid gap-2 overflow-hidden">
        {NY_NAV_GRUPPER.map(g => {
          const lankar = g.lankar.filter(l => !iBotten.has(l.label))
          if (!lankar.length) return null
          return (
            <div key={g.label}>
              <p className="px-1 text-[9.5px] font-semibold uppercase tracking-wider text-slate-500">{g.label}</p>
              <div className="rounded-lg border border-slate-700/60 bg-slate-900">
                {lankar.map(l => (
                  <button type="button" key={l.label} onClick={() => onRam?.(`nav:${l.label}`)} className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-[12px] text-slate-200 hover:bg-slate-800"><Icon name={l.ikon} size={16} className="text-slate-400" />{l.label}</button>
                ))}
              </div>
            </div>
          )
        })}
        <div>
          <p className="px-1 text-[9.5px] font-semibold uppercase tracking-wider text-slate-500">Konto</p>
          <div className="rounded-lg border border-slate-700/60 bg-slate-900">
            <p className="flex items-center gap-2 px-2 py-1.5 text-[12px] text-slate-200"><Icon name="rapport.person" size={16} className="text-slate-400" />Mitt konto och visning</p>
          </div>
        </div>
      </div>
    )
  }
  if (vy === 'tickets') {
    return (
      <NyGrupp titel="Väntar på dig" antal={1} text="Någon har frågat dig något eller svarat på din fråga.">
        <NyRad titel="Kan du ta med fler betesstationer?" under="Brf Exempelgården, Anna till dig" status="Väntar på ditt svar" />
      </NyGrupp>
    )
  }
  if (vy === 'arenden' || vy === 'visamig') {
    return (
      <>
        <NyGrupp titel="Den här veckan" antal={3} text="Dina besök från idag till och med söndag.">
          <NyRad titel="Familjen Exempel" tid="Idag 08:00" under="Privat, sanering råtta" status="Bokad" />
          <NyRad titel="Exempel AB" tid="Idag 10:30" under="Kontrollbesök" status="Bokad" />
          <NyRad titel="Brf Exempelgården" tid="Imorgon 09:00" under="Etablering" status="Bokad" />
        </NyGrupp>
        {vy === 'visamig' && (
          <div className="absolute inset-x-2 bottom-2 z-10 rounded-xl border border-[#20c58f]/40 bg-slate-900 p-2.5">
            <p className="text-[10px] font-semibold text-[#20c58f]">Visa mig hur · 1 av 3</p>
            <p className="text-[12px] font-semibold text-white">Tre lägen</p>
            <p className="text-[11px] text-slate-400">Att göra visar veckan och det som väntar på dig.</p>
          </div>
        )}
      </>
    )
  }
  // idag och skapa
  return (
    <>
      <div className="mb-2 rounded-lg border border-[#20c58f]/30 bg-[#20c58f]/10 p-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#20c58f]">Nästa uppdrag</p>
        <p className="text-[13px] font-semibold text-white">Familjen Exempel, 08:00</p>
        <p className="text-[11px] text-slate-400">Exempelvägen 4, Södertälje · 12 min bort</p>
        <div className={`mt-1.5 grid gap-1 ${enhet === 'dator' ? 'grid-cols-3 max-w-xs' : 'grid-cols-3'}`}>
          {['Navigera', 'Ring', 'Öppna'].map(t => <span key={t} className="rounded-md border border-slate-600 bg-slate-800 py-1 text-center text-[11px] text-slate-200">{t}</span>)}
        </div>
      </div>
      <NyGrupp titel="Dagens rutt" antal={3}>
        <NyRad titel="Familjen Exempel" tid="08:00" status="Bokad" />
        <NyRad titel="Exempel AB" tid="10:30" status="Bokad" />
        <NyRad titel="Brf Exempelgården" tid="13:00" status="Bokad" />
      </NyGrupp>
    </>
  )
}

function SkapaArk() {
  return (
    <Ark titel="Vad vill du göra?" under="Välj en ruta. Du kan alltid gå tillbaka.">
      <div className="grid gap-1">
        {SKAPA.map(s => (
          <p key={s.rubrik} className="flex items-start gap-2 rounded-lg px-1 py-1">
            <span className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-[#20c58f]/10 text-[#20c58f]"><Icon name={s.ikon} size={16} /></span>
            <span className="min-w-0"><span className="block text-[12px] font-semibold text-white">{s.rubrik}</span><span className="block text-[10.5px] leading-snug text-slate-400">{s.text}</span></span>
          </p>
        ))}
      </div>
    </Ark>
  )
}

/** Var man trycker för att komma till vyn, telefon och dator */
function malFor(vy: Vy, enhet: 'mobil' | 'dator'): string {
  if (enhet === 'dator') {
    return ({ idag: 'nav:Idag', karta: 'nav:Karta', arenden: 'nav:Mina ärenden', skapa: 'skapa', mer: 'nav:Stationer', tickets: 'tickets', visamig: 'visamig' } as Record<Vy, string>)[vy]
  }
  return ({ idag: 'nav:Idag', karta: 'nav:Karta', arenden: 'nav:Ärenden', skapa: 'nav:Skapa', mer: 'nav:Mer', tickets: 'tickets', visamig: 'visamig' } as Record<Vy, string>)[vy]
}

function Skarm({ vy, markor, onRam }: { vy: Vy; markor?: NyMarkor; onRam: (mal: string) => void }) {
  const enhet = useGuideEnhet()
  const s = SIDA[vy]
  return (
    <NySkarm sida={s.sida} titel={s.titel} under={s.under} tickets={1} onRam={onRam} markor={markor}
      over={vy === 'skapa' ? <SkapaArk /> : undefined}>
      <Innehall vy={vy === 'mer' && enhet === 'dator' ? 'idag' : vy} enhet={enhet} onRam={onRam} />
    </NySkarm>
  )
}

// Stegen i visningen: vilken vy som visas och vad som markeras
const STEG: Vy[] = ['idag', 'karta', 'arenden', 'skapa', 'mer', 'tickets', 'visamig']

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const enhet = useGuideEnhet()
  // Skärmen visar sidan man kommer till efter steget före, markören på dit man trycker nu
  const vy = steg === 0 ? 'arenden' : STEG[steg - 1] === 'skapa' ? 'idag' : STEG[steg - 1]
  const mal = malFor(STEG[steg], enhet)
  return <Skarm vy={vy} markor={{ pa: true, nr: steg + 1, mal }} onRam={m => { if (m === mal) onNasta() }} />
}

// Övningen: hitta Tickets och sedan Stationer
function Ovning() {
  const enhet = useGuideEnhet()
  const [vy, setVy] = useState<Vy>('idag')
  const [framsteg, setFramsteg] = useState(0)
  const start: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Anna har frågat dig något. Öppna sidan där frågorna till dig ligger.' }
  const [svar, setSvar] = useState<OvningSvar>(start)

  const tryck = (mal: string) => {
    if (framsteg === 0) {
      if (mal === 'tickets' || mal === 'nav:Tickets') {
        setVy('tickets'); setFramsteg(1)
        setSvar({ typ: 'tips', titel: 'Rätt, det är Tickets', text: enhet === 'dator' ? 'Klockan uppe till höger och Tickets i sidomenyn går till samma sida. Öppna nu Stationer.' : 'Klockan uppe till höger går till Tickets. Öppna nu Stationer, som ligger under Mer.' })
        return
      }
      setSvar({ typ: 'fel', titel: 'Inte där', text: 'Frågorna till dig ligger i Tickets. Leta efter klockan uppe till höger, siffran visar hur många som väntar.' })
      return
    }
    if (framsteg === 2) {
      if (mal === 'nav:Stationer') {
        setFramsteg(3)
        setSvar({ typ: 'ok', titel: 'Klart', text: 'Du hittade både Tickets och Stationer. Allt som inte står i bottenmenyn ligger under Mer.' })
        return
      }
      setSvar({ typ: 'fel', titel: 'Inte den', text: 'Stationer står under rubriken Hos kunden.' })
      return
    }
    if (framsteg === 1) {
      if (enhet === 'mobil' && mal === 'nav:Mer') {
        setVy('mer')
        setSvar({ typ: 'tips', titel: 'Bra', text: 'Under Mer ligger allt som inte får plats i bottenmenyn. Stationer står under Hos kunden.' })
        setFramsteg(2)
        return
      }
      if (enhet === 'dator' && mal === 'nav:Stationer') {
        setFramsteg(3)
        setSvar({ typ: 'ok', titel: 'Klart', text: 'På datorn ligger alla sidor i sidomenyn, i samma grupper som under Mer i telefonen.' })
        return
      }
      setSvar({ typ: 'fel', titel: 'Inte där', text: enhet === 'dator' ? 'Stationer står i sidomenyn under Hos kunden.' : 'Stationer ligger inte i bottenmenyn. Tryck på Mer längst ner till höger.' })
    }
  }
  const borjaOm = () => { setVy('idag'); setFramsteg(0); setSvar(start) }

  return (
    <OvningRam framsteg={framsteg} totalt={enhet === 'dator' ? 2 : 3} svar={svar} onBorjaOm={borjaOm} bred={enhet === 'dator'}>
      <Skarm vy={vy} onRam={tryck} />
    </OvningRam>
  )
}

export default { Visning, Ovning, enheter: ['mobil', 'dator'] } satisfies GuideModul
