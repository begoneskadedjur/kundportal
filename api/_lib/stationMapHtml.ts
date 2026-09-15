// api/_lib/stationMapHtml.ts
// HTML-mallar för "Stationskarta" (kund/enhet) och "Stationsöversikt" (regionskund).
// Samma utseende som det interna dokumentet gen-stationskarta-kvarnen.mjs:
// A4 liggande, försättssida med logga, brandgrön, numrerade markörer, stationslista.
// Ren mall utan databasanrop så att den kan testas lokalt.

import { BEGONE_LOGO_DATA_URI } from './begoneLogo'

const BRAND = '#20c58f'

export interface MapCustomerInfo {
  company_name: string
  site_name?: string | null
  organization_number?: string | null
  contact_address?: string | null
  contact_person?: string | null
  contract_type?: string | null
  contract_start_date?: string | null
  contract_end_date?: string | null
  account_manager?: string | null
  parent_company_name?: string | null
}

export interface MapStationType {
  name: string
  color: string
  prefix?: string | null
  description?: string | null
}

export interface MapStation {
  idx: number            // löpnummer i dokumentet (unikt över alla sektioner)
  code: string | null    // KF-001, serienummer eller null
  type: string
  color: string
  location: string | null
  status: string
  placed_at: string | null
}

export interface IndoorSection {
  kind: 'indoor'
  title: string          // planritningens namn
  subtitle?: string | null
  imageDataUri: string | null
  stations: Array<MapStation & { x: number; y: number }>
}

export interface OutdoorSection {
  kind: 'outdoor'
  title: string
  mapDataUri: string | null   // satellitkarta renderad i Puppeteer, null om nyckel saknas
  stations: Array<MapStation & { lat: number; lng: number }>
}

export interface StationMapData {
  customer: MapCustomerInfo
  documentDate: string   // ÅÅÅÅ-MM-DD
  types: MapStationType[]
  sections: Array<IndoorSection | OutdoorSection>
}

export interface OverviewRegion {
  name: string
  region?: string | null
  color: string
  counts: Record<string, number>
  total: number
}

export interface StationOverviewData {
  organization: MapCustomerInfo
  documentDate: string
  types: MapStationType[]
  regions: OverviewRegion[]
  mapDataUri: string | null
}

// ------------------------------------------------------------------
// Hjälpare
// ------------------------------------------------------------------

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function formatDateSv(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  // Svensk lokal tid, ÅÅÅÅ-MM-DD
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktiv',
  removed: 'Borttagen',
  missing: 'Saknas',
  damaged: 'Skadad',
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status] || status
}

// Bara startdatum: slutdatumet är inget hårt datum, de flesta avtal fortsätter
function contractLine(c: MapCustomerInfo): string {
  const type = c.contract_type || 'Skadedjursavtal'
  const start = formatDateSv(c.contract_start_date)
  if (start) return `${escapeHtml(type)} från ${start}`
  return escapeHtml(type)
}

function baseStyles(): string {
  return `
  @page { size: A4 landscape; margin: 16mm 16mm 14mm 16mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    color: #1f2937; font-size: 10.5pt; line-height: 1.5;
  }
  .page { page-break-after: always; position: relative; height: 180mm; overflow: hidden; }
  .page:last-child { page-break-after: auto; }

  .cover-top { display:flex; align-items:flex-start; justify-content:space-between; }
  .cover img.logo { width: 150px; height: auto; }
  .cover-doctype { text-align:right; font-size: 9pt; letter-spacing: 1.5px; text-transform: uppercase; color:#6b7280; padding-top: 6px; }
  .cover-center { margin-top: 30mm; }
  .cover-kicker { color: ${BRAND}; font-weight: 700; font-size: 11pt; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 10px; }
  .cover h1 { font-size: 30pt; line-height:1.15; margin: 0 0 12px; color:#0f172a; font-weight: 700; }
  .cover .subtitle { font-size: 13pt; color:#475569; max-width: 70%; }
  .cover-rule { height: 4px; width: 70px; background: ${BRAND}; margin: 20px 0; border-radius:2px; }
  .cover-meta { font-size: 10pt; color:#475569; columns: 2; column-gap: 40px; max-width: 170mm; }
  .cover-meta div { margin-bottom: 3px; break-inside: avoid; }
  .cover-meta b { color:#0f172a; font-weight:600; }
  .footer { position:absolute; bottom:0; left:0; right:0; border-top:1px solid #e5e7eb; padding-top:6px; font-size: 8.5pt; color:#9ca3af; display:flex; justify-content:space-between; background:#fff; }

  h2 { font-size: 13.5pt; color:#0f172a; margin: 0 0 8px; padding-bottom: 5px; border-bottom: 2px solid #e5e7eb; }
  h2 .num { color: ${BRAND}; font-weight:700; margin-right: 8px; }
  p { margin: 0 0 8px; }
  table { width:100%; border-collapse: collapse; margin: 6px 0 12px; font-size: 9.5pt; }
  th, td { border:1px solid #e5e7eb; padding: 4px 8px; text-align:left; vertical-align: middle; }
  td.nw, th.nw { white-space: nowrap; }
  th { background:#f0fdf9; color:#0f172a; font-weight:600; }
  tr:nth-child(even) td { background:#fafafa; }
  td.c, th.c { text-align:center; }
  .mono { font-family: Consolas, 'Courier New', monospace; font-size: 9.5pt; }
  .muted { color:#6b7280; font-size:9pt; }
  .callout { background:#f0fdf9; border-left:4px solid ${BRAND}; padding:8px 14px; border-radius:4px; margin: 8px 0 12px; }
  .callout .ct { font-weight:700; color:#0f172a; margin-bottom:2px; }
  .dot { display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:6px; vertical-align:middle; }
  .mini { display:inline-block; width:18px; height:18px; line-height:18px; border-radius:50%; color:#fff; font-weight:700; font-size:8.5pt; text-align:center; }
  .swatch { display:inline-block; width:14px; height:14px; border-radius:3px; margin-right:6px; vertical-align:middle; border:1px solid rgba(0,0,0,.15); }

  .maphead { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 6px; }
  .maphead .title { font-size: 13.5pt; font-weight:700; color:#0f172a; }
  .maphead .title .kick { color:${BRAND}; font-size: 9pt; letter-spacing: 1.5px; text-transform: uppercase; display:block; font-weight:700; }
  .maphead .info { font-size: 9pt; color:#6b7280; text-align:right; }
  .mapwrap { text-align:center; }
  .map { position:relative; display:inline-block; border:1px solid #e5e7eb; border-radius:4px; overflow:hidden; background:#fff; }
  .map img { display:block; height:143mm; width:auto; max-width:100%; }
  .map img.sat { height:140mm; }
  .marker {
    position:absolute; width: 22px; height: 22px; margin-left:-11px; margin-top:-11px;
    border-radius:50%; color:#fff; font-weight:700; font-size:10pt; line-height:20px; text-align:center;
    border: 2px solid #fff; box-shadow: 0 0 0 1.5px rgba(15,23,42,.45), 0 1px 3px rgba(0,0,0,.35);
  }
  .legendbar { display:flex; gap:22px; align-items:center; margin-top: 8px; font-size: 9.5pt; padding: 6px 10px; border:1px solid #e5e7eb; border-radius:4px; background:#fafafa; }
  .legendbar .lgt { font-weight:600; color:#0f172a; margin-right: 4px; }
  .lg { white-space:nowrap; }
  .cols { display:flex; gap: 24px; }
  .cols > div { flex:1; }
  .nomap { height:120mm; display:flex; align-items:center; justify-content:center; border:1px dashed #cbd5e1; border-radius:4px; color:#6b7280; font-size:10pt; }
  `
}

function footer(docLabel: string, name: string, date: string): string {
  return `<div class="footer">
    <span>Begone Skadedjur &amp; Sanering AB &middot; Org.nr 559378-9208 &middot; 010 280 44 10 &middot; info@begone.se</span>
    <span>${escapeHtml(docLabel)} &middot; ${escapeHtml(name)} &middot; v1.0 &middot; ${escapeHtml(date)}</span>
  </div>`
}

function legendFor(types: MapStationType[], stations: MapStation[]): string {
  const counts = new Map<string, number>()
  for (const s of stations) counts.set(s.type, (counts.get(s.type) || 0) + 1)
  return types
    .filter(t => counts.has(t.name))
    .map(t => `<div class="lg"><span class="dot" style="background:${escapeHtml(t.color)}"></span>${escapeHtml(t.name)} <span class="muted">(${counts.get(t.name)} st)</span></div>`)
    .join('')
}

// ------------------------------------------------------------------
// Stationskarta
// ------------------------------------------------------------------

export function buildStationMapHtml(data: StationMapData): string {
  const { customer, documentDate, types, sections } = data
  const displayName = customer.site_name || customer.company_name
  const allStations: MapStation[] = sections.flatMap(s => s.stations as MapStation[])
  const indoorCount = sections.filter(s => s.kind === 'indoor').reduce((n, s) => n + s.stations.length, 0)
  const outdoorCount = sections.filter(s => s.kind === 'outdoor').reduce((n, s) => n + s.stations.length, 0)
  const earliest = allStations
    .map(s => s.placed_at)
    .filter((d): d is string => !!d)
    .sort()[0]

  const countLine = [
    outdoorCount ? `${outdoorCount} utomhus` : null,
    indoorCount ? `${indoorCount} inomhus` : null,
  ].filter(Boolean).join(', ')

  // Försättssida
  const cover = `
<section class="page cover">
  <div class="cover-top">
    <img class="logo" src="${BEGONE_LOGO_DATA_URI}" alt="Begone Skadedjur">
    <div class="cover-doctype">Stationskarta<br>Skadedjursavtal</div>
  </div>
  <div class="cover-center">
    <div class="cover-kicker">Stationskarta</div>
    <h1>${escapeHtml(displayName)}</h1>
    <div class="subtitle">Placering av f&auml;llor och stationer${customer.contact_address ? `, ${escapeHtml(customer.contact_address)}` : ''}</div>
    <div class="cover-rule"></div>
    <div class="cover-meta">
      <div><b>Kund:</b> ${escapeHtml(customer.parent_company_name || customer.company_name)}</div>
      ${customer.parent_company_name ? `<div><b>Enhet:</b> ${escapeHtml(displayName)}</div>` : ''}
      ${customer.organization_number ? `<div><b>Org.nr:</b> ${escapeHtml(customer.organization_number)}</div>` : ''}
      ${customer.contact_address ? `<div><b>Adress:</b> ${escapeHtml(customer.contact_address)}</div>` : ''}
      ${customer.contact_person ? `<div><b>Kontaktperson:</b> ${escapeHtml(customer.contact_person)}</div>` : ''}
      <div><b>Avtal:</b> ${contractLine(customer)}</div>
      <div><b>Antal stationer:</b> ${allStations.length}${countLine ? ` (${countLine})` : ''}</div>
      ${earliest ? `<div><b>Utplacerade:</b> ${formatDateSv(earliest)}</div>` : ''}
      ${customer.account_manager ? `<div><b>Kontaktperson Begone:</b> ${escapeHtml(customer.account_manager)}</div>` : ''}
      <div><b>Dokumenttyp:</b> Stationskarta</div>
      <div><b>Datum:</b> ${escapeHtml(documentDate)}</div>
      <div><b>Version:</b> 1.0</div>
    </div>
  </div>
  ${footer('Stationskarta', displayName, documentDate)}
</section>`

  // En kartsida per sektion
  const mapPages = sections.map(section => {
    let mapBlock: string
    if (section.kind === 'indoor') {
      const markers = section.stations.map(s =>
        `<div class="marker" style="left:${s.x}%; top:${s.y}%; background:${escapeHtml(s.color)}">${s.idx}</div>`).join('')
      mapBlock = section.imageDataUri
        ? `<div class="mapwrap"><div class="map"><img src="${section.imageDataUri}" alt="Planritning">${markers}</div></div>`
        : `<div class="nomap">Planritningen kunde inte l&auml;sas in.</div>`
    } else {
      mapBlock = section.mapDataUri
        ? `<div class="mapwrap"><div class="map"><img class="sat" src="${section.mapDataUri}" alt="Satellitkarta"></div></div>`
        : `<div class="nomap">Kartbild saknas. Stationernas koordinater finns i stationslistan.</div>`
    }
    const info = section.kind === 'indoor'
      ? `Planritning &middot; ${section.stations.length} stationer inomhus`
      : `Satellitbild &middot; ${section.stations.length} stationer utomhus`
    return `
<section class="page">
  <div class="maphead">
    <div class="title"><span class="kick">Stationskarta</span>${escapeHtml(displayName)}: ${escapeHtml(section.title)}</div>
    <div class="info">${info}</div>
  </div>
  ${mapBlock}
  <div class="legendbar">
    <span class="lgt">Teckenf&ouml;rklaring</span>
    ${legendFor(types, section.stations)}
    <span class="muted" style="margin-left:auto">Siffran i mark&ouml;ren h&auml;nvisar till stationslistan.</span>
  </div>
  ${footer('Stationskarta', displayName, documentDate)}
</section>`
  }).join('')

  // Stationslista, 26 rader per sida
  const ROWS_PER_PAGE = 17
  const listRows: string[] = []
  for (const section of sections) {
    for (const s of section.stations) {
      const where = s.location
        ? escapeHtml(s.location)
        : 'lat' in s && typeof s.lat === 'number'
          ? `<span class="muted">${s.lat.toFixed(5)}, ${s.lng.toFixed(5)}</span>`
          : `<span class="muted">Se karta</span>`
      listRows.push(`<tr>
        <td class="c"><span class="mini" style="background:${escapeHtml(s.color)}">${s.idx}</span></td>
        <td class="mono">${s.code ? escapeHtml(s.code) : '<span class="muted">&ndash;</span>'}</td>
        <td class="nw"><span class="dot" style="background:${escapeHtml(s.color)}"></span>${escapeHtml(s.type)}</td>
        <td>${escapeHtml(section.title)}</td>
        <td>${where}</td>
        <td class="nw">${escapeHtml(statusLabel(s.status))}</td>
        <td class="nw">${formatDateSv(s.placed_at) || '<span class="muted">&ndash;</span>'}</td>
      </tr>`)
    }
  }
  const tableHead = `<tr>
    <th class="c" style="width:6%">Nr</th>
    <th style="width:11%">Station</th>
    <th class="nw">Typ</th>
    <th style="width:16%">Del</th>
    <th>Placering</th>
    <th class="nw">Status</th>
    <th class="nw">Utplacerad</th>
  </tr>`

  const typeCounts = types
    .map(t => ({ t, n: allStations.filter(s => s.type === t.name).length }))
    .filter(x => x.n > 0)
  const typeTable = `
      <h2><span class="num">2.</span>Stationstyper</h2>
      <table>
        <tr><th>Typ</th><th style="width:16%">Kod</th><th>Beskrivning</th><th class="c" style="width:14%">Antal</th></tr>
        ${typeCounts.map(({ t, n }) => `<tr>
          <td><span class="dot" style="background:${escapeHtml(t.color)}"></span>${escapeHtml(t.name)}</td>
          <td class="mono">${escapeHtml(t.prefix || '')}</td>
          <td>${escapeHtml(t.description || '')}</td>
          <td class="c">${n}</td>
        </tr>`).join('')}
        <tr><td colspan="3"><b>Totalt</b></td><td class="c"><b>${allStations.length}</b></td></tr>
      </table>
      <div class="callout">
        <div class="ct">S&aring; anv&auml;nds kartan</div>
        Kartan visar var varje station sitter. Vid servicebes&ouml;k kontrollerar teknikern samtliga stationer och resultatet finns sedan i kundportalen under Genomf&ouml;rda kontroller. Flyttas eller tas en station bort uppdateras kartan i portalen och en ny version kan laddas ned.
      </div>
      <p class="muted">Stationerna f&aring;r inte flyttas, t&auml;ckas &ouml;ver eller blockeras. H&ouml;r av er till oss om en station skadas eller f&ouml;rsvinner.</p>`

  const listPages: string[] = []
  const firstPageRows = Math.min(listRows.length, ROWS_PER_PAGE)
  // Första listsidan: lista till vänster, typtabell till höger (om listan är kort), annars full bredd
  const compact = listRows.length <= 14
  listPages.push(`
<section class="page">
  <div class="cols">
    <div style="flex:1.8">
      <h2><span class="num">1.</span>Stationslista</h2>
      <table>${tableHead}${listRows.slice(0, compact ? listRows.length : firstPageRows).join('')}</table>
      <p class="muted">Stationsnumret sitter p&aring; etiketten p&aring; varje station och &auml;r samma som i kundportalen under F&auml;llor &amp; stationer.</p>
    </div>
    ${compact ? `<div>${typeTable}</div>` : ''}
  </div>
  ${footer('Stationskarta', displayName, documentDate)}
</section>`)
  if (!compact) {
    for (let i = firstPageRows; i < listRows.length; i += ROWS_PER_PAGE) {
      listPages.push(`
<section class="page">
  <h2><span class="num">1.</span>Stationslista (forts.)</h2>
  <table>${tableHead}${listRows.slice(i, i + ROWS_PER_PAGE).join('')}</table>
  ${footer('Stationskarta', displayName, documentDate)}
</section>`)
    }
    listPages.push(`
<section class="page">
  <div class="cols"><div>${typeTable}</div><div></div></div>
  ${footer('Stationskarta', displayName, documentDate)}
</section>`)
  }

  return `<!DOCTYPE html>
<html lang="sv"><head><meta charset="utf-8"><title>Stationskarta ${escapeHtml(displayName)}</title>
<style>${baseStyles()}</style></head>
<body>${cover}${mapPages}${listPages.join('')}</body></html>`
}

// ------------------------------------------------------------------
// Stationsöversikt (regionskund: antal per region, inga enskilda stationer)
// ------------------------------------------------------------------

export function buildStationOverviewHtml(data: StationOverviewData): string {
  const { organization, documentDate, types, regions, mapDataUri } = data
  const name = organization.company_name
  const total = regions.reduce((n, r) => n + r.total, 0)
  const usedTypes = types.filter(t => regions.some(r => (r.counts[t.name] || 0) > 0))

  const cover = `
<section class="page cover">
  <div class="cover-top">
    <img class="logo" src="${BEGONE_LOGO_DATA_URI}" alt="Begone Skadedjur">
    <div class="cover-doctype">Stations&ouml;versikt<br>Skadedjursavtal</div>
  </div>
  <div class="cover-center">
    <div class="cover-kicker">Stations&ouml;versikt</div>
    <h1>${escapeHtml(name)}</h1>
    <div class="subtitle">Antal f&auml;llor och stationer per region</div>
    <div class="cover-rule"></div>
    <div class="cover-meta">
      <div><b>Kund:</b> ${escapeHtml(name)}</div>
      ${organization.organization_number ? `<div><b>Org.nr:</b> ${escapeHtml(organization.organization_number)}</div>` : ''}
      ${organization.contact_address ? `<div><b>Adress:</b> ${escapeHtml(organization.contact_address)}</div>` : ''}
      ${organization.contact_person ? `<div><b>Kontaktperson:</b> ${escapeHtml(organization.contact_person)}</div>` : ''}
      <div><b>Avtal:</b> ${contractLine(organization)}</div>
      <div><b>Antal regioner:</b> ${regions.length}</div>
      <div><b>Antal stationer:</b> ${total}</div>
      ${organization.account_manager ? `<div><b>Kontaktperson Begone:</b> ${escapeHtml(organization.account_manager)}</div>` : ''}
      <div><b>Dokumenttyp:</b> Stations&ouml;versikt</div>
      <div><b>Datum:</b> ${escapeHtml(documentDate)}</div>
      <div><b>Version:</b> 1.0</div>
    </div>
  </div>
  ${footer('Stationsöversikt', name, documentDate)}
</section>`

  const mapPage = mapDataUri ? `
<section class="page">
  <div class="maphead">
    <div class="title"><span class="kick">Stations&ouml;versikt</span>${escapeHtml(name)}: regioner</div>
    <div class="info">${regions.length} regioner &middot; ${total} stationer</div>
  </div>
  <div class="mapwrap"><div class="map"><img class="sat" src="${mapDataUri}" alt="Regionkarta"></div></div>
  <div class="legendbar">
    <span class="lgt">Regioner</span>
    ${regions.map(r => `<div class="lg"><span class="swatch" style="background:${escapeHtml(r.color)}"></span>${escapeHtml(r.name)} <span class="muted">(${r.total} st)</span></div>`).join('')}
  </div>
  ${footer('Stationsöversikt', name, documentDate)}
</section>` : ''

  const ROWS_PER_PAGE = 22
  const head = `<tr>
    <th style="width:26%">Region</th>
    ${usedTypes.map(t => `<th class="c"><span class="dot" style="background:${escapeHtml(t.color)}"></span>${escapeHtml(t.name)}</th>`).join('')}
    <th class="c" style="width:10%">Totalt</th>
  </tr>`
  const rows = regions.map(r => `<tr>
    <td><span class="swatch" style="background:${escapeHtml(r.color)}"></span>${escapeHtml(r.name)}${r.region && r.region !== r.name ? ` <span class="muted">${escapeHtml(r.region)}</span>` : ''}</td>
    ${usedTypes.map(t => `<td class="c">${r.counts[t.name] || 0}</td>`).join('')}
    <td class="c"><b>${r.total}</b></td>
  </tr>`)
  const totalRow = `<tr>
    <td><b>Totalt</b></td>
    ${usedTypes.map(t => `<td class="c"><b>${regions.reduce((n, r) => n + (r.counts[t.name] || 0), 0)}</b></td>`).join('')}
    <td class="c"><b>${total}</b></td>
  </tr>`

  const tablePages: string[] = []
  for (let i = 0; i < Math.max(rows.length, 1); i += ROWS_PER_PAGE) {
    const last = i + ROWS_PER_PAGE >= rows.length
    tablePages.push(`
<section class="page">
  <h2><span class="num">${i === 0 ? '1.' : ''}</span>Stationer per region${i > 0 ? ' (forts.)' : ''}</h2>
  <table>${head}${rows.slice(i, i + ROWS_PER_PAGE).join('')}${last ? totalRow : ''}</table>
  ${last ? `<p class="muted">Antalet avser aktiva stationer registrerade i kundportalen. Enskilda stationer och deras placering visas i portalen under F&auml;llor &amp; stationer.</p>` : ''}
  ${footer('Stationsöversikt', name, documentDate)}
</section>`)
  }

  return `<!DOCTYPE html>
<html lang="sv"><head><meta charset="utf-8"><title>Stations&ouml;versikt ${escapeHtml(name)}</title>
<style>${baseStyles()}</style></head>
<body>${cover}${mapPage}${tablePages.join('')}</body></html>`
}
