// src/components/admin/procurement/registry/BuyerContacts.tsx
// Köparprofilens Kontaktpersoner (sedan 3.65.0): kontakter ur annonserna (TED
// eForms kontaktpunkt, sparas av synken i procurement_contacts) och manuellt
// tillagda med namn, roll, telefon, e-post och senast kontakt. Kopiera telefon
// och e-post med navigator.clipboard. Registratorns adress visas sist.

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Icon } from '../../../icons/Icon'
import { ProcurementService } from '../../../../services/procurementService'
import { todaySwedish } from '../../../../shared/procurementRules'
import type { ProcurementContact } from '../../../../types/procurement'
import { EmptyState, IconButton, LinkButton, PrimaryButton, SecondaryButton } from '../ui'
import { fmtDate } from '../uiFormat'

const SOURCE_LABEL: Record<ProcurementContact['source'], string> = { ted: 'ur TED-annons', mercell: 'ur Mercell', manual: 'tillagd manuellt' }

const inputCls =
  'w-full h-10 px-3 text-[13px] bg-slate-800/50 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#20c58f]/50'

async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${what} kopierad`)
  } catch {
    toast.error('Kunde inte kopiera')
  }
}

type Draft = { id?: string; name: string; role: string; phone: string; email: string; last_contacted_at: string }

const EMPTY: Draft = { name: '', role: '', phone: '', email: '', last_contacted_at: '' }

function ContactForm({ draft, onCancel, onSaved, buyerId }: { draft: Draft; onCancel: () => void; onSaved: (c: ProcurementContact) => void; buyerId: string }) {
  const [d, setD] = useState<Draft>(draft)
  const [saving, setSaving] = useState(false)
  const emailOk = !d.email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())
  const valid = (d.name.trim() || d.email.trim()) && emailOk

  const save = async () => {
    if (!valid) {
      toast.error(emailOk ? 'Ange namn eller e-post' : 'E-postadressen ser inte giltig ut')
      return
    }
    setSaving(true)
    try {
      const c = await ProcurementService.saveContact({ id: d.id, buyer_id: buyerId, name: d.name, role: d.role, phone: d.phone, email: d.email, last_contacted_at: d.last_contacted_at || null })
      toast.success('Kontakten är sparad')
      onSaved(c)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte spara kontakten')
    } finally {
      setSaving(false)
    }
  }

  const field = (key: keyof Draft, label: string, props: { type?: string; placeholder?: string } = {}) => (
    <label className="block">
      <span className="block text-[11px] text-slate-500 mb-1">{label}</span>
      <input className={inputCls} value={d[key] ?? ''} onChange={(e) => setD({ ...d, [key]: e.target.value })} {...props} />
    </label>
  )

  return (
    <div className="p-4 space-y-3 border-b border-slate-800">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {field('name', 'Namn', { placeholder: 'Förnamn Efternamn' })}
        {field('role', 'Roll', { placeholder: 'Upphandlare, fastighetschef ...' })}
        {field('phone', 'Telefon', { type: 'tel', placeholder: '010-123 45 67' })}
        {field('email', 'E-post', { type: 'email', placeholder: 'namn@kommun.se' })}
        {field('last_contacted_at', 'Senast kontakt', { type: 'date' })}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PrimaryButton onClick={() => void save()} disabled={saving || !valid}>
          <Icon name="allman.bock" size={20} />
          Spara kontakt
        </PrimaryButton>
        <SecondaryButton onClick={onCancel} disabled={saving}>Avbryt</SecondaryButton>
      </div>
    </div>
  )
}

interface Props {
  buyerId: string
  contacts: ProcurementContact[]
  registrarEmail: string | null
  onChange: (list: ProcurementContact[]) => void
  /** Styrs från sidhuvudets knapp Lägg till kontakt */
  adding: boolean
  setAdding: (on: boolean) => void
}

export default function BuyerContacts({ buyerId, contacts, registrarEmail, onChange, adding, setAdding }: Props) {
  const [editing, setEditing] = useState<string | null>(null)

  const markContacted = async (c: ProcurementContact) => {
    try {
      const saved = await ProcurementService.saveContact({ ...c, buyer_id: buyerId, last_contacted_at: todaySwedish() })
      onChange(contacts.map((x) => (x.id === c.id ? saved : x)))
      toast.success('Senast kontakt satt till i dag')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte spara')
    }
  }

  const remove = async (c: ProcurementContact) => {
    if (!window.confirm(`Ta bort ${c.name ?? c.email ?? 'kontakten'}?`)) return
    try {
      await ProcurementService.deleteContact(c.id)
      onChange(contacts.filter((x) => x.id !== c.id))
      toast.success('Kontakten är borttagen')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kunde inte ta bort kontakten')
    }
  }

  return (
    <div>
      {adding && (
        <ContactForm
          draft={EMPTY}
          buyerId={buyerId}
          onCancel={() => setAdding(false)}
          onSaved={(c) => {
            onChange([c, ...contacts])
            setAdding(false)
          }}
        />
      )}
      {contacts.length === 0 && !adding && !registrarEmail ? (
        <EmptyState
          title="Inga kontaktpersoner"
          hint="Kontaktpunkten i TED-annonserna sparas här automatiskt. Lägg till upphandlare och fastighetsansvariga manuellt."
          icon={<Icon name="upphandling.kontaktperson" size={32} />}
        />
      ) : (
        <ul className="divide-y divide-slate-800">
          {contacts.map((c) =>
            editing === c.id ? (
              <li key={c.id}>
                <ContactForm
                  draft={{ id: c.id, name: c.name ?? '', role: c.role ?? '', phone: c.phone ?? '', email: c.email ?? '', last_contacted_at: c.last_contacted_at ?? '' }}
                  buyerId={buyerId}
                  onCancel={() => setEditing(null)}
                  onSaved={(saved) => {
                    onChange(contacts.map((x) => (x.id === c.id ? saved : x)))
                    setEditing(null)
                  }}
                />
              </li>
            ) : (
              <li key={c.id} className="flex items-start justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-slate-100">{c.name ?? c.email ?? 'Namn saknas'}</div>
                  <div className="text-[12px] text-slate-500">
                    {c.role ?? 'Roll okänd'} · {c.last_contacted_at ? `senast kontakt ${fmtDate(c.last_contacted_at)}` : 'inte kontaktad'} · {SOURCE_LABEL[c.source]}
                  </div>
                  <div className="text-[12px] text-slate-400 tabular-nums break-all">{[c.phone, c.email].filter(Boolean).join(' · ') || 'Telefon och e-post saknas'}</div>
                  <div className="flex gap-3 mt-0.5">
                    <LinkButton tone="muted" onClick={() => void markContacted(c)}>Kontaktad i dag</LinkButton>
                    <LinkButton tone="muted" onClick={() => setEditing(c.id)}>Ändra</LinkButton>
                    <LinkButton tone="danger" onClick={() => void remove(c)}>Ta bort</LinkButton>
                  </div>
                </div>
                <div className="flex shrink-0">
                  {c.phone && <IconButton icon={<Icon name="kontakt.telefon" size={20} />} label={`Kopiera telefonnummer ${c.phone}`} onClick={() => void copy(c.phone!, 'Telefonnumret')} />}
                  {c.email && <IconButton icon={<Icon name="kontakt.mejl" size={20} />} label={`Kopiera e-post ${c.email}`} onClick={() => void copy(c.email!, 'E-postadressen')} />}
                </div>
              </li>
            )
          )}
          {registrarEmail && (
            <li className="flex items-start justify-between gap-2 px-4 py-2.5">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-slate-100">Registrator</div>
                <div className="text-[12px] text-slate-500 break-all">Begäran om handlingar · {registrarEmail}</div>
              </div>
              <IconButton icon={<Icon name="kontakt.mejl" size={20} />} label={`Kopiera e-post ${registrarEmail}`} onClick={() => void copy(registrarEmail, 'E-postadressen')} />
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
