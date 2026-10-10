// src/components/admin/leads/LeadNastaSteg.tsx
// Rutan Nästa steg överst i leaden. Visar steget och datumet (röd ram när det är försenat).
// "Klar, välj nästa" loggar vad som gjordes och tvingar fram ett nytt nästa steg eller ett avslut
// (parkera med datum eller förlorad med orsak). Samma ruta används för Ändra, Boka besök, Parkera,
// Förlorad och Återuppta från åtgärdsraden, så att inga modaler staplas på varandra.

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import Button from '../../ui/Button'
import Select from '../../ui/Select'
import DateField from '../../ui/DateField'
import { Icon } from '../../icons/Icon'
import { LeadService } from '../../../services/leadService'
import type { Lead, LeadUpdate } from '../../../types/database'
import {
  AKTIVITET_ETIKETT,
  FORLUSTORSAKER,
  FORLUSTORSAK_ETIKETT,
  MANUELLA_AKTIVITETER,
  STAGE_ETIKETT,
  arOppen,
  type LeadAktivitetManuell,
  type LeadForlustorsak,
} from '../../../types/leads'
import { toLocalISOStringWithOffset } from '../../../utils/dateHelpers'
import { DATUMFALT, ETIKETT, FALT, arForsenad, forslagNastaDag, fransLokal, idagSv, nastaStegDatum, segment, tillLokal } from './leadLogik'

export type NastaLage = 'visa' | 'klar' | 'andra' | 'besok' | 'parkera' | 'forlorad' | 'ateruppta'
type Sedan = 'nasta' | 'parkera' | 'forlorad'

interface Props {
  lead: Lead
  lage: NastaLage
  onLage: (l: NastaLage) => void
  kanRedigera: boolean
  minProfilId: string | null
  onSpara: (andring: LeadUpdate) => Promise<void>
  onLoggad: () => void
}

export default function LeadNastaSteg({ lead, lage, onLage, kanRedigera, minProfilId, onSpara, onLoggad }: Props) {
  const [gjort, setGjort] = useState<LeadAktivitetManuell>('samtal')
  const [gjortText, setGjortText] = useState('')
  const [sedan, setSedan] = useState<Sedan>('nasta')
  const [text, setText] = useState('')
  const [nar, setNar] = useState('')
  const [parkTill, setParkTill] = useState('')
  const [orsak, setOrsak] = useState<LeadForlustorsak | ''>('')
  const [orsakText, setOrsakText] = useState('')
  const [sparar, setSparar] = useState(false)

  useEffect(() => {
    setGjort('samtal')
    setGjortText('')
    setSedan(lage === 'parkera' ? 'parkera' : lage === 'forlorad' ? 'forlorad' : 'nasta')
    setText(lage === 'andra' ? lead.next_action ?? '' : lage === 'besok' ? 'Besök hos kunden' : '')
    setNar(lage === 'andra' && lead.next_action_at ? tillLokal(lead.next_action_at) : forslagNastaDag())
    setParkTill('')
    setOrsak('')
    setOrsakText('')
  }, [lage, lead.id, lead.next_action, lead.next_action_at])

  const forsenad = arForsenad(lead)
  const oppen = arOppen(lead.stage)
  const d = nastaStegDatum(lead.next_action_at)

  const spara = async () => {
    const andring: LeadUpdate = {}
    if (sedan === 'nasta') {
      const iso = nar ? fransLokal(nar) : null
      if (!text.trim() || !iso) {
        toast.error('Skriv nästa steg och välj datum')
        return
      }
      andring.next_action = text.trim()
      andring.next_action_at = iso
      if (lage === 'ateruppta' || lead.stage === 'parkerad' || lead.stage === 'forlorad') andring.stage = 'kontaktad'
    } else if (sedan === 'parkera') {
      if (!parkTill || parkTill <= idagSv()) {
        toast.error('Välj ett datum framåt i tiden då leaden ska vakna')
        return
      }
      andring.stage = 'parkerad'
      andring.parked_until = parkTill
      andring.next_action = text.trim() || lead.next_action || 'Hör av oss igen'
    } else {
      if (!orsak) {
        toast.error('Välj orsak')
        return
      }
      andring.stage = 'forlorad'
      andring.lost_reason = orsak
      andring.lost_note = orsakText.trim() || null
    }

    setSparar(true)
    try {
      // "Klar": logga vad som gjordes innan steget byts
      if (lage === 'klar' && minProfilId) {
        const logg = gjortText.trim() || (lead.next_action ? `Klart: ${lead.next_action}` : '')
        if (logg || gjort !== 'anteckning') {
          await LeadService.loggaAktivitet(lead.id, minProfilId, gjort, logg, toLocalISOStringWithOffset(new Date()))
        }
      }
      await onSpara(andring)
      onLoggad()
      onLage('visa')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Det gick inte att spara')
    } finally {
      setSparar(false)
    }
  }

  // ---- Visningsläge ----
  if (lage === 'visa') {
    if (!oppen) {
      return (
        <div className={`p-3 border rounded-xl ${lead.stage === 'vunnen' ? 'bg-[#20c58f]/10 border-[#20c58f]/40' : 'bg-slate-800/30 border-slate-700'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-white flex items-center gap-1.5">
              <Icon name={lead.stage === 'vunnen' ? 'lead.vunnen' : 'lead.forlorad'} size={16} className={lead.stage === 'vunnen' ? 'text-[#20c58f]' : 'text-red-400'} />
              {lead.stage === 'vunnen'
                ? 'Leaden är vunnen'
                : `Förlorad${lead.lost_reason ? `: ${FORLUSTORSAK_ETIKETT[lead.lost_reason]}` : ''}${lead.lost_note ? ` (${lead.lost_note})` : ''}`}
            </p>
            {kanRedigera && lead.stage === 'forlorad' && (
              <Button variant="secondary" size="sm" onClick={() => onLage('ateruppta')}>
                <Icon name="allman.aterstall" size={16} className="mr-1.5" /> Återuppta
              </Button>
            )}
          </div>
        </div>
      )
    }
    if (lead.stage === 'parkerad') {
      const vaknat = !!lead.parked_until && lead.parked_until <= idagSv()
      return (
        <div className={`p-3 border rounded-xl ${vaknat ? 'bg-amber-500/10 border-amber-500/40' : 'bg-slate-800/30 border-slate-700'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              <p className="text-white flex items-center gap-1.5">
                <Icon name="lead.parkerad" size={16} className="text-slate-400" />
                Parkerad till <span className="font-mono">{lead.parked_until}</span>
                {vaknat && <span className="text-amber-400">, vaknar nu</span>}
              </p>
              {lead.next_action && <p className="text-slate-400 mt-0.5">{lead.next_action}</p>}
            </div>
            {kanRedigera && (
              <Button variant={vaknat ? 'primary' : 'secondary'} size="sm" onClick={() => onLage('ateruppta')}>
                <Icon name="allman.aterstall" size={16} className="mr-1.5" /> Återuppta
              </Button>
            )}
          </div>
        </div>
      )
    }
    const saknas = !lead.next_action && !lead.next_action_at
    return (
      <div className={`p-3 border rounded-xl ${forsenad ? 'bg-red-500/10 border-red-500/50' : saknas ? 'bg-amber-500/10 border-amber-500/40' : 'bg-slate-800/30 border-slate-700'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 text-sm">
            <p className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-0.5">
              <Icon name="lead.nasta-steg" size={16} className={forsenad ? 'text-red-400' : 'text-[#20c58f]'} /> Nästa steg
            </p>
            {saknas ? (
              <p className="text-amber-300">Inget nästa steg. Bestäm vad som ska hända och när.</p>
            ) : (
              <p className="text-white">
                {lead.next_action || 'Nästa steg'}
                {d.text && <span className={`ml-2 font-mono text-xs ${d.sen ? 'text-red-400' : 'text-slate-400'}`}>{d.text}{d.sen ? ' (försenat)' : ''}</span>}
              </p>
            )}
          </div>
          {kanRedigera && (
            <div className="flex gap-2">
              {saknas ? (
                <Button variant="primary" size="sm" onClick={() => onLage('andra')}>Välj nästa steg</Button>
              ) : (
                <>
                  <Button variant="primary" size="sm" onClick={() => onLage('klar')}>
                    <Icon name="allman.bock" size={16} className="mr-1.5" /> Klar, välj nästa
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => onLage('andra')}>Ändra</Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ---- Redigeringslägen ----
  const rubrik: Record<Exclude<NastaLage, 'visa'>, string> = {
    klar: 'Klart. Vad blev gjort och vad händer sedan?',
    andra: 'Nästa steg',
    besok: 'Boka besök',
    parkera: 'Parkera leaden',
    forlorad: 'Markera som förlorad',
    ateruppta: `Återuppta leaden (blir ${STAGE_ETIKETT.kontaktad})`,
  }
  const valjSedan = lage === 'klar'

  return (
    <div className="p-3 bg-slate-800/30 border border-[#20c58f]/50 rounded-xl space-y-3">
      <p className="text-sm font-semibold text-white flex items-center gap-1.5">
        <Icon name="lead.nasta-steg" size={16} className="text-[#20c58f]" /> {rubrik[lage]}
      </p>

      {lage === 'klar' && (
        <div className="space-y-2">
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
            maxLength={4000}
            placeholder={lead.next_action ? `Vad hände? Lämnas tomt loggas "Klart: ${lead.next_action}"` : 'Vad hände?'}
          />
        </div>
      )}

      {valjSedan && (
        <div className="flex flex-wrap border-b border-slate-700/50" role="tablist" aria-label="Sedan">
          <button type="button" role="tab" aria-selected={sedan === 'nasta'} className={segment(sedan === 'nasta')} onClick={() => setSedan('nasta')}>Nytt nästa steg</button>
          <button type="button" role="tab" aria-selected={sedan === 'parkera'} className={segment(sedan === 'parkera')} onClick={() => setSedan('parkera')}>Parkera</button>
          <button type="button" role="tab" aria-selected={sedan === 'forlorad'} className={segment(sedan === 'forlorad')} onClick={() => setSedan('forlorad')}>Förlorad</button>
        </div>
      )}

      {sedan === 'nasta' && (
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_190px] gap-3">
          <div>
            <label className={ETIKETT} htmlFor="nasta-text">Nästa steg *</label>
            <input id="nasta-text" autoFocus={!valjSedan} className={FALT} value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Till exempel Ring och följ upp offerten" />
          </div>
          <div>
            <label className={ETIKETT} htmlFor="nasta-nar">Datum och tid *</label>
            <DateField id="nasta-nar" withTime value={nar} onChange={setNar} className={DATUMFALT} />
          </div>
        </div>
      )}

      {sedan === 'parkera' && (
        <div className="grid grid-cols-1 sm:grid-cols-[190px_1fr] gap-3">
          <div>
            <label className={ETIKETT} htmlFor="park-till">Vaknar den *</label>
            <DateField id="park-till" value={parkTill} onChange={setParkTill} min={idagSv()} className={DATUMFALT} />
          </div>
          <div>
            <label className={ETIKETT} htmlFor="park-text">Vad ska göras då?</label>
            <input id="park-text" className={FALT} value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Till exempel Hör av oss när avtalet med nuvarande leverantör går ut" />
          </div>
        </div>
      )}

      {sedan === 'forlorad' && (
        <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-3">
          <Select
            label="Orsak *"
            value={orsak}
            onChange={(v) => setOrsak(v as LeadForlustorsak)}
            options={FORLUSTORSAKER.map((o) => ({ value: o, label: FORLUSTORSAK_ETIKETT[o] }))}
            placeholder="Välj orsak"
          />
          <div>
            <label className={ETIKETT} htmlFor="forlust-text">Kommentar</label>
            <input id="forlust-text" className={FALT} value={orsakText} onChange={(e) => setOrsakText(e.target.value)} placeholder="Till exempel Valde Anticimex, 20 % billigare" />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-slate-700/50">
        <Button variant="ghost" size="sm" onClick={() => onLage('visa')} disabled={sparar}>Avbryt</Button>
        <Button variant={sedan === 'forlorad' ? 'danger' : 'primary'} size="sm" onClick={() => void spara()} loading={sparar}>
          {sedan === 'forlorad' ? 'Markera förlorad' : sedan === 'parkera' ? 'Parkera' : 'Spara'}
        </Button>
      </div>
    </div>
  )
}
