// src/components/admin/procurement/workshop/PriceAppendix.tsx
// Anbudsverkstad b) Prisbilaga: à-prisrader med årsvolym, vår kostnad och
// marginal per rad och totalt (färg enligt marginEngine och prisinställningarna).
// Rader kan hämtas från en prislista eller fyllas från den sparade kalkylen.
// Export som xlsx med bara det köparen ska se (benämning, enhet, volym, pris).

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Download, Trash2 } from 'lucide-react'
import Button from '../../../ui/Button'
import { ProcurementService, type NoticeWithRelations } from '../../../../services/procurementService'
import { PriceListService } from '../../../../services/priceListService'
import type { PriceList } from '../../../../types/articles'
import type { PricingSettings } from '../../../../types/pricingSettings'
import type { ProcurementBid, ProcurementPriceLine } from '../../../../types/procurement'
import { marginPercent, marginTone, toneTextClass } from '../../../../shared/marginEngine'
import { todaySwedish } from '../../../../shared/procurementRules'
import { EmptyState, LinkButton } from '../ui'
import { fmtKr, fmtNum, tableCls } from '../uiFormat'
import { BlurText, NumberField, SubHeading, checkboxCls, selectCls } from '../detail/fields'
import { downloadBlob, errMsg, useConfirm } from '../detail/helpers'
import type { SavedCalc } from '../BidCalculator'

interface Props {
  notice: NoticeWithRelations
  lines: ProcurementPriceLine[]
  settings: PricingSettings | null
  currentBid: ProcurementBid | null
  onChanged: () => void
}

interface PickItem {
  id: string
  name: string
  unit: string
  price: number
  cost: number | null
  kind: 'Tjänst' | 'Artikel'
}

function fmtMargin(pct: number | null): string {
  return pct == null ? '–' : `${fmtNum(pct, 1)} %`
}

export default function PriceAppendix({ notice, lines, settings, currentBid, onChanged }: Props) {
  const [picking, setPicking] = useState(false)
  const [exporting, setExporting] = useState(false)
  const { confirm, node: confirmNode } = useConfirm()

  const totals = useMemo(() => {
    let revenue = 0
    let cost = 0
    let costKnown = true
    for (const l of lines) {
      const q = Number(l.quantity) || 0
      revenue += q * (Number(l.unit_price) || 0)
      if (l.unit_cost == null) costKnown = false
      else cost += q * Number(l.unit_cost)
    }
    return { revenue, cost, costKnown, margin: costKnown ? marginPercent(revenue, cost) : null }
  }, [lines])

  const floor = currentBid?.floor_price ?? null
  const nextSort = () => lines.reduce((m, l) => Math.max(m, l.sort_order), 0) + 10

  const patch = async (l: ProcurementPriceLine, p: Partial<ProcurementPriceLine>) => {
    try {
      await ProcurementService.savePriceLine({ id: l.id, notice_id: notice.id, ...p })
      onChanged()
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte spara raden'))
    }
  }

  const addEmpty = async () => {
    try {
      await ProcurementService.savePriceLine({ notice_id: notice.id, label: 'Ny rad', unit: 'st', quantity: 1, sort_order: nextSort() })
      onChanged()
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte lägga till raden'))
    }
  }

  const fillFromCalc = async () => {
    const calc = currentBid?.calc as Partial<SavedCalc> | undefined
    const r = calc?.result
    if (!currentBid || !r || !(r.visitsPerYear > 0)) {
      toast.error('Spara en kalkyl med besök först')
      return
    }
    const visits = r.visitsPerYear
    try {
      await ProcurementService.savePriceLine({
        notice_id: notice.id,
        label: 'Besök enligt avtalet',
        unit: 'besök',
        quantity: Math.round(visits * 10) / 10,
        unit_price: Math.round(r.targetPrice / visits),
        unit_cost: Math.round(r.annualCost / visits),
        notes: 'Från kalkylens målpris',
        sort_order: nextSort(),
      })
      toast.success('Rad tillagd från kalkylen')
      onChanged()
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte lägga till raden'))
    }
  }

  const remove = (l: ProcurementPriceLine) =>
    confirm('Ta bort rad', `Ta bort "${l.label}" ur prisbilagan?`, async () => {
      try {
        await ProcurementService.deletePriceLine(l.id)
        onChanged()
      } catch (e) {
        toast.error(errMsg(e, 'Kunde inte ta bort raden'))
      }
    })

  const exportXlsx = async () => {
    if (lines.length === 0) {
      toast.error('Prisbilagan är tom')
      return
    }
    setExporting(true)
    try {
      const { default: ExcelJS } = await import('exceljs')
      const wb = new ExcelJS.Workbook()
      wb.creator = 'BeGone'
      wb.created = new Date()
      const ws = wb.addWorksheet('Prisbilaga')
      ws.addRow([`Prisbilaga BGU-${notice.bgu_number}`]).font = { bold: true, size: 13 }
      ws.addRow([notice.title])
      ws.addRow([notice.buyer?.name ?? notice.buyer_name ?? ''])
      ws.addRow([`Priser i kronor exklusive moms. Upprättad ${todaySwedish()}.`])
      ws.addRow([])
      const header = ws.addRow(['Benämning', 'Enhet', 'Årsvolym', 'À-pris', 'Summa per år'])
      header.font = { bold: true }
      header.eachCell((c) => {
        c.border = { bottom: { style: 'thin' } }
      })
      for (const l of lines) {
        const q = Number(l.quantity) || 0
        const p = l.unit_price != null ? Number(l.unit_price) : null
        ws.addRow([l.label, l.unit ?? '', q, p, p != null ? q * p : null])
      }
      const total = ws.addRow(['Totalt', '', null, null, totals.revenue])
      total.font = { bold: true }
      total.getCell(5).border = { top: { style: 'thin' } }
      ws.getColumn(1).width = 48
      ws.getColumn(2).width = 10
      ws.getColumn(3).width = 12
      ws.getColumn(4).width = 14
      ws.getColumn(5).width = 16
      ws.getColumn(3).numFmt = '# ##0.##'
      ws.getColumn(4).numFmt = '# ##0.00'
      ws.getColumn(5).numFmt = '# ##0'
      const buffer = await wb.xlsx.writeBuffer()
      downloadBlob(
        new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `Prisbilaga_BGU-${notice.bgu_number}_${todaySwedish()}.xlsx`
      )
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte skapa filen'))
    } finally {
      setExporting(false)
    }
  }

  const totalTone = toneTextClass(marginTone(totals.margin, settings))

  return (
    <div>
      <SubHeading
        action={
          <div className="flex flex-wrap items-center gap-3">
            <LinkButton onClick={() => void addEmpty()}>Lägg till rad</LinkButton>
            <LinkButton onClick={() => setPicking((p) => !p)}>{picking ? 'Stäng prislistan' : 'Hämta från prislista'}</LinkButton>
            <LinkButton onClick={() => void fillFromCalc()}>Fyll från kalkylen</LinkButton>
          </div>
        }
      >
        Prisbilaga
      </SubHeading>

      {picking && (
        <PriceListPicker
          onAdd={async (items) => {
            let sort = nextSort()
            try {
              for (const it of items) {
                await ProcurementService.savePriceLine({
                  notice_id: notice.id,
                  label: it.name,
                  unit: it.unit,
                  quantity: 1,
                  unit_price: it.price,
                  unit_cost: it.cost,
                  price_list_item_id: it.id,
                  sort_order: sort,
                })
                sort += 10
              }
              toast.success(`${items.length} rader tillagda`)
              setPicking(false)
              onChanged()
            } catch (e) {
              toast.error(errMsg(e, 'Kunde inte lägga till raderna'))
              onChanged()
            }
          }}
        />
      )}

      {lines.length === 0 ? (
        <EmptyState title="Prisbilagan är tom" hint="Hämta rader från en prislista eller fyll från kalkylen." />
      ) : (
        <div className="overflow-x-auto -mx-4">
          <table className={tableCls.table}>
            <thead className={tableCls.thead}>
              <tr>
                <th className={tableCls.th}>Benämning</th>
                <th className={tableCls.th}>Enhet</th>
                <th className={tableCls.thRight}>Årsvolym</th>
                <th className={tableCls.thRight}>À-pris</th>
                <th className={tableCls.thRight}>Styckkostnad</th>
                <th className={tableCls.thRight}>Radsumma</th>
                <th className={tableCls.thRight}>Marginal</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const q = Number(l.quantity) || 0
                const price = l.unit_price != null ? Number(l.unit_price) : null
                const sum = price != null ? q * price : null
                const pct = price != null && l.unit_cost != null ? marginPercent(price, Number(l.unit_cost)) : null
                return (
                  <tr key={l.id} className={tableCls.tr}>
                    <td className={`${tableCls.td} min-w-[180px]`}>
                      <BlurText value={l.label} onCommit={(v) => v && void patch(l, { label: v })} ariaLabel="Benämning" />
                    </td>
                    <td className={`${tableCls.td} w-20`}>
                      <BlurText value={l.unit} onCommit={(v) => void patch(l, { unit: v })} ariaLabel="Enhet" />
                    </td>
                    <td className={`${tableCls.td} w-24`}>
                      <NumberField value={l.quantity} commitOnBlur onChange={(n) => void patch(l, { quantity: n ?? 0 })} ariaLabel="Årsvolym" />
                    </td>
                    <td className={`${tableCls.td} w-28`}>
                      <NumberField value={l.unit_price} commitOnBlur onChange={(n) => void patch(l, { unit_price: n })} ariaLabel="À-pris" />
                    </td>
                    <td className={`${tableCls.td} w-28`}>
                      <NumberField value={l.unit_cost} commitOnBlur onChange={(n) => void patch(l, { unit_cost: n })} ariaLabel="Styckkostnad" />
                    </td>
                    <td className={tableCls.tdRight}>{fmtKr(sum)}</td>
                    <td className={`${tableCls.tdRight} ${toneTextClass(marginTone(pct, settings))}`}>{fmtMargin(pct)}</td>
                    <td className={tableCls.td}>
                      <button type="button" onClick={() => remove(l)} className="p-1 text-slate-600 hover:text-red-400" aria-label="Ta bort rad">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
              <tr className="border-t border-slate-700">
                <td className={`${tableCls.td} font-medium text-slate-100`} colSpan={5}>
                  Totalt per år
                </td>
                <td className={`${tableCls.tdRight} font-medium text-slate-100`}>{fmtKr(totals.revenue)}</td>
                <td className={`${tableCls.tdRight} font-medium ${totalTone}`} title={totals.costKnown ? undefined : 'Styckkostnad saknas på någon rad'}>
                  {totals.costKnown ? fmtMargin(totals.margin) : 'kostnad saknas'}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] tabular-nums text-slate-500">
          {floor != null ? (
            <>
              Golvpris i senaste kalkylen {fmtKr(floor)} per år.{' '}
              {lines.length > 0 && (
                <span className={totals.revenue >= floor ? 'text-[#20c58f]' : 'text-red-400'}>
                  {totals.revenue >= floor ? 'Prisbilagan ligger över golvet.' : 'Prisbilagan ligger under golvet.'}
                </span>
              )}
            </>
          ) : (
            'Ingen sparad kalkyl att jämföra med.'
          )}
        </p>
        <Button size="sm" variant="outline" onClick={() => void exportXlsx()} loading={exporting} disabled={lines.length === 0}>
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Exportera xlsx
        </Button>
      </div>
      <p className="text-[11px] text-slate-600 mt-1">Exporten innehåller bara benämning, enhet, volym och pris. Stäm av mot köparens egen prisbilaga innan inlämning.</p>
      {confirmNode}
    </div>
  )
}

// ---------------------------------------------------------------------------

function PriceListPicker({ onAdd }: { onAdd: (items: PickItem[]) => Promise<void> }) {
  const [lists, setLists] = useState<PriceList[]>([])
  const [listId, setListId] = useState('')
  const [items, setItems] = useState<PickItem[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    PriceListService.getActivePriceLists()
      .then((l) => {
        setLists(l)
        const def = l.find((x) => x.is_default) ?? l[0]
        if (def) setListId(def.id)
      })
      .catch((e) => toast.error(errMsg(e, 'Kunde inte hämta prislistor')))
  }, [])

  useEffect(() => {
    if (!listId) return
    let alive = true
    setLoading(true)
    setSelected(new Set())
    Promise.all([PriceListService.getPriceListServiceItems(listId), PriceListService.getPriceListItems(listId)])
      .then(([services, articles]) => {
        if (!alive) return
        const out: PickItem[] = [
          ...services
            .filter((s) => s.service)
            .map((s) => ({ id: s.id, name: s.service.name, unit: 'st', price: Number(s.custom_price), cost: null, kind: 'Tjänst' as const })),
          ...articles
            .filter((a) => a.article)
            .map((a) => ({
              id: a.id,
              name: a.article.name,
              unit: a.article.unit ?? 'st',
              price: Number(a.custom_price),
              cost: a.article.default_price != null ? Number(a.article.default_price) : null,
              kind: 'Artikel' as const,
            })),
        ].sort((a, b) => a.name.localeCompare(b.name, 'sv'))
        setItems(out)
      })
      .catch((e) => alive && toast.error(errMsg(e, 'Kunde inte hämta prislistan')))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [listId])

  const visible = items.filter((i) => !search.trim() || i.name.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div className="mb-3 p-3 rounded-lg border border-slate-800 bg-slate-950/40 space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <select className={`${selectCls} sm:w-64`} value={listId} onChange={(e) => setListId(e.target.value)} aria-label="Prislista">
          {lists.length === 0 && <option value="">Inga aktiva prislistor</option>}
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
              {l.is_default ? ' (standard)' : ''}
            </option>
          ))}
        </select>
        <input
          className="flex-1 px-2.5 py-1.5 text-[12.5px] bg-slate-900/60 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#20c58f]"
          placeholder="Sök tjänst eller artikel"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/70">
        {loading ? (
          <p className="text-[12px] text-slate-500 py-2">Hämtar ...</p>
        ) : visible.length === 0 ? (
          <p className="text-[12px] text-slate-600 py-2">Inga poster i prislistan.</p>
        ) : (
          visible.map((i) => (
            <label key={i.id} className="flex items-center gap-2 py-1.5 text-[12.5px] cursor-pointer">
              <input
                type="checkbox"
                className={checkboxCls}
                checked={selected.has(i.id)}
                onChange={(e) => {
                  const n = new Set(selected)
                  if (e.target.checked) n.add(i.id)
                  else n.delete(i.id)
                  setSelected(n)
                }}
              />
              <span className="flex-1 text-slate-200">{i.name}</span>
              <span className="text-[11px] text-slate-500 w-14">{i.kind}</span>
              <span className="tabular-nums text-slate-300 w-24 text-right">{fmtKr(i.price)}</span>
            </label>
          ))
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-600">Prislistans pris blir à-pris. Artiklar får sin inköpskostnad som styckkostnad; tjänster saknar kostnad.</span>
        <Button
          size="sm"
          disabled={selected.size === 0}
          loading={adding}
          onClick={() => {
            setAdding(true)
            void onAdd(items.filter((i) => selected.has(i.id))).finally(() => setAdding(false))
          }}
        >
          Lägg till {selected.size > 0 ? selected.size : ''}
        </Button>
      </div>
    </div>
  )
}
