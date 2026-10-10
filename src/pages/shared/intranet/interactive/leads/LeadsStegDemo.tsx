// src/pages/shared/intranet/interactive/leads/LeadsStegDemo.tsx
// Leadsguiderna: klickbart statusflöde. Klicka ett steg och se hur leaden hamnar där,
// vem som sätter steget (för hand eller automatiskt) och vad som krävs.
// Reglerna följer leads_before_write, contracts_lead_automatik och lead_koppla_besok
// (docs/leads/ETAPP-3-4.md och ETAPP-5.md). variant styr vad som sägs om nödutgången.

import { useState } from 'react'
import { Icon } from '../../../../../components/icons/Icon'
import { STAGE_ETIKETT, type LeadStage } from '../../../../../types/leads'
import { Steg } from './leadsShared'
import { lasVariant, type LeadsVariant } from './leadsVariant'

const KEDJAN: LeadStage[] = ['ny', 'kontaktad', 'besok_bokat', 'offert_skickad', 'vunnen']
const SIDOSPAR: LeadStage[] = ['parkerad', 'forlorad']

interface StegInfo {
  satt: 'hand' | 'auto' | 'bada'
  hur: string
  kravs: string
  sedan: string
}

function info(steg: LeadStage, v: LeadsVariant): StegInfo {
  const kontor = v === 'kontor'
  switch (steg) {
    case 'ny':
      return {
        satt: 'bada',
        hur: 'Alla leads börjar här, oavsett om de kommer från ett engångsärende, ett tips eller knappen Ny lead.',
        kravs: 'Ett företag eller namn och ett sätt att nå kunden. Ett tips från ett ärende får nästa steg Kontakta kunden om tipset om två dygn.',
        sedan: 'Målet är att kunden kontaktas inom två arbetsdagar. Statistiken mäter det under Hygien per ägare.',
      }
    case 'kontaktad':
      return {
        satt: 'bada',
        hur: 'För hand med valet Kontaktad i leaden. Det sker också av sig självt när någon loggar ett samtal, ett mejl eller ett möte på en lead som är Ny.',
        kravs: 'Ingenting extra. Men leaden ska alltid ha ett nästa steg med datum.',
        sedan: 'Leaden går också tillbaka hit när en offert avböjs eller går ut, och när en parkerad eller förlorad lead återupptas.',
      }
    case 'besok_bokat':
      return {
        satt: 'auto',
        hur: kontor
          ? 'När du trycker Boka besök i leaden öppnas ärendemodalen ifylld. När ärendet sparas kopplas det till leaden och steget blir Besök bokat.'
          : 'När koordinatorn bokar besöket med Boka besök i leaden kopplas ärendet och steget blir Besök bokat.',
        kravs: 'Leaden är Ny eller Kontaktad när besöket bokas.',
        sedan: v === 'tekniker'
          ? 'Du kan inte sätta steget själv. Knappen Boka besök hos dig skriver bara ett nästa steg.'
          : v === 'saljare'
            ? 'Du kan inte sätta steget själv. Knappen Boka besök hos dig skriver ett nästa steg, och koordinatorn bokar ärendet.'
            : 'Bokat besök syns under Ursprung och kopplingar i leaden.',
      }
    case 'offert_skickad':
      return {
        satt: 'auto',
        hur: 'När offerten eller avtalet som skapades med Skapa offert i leaden skickas från Oneflow. Ett utkast räknas inte.',
        kravs: 'Dokumentet måste vara skapat från leaden. Annars vet systemet inte att det hör ihop.',
        sedan: 'Tipsaren får notisen Ditt tips har fått en offert. Avböjs offerten eller går den ut går leaden tillbaka till Kontaktad med ett nästa steg att ta ny kontakt. Den blir aldrig förlorad av sig själv.',
      }
    case 'vunnen':
      return {
        satt: 'auto',
        hur: 'När avtalet eller offerten signeras i Oneflow.',
        kravs: 'Samma dokument som skickades från leaden.',
        sedan: kontor
          ? 'Tipsaren får notisen Ditt tips är vunnet. Saknar leaden kund visas Koppla eller skapa kund överst i leaden. Är tipsbonusen påslagen bokförs den nu.'
          : 'Tipsaren får notisen Ditt tips är vunnet. Är tipsbonusen påslagen bokförs den nu.',
      }
    case 'parkerad':
      return {
        satt: 'hand',
        hur: 'Med Parkera i leaden, eller valet Parkera när du trycker Klar, välj nästa.',
        kravs: 'Ett datum då leaden ska vakna. Skriv gärna vad som ska göras då.',
        sedan: 'Leaden försvinner ur Att göra och kommer tillbaka under Parkerade som vaknar i dag samma dag. Då trycker du Återuppta.',
      }
    default:
      return {
        satt: 'hand',
        hur: 'Med Förlorad i leaden, eller valet Förlorad när du trycker Klar, välj nästa.',
        kravs: 'En orsak, till exempel Pris eller Valde annan leverantör. En kommentar är frivillig men hjälper statistiken.',
        sedan: 'Leaden går att återuppta. Den blir då Kontaktad igen.',
      }
  }
}

const SATT_TEXT: Record<StegInfo['satt'], { text: string; ikon: 'allman.hand' | 'allman.blixt'; farg: string }> = {
  hand: { text: 'Sätts för hand', ikon: 'allman.hand', farg: 'text-cyan-400' },
  auto: { text: 'Sätts automatiskt', ikon: 'allman.blixt', farg: 'text-purple-400' },
  bada: { text: 'För hand eller automatiskt', ikon: 'allman.hand', farg: 'text-amber-400' },
}

export default function LeadsStegDemo({ variant }: { variant?: string }) {
  const v = lasVariant(variant)
  const [valt, setValt] = useState<LeadStage>('ny')
  const i = info(valt, v)
  const satt = SATT_TEXT[i.satt]

  const stegKnapp = (s: LeadStage) => (
    <button
      key={s}
      type="button"
      onClick={() => setValt(s)}
      aria-pressed={valt === s}
      className={`flex-none px-3 py-2 rounded-lg border text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
        valt === s ? 'border-[#20c58f] bg-[#20c58f]/10' : 'border-slate-700 bg-slate-800/40 hover:border-slate-500'
      }`}
    >
      <Steg stage={s} />
    </button>
  )

  return (
    <div className="my-5 p-4 bg-slate-800/30 border border-slate-700 rounded-xl">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Klicka på ett steg</p>
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {KEDJAN.map((s, n) => (
          <div key={s} className="flex items-center gap-1 flex-none">
            {stegKnapp(s)}
            {n < KEDJAN.length - 1 && <Icon name="allman.chevron" size={16} className="text-slate-500 flex-none" />}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <span className="text-xs text-slate-500">Sidospår, från alla öppna steg:</span>
        {SIDOSPAR.map(stegKnapp)}
      </div>

      <div className="mt-4 p-3 bg-slate-900/40 border border-slate-700/60 rounded-xl" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <p className="text-sm font-semibold text-white">{STAGE_ETIKETT[valt]}</p>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
            <Icon name={satt.ikon} size={16} className={satt.farg} />
            {satt.text}
          </span>
        </div>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-xs text-slate-400">Så hamnar leaden här</dt>
            <dd className="text-slate-200 leading-relaxed">{i.hur}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Det som krävs</dt>
            <dd className="text-slate-200 leading-relaxed">{i.kravs}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Sedan</dt>
            <dd className="text-slate-200 leading-relaxed">{i.sedan}</dd>
          </div>
        </dl>
        {v === 'kontor' && i.satt === 'auto' && (
          <p className="mt-3 pt-2 border-t border-slate-700/50 text-xs text-slate-400 leading-relaxed">
            Nödutgång: under Fler åtgärder (⋯) i leaden finns Sätt {STAGE_ETIKETT[valt]} för hand (nödutgång). Använd den bara när
            dokumentet skapades utanför leaden, till exempel direkt i guiden eller från ett ärende.
          </p>
        )}
      </div>
    </div>
  )
}
