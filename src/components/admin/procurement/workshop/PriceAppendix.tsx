// src/components/admin/procurement/workshop/PriceAppendix.tsx
// Prisbilagan i fyra steg (beslut 4 2026-10-15, docs/upphandlingsportal-ux-plan.md):
//   a) Läs in köparens prisbilaga: AI läser köparens Excel eller PDF bland
//      upphandlingens dokument och skapar en rad per post (benämning, enhet,
//      mängd). För Excel sparas cellen där priset ska stå
//      (api/procurement/read-price-appendix).
//   b) Föreslå priser: pris per rad ur BeGones prislista eller kalkylen,
//      kostnad och marginal per rad via marginEngine
//      (src/shared/procurementPricing.ts). Källan sparas i radens anteckning.
//   c) Justera fritt. En ändrad prisuppgift märks Justerat för hand och skrivs
//      aldrig över av ett nytt förslag.
//   d) Exportera: finns köparens Excel skrivs priserna in i en kopia av deras
//      fil i rätt cell, annars en egen xlsx med benämning, enhet, mängd och pris.
// Ersätter "Fyll från kalkylen" (en rad "Besök enligt avtalet") sedan 3.64.0.

import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Icon } from '../../../icons/Icon'
import { ProcurementService, type NoticeWithRelations } from '../../../../services/procurementService'
import { PriceListService } from '../../../../services/priceListService'
import { DEFAULT_CALC_INPUT } from '../../../../services/procurementCalcService'
import type { PriceList } from '../../../../types/articles'
import type { PricingSettings } from '../../../../types/pricingSettings'
import type { ProcurementBid, ProcurementDocument, ProcurementPriceLine } from '../../../../types/procurement'
import { marginPercent, toneTextClass } from '../../../../shared/marginEngine'
import { MANUAL_NOTE, appendixTotals, lineMarginTone, shouldSuggest, suggestPrice, type CalcBasis, type CatalogItem } from '../../../../shared/procurementPricing'
import { extensionOf, looksLikePriceAppendix } from '../../../../shared/procurementFiles'
import { todaySwedish } from '../../../../shared/procurementRules'
import { EmptyState, IconButton, LinkButton } from '../ui'
import { fmtKr, fmtNum, tableCls } from '../uiFormat'
import { BlurText, NumberField, checkboxCls, selectCls } from '../detail/fields'
import { downloadBlob, errMsg, useConfirm } from '../detail/helpers'
import type { SavedCalc } from '../BidCalculator'

interface Props {
  notice: NoticeWithRelations
  lines: ProcurementPriceLine[]
  documents: ProcurementDocument[]
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

const READABLE = ['xlsx', 'xls', 'xlsm', 'pdf']
/** exceljs kan skriva xlsx och xlsm, inte det äldre xls-formatet */
const WRITABLE = ['xlsx', 'xlsm']

function fmtMargin(pct: number | null): string {
  return pct == null ? '–' : `${fmtNum(pct, 1)} %`
}

const btnCls =
  'inline-flex items-center gap-1.5 h-9 min-h-[44px] sm:min-h-0 px-3 rounded-lg border border-slate-700 text-[13px] text-slate-200 hover:border-[#20c58f] hover:text-[#20c58f] disabled:opacity-50 transition-colors'

/** Kalkylens antaganden för kostnad per besök, utryckning och timme */
function basisFrom(bid: ProcurementBid | null, settings: PricingSettings | null): CalcBasis {
  const input = { ...DEFAULT_CALC_INPUT, ...((bid?.calc as Partial<SavedCalc> | undefined)?.input ?? {}) }
  return {
    hourlyCost: input.hourlyCost,
    hoursPerVisit: input.hoursPerVisit,
    travelHoursPerVisit: input.travelHoursPerVisit,
    consumablesPerVisit: input.consumablesPerVisit,
    hoursPerCallout: input.hoursPerCallout,
    targetMarginPercent: settings?.target_margin_percent ?? 35,
  }
}

async function loadCatalog(list: PriceList): Promise<CatalogItem[]> {
  const [services, articles] = await Promise.all([PriceListService.getPriceListServiceItems(list.id), PriceListService.getPriceListItems(list.id)])
  return [
    ...services
      .filter((s) => s.service)
      .map((s) => ({ id: s.id, name: s.service.name, unit: null, price: Number(s.custom_price), cost: null, kind: 'service' as const, listName: list.name })),
    ...articles
      .filter((a) => a.article)
      .map((a) => ({
        id: a.id,
        name: a.article.name,
        unit: a.article.unit ?? null,
        price: Number(a.custom_price),
        cost: a.article.default_price != null ? Number(a.article.default_price) : null,
        kind: 'article' as const,
        listName: list.name,
      })),
  ]
}

export default function PriceAppendix({ notice, lines, documents, settings, currentBid, onChanged }: Props) {
  const [picking, setPicking] = useState(false)
  const [reading, setReading] = useState(false)
  const [readOpen, setReadOpen] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const { confirm, node: confirmNode } = useConfirm()

  const candidates = useMemo(
    () =>
      documents
        .filter((d) => READABLE.includes(extensionOf(d.file_name)))
        .sort((a, b) => Number(looksLikePriceAppendix(b.file_name)) - Number(looksLikePriceAppendix(a.file_name))),
    [documents]
  )
  const [docId, setDocId] = useState('')
  useEffect(() => {
    if (!docId && candidates[0]) setDocId(candidates[0].id)
  }, [candidates, docId])

  const totals = useMemo(() => appendixTotals(lines), [lines])

  // Köparens fil att skriva priserna i: dokumentet de flesta raderna lästes ur
  const buyerFile = useMemo(() => {
    const counts = new Map<string, number>()
    for (const l of lines) if (l.source_document_id && l.source_cell) counts.set(l.source_document_id, (counts.get(l.source_document_id) ?? 0) + 1)
    const [id] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? []
    const doc = id ? documents.find((d) => d.id === id) : undefined
    return doc && WRITABLE.includes(extensionOf(doc.file_name)) ? doc : null
  }, [lines, documents])

  const floor = currentBid?.floor_price ?? null
  const target = currentBid?.target_price ?? null
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

  // a) Läs in köparens prisbilaga
  const readAppendix = async (replace = false) => {
    const doc = candidates.find((d) => d.id === docId)
    if (!doc) {
      toast.error('Välj köparens prisbilaga bland dokumenten')
      return
    }
    setReading(true)
    try {
      const res = await ProcurementService.readPriceAppendix(doc.id, replace)
      if ('conflict' in res) {
        confirm(
          'Läs in prisbilagan igen',
          `${res.conflict} rader är redan inlästa ur ${doc.file_name}. Ersätt dem med en ny inläsning? Priser du satt på de raderna försvinner.`,
          async () => {
            await readAppendix(true)
          },
          { confirmLabel: 'Ersätt raderna', variant: 'warning' }
        )
        return
      }
      toast.success(
        res.kind === 'xlsx'
          ? `${res.rows} poster inlästa, ${res.withCells} med cell för priset. Föreslå priser nu.`
          : `${res.rows} poster inlästa ur PDF:en. Föreslå priser nu.`
      )
      setReadOpen(false)
      onChanged()
    } catch (e) {
      toast.error(errMsg(e, 'Prisbilagan kunde inte läsas'))
    } finally {
      setReading(false)
    }
  }

  // b) Föreslå priser
  const suggest = async () => {
    const todo = lines.filter(shouldSuggest)
    if (lines.length === 0) {
      toast.error('Prisbilagan är tom. Läs in köparens prisbilaga först.')
      return
    }
    if (todo.length === 0) {
      toast('Alla rader har pris. Rader som justerats för hand skrivs inte över.')
      return
    }
    setSuggesting(true)
    try {
      const lists = await PriceListService.getActivePriceLists()
      const list = lists.find((l) => l.is_default) ?? lists[0] ?? null
      const catalog = list ? await loadCatalog(list) : []
      const basis = basisFrom(currentBid, settings)
      let priced = 0
      for (const l of todo) {
        const s = suggestPrice({ label: l.label, unit: l.unit }, catalog, basis)
        if (s.source === 'none') {
          if (l.unit_price == null) await ProcurementService.savePriceLine({ id: l.id, notice_id: notice.id, notes: s.note })
          continue
        }
        await ProcurementService.savePriceLine({
          id: l.id,
          notice_id: notice.id,
          unit_price: s.unitPrice,
          unit_cost: s.unitCost,
          price_list_item_id: s.priceListItemId,
          notes: s.note,
        })
        priced++
      }
      toast.success(`Pris föreslaget på ${priced} av ${todo.length} rader${list ? ` ur prislistan ${list.name} och kalkylen` : ' ur kalkylen'}`)
      onChanged()
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte föreslå priser'))
      onChanged()
    } finally {
      setSuggesting(false)
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

  // d) Export i köparens fil
  const exportBuyerFile = async () => {
    if (!buyerFile) return
    setExporting(true)
    try {
      const { default: ExcelJS } = await import('exceljs')
      const blob = await ProcurementService.downloadDocument(buyerFile.storage_path)
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(await blob.arrayBuffer())
      let written = 0
      let missing = 0
      for (const l of lines) {
        if (l.source_document_id !== buyerFile.id || !l.source_cell || !l.source_sheet) continue
        if (l.unit_price == null) {
          missing++
          continue
        }
        const ws = wb.getWorksheet(l.source_sheet)
        if (!ws) continue
        ws.getCell(l.source_cell).value = Number(l.unit_price)
        written++
      }
      if (written === 0) {
        toast.error('Inga priser att skriva in. Föreslå eller fyll i priser först.')
        return
      }
      const buffer = await wb.xlsx.writeBuffer()
      const base = buyerFile.file_name.replace(/\.(xlsx|xlsm)$/i, '')
      downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${base}_BeGone_${todaySwedish()}.xlsx`)
      toast.success(missing > 0 ? `${written} priser inskrivna i köparens fil. ${missing} rader saknar pris.` : `${written} priser inskrivna i köparens fil`)
    } catch (e) {
      toast.error(errMsg(e, 'Kunde inte skriva i köparens fil'))
    } finally {
      setExporting(false)
    }
  }

  // d) Egen sammanställning när köparens fil saknas
  const exportOwn = async () => {
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
      const header = ws.addRow(['Benämning', 'Enhet', 'Mängd', 'À-pris', 'Summa'])
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

  const totalTone = toneTextClass(lineMarginTone(totals.margin, settings))
  const priced = lines.filter((l) => l.unit_price != null).length

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btnCls} onClick={() => setReadOpen((o) => !o)} disabled={reading} aria-expanded={readOpen}>
          <Icon name="upphandling.underlag" size={16} />
          Läs in köparens prisbilaga
        </button>
        <button type="button" className={btnCls} onClick={() => void suggest()} disabled={suggesting || lines.length === 0}>
          <Icon name="allman.kalkyl" size={16} />
          {suggesting ? 'Föreslår ...' : 'Föreslå priser'}
        </button>
        {buyerFile ? (
          <button type="button" className={btnCls} onClick={() => void exportBuyerFile()} disabled={exporting}>
            <Icon name="upphandling.excel" size={16} />
            Exportera i köparens fil
          </button>
        ) : null}
        <IconButton
          icon={<Icon name="upphandling.excel" size={20} />}
          label={buyerFile ? 'Exportera en egen sammanställning till Excel' : 'Exportera till Excel'}
          onClick={() => void exportOwn()}
          disabled={exporting || lines.length === 0}
        />
        <span className="ml-auto flex items-center gap-3">
          <LinkButton onClick={() => setPicking((p) => !p)}>{picking ? 'Stäng prislistan' : 'Hämta från prislista'}</LinkButton>
          <LinkButton onClick={() => void addEmpty()}>Lägg till rad</LinkButton>
        </span>
      </div>
      <p className="mt-2 mb-3 text-[12px] text-slate-500">
        1. Läs in köparens prisbilaga så blir varje post en rad. 2. Föreslå priser hämtar pris ur prislistan eller kalkylen. 3. Justera. 4. Exportera i köparens eget format.
      </p>

      {readOpen && (
        <div className="mb-3 p-3 rounded-lg border border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row sm:items-center gap-2">
          {candidates.length === 0 ? (
            <p className="text-[12.5px] text-slate-400">Inga Excel- eller PDF-filer bland dokumenten. Lägg köparens prisbilaga i steget Underlag först.</p>
          ) : (
            <>
              <select className={`${selectCls} sm:flex-1`} value={docId} onChange={(e) => setDocId(e.target.value)} aria-label="Köparens prisbilaga">
                {candidates.map((d) => (
                  <option key={d.id} value={d.id}>{d.file_name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void readAppendix(false)}
                disabled={reading || !docId}
                className="inline-flex items-center justify-center gap-1.5 h-9 min-h-[44px] sm:min-h-0 px-3 rounded-lg bg-[#20c58f] hover:bg-[#1bb07f] text-[#fff] text-[13px] font-medium disabled:opacity-50"
              >
                <Icon name="kalla.ai" size={16} />
                {reading ? 'AI läser ...' : 'Läs in'}
              </button>
            </>
          )}
        </div>
      )}

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
                  notes: 'Ur prislistan',
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
        <div className="rounded-[10px] border border-slate-800">
          <EmptyState title="Prisbilagan är tom" hint="Läs in köparens prisbilaga, eller hämta rader från en prislista." />
        </div>
      ) : (
        <div className="rounded-[10px] border border-slate-800 bg-slate-900/40 overflow-x-auto">
          <table className={tableCls.table}>
            <thead className={tableCls.thead}>
              <tr>
                <th className={tableCls.th}>Köparens post</th>
                <th className={tableCls.th}>Enhet</th>
                <th className={tableCls.thRight}>Mängd</th>
                <th className={tableCls.thRight}>Vårt pris</th>
                <th className={tableCls.thRight}>Kostnad</th>
                <th className={tableCls.thRight}>Summa</th>
                <th className={tableCls.thRight}>Marginal</th>
                <th className="w-11" />
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
                    <td className={`${tableCls.td} min-w-[220px]`}>
                      <BlurText value={l.label} onCommit={(v) => v && void patch(l, { label: v })} ariaLabel="Benämning" />
                      <div className="mt-0.5 text-[11px] text-slate-500">
                        {[l.notes, l.source_cell ? `cell ${l.source_sheet ? `${l.source_sheet}!` : ''}${l.source_cell}` : null].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td className={`${tableCls.td} w-20`}>
                      <BlurText value={l.unit} onCommit={(v) => void patch(l, { unit: v })} ariaLabel="Enhet" />
                    </td>
                    <td className={`${tableCls.td} w-24`}>
                      <NumberField value={l.quantity} commitOnBlur onChange={(n) => void patch(l, { quantity: n ?? 0 })} ariaLabel="Mängd" />
                    </td>
                    <td className={`${tableCls.td} w-28`}>
                      <NumberField value={l.unit_price} commitOnBlur onChange={(n) => void patch(l, { unit_price: n, notes: MANUAL_NOTE })} ariaLabel="Vårt pris" />
                    </td>
                    <td className={`${tableCls.td} w-28`}>
                      <NumberField value={l.unit_cost} commitOnBlur onChange={(n) => void patch(l, { unit_cost: n })} ariaLabel="Kostnad per enhet" />
                    </td>
                    <td className={tableCls.tdRight}>{fmtKr(sum)}</td>
                    <td className={`${tableCls.tdRight} ${toneTextClass(lineMarginTone(pct, settings))}`}>{fmtMargin(pct)}</td>
                    <td className="px-1 align-top">
                      <IconButton icon={<Icon name="allman.radera" size={16} />} label={`Ta bort ${l.label}`} onClick={() => remove(l)} tone="danger" />
                    </td>
                  </tr>
                )
              })}
              <tr className="border-t border-slate-700">
                <td className={`${tableCls.td} font-medium text-slate-100`} colSpan={5}>
                  Summa per år
                  <div className="text-[11px] font-normal text-slate-500">
                    {priced} av {lines.length} rader har pris
                    {floor != null && target != null ? `. Golvpris ${fmtKr(floor)}, målpris ${fmtKr(target)}.` : floor != null ? `. Golvpris ${fmtKr(floor)}.` : '. Ingen sparad kalkyl att jämföra med.'}
                  </div>
                </td>
                <td className={`${tableCls.tdRight} font-medium ${floor != null && totals.revenue < floor ? 'text-red-400' : 'text-slate-100'}`}>{fmtKr(totals.revenue)}</td>
                <td className={`${tableCls.tdRight} font-medium ${totalTone}`} title={totals.costKnown ? undefined : 'Kostnad saknas på någon rad med pris'}>
                  {totals.costKnown ? fmtMargin(totals.margin) : 'kostnad saknas'}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11.5px] text-slate-500 mt-2">
        Marginal räknas som (pris minus kostnad) delat med pris. Röd under noll, gul under minimimarginalen. Stäm alltid av mot köparens egen prisbilaga innan inlämning.
      </p>
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
    const list = lists.find((l) => l.id === listId)
    if (!list) return
    let alive = true
    setLoading(true)
    setSelected(new Set())
    loadCatalog(list)
      .then((cat) => {
        if (!alive) return
        setItems(
          cat
            .map((c) => ({ id: c.id, name: c.name, unit: c.unit ?? 'st', price: c.price, cost: c.cost, kind: c.kind === 'service' ? ('Tjänst' as const) : ('Artikel' as const) }))
            .sort((a, b) => a.name.localeCompare(b.name, 'sv'))
        )
      })
      .catch((e) => alive && toast.error(errMsg(e, 'Kunde inte hämta prislistan')))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [listId, lists])

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
          aria-label="Sök i prislistan"
        />
      </div>
      <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/70">
        {loading ? (
          <p className="text-[12px] text-slate-500 py-2">Hämtar ...</p>
        ) : visible.length === 0 ? (
          <p className="text-[12px] text-slate-500 py-2">Inga poster i prislistan.</p>
        ) : (
          visible.map((i) => (
            <label key={i.id} className="flex items-center gap-2 py-1.5 min-h-[40px] text-[12.5px] cursor-pointer">
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
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-slate-500">Prislistans pris blir vårt pris. Artiklar får sin inköpskostnad som kostnad; tjänster saknar kostnad.</span>
        <button
          type="button"
          disabled={selected.size === 0 || adding}
          onClick={() => {
            setAdding(true)
            void onAdd(items.filter((i) => selected.has(i.id))).finally(() => setAdding(false))
          }}
          className="inline-flex items-center justify-center gap-1.5 h-9 min-h-[44px] sm:min-h-0 px-3 rounded-lg bg-[#20c58f] hover:bg-[#1bb07f] text-[#fff] text-[13px] font-medium disabled:opacity-50 shrink-0"
        >
          <Icon name="allman.plus" size={16} />
          Lägg till{selected.size > 0 ? ` ${selected.size}` : ''}
        </button>
      </div>
    </div>
  )
}
