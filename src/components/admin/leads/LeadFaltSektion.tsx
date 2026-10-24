// src/components/admin/leads/LeadFaltSektion.tsx
// En sektion i leadens detaljvy med redigering på plats (WebLeadUppgifter-mönstret): visningsläge med
// etikett och värde, Redigera växlar till fält, Spara skickar bara de fält som ändrats.

import { useState, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import Button from '../../ui/Button'
import Select from '../../ui/Select'
import DateField from '../../ui/DateField'
import { Icon, type IconName } from '../../icons/Icon'
import type { Lead, LeadUpdate } from '../../../types/database'
import { toLocalISOStringWithOffset } from '../../../utils/dateHelpers'
import { svDatum } from '../webLeads/format'
import { DATUMFALT, ETIKETT, FALT, SEKTION, SEKTION_RUBRIK } from './leadLogik'

type Nyckel = keyof LeadUpdate & keyof Lead

export interface FaltDef {
  nyckel: Nyckel
  etikett: string
  typ?: 'text' | 'tel' | 'email' | 'number' | 'datum' | 'val' | 'textarea'
  val?: { value: string; label: string }[]
  mono?: boolean
  /** Egen visning i visningsläget */
  visa?: (lead: Lead) => ReactNode
  /** Döljs i visningsläget när värdet saknas */
  doljTom?: boolean
  bred?: boolean
}

interface Props {
  titel: string
  ikon: IconName
  lead: Lead
  falt: FaltDef[]
  kanRedigera: boolean
  onSpara: (andring: LeadUpdate) => Promise<void>
  /** Extra innehåll under fälten i visningsläget */
  extra?: ReactNode
  /** Utan egen sektionsram (inuti Mer uppgifter) */
  ramlos?: boolean
}

function tillText(lead: Lead, f: FaltDef): string {
  const v = lead[f.nyckel] as unknown
  if (v == null) return ''
  if (f.typ === 'datum') return svDatum(String(v))
  return String(v)
}

function datumTillIso(d: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d)
  if (!m) return null
  // Mitt på dagen så att datumet inte skiftar med tidszonen
  return toLocalISOStringWithOffset(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0))
}

export default function LeadFaltSektion({ titel, ikon, lead, falt, kanRedigera, onSpara, extra, ramlos }: Props) {
  const [redigerar, setRedigerar] = useState(false)
  const [varden, setVarden] = useState<Record<string, string>>({})
  const [sparar, setSparar] = useState(false)

  const borja = () => {
    const v: Record<string, string> = {}
    for (const f of falt) v[f.nyckel] = tillText(lead, f)
    setVarden(v)
    setRedigerar(true)
  }

  const spara = async () => {
    const andring: Record<string, unknown> = {}
    for (const f of falt) {
      const ny = (varden[f.nyckel] ?? '').trim()
      if (ny === tillText(lead, f).trim()) continue
      if (!ny) andring[f.nyckel] = null
      else if (f.typ === 'number') {
        const n = Number(ny.replace(/\s/g, '').replace(',', '.'))
        if (Number.isNaN(n)) {
          toast.error(`${f.etikett}: ange ett tal`)
          return
        }
        andring[f.nyckel] = Math.round(n)
      } else if (f.typ === 'datum') andring[f.nyckel] = datumTillIso(ny)
      else andring[f.nyckel] = ny
    }
    if (Object.keys(andring).length === 0) {
      setRedigerar(false)
      return
    }
    setSparar(true)
    try {
      await onSpara(andring as LeadUpdate)
      setRedigerar(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ändringen kunde inte sparas')
    } finally {
      setSparar(false)
    }
  }

  const visning = falt
    .map((f) => ({ f, text: tillText(lead, f) }))
    .filter(({ f, text }) => !(f.doljTom && !text && !f.visa))

  return (
    <div className={ramlos ? '' : SEKTION}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <h3 className={`${SEKTION_RUBRIK} mb-0`}>
          <Icon name={ikon} size={16} className="text-[#20c58f]" /> {titel}
        </h3>
        {kanRedigera && !redigerar && (
          <button type="button" onClick={borja} className="text-xs text-[#20c58f] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded">
            Redigera
          </button>
        )}
      </div>

      {redigerar ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {falt.map((f) => {
              const id = `falt-${f.nyckel}`
              const varde = varden[f.nyckel] ?? ''
              const satt = (v: string) => setVarden((p) => ({ ...p, [f.nyckel]: v }))
              return (
                <div key={f.nyckel} className={f.bred || f.typ === 'textarea' ? 'sm:col-span-2' : ''}>
                  {f.typ === 'val' ? (
                    <Select label={f.etikett} value={varde} onChange={satt} options={[{ value: '', label: 'Inte angivet' }, ...(f.val ?? [])]} />
                  ) : (
                    <>
                      <label className={ETIKETT} htmlFor={id}>{f.etikett}</label>
                      {f.typ === 'textarea' ? (
                        <textarea id={id} rows={3} className={FALT} value={varde} onChange={(e) => satt(e.target.value)} />
                      ) : f.typ === 'datum' ? (
                        <DateField id={id} value={varde} onChange={satt} clearable className={DATUMFALT} />
                      ) : (
                        <input
                          id={id}
                          type={f.typ === 'tel' ? 'tel' : f.typ === 'email' ? 'email' : 'text'}
                          inputMode={f.typ === 'number' ? 'numeric' : undefined}
                          className={`${FALT} ${f.mono ? 'font-mono' : ''}`}
                          value={varde}
                          onChange={(e) => satt(e.target.value)}
                        />
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-700/50">
            <Button variant="ghost" size="sm" onClick={() => setRedigerar(false)} disabled={sparar}>Avbryt</Button>
            <Button variant="primary" size="sm" onClick={() => void spara()} loading={sparar}>Spara</Button>
          </div>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
            {visning.map(({ f, text }) => (
              <div key={f.nyckel} className={f.bred || f.typ === 'textarea' ? 'sm:col-span-2' : ''}>
                <dt className="text-xs text-slate-400">{f.etikett}</dt>
                <dd className={`text-white break-words ${f.mono ? 'font-mono' : ''} ${f.typ === 'textarea' ? 'whitespace-pre-wrap' : ''}`}>
                  {f.visa ? f.visa(lead) : text ? (f.val?.find((o) => o.value === text)?.label ?? text) : <span className="text-slate-500">Saknas</span>}
                </dd>
              </div>
            ))}
          </dl>
          {extra}
        </>
      )}
    </div>
  )
}
