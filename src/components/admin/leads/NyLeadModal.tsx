// src/components/admin/leads/NyLeadModal.tsx
// Ny lead: fem fält (företag eller namn, kontakt, telefon eller e-post, källa, nästa steg med datum) plus
// ägare (förvald jag) och valfri årspremie. Före sparande körs dubblettkontrollen (RPC lead_dubbletter på
// org.nr, telefon och e-post); finns en träff föreslås att öppna den i stället.
// Tekniker blir tipsare på det de skapar. En anställd som inte är admin/koordinator och väljer en annan
// ägare står som tipsare (RLS kräver att man äger eller tipsat det man skapar).
// Används från Leads (B2B) och från Leads (Webb) (förifyllt från förfrågan, web_inquiry_id sätts).

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import Modal from '../../ui/Modal'
import Button from '../../ui/Button'
import Select from '../../ui/Select'
import DateField from '../../ui/DateField'
import { Icon } from '../../icons/Icon'
import { LeadService, type LeadNy } from '../../../services/leadService'
import type { Lead } from '../../../types/database'
import { KALLA_ETIKETT, LEAD_KALLOR, STAGE_ETIKETT, type LeadDubblett, type LeadPerson, type LeadSource } from '../../../types/leads'
import { DATUMFALT, ETIKETT, FALT, SEKTION, forslagNastaDag, fransLokal } from './leadLogik'

export interface NyLeadForval extends Partial<LeadNy> {
  /** Text i anteckningen (notes) */
  notes?: string | null
}

interface Props {
  isOpen: boolean
  onClose: () => void
  personal: LeadPerson[]
  minProfilId: string | null
  arLeadAdmin: boolean
  arTekniker: boolean
  forval?: NyLeadForval
  onSkapad: (lead: Lead) => void
  /** Öppna en befintlig lead (dubblett) i stället. Saknas den visas bara namnet. */
  onOppnaBefintlig?: (id: string) => void
}

const INGEN = 'ingen'

export default function NyLeadModal({ isOpen, onClose, personal, minProfilId, arLeadAdmin, arTekniker, forval, onSkapad, onOppnaBefintlig }: Props) {
  const [foretag, setForetag] = useState('')
  const [kontakt, setKontakt] = useState('')
  const [telefon, setTelefon] = useState('')
  const [epost, setEpost] = useState('')
  const [orgnr, setOrgnr] = useState('')
  const [kalla, setKalla] = useState<LeadSource | ''>('')
  const [nasta, setNasta] = useState('')
  const [nastaNar, setNastaNar] = useState('')
  const [agare, setAgare] = useState('')
  const [varde, setVarde] = useState('')
  const [sparar, setSparar] = useState(false)
  const [dubbletter, setDubbletter] = useState<LeadDubblett[] | null>(null)
  const [forsokt, setForsokt] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setForetag(forval?.company_name ?? '')
    setKontakt(forval?.contact_person ?? '')
    setTelefon(forval?.phone_number ?? '')
    setEpost(forval?.email ?? '')
    setOrgnr(forval?.organization_number ?? '')
    setKalla(forval?.source ?? (arTekniker ? 'tekniker_tips' : ''))
    setNasta(forval?.next_action ?? (arTekniker ? '' : 'Ring och presentera oss'))
    setNastaNar(arTekniker ? '' : forslagNastaDag())
    setAgare(minProfilId ?? INGEN)
    setVarde(forval?.estimated_value != null ? String(forval.estimated_value) : '')
    setDubbletter(null)
    setForsokt(false)
    setSparar(false)
    // Fälten fylls bara när modalen öppnas, inte när föräldern ritar om
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const agarVal = useMemo(
    () => [
      ...(minProfilId ? [{ value: minProfilId, label: 'Jag' }] : []),
      { value: INGEN, label: 'Ingen ägare än (koordinatorn fördelar)' },
      ...personal.filter((p) => p.aktiv && p.id !== minProfilId).map((p) => ({ value: p.id, label: p.namn })),
    ],
    [personal, minProfilId],
  )

  const harAgare = agare !== INGEN && !!agare
  const fel = {
    foretag: !foretag.trim(),
    kontaktvag: !telefon.trim() && !epost.trim(),
    kalla: !kalla,
    // En lead med ägare ska ha ett nästa steg; ett tips utan ägare får sakna det
    nasta: harAgare && (!nasta.trim() || !nastaNar),
    varde: !!varde.trim() && !/^\d[\d\s]*$/.test(varde.trim()),
  }
  const ogiltig = Object.values(fel).some(Boolean)

  const spara = async (ignoreraDubbletter = false) => {
    setForsokt(true)
    if (ogiltig || !kalla) return
    setSparar(true)
    try {
      if (!ignoreraDubbletter) {
        const traffar = await LeadService.dubbletter(orgnr, telefon, epost)
        if (traffar.length > 0) {
          setDubbletter(traffar)
          setSparar(false)
          return
        }
      }
      const agareId = harAgare ? agare : null
      const tipsare =
        forval?.tipped_by_profile_id ??
        (arTekniker || (!arLeadAdmin && agareId !== minProfilId) ? minProfilId : null)
      const rad: LeadNy = {
        ...forval,
        company_name: foretag.trim(),
        contact_person: kontakt.trim() || null,
        phone_number: telefon.trim() || null,
        email: epost.trim() || null,
        organization_number: orgnr.trim() || null,
        source: kalla,
        next_action: nasta.trim() || null,
        next_action_at: nastaNar ? fransLokal(nastaNar) : null,
        owner_profile_id: agareId,
        tipped_by_profile_id: tipsare,
        estimated_value: varde.trim() ? Number(varde.replace(/\s/g, '')) : null,
        customer_group: forval?.customer_group ?? 'foretag',
        stage: 'ny',
        created_by: minProfilId ?? undefined,
      }
      const lead = await LeadService.create(rad)
      toast.success(agareId || !tipsare ? 'Leaden är skapad' : 'Tipset är skickat')
      onSkapad(lead)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Leaden kunde inte skapas')
    } finally {
      setSparar(false)
    }
  }

  const visaFel = (f: boolean) => forsokt && f

  const footer = (
    <div className="flex items-center justify-end gap-2 px-4 py-2.5">
      <Button variant="ghost" size="sm" onClick={onClose} disabled={sparar}>Avbryt</Button>
      <Button variant="primary" size="sm" onClick={() => void spara(false)} loading={sparar}>
        {arTekniker && !harAgare ? 'Skicka tips' : 'Skapa lead'}
      </Button>
    </div>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={arTekniker ? 'Nytt tips eller lead' : 'Ny lead'}
      subtitle="Resten fyller du i på leaden efteråt"
      size="md"
      footer={footer}
      mobilHelskarm
    >
      <div className="p-4 space-y-3">
        {dubbletter && dubbletter.length > 0 && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/40 rounded-xl text-sm space-y-2">
            <p className="text-amber-300 font-medium flex items-center gap-1.5">
              <Icon name="lead.lead" size={16} />
              Det finns redan {dubbletter.length === 1 ? 'en lead' : 'leads'} med samma uppgifter
            </p>
            <ul className="space-y-1.5">
              {dubbletter.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-slate-200">
                    {d.company_name}
                    <span className="text-slate-400"> · {STAGE_ETIKETT[d.stage]} · samma {d.traff}{d.agare ? ` · ${d.agare}` : ''}</span>
                  </span>
                  {d.kan_oppna && onOppnaBefintlig ? (
                    <Button variant="secondary" size="sm" onClick={() => onOppnaBefintlig(d.id)}>Öppna den</Button>
                  ) : (
                    <span className="text-xs text-slate-500">Be ägaren dela den med dig</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="pt-2 border-t border-amber-500/20 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => void spara(true)} disabled={sparar}>Skapa ändå</Button>
            </div>
          </div>
        )}

        <div className={`${SEKTION} space-y-3`}>
          <div>
            <label className={ETIKETT} htmlFor="ny-foretag">Företag eller namn *</label>
            <input id="ny-foretag" autoFocus className={`${FALT} ${visaFel(fel.foretag) ? 'border-red-500/60' : ''}`} value={foretag} onChange={(e) => setForetag(e.target.value)} placeholder="Till exempel Kvarnen Livs AB" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={ETIKETT} htmlFor="ny-kontakt">Kontaktperson</label>
              <input id="ny-kontakt" className={FALT} value={kontakt} onChange={(e) => setKontakt(e.target.value)} />
            </div>
            <div>
              <label className={ETIKETT} htmlFor="ny-orgnr">Org.nr (valfritt)</label>
              <input id="ny-orgnr" className={`${FALT} font-mono`} value={orgnr} onChange={(e) => setOrgnr(e.target.value)} placeholder="ÅÅMMDD-NNNN" />
            </div>
            <div>
              <label className={ETIKETT} htmlFor="ny-telefon">Telefon</label>
              <input id="ny-telefon" type="tel" className={`${FALT} ${visaFel(fel.kontaktvag) ? 'border-red-500/60' : ''}`} value={telefon} onChange={(e) => setTelefon(e.target.value)} />
            </div>
            <div>
              <label className={ETIKETT} htmlFor="ny-epost">E-post</label>
              <input id="ny-epost" type="email" className={`${FALT} ${visaFel(fel.kontaktvag) ? 'border-red-500/60' : ''}`} value={epost} onChange={(e) => setEpost(e.target.value)} />
            </div>
          </div>
          {visaFel(fel.kontaktvag) && <p className="text-xs text-red-400">Fyll i telefon eller e-post.</p>}
          <div>
            <Select
              label="Källa *"
              value={kalla}
              onChange={(v) => setKalla(v as LeadSource)}
              options={LEAD_KALLOR.map((k) => ({ value: k, label: KALLA_ETIKETT[k] }))}
              placeholder="Var kommer leaden från?"
              error={visaFel(fel.kalla) ? 'Välj källa' : undefined}
            />
          </div>
        </div>

        <div className={`${SEKTION} space-y-3`}>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_190px] gap-3">
            <div>
              <label className={ETIKETT} htmlFor="ny-nasta">Nästa steg{harAgare ? ' *' : ''}</label>
              <input id="ny-nasta" className={`${FALT} ${visaFel(fel.nasta && !nasta.trim()) ? 'border-red-500/60' : ''}`} value={nasta} onChange={(e) => setNasta(e.target.value)} placeholder="Till exempel Ring och boka besök" maxLength={300} />
            </div>
            <div>
              <label className={ETIKETT} htmlFor="ny-nasta-nar">Datum och tid{harAgare ? ' *' : ''}</label>
              <DateField id="ny-nasta-nar" withTime value={nastaNar} onChange={setNastaNar} className={`${DATUMFALT} ${visaFel(fel.nasta && !nastaNar) ? 'border-red-500/60' : ''}`} placeholder="ÅÅÅÅ-MM-DD HH:mm" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select label="Ägare" value={agare} onChange={setAgare} options={agarVal} />
            <div>
              <label className={ETIKETT} htmlFor="ny-varde">Årspremie i kr (valfritt)</label>
              <input id="ny-varde" inputMode="numeric" className={`${FALT} font-mono ${visaFel(fel.varde) ? 'border-red-500/60' : ''}`} value={varde} onChange={(e) => setVarde(e.target.value)} placeholder="48 000" />
            </div>
          </div>
          {!harAgare && (
            <p className="text-xs text-slate-400">Utan ägare hamnar leaden under Nya tips där koordinatorn fördelar den.</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
