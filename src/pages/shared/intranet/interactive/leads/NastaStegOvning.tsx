// src/pages/shared/intranet/interactive/leads/NastaStegOvning.tsx
// Leadsguiderna: övning i "Klar, välj nästa" (LeadNastaSteg). Välj vad som hände och vad som
// händer sedan, spara, och se hur tidslinjen fylls. Samma regler som i portalen: nytt nästa steg
// kräver text och datum, parkera kräver ett datum framåt, förlorad kräver orsak. Ett samtal,
// mejl eller möte på en lead som är Ny flyttar den till Kontaktad. Ingenting sparas.

import { useState } from 'react'
import { Icon, type IconName } from '../../../../../components/icons/Icon'
import {
  AKTIVITET_ETIKETT,
  FORLUSTORSAKER,
  FORLUSTORSAK_ETIKETT,
  MANUELLA_AKTIVITETER,
  type LeadAktivitetManuell,
  type LeadForlustorsak,
  type LeadStage,
} from '../../../../../types/leads'
import { datumOm } from './leadsExempel'
import { Aterkoppling, ETIKETT, FALT, Knapp, Ram, Steg } from './leadsShared'
import { segment } from './leadsVariant'

type Sedan = 'nasta' | 'parkera' | 'forlorad'

interface Handelse {
  ikon: IconName
  manuell?: string
  text: string
  nar: string
}

const START_NASTA = 'Ring och presentera oss'

const NAR_VAL: { dagar: number; label: string }[] = [
  { dagar: 1, label: 'I morgon 09:00' },
  { dagar: 3, label: 'Om tre dagar' },
  { dagar: 7, label: 'Om en vecka' },
]
const PARK_VAL: { dagar: number; label: string }[] = [
  { dagar: 30, label: 'Om en månad' },
  { dagar: 90, label: 'Om tre månader' },
  { dagar: 180, label: 'Om ett halvår' },
]

const IKON: Record<LeadAktivitetManuell, IconName> = {
  anteckning: 'allman.anteckning',
  samtal: 'kontakt.telefon',
  mejl: 'kontakt.mejl',
  mote: 'kontakt.mote',
}

const START_HISTORIK: Handelse[] = [{ ikon: 'lead.lead', text: 'Lead skapad, källa rekommendation', nar: datumOm(-1) }]

export default function NastaStegOvning() {
  const [stage, setStage] = useState<LeadStage>('ny')
  const [nasta, setNasta] = useState<{ text: string; dagar: number } | null>({ text: START_NASTA, dagar: 0 })
  const [historik, setHistorik] = useState<Handelse[]>(START_HISTORIK)
  const [oppen, setOppen] = useState(false)
  const [gjort, setGjort] = useState<LeadAktivitetManuell>('samtal')
  const [gjortText, setGjortText] = useState('')
  const [sedan, setSedan] = useState<Sedan>('nasta')
  const [text, setText] = useState('')
  const [nar, setNar] = useState<number | null>(1)
  const [park, setPark] = useState<number | null>(null)
  const [orsak, setOrsak] = useState<LeadForlustorsak | ''>('')
  const [fel, setFel] = useState('')
  const [svar, setSvar] = useState<string | null>(null)

  const borja = () => {
    setOppen(true)
    setGjort('samtal')
    setGjortText('')
    setSedan('nasta')
    setText('')
    setNar(1)
    setPark(null)
    setOrsak('')
    setFel('')
    setSvar(null)
  }

  const borjaOm = () => {
    setStage('ny')
    setNasta({ text: START_NASTA, dagar: 0 })
    setHistorik(START_HISTORIK)
    setOppen(false)
    setSvar(null)
  }

  const spara = () => {
    if (sedan === 'nasta' && (!text.trim() || nar == null)) return setFel('Skriv nästa steg och välj datum')
    if (sedan === 'parkera' && park == null) return setFel('Välj ett datum framåt i tiden då leaden ska vakna')
    if (sedan === 'forlorad' && !orsak) return setFel('Välj orsak')

    const idag = datumOm(0)
    const nya: Handelse[] = []
    // Nyast först, som i leaden
    if (sedan === 'nasta') nya.push({ ikon: 'lead.nasta-steg', text: `Nästa steg: ${text.trim()} · ${datumOm(nar ?? 1)}`, nar: idag })
    if (sedan === 'parkera') nya.push({ ikon: 'lead.parkerad', text: `Parkerad till ${datumOm(park ?? 30)}`, nar: idag })
    if (sedan === 'forlorad') nya.push({ ikon: 'lead.forlorad', text: `Förlorad: ${FORLUSTORSAK_ETIKETT[orsak as LeadForlustorsak]}`, nar: idag })
    const flyttas = stage === 'ny' && gjort !== 'anteckning'
    if (flyttas) nya.push({ ikon: 'allman.historik', text: 'Ny → Kontaktad', nar: idag })
    nya.push({ ikon: IKON[gjort], manuell: AKTIVITET_ETIKETT[gjort], text: gjortText.trim() || `Klart: ${nasta?.text ?? ''}`, nar: idag })

    setHistorik((h) => [...nya, ...h])
    if (sedan === 'nasta') {
      setStage(flyttas ? 'kontaktad' : stage)
      setNasta({ text: text.trim(), dagar: nar ?? 1 })
    } else if (sedan === 'parkera') {
      setStage('parkerad')
      setNasta(null)
    } else {
      setStage('forlorad')
      setNasta(null)
    }
    setOppen(false)
    setSvar(
      sedan === 'nasta'
        ? flyttas
          ? `Sparat. ${AKTIVITET_ETIKETT[gjort]} på en ny lead flyttade den till Kontaktad, och leaden har ett nytt nästa steg.`
          : 'Sparat. Leaden har ett nytt nästa steg och ligger kvar i sitt steg.'
        : sedan === 'parkera'
          ? 'Sparat. Leaden är parkerad och dyker upp under Parkerade som vaknar i dag på datumet.'
          : 'Sparat. Leaden är förlorad med orsak. Den går att återuppta.',
    )
  }

  const avslutad = stage === 'parkerad' || stage === 'forlorad'

  return (
    <Ram where="Leads (B2B) › Kaféet Lilla Exempel" caption="Tryck Klar, välj nästa och prova olika val.">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="text-white font-semibold">Kaféet Lilla Exempel</span>
          <Steg stage={stage} />
        </div>

        {!oppen ? (
          <div className="p-3 border rounded-xl bg-slate-800/30 border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 text-sm">
                <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-0.5">
                  <Icon name="lead.nasta-steg" size={16} className="text-[#20c58f]" /> Nästa steg
                </p>
                {nasta ? (
                  <p className="text-white">
                    {nasta.text}
                    <span className="ml-2 font-mono text-xs text-slate-400">{nasta.dagar === 0 ? 'I dag 10:00' : datumOm(nasta.dagar)}</span>
                  </p>
                ) : (
                  <p className="text-slate-300">{stage === 'parkerad' ? 'Parkerad. Väntar på datumet.' : 'Avslutad som förlorad.'}</p>
                )}
              </div>
              {avslutad ? (
                <Knapp onClick={borjaOm}>
                  <Icon name="allman.aterstall" size={16} /> Börja om
                </Knapp>
              ) : (
                <Knapp primar onClick={borja}>
                  <Icon name="allman.bock" size={16} /> Klar, välj nästa
                </Knapp>
              )}
            </div>
          </div>
        ) : (
          <div className="p-3 bg-slate-800/30 border border-[#20c58f]/50 rounded-xl space-y-3">
            <p className="text-sm font-semibold text-white flex items-center gap-1.5">
              <Icon name="lead.nasta-steg" size={16} className="text-[#20c58f]" /> Klart. Vad blev gjort och vad händer sedan?
            </p>
            <div className="flex flex-wrap border-b border-slate-700/50" role="tablist" aria-label="Vad blev gjort">
              {MANUELLA_AKTIVITETER.map((k) => (
                <button key={k} type="button" role="tab" aria-selected={gjort === k} className={segment(gjort === k)} onClick={() => setGjort(k)}>
                  {AKTIVITET_ETIKETT[k]}
                </button>
              ))}
            </div>
            <textarea
              rows={2}
              className={FALT}
              value={gjortText}
              onChange={(e) => setGjortText(e.target.value)}
              placeholder={`Vad hände? Lämnas tomt loggas "Klart: ${nasta?.text ?? ''}"`}
            />
            <div className="flex flex-wrap border-b border-slate-700/50" role="tablist" aria-label="Sedan">
              <button type="button" role="tab" aria-selected={sedan === 'nasta'} className={segment(sedan === 'nasta')} onClick={() => { setSedan('nasta'); setFel('') }}>Nytt nästa steg</button>
              <button type="button" role="tab" aria-selected={sedan === 'parkera'} className={segment(sedan === 'parkera')} onClick={() => { setSedan('parkera'); setFel('') }}>Parkera</button>
              <button type="button" role="tab" aria-selected={sedan === 'forlorad'} className={segment(sedan === 'forlorad')} onClick={() => { setSedan('forlorad'); setFel('') }}>Förlorad</button>
            </div>

            {sedan === 'nasta' && (
              <div className="space-y-2">
                <div>
                  <label className={ETIKETT} htmlFor="ovning-nasta">Nästa steg *</label>
                  <input id="ovning-nasta" className={FALT} value={text} onChange={(e) => setText(e.target.value)} placeholder="Till exempel Ring och följ upp offerten" />
                </div>
                <div>
                  <p className={ETIKETT}>Datum och tid *</p>
                  <div className="flex flex-wrap border-b border-slate-700/50">
                    {NAR_VAL.map((o) => (
                      <button key={o.dagar} type="button" className={segment(nar === o.dagar)} onClick={() => setNar(o.dagar)}>{o.label}</button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">I portalen väljer du datum och tid i kalendern. Förslaget är nästa vardag 09:00.</p>
                </div>
              </div>
            )}
            {sedan === 'parkera' && (
              <div>
                <p className={ETIKETT}>Vaknar den *</p>
                <div className="flex flex-wrap border-b border-slate-700/50">
                  {PARK_VAL.map((o) => (
                    <button key={o.dagar} type="button" className={segment(park === o.dagar)} onClick={() => setPark(o.dagar)}>{o.label}</button>
                  ))}
                </div>
              </div>
            )}
            {sedan === 'forlorad' && (
              <div>
                <label className={ETIKETT} htmlFor="ovning-orsak">Orsak *</label>
                <select id="ovning-orsak" className={FALT} value={orsak} onChange={(e) => setOrsak(e.target.value as LeadForlustorsak)}>
                  <option value="">Välj orsak</option>
                  {FORLUSTORSAKER.map((o) => (
                    <option key={o} value={o}>{FORLUSTORSAK_ETIKETT[o]}</option>
                  ))}
                </select>
              </div>
            )}

            {fel && <p className="text-xs text-red-400" role="alert">{fel}</p>}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-700/50">
              <Knapp onClick={() => setOppen(false)}>Avbryt</Knapp>
              <Knapp primar={sedan !== 'forlorad'} fara={sedan === 'forlorad'} onClick={spara}>
                {sedan === 'forlorad' ? 'Markera förlorad' : sedan === 'parkera' ? 'Parkera' : 'Spara'}
              </Knapp>
            </div>
          </div>
        )}

        {svar && <Aterkoppling ok titel={svar} />}

        <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
          <p className="text-sm font-semibold text-white flex items-center gap-1.5 mb-2">
            <Icon name="allman.historik" size={16} className="text-[#20c58f]" /> Aktivitet
          </p>
          <ul className="space-y-2" aria-live="polite">
            {historik.map((h, n) => (
              <li key={`${historik.length - n}`} className="flex gap-2.5 px-3 py-2 bg-slate-800/20 border border-slate-700/50 rounded-xl text-sm">
                <Icon name={h.ikon} size={16} className={`flex-none mt-0.5 ${h.manuell ? 'text-[#20c58f]' : 'text-slate-500'}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-white break-words">
                    {h.manuell && <span className="font-medium">{h.manuell}: </span>}
                    {h.text}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    <span className="font-mono">{h.nar}</span> · {n === historik.length - 1 ? 'Malin' : 'Du'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Ram>
  )
}
