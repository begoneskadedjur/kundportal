// src/components/tillbud/TillbudDetalj.tsx
// En rapport: vad som hände, fakta och hanteringen. Den som tar emot rapportens typ
// (incident_recipients, is_incident_recipient_of i RLS) utreder här enligt ISO-flödet:
// status, klassificering, orsaksanalys, beslutad åtgärd med ansvarig och datum,
// uppföljning och avslut, samt radering. Övriga ser rapporten och hur långt den kommit.
// Telefon: hela ytan med Tillbaka. Dator: panelen till höger om listan.

import { useEffect, useState, type ReactNode } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { Icon } from '../icons/Icon'
import { IKONKNAPP, KNAPP_PRIMAR, KNAPP_SEKUNDAR } from '../fragor/fragorUi'
import {
  INCIDENT_STATUS_CONFIG, INCIDENT_TYPE_CONFIG,
  type CaseIncident, type IncidentCategory, type IncidentStatus,
} from '../../types/caseIncidents'
import {
  STATUS_FORKLARING, STATUS_TON, TON_PUNKT, TON_RAM, berordaNamn, datum, datumTid, forsenad, kategoriText,
  nuTidsstampel, type Anstalld,
} from './tillbudLogik'
import { ETIKETT, FALT, StatusPunkt, TEXTRUTA, TypRund, VALFRITT } from './tillbudUi'

interface Props {
  incident: CaseIncident
  kanHantera: boolean
  /** Namnet som sparas som handläggare */
  hanterare: string
  anstallda: Anstalld[]
  onTillbaka?: () => void
  onAndrad: () => void
  onRaderad: () => void
}

const ARENDE_TYP_TEXT = { private: 'Privatärende', business: 'Företagsärende', contract: 'Avtalsärende' } as const

/** Kopplat ärende som text, om RLS låter oss läsa det */
function useArendeText(caseId: string | null, caseType: CaseIncident['case_type']): string | null {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    setText(null)
    if (!caseId || !caseType) return
    let avbruten = false
    ;(async () => {
      const typText = ARENDE_TYP_TEXT[caseType]
      try {
        if (caseType === 'contract') {
          const { data } = await supabase.from('cases').select('title, case_number').eq('id', caseId).maybeSingle()
          if (!avbruten) setText(data ? [data.case_number, data.title].filter(Boolean).join(' ') || typText : typText)
        } else if (caseType === 'business') {
          const { data } = await supabase.from('business_cases').select('title, case_number, company_name').eq('id', caseId).maybeSingle()
          if (!avbruten) setText(data ? [data.case_number, data.company_name || data.title].filter(Boolean).join(' ') || typText : typText)
        } else {
          const { data } = await supabase.from('private_cases').select('title, case_number').eq('id', caseId).maybeSingle()
          if (!avbruten) setText(data ? [data.case_number, data.title].filter(Boolean).join(' ') || typText : typText)
        }
      } catch {
        if (!avbruten) setText(typText)
      }
    })()
    return () => { avbruten = true }
  }, [caseId, caseType])
  return text
}

function Fakta({ etikett, children }: { etikett: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 py-2">
      <dt className="text-sm text-slate-400">{etikett}</dt>
      <dd className="text-[15px] text-white break-words">{children}</dd>
    </div>
  )
}

function Sektion({ rubrik, children }: { rubrik: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 pt-5 border-t border-slate-700/60">
      <h3 className="text-base font-semibold text-white">{rubrik}</h3>
      {children}
    </section>
  )
}

export default function TillbudDetalj({ incident, kanHantera, hanterare, anstallda, onTillbaka, onAndrad, onRaderad }: Props) {
  const typ = INCIDENT_TYPE_CONFIG[incident.type]
  const arendeText = useArendeText(incident.case_id, incident.case_type)
  const berorda = berordaNamn(incident)

  const [status, setStatus] = useState<IncidentStatus>(incident.status || 'ny')
  const [kategori, setKategori] = useState<IncidentCategory | ''>(incident.category || '')
  const [anmalan, setAnmalan] = useState<'' | 'ja' | 'nej'>(incident.authority_report || '')
  const [direkt, setDirekt] = useState(incident.immediate_action || '')
  const [varfor, setVarfor] = useState(incident.why_occurred || '')
  const [grundorsak, setGrundorsak] = useState(incident.root_cause || '')
  const [atgard, setAtgard] = useState(incident.action_taken || '')
  const [ansvarig, setAnsvarig] = useState(incident.responsible_name || '')
  const [klartTill, setKlartTill] = useState(incident.due_date || '')
  const [uppfoljning, setUppfoljning] = useState(incident.follow_up || '')
  const [sparar, setSparar] = useState(false)
  const [fragaRadera, setFragaRadera] = useState(false)
  const [raderar, setRaderar] = useState(false)

  const spara = async () => {
    if (status === 'avslutad' && !uppfoljning.trim()) {
      toast.error('Fyll i uppföljningen innan rapporten avslutas')
      return
    }
    setSparar(true)
    try {
      const hanterad = status !== 'ny'
      const avslutad = status === 'avslutad'
      const nu = nuTidsstampel()
      const { error } = await supabase
        .from('case_incidents')
        .update({
          status,
          category: kategori || null,
          authority_report: anmalan || null,
          immediate_action: direkt.trim() || null,
          why_occurred: varfor.trim() || null,
          root_cause: grundorsak.trim() || null,
          action_taken: atgard.trim() || null,
          responsible_name: ansvarig || null,
          due_date: klartTill || null,
          follow_up: uppfoljning.trim() || null,
          handled_by_name: hanterad ? hanterare : null,
          handled_at: hanterad ? nu : null,
          closed_at: avslutad ? (incident.closed_at || nu) : null,
          closed_by_name: avslutad ? (incident.closed_by_name || hanterare) : null,
          updated_at: nu,
        })
        .eq('id', incident.id)
      if (error) throw error
      toast.success(avslutad ? 'Rapporten är avslutad' : 'Rapporten är sparad')
      onAndrad()
    } catch (err) {
      console.error('Kunde inte spara rapporten:', err)
      toast.error('Kunde inte spara. Det du skrivit ligger kvar.')
    } finally {
      setSparar(false)
    }
  }

  // Radering: mottagare av typen och admin/koordinator, RLS skyddar i botten
  const radera = async () => {
    setRaderar(true)
    try {
      await supabase.from('incident_employees').delete().eq('incident_id', incident.id)
      const { error, count } = await supabase.from('case_incidents').delete({ count: 'exact' }).eq('id', incident.id)
      if (error) throw error
      if (!count) throw new Error('Du saknar behörighet att radera rapporten')
      toast.success('Rapporten är raderad')
      onRaderad()
    } catch (err) {
      console.error('Kunde inte radera rapporten:', err)
      toast.error(err instanceof Error ? err.message : 'Kunde inte radera rapporten')
      setRaderar(false)
      setFragaRadera(false)
    }
  }

  const visaAnmalanTips = (incident.type === 'olycka' || incident.type === 'tillbud') && anmalan === ''
  const harHantering = !!(incident.action_taken || incident.responsible_name || incident.follow_up || incident.closed_at || incident.handled_by_name)

  return (
    <article aria-labelledby="tillbud-detalj-rubrik" className="rounded-2xl border border-slate-700 bg-slate-900 flex flex-col">
      <header className="flex items-start gap-3 px-5 pt-4 pb-4">
        {onTillbaka && (
          <button type="button" onClick={onTillbaka} aria-label="Tillbaka till listan" className={`${IKONKNAPP} -ml-2`}>
            <Icon name="rapport.tillbaka" size={20} />
          </button>
        )}
        <TypRund typ={incident.type} stor />
        <div className="min-w-0 flex-1">
          <h2 id="tillbud-detalj-rubrik" className="text-lg font-semibold text-white leading-tight">
            {typ.exclamation} {typ.label}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusPunkt status={incident.status} />
            <span className="font-mono text-sm text-slate-400">{datumTid(incident.occurred_at)}</span>
          </div>
        </div>
      </header>

      <div className="px-5 pb-5 flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-slate-400">Vad har hänt?</h3>
          <p className="text-[15px] leading-relaxed text-white whitespace-pre-wrap break-words">{incident.description}</p>
        </section>

        {!kanHantera && incident.immediate_action && (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-slate-400">Vad har ni redan gjort?</h3>
            <p className="text-[15px] leading-relaxed text-white whitespace-pre-wrap break-words">{incident.immediate_action}</p>
          </section>
        )}

        <dl className="divide-y divide-slate-700/60 border-y border-slate-700/60">
          <Fakta etikett="Inträffade">{datumTid(incident.occurred_at)}</Fakta>
          <Fakta etikett="Rapportör">{incident.reported_by_name}</Fakta>
          {berorda && <Fakta etikett="Berörda">{berorda}</Fakta>}
          {incident.case_id && <Fakta etikett="Ärende">{arendeText || '...'}</Fakta>}
          {incident.category && <Fakta etikett="Kategori">{kategoriText(incident.category)}</Fakta>}
        </dl>

        {!kanHantera && (
          <Sektion rubrik="Hanteringen">
            <p className="text-[15px] leading-relaxed text-slate-300">{STATUS_FORKLARING[incident.status]}</p>
            {harHantering && (
              <dl className="divide-y divide-slate-700/60 border-y border-slate-700/60">
                {incident.action_taken && <Fakta etikett="Beslutad åtgärd">{incident.action_taken}</Fakta>}
                {incident.responsible_name && <Fakta etikett="Ansvarig">{incident.responsible_name}</Fakta>}
                {incident.due_date && (
                  <Fakta etikett="Klart till">
                    <span className={forsenad(incident) ? 'text-red-400' : ''}>{datum(incident.due_date)}{forsenad(incident) ? ', försenad' : ''}</span>
                  </Fakta>
                )}
                {incident.follow_up && <Fakta etikett="Uppföljning">{incident.follow_up}</Fakta>}
                {incident.closed_at && <Fakta etikett="Avslutad">{datum(incident.closed_at)}{incident.closed_by_name ? ` av ${incident.closed_by_name}` : ''}</Fakta>}
                {!incident.closed_at && incident.handled_by_name && (
                  <Fakta etikett="Handläggare">{incident.handled_by_name}{incident.handled_at ? `, ${datum(incident.handled_at)}` : ''}</Fakta>
                )}
              </dl>
            )}
          </Sektion>
        )}

        {kanHantera && (
          <>
            <Sektion rubrik="Status">
              <div role="radiogroup" aria-label="Status" className="grid grid-cols-2 gap-2">
                {(Object.keys(INCIDENT_STATUS_CONFIG) as IncidentStatus[]).map(s => {
                  const vald = status === s
                  const ton = STATUS_TON[s]
                  return (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={vald}
                      onClick={() => setStatus(s)}
                      className={`min-h-[48px] flex items-center gap-2 px-3 rounded-xl border text-left text-[15px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${
                        vald ? `${TON_RAM[ton]} text-white font-semibold` : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span aria-hidden="true" className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${TON_PUNKT[ton]}`} />
                      {INCIDENT_STATUS_CONFIG[s].label}
                    </button>
                  )
                })}
              </div>
              <p className="text-sm text-slate-400">{STATUS_FORKLARING[status]}</p>
            </Sektion>

            <Sektion rubrik="Direktåtgärd">
              <div>
                <label htmlFor="td-direkt" className={ETIKETT}>Vad har vi redan gjort?</label>
                <textarea id="td-direkt" value={direkt} onChange={e => setDirekt(e.target.value)} rows={2} placeholder="Omedelbara åtgärder på plats" className={TEXTRUTA} />
              </div>
            </Sektion>

            <Sektion rubrik="Klassificering">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="td-kategori" className={ETIKETT}>Miljö, kvalitet eller arbetsmiljö?</label>
                  <select id="td-kategori" value={kategori} onChange={e => setKategori(e.target.value as IncidentCategory | '')} className={FALT}>
                    <option value="">Välj kategori</option>
                    <option value="miljo">Miljö</option>
                    <option value="kvalitet">Kvalitet</option>
                    <option value="arbetsmiljo">Arbetsmiljö</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="td-anmalan" className={ETIKETT}>Ska anmälan göras till anmalarbetsskada.se?</label>
                  <select id="td-anmalan" value={anmalan} onChange={e => setAnmalan(e.target.value as '' | 'ja' | 'nej')} className={FALT}>
                    <option value="">Inte bedömt</option>
                    <option value="ja">Ja</option>
                    <option value="nej">Nej</option>
                  </select>
                </div>
              </div>
              {visaAnmalanTips && (
                <p className="flex items-start gap-2 text-sm text-amber-500">
                  <Icon name="tillbud.myndighet" size={16} className="flex-shrink-0 mt-0.5" />
                  Bedöm anmälningsplikten. Allvarlig olycka eller allvarligt tillbud ska anmälas utan dröjsmål.
                </p>
              )}
              {anmalan === 'ja' && (
                <a href="https://anmalarbetsskada.se" target="_blank" rel="noopener noreferrer" className={`${KNAPP_SEKUNDAR} self-start`}>
                  <Icon name="tillbud.myndighet" size={20} />
                  Gör anmälan på anmalarbetsskada.se
                  <Icon name="rapport.oppna" size={16} className="text-slate-400" />
                </a>
              )}
            </Sektion>

            <Sektion rubrik="Orsaksanalys">
              <div>
                <label htmlFor="td-varfor" className={ETIKETT}>Varför inträffade händelsen? <span className={VALFRITT}>(direkt orsak)</span></label>
                <textarea id="td-varfor" value={varfor} onChange={e => setVarfor(e.target.value)} rows={2} placeholder="Till exempel att skyddshandskar inte användes vid uppackning med kniv" className={TEXTRUTA} />
              </div>
              <div>
                <label htmlFor="td-grund" className={ETIKETT}>Vad är grundorsaken till problemet?</label>
                <textarea id="td-grund" value={grundorsak} onChange={e => setGrundorsak(e.target.value)} rows={2} placeholder="Bakomliggande orsak, till exempel att rutin saknas, ovana eller fel på utrustning" className={TEXTRUTA} />
              </div>
            </Sektion>

            <Sektion rubrik="Beslutad åtgärd">
              <div>
                <label htmlFor="td-atgard" className={ETIKETT}>Vad ska göras för att det inte ska hända igen?</label>
                <textarea id="td-atgard" value={atgard} onChange={e => setAtgard(e.target.value)} rows={3} placeholder="Korrigerande och förebyggande åtgärder" className={TEXTRUTA} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="td-ansvarig" className={ETIKETT}>Ansvarig</label>
                  <select id="td-ansvarig" value={ansvarig} onChange={e => setAnsvarig(e.target.value)} className={FALT}>
                    <option value="">Välj ansvarig</option>
                    {ansvarig && !anstallda.some(a => a.name === ansvarig) && <option value={ansvarig}>{ansvarig}</option>}
                    {anstallda.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="td-klart" className={ETIKETT}>Klart till</label>
                  <input id="td-klart" type="date" value={klartTill} onChange={e => setKlartTill(e.target.value)} className={FALT} />
                </div>
              </div>
            </Sektion>

            <Sektion rubrik="Uppföljning">
              <div>
                <label htmlFor="td-uppf" className={ETIKETT}>Är åtgärden genomförd och tillräcklig? <span className={VALFRITT}>(krävs för att avsluta)</span></label>
                <textarea id="td-uppf" value={uppfoljning} onChange={e => setUppfoljning(e.target.value)} rows={2} placeholder="Utvärdera effekten av åtgärden innan rapporten avslutas" className={TEXTRUTA} />
              </div>
              {incident.closed_at && (
                <p className="text-sm text-slate-400">Avslutad {datum(incident.closed_at)}{incident.closed_by_name ? ` av ${incident.closed_by_name}` : ''}</p>
              )}
              {incident.handled_by_name && (
                <p className="text-sm text-slate-400">Senast hanterad av {incident.handled_by_name}{incident.handled_at ? `, ${datum(incident.handled_at)}` : ''}</p>
              )}
            </Sektion>
          </>
        )}
      </div>

      {kanHantera && (
        <footer className="px-5 py-4 border-t border-slate-700/60 flex flex-col gap-3">
          {fragaRadera ? (
            <div role="alertdialog" aria-label="Radera rapporten" className="flex flex-col gap-3 p-3 rounded-xl border border-red-500/40 bg-red-500/10">
              <p className="text-[15px] text-white">Radera rapporten för alltid? Det går inte att ångra.</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button type="button" onClick={radera} disabled={raderar} className="h-11 px-4 inline-flex items-center justify-center gap-2 rounded-xl bg-red-500 text-[#fff] text-[15px] font-semibold hover:bg-red-600 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
                  {raderar ? <Icon name="allman.laddar" size={20} className="animate-spin" /> : <Icon name="allman.radera" size={20} />}
                  Ja, radera
                </button>
                <button type="button" onClick={() => setFragaRadera(false)} disabled={raderar} className={KNAPP_SEKUNDAR}>Nej, behåll</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-2">
              <button type="button" onClick={() => setFragaRadera(true)} className="h-11 px-3 inline-flex items-center justify-center gap-2 rounded-xl text-[15px] text-red-400 hover:bg-red-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400 sm:mr-auto">
                <Icon name="allman.radera" size={20} />
                Radera
              </button>
              <button type="button" onClick={spara} disabled={sparar} className={KNAPP_PRIMAR}>
                {sparar ? <Icon name="allman.laddar" size={20} className="animate-spin" /> : <Icon name="allman.bock" size={20} />}
                {status === 'avslutad' ? 'Spara och avsluta' : 'Spara'}
              </button>
            </div>
          )}
        </footer>
      )}
    </article>
  )
}
