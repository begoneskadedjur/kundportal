// src/components/technician/ny/arenden/ArendeForhandsvisning.tsx
// Valt ärende i datorns högerpanel: kund, adress, kontakt, typ, status och
// beskrivning, med Öppna ärendet, Navigera och Ring. Beskrivningen och senaste
// rapporten hämtas när ärendet väljs (finns inte i listans data).

import { useEffect, useState } from 'react'
import { supabase } from '../../../../lib/supabase'
import { Icon } from '../../../icons/Icon'
import { StatusPunkt } from '../besokUi'
import { TYP_IKON } from '../besokTyp'
import {
  besokBeskrivning, klockslag, navigeraUrl, telUrl, type DagBesok,
} from '../../../../services/teknikerDagService'
import { dagRubrik, kollegor, schemaStatus } from '../schema/schemaLogik'
import { ArbetsTid, VISA_ARBETSTID } from '../schema/SchemaDelar'
import { alderTon, avslutsdag, dagarSedan, langDatum, sedanText } from './arendeLogik'

const SEKUNDAR = 'h-11 flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-900 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]'
const AV = 'h-11 flex items-center justify-center gap-2 rounded-xl border border-slate-700 text-sm font-semibold text-slate-500 cursor-not-allowed'

interface Text { beskrivning: string | null; rapport: string | null }

/** Ren text ur fält som ibland innehåller HTML */
function renText(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/[ \t]+/g, ' ').trim()
  return t || null
}

function useArendeText(b: DagBesok | null): { text: Text | null; laddar: boolean } {
  const [text, setText] = useState<Text | null>(null)
  const [laddar, setLaddar] = useState(false)
  const kalla = b?.kalla
  const id = b?.id
  useEffect(() => {
    if (!kalla || !id) { setText(null); return }
    let avbruten = false
    setLaddar(true)
    setText(null)
    ;(async () => {
      try {
        if (kalla === 'cases') {
          const { data } = await supabase.from('cases').select('description, work_report').eq('id', id).maybeSingle()
          if (!avbruten) setText({ beskrivning: renText(data?.description), rapport: renText(data?.work_report) })
        } else {
          const tabell = kalla === 'private' ? 'private_cases' : 'business_cases'
          const { data } = await supabase.from(tabell).select('description, rapport').eq('id', id).maybeSingle()
          if (!avbruten) setText({ beskrivning: renText(data?.description), rapport: renText(data?.rapport) })
        }
      } catch {
        if (!avbruten) setText({ beskrivning: null, rapport: null })
      } finally {
        if (!avbruten) setLaddar(false)
      }
    })()
    return () => { avbruten = true }
  }, [kalla, id])
  return { text, laddar }
}

interface Props {
  besok: DagBesok | null
  idag: string
  minId: string | null
  onOppna: (b: DagBesok) => void
}

export function ArendeForhandsvisning({ besok: b, idag, minId, onOppna }: Props) {
  const { text, laddar } = useArendeText(b)

  if (!b) {
    return (
      <section aria-label="Valt ärende" data-genomgang="mina-valt" className="rounded-2xl border border-dashed border-slate-700 p-6 text-center">
        <Icon name="arende.arende" size={32} className="mx-auto text-slate-500" />
        <p className="mt-2 text-sm text-slate-400">Klicka på ett ärende i listan för att se det här.</p>
      </section>
    )
  }

  const passerat = !b.avslutad && b.dag && b.dag < idag && (b.status === 'Bokad' || b.status === 'Återbesök')
  const dagar = passerat && b.dag ? dagarSedan(b.dag, idag) : 0
  const st = passerat ? { ton: alderTon(dagar), text: `Inte avslutat, ${sedanText(dagar)}` } : schemaStatus(b, idag)
  const med = kollegor(b, minId)
  const avslutadDag = b.avslutad ? avslutsdag(b) : null

  return (
    <section aria-labelledby="mina-valt-rubrik" data-genomgang="mina-valt" className="rounded-2xl bg-slate-900 border border-slate-700/60 p-4 space-y-4">
      <div className="space-y-1">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-slate-300">
          <Icon name={TYP_IKON[b.typ]} size={16} className="text-slate-400" />
          {besokBeskrivning(b)}
        </p>
        <h2 id="mina-valt-rubrik" className="text-lg font-semibold text-white leading-snug">{b.kund}</h2>
        <StatusPunkt ton={st.ton}>{st.text}</StatusPunkt>
      </div>

      <dl className="space-y-2 text-sm">
        <div className="flex gap-2">
          <dt className="sr-only">Tid</dt>
          <Icon name="allman.kalender" size={16} className="mt-0.5 flex-shrink-0 text-slate-400" />
          <dd className="text-slate-300">
            {b.dag ? <>{dagRubrik(b.dag)}{b.start ? <span className="font-mono">, {klockslag(b.start)}{b.slut ? ` till ${klockslag(b.slut)}` : ''}</span> : null}</> : 'Ingen tid bokad'}
            {avslutadDag && avslutadDag !== b.dag && <span className="block text-[13px] text-slate-400">Avslutat {langDatum(avslutadDag, idag)}</span>}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="sr-only">Adress</dt>
          <Icon name="rapport.adress" size={16} className="mt-0.5 flex-shrink-0 text-slate-400" />
          <dd className="text-slate-300">{b.adress || 'Adress saknas i ärendet'}</dd>
        </div>
        {(b.kontaktperson || b.telefon) && (
          <div className="flex gap-2">
            <dt className="sr-only">Kontakt</dt>
            <Icon name="rapport.person" size={16} className="mt-0.5 flex-shrink-0 text-slate-400" />
            <dd className="text-slate-300">{[b.kontaktperson, b.telefon].filter(Boolean).join(', ')}</dd>
          </div>
        )}
        {med.length > 0 && (
          <div className="flex gap-2">
            <dt className="sr-only">Kollegor</dt>
            <Icon name="bokning.team" size={16} className="mt-0.5 flex-shrink-0 text-slate-400" />
            <dd className="text-slate-300">Med {med.join(' och ')}</dd>
          </div>
        )}
        {VISA_ARBETSTID && (b.arbeteStartat || b.arbetadeMinuter > 0) && (
          <div className="flex gap-2">
            <dt className="sr-only">Arbetstid</dt>
            <Icon name="allman.klocka" size={16} className="mt-0.5 flex-shrink-0 text-slate-400" />
            <dd className="text-slate-300"><ArbetsTid b={b} /></dd>
          </div>
        )}
        {b.arendenummer && (
          <div className="flex gap-2">
            <dt className="sr-only">Ärendenummer</dt>
            <Icon name="arende.arende" size={16} className="mt-0.5 flex-shrink-0 text-slate-400" />
            <dd className="font-mono text-slate-300">{b.arendenummer}</dd>
          </div>
        )}
      </dl>

      {laddar ? (
        <div className="space-y-2" aria-hidden="true">
          <div className="h-3 w-1/3 rounded bg-slate-800 animate-pulse" />
          <div className="h-3 w-full rounded bg-slate-800 animate-pulse" />
          <div className="h-3 w-4/5 rounded bg-slate-800 animate-pulse" />
        </div>
      ) : text && (text.beskrivning || text.rapport) ? (
        <div className="space-y-3 border-t border-slate-700/60 pt-3">
          {text.beskrivning && (
            <div>
              <h3 className="text-[13px] font-semibold text-slate-300">Beskrivning</h3>
              <p className="mt-0.5 text-sm text-slate-400 whitespace-pre-line line-clamp-5">{text.beskrivning}</p>
            </div>
          )}
          {text.rapport && (
            <div>
              <h3 className="text-[13px] font-semibold text-slate-300">Senaste rapporten</h3>
              <p className="mt-0.5 text-sm text-slate-400 whitespace-pre-line line-clamp-5">{text.rapport}</p>
            </div>
          )}
        </div>
      ) : null}

      <div className="space-y-2">
        <button
          type="button"
          onClick={() => onOppna(b)}
          className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-[#20c58f] text-[#04281c] text-[15px] font-semibold hover:bg-[#1bb07f] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 focus-visible:ring-[#20c58f]"
        >
          <Icon name="arende.arende" size={20} />
          Öppna ärendet
        </button>
        <div className="grid grid-cols-2 gap-2">
          {b.adress ? (
            <a href={navigeraUrl(b.adress)} target="_blank" rel="noopener noreferrer" className={SEKUNDAR}>
              <Icon name="falt.navigera" size={20} />Navigera
            </a>
          ) : (
            <span className={AV} aria-disabled="true" title="Adress saknas"><Icon name="falt.navigera" size={20} />Navigera</span>
          )}
          {b.telefon ? (
            <a href={telUrl(b.telefon)} className={SEKUNDAR} aria-label={`Ring ${b.kontaktperson || b.kund}`}>
              <Icon name="kontakt.telefon" size={20} />Ring
            </a>
          ) : (
            <span className={AV} aria-disabled="true" title="Telefonnummer saknas"><Icon name="kontakt.telefon" size={20} />Ring</span>
          )}
        </div>
      </div>
    </section>
  )
}

export default ArendeForhandsvisning
