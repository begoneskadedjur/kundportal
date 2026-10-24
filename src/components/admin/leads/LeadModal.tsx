// src/components/admin/leads/LeadModal.tsx
// Detaljvyn för en lead (?id= i adressen, Bakåt stänger, helskärm på mobil). Strukturen följer
// WebLeadDetailModal: huvud med status, ägare, delad med, årspremie, tipsare och org.nr; åtgärdsrad;
// rutan Nästa steg överst; sektionerna Kontakt, Affär, Ursprung och kopplingar, Aktivitet och ett
// hopfällt Mer uppgifter. Redigering sker på plats och sparar bara ändrade fält.
// Steg som sätts för hand: Ny, Kontaktad, Parkerad, Förlorad och Återuppta. Besök bokat, Offert skickad
// och Vunnen sätts automatiskt sedan etapp 5: Boka besök (admin/koordinator) öppnar ärendemodalen
// förifylld och kopplar ärendet (RPC lead_koppla_besok); Skapa offert öppnar Oneflow-guiden med
// leaden som källa (contracts.source_type 'lead', triggern contracts_lead_automatik flyttar leaden).
// Vunnen utan kund visar steget Koppla eller skapa kund överst. Admin/koordinator har kvar
// "Sätt … för hand" i ⋯-menyn som nödutgång (offerter skapade utanför leaden kopplas inte automatiskt).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ChevronDown, ChevronRight } from 'lucide-react'
import Modal from '../../ui/Modal'
import Button from '../../ui/Button'
import CreateCaseModal from '../coordinator/CreateCaseModal'
import CreateCustomerManuallyModal from '../customers/CreateCustomerManuallyModal'
import { Icon } from '../../icons/Icon'
import { LeadService } from '../../../services/leadService'
import { WebInquiryService } from '../../../services/webInquiryService'
import type { BusinessCasesInsert, Lead, LeadContact, LeadUpdate, PrivateCasesInsert, Technician } from '../../../types/database'
import {
  AUTOMATISKA_STAGES,
  KALLA_ETIKETT,
  KUNDGRUPP_ETIKETT,
  LEAD_KALLOR,
  STAGE_ETIKETT,
  TYP_ETIKETT,
  URSPRUNG_ETIKETT,
  arOppen,
  type LeadAktivitet as Aktivitet,
  type LeadKundgrupp,
  type LeadMedlem,
  type LeadPerson,
  type LeadTyp,
} from '../../../types/leads'
import WebLeadRadMeny, { type RadMenyVal } from '../webLeads/WebLeadRadMeny'
import { formatSvTid, svDatum } from '../webLeads/format'
import LeadFaltSektion, { type FaltDef } from './LeadFaltSektion'
import LeadNastaSteg, { type NastaLage } from './LeadNastaSteg'
import LeadAktivitet, { type LeadAktivitetRef } from './LeadAktivitet'
import LeadDelning from './LeadDelning'
import LeadKundKoppling from './LeadKundKoppling'
import { StatusText } from './LeadsTabell'
import { SEKTION, SEKTION_RUBRIK, kr, segment, ursprungText } from './leadLogik'

interface Props {
  lead: Lead | null
  personal: LeadPerson[]
  namnFor: (id: string | null) => string
  minProfilId: string | null
  arLeadAdmin: boolean
  /** Rollens bas: /admin, /koordinator, /saljare eller /technician */
  basePath: string
  onClose: () => void
  onChanged: (lead: Lead) => void
}

/** Ärendemodalen förifylld från leaden (Boka besök). */
interface BesokUnderlag {
  typ: 'private' | 'business'
  falt: Partial<PrivateCasesInsert & BusinessCasesInsert> & { company_name?: string }
  tekniker: Technician[]
}

function besokFalt(lead: Lead, typ: 'private' | 'business'): BesokUnderlag['falt'] {
  const falt: BesokUnderlag['falt'] = {
    kontaktperson: lead.contact_person || '',
    telefon_kontaktperson: lead.phone_number || '',
    e_post_kontaktperson: lead.email || '',
    adress: lead.address || '',
    skadedjur: lead.problem_type || '',
    description: [`Besök från lead: ${lead.company_name}`, lead.next_action ? `Nästa steg: ${lead.next_action}` : '', lead.notes || '']
      .filter(Boolean)
      .join('\n'),
  }
  if (typ === 'business') {
    falt.company_name = lead.company_name
    falt.org_nr = lead.organization_number || ''
  }
  return falt
}

/** Oneflow-guidens förifyllning från leaden, i samma format som guidens övriga ingångar. */
function offertFalt(lead: Lead, returnPath: string) {
  const privat = lead.customer_group === 'privat'
  return {
    documentType: lead.lead_type === 'nytt_avtal' ? 'contract' : 'offer',
    partyType: privat ? 'individual' : 'company',
    Kontaktperson: lead.contact_person || (privat ? lead.company_name : ''),
    'e-post-kontaktperson': lead.email || '',
    'telefonnummer-kontaktperson': lead.phone_number || '',
    'utforande-adress': lead.address || '',
    foretag: privat ? '' : lead.company_name,
    'org-nr': privat ? '' : lead.organization_number || '',
    // Steg 1: dokumenttypen går att byta, sedan mall
    targetStep: 1,
    leadId: lead.id,
    returnPath,
  }
}

const STORLEK: { value: string; label: string }[] = [
  { value: 'small', label: 'Litet (1 till 10)' },
  { value: 'medium', label: 'Mellan (11 till 50)' },
  { value: 'large', label: 'Stort (51 till 250)' },
  { value: 'enterprise', label: 'Mycket stort (över 250)' },
]

export default function LeadModal({ lead, personal, namnFor, minProfilId, arLeadAdmin, basePath, onClose, onChanged }: Props) {
  const [aktiviteter, setAktiviteter] = useState<Aktivitet[]>([])
  const [medlemmar, setMedlemmar] = useState<LeadMedlem[]>([])
  const [kontakter, setKontakter] = useState<LeadContact[]>([])
  const [kundnamn, setKundnamn] = useState<string | null>(null)
  const [laddar, setLaddar] = useState(false)
  const [lage, setLage] = useState<NastaLage>('visa')
  const [visaDelning, setVisaDelning] = useState(false)
  const [visaMer, setVisaMer] = useState(false)
  const [arbetar, setArbetar] = useState(false)
  const [besok, setBesok] = useState<BesokUnderlag | null>(null)
  const [visaSkapaKund, setVisaSkapaKund] = useState(false)
  const navigate = useNavigate()
  const aktivitetRef = useRef<LeadAktivitetRef>(null)
  const id = lead?.id ?? null

  const laddaHistorik = useCallback(async () => {
    if (!id) return
    try {
      const [akt, medl] = await Promise.all([LeadService.aktiviteter(id), LeadService.medlemmar(id)])
      setAktiviteter(akt)
      setMedlemmar(medl)
    } catch {
      toast.error('Historiken kunde inte hämtas')
    }
  }, [id])

  useEffect(() => {
    setLage('visa')
    setVisaDelning(false)
    setVisaMer(false)
    setAktiviteter([])
    setMedlemmar([])
    setKontakter([])
    if (!id) return
    setLaddar(true)
    void Promise.all([
      laddaHistorik(),
      LeadService.kontakter(id).then(setKontakter).catch(() => setKontakter([])),
      // Färsk rad när modalen öppnas, så att en kollegas ändring syns
      LeadService.get(id).then((rad) => rad && onChanged(rad)).catch(() => undefined),
    ]).finally(() => setLaddar(false))
    // onChanged är stabil nog; vi vill bara ladda om när en annan lead öppnas
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, laddaHistorik])

  useEffect(() => {
    setKundnamn(null)
    if (lead?.customer_id) LeadService.kundnamn(lead.customer_id).then(setKundnamn).catch(() => setKundnamn(null))
  }, [lead?.customer_id])

  const arAgare = !!minProfilId && lead?.owner_profile_id === minProfilId
  const arMedlem = !!minProfilId && medlemmar.some((m) => m.profile_id === minProfilId)
  const kanRedigera = arLeadAdmin || arAgare || arMedlem
  const kanOverlata = arLeadAdmin || arAgare

  const spara = useCallback(
    async (andring: LeadUpdate) => {
      if (!lead) return
      const ny = await LeadService.update(lead.id, andring)
      onChanged(ny)
      void laddaHistorik()
    },
    [lead, onChanged, laddaHistorik],
  )

  const sparaTyst = async (andring: LeadUpdate, ok?: string) => {
    setArbetar(true)
    try {
      await spara(andring)
      if (ok) toast.success(ok)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ändringen kunde inte sparas')
    } finally {
      setArbetar(false)
    }
  }

  const kontaktFalt: FaltDef[] = useMemo(
    () => [
      { nyckel: 'company_name', etikett: 'Företag eller namn', bred: true },
      { nyckel: 'contact_person', etikett: 'Kontaktperson' },
      {
        nyckel: 'phone_number',
        etikett: 'Telefon',
        typ: 'tel',
        visa: (l) => (l.phone_number ? <a href={`tel:${l.phone_number}`} className="text-[#20c58f] hover:underline font-mono">{l.phone_number}</a> : <span className="text-slate-500">Saknas</span>),
      },
      {
        nyckel: 'email',
        etikett: 'E-post',
        typ: 'email',
        visa: (l) => (l.email ? <a href={`mailto:${l.email}`} className="text-[#20c58f] hover:underline break-all">{l.email}</a> : <span className="text-slate-500">Saknas</span>),
      },
      { nyckel: 'address', etikett: 'Adress', bred: true },
    ],
    [],
  )

  const affarFalt: FaltDef[] = useMemo(
    () => [
      { nyckel: 'lead_type', etikett: 'Typ', typ: 'val', val: (Object.keys(TYP_ETIKETT) as LeadTyp[]).map((k) => ({ value: k, label: TYP_ETIKETT[k] })) },
      { nyckel: 'customer_group', etikett: 'Kundgrupp', typ: 'val', val: (Object.keys(KUNDGRUPP_ETIKETT) as LeadKundgrupp[]).map((k) => ({ value: k, label: KUNDGRUPP_ETIKETT[k] })) },
      {
        nyckel: 'estimated_value',
        etikett: 'Årspremie (kr)',
        typ: 'number',
        mono: true,
        visa: (l) => (l.estimated_value ? <span className="font-mono">{kr(l.estimated_value)}</span> : <span className="text-slate-500">Ej satt</span>),
      },
      { nyckel: 'source', etikett: 'Källa', typ: 'val', val: LEAD_KALLOR.map((k) => ({ value: k, label: KALLA_ETIKETT[k] })) },
      { nyckel: 'contract_with', etikett: 'Leverantör nu' },
      { nyckel: 'contract_end_date', etikett: 'Nuvarande avtal till', typ: 'datum', mono: true },
    ],
    [],
  )

  const merFalt: FaltDef[] = useMemo(
    () => [
      { nyckel: 'organization_number', etikett: 'Org.nr', mono: true },
      { nyckel: 'website', etikett: 'Hemsida' },
      { nyckel: 'company_size', etikett: 'Företagsstorlek', typ: 'val', val: STORLEK },
      { nyckel: 'business_type', etikett: 'Verksamhetstyp' },
      { nyckel: 'business_description', etikett: 'Om verksamheten', typ: 'textarea' },
      { nyckel: 'notes', etikett: 'Beskrivning och behov', typ: 'textarea' },
    ],
    [],
  )

  if (!lead) return null

  const oppen = arOppen(lead.stage)
  const arTeknikerVy = basePath === '/technician'
  const behoverKund = lead.stage === 'vunnen' && !lead.customer_id && kanRedigera
  const kanBokaArende = arLeadAdmin && !arTeknikerVy

  const hamtaFarsk = () => LeadService.get(lead.id).then((rad) => rad && onChanged(rad)).catch(() => undefined)

  // Boka besök: admin/koordinator skapar ärendet direkt, övriga sätter ett nästa steg som förut
  const bokaBesok = async () => {
    if (!kanBokaArende) {
      setLage('besok')
      return
    }
    setArbetar(true)
    try {
      const typ: 'private' | 'business' = lead.customer_group === 'privat' ? 'private' : 'business'
      const tekniker = await WebInquiryService.listTechnicians()
      setBesok({ typ, falt: besokFalt(lead, typ), tekniker })
    } catch {
      toast.error('Ärendemodalen kunde inte öppnas')
    } finally {
      setArbetar(false)
    }
  }

  const efterBesok = async (caseId: string, caseType: 'private' | 'business' | 'contract') => {
    try {
      await LeadService.kopplaBesok(lead.id, caseType === 'contract' ? 'cases' : caseType === 'business' ? 'business_cases' : 'private_cases', caseId)
      toast.success('Ärendet är kopplat till leaden')
      void hamtaFarsk()
      void laddaHistorik()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ärendet skapades men kunde inte kopplas till leaden')
    }
  }

  // Skapa offert: Oneflow-guiden förifylld med leaden som källa. Leaden flyttas av databasen när
  // dokumentet skickas, avböjs eller signeras (triggern contracts_lead_automatik).
  const skapaOffert = () => {
    const guide = basePath === '/admin' ? '/admin/skapa-avtal' : `${basePath}/oneflow-contract-creator`
    try {
      sessionStorage.setItem('prefill_customer_data', JSON.stringify(offertFalt(lead, `${basePath}/leads?id=${lead.id}`)))
    } catch {
      // sessionStorage blockerad: guiden öppnas utan förifyllning
    }
    navigate(`${guide}?prefill=${lead.lead_type === 'nytt_avtal' ? 'contract' : 'offer'}`)
  }

  const kopplaKund = (customerId: string) => spara({ customer_id: customerId })
  const delade = medlemmar.map((m) => namnFor(m.profile_id)).filter(Boolean)
  const tipsare = namnFor(lead.tipped_by_profile_id)
  const visaWebbLank = basePath !== '/technician' && !!lead.web_inquiry_id

  const adminMeny: RadMenyVal[] = [
    ...AUTOMATISKA_STAGES.filter((s) => s !== lead.stage).map((s) => ({
      label: `Sätt ${STAGE_ETIKETT[s]} för hand (nödutgång)`,
      ikon: <Icon name={s === 'vunnen' ? 'lead.vunnen' : s === 'offert_skickad' ? 'dok.offert' : 'allman.kalender'} size={16} />,
      onClick: () => void sparaTyst({ stage: s }, `Steget är ${STAGE_ETIKETT[s]}`),
    })),
    ...(!lead.owner_profile_id && minProfilId
      ? [{ label: 'Ta leaden', ikon: <Icon name="lead.agare" size={16} />, onClick: () => void sparaTyst({ owner_profile_id: minProfilId }, 'Du är ägare') }]
      : []),
  ]

  const atgard = (ikon: Parameters<typeof Icon>[0]['name'], text: string, onClick: () => void, primar = false) => (
    <Button variant={primar ? 'primary' : 'secondary'} size="sm" onClick={onClick} disabled={arbetar}>
      <Icon name={ikon} size={16} className="mr-1.5" />
      {text}
    </Button>
  )

  return (
    <>
    <Modal
      isOpen={!!lead}
      onClose={onClose}
      size="xl"
      mobilHelskarm
      title={lead.company_name}
      subtitle={ursprungText(lead, namnFor) || `Skapad ${svDatum(lead.created_at)}`}
    >
      <div className="p-4 space-y-3">
        {/* Huvud */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
          <StatusText lead={lead} />
          <span className="flex items-center gap-1.5 text-slate-300" title="Ägare">
            <Icon name="lead.agare" size={16} className="text-slate-500" />
            {namnFor(lead.owner_profile_id) || <span className="text-amber-400">Ingen ägare</span>}
          </span>
          {delade.length > 0 && (
            <span className="flex items-center gap-1.5 text-slate-300" title="Delad med">
              <Icon name="lead.dela" size={16} className="text-slate-500" />
              Delad med {delade.join(', ')}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-slate-300" title="Årspremie">
            <Icon name="lead.varde" size={16} className="text-slate-500" />
            {lead.estimated_value ? <span className="font-mono">{kr(lead.estimated_value)}/år</span> : <span className="text-slate-500">Årspremie ej satt</span>}
          </span>
          {tipsare && (
            <span className="flex items-center gap-1.5 text-slate-300" title="Tipsare">
              <Icon name="lead.tipsare" size={16} className="text-slate-500" />
              Tips från {tipsare}
            </span>
          )}
          {lead.organization_number && <span className="font-mono text-slate-400">{lead.organization_number}</span>}
        </div>

        {behoverKund && (
          <LeadKundKoppling lead={lead} kanSkapaKund={!arTeknikerVy} onKoppla={kopplaKund} onSkapaKund={() => setVisaSkapaKund(true)} />
        )}

        {/* Manuella steg: Ny och Kontaktad */}
        {kanRedigera && (lead.stage === 'ny' || lead.stage === 'kontaktad') && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">Steg</span>
            <div className="flex border-b border-slate-700/50" role="tablist" aria-label="Steg">
              {(['ny', 'kontaktad'] as const).map((s) => (
                <button key={s} type="button" role="tab" aria-selected={lead.stage === s} disabled={arbetar} className={segment(lead.stage === s)} onClick={() => lead.stage !== s && void sparaTyst({ stage: s })}>
                  {STAGE_ETIKETT[s]}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-500">Besök bokat, Offert skickad och Vunnen sätts automatiskt.</span>
          </div>
        )}

        {/* Åtgärdsrad */}
        <div className="flex flex-wrap items-center gap-2">
          {atgard('kontakt.telefon', 'Logga samtal', () => aktivitetRef.current?.borja('samtal'))}
          {kanRedigera && oppen && atgard('allman.kalender', 'Boka besök', () => void bokaBesok())}
          {kanRedigera && oppen && lead.stage !== 'offert_skickad' && atgard('dok.offert', 'Skapa offert', skapaOffert)}
          {(kanOverlata || arMedlem) && atgard('lead.dela', 'Överlåt eller dela', () => setVisaDelning((v) => !v))}
          {kanRedigera && oppen && lead.stage !== 'parkerad' && atgard('lead.parkerad', 'Parkera', () => setLage('parkera'))}
          {kanRedigera && oppen && atgard('lead.forlorad', 'Förlorad', () => setLage('forlorad'))}
          {kanRedigera && (lead.stage === 'parkerad' || lead.stage === 'forlorad') && atgard('allman.aterstall', 'Återuppta', () => setLage('ateruppta'))}
          {arLeadAdmin && adminMeny.length > 0 && <WebLeadRadMeny val={adminMeny} etikett="Fler åtgärder" />}
        </div>

        {visaDelning && (
          <LeadDelning
            lead={lead}
            medlemmar={medlemmar}
            personal={personal}
            minProfilId={minProfilId}
            kanOverlata={kanOverlata}
            namnFor={namnFor}
            onStang={() => setVisaDelning(false)}
            onKlar={() => {
              void LeadService.get(lead.id).then((rad) => rad && onChanged(rad)).catch(() => undefined)
              void laddaHistorik()
            }}
          />
        )}

        <LeadNastaSteg
          lead={lead}
          lage={lage}
          onLage={setLage}
          kanRedigera={kanRedigera}
          minProfilId={minProfilId}
          onSpara={spara}
          onLoggad={() => void laddaHistorik()}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <LeadFaltSektion titel="Kontakt" ikon="kontakt.telefon" lead={lead} falt={kontaktFalt} kanRedigera={kanRedigera} onSpara={spara} />
          <LeadFaltSektion titel="Affär" ikon="lead.varde" lead={lead} falt={affarFalt} kanRedigera={kanRedigera} onSpara={spara} />
        </div>

        {/* Ursprung och kopplingar */}
        <div className={SEKTION}>
          <h3 className={SEKTION_RUBRIK}>
            <Icon name="lead.kalla" size={16} className="text-[#20c58f]" /> Ursprung och kopplingar
          </h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
            <div>
              <dt className="text-xs text-slate-400">Källa</dt>
              <dd className="text-white">
                {lead.source ? KALLA_ETIKETT[lead.source] : 'Inte angiven'}
                {tipsare ? ` · tips från ${tipsare}` : ''}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Ursprungsärende</dt>
              <dd className="text-white">
                {lead.origin_case_type ? URSPRUNG_ETIKETT[lead.origin_case_type] : <span className="text-slate-500">Inget</span>}
              </dd>
            </div>
            {lead.booked_case_type && (
              <div>
                <dt className="text-xs text-slate-400">Bokat besök</dt>
                <dd className="text-white">{URSPRUNG_ETIKETT[lead.booked_case_type]}</dd>
              </div>
            )}
            {lead.web_inquiry_id && (
              <div>
                <dt className="text-xs text-slate-400">Webbförfrågan</dt>
                <dd>
                  {visaWebbLank ? (
                    <Link to={`${basePath}/leads-webb?id=${lead.web_inquiry_id}`} className="text-[#20c58f] hover:underline">Öppna förfrågan</Link>
                  ) : (
                    <span className="text-white">Kopplad</span>
                  )}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs text-slate-400">Kund</dt>
              <dd className="text-white">
                {lead.customer_id ? kundnamn ?? 'Kopplad kund' : <span className="text-slate-400">Ingen kund ännu. Kopplas när leaden vinns.</span>}
              </dd>
            </div>
            {(lead.offer_contract_id || lead.agreement_contract_id) && (
              <div>
                <dt className="text-xs text-slate-400">Oneflow</dt>
                <dd className="text-white">
                  {lead.agreement_contract_id ? 'Avtal kopplat' : 'Offert kopplad'}
                </dd>
              </div>
            )}
            {lead.won_at && (
              <div><dt className="text-xs text-slate-400">Vunnen</dt><dd className="text-white font-mono">{svDatum(lead.won_at)}</dd></div>
            )}
          </dl>
        </div>

        <LeadAktivitet
          ref={aktivitetRef}
          leadId={lead.id}
          aktiviteter={aktiviteter}
          laddar={laddar}
          minProfilId={minProfilId}
          namnFor={namnFor}
          onSparad={() => {
            void laddaHistorik()
            // Ett samtal, mejl eller möte på en ny lead flyttar den till Kontaktad i databasen
            void LeadService.get(lead.id).then((rad) => rad && onChanged(rad)).catch(() => undefined)
          }}
        />

        {/* Mer uppgifter */}
        <div className={SEKTION}>
          <button
            type="button"
            onClick={() => setVisaMer((v) => !v)}
            aria-expanded={visaMer}
            className="w-full flex items-center gap-1.5 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] rounded"
          >
            {visaMer ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            Mer uppgifter
            <span className="text-xs font-normal text-slate-400">org.nr, hemsida, storlek, beskrivning, fler kontakter</span>
          </button>
          {visaMer && (
            <div className="mt-3 space-y-3">
              <LeadFaltSektion titel="Företaget" ikon="allman.foretag" lead={lead} falt={merFalt} kanRedigera={kanRedigera} onSpara={spara} ramlos />
              {kontakter.filter((k) => !k.is_primary).length > 0 && (
                <div className="pt-3 border-t border-slate-700/50">
                  <p className="text-xs font-medium text-slate-400 mb-1">Fler kontakter</p>
                  <ul className="space-y-1 text-sm">
                    {kontakter.filter((k) => !k.is_primary).map((k) => (
                      <li key={k.id} className="text-slate-200">
                        {k.name}
                        {k.title ? <span className="text-slate-400">, {k.title}</span> : null}
                        {k.phone ? <a href={`tel:${k.phone}`} className="ml-2 text-[#20c58f] hover:underline font-mono">{k.phone}</a> : null}
                        {k.email ? <a href={`mailto:${k.email}`} className="ml-2 text-[#20c58f] hover:underline">{k.email}</a> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="pt-3 border-t border-slate-700/50 text-xs text-slate-500 space-y-0.5">
                <p>Skapad {formatSvTid(lead.created_at)}{lead.created_by ? ` av ${namnFor(lead.created_by) || 'okänd'}` : ''}. Senast ändrad {formatSvTid(lead.updated_at)}.</p>
                {lead.source_fritext && <p>Källa i gamla Leads: {lead.source_fritext}</p>}
                {lead.stage_changed_at && <p>I steget {STAGE_ETIKETT[lead.stage]} sedan {svDatum(lead.stage_changed_at)}.</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>

    {besok && (
      <CreateCaseModal
        isOpen
        onClose={() => setBesok(null)}
        onSuccess={() => undefined}
        technicians={besok.tekniker}
        initialCaseType={besok.typ}
        initialFormData={besok.falt}
        onCaseCreated={efterBesok}
      />
    )}

    {visaSkapaKund && (
      <CreateCustomerManuallyModal
        isOpen
        onClose={() => setVisaSkapaKund(false)}
        onCustomerCreated={(customerId) => {
          kopplaKund(customerId)
            .then(() => toast.success('Kunden är kopplad till leaden'))
            .catch(() => toast.error('Kunden skapades men kunde inte kopplas till leaden'))
        }}
        initialValues={{
          company_name: lead.company_name,
          organization_number: lead.organization_number || '',
          contact_person: lead.contact_person || '',
          contact_email: lead.email || '',
          contact_phone: lead.phone_number || '',
          contact_address: lead.address || '',
          sales_person: namnFor(lead.owner_profile_id) || '',
        }}
      />
    )}
    </>
  )
}
