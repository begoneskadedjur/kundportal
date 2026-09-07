// src/components/admin/customers/record/PaperSignatures.tsx
// Avtalsobjektets text, säljarens signatur och kundansvarig-raden på
// avtalspappret. Utbrutna ur ContractMapSection så att inställningspanelen
// (gruppen Avtalet och Omfattning) kan rendera samma komponenter utan att
// importera hela kartan.

import { useState } from 'react'
import type { PaperInk } from './paperInk'

const AGREEMENT_PREVIEW_CHARS = 340

export function AgreementObjectText({
  text,
  onSave,
  ink,
}: {
  text: string | null
  /** Utelämnas på arkiverade avtal — texten blir då ren läsning. */
  onSave?: (text: string | null) => Promise<void>
  ink: PaperInk
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(text ?? '')
  const [saving, setSaving] = useState(false)

  const trimmed = (text ?? '').trim()
  const isLong = trimmed.length > AGREEMENT_PREVIEW_CHARS
  // Radbrytningar bär strukturen (en rad per anläggning i Oneflow-mallen)
  const shown = expanded || !isLong ? trimmed : trimmed.slice(0, AGREEMENT_PREVIEW_CHARS).trimEnd() + '…'

  const save = async () => {
    if (!onSave) return
    setSaving(true)
    try {
      await onSave(draft)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  // Ett arkiverat avtal utan avtalsobjekt har inget att visa och inget att
  // fylla i — då hoppar vi över hela sektionen i stället för att visa en
  // död rubrik.
  if (!onSave && !trimmed) return null

  return (
    <div className="mt-3">
      <div className="flex items-baseline gap-2 pb-1" style={{ borderBottom: `1px solid ${ink.rule}` }}>
        <h4
          className="font-sans text-[9.5px] font-bold uppercase tracking-[0.14em]"
          style={{ color: ink.muted }}
        >
          Avtalsobjekt
        </h4>
        <span className="ml-auto flex items-baseline gap-2">
          {isLong && !editing && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="font-sans text-[10px] underline decoration-dotted hover:opacity-70 transition-opacity"
              style={{ color: ink.muted }}
            >
              {expanded ? 'visa mindre' : 'visa hela'}
            </button>
          )}
          {onSave && !editing && (
            <button
              onClick={() => {
                setDraft(text ?? '')
                setEditing(true)
              }}
              className="font-sans text-[10px] text-[#8a9099] hover:text-[#262e38] underline decoration-dotted"
            >
              {trimmed ? 'redigera' : 'lägg till'}
            </button>
          )}
        </span>
      </div>

      {editing ? (
        <div className="pt-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={7}
            autoFocus
            placeholder={
              'Beskriv vad som ingår — t.ex.\n\nAnläggning A, 5 st Aurocon digital fälla, 10 st betade lådor utvändigt, 8 st invändiga kontrollstationer\nAnläggning B, 2 st Aurocon, 4 st utv betade lådor'
            }
            className="w-full font-sans text-[12px] leading-relaxed text-[#262e38] bg-white/70 border border-[#d9d3c2] rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50 resize-y"
          />
          <div className="flex items-center gap-2 mt-1.5">
            <button
              onClick={save}
              disabled={saving}
              className="font-sans text-[11px] font-semibold text-[#fff] bg-[#20c58f] rounded-md px-3 py-1.5 hover:brightness-110 disabled:opacity-50"
            >
              {saving ? 'Sparar…' : 'Spara'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="font-sans text-[11px] text-[#5d6672] hover:text-[#262e38] px-2 py-1.5"
            >
              Avbryt
            </button>
            <span className="ml-auto font-sans text-[10px] text-[#8a9099]">
              En rad per anläggning håller strukturen
            </span>
          </div>
        </div>
      ) : trimmed ? (
        <p
          className="text-[12.5px] leading-relaxed pt-1.5 whitespace-pre-line"
          style={{ color: ink.secondary }}
        >
          {shown}
        </p>
      ) : onSave ? (
        <button
          onClick={() => {
            setDraft('')
            setEditing(true)
          }}
          className="w-full text-left font-sans text-[11.5px] italic text-[#8a9099] hover:text-[#5d6672] pt-1.5"
        >
          Inget avtalsobjekt registrerat — beskriv vad som ingår och vad som är installerat.
        </button>
      ) : (
        <p className="font-sans text-[11.5px] italic pt-1.5" style={{ color: ink.muted }}>
          Inget avtalsobjekt registrerat.
        </p>
      )}
    </div>
  )
}

/**
 * Signaturraden på avtalspappret. Klick öppnar en inline-inmatning i SAMMA
 * skrivstil, samma lutning och samma storlek — pappret ser likadant ut oavsett
 * om man läser eller skriver. Enter sparar, Escape avbryter.
 *
 * Saknas säljare på avtalet visas kundkortets som fallback, men i dämpad ton
 * så det syns att värdet inte hör till avtalet självt.
 */
export function SignatureLine({
  value,
  fallback,
  ink,
  archived,
  staff,
  onSave,
}: {
  value: string | null
  fallback: string | null
  ink: PaperInk
  archived: boolean
  /** Aktiv personal att välja bland — aldrig fritext */
  staff: { id: string; name: string }[]
  /** Utelämnas på arkiverade avtal — en avslutad underskrift ändras inte */
  onSave?: (name: string | null) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? fallback ?? '')
  const [saving, setSaving] = useState(false)

  const shown = value ?? fallback
  const isFallback = !value && !!fallback
  const signatureStyle = {
    fontFamily: "'Segoe Script', 'Brush Script MT', cursive",
    color: archived ? '#3a424f' : '#2f3a46',
  }

  const commitValue = async (next: string) => {
    if (!onSave) return
    const clean = next.trim() || null
    if (clean === value) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onSave(clean)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    // Väljare, aldrig fritext: 21 unika namn hade redan hunnit uppstå i
    // avtalen mot 12 i personalregistret. Select-elementet ärver skrivstilen
    // så raden ser ut som en underskrift även medan man väljer.
    return (
      <div className="shrink-0 min-w-[190px]">
        <select
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            void commitValue(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setDraft(value ?? fallback ?? '')
              setEditing(false)
            }
          }}
          autoFocus
          disabled={saving}
          className="inline-block -rotate-2 text-[17px] bg-transparent border-0 border-b border-dashed p-0 pr-5 focus:outline-none focus:ring-0 w-full cursor-pointer appearance-none"
          style={{ ...signatureStyle, borderBottomColor: ink.muted }}
          aria-label="Säljare"
        >
          <option value="">— ingen säljare —</option>
          {staff.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
          {/* Namn som redan står på avtalet men saknas i personalregistret
              (t.ex. någon som slutat) får inte tappas bort vid redigering */}
          {value && !staff.some((s) => s.name === value) && (
            <option value={value}>{value} (ej i personalregistret)</option>
          )}
        </select>
        <div
          className="mt-0.5 pt-0.5 font-sans text-[9.5px] tracking-wide"
          style={{ borderTop: `1px solid ${ink.secondary}`, color: ink.muted }}
        >
          {saving ? 'Sparar…' : 'Välj säljare · Esc avbryter'}
        </div>
      </div>
    )
  }

  if (!shown) {
    if (!onSave) return null
    return (
      <button
        onClick={() => {
          setDraft('')
          setEditing(true)
        }}
        className="shrink-0 font-sans text-[10px] italic hover:opacity-70 transition-opacity"
        style={{ color: ink.muted }}
      >
        Ange säljare
      </button>
    )
  }

  return (
    <div className="shrink-0">
      <button
        onClick={onSave ? () => { setDraft(value ?? fallback ?? ''); setEditing(true) } : undefined}
        disabled={!onSave}
        className={onSave ? 'block text-left cursor-text' : 'block text-left cursor-default'}
        title={onSave ? 'Klicka för att ändra säljare' : undefined}
      >
        <span
          className="inline-block -rotate-2 text-[17px]"
          style={{ ...signatureStyle, opacity: isFallback ? 0.6 : 1 }}
        >
          {shown}
        </span>
        <span
          className="block mt-0.5 pt-0.5 font-sans text-[9.5px] tracking-wide"
          style={{ borderTop: `1px solid ${ink.secondary}`, color: ink.muted }}
        >
          {shown} · BeGone Skadedjur &amp; Sanering AB
          {isFallback && <span className="italic"> · från kundkortet</span>}
        </span>
      </button>
    </div>
  )
}

/**
 * Kundansvarig-raden under säljarens signatur på avtalspappret. Följer
 * AVTALET (kunden kan ha två avtal med olika ansvariga för olika enheter);
 * kundkortets värde visas som dämpad fallback tills avtalet fått ett eget.
 * Väljs ur personalregistret, aldrig fritext — e-posten följer med från
 * registret och speglas till kundraderna som avtalet omfattar.
 */
export function AccountManagerLine({
  value,
  email,
  fallback,
  ink,
  archived,
  staff,
  onSave,
}: {
  value: string | null
  email: string | null
  fallback: string | null
  ink: PaperInk
  archived: boolean
  staff: { id: string; name: string; email?: string | null }[]
  /** Utelämnas på arkiverade avtal */
  onSave?: (name: string | null, email: string | null) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const shown = value ?? fallback
  const isFallback = !value && !!fallback
  const nameColor = archived ? '#3a424f' : '#2f3a46'

  const commit = async (nextName: string) => {
    if (!onSave) return
    const clean = nextName.trim() || null
    if (clean === value) {
      setEditing(false)
      return
    }
    // Registerval ger registrets e-post; ett kvarstående namn utanför
    // registret (någon som slutat) behåller sin sparade e-post.
    const match = staff.find((s) => s.name === clean)
    const nextEmail = clean === null ? null : match ? (match.email ?? null) : email
    setSaving(true)
    try {
      await onSave(clean, nextEmail)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="font-sans text-[10px]" style={{ color: ink.muted }}>
        Kundansvarig ·{' '}
        <select
          defaultValue={value ?? ''}
          onChange={(e) => void commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false)
          }}
          autoFocus
          disabled={saving}
          className="bg-transparent border-0 border-b border-dashed p-0 pr-4 text-[10px] focus:outline-none focus:ring-0 cursor-pointer appearance-none"
          style={{ color: nameColor, borderBottomColor: ink.muted }}
          aria-label="Kundansvarig"
        >
          <option value="">— ingen kundansvarig —</option>
          {staff.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
          {value && !staff.some((s) => s.name === value) && (
            <option value={value}>{value} (ej i personalregistret)</option>
          )}
        </select>
        {saving && <span className="italic"> sparar…</span>}
      </div>
    )
  }

  if (!shown) {
    if (!onSave) return null
    return (
      <button
        onClick={() => setEditing(true)}
        className="block font-sans text-[10px] text-[#b45309] hover:text-[#262e38] underline decoration-dotted transition-colors"
        title="Ange kundansvarig för avtalet — speglas till enheterna i § 1 Omfattning"
      >
        Ange kundansvarig
      </button>
    )
  }

  return (
    <button
      onClick={onSave ? () => setEditing(true) : undefined}
      disabled={!onSave}
      className={`block text-left font-sans text-[10px] transition-opacity ${
        onSave ? 'hover:opacity-70' : 'cursor-default'
      }`}
      style={{ color: ink.muted }}
      title={onSave ? 'Klicka för att byta kundansvarig' : undefined}
    >
      Kundansvarig ·{' '}
      <span className="font-semibold" style={{ color: nameColor, opacity: isFallback ? 0.6 : 1 }}>
        {shown}
      </span>
      {isFallback && <span className="italic"> · från kundkortet</span>}
    </button>
  )
}

