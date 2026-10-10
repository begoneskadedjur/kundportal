// src/components/admin/leads/SkapaLeadModal.tsx
// Leads etapp 5: skapa en lead från ett engångsärende på 15 sekunder (desktop och mobil).
// Allt som ärendet vet följer med (RPC lead_fran_arende förifyller i databasen). Användaren väljer
// bara vad det gäller och skriver en rad. Finns en öppen lead med samma org.nr, telefon eller e-post
// föreslås att tipset läggs som anteckning där i stället (RPC lead_anteckning_fran_arende).
// Valen är radiorader, aldrig piller. Modalen ritas i en egen portal ovanpå ärendemodalen.

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import Modal from '../../ui/Modal'
import Portal from '../../ui/Portal'
import Button from '../../ui/Button'
import { Icon } from '../../icons/Icon'
import { LeadService } from '../../../services/leadService'
import {
  GALLER_FORETAG,
  GALLER_PRIVAT,
  STAGE_ETIKETT,
  type LeadArendeUnderlag,
  type LeadFranArendeSvar,
  type LeadGaller,
} from '../../../types/leads'
import { ETIKETT, FALT, SEKTION } from './leadLogik'

interface Props {
  isOpen: boolean
  underlag: LeadArendeUnderlag
  /** Rollens leadssida, t.ex. /technician/leads */
  leadsSida: string
  onClose: () => void
  onKlar: (svar: LeadFranArendeSvar) => void
}

export default function SkapaLeadModal({ isOpen, underlag, leadsSida, onClose, onKlar }: Props) {
  const foretagsarende = underlag.case_type === 'business_cases'
  const val = foretagsarende ? GALLER_FORETAG : GALLER_PRIVAT
  const [galler, setGaller] = useState<LeadGaller | null>(null)
  const [foretag, setForetag] = useState('')
  const [text, setText] = useState('')
  const [forsokt, setForsokt] = useState(false)
  const [sparar, setSparar] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setGaller(null)
    setForetag('')
    setText('')
    setForsokt(false)
  }, [isOpen])

  const kraverNamn = galler === 'forening' || galler === 'foretag'
  const fel = {
    galler: !galler,
    foretag: kraverNamn && !foretag.trim(),
    text: !text.trim(),
  }
  const harFel = fel.galler || fel.foretag || fel.text

  const kund = foretagsarende ? underlag.foretag || underlag.kontakt || 'Företag utan namn' : underlag.kontakt || 'Privatperson'
  const ursprung = [underlag.adress, `${foretagsarende ? 'företagsärende' : 'privat engångsärende'} ${underlag.case_number ?? ''}`.trim()]
    .filter(Boolean)
    .join(' · ')
  const oppnaDubbletter = underlag.dubbletter

  const skapa = async () => {
    setForsokt(true)
    if (harFel || !galler) return
    setSparar(true)
    try {
      const svar = await LeadService.franArende(underlag.case_type, underlag.case_id, galler, text, kraverNamn ? foretag : null)
      const url = `${leadsSida}?id=${svar.lead_id}`
      toast.success(
        () => (
          <span>
            {svar.skapad ? 'Leaden är skapad' : 'Ärendet har redan en lead'} ·{' '}
            {svar.kan_oppna ? <a href={url} className="underline">Öppna {svar.company_name}</a> : svar.company_name}
          </span>
        ),
        { duration: 6000 },
      )
      onKlar(svar)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Leaden kunde inte skapas')
    } finally {
      setSparar(false)
    }
  }

  const anteckningPa = async (leadId: string) => {
    setForsokt(true)
    if (!text.trim()) return
    setSparar(true)
    try {
      await LeadService.anteckningFranArende(leadId, underlag.case_type, underlag.case_id, text)
      toast.success('Tipset ligger som anteckning på den befintliga leaden')
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Anteckningen kunde inte sparas')
    } finally {
      setSparar(false)
    }
  }

  const footer = (
    <div className="flex items-center justify-end gap-2 px-4 py-2.5">
      <Button variant="ghost" size="sm" onClick={onClose} disabled={sparar}>Avbryt</Button>
      <Button variant="primary" size="sm" onClick={() => void skapa()} loading={sparar}>
        {oppnaDubbletter.length > 0 ? 'Skapa ny lead ändå' : 'Skicka lead'}
      </Button>
    </div>
  )

  return (
    <Portal>
      <Modal isOpen={isOpen} onClose={onClose} title="Skapa lead" subtitle={kund} size="md" footer={footer} mobilHelskarm zIndex={10000}>
        <div className="p-4 space-y-3">
          {/* Kunden och dubblettstatus */}
          <div className={SEKTION}>
            <p className="text-sm text-white font-medium flex items-center gap-1.5">
              <Icon name={foretagsarende ? 'allman.foretag' : 'arende.privat'} size={16} className="text-[#20c58f]" />
              {kund}
            </p>
            {ursprung && <p className="text-xs text-slate-400 mt-0.5">{ursprung}</p>}
            {oppnaDubbletter.length === 0 ? (
              <p className="text-xs text-slate-300 mt-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#20c58f]" />
                Ingen öppen lead {underlag.org_nr ? `på ${underlag.org_nr}` : 'med samma telefon eller e-post'}
              </p>
            ) : (
              <div className="mt-2 pt-2 border-t border-slate-700/50 space-y-2">
                <p className="text-xs text-amber-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Det finns {oppnaDubbletter.length === 1 ? 'en öppen lead' : 'öppna leads'} med samma uppgifter. Lägg tipset som anteckning där i stället?
                </p>
                <ul className="space-y-1.5">
                  {oppnaDubbletter.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="text-slate-200 min-w-0">
                        {d.company_name}
                        <span className="text-slate-400"> · {STAGE_ETIKETT[d.stage]} · samma {d.traff}{d.agare ? ` · ${d.agare}` : ''}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        {d.kan_oppna && (
                          <a href={`${leadsSida}?id=${d.id}`} className="text-xs text-[#20c58f] hover:underline">Öppna</a>
                        )}
                        <Button variant="secondary" size="sm" onClick={() => void anteckningPa(d.id)} disabled={sparar}>
                          Lägg anteckning där
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Vad gäller det? */}
          <fieldset className={`${SEKTION} ${forsokt && fel.galler ? 'border-red-500/50' : ''}`}>
            <legend className="sr-only">Vad gäller det?</legend>
            <p className={ETIKETT}>Vad gäller det? *</p>
            <div className="divide-y divide-slate-700/50">
              {val.map((v) => (
                <label key={v.varde} className="flex items-start gap-3 py-2 cursor-pointer">
                  <input
                    type="radio"
                    name="lead-galler"
                    value={v.varde}
                    checked={galler === v.varde}
                    onChange={() => setGaller(v.varde)}
                    className="mt-0.5 h-4 w-4 text-[#20c58f] focus:ring-[#20c58f] bg-slate-900 border-slate-600"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm text-white">{v.etikett}</span>
                    <span className="block text-xs text-slate-400">{v.hjalp}</span>
                  </span>
                </label>
              ))}
            </div>
            {forsokt && fel.galler && <p className="text-xs text-red-400 mt-1">Välj vad det gäller.</p>}
          </fieldset>

          <div className={`${SEKTION} space-y-3`}>
            {kraverNamn && (
              <div>
                <label className={ETIKETT} htmlFor="skapa-lead-foretag">{galler === 'forening' ? 'Förening' : 'Företag'} *</label>
                <input
                  id="skapa-lead-foretag"
                  className={`${FALT} ${forsokt && fel.foretag ? 'border-red-500/60' : ''}`}
                  value={foretag}
                  onChange={(e) => setForetag(e.target.value)}
                  placeholder={galler === 'forening' ? 'Till exempel Brf Tallbacken' : 'Till exempel Lindqvists Bygg AB'}
                />
              </div>
            )}
            <div>
              <label className={ETIKETT} htmlFor="skapa-lead-text">Vad såg du? *</label>
              <textarea
                id="skapa-lead-text"
                rows={3}
                maxLength={2000}
                className={`${FALT} ${forsokt && fel.text ? 'border-red-500/60' : ''}`}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={foretagsarende ? 'Till exempel råttor även i lagret, vill ha stationer där också' : 'Till exempel fler lägenheter i huset har möss'}
              />
            </div>
          </div>

          {/* Det som följer med */}
          <div className="text-xs text-slate-400 space-y-0.5 px-1">
            <p className="flex items-center gap-1.5">
              <Icon name="allman.blixt" size={16} className="text-slate-500" />
              Från ärendet följer med: {[
                kraverNamn ? 'kontaktperson' : foretagsarende ? 'företag' : 'namn',
                foretagsarende && underlag.org_nr ? 'org.nr' : null,
                underlag.telefon ? 'telefon' : null,
                underlag.epost ? 'e-post' : null,
                underlag.adress ? 'adress' : null,
                underlag.skadedjur ? 'skadedjur' : null,
              ].filter(Boolean).join(', ')}.
            </p>
            <p className="flex items-center gap-1.5">
              <Icon name="lead.tipsare" size={16} className="text-slate-500" />
              Du står som tipsare.
            </p>
          </div>
        </div>
      </Modal>
    </Portal>
  )
}
