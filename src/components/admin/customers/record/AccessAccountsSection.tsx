// src/components/admin/customers/record/AccessAccountsSection.tsx
// Åtkomst & konton-fliken (etapp 6): läsvy över vilka personer som når portalen
// för kundfamiljen — kundportal-konton (profiles), multisite-roller
// (verksamhetschef/regionchef/platsansvarig) och utestående inbjudningar.
// Inga formulär i v1 — hantering sker via /admin/anvandarkonton-kund.

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import {
  customerRowName,
  formatDateSv,
  type RecordAccessData,
  type RecordCustomer,
} from '../../../../hooks/useCustomerRecord'

type PersonStatus = 'active' | 'invited' | 'never'

interface AccessPerson {
  key: string
  name: string
  email: string | null
  roleLabel: string
  status: PersonStatus
  statusText: string
  /** Enheter för multisite-roller, eller enhetsraden ett kundportal-konto hör till */
  units: string | null
}

const ROLE_LABEL: Record<string, string> = {
  verksamhetschef: 'Verksamhetschef',
  regionchef: 'Regionchef',
  platsansvarig: 'Platsansvarig',
}

const DOT_CLASS: Record<PersonStatus, string> = {
  active: 'bg-[#20c58f]',
  invited: 'bg-amber-400',
  never: 'bg-slate-600',
}

function hasSignedIn(p: {
  has_ever_signed_in?: boolean | null
  last_sign_in_at?: string | null
  last_login: string | null
}): boolean {
  return !!(p.has_ever_signed_in || p.last_sign_in_at || p.last_login)
}

function lastLoginOf(p: { last_sign_in_at?: string | null; last_login: string | null }): string | null {
  return p.last_sign_in_at ?? p.last_login ?? null
}

/** Bygger personlistan: multisite-roller → kundportal-konton → öppna inbjudningar */
export function buildAccessPersons(
  access: RecordAccessData,
  customerById?: Map<string, RecordCustomer>
): AccessPerson[] {
  const persons: AccessPerson[] = []
  const seenEmails = new Set<string>()

  for (const u of access.multisiteUsers) {
    if (u.email) seenEmails.add(u.email.toLowerCase())
    const active = hasSignedIn(u)
    const last = lastLoginOf(u)

    let units: string | null = null
    if (u.role_type === 'verksamhetschef') {
      units = 'Alla enheter'
    } else if (u.site_ids && u.site_ids.length > 0) {
      const names = u.site_ids
        .map((id) => {
          const c = customerById?.get(id)
          return c ? customerRowName(c) : null
        })
        .filter((n): n is string => !!n)
      units = names.length > 0 ? names.join(', ') : `${u.site_ids.length} enheter`
    }

    persons.push({
      key: `roll-${u.id}`,
      name: u.display_name || u.email || 'Okänd användare',
      email: u.email,
      roleLabel: ROLE_LABEL[u.role_type] ?? u.role_type,
      status: active ? 'active' : 'invited',
      statusText: active
        ? last
          ? `Senast inloggad ${formatDateSv(last)}`
          : 'Aktiv'
        : 'Inbjuden, ej inloggad',
      units,
    })
  }

  for (const p of access.profiles) {
    if (p.email) seenEmails.add(p.email.toLowerCase())
    const active = hasSignedIn(p)
    const last = lastLoginOf(p)
    const row = p.customer_id ? customerById?.get(p.customer_id) : undefined

    persons.push({
      key: `profil-${p.user_id}`,
      name: p.display_name || p.email || 'Okänd användare',
      email: p.email,
      roleLabel: 'Kundportal',
      status: active ? 'active' : 'invited',
      statusText: active
        ? last
          ? `Senast inloggad ${formatDateSv(last)}`
          : 'Aktiv'
        : 'Inbjuden, ej inloggad',
      units: row?.parent_customer_id ? customerRowName(row) : null,
    })
  }

  // Inbjudningar utan matchande konto (dubbletter per e-post hoppas över)
  const now = Date.now()
  for (const inv of access.invitations) {
    const email = inv.email?.toLowerCase()
    if (!email || seenEmails.has(email)) continue
    seenEmails.add(email)

    const row = customerById?.get(inv.customer_id)
    const expired = !inv.accepted_at && !!inv.expires_at && new Date(inv.expires_at).getTime() < now

    let status: PersonStatus
    let statusText: string
    if (inv.accepted_at) {
      status = 'active'
      statusText = `Accepterad ${formatDateSv(inv.accepted_at)}`
    } else if (expired) {
      status = 'never'
      statusText = `Inbjudan utgången ${formatDateSv(inv.expires_at)}`
    } else {
      status = 'invited'
      statusText = inv.created_at ? `Inbjuden ${formatDateSv(inv.created_at)}` : 'Inbjuden'
    }

    persons.push({
      key: `inbjudan-${inv.id}`,
      name: inv.email,
      email: null,
      roleLabel: 'Kundportal',
      status,
      statusText,
      units: row?.parent_customer_id ? customerRowName(row) : null,
    })
  }

  return persons
}

/** Antal personer i fliken — används för flikens räknare */
export function countAccessPersons(access: RecordAccessData): number {
  return buildAccessPersons(access).length
}

interface Props {
  access: RecordAccessData
  /** Kundrader i familjen — för enhetsnamn på roller och konton */
  customerById: Map<string, RecordCustomer>
}

export default function AccessAccountsSection({ access, customerById }: Props) {
  const persons = useMemo(() => buildAccessPersons(access, customerById), [access, customerById])

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xs uppercase tracking-wide text-slate-500">
          Åtkomst & konton ({persons.length})
        </h2>
        <Link
          to="/admin/anvandarkonton-kund"
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-[#20c58f] transition-colors"
        >
          Hantera konton
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {persons.length === 0 ? (
        <p className="text-sm text-slate-500">Ingen har bjudits in till portalen ännu.</p>
      ) : (
        <ul className="divide-y divide-slate-800/60">
          {persons.map((p) => (
            <li key={p.key} className="flex items-center gap-3 py-2 text-sm min-w-0">
              <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_CLASS[p.status]}`} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-slate-200 truncate">{p.name}</span>
                {p.email && p.email !== p.name && (
                  <span className="block text-xs text-slate-500 truncate">{p.email}</span>
                )}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-slate-400 border border-slate-700 rounded px-1.5 py-0.5 shrink-0">
                {p.roleLabel}
              </span>
              {p.units && <span className="hidden sm:block text-xs text-slate-500 truncate max-w-[220px]">{p.units}</span>}
              <span className="text-xs text-slate-500 shrink-0">{p.statusText}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
