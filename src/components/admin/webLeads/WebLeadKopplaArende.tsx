// src/components/admin/webLeads/WebLeadKopplaArende.tsx
// Leads (Webb): Koppla befintligt ärende. När ärendet redan skapats på annat sätt söker
// koordinatorn fram det på ärendenummer och kopplar det till förfrågan. Bara ärenden skapade samma
// dag som förfrågan kom in eller senare och som inte redan är kopplade; databasens trigger spärrar
// samma sak. Ett ärende för en avtalskund ger status Befintlig kund, övriga Bokad.

import { useState } from 'react'
import { Link2, Search, X } from 'lucide-react'
import toast from 'react-hot-toast'
import Button from '../../ui/Button'
import { WebInquiryService } from '../../../services/webInquiryService'
import type { ArendeTraff, WebInquiry } from '../../../types/webInquiry'
import { formatSvTid, svDatum } from './format'

interface Props {
  inquiry: WebInquiry
  onKopplad: (uppdaterad: WebInquiry) => void
  onStang: () => void
}

export default function WebLeadKopplaArende({ inquiry, onKopplad, onStang }: Props) {
  const [nummer, setNummer] = useState('')
  const [traffar, setTraffar] = useState<ArendeTraff[] | null>(null)
  const [soker, setSoker] = useState(false)
  const [kopplar, setKopplar] = useState<string | null>(null)

  const forfraganDatum = svDatum(inquiry.created_at)

  const sok = async () => {
    if (!nummer.trim()) return
    setSoker(true)
    try {
      setTraffar(await WebInquiryService.findCaseByNumber(nummer))
    } catch {
      toast.error('Ärendet kunde inte sökas')
    } finally {
      setSoker(false)
    }
  }

  const hinder = (t: ArendeTraff): string | null => {
    if (t.kopplat) return 'Redan kopplat till en förfrågan'
    if (svDatum(t.created_at) < forfraganDatum) return 'Skapat före förfrågan'
    return null
  }

  const koppla = async (t: ArendeTraff) => {
    setKopplar(t.id)
    try {
      const uppdaterad = await WebInquiryService.linkCase(inquiry.id, t.tabell, t.id, true)
      toast.success(`Ärende ${t.case_number} kopplat`)
      onKopplad(uppdaterad)
    } catch (e) {
      // Triggerns meddelanden är svenska och innehåller inga kunduppgifter
      const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : ''
      toast.error(msg && msg.length < 200 ? msg : 'Ärendet kunde inte kopplas')
    } finally {
      setKopplar(null)
    }
  }

  return (
    <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
          <Link2 className="w-4 h-4 text-[#20c58f]" /> Koppla befintligt ärende
        </h3>
        <button type="button" onClick={onStang} className="text-slate-400 hover:text-white" aria-label="Stäng">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-xs text-slate-500">
        För ett ärende som redan skapats på annat sätt. Ärendet måste vara skapat {forfraganDatum} eller senare.
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void sok()
        }}
      >
        <input
          value={nummer}
          onChange={(e) => setNummer(e.target.value)}
          placeholder="Ärendenummer, till exempel BE-0009012"
          maxLength={40}
          className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
        />
        <Button type="submit" variant="secondary" size="sm" disabled={soker || !nummer.trim()}>
          <Search className="w-4 h-4 mr-1.5" />
          {soker ? 'Söker...' : 'Sök'}
        </Button>
      </form>
      {traffar && traffar.length === 0 && <p className="text-sm text-slate-500">Inget ärende med det numret.</p>}
      {traffar && traffar.length > 0 && (
        <ul className="space-y-1.5">
          {traffar.map((t) => {
            const stopp = hinder(t)
            return (
              <li key={`${t.tabell}:${t.id}`} className="px-3 py-2 bg-slate-800/20 border border-slate-700/50 rounded-xl text-sm flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-white">
                    <span className="font-mono">{t.case_number}</span>
                    <span className="text-slate-400"> · {t.typ}</span>
                    {t.kund ? <span className="text-slate-300"> · {t.kund}</span> : null}
                  </p>
                  <p className="text-xs text-slate-500">
                    Skapat {formatSvTid(t.created_at)}
                    {t.status ? `, status ${t.status}` : ''}
                    {t.tabell === 'cases' ? '. Ger status Befintlig kund' : ''}
                  </p>
                </div>
                {stopp ? (
                  <span className="text-xs text-amber-400">{stopp}</span>
                ) : (
                  <Button variant="primary" size="sm" disabled={!!kopplar} onClick={() => koppla(t)}>
                    {kopplar === t.id ? 'Kopplar...' : 'Koppla'}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
