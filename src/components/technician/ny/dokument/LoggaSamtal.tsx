// src/components/technician/ny/dokument/LoggaSamtal.tsx
// Logga samtal i nästa steg-rutan: utfall, anteckning och (med behörighet) ring åter.
// Samma innehåll som CallLogPopover, med 44 px val. Ring åter flyttar dokumentet
// till Ring idag (när dagen kommer) eller Väntar på kunden.
//
// Kontorsläget skickar `onAnnanKanal`: då väljs först kanal (Telefon, Mejl, Sms).
// Telefon sparas som samtal precis som förut. Mejl och sms har inget utfall och
// sparas av anroparen (som anteckning på dokumentet). Utan propen ser rutan ut
// och beter sig som i teknikerläget.

import { useState } from 'react'
import DatePicker, { registerLocale } from 'react-datepicker'
import { sv } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'
import toast from 'react-hot-toast'
import { Icon } from '../../../icons/Icon'
import { idagSv, loggaSamtal, plusDagar, type Behorighet } from './dokumentData'
import { KNAPP_PRIMAR, KNAPP_TYST } from './dokumentUi'

registerLocale('sv', sv)

type Utfall = 'reached' | 'voicemail' | 'no_answer'

const UTFALL: { key: Utfall; text: string }[] = [
  { key: 'reached', text: 'Nådde kunden' },
  { key: 'voicemail', text: 'Röstbrevlåda' },
  { key: 'no_answer', text: 'Inget svar' },
]

function nastaMandag(): string {
  const idag = idagSv()
  const [y, m, d] = idag.split('-').map(Number)
  const vd = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return plusDagar(idag, ((8 - vd) % 7) || 7)
}

const VAL = (vald: boolean) => `min-h-[44px] px-3 rounded-xl border text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
  vald ? 'border-[#20c58f] bg-[#20c58f]/15 text-white' : 'border-slate-600 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800'
}`

interface Props {
  contractId: string
  kund: string
  byName: string | null
  byEmail: string | null
  behorighet: Behorighet
  onStang: () => void
  onSparat: () => void
  /** Kontorsläget: mejl och sms sparas av anroparen. Ger kanalvalet. */
  onAnnanKanal?: (kanal: 'mejl' | 'sms', anteckning: string | null, ringAter: string | null) => Promise<void>
}

type KontaktKanal = 'telefon' | 'mejl' | 'sms'

export function LoggaSamtal({ contractId, kund, byName, byEmail, behorighet, onStang, onSparat, onAnnanKanal }: Props) {
  const [kontaktKanal, setKontaktKanal] = useState<KontaktKanal>('telefon')
  const [utfall, setUtfall] = useState<Utfall>('reached')
  const [anteckning, setAnteckning] = useState('')
  const [ringAter, setRingAter] = useState<string | null>(null)
  const [sparar, setSparar] = useState(false)

  const idag = idagSv()
  const snabbval: { text: string; varde: string | null }[] = [
    { text: 'Ingen', varde: null },
    { text: 'Imorgon', varde: plusDagar(idag, 1) },
    { text: 'Om 3 dagar', varde: plusDagar(idag, 3) },
    { text: 'Måndag', varde: nastaMandag() },
  ]

  const spara = async () => {
    setSparar(true)
    if (onAnnanKanal && kontaktKanal !== 'telefon') {
      try {
        await onAnnanKanal(kontaktKanal, anteckning.trim() || null, behorighet.atgarder ? ringAter : null)
        toast.success(kontaktKanal === 'mejl' ? 'Mejlet är loggat' : 'Sms:et är loggat')
        onSparat()
      } catch (err) {
        console.error('loggaKontakt:', err)
        toast.error('Kunde inte logga kontakten')
      } finally {
        setSparar(false)
      }
      return
    }
    try {
      await loggaSamtal(contractId, {
        outcome: utfall,
        note: anteckning.trim() || null,
        followUpAt: behorighet.atgarder ? ringAter : null,
        byName,
        byEmail,
      }, behorighet)
      toast.success(ringAter && behorighet.atgarder ? `Samtalet är loggat, du ringer igen ${ringAter}` : 'Samtalet är loggat')
      onSparat()
    } catch (err) {
      console.error('loggaSamtal:', err)
      toast.error('Kunde inte logga samtalet')
    } finally {
      setSparar(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl bg-slate-900 border border-slate-700">
      <p className="flex items-center gap-2 text-[15px] font-semibold text-white">
        <Icon name={kontaktKanal === 'telefon' ? 'kontakt.telefon' : 'kontakt.mejl'} size={20} className="text-[#20c58f]" />
        {onAnnanKanal ? `Logga kontakt med ${kund}` : `Logga samtal med ${kund}`}
      </p>
      {onAnnanKanal && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold text-slate-300">Kanal</legend>
          <div className="grid grid-cols-3 gap-2">
            {([['telefon', 'Telefon'], ['mejl', 'Mejl'], ['sms', 'Sms']] as const).map(([k, text]) => (
              <button key={k} type="button" aria-pressed={kontaktKanal === k} onClick={() => setKontaktKanal(k)} className={VAL(kontaktKanal === k)}>
                {text}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset className={`flex flex-col gap-2 ${kontaktKanal === 'telefon' ? '' : 'hidden'}`}>
        <legend className="mb-2 text-sm font-semibold text-slate-300">Hur gick det</legend>
        <div className="grid grid-cols-3 gap-2">
          {UTFALL.map(u => (
            <button key={u.key} type="button" aria-pressed={utfall === u.key} onClick={() => setUtfall(u.key)} className={VAL(utfall === u.key)}>
              {u.text}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-slate-300">Anteckning, valfri</span>
        <textarea
          value={anteckning}
          onChange={e => setAnteckning(e.target.value)}
          rows={2}
          className="w-full px-3 py-2.5 rounded-xl bg-slate-950/40 border border-slate-600 text-[15px] text-white placeholder:text-slate-500 resize-y focus:outline-none focus:border-[#20c58f] focus:ring-2 focus:ring-[#20c58f]/30"
        />
      </label>
      {behorighet.atgarder && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold text-slate-300">Ring igen</legend>
          <div className="flex flex-wrap gap-2">
            {snabbval.map(v => (
              <button key={v.text} type="button" aria-pressed={ringAter === v.varde} onClick={() => setRingAter(v.varde)} className={VAL(ringAter === v.varde)}>
                {v.text}
              </button>
            ))}
            <DatePicker
              selected={ringAter ? new Date(ringAter + 'T12:00:00') : null}
              onChange={(d: Date | null) => {
                if (!d) { setRingAter(null); return }
                setRingAter(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
              }}
              locale="sv"
              dateFormat="yyyy-MM-dd"
              minDate={new Date()}
              placeholderText="Välj datum"
              portalId="datepicker-portal"
              className="w-36 min-h-[44px] px-3 rounded-xl bg-slate-900 border border-slate-600 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-[#20c58f]"
            />
          </div>
        </fieldset>
      )}
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onStang} disabled={sparar} className={`${KNAPP_TYST} h-11`}>Avbryt</button>
        <button type="button" onClick={spara} disabled={sparar} className={`${KNAPP_PRIMAR} disabled:opacity-60`}>
          {sparar ? <Icon name="allman.laddar" size={20} className="animate-spin" /> : <Icon name="allman.bock" size={20} />}
          {kontaktKanal === 'telefon' ? 'Spara samtalet' : 'Spara kontakten'}
        </button>
      </div>
    </div>
  )
}

export default LoggaSamtal
