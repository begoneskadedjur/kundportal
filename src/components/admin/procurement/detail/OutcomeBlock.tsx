// src/components/admin/procurement/detail/OutcomeBlock.tsx
// Block 9: utfall och handlingar. Anbudsgivare på upphandlingen (importerade,
// AI-utlästa ur handlingar eller manuella) med godkännande, begäran om
// allmänna handlingar via e-post och vårt eget anbuds utfall.

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Check } from 'lucide-react'
import Button from '../../../ui/Button'
import {
  ProcurementService,
  type AwardWithRelations,
  type BidderWithSupplier,
  type NoticeWithRelations,
} from '../../../../services/procurementService'
import {
  DOCUMENT_REQUEST_TYPES,
  REQUEST_STATUS_LABEL,
  type ProcurementBid,
  type ProcurementDocumentRequest,
  type ProcurementRequestStatus,
} from '../../../../types/procurement'
import { EmptyState, LinkButton, StatusDot } from '../ui'
import { fmtDate, fmtKr, fmtNum, tableCls, type Tone } from '../uiFormat'
import { BlurText, Block, Label, NumberField, SubHeading, checkboxCls, inputCls, selectCls } from './fields'
import { errMsg } from './helpers'

const BIDDER_SOURCE_LABEL: Record<string, string> = {
  ted: 'TED',
  ted_xml: 'TED (äldre)',
  uhm: 'UHM',
  email: 'E-post',
  document: 'Handling (AI)',
  manual: 'Manuell',
}

const REQUEST_TONE: Record<ProcurementRequestStatus, Tone> = {
  draft: 'muted',
  sent: 'info',
  reminded: 'warn',
  escalated: 'bad',
  partial: 'warn',
  received: 'good',
  rejected: 'bad',
  closed: 'muted',
}

const OUTCOME_LABEL: Record<ProcurementBid['outcome'], string> = {
  pending: 'Väntar på beslut',
  won: 'Vunnet',
  lost: 'Förlorat',
  cancelled: 'Upphandlingen avbröts',
  withdrawn: 'Anbudet återkallat',
}

interface Props {
  notice: NoticeWithRelations
  noticeAwards: AwardWithRelations[]
  bids: ProcurementBid[]
  onBidsChanged: () => void
  onEventsChanged: () => void
}

export default function OutcomeBlock({ notice, noticeAwards, bids, onBidsChanged, onEventsChanged }: Props) {
  const [bidders, setBidders] = useState<BidderWithSupplier[]>([])
  const [requests, setRequests] = useState<ProcurementDocumentRequest[]>([])

  const loadBidders = useCallback(async () => {
    try {
      setBidders(await ProcurementService.listBidders({ noticeId: notice.id }))
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte hämta anbudsgivare'))
    }
  }, [notice.id])

  const loadRequests = useCallback(async () => {
    try {
      setRequests(await ProcurementService.listDocumentRequests(notice.id))
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte hämta begäranden'))
    }
  }, [notice.id])

  useEffect(() => {
    void loadBidders()
    void loadRequests()
  }, [loadBidders, loadRequests])

  return (
    <Block id="utfall" num="9" title="Utfall och handlingar">
      <div className="p-4 space-y-6">
        <BiddersSection noticeId={notice.id} bidders={bidders} onChanged={() => void loadBidders()} />
        <RequestSection
          notice={notice}
          awardId={noticeAwards[0]?.id ?? null}
          requests={requests}
          onChanged={() => {
            void loadRequests()
            onEventsChanged()
          }}
        />
        <OwnOutcome bids={bids} onChanged={onBidsChanged} />
      </div>
    </Block>
  )
}

// ---------------------------------------------------------------------------

function BiddersSection({ noticeId, bidders, onChanged }: { noticeId: string; bidders: BidderWithSupplier[]; onChanged: () => void }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [org, setOrg] = useState('')
  const [price, setPrice] = useState<number | null>(null)
  const [rank, setRank] = useState<number | null>(null)
  const [winner, setWinner] = useState(false)
  const [busy, setBusy] = useState(false)

  const verify = async (b: BidderWithSupplier) => {
    try {
      await ProcurementService.verifyBidder(b.id, !b.verified)
      onChanged()
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte godkänna'))
    }
  }

  const add = async () => {
    if (!name.trim()) {
      toast.error('Ange namn på anbudsgivaren')
      return
    }
    setBusy(true)
    try {
      await ProcurementService.addManualBidder({ noticeId, name, orgNumber: org || null, price, rank, isWinner: winner })
      toast.success('Anbudsgivaren tillagd')
      setName('')
      setOrg('')
      setPrice(null)
      setRank(null)
      setWinner(false)
      setAdding(false)
      onChanged()
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte lägga till anbudsgivaren'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <SubHeading action={<LinkButton onClick={() => setAdding((a) => !a)}>{adding ? 'Stäng' : 'Lägg till manuellt'}</LinkButton>}>
        Anbudsgivare ({bidders.length})
      </SubHeading>

      {adding && (
        <div className="mb-3 p-3 rounded-lg border border-slate-800 bg-slate-950/40 grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
          <div className="col-span-2">
            <Label>Namn</Label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Orgnr</Label>
            <input className={inputCls} value={org} onChange={(e) => setOrg(e.target.value)} placeholder="556000-0000" />
          </div>
          <NumberField label="Pris" value={price} onChange={setPrice} suffix="kr" />
          <NumberField label="Placering" value={rank} onChange={setRank} />
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-[12px] text-slate-400">
              <input type="checkbox" className={checkboxCls} checked={winner} onChange={(e) => setWinner(e.target.checked)} />
              Vann
            </label>
            <Button size="sm" onClick={() => void add()} loading={busy}>
              Lägg till
            </Button>
          </div>
        </div>
      )}

      {bidders.length === 0 ? (
        <EmptyState title="Inga kända anbudsgivare" hint="Kommer från TED, UHM eller inkomna handlingar, eller läggs till manuellt." />
      ) : (
        <div className="overflow-x-auto -mx-4">
          <table className={tableCls.table}>
            <thead className={tableCls.thead}>
              <tr>
                <th className={tableCls.th}>Anbudsgivare</th>
                <th className={tableCls.thRight}>Pris</th>
                <th className={tableCls.thRight}>Poäng</th>
                <th className={tableCls.thRight}>Placering</th>
                <th className={tableCls.th}>Vann</th>
                <th className={tableCls.th}>Källa</th>
                <th className={tableCls.th}>Verifierad</th>
              </tr>
            </thead>
            <tbody>
              {bidders.map((b) => (
                <tr key={b.id} className={tableCls.tr}>
                  <td className={tableCls.td}>
                    <span className={b.is_begone ? 'text-[#20c58f]' : 'text-slate-200'}>{b.supplier?.name ?? b.name}</span>
                  </td>
                  <td className={tableCls.tdRight}>{fmtKr(b.price)}</td>
                  <td className={tableCls.tdRight}>{fmtNum(b.score, 2)}</td>
                  <td className={tableCls.tdRight}>{b.rank ?? '–'}</td>
                  <td className={tableCls.td}>{b.is_winner ? <Check className="w-3.5 h-3.5 text-[#20c58f]" aria-label="Vann" /> : ''}</td>
                  <td className={`${tableCls.td} text-slate-500`}>{BIDDER_SOURCE_LABEL[b.source] ?? b.source}</td>
                  <td className={`${tableCls.td} whitespace-nowrap`}>
                    {b.verified ? (
                      <span className="inline-flex items-center gap-2">
                        <StatusDot tone="good">Godkänd</StatusDot>
                        {b.source !== 'manual' && (
                          <LinkButton tone="muted" onClick={() => void verify(b)}>
                            Ångra
                          </LinkButton>
                        )}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <StatusDot tone="warn">Ej granskad</StatusDot>
                        <LinkButton onClick={() => void verify(b)}>Godkänn</LinkButton>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-slate-600 mt-1.5">Siffror ur handlingar räknas som verifierade först när en ansvarig godkänt dem.</p>
    </div>
  )
}

// ---------------------------------------------------------------------------

function RequestSection({
  notice,
  awardId,
  requests,
  onChanged,
}: {
  notice: NoticeWithRelations
  awardId: string | null
  requests: ProcurementDocumentRequest[]
  onChanged: () => void
}) {
  const [types, setTypes] = useState<Set<string>>(new Set(DOCUMENT_REQUEST_TYPES.map((t) => t.key)))
  const [recipient, setRecipient] = useState(notice.buyer?.registrar_email ?? '')
  const [message, setMessage] = useState('')
  const [preview, setPreview] = useState<{ subject?: string; body?: string } | null>(null)
  const [busy, setBusy] = useState<'preview' | 'send' | null>(null)

  useEffect(() => {
    setRecipient((r) => r || notice.buyer?.registrar_email || '')
  }, [notice.buyer?.registrar_email])

  const valid = types.size > 0 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient.trim())

  const run = async (isPreview: boolean) => {
    if (!valid) {
      toast.error('Välj minst en handling och ange en giltig mottagare')
      return
    }
    setBusy(isPreview ? 'preview' : 'send')
    try {
      const res = await ProcurementService.requestDocuments({
        noticeId: notice.id,
        docTypes: [...types],
        recipientEmail: recipient.trim(),
        awardId,
        message: message.trim() || null,
        preview: isPreview,
      })
      if (isPreview) setPreview({ subject: res.subject, body: res.body })
      else {
        toast.success('Begäran skickad')
        setPreview(null)
        setMessage('')
        onChanged()
      }
    } catch (e) {
      toast.error(errMsg(e, isPreview ? 'Kunde inte förhandsgranska' : 'Kunde inte skicka begäran'))
    } finally {
      setBusy(null)
    }
  }

  const setStatus = async (r: ProcurementDocumentRequest, status: ProcurementRequestStatus) => {
    try {
      const patch: Parameters<typeof ProcurementService.updateDocumentRequest>[1] = { status }
      if (status === 'received' && !r.received_at) patch.received_at = new Date().toISOString()
      await ProcurementService.updateDocumentRequest(r.id, patch)
      onChanged()
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte ändra status'))
    }
  }

  const typeLabel = (k: string) => DOCUMENT_REQUEST_TYPES.find((t) => t.key === k)?.label ?? k

  return (
    <div>
      <SubHeading>Begär ut handlingar</SubHeading>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {DOCUMENT_REQUEST_TYPES.map((t) => (
            <label key={t.key} className="flex items-center gap-1.5 text-[12.5px] text-slate-300">
              <input
                type="checkbox"
                className={checkboxCls}
                checked={types.has(t.key)}
                onChange={(e) => {
                  const n = new Set(types)
                  if (e.target.checked) n.add(t.key)
                  else n.delete(t.key)
                  setTypes(n)
                  setPreview(null)
                }}
              />
              {t.label}
            </label>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Mottagare (köparens registrator)</Label>
            <input className={inputCls} type="email" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="registrator@kommun.se" />
            {!notice.buyer?.registrar_email && <p className="text-[11px] text-slate-600 mt-1">Köparen saknar registratoradress i köparprofilen.</p>}
          </div>
          <div>
            <Label>Meddelande (valfritt)</Label>
            <textarea className={`${inputCls} resize-y`} rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tillägg till standardtexten" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void run(true)} loading={busy === 'preview'} disabled={!valid || busy != null}>
            Förhandsgranska
          </Button>
          <Button size="sm" onClick={() => void run(false)} loading={busy === 'send'} disabled={!valid || busy != null || !preview}>
            Skicka
          </Button>
          {!preview && <span className="text-[11px] text-slate-600">Förhandsgranska innan du skickar.</span>}
        </div>
        {preview && (
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <div className="text-[11px] text-slate-500">Ämne</div>
            <div className="text-[12.5px] text-slate-200 mb-2">{preview.subject ?? '–'}</div>
            <div className="text-[11px] text-slate-500">Text</div>
            <pre className="text-[12px] text-slate-300 whitespace-pre-wrap font-sans">{preview.body ?? '–'}</pre>
          </div>
        )}
      </div>

      <div className="mt-4">
        <SubHeading>Begäranden ({requests.length})</SubHeading>
        {requests.length === 0 ? (
          <p className="text-[12px] text-slate-600">Inga begäranden skickade.</p>
        ) : (
          <div className="overflow-x-auto -mx-4">
            <table className={tableCls.table}>
              <thead className={tableCls.thead}>
                <tr>
                  <th className={tableCls.th}>Skickad</th>
                  <th className={tableCls.th}>Handlingar</th>
                  <th className={tableCls.th}>Mottagare</th>
                  <th className={tableCls.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className={tableCls.tr}>
                    <td className={`${tableCls.td} whitespace-nowrap`}>{fmtDate(r.sent_at ?? r.created_at)}</td>
                    <td className={tableCls.td}>{r.doc_types.map(typeLabel).join(', ')}</td>
                    <td className={`${tableCls.td} text-slate-400 break-all`}>{r.recipient_email}</td>
                    <td className={`${tableCls.td} whitespace-nowrap`}>
                      <div className="flex items-center gap-2">
                        <StatusDot tone={REQUEST_TONE[r.status]}>{REQUEST_STATUS_LABEL[r.status]}</StatusDot>
                        <select
                          className={`${selectCls} w-auto py-1`}
                          value={r.status}
                          onChange={(e) => void setStatus(r, e.target.value as ProcurementRequestStatus)}
                          aria-label="Ändra status"
                        >
                          {(Object.keys(REQUEST_STATUS_LABEL) as ProcurementRequestStatus[]).map((s) => (
                            <option key={s} value={s}>{REQUEST_STATUS_LABEL[s]}</option>
                          ))}
                        </select>
                      </div>
                      {r.received_at && <div className="text-[10.5px] text-slate-500">mottagen {fmtDate(r.received_at)}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function OwnOutcome({ bids, onChanged }: { bids: ProcurementBid[]; onChanged: () => void }) {
  const current = bids.find((b) => b.is_current) ?? bids[0] ?? null

  const patch = async (p: Parameters<typeof ProcurementService.updateBid>[1], msg?: string) => {
    if (!current) return
    try {
      await ProcurementService.updateBid(current.id, p)
      if (msg) toast.success(msg)
      onChanged()
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte spara anbudet'))
    }
  }

  return (
    <div>
      <SubHeading>Vårt anbud</SubHeading>
      {!current ? (
        <p className="text-[12px] text-slate-600">Spara en kalkyl i block 6 så kan utfallet följas här.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label>Utfall</Label>
            <select
              className={selectCls}
              value={current.outcome}
              onChange={(e) => void patch({ outcome: e.target.value as ProcurementBid['outcome'] }, 'Utfallet sparat')}
              aria-label="Utfall"
            >
              {(Object.keys(OUTCOME_LABEL) as Array<ProcurementBid['outcome']>).map((o) => (
                <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>
              ))}
            </select>
          </div>
          <NumberField label="Lämnat pris per år" value={current.submitted_price} commitOnBlur onChange={(n) => void patch({ submitted_price: n })} suffix="kr" />
          <div className="sm:col-span-3">
            <Label>Lärdom</Label>
            <BlurText
              value={current.lesson}
              multiline
              onCommit={(v) => void patch({ lesson: v }, 'Lärdomen sparad')}
              placeholder="Vad avgjorde? Prisavstånd till vinnaren, kvalitetspoäng, vad vi gör annorlunda nästa gång."
            />
          </div>
        </div>
      )}
    </div>
  )
}
