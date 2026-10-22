// api/special-report-pdf.ts
// Specialrapporter (3.50.0): PDF enligt dokumentstandarden och utskick till kund.
// 3.54.0: avvikelser lyfts fram (röd accent i tabellen, ruta per del och på
// översikten) och rekommenderade åtgärder visas som numrerad lista i en grön panel.
// Sedan 3.51.0 har varje del en egen färg (special_report_sections.color): numret
// och strecket vid rubriken, polygonerna och numren på kartorna. Reserv: paletten
// i tur och ordning, som i redigeraren.
// Kontrakt: docs/specialrapporter/KONTRAKT.md
//
// POST { reportId, action: 'download' | 'send', recipients?, subject?, message?, saveToCase? }
//  - download: renderar pågående version till special-reports/{id}/versioner/utkast.pdf
//    och svarar { url, filename, pageCount } (signerad URL, 1 h)
//  - send: renderar, sparar som versioner/v{n}.pdf, mejlar via Resend (bilaga upp till
//    8 MB, annars länk), skapar rad i special_report_versions, räknar upp
//    current_version. Sparas inte i sanitation_reports (se handlern)
//    och svarar { version }
//
// Åtkomst: samma regel som RLS-funktionen can_access_special_report (admin,
// koordinator, tekniker 1-3 på ärendet, tekniker på ärendets besök eller
// skaparen). Data läses med service role.
// Kartorna är satellitskärmdumpar via Maps JS i Puppeteer (Static Maps blockerar
// satellit i EU/EEA), alla i samma browser-session som PDF:en.

import type { VercelRequest, VercelResponse } from '@vercel/node'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { requireAuthenticated } from './_lib/auth'
import { BEGONE_LOGO_DATA_URI } from './_lib/begoneLogo'
import {
  AVVIKELSE_FARG,
  AVVIKELSE_TON,
  EVENT_TYPES,
  SECTION_COLORS,
  atgardsRader,
  avvikelserIRapporten,
  SECTION_LABELS,
  type LatLng,
  type SpecialReport,
  type SpecialReportBlock,
  type SpecialReportEvent,
  type SpecialReportImage,
  type SpecialReportSection,
  type SpecialReportVersion,
} from '../src/types/specialReport'

const MAX_EMAIL_ATTACHMENT_BYTES = 8 * 1024 * 1024
const BUCKET = 'special-reports'
const SIGNED_URL_SECONDS = 3600
// Länk i mejlet när PDF:en är för stor för bilaga
const EMAIL_LINK_SECONDS = 30 * 24 * 3600
const BRAND = '#20c58f'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

type SectionFull = SpecialReportSection & {
  blocks: SpecialReportBlock[]
  events: SpecialReportEvent[]
  images: (SpecialReportImage & { dataUri: string | null })[]
}

interface ReportData {
  report: SpecialReport
  sections: SectionFull[]
  authors: string
}

// ----------------------------------------------------------------------------
// Hjälpare
// ----------------------------------------------------------------------------

const esc = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** Stycken av fri text: tom rad = nytt stycke, radbrytning behålls */
function paragraphs(text: string | null | undefined, style = ''): string {
  if (!text || !text.trim()) return ''
  return text
    .trim()
    .split(/\n\s*\n/)
    .map(p => `<p style="${style}">${esc(p.trim()).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/** Rader som börjar med - eller • blir punktlista, resten stycken */
function richText(text: string | null | undefined): string {
  if (!text || !text.trim()) return ''
  const blocks = text.trim().split(/\n\s*\n/)
  return blocks.map(block => {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length > 0 && lines.every(l => /^[-•*]\s+/.test(l))) {
      return `<ul>${lines.map(l => `<li>${esc(l.replace(/^[-•*]\s+/, ''))}</li>`).join('')}</ul>`
    }
    return `<p>${esc(lines.join('\n')).replace(/\n/g, '<br>')}</p>`
  }).join('')
}

/**
 * Ikoner som inline-SVG (samma ritningar som rapport.avvikelse och
 * rapport.atgarder i src/components/icons/set/rapport.tsx). Färgen är en fast
 * konstant och kommer aldrig från användaren.
 */
function iconSvg(name: 'avvikelse' | 'atgarder', color: string, size: number): string {
  const paths = name === 'avvikelse'
    ? `<path d="M10.3 4.5a2 2 0 0 1 3.4 0l7 12.2a2 2 0 0 1-1.7 3H5a2 2 0 0 1-1.7-3z"/><path d="M12 9.5v4.5"/><circle cx="12" cy="16.8" r="1" fill="${color}" stroke="none"/>`
    : '<path d="M3.5 6.5l1.5 1.5 3-3"/><path d="M3.5 13.5l1.5 1.5 3-3"/><path d="M11.5 6.5h9M11.5 13.5h9"/><path d="M4.5 19.5h2M11.5 19.5h6"/>'
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`
}

/** Röd ruta med avvikelser: rubrik med ikon och en rad per avvikelse (delen, datum och rubrik) */
function deviationBox(title: string, rows: { date: string; text: string; part?: string }[]): string {
  const items = rows.map(r =>
    `<li>${r.part ? `<span class="part">${esc(r.part)}</span>` : ''}<span class="date">${esc(r.date)}</span> <b>${esc(r.text)}</b></li>`,
  ).join('')
  return `<div class="deviation-box"><span class="box-title">${iconSvg('avvikelse', AVVIKELSE_FARG, 15)}${esc(title)}</span><ul>${items}</ul></div>`
}

/** Numrerad lista med runda gröna nummer */
function numberedList(rows: string[]): string {
  return `<ol class="numbered">${rows.map((r, i) => `<li><span class="n">${i + 1}</span><span class="t">${esc(r)}</span></li>`).join('')}</ol>`
}

function todaySwedish(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' })
}

const MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december']

/** "augusti till oktober 2026" ur ÅÅÅÅ-MM-DD */
function monthSpan(from: string | null, to: string | null): string {
  if (!from || !to) return ''
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  if (!fy || !fm || !ty || !tm) return ''
  if (fy === ty && fm === tm) return `${MONTHS[fm - 1]} ${fy}`
  if (fy === ty) return `${MONTHS[fm - 1]} till ${MONTHS[tm - 1]} ${fy}`
  return `${MONTHS[fm - 1]} ${fy} till ${MONTHS[tm - 1]} ${ty}`
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} och ${names[names.length - 1]}`
}

function safeFilename(value: string): string {
  return value.replace(/[/\\:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() || 'Rapport'
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function centroid(area: LatLng[]): LatLng {
  const n = area.length || 1
  return {
    lat: area.reduce((s, p) => s + p.lat, 0) / n,
    lng: area.reduce((s, p) => s + p.lng, 0) / n,
  }
}

/**
 * Delens färg (#rrggbb). Saknas den: samma reserv som redigeraren (fargForDel),
 * paletten i tur och ordning efter delens plats, så att PDF och skärm stämmer
 */
function sectionColor(s: { color?: string | null }, index: number): string {
  return s.color && /^#[0-9a-fA-F]{6}$/.test(s.color) ? s.color : SECTION_COLORS[index % SECTION_COLORS.length].value
}

function validArea(area: unknown): area is LatLng[] {
  return Array.isArray(area) && area.length >= 3 &&
    area.every(p => p && typeof p.lat === 'number' && typeof p.lng === 'number')
}

/** Antal sidor i Chromiums PDF (varje sida är ett /Type /Page-objekt) */
function countPdfPages(pdf: Buffer): number | null {
  const matches = pdf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g)
  return matches ? matches.length : null
}

// ----------------------------------------------------------------------------
// Åtkomst (samma regel som can_access_special_report i databasen)
// ----------------------------------------------------------------------------

async function canAccessReport(userId: string, report: SpecialReport): Promise<boolean> {
  if (report.created_by && report.created_by === userId) return true

  const { data: profile } = await supabase
    .from('profiles')
    .select('technician_id, is_admin, is_koordinator, role, extra_roles')
    .eq('user_id', userId)
    .maybeSingle()
  if (!profile) return false

  const extra: string[] = (profile.extra_roles as string[] | null) || []
  const isStaff = profile.is_admin === true || profile.is_koordinator === true ||
    ['admin', 'koordinator'].includes(String(profile.role)) ||
    extra.some(r => r === 'admin' || r === 'koordinator')
  if (isStaff) return true
  if (!profile.technician_id) return false

  const [table, columns] = report.case_type === 'contract'
    ? ['cases', ['primary_technician_id', 'secondary_technician_id', 'tertiary_technician_id']]
    : [report.case_type === 'private' ? 'private_cases' : 'business_cases',
      ['primary_assignee_id', 'secondary_assignee_id', 'tertiary_assignee_id']]
  const { data: caseRow } = await supabase
    .from(table)
    .select(columns.join(', '))
    .eq('id', report.case_id)
    .maybeSingle()
  const row = (caseRow ?? {}) as unknown as Record<string, string | null>
  if (columns.some(c => row[c] === profile.technician_id)) return true

  // Tekniker på något av ärendets besök (som tekniker_delaktig_i_arende)
  const visits = () => supabase
    .from('visits')
    .select('id')
    .eq('case_id', report.case_id)
    .eq('case_type', report.case_type)
    .limit(1)
  const [byColumn, byList] = await Promise.all([
    visits().eq('technician_id', profile.technician_id),
    visits().contains('technicians', [{ id: profile.technician_id }]),
  ])
  return (byColumn.data ?? []).length > 0 || (byList.data ?? []).length > 0
}

// ----------------------------------------------------------------------------
// Data
// ----------------------------------------------------------------------------

async function imageToDataUri(path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from(BUCKET).download(path)
    if (error || !data) return null
    const buffer = Buffer.from(await data.arrayBuffer())
    const type = data.type || (path.endsWith('.png') ? 'image/png' : path.endsWith('.webp') ? 'image/webp' : 'image/jpeg')
    return `data:${type};base64,${buffer.toString('base64')}`
  } catch (err) {
    console.error('[special-report-pdf] Bilden kunde inte hämtas:', path, err)
    return null
  }
}

async function loadReportData(report: SpecialReport): Promise<ReportData> {
  const { data: sectionRows, error: sectionsError } = await supabase
    .from('special_report_sections')
    .select('*')
    .eq('report_id', report.id)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
  if (sectionsError) throw new Error(`Delarna kunde inte hämtas: ${sectionsError.message}`)
  const sections = (sectionRows || []) as SpecialReportSection[]
  const sectionIds = sections.map(s => s.id)

  const [blocksRes, eventsRes, imagesRes] = await Promise.all([
    sectionIds.length > 0
      ? supabase.from('special_report_blocks').select('*').in('section_id', sectionIds)
        .order('position', { ascending: true }).order('created_at', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    sectionIds.length > 0
      ? supabase.from('special_report_events').select('*').in('section_id', sectionIds)
        .order('position', { ascending: true }).order('created_at', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    supabase.from('special_report_images').select('*').eq('report_id', report.id)
      .order('position', { ascending: true }).order('created_at', { ascending: true }),
  ])
  if (blocksRes.error) throw new Error(`Blocken kunde inte hämtas: ${blocksRes.error.message}`)
  if (eventsRes.error) throw new Error(`Händelserna kunde inte hämtas: ${eventsRes.error.message}`)
  if (imagesRes.error) throw new Error(`Bilderna kunde inte hämtas: ${imagesRes.error.message}`)

  const blocks = (blocksRes.data || []) as SpecialReportBlock[]
  const events = (eventsRes.data || []) as SpecialReportEvent[]
  const images = (imagesRes.data || []) as SpecialReportImage[]

  // Bilderna bäddas in (de är redan komprimerade till WebP vid uppladdning)
  const dataUris = await Promise.all(images.map(i => imageToDataUri(i.storage_path)))
  const imagesWithData = images.map((img, i) => ({ ...img, dataUri: dataUris[i] }))

  return {
    report,
    sections: sections.map(s => ({
      ...s,
      blocks: blocks.filter(b => b.section_id === s.id),
      events: events.filter(e => e.section_id === s.id),
      images: imagesWithData.filter(i => i.section_id === s.id),
    })),
    authors: await resolveAuthors(report, events),
  }
}

/** "Framtagen av": de som skapat och ändrat rapporten, annars ärendets tekniker */
async function resolveAuthors(report: SpecialReport, events: SpecialReportEvent[]): Promise<string> {
  const userIds = [...new Set([report.created_by, report.updated_by, ...events.map(e => e.created_by)]
    .filter((id): id is string => !!id))]
  const names: string[] = []

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, display_name, technician_id, technicians:technician_id(name)')
      .in('user_id', userIds)
    for (const p of (profiles || []) as unknown as {
      user_id: string; display_name: string | null; technicians: { name: string | null } | null
    }[]) {
      const name = (p.technicians?.name || p.display_name || '').trim()
      if (name && !names.includes(name)) names.push(name)
    }
  }
  if (names.length > 0) return joinNames(names)

  const [table, columns] = report.case_type === 'contract'
    ? ['cases', ['primary_technician_name', 'secondary_technician_name', 'tertiary_technician_name']]
    : [report.case_type === 'private' ? 'private_cases' : 'business_cases',
      ['primary_assignee_name', 'secondary_assignee_name', 'tertiary_assignee_name']]
  const { data: caseRow } = await supabase.from(table).select(columns.join(', ')).eq('id', report.case_id).maybeSingle()
  const row = (caseRow || {}) as unknown as Record<string, string | null>
  for (const c of columns) {
    const name = (row[c] || '').trim()
    if (name && !names.includes(name)) names.push(name)
  }
  return joinNames(names)
}

// ----------------------------------------------------------------------------
// Kartor: en sida med Maps JS som ritar om per vy, skärmdump per vy
// ----------------------------------------------------------------------------

interface MapShot {
  key: string
  width: number
  height: number
  /** Fast utsnitt (översikten) eller anpassa till områdena */
  view: { lat: number; lng: number; zoom: number } | null
  areas: { path: LatLng[]; label: string | null; highlight: boolean; color: string }[]
}

function numberMarkerSvg(label: string, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34">
<circle cx="17" cy="17" r="14" fill="${color}" stroke="#ffffff" stroke-width="3"/>
<text x="17" y="22" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="800" fill="#ffffff">${esc(label)}</text>
</svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

async function renderMapShots(browser: Browser, shots: MapShot[]): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey || shots.length === 0) return result

  const html = `<!DOCTYPE html>
<html><head><style>* { margin: 0; padding: 0; } html, body, #map { width: 100%; height: 100%; }</style></head>
<body><div id="map"></div>
<script>
  var map, overlays = [];
  function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
      mapTypeId: 'satellite', disableDefaultUI: true, isFractionalZoomEnabled: true,
      center: { lat: 59.33, lng: 18.06 }, zoom: 12, tilt: 0
    });
    window.__MAPS_LOADED = true;
  }
  window.__show = function (spec) {
    window.__READY = false;
    overlays.forEach(function (o) { o.setMap(null); });
    overlays = [];
    var bounds = new google.maps.LatLngBounds();
    spec.areas.forEach(function (a) {
      a.path.forEach(function (p) { bounds.extend(p); });
      overlays.push(new google.maps.Polygon({
        paths: a.path, map: map,
        strokeColor: a.color, strokeWeight: 3, strokeOpacity: 1,
        fillColor: a.color, fillOpacity: a.highlight ? 0.2 : 0.25
      }));
      if (a.label) {
        overlays.push(new google.maps.Marker({
          position: a.center, map: map,
          icon: { url: a.icon, scaledSize: new google.maps.Size(34, 34), anchor: new google.maps.Point(17, 17) }
        }));
      }
    });
    var done = false;
    function finish() { if (done) return; done = true; setTimeout(function () { window.__READY = true; }, 700); }
    google.maps.event.addListenerOnce(map, 'idle', function () {
      google.maps.event.addListenerOnce(map, 'tilesloaded', finish);
      setTimeout(finish, 2500);
    });
    if (spec.view) {
      map.setCenter({ lat: spec.view.lat, lng: spec.view.lng });
      map.setZoom(spec.view.zoom);
    } else if (!bounds.isEmpty()) {
      map.fitBounds(bounds, 40);
    }
    setTimeout(finish, 6000);
  };
</script>
<script src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap" async defer></script>
</body></html>`

  let page: Page | null = null
  try {
    page = await browser.newPage()
    await page.setViewport({ width: shots[0].width, height: shots[0].height, deviceScaleFactor: 2 })
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 })
    await page.waitForFunction('window.__MAPS_LOADED === true', { timeout: 15000 })

    for (const shot of shots) {
      try {
        await page.setViewport({ width: shot.width, height: shot.height, deviceScaleFactor: 2 })
        const spec = {
          view: shot.view,
          areas: shot.areas.map(a => ({
            path: a.path,
            center: centroid(a.path),
            label: a.label,
            icon: a.label ? numberMarkerSvg(a.label, a.color) : null,
            highlight: a.highlight,
            color: a.color,
          })),
        }
        await page.evaluate((s: unknown) => (window as unknown as { __show: (v: unknown) => void }).__show(s), spec)
        await page.waitForFunction('window.__READY === true', { timeout: 15000 })
        const png = await page.screenshot({ type: 'jpeg', quality: 82 })
        result.set(shot.key, `data:image/jpeg;base64,${Buffer.from(png).toString('base64')}`)
      } catch (err) {
        console.error('[special-report-pdf] Kartan kunde inte renderas:', shot.key, err)
      }
    }
  } catch (err) {
    console.error('[special-report-pdf] Kartsidan kunde inte laddas:', err)
  } finally {
    if (page) await page.close().catch(() => {})
  }
  return result
}

function buildMapShots(data: ReportData): MapShot[] {
  const shots: MapShot[] = []
  const numbered = data.sections.map((s, i) => ({ s, nr: i + 1 })).filter(x => validArea(x.s.area))

  if (data.report.map_view) {
    shots.push({
      key: 'overview',
      width: 1000,
      height: 440,
      view: data.report.map_view,
      areas: numbered.map(x => ({ path: x.s.area as LatLng[], label: String(x.nr), highlight: false, color: sectionColor(x.s, x.nr - 1) })),
    })
  }
  for (const x of numbered) {
    if (!x.s.blocks.some(b => b.type === 'map')) continue
    shots.push({
      key: `section:${x.s.id}`,
      width: 640,
      height: 400,
      view: null,
      areas: [{ path: x.s.area as LatLng[], label: String(x.nr), highlight: true, color: sectionColor(x.s, x.nr - 1) }],
    })
  }
  return shots
}

// ----------------------------------------------------------------------------
// HTML enligt dokumentstandarden (skissen Rapport-Sida1/Rapport-Sida2)
// ----------------------------------------------------------------------------

function buildHtml(data: ReportData, maps: Map<string, string>, version: number, dateText: string): string {
  const { report, sections } = data
  const allDates = sections.flatMap(s => s.events.map(e => e.event_date)).filter(Boolean).sort()
  const from = allDates[0] || null
  const to = allDates[allDates.length - 1] || null
  const period = from && to ? (from === to ? from : `${from} till ${to}`) : '-'
  const kicker = [report.customer_name, monthSpan(from, to)].filter(Boolean).join(' · ')

  const meta = (label: string, value: string | null | undefined, first: boolean, row2: boolean) => `
    <div class="meta-cell${first ? ' first' : ''}${row2 ? ' row2' : ''}">
      <span class="meta-label">${esc(label)}</span>
      <span class="meta-value">${esc(value && String(value).trim() ? value : '-')}</span>
    </div>`

  // Översiktens tabell
  const overviewRows = sections.map((s, i) => {
    const last = s.events.map(e => e.event_date).sort().pop() || '-'
    const label = s.label === 'omrade' ? 'Område på kartan' : SECTION_LABELS[s.label] || s.label
    return `<tr${i % 2 === 1 ? ' class="alt"' : ''}>
      <td class="nr" style="color:${sectionColor(s, i)}">${i + 1}</td><td>${esc(sectionTitle(s))}</td><td>${esc(label)}</td><td>${esc(last)}</td><td>2.${i + 1}</td>
    </tr>`
  }).join('')

  const overviewMap = maps.get('overview')

  const sectionHtml = sections.map((s, i) => renderSection(s, i + 1, maps, report)).join('')

  const hasAssessment = !!(report.assessment && report.assessment.trim())
  const actions = atgardsRader(report.recommendations)
  const hasRecommendations = actions.length > 0

  // Översiktens rutor: avvikelser att åtgärda och de tre första åtgärderna
  const deviations = avvikelserIRapporten(sections)
  const summaryBoxes = [
    deviations.length > 0
      ? deviationBox(`Avvikelser att åtgärda (${deviations.length})`, deviations.map(d => ({
        part: `2.${d.del} ${d.delTitel}`,
        date: d.event.event_date,
        text: d.event.title?.trim() || 'Avvikelse',
      })))
      : '',
    hasRecommendations
      ? `<div class="action-box"><span class="box-title">${iconSvg('atgarder', BRAND, 15)}Det här rekommenderar vi</span>${numberedList(actions.slice(0, 3))}<span class="see">${actions.length > 3 ? `Ytterligare ${actions.length - 3} i avsnitt 3. ` : ''}Se avsnitt 3.</span></div>`
      : '',
  ].filter(Boolean)
  const summaryHtml = summaryBoxes.length > 0 ? `<div class="summary">${summaryBoxes.join('')}</div>` : ''

  return `<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="utf-8">
<title>${esc(report.title)}</title>
<style>
  @page { size: A4; margin: 14mm 17mm 18mm 17mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    color: #1f2937; font-size: 11.5px; line-height: 1.5;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  p { margin: 0 0 8px; }
  ul { margin: 0 0 8px; padding-left: 18px; }
  li { margin-bottom: 3px; }
  .cover { page-break-after: always; }
  .cover-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .cover-top img { width: 150px; height: auto; }
  .doc-type { font-size: 10.5px; letter-spacing: 0.18em; color: #6b7280; text-transform: uppercase; margin-top: 8px; }
  .title-block { margin-top: 40px; }
  .kicker { display: block; font-size: 11.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: ${BRAND}; margin-bottom: 10px; }
  h1 { margin: 0; font-size: 34px; line-height: 1.15; font-weight: 700; color: #0f172a; }
  .rule { display: block; width: 56px; height: 3px; background: ${BRAND}; margin-top: 14px; }
  .meta { margin-top: 24px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; font-size: 11.5px; }
  .meta-cell { padding: 9px 12px; display: flex; flex-direction: column; gap: 2px; }
  .meta-cell.first { padding-left: 0; }
  .meta-cell.row2 { border-top: 1px solid #f1f5f9; }
  .meta-label { color: #6b7280; }
  .meta-value { font-weight: 600; color: #0f172a; word-break: break-word; }
  h2 { margin: 26px 0 12px; font-size: 17px; color: #0f172a; padding-bottom: 6px; border-bottom: 1px solid #e5e7eb; page-break-after: avoid; }
  h2 .num, h3 .num { color: ${BRAND}; }
  h3 { margin: 0 0 2px; font-size: 18px; color: #0f172a; page-break-after: avoid; display: flex; align-items: center; gap: 8px; }
  h3 .bar { display: inline-block; width: 5px; height: 22px; flex-shrink: 0; }
  .subtitle { margin: 0 0 12px; color: #6b7280; }
  .intro { margin-bottom: 12px; color: #374151; }
  .map { display: block; width: 100%; border-radius: 4px; margin: 4px 0 12px; }
  .map.section-map { width: 62%; }
  table { width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; font-size: 11px; margin-bottom: 12px; }
  thead { display: table-header-group; }
  th { text-align: left; background: #f0fdf9; font-weight: 600; color: #0f172a; padding: 7px 10px; }
  td { padding: 7px 10px; border-top: 1px solid #e5e7eb; vertical-align: top; }
  tr { page-break-inside: avoid; }
  tr.alt td { background: #fafafa; }
  td.nr { font-weight: 700; color: ${BRAND}; }
  td.date { white-space: nowrap; }
  td.imgref { color: ${BRAND}; white-space: nowrap; }
  .page { page-break-before: always; }
  .page-head { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid #e5e7eb; margin-bottom: 20px; }
  .page-head img { width: 84px; height: auto; }
  .page-head span { font-size: 9.5px; letter-spacing: 0.14em; color: #6b7280; text-transform: uppercase; }
  .block-title { display: block; margin: 16px 0 8px; font-size: 12.5px; font-weight: 700; color: #0f172a; page-break-after: avoid; }
  .text-block { margin-bottom: 8px; }
  .images { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
  .image { display: flex; flex-direction: column; gap: 4px; page-break-inside: avoid; }
  .image img { width: 100%; height: 130px; object-fit: cover; border-radius: 2px; background: #e5e7eb; }
  .image .missing { height: 130px; background: #e5e7eb; }
  .image span { font-size: 9.5px; color: #4b5563; }
  .image span.belongs { font-size: 8.5px; color: #6b7280; }
  .callout { padding: 10px 14px; background: #f0fdf9; border-left: 4px solid ${BRAND}; margin-bottom: 14px; page-break-inside: avoid; }
  .callout strong { display: block; color: #0f172a; margin-bottom: 4px; }
  .muted { color: #6b7280; }
  .ico { display: inline-block; flex-shrink: 0; vertical-align: -2px; }
  /* Avvikelser: röd bara som accent, ljust röd yta */
  tr.deviation td { background: ${AVVIKELSE_TON}; }
  tr.deviation td:first-child { box-shadow: inset 3px 0 0 ${AVVIKELSE_FARG}; }
  td.dev-type { color: ${AVVIKELSE_FARG}; font-weight: 700; white-space: nowrap; }
  td.dev-type .ico { margin-right: 4px; }
  .box-title { display: flex; align-items: center; gap: 6px; font-weight: 700; margin-bottom: 6px; }
  .deviation-box { background: ${AVVIKELSE_TON}; border: 1px solid #fecaca; border-left: 3px solid ${AVVIKELSE_FARG}; border-radius: 4px; padding: 10px 14px; margin: 0 0 14px; page-break-inside: avoid; }
  .deviation-box .box-title { color: ${AVVIKELSE_FARG}; }
  .deviation-box ul { list-style: none; margin: 0; padding: 0; }
  .deviation-box li { margin: 0; padding: 3px 0; border-top: 1px solid #fde2e2; }
  .deviation-box li:first-child { border-top: none; padding-top: 0; }
  .deviation-box .part { display: block; font-size: 9.5px; color: #6b7280; }
  .deviation-box .date { color: #6b7280; white-space: nowrap; }
  .deviation-box b { color: #0f172a; font-weight: 600; }
  .action-box, .action-panel { background: #f0fdf9; border: 1px solid #a7f3d0; border-radius: 4px; page-break-inside: avoid; }
  .action-box { padding: 10px 14px; margin: 0 0 14px; }
  .action-box .box-title, .action-panel .box-title { color: #0f172a; }
  .action-box .see { display: block; margin-top: 4px; font-size: 10px; color: #6b7280; }
  .action-panel { padding: 14px 18px; margin-bottom: 14px; }
  .action-panel .box-title { font-size: 13px; margin-bottom: 10px; }
  ol.numbered { list-style: none; margin: 0; padding: 0; }
  ol.numbered li { display: flex; align-items: flex-start; gap: 9px; margin: 0; padding: 3px 0; page-break-inside: avoid; }
  ol.numbered .n { flex-shrink: 0; width: 19px; height: 19px; border-radius: 50%; background: ${BRAND}; color: #ffffff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-top: 0; }
  ol.numbered .t { min-width: 0; padding-top: 1px; }
  .action-panel ol.numbered li { padding: 5px 0; }
  .summary { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 4px; }
  .summary > div { flex: 1 1 240px; min-width: 0; margin: 0; }
</style>
</head>
<body>

<section class="cover">
  <div class="cover-top">
    <img src="${BEGONE_LOGO_DATA_URI}" alt="BeGone">
    <span class="doc-type">${esc(report.doc_type)}</span>
  </div>
  <div class="title-block">
    ${kicker ? `<span class="kicker">${esc(kicker)}</span>` : ''}
    <h1>${esc(report.title)}</h1>
    <span class="rule"></span>
  </div>
  <div class="meta">
    ${meta('Kund', report.customer_name, true, false)}
    ${meta('Kundnummer', report.customer_number, false, false)}
    ${meta('Ärende', report.case_number, false, false)}
    ${meta('Version', `${version} · ${dateText}`, false, false)}
    ${meta('Period', period, true, true)}
    ${meta('Kontakt', report.contact_name, false, true)}
    ${meta('Framtagen av', data.authors, false, true)}
    ${meta('Telefon', report.contact_phone, false, true)}
  </div>

  <h2><span class="num">1.</span> Översikt</h2>
  ${report.intro && report.intro.trim() ? `<div class="intro">${paragraphs(report.intro)}</div>` : ''}
  ${report.address ? `<p class="muted">${esc(report.address)}</p>` : ''}
  ${overviewMap ? `<img class="map" src="${overviewMap}" alt="Översiktskarta">` : ''}
  ${sections.length > 0 ? `
  <table>
    <thead><tr><th style="width:40px">Nr</th><th>Del</th><th>Gäller</th><th>Senast</th><th style="width:64px">Avsnitt</th></tr></thead>
    <tbody>${overviewRows}</tbody>
  </table>` : ''}
  ${summaryHtml}
</section>

${sectionHtml}

${hasAssessment || hasRecommendations ? `
<section class="page">
  ${pageHead(report)}
  <h3><span class="num">3.</span> Bedömning och åtgärder</h3>
  <div style="height:12px"></div>
  ${hasAssessment ? `<div class="callout"><strong>Vår bedömning</strong>${paragraphs(report.assessment, 'margin:0 0 6px')}</div>` : ''}
  ${hasRecommendations ? `<div class="action-panel"><span class="box-title">${iconSvg('atgarder', BRAND, 18)}Rekommenderade åtgärder</span>${numberedList(actions)}</div>` : ''}
</section>` : ''}

</body>
</html>`
}

function pageHead(report: SpecialReport): string {
  const right = [report.doc_type, report.case_number].filter(Boolean).join(' · ')
  return `<div class="page-head"><img src="${BEGONE_LOGO_DATA_URI}" alt="BeGone"><span>${esc(right)}</span></div>`
}

/** Delens rubrik i PDF:en. Utan rubrik: typen av del, så att kunden ser något begripligt */
function sectionTitle(s: SpecialReportSection): string {
  return s.title?.trim() || SECTION_LABELS[s.label] || 'Del'
}

function renderSection(s: SectionFull, nr: number, maps: Map<string, string>, report: SpecialReport): string {
  const color = sectionColor(s, nr - 1)
  // Bilder numreras inom delen i ordning
  const imageNumber = new Map(s.images.map((img, i) => [img.id, i + 1]))
  const eventsById = new Map(s.events.map(e => [e.id, e]))

  const subtitleParts = [s.subtitle?.trim() || null, validArea(s.area) ? `område ${nr} på översiktskartan` : null].filter(Boolean)

  const eventsHtml = () => {
    if (s.events.length === 0) return ''
    const rows = s.events.map((e, i) => {
      const refs = s.images.filter(img => img.event_id === e.id).map(img => imageNumber.get(img.id)).join(', ')
      const typeLabel = EVENT_TYPES[e.type]?.label || e.type
      const description = e.description && e.description.trim()
        ? ` ${esc(e.description.trim()).replace(/\n/g, '<br>')}`
        : ''
      const deviation = e.type === 'avvikelse'
      const classes = [i % 2 === 1 ? 'alt' : '', deviation ? 'deviation' : ''].filter(Boolean).join(' ')
      return `<tr${classes ? ` class="${classes}"` : ''}>
        <td class="date">${esc(e.event_date)}</td>
        ${deviation
          ? `<td class="dev-type">${iconSvg('avvikelse', AVVIKELSE_FARG, 13)}${esc(typeLabel)}</td>`
          : `<td>${esc(typeLabel)}</td>`}
        <td><b>${esc(e.title)}</b>${description}</td>
        <td class="imgref">${esc(refs)}</td>
      </tr>`
    }).join('')
    return `<span class="block-title">Händelser</span>
      <table>
        <thead><tr><th style="width:82px">Datum</th><th style="width:110px">Typ</th><th>Vad vi gjorde och såg</th><th style="width:54px">Bild</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`
  }

  const imagesHtml = () => {
    if (s.images.length === 0) return ''
    const items = s.images.map(img => {
      const event = img.event_id ? eventsById.get(img.event_id) : undefined
      const caption = img.caption?.trim() || ''
      // Kopplad bild: vilken händelse den hör till, med datum
      const belongs = event ? `<br><span class="belongs">Hör till: ${esc(event.title?.trim() || 'Utan rubrik')}, ${esc(event.event_date)}</span>` : ''
      return `<div class="image">
        ${img.dataUri ? `<img src="${img.dataUri}" alt="">` : '<div class="missing"></div>'}
        <span><b>Bild ${imageNumber.get(img.id)}.</b>${caption ? ` ${esc(caption)}` : ''}${belongs}</span>
      </div>`
    }).join('')
    return `<span class="block-title">Bilder</span><div class="images">${items}</div>`
  }

  let rendered = ''
  let eventsShown = false
  let imagesShown = false
  for (const block of s.blocks) {
    if (block.type === 'text') {
      const text = block.content?.text
      if (text && text.trim()) rendered += `<div class="text-block">${richText(text)}</div>`
    } else if (block.type === 'map') {
      const shot = maps.get(`section:${s.id}`)
      if (shot) rendered += `<img class="map section-map" src="${shot}" alt="Kartutsnitt">`
    } else if (block.type === 'events' && !eventsShown) {
      rendered += eventsHtml()
      eventsShown = true
    } else if (block.type === 'images' && !imagesShown) {
      rendered += imagesHtml()
      imagesShown = true
    }
  }
  // Innehåll som saknar block visas ändå sist, så att inget tappas bort
  if (!eventsShown) rendered += eventsHtml()
  if (!imagesShown) rendered += imagesHtml()

  // Delens avvikelser överst, i datumordning som tabellen
  const deviations = s.events.filter(e => e.type === 'avvikelse')
  const deviationsHtml = deviations.length > 0
    ? deviationBox(`Avvikelser i den här delen (${deviations.length})`, deviations.map(e => ({
      date: e.event_date,
      text: e.title?.trim() || 'Avvikelse',
    })))
    : ''

  return `<section class="page">
    ${pageHead(report)}
    <h3><span class="bar" style="background:${color}"></span><span><span class="num" style="color:${color}">2.${nr}</span> ${esc(sectionTitle(s))}</span></h3>
    ${subtitleParts.length > 0 ? `<p class="subtitle">${esc(subtitleParts.join(' · '))}</p>` : '<div style="height:12px"></div>'}
    ${deviationsHtml}
    ${rendered || '<p class="muted">Inget innehåll i delen än.</p>'}
  </section>`
}

function footerTemplate(report: SpecialReport, version: number, dateText: string): string {
  const middle = `${esc(report.title)} · version ${version} · ${esc(dateText)}`
  return `<div style="width:100%;box-sizing:border-box;padding:0 17mm;font-family:'Segoe UI',Arial,sans-serif;font-size:8px;color:#6b7280;-webkit-print-color-adjust:exact;">
    <div style="display:flex;justify-content:space-between;gap:12px;padding-top:6px;border-top:1px solid #e5e7eb;">
      <span>Begone Skadedjur</span>
      <span>${middle}</span>
      <span style="white-space:nowrap;">Sida <span class="pageNumber"></span> av <span class="totalPages"></span></span>
    </div>
  </div>`
}

// ----------------------------------------------------------------------------
// Rendering
// ----------------------------------------------------------------------------

async function renderPdf(data: ReportData, version: number, dateText: string): Promise<{ pdf: Buffer; pageCount: number | null }> {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: (chromium as unknown as { defaultViewport: null }).defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: (chromium as unknown as { headless: boolean | 'shell' }).headless,
  })
  try {
    // Kartorna i samma browser-session som PDF:en
    const maps = await renderMapShots(browser, buildMapShots(data))
    const html = buildHtml(data, maps, version, dateText)
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 })
    const pdf = Buffer.from(await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: footerTemplate(data.report, version, dateText),
      margin: { top: '14mm', right: '17mm', bottom: '18mm', left: '17mm' },
    }))
    return { pdf, pageCount: countPdfPages(pdf) }
  } finally {
    await browser.close().catch(() => {})
  }
}

async function uploadPdf(path: string, pdf: Buffer): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, pdf, {
    contentType: 'application/pdf',
    cacheControl: '60',
    upsert: true,
  })
  if (error) throw new Error(`PDF:en kunde inte sparas: ${error.message}`)
}

async function signedUrl(path: string, seconds: number, download?: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, seconds, download ? { download } : undefined)
  if (error || !data?.signedUrl) throw new Error(`Länken till PDF:en kunde inte skapas: ${error?.message || 'okänt fel'}`)
  return data.signedUrl
}

// ----------------------------------------------------------------------------
// Mejl
// ----------------------------------------------------------------------------

function emailHtml(p: {
  message: string
  report: SpecialReport
  version: number
  pageCount: number | null
  linkUrl: string | null
}): string {
  const row = (label: string, value: string | null | undefined) => value ? `<tr>
      <td style="padding:6px 0;width:130px;color:#64748b;font-size:13px;vertical-align:top;">${esc(label)}</td>
      <td style="padding:6px 0;color:#1e293b;font-size:13px;">${esc(value)}</td>
    </tr>` : ''
  const messageHtml = p.message.trim()
    ? p.message.trim().split(/\n\s*\n/).map(par =>
      `<p style="margin:0 0 14px 0;color:#1e293b;font-size:14px;line-height:1.6;">${esc(par.trim()).replace(/\n/g, '<br>')}</p>`).join('')
    : `<p style="margin:0 0 14px 0;color:#1e293b;font-size:14px;line-height:1.6;">Hej,<br><br>Här kommer rapporten från Begone Skadedjur.</p>`
  const attachmentText = p.linkUrl
    ? `Rapporten är för stor för att bifogas. <a href="${esc(p.linkUrl)}" style="color:#20c58f;font-weight:600;">Ladda ned rapporten här</a> (länken gäller i 30 dagar).`
    : 'Rapporten finns bifogad som PDF.'
  return `<!DOCTYPE html>
<html lang="sv">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${esc(p.report.title)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:#0f172a;border-radius:12px 12px 0 0;padding:32px 40px;">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;text-align:left;">
              <table cellpadding="0" cellspacing="0"><tr>
                <td style="background:#20c58f;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                  <span style="color:white;font-size:18px;font-weight:800;line-height:36px;">B</span>
                </td>
                <td style="padding-left:12px;color:white;font-size:20px;font-weight:700;">BeGone</td>
              </tr></table>
            </td>
            <td style="text-align:right;color:#94a3b8;font-size:12px;vertical-align:middle;">
              ${esc(p.report.doc_type.toUpperCase())}${p.report.case_number ? `<br><span style="color:#20c58f;font-weight:600;">${esc(p.report.case_number)}</span>` : ''}
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="background:white;padding:40px;">
          ${messageHtml}
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin:12px 0 24px 0;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 16px 0;font-size:13px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:0.5px;">${esc(p.report.title)}</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${row('Kund', p.report.customer_name)}
                ${row('Ärende nr', p.report.case_number)}
                ${row('Version', `${p.version}${p.pageCount ? ` (${p.pageCount} sidor)` : ''}`)}
              </table>
              <p style="margin:14px 0 0 0;color:#64748b;font-size:13px;line-height:1.6;">${attachmentText}</p>
            </td></tr>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-left:3px solid #20c58f;border-radius:0 6px 6px 0;">
            <tr><td style="padding:14px 18px;">
              <p style="margin:0 0 2px 0;font-size:13px;font-weight:600;color:#1e293b;">Har du frågor?</p>
              <p style="margin:0;font-size:13px;color:#64748b;">Svara på det här mejlet eller skriv till <a href="mailto:info@begone.se" style="color:#20c58f;text-decoration:none;">info@begone.se</a>.</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;">
          <p style="margin:0 0 4px 0;font-size:13px;font-weight:600;color:#374151;">BeGone Skadedjur & Sanering AB</p>
          <p style="margin:0 0 4px 0;font-size:12px;color:#9ca3af;">E-post: info@begone.se | www.begone.se</p>
          <p style="margin:0;font-size:12px;color:#9ca3af;">Org.nr: 559378-9208</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ----------------------------------------------------------------------------
// Handler
// ----------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metoden stöds inte' })
  }

  const auth = await requireAuthenticated(req, res)
  if (!auth) return

  const body = (req.body || {}) as {
    reportId?: string
    action?: string
    recipients?: unknown
    subject?: string
    message?: string
    saveToCase?: boolean
  }
  const reportId = String(body.reportId || '')
  const action = body.action
  if (!/^[0-9a-f-]{36}$/i.test(reportId)) return res.status(400).json({ error: 'Ogiltig rapport' })
  if (action !== 'download' && action !== 'send') return res.status(400).json({ error: 'Okänd åtgärd' })

  let recipients: string[] = []
  if (action === 'send') {
    recipients = (Array.isArray(body.recipients) ? body.recipients : [])
      .map(r => String(r || '').trim())
      .filter(Boolean)
    recipients = [...new Set(recipients.map(r => r.toLowerCase()))]
    if (recipients.length === 0) return res.status(400).json({ error: 'Lägg till minst en mottagare' })
    if (recipients.length > 20) return res.status(400).json({ error: 'Högst 20 mottagare per utskick' })
    const invalid = recipients.find(r => !isEmail(r))
    if (invalid) return res.status(400).json({ error: `Ogiltig e-postadress: ${invalid}` })
    if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: 'E-posttjänsten är inte konfigurerad' })
  }

  try {
    const { data: reportRow, error: reportError } = await supabase
      .from('special_reports')
      .select('*')
      .eq('id', reportId)
      .maybeSingle()
    if (reportError) throw new Error(`Rapporten kunde inte hämtas: ${reportError.message}`)
    if (!reportRow) return res.status(404).json({ error: 'Rapporten finns inte' })
    const report = reportRow as SpecialReport

    if (!(await canAccessReport(auth.userId, report))) {
      return res.status(403).json({ error: 'Du har inte behörighet till rapporten' })
    }

    const version = report.current_version
    const dateText = todaySwedish()
    const filename = `${safeFilename(report.title)}, version ${version}.pdf`

    const data = await loadReportData(report)
    const { pdf, pageCount } = await renderPdf(data, version, dateText)

    if (action === 'download') {
      const path = `${report.id}/versioner/utkast.pdf`
      await uploadPdf(path, pdf)
      const url = await signedUrl(path, SIGNED_URL_SECONDS, filename)
      return res.status(200).json({ url, filename, pageCount })
    }

    // ---------------- send ----------------
    const pdfPath = `${report.id}/versioner/v${version}.pdf`
    await uploadPdf(pdfPath, pdf)

    const subject = (body.subject || '').trim() ||
      `${report.doc_type}: ${report.title}${report.case_number ? ` (${report.case_number})` : ''}`
    const message = String(body.message || '')

    const tooLarge = pdf.length > MAX_EMAIL_ATTACHMENT_BYTES
    const linkUrl = tooLarge ? await signedUrl(pdfPath, EMAIL_LINK_SECONDS, filename) : null

    const transporter = nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: { user: 'resend', pass: process.env.RESEND_API_KEY },
    })
    await transporter.sendMail({
      from: 'BeGone Rapporter <noreply@begone.se>',
      replyTo: 'info@begone.se',
      to: recipients,
      subject,
      html: emailHtml({ message, report, version, pageCount, linkUrl }),
      attachments: tooLarge ? [] : [{ filename, content: pdf, contentType: 'application/pdf' }],
    })

    const sentAt = new Date().toISOString()
    const { data: versionRow, error: versionError } = await supabase
      .from('special_report_versions')
      .insert({
        report_id: report.id,
        version,
        pdf_path: pdfPath,
        page_count: pageCount,
        sent_at: sentAt,
        sent_to: recipients,
        sent_by: auth.userId,
        subject,
        message: message || null,
      })
      .select('*')
      .single()
    if (versionError || !versionRow) {
      // Mejlet har gått iväg; logga så att versionen kan läggas in för hand
      console.error('[special-report-pdf] Versionsraden kunde inte sparas efter utskick:', report.id, version, versionError)
      throw new Error(`Rapporten skickades men versionen kunde inte låsas: ${versionError?.message || 'okänt fel'}`)
    }

    // Räkna upp bara om ingen annan hunnit före
    const { error: bumpError } = await supabase
      .from('special_reports')
      .update({ current_version: version + 1, updated_by: auth.userId })
      .eq('id', report.id)
      .eq('current_version', version)
    if (bumpError) console.error('[special-report-pdf] current_version kunde inte räknas upp:', report.id, bumpError)

    // Rapporten sparas inte i sanitation_reports: dess trigger skulle markera ärendets
    // riktiga saneringsrapport som ersatt. Specialrapporten och dess versioner hör redan till ärendet.

    console.log('[special-report-pdf] Skickad', report.id, 'version', version, 'till', recipients.join(', '), 'av', auth.userId)
    return res.status(200).json({ version: versionRow as SpecialReportVersion })
  } catch (error) {
    console.error('[special-report-pdf] Fel:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'PDF:en kunde inte skapas',
    })
  }
}
