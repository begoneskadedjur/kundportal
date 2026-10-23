// src/pages/shared/intranet/guider/guide-roller-och-vyer.tsx
// Guidemodul: Hitta rätt i portalen (tekniker, telefon).
// Etiketterna kommer från TechnicianMobileNav (Mer, Meny, växlaren överst, gula knappen,
// Intranät & Hjälpcenter, Uppdateringar, Mitt konto), technicianNavConfig (grupperna),
// ViewSwitcher och AuthContext.VIEW_LABELS (Tekniker, Koordinator), UserProfile
// (Min profil, Profilinformation, Spara ändringar, Byt lösenord) och PwaInstallSection
// (Använd som app, Så lägger du till appen, stegen för iPhone). Påhittade namn, ingenting sparas.

import { useState } from 'react'
import { Kort, Markor, OvningRam, PKnapp, Rad, Telefon, type OvningSvar } from '../skarmkit'
import type { GuideModul } from './registry'
import { LokalIkon, SidRubrik, TeknikerBotten, TeknikerHuvud, TeknikerMeny, mk } from './_allmant'

type Vy = 'hem' | 'meny' | 'konto' | 'appguide' | 'meny-vy' | 'koordinator'

const VYER = ['Koordinator', 'Tekniker']

function Skarm({ vy, oppen, tryck, markera, nr }: { vy: Vy; oppen?: string; tryck: (id: string) => void; markera?: string; nr: number }) {
  const konto = vy === 'konto' || vy === 'appguide'
  const iMeny = vy === 'meny' || vy === 'meny-vy'
  return (
    <Telefon>
      <TeknikerHuvud tryck={tryck} markera={markera} nr={nr} />

      {(vy === 'hem' || iMeny) && (
        <div className="p-3">
          <SidRubrik titel="God morgon, Erik" under="fredag 16 oktober" />
          <Kort titel="Dagens schema" ikon="allman.kalender">
            <Rad v="08:00 Familjen Exempel" />
            <Rad v="10:30 Exempel AB" />
          </Kort>
          <Kort titel="Mina ärenden" ikon="arende.arende"><Rad v="Bokade" h="3" /></Kort>
        </div>
      )}

      {vy === 'koordinator' && (
        <div className="p-3">
          <SidRubrik titel="Översikt" under="Koordinatorvyn" />
          <p className="px-1 text-[11.5px] text-slate-400">Koordinatorns översikt öppnas. Menyn visar nu koordinatorns sidor.</p>
        </div>
      )}

      {konto && (
        <div className="grid gap-0 p-1">
          <div className="px-2 pt-2"><SidRubrik titel="Min profil" under="Hantera dina kontouppgifter och inställningar" /></div>
          <Kort titel="Profilinformation" ikon="rapport.person">
            <Rad v="Namn" h="Erik Exempel" />
            <Rad v="E-postadress" h="erik@exempel.se" />
            <Rad v="Telefonnummer" h="070 123 45 67" />
            <div className="pt-1"><PKnapp prim onClick={() => tryck('spara')}>Spara ändringar</PKnapp></div>
          </Kort>
          <Kort titel="Byt lösenord" ikon="allman.las">
            <div><PKnapp onClick={() => tryck('byt-losen')}>Byt lösenord</PKnapp></div>
          </Kort>
          <div className="m-2.5 grid gap-1.5 rounded-xl border border-slate-700 bg-slate-800/40 p-2.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-white">
              <LokalIkon namn="hemskarm" size={16} className="text-[#20c58f]" />
              Använd som app
            </p>
            <p className="text-[11px] leading-snug text-slate-400">Lägg portalen på hemskärmen så öppnas den som en app, utan adressfält och med egen ikon.</p>
            <Markor markor={mk(markera, 'app-knapp', nr)} block>
              <button type="button" onClick={() => tryck('app-knapp')}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#20c58f] px-3 py-2 text-[12px] font-medium text-[#fff]">
                <LokalIkon namn="hemskarm" size={16} />
                Så lägger du till appen
              </button>
            </Markor>
            {vy === 'appguide' && (
              <ol className="grid gap-1.5 rounded-lg bg-slate-800/50 p-2 text-[11px] text-slate-300">
                <li>1. Tryck på Dela-knappen längst ned i Safari. I Chrome sitter den uppe vid adressfältet.</li>
                <li>2. Bläddra i listan och välj <span className="text-white">Lägg till på hemskärmen</span>.</li>
                <li>3. Tryck på <span className="text-white">Lägg till</span> uppe till höger.</li>
              </ol>
            )}
          </div>
        </div>
      )}

      <TeknikerBotten tryck={tryck} markera={markera} nr={nr} aktiv={vy === 'hem' ? 'hem' : undefined} />

      {iMeny && <TeknikerMeny tryck={tryck} markera={markera} nr={nr} oppen={oppen} vyer={VYER} aktivVy="Tekniker" />}
    </Telefon>
  )
}

// ─── Visning: en skärm per steg i guidens visning-block ───

const VISNING: { vy: Vy; oppen?: string; markera: string }[] = [
  { vy: 'hem', markera: 'mer' },
  { vy: 'meny', markera: 'grupp-Ärenden & Fält' },
  { vy: 'meny', oppen: 'Ärenden & Fält', markera: 'mitt-konto' },
  { vy: 'konto', markera: 'app-knapp' },
  { vy: 'meny-vy', markera: 'vy-Koordinator' },
]

function Visning({ steg, onNasta }: { steg: number; onNasta: () => void }) {
  const v = VISNING[Math.min(steg, VISNING.length - 1)]
  return <Skarm vy={v.vy} oppen={v.oppen} markera={v.markera} nr={steg + 1} tryck={id => { if (id === v.markera) onNasta() }} />
}

// ─── Övning: samma skärmar utan markörer ───

const BORJA: OvningSvar = { typ: 'tips', titel: 'Börja här', text: 'Du står på Översikt. Öppna menyn.' }

const TIPS_HEM: Record<string, string> = {
  hem: 'Hem är sidan du redan står på. Menyn öppnar du med Mer längst ner till höger.',
  arenden: 'Ärenden visar dina ärenden. Det du letar efter ligger i menyn under Mer.',
  schema: 'Schema visar dina besök. Det du letar efter ligger i menyn under Mer.',
  provision: 'Provision visar din provision. Det du letar efter ligger i menyn under Mer.',
  sok: 'Sök letar efter ärenden och kunder. Öppna menyn i stället.',
  notis: 'Klockan öppnar Frågor och uppdrag. Öppna menyn i stället.',
}

const TIPS_MENY: Record<string, string> = {
  gul: 'Den gula knappen är för tillbud, avvikelser och olyckor.',
  intranat: 'Intranätet har handboken och policyerna. Appen lägger du till under Mitt konto.',
  uppdateringar: 'Uppdateringar visar nyheter i portalen. Appen lägger du till under Mitt konto.',
  'post-Översikt': 'Översikt är startsidan. Appen lägger du till under Mitt konto.',
  utanfor: 'Trycker du bredvid menyn stängs den. Leta efter Mitt konto i menyn.',
}

function Ovning() {
  const [vy, setVy] = useState<Vy>('hem')
  const [oppen, setOppen] = useState<string | undefined>()
  const [appKlar, setAppKlar] = useState(false)
  const [svar, setSvar] = useState<OvningSvar>(BORJA)
  const [fel, setFel] = useState(0)

  const miss = (text: string) => { setFel(f => f + 1); setSvar({ typ: 'fel', titel: 'Inte där', text }) }
  const tips = (titel: string, text: string) => setSvar({ typ: 'tips', titel, text })

  const tryck = (id: string) => {
    if (vy === 'koordinator') return
    if (vy === 'hem' || vy === 'appguide') {
      if (id === 'mer' || id === 'meny') {
        setVy(appKlar ? 'meny-vy' : 'meny'); setOppen(undefined)
        tips('Menyn är öppen', appKlar ? 'Överst ser du växlaren med dina två roller.' : 'Hitta sidan där ditt konto finns.')
      } else if (vy === 'appguide') miss('Appen är klar. Byt nu till koordinatorvyn. Växlaren finns i menyn.')
      else miss(TIPS_HEM[id] ?? 'Tryck på Mer längst ner till höger.')
      return
    }
    if (vy === 'meny' || vy === 'meny-vy') {
      if (id.startsWith('grupp-')) {
        const g = id.slice(6)
        setOppen(o => (o === g ? undefined : g))
        tips(`${g}`, appKlar ? 'Grupperna har sidorna. Växlaren ligger överst i menyn.' : 'Grupperna har sidorna i portalen. Ditt konto ligger längre ner.')
      } else if (id === 'mitt-konto') {
        if (appKlar) miss('Appinstruktionen har du redan hittat. Byt nu till koordinatorvyn med växlaren överst.')
        else { setVy('konto'); tips('Min profil', 'Här ändrar du dina uppgifter. Hitta hur du lägger portalen på hemskärmen.') }
      } else if (id === 'vy-Koordinator') {
        if (!appKlar) miss('Det kommer sen. Lägg först till appen. Det gör du under Mitt konto.')
        else {
          setVy('koordinator')
          setSvar({
            typ: 'ok',
            titel: fel === 0 ? 'Felfritt, du kan det här' : 'Klart',
            text: `Du hittade Mitt konto, fick stegen för att lägga BeGone på hemskärmen och bytte till koordinatorvyn. Byter du tillbaka gör du det i samma växlare.${fel ? ` Du tryckte fel ${fel} ${fel === 1 ? 'gång' : 'gånger'} på vägen, det gör inget.` : ''}`,
          })
        }
      } else if (id === 'vy-Tekniker') miss('Du är redan i teknikervyn. Den gröna är den du står i.')
      else if (id.startsWith('post-') && id !== 'post-Översikt') miss(`${id.slice(5)} är en sida i portalen. ${appKlar ? 'Byt vy med växlaren överst.' : 'Ditt konto heter Mitt konto och ligger längre ner.'}`)
      else miss(TIPS_MENY[id] ?? 'Leta efter Mitt konto i menyn.')
      return
    }
    if (vy === 'konto') {
      if (id === 'app-knapp') {
        setVy('appguide'); setAppKlar(true)
        tips('Stegen för iPhone', 'Det är de tre stegen du gör i Safari. Byt nu till koordinatorvyn. Öppna menyn igen.')
      } else if (id === 'spara') miss('Spara ändringar sparar namn, e-post och telefon. Du har inte ändrat något.')
      else if (id === 'byt-losen') miss('Lösenordet behöver du inte byta nu. Leta efter Använd som app.')
      else miss('Leta efter rutan Använd som app längre ner på sidan.')
    }
  }

  const framsteg = vy === 'hem' ? 0 : vy === 'meny' ? 1 : vy === 'konto' ? 2 : vy === 'appguide' ? 3 : vy === 'meny-vy' ? 4 : 5
  return (
    <OvningRam framsteg={framsteg} totalt={5} svar={svar} onBorjaOm={() => { setVy('hem'); setOppen(undefined); setAppKlar(false); setSvar(BORJA); setFel(0) }}>
      <Skarm vy={vy} oppen={oppen} tryck={tryck} nr={0} />
    </OvningRam>
  )
}

export default { Visning, Ovning } satisfies GuideModul
