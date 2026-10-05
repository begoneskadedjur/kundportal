// src/components/admin/webLeads/WebLeadDetailModal.tsx
// Detaljvy för en webbförfrågan i Leads (Webb): kontaktuppgifter, formulärets svar, bilder, källa,
// statusflöde, tilldelning, anteckningar med historik och konvertering till B2B-lead.
// Modalstandard: inget Card, sektioner p-3 bg-slate-800/30, status som text med statuspunkt.

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Phone, Mail, MapPin, MessageSquare, Image as ImageIcon, Globe, History, UserPlus, Target, Send, X, ClipboardPlus, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '../../ui/Modal'
import Button from '../../ui/Button'
import CreateLeadModal from '../leads/CreateLeadModal'
import CreateCaseModal from '../coordinator/CreateCaseModal'
import { useAuth } from '../../../contexts/AuthContext'
import { WebInquiryService } from '../../../services/webInquiryService'
import { refreshWebLeadsBadge } from '../../../hooks/useWebLeadsBadge'
import {
  KUNDGRUPP_LABEL,
  STATUS_CONFIG,
  MANUELLA_STATUSAR,
  FRIST_DAGAR,
  FRIST_DAGAR_OFFERT,
  kallaLabel,
  tjanstLabel,
  type StaffProfile,
  type WebInquiry,
  type WebInquiryEvent,
  type WebInquiryStatus,
} from '../../../types/webInquiry'
import type { BusinessCasesInsert, LeadInsert, PrivateCasesInsert, Technician } from '../../../types/database'
import { formatSvTid, svDatum } from './format'

interface Props {
  inquiry: WebInquiry | null
  staff: StaffProfile[]
  leadsBasePath: string
  /** Sidan där ärenden öppnas (sök ärenden). null när rollen inte skapar ärenden, t.ex. säljare. */
  arendeSokPath: string | null
  onClose: () => void
  onChanged: (updated: Partial<WebInquiry> & { id: string }) => void
}

const DETALJ_ETIKETT: Record<string, string> = {
  nar_ringa: 'När vi ska ringa',
  art: 'Art enligt artanalysen',
  sakerhet: 'Säkerhet',
  utfall: 'Analysens utfall',
}

type Svar = { etikett: string; varde: string }

/** Formulärets svar (fråga och svar, följdfråga och artanalysens fält) som etikett och värde. */
function formularSvar(inquiry: WebInquiry): Svar[] {
  const svar: Svar[] = []
  const d = inquiry.details
  if (typeof d.fraga === 'string' && d.svar != null) svar.push({ etikett: d.fraga, varde: String(d.svar) })
  else if (d.svar != null && d.svar !== '') svar.push({ etikett: 'Svar', varde: String(d.svar) })
  if (typeof d.foljfraga === 'string' && d.folj != null) svar.push({ etikett: d.foljfraga, varde: String(d.folj) })
  for (const [k, etikett] of Object.entries(DETALJ_ETIKETT)) {
    if (d[k] != null && d[k] !== '') svar.push({ etikett, varde: String(d[k]) })
  }
  return svar
}

/** Ärendemodalens fält förifyllda från förfrågan. Det som saknas lämnas tomt. */
function arendeFalt(inquiry: WebInquiry, typ: 'private' | 'business'): Partial<PrivateCasesInsert & BusinessCasesInsert> {
  const adress = [inquiry.address, [inquiry.postal_code, inquiry.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const tjanst = inquiry.pest_type ? tjanstLabel(inquiry.pest_type) : ''
  const beskrivning = [
    `Webbförfrågan ${inquiry.referens} (${formatSvTid(inquiry.created_at)})`,
    inquiry.akut ? 'Akut: kunden bad om hjälp så snart som möjligt.' : '',
    tjanst ? `Tjänst: ${tjanst}` : '',
    ...formularSvar(inquiry).map((s) => `${s.etikett}: ${s.varde}`),
    inquiry.message ? `Kundens meddelande:\n${inquiry.message}` : '',
  ].filter(Boolean).join('\n')

  const falt: Partial<PrivateCasesInsert & BusinessCasesInsert> & { company_name?: string } = {
    kontaktperson: inquiry.name || '',
    telefon_kontaktperson: inquiry.phone || '',
    e_post_kontaktperson: inquiry.email || '',
    adress,
    skadedjur: tjanst,
    description: beskrivning,
  }
  if (typ === 'business') {
    falt.company_name = inquiry.company_name || ''
    falt.org_nr = inquiry.organization_number || ''
  }
  return falt
}

export default function WebLeadDetailModal({ inquiry, staff, leadsBasePath, arendeSokPath, onClose, onChanged }: Props) {
  const { profile } = useAuth()
  const [events, setEvents] = useState<WebInquiryEvent[]>([])
  const [bilder, setBilder] = useState<{ path: string; url: string }[]>([])
  const [storBild, setStorBild] = useState<string | null>(null)
  const [anteckning, setAnteckning] = useState('')
  const [sparar, setSparar] = useState(false)
  const [visaSkapaLead, setVisaSkapaLead] = useState(false)
  // Skapa ärende: tekniker, förifyllda fält och bilder hämtas innan ärendemodalen öppnas
  const [forbereder, setForbereder] = useState(false)
  const [arendeUnderlag, setArendeUnderlag] = useState<{
    typ: 'private' | 'business'
    falt: Partial<PrivateCasesInsert & BusinessCasesInsert>
    bilder: File[]
    tekniker: Technician[]
  } | null>(null)

  const id = inquiry?.id

  const laddaHistorik = useCallback(async () => {
    if (!id) return
    try {
      setEvents(await WebInquiryService.listEvents(id))
    } catch {
      toast.error('Historiken kunde inte hämtas')
    }
  }, [id])

  useEffect(() => {
    setEvents([])
    setBilder([])
    setAnteckning('')
    if (!id) return
    void laddaHistorik()
    WebInquiryService.imageUrls(id).then(setBilder).catch(() => setBilder([]))
  }, [id, laddaHistorik])

  if (!inquiry) return null

  const namnFor = (profileId: string | null) => {
    if (!profileId) return 'Systemet'
    const p = staff.find((s) => s.id === profileId)
    return p ? p.display_name || p.email : 'Okänd användare'
  }

  const byttStatus = async (status: WebInquiryStatus) => {
    if (status === inquiry.status) return
    setSparar(true)
    try {
      await WebInquiryService.setStatus(inquiry.id, status)
      onChanged({ id: inquiry.id, status })
      refreshWebLeadsBadge()
      void laddaHistorik()
    } catch {
      toast.error('Statusen kunde inte sparas')
    } finally {
      setSparar(false)
    }
  }

  const tilldela = async (profileId: string | null) => {
    setSparar(true)
    try {
      await WebInquiryService.assign(inquiry.id, profileId)
      onChanged({ id: inquiry.id, tilldelad_till: profileId })
      void laddaHistorik()
    } catch {
      toast.error('Tilldelningen kunde inte sparas')
    } finally {
      setSparar(false)
    }
  }

  const sparaAnteckning = async () => {
    if (!anteckning.trim() || !profile?.id) return
    setSparar(true)
    try {
      await WebInquiryService.addNote(inquiry.id, profile.id, anteckning)
      setAnteckning('')
      void laddaHistorik()
    } catch {
      toast.error('Anteckningen kunde inte sparas')
    } finally {
      setSparar(false)
    }
  }

  const leadData: Partial<LeadInsert> = {
    company_name: inquiry.company_name || inquiry.name,
    contact_person: inquiry.name,
    phone_number: inquiry.phone,
    email: inquiry.email || '',
    organization_number: inquiry.organization_number || '',
    address: [inquiry.address, [inquiry.postal_code, inquiry.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    problem_type: tjanstLabel(inquiry.pest_type),
    business_type: typeof inquiry.details.svar === 'string' && inquiry.customer_kind === 'foretag' ? inquiry.details.svar : '',
    source: 'Webbförfrågan',
    notes: [`Webbförfrågan ${inquiry.referens} (${formatSvTid(inquiry.created_at)})`, inquiry.message].filter(Boolean).join('\n\n'),
  }

  const efterLead = async (leadId: string) => {
    try {
      await WebInquiryService.linkLead(inquiry.id, leadId)
      onChanged({ id: inquiry.id, lead_id: leadId })
      void laddaHistorik()
    } catch {
      toast.error('Leaden skapades men kopplingen till förfrågan kunde inte sparas')
    }
  }

  const oppnaSkapaArende = async () => {
    setForbereder(true)
    try {
      // Färsk rad: en kollega kan ha skapat ärendet medan modalen stod öppen
      const farsk = await WebInquiryService.get(inquiry.id)
      if (farsk?.arende_id) {
        onChanged(farsk)
        toast.error('Förfrågan har redan ett ärende')
        return
      }
      const typ: 'private' | 'business' = inquiry.kundgrupp === 'privat' ? 'private' : 'business'
      const [tekniker, filer] = await Promise.all([
        WebInquiryService.listTechnicians(),
        WebInquiryService.imageFiles(inquiry.id).catch(() => [] as File[]),
      ])
      if (inquiry.bilder.some((b) => b.uppladdad) && filer.length === 0) {
        toast.error('Bilderna kunde inte hämtas och följer inte med till ärendet')
      }
      setArendeUnderlag({ typ, falt: arendeFalt(inquiry, typ), bilder: filer, tekniker })
    } catch {
      toast.error('Ärendemodalen kunde inte öppnas')
    } finally {
      setForbereder(false)
    }
  }

  const efterArende = async (caseId: string, caseType: 'private' | 'business' | 'contract') => {
    try {
      const uppdaterad = await WebInquiryService.linkCase(
        inquiry.id,
        caseType === 'business' ? 'business_cases' : 'private_cases',
        caseId,
      )
      onChanged(uppdaterad)
      refreshWebLeadsBadge()
      void laddaHistorik()
    } catch {
      toast.error('Ärendet skapades men kopplingen till förfrågan kunde inte sparas')
    }
  }

  const svar = formularSvar(inquiry)

  const status = STATUS_CONFIG[inquiry.status]
  const arForetag = inquiry.kundgrupp !== 'privat'
  const bokad = !!inquiry.arende_id
  const fristDagar = inquiry.haft_offert ? FRIST_DAGAR_OFFERT : FRIST_DAGAR
  const fristDatum = inquiry.bokad_at
    ? svDatum(new Date(new Date(inquiry.bokad_at).getTime() + fristDagar * 86400000))
    : null
  const arendeLank = inquiry.arende_id && arendeSokPath
    ? `${arendeSokPath}?openCase=${inquiry.arende_id}&caseType=${inquiry.arende_tabell === 'business_cases' ? 'business' : 'private'}`
    : null

  return (
    <>
      <Modal
        isOpen={!!inquiry}
        onClose={onClose}
        size="xl"
        title={
          <span className="flex items-center gap-3">
            <span>{inquiry.company_name || inquiry.name}</span>
            <span className="font-mono text-sm text-slate-400">{inquiry.referens}</span>
          </span>
        }
        subtitle={`${tjanstLabel(inquiry.pest_type)}${inquiry.city ? `, ${inquiry.city}` : ''} · inkom ${formatSvTid(inquiry.created_at)}`}
      >
        <div className="p-4 space-y-3">
          {/* Status och tilldelning */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className={`flex items-center gap-1.5 ${status.text}`}>
                <span className={`w-2 h-2 rounded-full ${status.dot}`} />
                {status.label}
              </span>
              {inquiry.akut && (
                <span className="flex items-center gap-1.5 text-red-400">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Akut
                </span>
              )}
              <span className="text-slate-400">{KUNDGRUPP_LABEL[inquiry.kundgrupp]}</span>
              {inquiry.forsta_kontakt_at && (
                <span className="text-slate-500">Första kontakt {formatSvTid(inquiry.forsta_kontakt_at)}</span>
              )}
            </div>
            {bokad ? (
              <div className="text-sm">
                <p className="text-xs font-medium text-slate-400 mb-1">Utfall</p>
                <p className="text-slate-300">
                  {inquiry.bokad_at ? `Ärende skapat ${formatSvTid(inquiry.bokad_at)}. ` : 'Ärende skapat. '}
                  {inquiry.status === 'bokad' && fristDatum && (
                    <>Räknas som vunnen om ärendet faktureras senast {fristDatum} ({fristDagar} dagar{inquiry.haft_offert ? ' eftersom offert har skickats' : ''}), annars som förlorad. Sätts automatiskt en gång per dygn.</>
                  )}
                  {inquiry.status === 'vunnen' && (
                    <>Vunnen: ärendet fakturerades{inquiry.fakturerad_at ? ` ${formatSvTid(inquiry.fakturerad_at)}` : ''}.</>
                  )}
                  {inquiry.status === 'forlorad' && (
                    <>Förlorad: ärendet fakturerades inte inom {fristDagar} dagar från bokningen.</>
                  )}
                </p>
              </div>
            ) : (
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1">Status</p>
              <div className="flex flex-wrap border-b border-slate-700/50">
                {MANUELLA_STATUSAR.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={sparar}
                    onClick={() => byttStatus(s)}
                    className={`px-3 py-1.5 text-sm -mb-px border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
                      inquiry.status === s
                        ? 'border-[#20c58f] text-white font-medium'
                        : 'border-transparent text-slate-400 hover:text-white'
                    }`}
                  >
                    {STATUS_CONFIG[s].label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1">Bokad sätts när ett ärende skapas. Vunnen sätts automatiskt när ärendet fakturerats.</p>
            </div>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px]">
                <label className="block text-xs font-medium text-slate-400 mb-1" htmlFor="wi-tilldelad">Tilldelad</label>
                <select
                  id="wi-tilldelad"
                  value={inquiry.tilldelad_till ?? ''}
                  disabled={sparar}
                  onChange={(e) => tilldela(e.target.value || null)}
                  className="w-full px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
                >
                  <option value="">Ingen</option>
                  {staff.map((p) => (
                    <option key={p.id} value={p.id}>{p.display_name || p.email}</option>
                  ))}
                </select>
              </div>
              {profile?.id && inquiry.tilldelad_till !== profile.id && (
                <Button variant="secondary" size="sm" disabled={sparar} onClick={() => tilldela(profile.id)}>
                  <UserPlus className="w-4 h-4 mr-1.5" />
                  Ta
                </Button>
              )}
              {arendeSokPath && !bokad && inquiry.status !== 'skrap' && (
                <Button variant="primary" size="sm" disabled={forbereder || sparar} onClick={oppnaSkapaArende}>
                  <ClipboardPlus className="w-4 h-4 mr-1.5" />
                  {forbereder ? 'Förbereder...' : 'Skapa ärende'}
                </Button>
              )}
              {arendeLank && (
                <Link to={arendeLank} className="inline-flex items-center gap-1.5 text-sm text-[#20c58f] hover:underline">
                  <ExternalLink className="w-4 h-4" />
                  Öppna ärendet
                </Link>
              )}
              {bokad && !arendeLank && <span className="text-sm text-slate-400">Ärende skapat</span>}
              {arForetag && !inquiry.lead_id && (
                <Button variant="primary" size="sm" onClick={() => setVisaSkapaLead(true)}>
                  <Target className="w-4 h-4 mr-1.5" />
                  Skapa B2B-lead
                </Button>
              )}
              {inquiry.lead_id && (
                <Link to={leadsBasePath} className="text-sm text-[#20c58f] hover:underline">
                  B2B-lead skapad, öppna Leads (B2B)
                </Link>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Kontakt */}
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-2">
                <Phone className="w-4 h-4 text-[#20c58f]" /> Kontakt
              </h3>
              <dl className="space-y-1.5 text-sm">
                <div><dt className="text-xs text-slate-400">Namn</dt><dd className="text-white">{inquiry.name}</dd></div>
                {inquiry.company_name && (
                  <div>
                    <dt className="text-xs text-slate-400">Företag</dt>
                    <dd className="text-white">{inquiry.company_name}{inquiry.organization_number ? <span className="font-mono text-slate-400"> {inquiry.organization_number}</span> : null}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-slate-400">Telefon</dt>
                  <dd><a href={`tel:${inquiry.phone}`} className="text-[#20c58f] hover:underline font-mono">{inquiry.phone}</a></dd>
                </div>
                {inquiry.email && (
                  <div>
                    <dt className="text-xs text-slate-400">E-post</dt>
                    <dd className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-500" />
                      <a href={`mailto:${inquiry.email}?subject=${encodeURIComponent(`Din förfrågan ${inquiry.referens}`)}`} className="text-[#20c58f] hover:underline break-all">{inquiry.email}</a>
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-slate-400">Adress</dt>
                  <dd className="text-white flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 mt-0.5 flex-shrink-0" />
                    <span>
                      {[inquiry.address, [inquiry.postal_code, inquiry.city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || 'Saknas'}
                      {!inquiry.omrade_tackt && <span className="block text-xs text-amber-400">Postnumret ligger utanför sajtens område</span>}
                    </span>
                  </dd>
                </div>
                {inquiry.email && (
                  <div className="text-xs text-slate-500">
                    {inquiry.kvittens_skickad_at ? `Bekräftelse skickad ${formatSvTid(inquiry.kvittens_skickad_at)}` : 'Ingen bekräftelse skickad'}
                  </div>
                )}
              </dl>
            </div>

            {/* Formulärets svar */}
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-2">
                <MessageSquare className="w-4 h-4 text-[#20c58f]" /> Förfrågan
              </h3>
              <dl className="space-y-1.5 text-sm">
                <div><dt className="text-xs text-slate-400">Tjänst</dt><dd className="text-white">{tjanstLabel(inquiry.pest_type)}</dd></div>
                {svar.map((s) => (
                  <div key={s.etikett}><dt className="text-xs text-slate-400">{s.etikett}</dt><dd className="text-white">{s.varde}</dd></div>
                ))}
                <div>
                  <dt className="text-xs text-slate-400">Meddelande</dt>
                  <dd className="text-white whitespace-pre-wrap">{inquiry.message || <span className="text-slate-500">Inget meddelande</span>}</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Bilder */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-2">
              <ImageIcon className="w-4 h-4 text-[#20c58f]" /> Bilder
            </h3>
            {bilder.length === 0 ? (
              <p className="text-sm text-slate-500">
                {inquiry.bilder.length > 0 ? 'Bilderna har inte kommit fram.' : 'Inga bilder.'}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {bilder.map((b) => (
                  <button
                    key={b.path}
                    type="button"
                    onClick={() => setStorBild(b.url)}
                    className="w-28 h-28 rounded-lg overflow-hidden border border-slate-700 hover:border-[#20c58f] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
                  >
                    <img src={b.url} alt="Bild från kunden" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Källa */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-2">
              <Globe className="w-4 h-4 text-[#20c58f]" /> Källa
            </h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
              <div><dt className="text-xs text-slate-400">Formulär</dt><dd className="text-white">{kallaLabel(inquiry)}</dd></div>
              <div><dt className="text-xs text-slate-400">Sida</dt><dd className="text-white font-mono break-all">{inquiry.sida || 'Okänd'}</dd></div>
              {inquiry.referrer && <div><dt className="text-xs text-slate-400">Kom från</dt><dd className="text-white break-all">{inquiry.referrer}</dd></div>}
              {(inquiry.utm_source || inquiry.utm_campaign || inquiry.gclid) && (
                <div>
                  <dt className="text-xs text-slate-400">Kampanj</dt>
                  <dd className="text-white break-all">
                    {[inquiry.utm_source, inquiry.utm_medium, inquiry.utm_campaign, inquiry.utm_term, inquiry.utm_content].filter(Boolean).join(' / ')}
                    {inquiry.gclid ? ' (Google Ads)' : ''}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Anteckningar och historik */}
          <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl">
            <h3 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-2">
              <History className="w-4 h-4 text-[#20c58f]" /> Anteckningar och historik
            </h3>
            <div className="flex gap-2 mb-3">
              <textarea
                value={anteckning}
                onChange={(e) => setAnteckning(e.target.value)}
                rows={2}
                maxLength={4000}
                placeholder="Skriv en anteckning, till exempel vad kunden sa i telefon"
                className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f]"
              />
              <Button variant="primary" size="sm" disabled={sparar || !anteckning.trim()} onClick={sparaAnteckning} aria-label="Spara anteckning">
                <Send className="w-4 h-4" />
              </Button>
            </div>
            {events.length === 0 ? (
              <p className="text-sm text-slate-500">Ingen historik än.</p>
            ) : (
              <ul className="space-y-2">
                {events.map((e) => (
                  <li key={e.id} className="px-3 py-2 bg-slate-800/20 border border-slate-700/50 rounded-xl text-sm">
                    <div className="flex justify-between gap-3 text-xs text-slate-400 mb-0.5">
                      <span>{namnFor(e.profile_id)}</span>
                      <span>{formatSvTid(e.created_at)}</span>
                    </div>
                    <p className="text-white whitespace-pre-wrap">
                      {handelseText(e, namnFor)}
                      {e.typ === 'konvertering' && arendeSokPath && e.till_varde?.includes(':') && (
                        <>
                          {' '}
                          <Link
                            to={`${arendeSokPath}?openCase=${e.till_varde.split(':')[1]}&caseType=${e.till_varde.startsWith('business_cases') ? 'business' : 'private'}`}
                            className="text-[#20c58f] hover:underline"
                          >
                            Öppna ärendet
                          </Link>
                        </>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Modal>

      {storBild && (
        <div
          className="fixed inset-0 z-[200] bg-black/85 flex items-center justify-center p-4"
          onClick={() => setStorBild(null)}
          role="dialog"
          aria-label="Förstorad bild"
        >
          <button type="button" onClick={() => setStorBild(null)} className="absolute top-4 right-4 text-[#fff]" aria-label="Stäng">
            <X className="w-6 h-6" />
          </button>
          <img src={storBild} alt="Bild från kunden" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}

      <CreateLeadModal
        isOpen={visaSkapaLead}
        onClose={() => setVisaSkapaLead(false)}
        onSuccess={() => undefined}
        initialData={leadData}
        onCreated={efterLead}
      />

      {arendeUnderlag && (
        <CreateCaseModal
          isOpen
          onClose={() => setArendeUnderlag(null)}
          onSuccess={() => undefined}
          technicians={arendeUnderlag.tekniker}
          initialCaseType={arendeUnderlag.typ}
          initialFormData={arendeUnderlag.falt}
          initialImages={arendeUnderlag.bilder}
          onCaseCreated={efterArende}
        />
      )}
    </>
  )
}

function handelseText(e: WebInquiryEvent, namnFor: (id: string | null) => string): string {
  switch (e.typ) {
    case 'anteckning':
      return e.text ?? ''
    case 'status': {
      const fran = e.fran_varde ? STATUS_CONFIG[e.fran_varde as WebInquiryStatus]?.label ?? e.fran_varde : ''
      const till = e.till_varde ? STATUS_CONFIG[e.till_varde as WebInquiryStatus]?.label ?? e.till_varde : ''
      return `Status ändrad från ${fran} till ${till}`
    }
    case 'tilldelning':
      return e.till_varde ? `Tilldelad ${namnFor(e.till_varde)}` : 'Tilldelningen borttagen'
    case 'konvertering':
      return e.text || 'Konverterad'
    case 'bilder':
      return e.text || 'Bilder uppladdade'
    default:
      return e.text ?? ''
  }
}
