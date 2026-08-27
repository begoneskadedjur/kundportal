// src/components/admin/customers/record/AccessAccountsSection.tsx
//
// Åtkomst & konton: vilka personer som når portalen för kundfamiljen, hur ofta
// de faktiskt loggar in, vilken enhet de täcker och vad som skickats till dem.
//
// Tre sektioner:
//   Användning     - personlistan med livstidsband och senaste inloggning
//   Täckning       - har varje enhet en ansvarig, och är den ansvarige vaken
//   Kontohistorik  - inbjudningar och lösenordsutskick per person
//
// Ingen hantering här (inga formulär) - det sker via /admin/anvandarkonton-kund.
//
// Designnot: rollen sätts som vanlig text med enheten under, inte som en
// inramad box. Nyckeltalen bärs av löptext med feta tal, inte av KPI-kort.

import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, ChevronRight } from 'lucide-react'
import {
  customerRowName,
  formatDateSv,
  type RecordAccessData,
  type RecordAccountEvent,
  type RecordCustomer,
  type RecordLoginStats,
} from '../../../../hooks/useCustomerRecord'

/** aktiv = inne senaste 30 dagarna, kall = tyst 90+, aldrig = har aldrig loggat in */
type PersonStatus = 'active' | 'idle' | 'cold' | 'never'

interface AccessPerson {
  key: string
  userId: string | null
  name: string
  email: string | null
  roleLabel: string
  /** Enhetsnamn för multisite-roller, eller enhetsraden ett konto hör till */
  scope: string | null
  status: PersonStatus
  lastLogin: string | null
  daysSince: number | null
  loginCount: number
  activeMonths: number
  /** En stapel per månad från kontots första spår till idag */
  band: { month: string; count: number }[]
  /** Antal lösenordsutskick — säger något först när personen aldrig loggat in */
  passwordSends: number
  accountCreated: string | null
}

const ROLE_LABEL: Record<string, string> = {
  verksamhetschef: 'Verksamhetschef',
  regionchef: 'Regionchef',
  platsansvarig: 'Platsansvarig',
}

const DOT_CLASS: Record<PersonStatus, string> = {
  active: 'bg-[#20c58f]',
  idle: 'bg-[#e0a83a]',
  cold: 'bg-[#e46a5f]',
  never: 'border border-slate-500 bg-transparent',
}

const DAY = 86_400_000

function daysBetween(iso: string | null): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / DAY)
}

function statusFromDays(days: number | null): PersonStatus {
  if (days === null) return 'never'
  if (days <= 30) return 'active'
  if (days < 90) return 'idle'
  return 'cold'
}

/** "Igår", "3 dgr sedan", "134 dgr sedan" — relativ tid är poängen, inte datumet */
function relativeDays(days: number | null): string {
  if (days === null) return 'Aldrig'
  if (days === 0) return 'Idag'
  if (days === 1) return 'Igår'
  return `${days} dgr sedan`
}

/**
 * Bygger ett band från kontots första månad till innevarande, så tomma
 * månader före kontot fanns aldrig ritas. Utan spår alls: tolv tomma.
 */
function buildBand(
  stats: RecordLoginStats | undefined,
  accountCreated: string | null
): { month: string; count: number }[] {
  const byMonth = new Map<string, number>()
  for (const m of stats?.monthly ?? []) {
    byMonth.set(String(m.month).slice(0, 7), m.count)
  }

  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), 1)

  const firstSeen = stats?.first_login ?? accountCreated
  let start = firstSeen ? new Date(firstSeen) : null
  if (start && !Number.isNaN(start.getTime())) {
    start = new Date(start.getFullYear(), start.getMonth(), 1)
  } else {
    start = null
  }

  // Håll bandet läsbart: minst 6, som mest 18 månader.
  const maxMonths = 18
  if (!start) {
    start = new Date(end.getFullYear(), end.getMonth() - 11, 1)
  }
  let span = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1
  if (span > maxMonths) {
    start = new Date(end.getFullYear(), end.getMonth() - (maxMonths - 1), 1)
    span = maxMonths
  }
  if (span < 6) {
    start = new Date(end.getFullYear(), end.getMonth() - 5, 1)
    span = 6
  }

  const out: { month: string; count: number }[] = []
  for (let i = 0; i < span; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    out.push({ month: key, count: byMonth.get(key) ?? 0 })
  }
  return out
}

/** Personlistan: multisite-roller först, sedan kundportal-konton, sist öppna inbjudningar */
export function buildAccessPersons(
  access: RecordAccessData,
  customerById?: Map<string, RecordCustomer>
): AccessPerson[] {
  const persons: AccessPerson[] = []
  const seenEmails = new Set<string>()

  const eventsByUser = new Map<string, RecordAccountEvent[]>()
  for (const e of access.accountEvents ?? []) {
    const list = eventsByUser.get(e.user_id) ?? []
    list.push(e)
    eventsByUser.set(e.user_id, list)
  }

  const build = (
    key: string,
    userId: string,
    name: string,
    email: string | null,
    roleLabel: string,
    scope: string | null
  ): AccessPerson => {
    const stats = access.loginStats?.get(userId)
    const events = eventsByUser.get(userId) ?? []
    const invited = events.filter((e) => e.event_type === 'invited')
    const lastLogin = stats?.last_login ?? null
    const days = daysBetween(lastLogin)
    // Kontots startpunkt: inbjudan är sannast, annars första inloggningen.
    const created = invited.length > 0 ? invited[invited.length - 1].created_at : (stats?.first_login ?? null)

    return {
      key,
      userId,
      name,
      email,
      roleLabel,
      scope,
      status: statusFromDays(days),
      lastLogin,
      daysSince: days,
      loginCount: stats?.login_count ?? 0,
      activeMonths: stats?.active_months ?? 0,
      band: buildBand(stats, created),
      passwordSends: events.filter((e) => e.event_type === 'password_sent').length,
      accountCreated: created,
    }
  }

  for (const u of access.multisiteUsers) {
    if (u.email) seenEmails.add(u.email.toLowerCase())

    let scope: string | null = null
    if (u.role_type === 'verksamhetschef') {
      scope = 'Alla enheter'
    } else if (u.site_ids && u.site_ids.length > 0) {
      const names = u.site_ids
        .map((id) => {
          const c = customerById?.get(id)
          return c ? customerRowName(c) : null
        })
        .filter((n): n is string => !!n)
      scope = names.length > 0 ? names.join(', ') : `${u.site_ids.length} enheter`
    }

    persons.push(
      build(
        `roll-${u.id}`,
        u.user_id,
        u.display_name || u.email || 'Okänd användare',
        u.email,
        ROLE_LABEL[u.role_type] ?? u.role_type,
        scope
      )
    )
  }

  for (const p of access.profiles) {
    if (p.email) seenEmails.add(p.email.toLowerCase())
    const row = p.customer_id ? customerById?.get(p.customer_id) : undefined
    persons.push(
      build(
        `profil-${p.user_id}`,
        p.user_id,
        p.display_name || p.email || 'Okänd användare',
        p.email,
        'Kundportal',
        row?.parent_customer_id ? customerRowName(row) : null
      )
    )
  }

  // Öppna inbjudningar utan matchande konto. Dessa har inget user_id och alltså
  // varken band eller historik - de väntar bara på svar.
  const now = Date.now()
  for (const inv of access.invitations) {
    const email = inv.email?.toLowerCase()
    if (!email || seenEmails.has(email)) continue
    if (inv.accepted_at) continue
    seenEmails.add(email)

    const expired = !!inv.expires_at && new Date(inv.expires_at).getTime() < now
    const row = customerById?.get(inv.customer_id)
    persons.push({
      key: `inbjudan-${inv.id}`,
      userId: null,
      name: inv.email,
      email: null,
      roleLabel: expired ? 'Inbjudan utgången' : 'Inbjuden',
      scope: row?.parent_customer_id ? customerRowName(row) : null,
      status: 'never',
      lastLogin: null,
      daysSince: null,
      loginCount: 0,
      activeMonths: 0,
      band: [],
      passwordSends: 0,
      accountCreated: inv.created_at,
    })
  }

  // Vakna först, tystaste sist — den som behöver åtgärd hamnar längst ned där
  // ögat landar efter att ha läst sammanfattningen.
  const order: Record<PersonStatus, number> = { active: 0, idle: 1, cold: 2, never: 3 }
  return persons.sort((a, b) => {
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
    return b.loginCount - a.loginCount
  })
}

/** Antal personer i fliken — används för flikens räknare */
export function countAccessPersons(access: RecordAccessData): number {
  return buildAccessPersons(access).length
}

interface Props {
  access: RecordAccessData
  /** Kundrader i familjen — för enhetsnamn på roller och konton */
  customerById: Map<string, RecordCustomer>
  /** Enheterna under kunden — driver täckningsraden */
  units: RecordCustomer[]
}

export default function AccessAccountsSection({ access, customerById, units }: Props) {
  const persons = useMemo(() => buildAccessPersons(access, customerById), [access, customerById])
  const [openHistory, setOpenHistory] = useState<string | null>(null)

  const summary = useMemo(() => {
    const withLogin = persons.filter((p) => p.loginCount > 0)
    const cold = persons.filter((p) => p.status === 'cold')
    const never = persons.filter((p) => p.status === 'never')
    const totalLogins = persons.reduce((s, p) => s + p.loginCount, 0)
    const mostRecent = withLogin.reduce<AccessPerson | null>(
      (best, p) => (!best || (p.daysSince ?? 1e9) < (best.daysSince ?? 1e9) ? p : best),
      null
    )
    const neverWithSends = never.filter((p) => p.passwordSends > 0)
    return { withLogin, cold, never, totalLogins, mostRecent, neverWithSends }
  }, [persons])

  const eventsByUser = useMemo(() => {
    const m = new Map<string, RecordAccountEvent[]>()
    for (const e of access.accountEvents ?? []) {
      const list = m.get(e.user_id) ?? []
      list.push(e)
      m.set(e.user_id, list)
    }
    return m
  }, [access.accountEvents])

  if (persons.length === 0) {
    return (
      <section>
        <SectionHead title="Åtkomst & konton" manage />
        <div className="flex items-center gap-4 py-6 px-4 rounded-2xl border border-dashed border-slate-800">
          <AccessRolesGlyph count={0} />
          <div>
            <p className="text-sm text-slate-300 font-medium">Ingen har åtkomst ännu</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Bjud in kunden så syns kontot här med roll, inloggningsrytm och utskickshistorik.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <div className="space-y-8">
      {/* ---------------- Användning ---------------- */}
      <section>
        <SectionHead title="Användning" manage />

        <p className="max-w-[74ch] text-sm text-slate-400">
          <b className="tabular-nums text-slate-100">
            {summary.withLogin.length} av {persons.length}
          </b>{' '}
          konton har använts.
          {summary.mostRecent && (
            <>
              {' '}
              <b className="text-slate-100">{summary.mostRecent.name}</b> var senast inne{' '}
              <b className="tabular-nums text-slate-100">
                {relativeDays(summary.mostRecent.daysSince).toLowerCase()}
              </b>
              .
            </>
          )}
          {summary.cold.length > 0 && (
            <>
              {' '}
              <span className="font-semibold text-[#e46a5f]">
                {summary.cold.length}{' '}
                {summary.cold.length === 1 ? 'konto har varit tyst' : 'konton har varit tysta'} i
                90 dagar eller mer
              </span>
              .
            </>
          )}
          {summary.never.length > 0 && (
            <>
              {' '}
              <b className="tabular-nums text-slate-100">{summary.never.length}</b>{' '}
              {summary.never.length === 1 ? 'konto har' : 'konton har'} aldrig använts
              {summary.neverWithSends.length > 0 && (
                <>
                  {' '}
                  — trots{' '}
                  <span className="font-semibold text-[#e0a83a]">
                    {summary.neverWithSends.reduce((s, p) => s + p.passwordSends, 0)} utskickade
                    lösenord
                  </span>
                </>
              )}
              .
            </>
          )}
        </p>

        <div className="mt-3.5 overflow-hidden rounded-2xl border border-slate-700" style={PANEL_STYLE}>
          <div className="overflow-x-auto">
            <div className="min-w-[830px]">
              <div className="grid grid-cols-[1fr_116px_150px_128px_104px_22px] items-center gap-3.5 border-b border-slate-700 px-4 py-2 text-[10.5px] uppercase tracking-[.1em] text-slate-500">
                <span>Person</span>
                <span>Roll</span>
                <span>Inloggningsrytm</span>
                <span>Senast inne</span>
                <span>Inloggningar</span>
                <span />
              </div>

              {persons.map((p) => {
                const events = p.userId ? (eventsByUser.get(p.userId) ?? []) : []
                const isOpen = openHistory === p.key
                return (
                  <div key={p.key}>
                    <button
                      type="button"
                      onClick={() => setOpenHistory(isOpen ? null : p.key)}
                      disabled={events.length === 0}
                      className="group grid w-full grid-cols-[1fr_116px_150px_128px_104px_22px] items-center gap-3.5 border-t border-slate-800/70 px-4 py-2.5 text-left transition-colors first:border-t-0 hover:bg-[#121f33] disabled:cursor-default disabled:hover:bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f]"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${DOT_CLASS[p.status]}`}
                          aria-hidden
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-semibold text-slate-200">
                            {p.name}
                          </span>
                          {p.email && p.email !== p.name && (
                            <span className="block truncate text-[11.5px] text-slate-500">
                              {p.email}
                            </span>
                          )}
                        </span>
                      </span>

                      <span className="min-w-0 text-[12.5px] text-slate-400">
                        {p.roleLabel}
                        {p.scope && (
                          <span className="block truncate text-[11px] text-slate-500">{p.scope}</span>
                        )}
                      </span>

                      <span>
                        <LoginBand band={p.band} />
                      </span>

                      <span className="text-[12.5px]">
                        <span
                          className={
                            p.status === 'active'
                              ? 'block text-[#20c58f]'
                              : p.status === 'cold'
                                ? 'block text-[#e46a5f]'
                                : p.status === 'never'
                                  ? 'block text-slate-600'
                                  : 'block text-[#e0a83a]'
                          }
                        >
                          {relativeDays(p.daysSince)}
                        </span>
                        <span className="block text-[11px] text-slate-500">
                          {p.lastLogin
                            ? formatDateSv(p.lastLogin)
                            : p.accountCreated
                              ? `konto ${formatDateSv(p.accountCreated)}`
                              : '—'}
                        </span>
                      </span>

                      <span className="text-[12.5px] text-slate-400">
                        {p.loginCount === 0 ? (
                          <>
                            <b className="font-semibold text-slate-600">0</b>{' '}
                            <span className="text-[11px] text-slate-600">ggr</span>
                            {p.passwordSends > 0 && (
                              <span className="block text-[11px] text-[#e0a83a]">
                                {p.passwordSends} utskick
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <b className="font-semibold text-slate-100">{p.loginCount}</b>{' '}
                            <span className="text-[11px] text-slate-500">ggr ·</span>{' '}
                            <b className="font-semibold text-slate-100">{p.activeMonths}</b>{' '}
                            <span className="text-[11px] text-slate-500">mån</span>
                          </>
                        )}
                      </span>

                      <ChevronRight
                        className={`h-3.5 w-3.5 shrink-0 transition-all ${
                          events.length === 0
                            ? 'text-transparent'
                            : isOpen
                              ? 'rotate-90 text-[#20c58f]'
                              : 'text-slate-700 group-hover:text-[#20c58f]'
                        }`}
                      />
                    </button>

                    {isOpen && events.length > 0 && (
                      <AccountHistory events={events} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <BandLegend persons={persons} />
        </div>
      </section>

      {/* ---------------- Täckning ---------------- */}
      {units.length > 0 && (
        <CoverageSection units={units} persons={persons} access={access} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

const PANEL_STYLE = {
  background: 'linear-gradient(180deg,#14212f,#101b2c 48px)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.05), 0 16px 40px -24px rgba(0,0,0,.7)',
} as const

function SectionHead({ title, aux, manage }: { title: string; aux?: string; manage?: boolean }) {
  return (
    <div className="mb-3.5 flex items-baseline gap-3 border-b-[1.5px] border-slate-700 pb-1.5">
      <h2 className="text-[11px] font-bold uppercase tracking-[.15em] text-slate-400">{title}</h2>
      {aux && <span className="ml-auto text-xs text-slate-500">{aux}</span>}
      {manage && (
        <Link
          to="/admin/anvandarkonton-kund"
          className="ml-auto flex items-center gap-1 text-xs text-slate-500 transition-colors hover:text-[#20c58f]"
        >
          Hantera konton
          <ExternalLink className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}

/** Livstidsband: en stapel per månad, höjden skalad mot personens toppmånad. */
function LoginBand({ band }: { band: { month: string; count: number }[] }) {
  if (band.length === 0) {
    return <span className="text-[11px] text-slate-600">—</span>
  }
  const max = Math.max(...band.map((b) => b.count), 1)
  return (
    <span className="flex h-5 items-end gap-[3px]" aria-hidden>
      {band.map((b) => {
        if (b.count === 0) {
          return (
            <span
              key={b.month}
              className="block w-[5px] shrink-0 rounded-[1px] bg-slate-800"
              style={{ height: 2 }}
              title={`${b.month}: inga inloggningar`}
            />
          )
        }
        const h = Math.max(4, Math.round((b.count / max) * 20))
        return (
          <span
            key={b.month}
            className="block w-[5px] shrink-0 rounded-[1px] bg-[#20c58f]"
            style={{ height: h }}
            title={`${b.month}: ${b.count} ${b.count === 1 ? 'inloggning' : 'inloggningar'}`}
          />
        )
      })}
    </span>
  )
}

function BandLegend({ persons }: { persons: AccessPerson[] }) {
  const spans = persons.map((p) => p.band).filter((b) => b.length > 0)
  if (spans.length === 0) return null
  const longest = spans.reduce((a, b) => (b.length > a.length ? b : a), spans[0])
  const first = longest[0]?.month
  const last = longest[longest.length - 1]?.month

  return (
    <div className="flex flex-wrap items-center gap-4 border-t border-slate-800 px-4 py-2.5 text-[11px] text-slate-500">
      <span className="flex items-center gap-1.5">
        <span className="block h-2.5 w-[5px] rounded-[1px] bg-[#20c58f]" aria-hidden />
        Inloggningar den månaden
      </span>
      <span className="flex items-center gap-1.5">
        <span className="block h-[2px] w-[5px] rounded-[1px] bg-slate-800" aria-hidden />
        Tyst månad
      </span>
      <span className="ml-auto tabular-nums">
        {first} → {last}
      </span>
    </div>
  )
}

const EVENT_LABEL: Record<RecordAccountEvent['event_type'], string> = {
  invited: 'Inbjudan skickad',
  password_sent: 'Nytt lösenord skickat',
  email_changed: 'E-postadress ändrad',
  role_changed: 'Roll ändrad',
  deactivated: 'Åtkomst avstängd',
  reactivated: 'Åtkomst återöppnad',
}

const EVENT_TONE: Record<RecordAccountEvent['event_type'], string> = {
  invited: 'border-[#20c58f]',
  password_sent: 'border-[#e0a83a]',
  email_changed: 'border-slate-500',
  role_changed: 'border-slate-500',
  deactivated: 'border-[#e46a5f]',
  reactivated: 'border-[#20c58f]',
}

/** Utfälld historik under en person — äldst först, som en berättelse. */
function AccountHistory({ events }: { events: RecordAccountEvent[] }) {
  const ordered = [...events].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  return (
    <div className="border-t border-slate-800/70 bg-[#0d1826] px-4 py-3">
      <p className="mb-2 text-[10.5px] uppercase tracking-[.1em] text-slate-500">Kontohistorik</p>
      <ul>
        {ordered.map((e, i) => (
          <li key={e.id} className="grid grid-cols-[92px_15px_1fr] items-baseline gap-3 py-1.5">
            <span className="text-[11.5px] tabular-nums text-slate-500">
              {formatDateSv(e.created_at)}
            </span>
            <span className="relative self-stretch">
              <span
                className="absolute left-[7px] w-px bg-slate-800"
                style={{ top: i === 0 ? 10 : -6, bottom: i === ordered.length - 1 ? 'auto' : -6, height: i === ordered.length - 1 ? 10 : undefined }}
                aria-hidden
              />
              <span
                className={`absolute left-[3px] top-[6px] h-[9px] w-[9px] rounded-full border-[1.5px] bg-[#0d1826] ${EVENT_TONE[e.event_type]}`}
                aria-hidden
              />
            </span>
            <span className="min-w-0 text-[12.5px] text-slate-300">
              {EVENT_LABEL[e.event_type]}
              {e.note && <span className="block text-[11.5px] text-slate-500">{e.note}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Täckning per enhet: två streck — finns en ansvarig, och är den ansvarige vaken.
 * Visar den lucka som annars bara går att se genom att jämföra site_ids mot
 * inloggningar för hand.
 */
function CoverageSection({
  units,
  persons,
  access,
}: {
  units: RecordCustomer[]
  persons: AccessPerson[]
  access: RecordAccessData
}) {
  const rows = useMemo(() => {
    const personByUserId = new Map(persons.filter((p) => p.userId).map((p) => [p.userId!, p]))

    return units.map((unit) => {
      // Verksamhetschefer täcker allt och räknas inte som platsansvar för en
      // enskild enhet — annars ser varje enhet bemannad ut.
      const owners = access.multisiteUsers
        .filter((u) => u.role_type !== 'verksamhetschef' && (u.site_ids ?? []).includes(unit.id))
        .map((u) => personByUserId.get(u.user_id))
        .filter((p): p is AccessPerson => !!p)

      const awake = owners.filter((p) => p.status === 'active' || p.status === 'idle')
      return { unit, owners, awake }
    })
  }, [units, persons, access.multisiteUsers])

  const uncovered = rows.filter((r) => r.owners.length === 0)
  const stale = rows.filter((r) => r.owners.length > 0 && r.awake.length === 0)

  return (
    <section>
      <SectionHead title="Täckning per enhet" aux={`${units.length} enheter`} />

      <p className="max-w-[74ch] text-sm text-slate-400">
        {uncovered.length === 0 && stale.length === 0 ? (
          <>Alla enheter har en ansvarig som loggar in.</>
        ) : (
          <>
            {uncovered.length > 0 && (
              <>
                <span className="font-semibold text-[#e0a83a]">
                  {uncovered.length}{' '}
                  {uncovered.length === 1 ? 'enhet saknar' : 'enheter saknar'} ansvarig
                </span>
                {stale.length > 0 && ' och '}
              </>
            )}
            {stale.length > 0 && (
              <>
                <b className="tabular-nums text-slate-100">{stale.length}</b>{' '}
                {stale.length === 1 ? 'har en ansvarig' : 'har ansvariga'} som varit tyst i 90 dagar
                eller mer
              </>
            )}
            . Verksamhetschefer räknas inte som platsansvar — de täcker allt.
          </>
        )}
      </p>

      <div className="mt-3.5 overflow-hidden rounded-2xl border border-slate-700" style={PANEL_STYLE}>
        <div className="flex flex-wrap">
          {rows.map(({ unit, owners, awake }) => {
            const hasOwner = owners.length > 0
            const isAwake = awake.length > 0
            return (
              <div
                key={unit.id}
                className="min-w-0 flex-1 basis-[168px] border-l border-slate-800 px-4 py-3 first:border-l-0"
              >
                <div className="truncate text-[12.5px] text-slate-300">{customerRowName(unit)}</div>
                <div
                  className={`mt-0.5 truncate text-[11.5px] ${
                    hasOwner ? 'text-slate-500' : 'text-[#e0a83a]'
                  }`}
                >
                  {hasOwner
                    ? `${owners.map((o) => o.name).join(', ')}${
                        isAwake ? '' : ' · tyst'
                      }`
                    : 'Ingen platsansvarig'}
                </div>
                <div className="mt-1.5 flex gap-[3px]" aria-hidden>
                  <span
                    className={`block h-[2px] flex-1 rounded-[1px] ${
                      hasOwner ? 'bg-[#20c58f]' : 'bg-slate-800'
                    }`}
                  />
                  <span
                    className={`block h-[2px] flex-1 rounded-[1px] ${
                      isAwake ? 'bg-[#20c58f]' : hasOwner ? 'bg-[#e0a83a]' : 'bg-slate-800'
                    }`}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/** Nyckelring — antalet nycklar speglar antalet konton. */
function AccessRolesGlyph({ count = 1, dim = false }: { count?: number; dim?: boolean }) {
  const uid = useId().replace(/:/g, '')
  const keys = Math.max(1, Math.min(4, count))
  const tone = dim ? '#475569' : '#20c58f'
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 56 56"
      role="img"
      aria-label={`${count} konton`}
      className="shrink-0"
    >
      <defs>
        <filter id={`${uid}-rough`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.1" numOctaves="2" seed="13" result="n" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="n"
            scale="1.0"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
      <g filter={`url(#${uid}-rough)`} opacity={dim ? 0.55 : 1}>
        <circle cx="20" cy="20" r="9" fill="none" stroke={tone} strokeWidth="2.2" />
        {Array.from({ length: keys }, (_, i) => {
          const a = ((-40 + i * 26) * Math.PI) / 180
          const x1 = 20 + 9 * Math.cos(a)
          const y1 = 20 + 9 * Math.sin(a)
          const x2 = x1 + 18 * Math.cos(a)
          const y2 = y1 + 18 * Math.sin(a)
          return (
            <g key={i} opacity={0.55 + i * 0.15}>
              <path
                d={`M ${x1} ${y1} L ${x2} ${y2}`}
                stroke={tone}
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d={`M ${x2 - 3.5} ${y2} l 0 3.5 M ${x2} ${y2} l 0 4.5`}
                stroke={tone}
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </g>
          )
        })}
      </g>
    </svg>
  )
}
