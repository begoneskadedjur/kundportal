// src/components/admin/leads/NyLeadModal.tsx
// Ny lead och Tips om ny kund (2026-10-24, samma formspråk som Ny ticket). Fyra frågor i ordning:
//   1 Vem gäller det?      Företag eller namn *, Kontaktperson
//   2 Vad gäller det?      sparas i leads.notes (Beskrivning och behov i leaden). Krävs för tekniker.
//   3 Hur når vi dem?      Telefon eller E-post (minst en)
//   4 Vem tar det vidare?  Koordinatorn fördelar (ingen ägare), Jag eller En kollega. Med ägare
//                          behövs Nästa steg och Datum och tid; de fylls i med förslag direkt
//                          (Ring och presentera oss, nästa vardag 09:00) och förklaras i rutan.
// Plus Källa * för kontoret (teknikerns tips är alltid Teknikertips) och hopfällt Fler uppgifter
// (org.nr och årspremie). Fel visas alltid som text under fältet.
// Tekniker börjar på Koordinatorn fördelar, övriga på Jag.
// Före sparande körs dubblettkontrollen (RPC lead_dubbletter på org.nr, telefon och e-post); finns
// en träff föreslås att öppna den i stället.
// Tekniker blir tipsare på det de skapar. En anställd som inte är admin/koordinator och väljer en annan
// ägare står som tipsare (RLS kräver att man äger eller tipsat det man skapar).
// Används från Leads och tips och från Leads (Webb) (förifyllt från förfrågan, web_inquiry_id sätts).

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import Modal from '../../ui/Modal'
import DateField from '../../ui/DateField'
import { Icon, type IconName } from '../../icons/Icon'
import { LeadService, type LeadNy } from '../../../services/leadService'
import type { Lead } from '../../../types/database'
import { KALLA_ETIKETT, LEAD_KALLOR, STAGE_ETIKETT, type LeadDubblett, type LeadPerson, type LeadSource } from '../../../types/leads'
import {
  DATUMFALT, ETIKETT, FALT, FELTEXT, HJALPTEXT, KNAPP_PRIMAR, KNAPP_SEKUNDAR, KNAPP_TEXT,
  faltFel, forslagNastaDag, fransLokal, valKort,
} from './leadLogik'

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

type Vem = 'ingen' | 'jag' | 'kollega'

const FORSLAG_NASTA = 'Ring och presentera oss'

function StegRubrik({ nr, text }: { nr: number; text: string }) {
  return (
    <h3 className="flex items-center gap-2 text-base font-semibold text-white">
      <span aria-hidden="true" className="w-7 h-7 rounded-full border border-slate-600 text-sm font-semibold text-slate-300 flex items-center justify-center font-mono">{nr}</span>
      {text}
    </h3>
  )
}

export default function NyLeadModal({ isOpen, onClose, personal, minProfilId, arLeadAdmin, arTekniker, forval, onSkapad, onOppnaBefintlig }: Props) {
  const [foretag, setForetag] = useState('')
  const [kontakt, setKontakt] = useState('')
  const [vad, setVad] = useState('')
  const [telefon, setTelefon] = useState('')
  const [epost, setEpost] = useState('')
  const [orgnr, setOrgnr] = useState('')
  const [kalla, setKalla] = useState<LeadSource | ''>('')
  const [vem, setVem] = useState<Vem>('jag')
  const [kollega, setKollega] = useState('')
  const [nasta, setNasta] = useState('')
  const [nastaNar, setNastaNar] = useState('')
  const [varde, setVarde] = useState('')
  const [visaMer, setVisaMer] = useState(false)
  const [sparar, setSparar] = useState(false)
  const [dubbletter, setDubbletter] = useState<LeadDubblett[] | null>(null)
  const [forsokt, setForsokt] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setForetag(forval?.company_name ?? '')
    setKontakt(forval?.contact_person ?? '')
    setVad(forval?.notes ?? '')
    setTelefon(forval?.phone_number ?? '')
    setEpost(forval?.email ?? '')
    setOrgnr(forval?.organization_number ?? '')
    setKalla(forval?.source ?? (arTekniker ? 'tekniker_tips' : ''))
    // Teknikern lämnar oftast ett tips som koordinatorn fördelar; kontoret tar oftast leaden själv
    setVem(arTekniker || !minProfilId ? 'ingen' : 'jag')
    setKollega('')
    setNasta(forval?.next_action ?? (arTekniker ? '' : FORSLAG_NASTA))
    setNastaNar(arTekniker ? '' : forslagNastaDag())
    setVarde(forval?.estimated_value != null ? String(forval.estimated_value) : '')
    setVisaMer(!!(forval?.organization_number || forval?.estimated_value != null))
    setDubbletter(null)
    setForsokt(false)
    setSparar(false)
    // Fälten fylls bara när modalen öppnas, inte när föräldern ritar om
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const kollegor = useMemo(
    () => personal.filter((p) => p.aktiv && p.id !== minProfilId).sort((a, b) => a.namn.localeCompare(b.namn, 'sv')),
    [personal, minProfilId],
  )

  const valjVem = (v: Vem) => {
    setVem(v)
    // Med ägare behövs ett nästa steg: fyll i förslag så att inget fält står tomt utan förklaring
    if (v !== 'ingen') {
      if (!nasta.trim()) setNasta(FORSLAG_NASTA)
      if (!nastaNar) setNastaNar(forslagNastaDag())
    }
  }

  const agareId = vem === 'jag' ? minProfilId : vem === 'kollega' ? kollega || null : null
  const harAgare = vem !== 'ingen'
  const vadKravs = arTekniker
  const fel = {
    foretag: !foretag.trim(),
    vad: vadKravs && !vad.trim(),
    kontaktvag: !telefon.trim() && !epost.trim(),
    kalla: !kalla,
    kollega: vem === 'kollega' && !kollega,
    nastaText: harAgare && !nasta.trim(),
    nastaNar: harAgare && !nastaNar,
    varde: !!varde.trim() && !/^\d[\d\s]*$/.test(varde.trim()),
  }
  const ogiltig = Object.values(fel).some(Boolean)
  const visa = (f: boolean) => forsokt && f

  const spara = async (ignoreraDubbletter = false) => {
    setForsokt(true)
    if (ogiltig || !kalla) {
      if (fel.varde) setVisaMer(true)
      return
    }
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
        notes: vad.trim() || null,
        source: kalla,
        // Utan ägare sätter den som fördelar nästa steg (fälten visas bara med ägare)
        next_action: harAgare ? nasta.trim() || null : forval?.next_action ?? null,
        next_action_at: harAgare && nastaNar ? fransLokal(nastaNar) : null,
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

  const knappText = arTekniker && !harAgare ? 'Skicka tips' : 'Skapa lead'
  const efterText = !harAgare
    ? arTekniker
      ? 'Koordinatorn får tipset under Nya tips och fördelar det. Du står kvar som tipsare.'
      : 'Leaden hamnar under Nya tips där koordinatorn fördelar den.'
    : vem === 'jag'
      ? 'Du blir ägare. Leaden kommer upp under Att göra den dag du valt.'
      : kollega
        ? `${personal.find((p) => p.id === kollega)?.namn ?? 'Kollegan'} blir ägare och ser leaden under Att göra.`
        : 'Välj vilken kollega som ska ta leaden.'

  const footer = (
    <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <p className={`text-sm sm:flex-1 ${forsokt && ogiltig ? 'text-red-400' : 'text-slate-400'}`} role={forsokt && ogiltig ? 'alert' : undefined}>
        {forsokt && ogiltig ? 'Det saknas uppgifter. Se de röda texterna.' : efterText}
      </p>
      <div className="flex gap-2">
        <button type="button" className={`${KNAPP_SEKUNDAR} flex-1 sm:flex-none`} onClick={onClose} disabled={sparar}>Avbryt</button>
        <button type="button" className={`${KNAPP_PRIMAR} flex-1 sm:flex-none`} onClick={() => void spara(false)} disabled={sparar}>
          <Icon name={sparar ? 'allman.laddar' : arTekniker && !harAgare ? 'lead.tips' : 'allman.bock'} size={20} className={sparar ? 'animate-spin' : ''} />
          {knappText}
        </button>
      </div>
    </div>
  )

  const vemKort = (v: Vem, ikon: IconName, rubrik: string, text: string) => (
    <button type="button" role="radio" aria-checked={vem === v} onClick={() => valjVem(v)} className={valKort(vem === v)}>
      <Icon name={ikon} size={20} className={`flex-shrink-0 ${vem === v ? 'text-[#20c58f]' : 'text-slate-300'}`} />
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-white">{rubrik}</span>
        <span className="block text-sm text-slate-400">{text}</span>
      </span>
    </button>
  )

  const vemVal = [
    vemKort('ingen', 'lead.fordela', 'Koordinatorn fördelar', arTekniker ? 'Tipset hamnar under Nya tips. Du står kvar som tipsare.' : 'Ingen ägare än. Leaden hamnar under Nya tips.'),
    vemKort('jag', 'lead.agare', arTekniker ? 'Jag tar det själv' : 'Jag', 'Du blir ägare och bestämmer när du hör av dig.'),
    vemKort('kollega', 'lead.dela', 'En kollega', 'Välj vem som ska ta det vidare.'),
  ]
  // Kontoret ser Jag först, teknikern Koordinatorn fördelar först
  const vemOrdning = arTekniker || !minProfilId ? vemVal : [vemVal[1], vemVal[0], vemVal[2]]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={arTekniker ? 'Tips om ny kund' : 'Ny lead'}
      subtitle={arTekniker ? 'Namn, vad det gäller och hur vi når dem. Resten fyller du i efteråt.' : 'Resten fyller du i på leaden efteråt'}
      size="md"
      footer={footer}
      mobilHelskarm
    >
      <div className="p-4 flex flex-col gap-6">
        {dubbletter && dubbletter.length > 0 && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/40 rounded-xl text-[15px] flex flex-col gap-2" role="alert">
            <p className="text-amber-300 font-semibold flex items-center gap-2">
              <Icon name="lead.lead" size={20} />
              Det finns redan {dubbletter.length === 1 ? 'en lead' : 'leads'} med samma uppgifter
            </p>
            <ul className="flex flex-col gap-2">
              {dubbletter.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-slate-200 min-w-0">
                    {d.company_name}
                    <span className="block text-sm text-slate-400">{STAGE_ETIKETT[d.stage]}, samma {d.traff}{d.agare ? `, ägare ${d.agare}` : ''}</span>
                  </span>
                  {d.kan_oppna && onOppnaBefintlig ? (
                    <button type="button" className={KNAPP_SEKUNDAR} onClick={() => onOppnaBefintlig(d.id)}>Öppna den</button>
                  ) : (
                    <span className="text-sm text-slate-400">Be ägaren dela den med dig</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="pt-2 border-t border-amber-500/20 flex justify-end">
              <button type="button" className={KNAPP_TEXT} onClick={() => void spara(true)} disabled={sparar}>Skapa ändå</button>
            </div>
          </div>
        )}

        {/* 1 */}
        <section className="flex flex-col gap-3">
          <StegRubrik nr={1} text="Vem gäller det?" />
          <div>
            <label className={ETIKETT} htmlFor="ny-foretag">Företag eller namn *</label>
            <input id="ny-foretag" autoFocus className={faltFel(visa(fel.foretag))} value={foretag} onChange={(e) => setForetag(e.target.value)} placeholder="Till exempel Exempel AB" aria-invalid={visa(fel.foretag)} />
            {visa(fel.foretag) && <p className={FELTEXT}>Skriv företagets eller personens namn.</p>}
          </div>
          <div>
            <label className={ETIKETT} htmlFor="ny-kontakt">Kontaktperson</label>
            <input id="ny-kontakt" className={FALT} value={kontakt} onChange={(e) => setKontakt(e.target.value)} placeholder="Till exempel Anna Exempel" />
          </div>
        </section>

        {/* 2 */}
        <section className="flex flex-col gap-2">
          <StegRubrik nr={2} text="Vad gäller det?" />
          <label className="sr-only" htmlFor="ny-vad">Vad gäller det?{vadKravs ? ' *' : ''}</label>
          <textarea
            id="ny-vad"
            rows={3}
            maxLength={4000}
            className={faltFel(visa(fel.vad))}
            value={vad}
            onChange={(e) => setVad(e.target.value)}
            placeholder="Till exempel Råttor i soprummet. Vill ha hjälp med fast avtal."
            aria-invalid={visa(fel.vad)}
          />
          {visa(fel.vad) ? (
            <p className={FELTEXT}>Skriv kort vad kunden behöver hjälp med.</p>
          ) : (
            <p className={HJALPTEXT}>{vadKravs ? 'Den som tar hand om tipset läser det här först.' : 'Valfritt. Sparas som Beskrivning och behov på leaden.'}</p>
          )}
        </section>

        {/* 3 */}
        <section className="flex flex-col gap-3">
          <StegRubrik nr={3} text="Hur når vi dem?" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={ETIKETT} htmlFor="ny-telefon">Telefon</label>
              <input id="ny-telefon" type="tel" inputMode="tel" className={faltFel(visa(fel.kontaktvag))} value={telefon} onChange={(e) => setTelefon(e.target.value)} placeholder="070-123 45 67" aria-invalid={visa(fel.kontaktvag)} />
            </div>
            <div>
              <label className={ETIKETT} htmlFor="ny-epost">E-post</label>
              <input id="ny-epost" type="email" inputMode="email" className={faltFel(visa(fel.kontaktvag))} value={epost} onChange={(e) => setEpost(e.target.value)} placeholder="namn@exempel.se" aria-invalid={visa(fel.kontaktvag)} />
            </div>
          </div>
          {visa(fel.kontaktvag) ? <p className={`${FELTEXT} -mt-2`}>Fyll i telefon eller e-post.</p> : <p className={`${HJALPTEXT} -mt-2`}>Det räcker med en av dem.</p>}
          {!arTekniker && (
            <div>
              <label className={ETIKETT} htmlFor="ny-kalla">Källa *</label>
              <select id="ny-kalla" className={faltFel(visa(fel.kalla))} value={kalla} onChange={(e) => setKalla(e.target.value as LeadSource)} aria-invalid={visa(fel.kalla)}>
                <option value="">Var kommer leaden från?</option>
                {LEAD_KALLOR.map((k) => <option key={k} value={k}>{KALLA_ETIKETT[k]}</option>)}
              </select>
              {visa(fel.kalla) && <p className={FELTEXT}>Välj var leaden kommer från.</p>}
            </div>
          )}
        </section>

        {/* 4 */}
        <section className="flex flex-col gap-3">
          <StegRubrik nr={4} text="Vem tar det vidare?" />
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Ägare">{vemOrdning}</div>

          {vem === 'kollega' && (
            <div>
              <label className={ETIKETT} htmlFor="ny-kollega">Kollega *</label>
              <select id="ny-kollega" className={faltFel(visa(fel.kollega))} value={kollega} onChange={(e) => setKollega(e.target.value)} aria-invalid={visa(fel.kollega)}>
                <option value="">Välj kollega</option>
                {kollegor.map((p) => <option key={p.id} value={p.id}>{p.namn}</option>)}
              </select>
              {visa(fel.kollega) && <p className={FELTEXT}>Välj en kollega.</p>}
            </div>
          )}

          {harAgare && (
            <div className="p-3 bg-slate-800/30 border border-slate-700 rounded-xl flex flex-col gap-3">
              <p className="text-sm text-slate-300 flex items-start gap-2">
                <Icon name="lead.nasta-steg" size={20} className="flex-none text-[#20c58f]" />
                En lead med ägare behöver ett nästa steg, så att den kommer upp under Att göra på rätt dag. Förslaget går att ändra.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-3">
                <div>
                  <label className={ETIKETT} htmlFor="ny-nasta">Nästa steg *</label>
                  <input id="ny-nasta" className={faltFel(visa(fel.nastaText))} value={nasta} onChange={(e) => setNasta(e.target.value)} placeholder="Till exempel Ring och boka besök" maxLength={300} aria-invalid={visa(fel.nastaText)} />
                  {visa(fel.nastaText) && <p className={FELTEXT}>Skriv vad nästa steg är.</p>}
                </div>
                <div>
                  <label className={ETIKETT} htmlFor="ny-nasta-nar">Datum och tid *</label>
                  <DateField id="ny-nasta-nar" withTime value={nastaNar} onChange={setNastaNar} className={faltFel(visa(fel.nastaNar), DATUMFALT)} placeholder="ÅÅÅÅ-MM-DD HH:mm" />
                  {visa(fel.nastaNar) && <p className={FELTEXT}>Välj datum och tid.</p>}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Fler uppgifter */}
        <section className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setVisaMer((v) => !v)}
            aria-expanded={visaMer}
            className="min-h-[44px] -mx-1 px-1 flex items-center gap-2 text-left text-[15px] font-semibold text-white rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
          >
            <Icon name="allman.chevron" size={20} className={`text-slate-400 transition-transform ${visaMer ? 'rotate-90' : ''}`} />
            Fler uppgifter
            <span className="text-sm font-normal text-slate-400">valfritt, org.nr och årspremie</span>
          </button>
          {visaMer && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={ETIKETT} htmlFor="ny-orgnr">Org.nr</label>
                <input id="ny-orgnr" className={`${FALT} font-mono`} value={orgnr} onChange={(e) => setOrgnr(e.target.value)} placeholder="ÅÅMMDD-NNNN" />
              </div>
              <div>
                <label className={ETIKETT} htmlFor="ny-varde">Årspremie i kr</label>
                <input id="ny-varde" inputMode="numeric" className={`${faltFel(visa(fel.varde))} font-mono`} value={varde} onChange={(e) => setVarde(e.target.value)} placeholder="48 000" aria-invalid={visa(fel.varde)} />
                {visa(fel.varde) && <p className={FELTEXT}>Skriv årspremien i hela kronor, till exempel 48 000.</p>}
              </div>
            </div>
          )}
        </section>
      </div>
    </Modal>
  )
}
