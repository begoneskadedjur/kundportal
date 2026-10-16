// src/pages/shared/intranet/guider/guide-roller-och-vyer-kontor.tsx
// Guidemodul: Hitta rätt i portalen (admin, koordinator och säljare, dator).
// Exemplet är koordinatorns sidomeny. Etiketterna kommer från coordinatorNavConfig och
// CoordinatorSidebar (grupperna, Intranät & Hjälpcenter, Uppdateringar, Mitt konto),
// SidebarNavGroup (fäll ut en grupp), CoordinatorTopHeader och ViewSwitcher (växlaren uppe
// till höger, Koordinator, Tekniker), UserProfile (Min profil, Byt lösenord, Nuvarande
// lösenord, Nytt lösenord, Bekräfta nytt lösenord, Lösenordskrav:, Lösenord uppdaterat!,
// Lösenorden matchar inte). Påhittade namn, ingenting sparas.

import { useState } from 'react'
import { Dator, Falt, Kort, Notis, OvningRam, PKnapp, Rad, type OvningSvar } from '../skarmkit'
import type { GuideModul } from './registry'
import { KontorSida, SidRubrik, VyVaxlare, mk } from './_allmant'

type Vy = 'oversikt' | 'konto' | 'bytt' | 'tekniker'

interface Lage {
  vy: Vy
  oppna: string[]
  nuvarande: boolean
  nytt: boolean
  bekrafta: boolean
}

const KRAV = ['Minst 8 tecken', 'Minst en stor bokstav', 'Minst en liten bokstav', 'Minst en siffra']

function Skarm({ l, tryck, markera, nr }: { l: Lage; tryck: (id: string) => void; markera?: string; nr: number }) {
  if (l.vy === 'tekniker') {
    return (
      <div className="w-[600px] max-w-full">
        <Dator adress="technician › dashboard">
          <div className="flex items-center justify-between border-b border-slate-700/40 px-3 py-2">
            <span className="text-[11.5px] text-slate-400">BeGone › <span className="font-medium text-white">Översikt</span></span>
            <VyVaxlare vyer={['Koordinator', 'Tekniker']} aktiv="Tekniker" tryck={tryck} nr={nr} />
          </div>
          <div className="p-4">
            <SidRubrik titel="God morgon, Anna" under="fredag 16 oktober" />
            <p className="text-[12px] text-slate-400">Du är i teknikervyn. Menyn till vänster visar nu teknikerns sidor.</p>
          </div>
        </Dator>
      </div>
    )
  }

  const konto = l.vy === 'konto' || l.vy === 'bytt'
  return (
    <div className="w-[600px] max-w-full">
      <Dator adress={konto ? 'koordinator › mitt-konto' : 'koordinator › dashboard'}>
        <KontorSida sida={konto ? 'Mitt konto' : 'Översikt'} aktivPost={konto ? 'Mitt konto' : 'Översikt'} oppna={l.oppna} tryck={tryck} markera={markera} nr={nr}>
          {!konto && (
            <>
              <SidRubrik titel="Översikt" />
              <p className="text-[12px] text-slate-400">Koordinatorns startsida.</p>
            </>
          )}
          {konto && (
            <>
              <SidRubrik titel="Min profil" under="Hantera dina kontouppgifter och inställningar" />
              <Kort titel="Profilinformation" ikon="rapport.person">
                <Rad v="Namn" h="Anna Exempel" />
                <Rad v="E-postadress" h="anna@exempel.se" />
              </Kort>
              <div className="m-2.5 grid gap-2 rounded-xl border border-slate-700 bg-slate-800/40 p-2.5">
                <p className="text-xs font-semibold text-white">Byt lösenord</p>
                <Falt etikett="Nuvarande lösenord" varde="••••••••" tom={!l.nuvarande} onClick={() => tryck('nuvarande')} markor={mk(markera, 'nuvarande', nr)} />
                <Falt etikett="Nytt lösenord" varde={l.nytt ? '•••••••••••' : 'Minst 8 tecken'} tom={!l.nytt} onClick={() => tryck('nytt')} markor={mk(markera, 'nytt', nr)} />
                <Falt etikett="Bekräfta nytt lösenord" varde={l.bekrafta ? '•••••••••••' : 'Upprepa lösenordet'} tom={!l.bekrafta} onClick={() => tryck('bekrafta')} markor={mk(markera, 'bekrafta', nr)} />
                <div className="rounded-lg bg-slate-800/50 p-2">
                  <p className="mb-1 text-[11px] font-medium text-slate-300">Lösenordskrav:</p>
                  {KRAV.map(k => (
                    <p key={k} className={`flex items-center gap-1.5 text-[11px] ${l.nytt ? 'text-green-400' : 'text-slate-500'}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${l.nytt ? 'bg-green-400' : 'bg-slate-600'}`} aria-hidden />
                      {k}
                    </p>
                  ))}
                </div>
                <div><PKnapp onClick={() => tryck('byt-losen')} markor={mk(markera, 'byt-losen', nr)}>Byt lösenord</PKnapp></div>
              </div>
            </>
          )}
        </KontorSida>
        {l.vy === 'bytt' && <Notis text="Lösenord uppdaterat!" />}
      </Dator>
    </div>
  )
}

// ─── Visning: en skärm per steg i guidens visning-block ───

const TOMT: Lage = { vy: 'oversikt', oppna: [], nuvarande: false, nytt: false, bekrafta: false }
const IFYLLT: Lage = { vy: 'konto', oppna: ['Försäljning'], nuvarande: true, nytt: true, bekrafta: true }

const VISNING: { lage: Lage; markera: string }[] = [
  { lage: TOMT, markera: 'grupp-Försäljning' },
  { lage: { ...TOMT, oppna: ['Försäljning'] }, markera: 'mitt-konto' },
  { lage: IFYLLT, markera: 'byt-losen' },
  { lage: { ...IFYLLT, vy: 'bytt' }, markera: 'vy-Tekniker' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm l={v.lage} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning: samma skärmar utan markörer ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Du står på Översikt i koordinatorvyn. Hitta sidan där du byter lösenord.' }

const TIPS: Record<string, string> = {
  gul: 'Den gula knappen är för tillbud, avvikelser och olyckor.',
  cta: 'Öppna schema öppnar planeringen. Lösenordet byter du under Mitt konto.',
  intranat: 'Intranätet har handboken och policyerna. Lösenordet byter du under Mitt konto.',
  uppdateringar: 'Uppdateringar visar nyheter i portalen. Lösenordet byter du under Mitt konto.',
  notis: 'Klockan öppnar dina tickets. Lösenordet byter du under Mitt konto.',
  sok: 'Sök letar efter ärenden och kunder. Lösenordet byter du under Mitt konto.',
  'logga-ut': 'Då loggas du ut. Lösenordet byter du under Mitt konto.',
}

function Ovning() {
  const [l, setL] = useState<Lage>(TOMT)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string, titel = 'Inte där') => { setFel(f => f + 1); setSvar({ typ: 'fel', titel, text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (l.vy === 'tekniker') return
    if (id.startsWith('grupp-')) {
      const g = id.slice(6)
      if (g === 'Planering' || g === 'Kunder & Avtal') { tips('Den gruppen är redan öppen', 'Grupper med grön rubrik är öppna från början. Leta efter Mitt konto längst ner.'); return }
      setL({ ...l, oppna: l.oppna.includes(g) ? l.oppna.filter(x => x !== g) : [...l.oppna, g] })
      tips(g, 'Gruppen fälls ut eller ihop när du trycker på rubriken. Mitt konto ligger längst ner i menyn.')
      return
    }
    if (id.startsWith('vy-')) {
      if (id === 'vy-Koordinator') { miss('Du står redan i koordinatorvyn. Den gröna är den du är i.'); return }
      if (l.vy !== 'bytt') { miss('Byt lösenordet först, sedan vyn.'); return }
      setL({ ...l, vy: 'tekniker' })
      setSvar({
        typ: 'ok',
        titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
        text: `Lösenordet är bytt och du är i teknikervyn. Växlaren uppe till höger tar dig tillbaka till koordinatorvyn.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
      })
      return
    }
    if (id === 'mitt-konto') {
      if (l.vy === 'oversikt') { setL({ ...l, vy: 'konto' }); tips('Min profil', 'Fyll i de tre fälten under Byt lösenord.') }
      return
    }
    if (l.vy === 'oversikt') { miss(TIPS[id] ?? (id.startsWith('post-') ? `${id.slice(5)} är en sida i portalen. Mitt konto ligger längst ner i menyn.` : 'Mitt konto ligger längst ner i menyn till vänster.')); return }
    if (l.vy === 'bytt') { miss('Lösenordet är bytt. Byt nu till teknikervyn i växlaren uppe till höger.'); return }

    // Mitt konto
    if (id === 'nuvarande') { setL({ ...l, nuvarande: true }); tips('Nuvarande lösenord', 'Ifyllt. Skriv nu det nya lösenordet.') }
    else if (id === 'nytt') { setL({ ...l, nytt: true }); tips('Nytt lösenord', 'Alla lösenordskrav blev gröna. Skriv samma lösenord en gång till.') }
    else if (id === 'bekrafta') { setL({ ...l, bekrafta: true }); tips('Bekräftat', l.nuvarande && l.nytt ? 'Allt är ifyllt. Tryck Byt lösenord.' : 'Fyll i de andra fälten också.') }
    else if (id === 'byt-losen') {
      if (!l.nytt) miss('Lösenordet måste vara minst 8 tecken', 'Portalen säger')
      else if (!l.bekrafta) miss('Lösenorden matchar inte', 'Portalen säger')
      else if (!l.nuvarande) miss('Ange ditt nuvarande lösenord', 'Portalen säger')
      else { setL({ ...l, vy: 'bytt' }); tips('Lösenord uppdaterat!', 'Nästa gång loggar du in med det nya. Byt nu till teknikervyn.') }
    } else miss(TIPS[id] ?? 'Fyll i fälten under Byt lösenord.')
  }

  const ifyllda = [l.nuvarande, l.nytt, l.bekrafta].filter(Boolean).length
  const framsteg = l.vy === 'oversikt' ? 0 : l.vy === 'konto' ? 1 + ifyllda : l.vy === 'bytt' ? 5 : 6
  return (
    <OvningRam bred framsteg={framsteg} totalt={6} svar={svar} onBorjaOm={() => { setL(TOMT); setSvar(BORJA); setFel(0) }}>
      <Skarm l={l} tryck={tryck} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
