// src/components/admin/customers/record/ContractReferencesSection.tsx
// § 7 Referenser på avtalspappret i Avtalskartan.
//
// 8.1 är avtalets egen referens (Er referens på årspremiefakturan) och
// diarienummer (contracts.invoice_reference / diary_number). Raderna
// därefter är enheterna i avtalets omfattning med enhetens "Märkning
// faktura" (customers.billing_reference), samma fält som Redigera enhet
// sparar. Koden förifylls på alla ärenden mot enheten och blir Er referens
// på fakturan. Saknas kod är referensen dynamisk: beställaren anger sin kod
// på ärendet (fältet Märkning) och den följer med till fakturan.

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { customerRowName, type RecordContract, type RecordCustomer } from '../../../../hooks/useCustomerRecord'
import { PANEL_INPUT_CLASS, PAPER_GEAR_CLASS, PAPER_INPUT_CLASS, PAPER_LINK_CLASS, type PaperInk, type SectionMode } from './paperInk'
import { FOLD_THRESHOLD } from './paperFold'

interface Props {
  contract: RecordContract
  /** Lokalerna avtalet omfattar (§ 1), i visningsordning */
  coveredLocations: RecordCustomer[]
  ink: PaperInk
  archived: boolean
  onSaveInvoiceReference?: (input: { invoiceReference: string | null; diaryNumber: string | null }) => Promise<void>
  onSaveUnitReference?: (unit: RecordCustomer, code: string | null) => Promise<void>
  /** Enhet som just släppts på sektionen (dra in enhet → sätt kod) */
  focusUnitId?: string | null
  onFocusHandled?: () => void
  /** paper = läsning på pappret (default), settings = formulären öppna i panelen */
  mode?: SectionMode
  onOpenSettings?: () => void
  /** Ramavtalets namn när avtalets referens ärvs därifrån */
  frameworkLabel?: string | null
}

export default function ContractReferencesSection({
  contract,
  coveredLocations,
  ink,
  archived,
  onSaveInvoiceReference,
  onSaveUnitReference,
  focusUnitId,
  onFocusHandled,
  mode = 'paper',
  onOpenSettings,
  frameworkLabel = null,
}: Props) {
  const settings = mode === 'settings'
  const inputClass = settings ? PANEL_INPUT_CLASS : PAPER_INPUT_CLASS
  const [editingContract, setEditingContract] = useState(settings)
  const [refInput, setRefInput] = useState(settings ? (contract.invoice_reference ?? '') : '')
  const [diaryInput, setDiaryInput] = useState(settings ? (contract.diary_number ?? '') : '')
  const [editingUnit, setEditingUnit] = useState<string | null>(null)
  const [codeInput, setCodeInput] = useState('')
  // Panelen: alla enheters koder redigeras samtidigt
  const [codeDrafts, setCodeDrafts] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  // Släpp av en enhet på § 7 öppnar numera panelen (hanteras av kartan); här bara kvitto
  if (focusUnitId && !settings) onFocusHandled?.()

  const rowStyle = { borderColor: ink.rule }
  const numStyle = { color: ink.muted }


  const saveContract = async () => {
    if (!onSaveInvoiceReference) return
    setSaving(true)
    try {
      await onSaveInvoiceReference({ invoiceReference: refInput.trim() || null, diaryNumber: diaryInput.trim() || null })
      if (!settings) setEditingContract(false)
    } finally {
      setSaving(false)
    }
  }


  const saveUnit = async (unit: RecordCustomer) => {
    if (!onSaveUnitReference) return
    const value = settings ? (codeDrafts[unit.id] ?? unit.billing_reference ?? '') : codeInput
    setSaving(true)
    try {
      await onSaveUnitReference(unit, value.trim() || null)
      setEditingUnit(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={settings ? '' : 'mt-3.5 group/para'}>
      {!settings && (
        <div className="flex items-baseline gap-2 border-b-[1.5px] pb-1" style={{ borderColor: ink.primary }}>
          <h4 className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: ink.primary }}>
            § 7 · Referenser
          </h4>
          {onOpenSettings && !archived && (
            <button type="button" onClick={onOpenSettings} className={PAPER_GEAR_CLASS} style={{ borderColor: ink.rule, color: ink.muted }} title="Inställningar för referenser" aria-label="Inställningar för referenser">
              ⚙
            </button>
          )}
          <span className="ml-auto font-sans text-[10.5px]" style={{ color: ink.muted }}>
            {frameworkLabel ? `ur ${frameworkLabel} · ` : ''}skrivs som Er referens på fakturan
          </span>
        </div>
      )}

      {/* 8.1 Avtalets referens */}
      {!editingContract ? (
        <div className="flex items-center gap-2.5 py-1.5 border-b border-dotted text-[13px]" style={rowStyle}>
          <span className="font-sans text-[10.5px] w-6 tabular-nums" style={numStyle}>7.1</span>
          <span className="font-semibold">
            Avtalets referens
            <span className="font-normal text-[11.5px] ml-1.5" style={{ color: ink.secondary }}>
              diarienummer
            </span>
          </span>
          <span className="flex-1 border-b border-dotted mx-1 translate-y-1" style={rowStyle} />
          <span className="font-sans text-[12px] tabular-nums" style={{ color: ink.secondary }}>
            {contract.invoice_reference ? (
              <>
                <b style={{ color: ink.primary }}>{contract.invoice_reference}</b>
                {contract.diary_number ? ` · ${contract.diary_number}` : ''} · på årspremiefakturan
              </>
            ) : contract.diary_number ? (
              <>
                <b style={{ color: ink.primary }}>{contract.diary_number}</b> · diarienummer, ingen Er referens
              </>
            ) : (
              <span className="italic">ingen referens · enhetens kod gäller</span>
            )}
          </span>
        </div>
      ) : (
        <div className="font-sans py-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-center text-[12px]" style={{ color: ink.secondary }}>
          <label htmlFor={`ref-${contract.id}`}>Er referens</label>
          <input id={`ref-${contract.id}`} className={inputClass} value={refInput} onChange={(e) => setRefInput(e.target.value)} placeholder="Referenskod från beställaren" autoFocus />
          <label htmlFor={`diary-${contract.id}`}>Diarienummer</label>
          <input id={`diary-${contract.id}`} className={inputClass} value={diaryInput} onChange={(e) => setDiaryInput(e.target.value)} placeholder="t.ex. GNU 2026/60" />
          <div className="col-span-2 flex items-center gap-3 pt-1">
            <button
              onClick={() => void saveContract()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#fff] bg-[#20c58f] rounded-lg px-3 py-1.5 hover:brightness-110 disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Spara
            </button>
            {!settings && (
              <button onClick={() => setEditingContract(false)} disabled={saving} className={PAPER_LINK_CLASS} style={{ color: ink.muted }}>
                Avbryt
              </button>
            )}
          </div>
        </div>
      )}

      {/* 7.2+ Enheterna i omfattningen. Över tröskeln på pappret: bara
          mönstret och avvikelserna, raderna står i Bilaga A. */}
      {coveredLocations.length === 0 ? (
        <p className="font-sans text-[11px] italic py-2" style={{ color: ink.muted }}>
          Inga enheter i § 1 ännu.
        </p>
      ) : !settings && coveredLocations.length > FOLD_THRESHOLD ? (
        (() => {
          const withCode = coveredLocations.filter((u) => u.billing_reference)
          const counts = new Map<string, number>()
          for (const u of withCode) counts.set(u.billing_reference as string, (counts.get(u.billing_reference as string) ?? 0) + 1)
          const common = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null
          const deviating = common ? withCode.filter((u) => u.billing_reference !== common[0]) : []
          const missing = coveredLocations.length - withCode.length
          let no = 1
          return (
            <>
              {common && (
                <div className="flex items-center gap-2.5 py-1.5 border-b border-dotted text-[13px]" style={rowStyle}>
                  <span className="font-sans text-[10.5px] w-6 tabular-nums" style={numStyle}>7.{++no}</span>
                  <span className="font-semibold" style={{ color: ink.secondary }}>
                    {common[1]} enhet{common[1] === 1 ? '' : 'er'}
                    <span className="font-normal font-sans text-[11.5px] ml-1.5" style={{ color: ink.muted }}>se bilaga A</span>
                  </span>
                  <span className="flex-1 border-b border-dotted mx-1 translate-y-1" style={rowStyle} />
                  <span className="font-sans text-[12px] tabular-nums" style={{ color: ink.secondary }}>
                    <b style={{ color: ink.primary }}>{common[0]}</b> · Er referens
                  </span>
                </div>
              )}
              {deviating.map((unit) => (
                <div key={unit.id} className="flex items-center gap-2.5 py-1.5 border-b border-dotted text-[13px]" style={rowStyle}>
                  <span className="font-sans text-[10.5px] w-6 tabular-nums" style={numStyle}>7.{++no}</span>
                  <span className="font-semibold">
                    {customerRowName(unit)}
                    <span className="font-normal font-sans text-[11.5px] ml-1.5" style={{ color: ink.muted }}>avvikande</span>
                  </span>
                  <span className="flex-1 border-b border-dotted mx-1 translate-y-1" style={rowStyle} />
                  <span className="font-sans text-[12px] tabular-nums" style={{ color: ink.secondary }}>
                    <b style={{ color: ink.primary }}>{unit.billing_reference}</b> · Er referens
                  </span>
                </div>
              ))}
              {missing > 0 && (
                <div className="flex items-center gap-2.5 py-1.5 border-b border-dotted text-[13px]" style={rowStyle}>
                  <span className="font-sans text-[10.5px] w-6 tabular-nums" style={numStyle}>7.{++no}</span>
                  <span className="font-semibold" style={{ color: ink.warn }}>
                    {missing} enhet{missing === 1 ? '' : 'er'} saknar kod
                  </span>
                  <span className="flex-1 border-b border-dotted mx-1 translate-y-1" style={rowStyle} />
                  <span className="font-sans text-[12px]" style={{ color: ink.secondary }}>
                    {onOpenSettings && !archived ? (
                      <button type="button" onClick={onOpenSettings} className="underline decoration-dotted" style={{ color: ink.warn }}>
                        sätt under Referenser
                      </button>
                    ) : (
                      'beställaren anger kod på ärendet'
                    )}
                  </span>
                </div>
              )}
            </>
          )
        })()
      ) : (
        coveredLocations.map((unit, i) => {
          const isEditing = settings || editingUnit === unit.id
          return (
            <div key={unit.id} className="flex items-center gap-2.5 py-1.5 border-b border-dotted text-[13px]" style={rowStyle}>
              <span className="font-sans text-[10.5px] w-6 tabular-nums" style={numStyle}>8.{i + 2}</span>
              <span className="font-semibold">{customerRowName(unit)}</span>
              <span className="flex-1 border-b border-dotted mx-1 translate-y-1" style={rowStyle} />
              {isEditing ? (
                <span className="font-sans flex items-center gap-2">
                  <input
                    className={`${inputClass} w-36`}
                    value={settings ? (codeDrafts[unit.id] ?? unit.billing_reference ?? '') : codeInput}
                    onChange={(e) => (settings ? setCodeDrafts((d) => ({ ...d, [unit.id]: e.target.value })) : setCodeInput(e.target.value))}
                    placeholder="t.ex. YX301"
                    autoFocus={!settings}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void saveUnit(unit)
                      if (e.key === 'Escape' && !settings) setEditingUnit(null)
                    }}
                  />
                  <button
                    onClick={() => void saveUnit(unit)}
                    disabled={saving}
                    className="text-[11px] font-semibold text-[#fff] bg-[#20c58f] rounded-md px-2.5 py-1 hover:brightness-110 disabled:opacity-50"
                  >
                    Spara
                  </button>
                  {!settings && (
                    <button onClick={() => setEditingUnit(null)} disabled={saving} className={PAPER_LINK_CLASS} style={{ color: ink.muted }}>
                      Avbryt
                    </button>
                  )}
                </span>
              ) : (
                <>
                  <span className="font-sans text-[12px] tabular-nums" style={{ color: ink.secondary }}>
                    {unit.billing_reference ? (
                      <>
                        <b style={{ color: ink.primary }}>{unit.billing_reference}</b> · Er referens
                      </>
                    ) : onOpenSettings && !archived ? (
                      <button type="button" onClick={onOpenSettings} className="underline decoration-dotted" style={{ color: ink.warn }}>
                        kod saknas · sätt under Referenser
                      </button>
                    ) : (
                      'beställaren anger kod på ärendet'
                    )}
                  </span>
                </>
              )}
            </div>
          )
        })
      )}
      {settings && (
        <p className="font-sans text-[10.5px] leading-relaxed pt-1.5" style={{ color: ink.muted }}>
          Koden är enhetens fält Märkning faktura och förifylls på alla ärenden mot enheten, oavsett avtal. Saknar
          enheten kod hämtas Er referens från ärendet, där beställaren anger sin kod.
        </p>
      )}
    </div>
  )
}
