// src/components/admin/customers/record/ContractReferencesSection.tsx
// § 8 Referenser på avtalspappret i Avtalskartan.
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
import { PAPER_INPUT_CLASS, PAPER_LINK_CLASS, type PaperInk } from './paperInk'

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
}: Props) {
  const [editingContract, setEditingContract] = useState(false)
  const [refInput, setRefInput] = useState('')
  const [diaryInput, setDiaryInput] = useState('')
  const [editingUnit, setEditingUnit] = useState<string | null>(focusUnitId ?? null)
  const [codeInput, setCodeInput] = useState('')
  const [saving, setSaving] = useState(false)

  // Släpp av en enhet öppnar dess rad direkt
  if (focusUnitId && editingUnit !== focusUnitId) {
    setEditingUnit(focusUnitId)
    setCodeInput('')
    onFocusHandled?.()
  }

  const canEditContract = !archived && !!onSaveInvoiceReference
  const canEditUnit = !archived && !!onSaveUnitReference
  const rowStyle = { borderColor: ink.rule }
  const numStyle = { color: ink.muted }

  const openContractEdit = () => {
    setRefInput(contract.invoice_reference ?? '')
    setDiaryInput(contract.diary_number ?? '')
    setEditingContract(true)
  }

  const saveContract = async () => {
    if (!onSaveInvoiceReference) return
    setSaving(true)
    try {
      await onSaveInvoiceReference({ invoiceReference: refInput.trim() || null, diaryNumber: diaryInput.trim() || null })
      setEditingContract(false)
    } finally {
      setSaving(false)
    }
  }

  const openUnitEdit = (unit: RecordCustomer) => {
    setCodeInput(unit.billing_reference ?? '')
    setEditingUnit(unit.id)
  }

  const saveUnit = async (unit: RecordCustomer) => {
    if (!onSaveUnitReference) return
    setSaving(true)
    try {
      await onSaveUnitReference(unit, codeInput.trim() || null)
      setEditingUnit(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-3.5">
      <div className="flex items-baseline gap-2 border-b-[1.5px] pb-1" style={{ borderColor: ink.primary }}>
        <h4 className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: ink.primary }}>
          § 8 · Referenser
        </h4>
        <span className="ml-auto font-sans text-[10.5px]" style={{ color: ink.muted }}>
          skrivs som Er referens på fakturan
        </span>
      </div>

      {/* 8.1 Avtalets referens */}
      {!editingContract ? (
        <div className="flex items-center gap-2.5 py-1.5 border-b border-dotted text-[13px]" style={rowStyle}>
          <span className="font-sans text-[10.5px] w-6 tabular-nums" style={numStyle}>8.1</span>
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
          {canEditContract && (
            <button onClick={openContractEdit} className={PAPER_LINK_CLASS} style={{ color: ink.muted }} title="Ändra avtalets referens och diarienummer">
              ändra
            </button>
          )}
        </div>
      ) : (
        <div className="font-sans py-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-center text-[12px]" style={{ color: ink.secondary }}>
          <label htmlFor={`ref-${contract.id}`}>Er referens</label>
          <input id={`ref-${contract.id}`} className={PAPER_INPUT_CLASS} value={refInput} onChange={(e) => setRefInput(e.target.value)} placeholder="Referenskod från beställaren" autoFocus />
          <label htmlFor={`diary-${contract.id}`}>Diarienummer</label>
          <input id={`diary-${contract.id}`} className={PAPER_INPUT_CLASS} value={diaryInput} onChange={(e) => setDiaryInput(e.target.value)} placeholder="t.ex. GNU 2026/60" />
          <div className="col-span-2 flex items-center gap-3 pt-1">
            <button
              onClick={() => void saveContract()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#fff] bg-[#20c58f] rounded-lg px-3 py-1.5 hover:brightness-110 disabled:opacity-50"
            >
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Spara
            </button>
            <button onClick={() => setEditingContract(false)} disabled={saving} className={PAPER_LINK_CLASS} style={{ color: ink.muted }}>
              Avbryt
            </button>
          </div>
        </div>
      )}

      {/* 8.2+ Enheterna i omfattningen */}
      {coveredLocations.length === 0 ? (
        <p className="font-sans text-[11px] italic py-2" style={{ color: ink.muted }}>
          Inga enheter i § 1 ännu.
        </p>
      ) : (
        coveredLocations.map((unit, i) => {
          const isEditing = editingUnit === unit.id
          return (
            <div key={unit.id} className="flex items-center gap-2.5 py-1.5 border-b border-dotted text-[13px]" style={rowStyle}>
              <span className="font-sans text-[10.5px] w-6 tabular-nums" style={numStyle}>8.{i + 2}</span>
              <span className="font-semibold">{customerRowName(unit)}</span>
              <span className="flex-1 border-b border-dotted mx-1 translate-y-1" style={rowStyle} />
              {isEditing ? (
                <span className="font-sans flex items-center gap-2">
                  <input
                    className={`${PAPER_INPUT_CLASS} w-36`}
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value)}
                    placeholder="t.ex. YX301"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void saveUnit(unit)
                      if (e.key === 'Escape') setEditingUnit(null)
                    }}
                  />
                  <button
                    onClick={() => void saveUnit(unit)}
                    disabled={saving}
                    className="text-[11px] font-semibold text-[#fff] bg-[#20c58f] rounded-md px-2.5 py-1 hover:brightness-110 disabled:opacity-50"
                  >
                    Spara
                  </button>
                  <button onClick={() => setEditingUnit(null)} disabled={saving} className={PAPER_LINK_CLASS} style={{ color: ink.muted }}>
                    Avbryt
                  </button>
                </span>
              ) : (
                <>
                  <span className="font-sans text-[12px] tabular-nums" style={{ color: ink.secondary }}>
                    {unit.billing_reference ? (
                      <>
                        <b style={{ color: ink.primary }}>{unit.billing_reference}</b> · Er referens
                      </>
                    ) : (
                      'dynamisk · beställaren anger kod på ärendet'
                    )}
                  </span>
                  {canEditUnit && (
                    <button
                      onClick={() => openUnitEdit(unit)}
                      className={PAPER_LINK_CLASS}
                      style={{ color: ink.muted }}
                      title="Skriver enhetens fält Märkning faktura (samma som i Redigera enhet)"
                    >
                      {unit.billing_reference ? 'ändra' : 'sätt kod'}
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })
      )}
      <p className="font-sans text-[10.5px] leading-relaxed pt-1.5" style={{ color: ink.muted }}>
        Koden är enhetens fält Märkning faktura och förifylls på alla ärenden mot enheten, oavsett avtal. Saknar
        enheten kod hämtas Er referens från ärendet, där beställaren anger sin kod.
        {canEditUnit ? ' Dra in en enhet från vänster hit för att ge den en kod.' : ''}
      </p>
    </div>
  )
}
