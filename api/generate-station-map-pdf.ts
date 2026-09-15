// api/generate-station-map-pdf.ts
// Stationskarta (kund/enhet) och Stationsöversikt (regionskund) som PDF.
// Kunden laddar ned från Fällor & stationer; samma dokument som det interna
// gen-stationskarta-kvarnen.mjs men byggt ur databasen på servern.
//
// Body: { customerId }      → Stationskarta: planritningar + satellitkarta + stationslista
//       { organizationId }  → Stationsöversikt: antal stationer per region (aldrig enskilda)

import type { VercelRequest, VercelResponse } from '@vercel/node'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import { createClient } from '@supabase/supabase-js'
import { requireAuthenticated } from './_lib/auth'
import { canonicalTypeCode } from '../src/utils/stationTaxonomy'
import {
  buildStationMapHtml,
  buildStationOverviewHtml,
  formatDateSv,
  type IndoorSection,
  type MapCustomerInfo,
  type MapStationType,
  type OutdoorSection,
  type OverviewRegion,
} from './_lib/stationMapHtml'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const STAFF_ROLES = new Set(['admin', 'koordinator', 'technician'])
const FALLBACK_COLOR = '#64748b'

// Standardpalett för regioner utan egen färg
const REGION_COLORS = ['#20c58f', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6']

// ------------------------------------------------------------------
// Behörighet: personal ser allt, kund ser sin egen kund eller enheter
// i sin multisite-organisation, regionskund sin organisation
// ------------------------------------------------------------------

interface AccessProfile {
  role: string | null
  is_admin: boolean | null
  extra_roles: string[] | null
  customer_id: string | null
}

async function loadProfile(userId: string): Promise<AccessProfile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('role, is_admin, extra_roles, customer_id')
    .eq('user_id', userId)
    .maybeSingle()
  return (data as AccessProfile | null) ?? null
}

function isStaff(p: AccessProfile | null): boolean {
  if (!p) return false
  if (p.is_admin) return true
  if (p.role && STAFF_ROLES.has(p.role)) return true
  return (p.extra_roles || []).some(r => STAFF_ROLES.has(r))
}

async function hasOrganizationAccess(userId: string, organizationId: string, siteId?: string): Promise<boolean> {
  const { data } = await supabase
    .from('multisite_user_roles')
    .select('role_type, site_ids')
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
  for (const row of data || []) {
    if (row.role_type === 'verksamhetschef') return true
    if (!siteId) return true
    if ((row.site_ids as string[] | null)?.includes(siteId)) return true
  }
  return false
}

async function canAccessCustomer(userId: string, customer: { id: string; organization_id: string | null }): Promise<boolean> {
  const profile = await loadProfile(userId)
  if (isStaff(profile)) return true
  if (profile?.customer_id === customer.id) return true
  if (customer.organization_id) return hasOrganizationAccess(userId, customer.organization_id, customer.id)
  return false
}

async function canAccessOrganization(userId: string, organizationId: string): Promise<boolean> {
  const profile = await loadProfile(userId)
  if (isStaff(profile)) return true
  return hasOrganizationAccess(userId, organizationId)
}

// ------------------------------------------------------------------
// Stationstyper med fallback för fritext (samma regel som equipmentService)
// ------------------------------------------------------------------

interface StationTypeRow {
  id: string
  code: string
  name: string
  prefix: string | null
  color: string | null
  description: string | null
  sort_order: number | null
}

async function loadStationTypes(): Promise<StationTypeRow[]> {
  const { data } = await supabase
    .from('station_types')
    .select('id, code, name, prefix, color, description, sort_order')
    .order('sort_order', { ascending: true })
  return (data as StationTypeRow[]) || []
}

function resolveType(
  types: StationTypeRow[],
  stationTypeId: string | null,
  legacyText: string | null
): { name: string; color: string; prefix: string | null } {
  const byId = stationTypeId ? types.find(t => t.id === stationTypeId) : undefined
  const byCode = !byId && legacyText
    ? types.find(t => canonicalTypeCode(t.code) === canonicalTypeCode(legacyText))
    : undefined
  const t = byId || byCode
  if (t) return { name: t.name, color: t.color || FALLBACK_COLOR, prefix: t.prefix }
  return { name: legacyText || 'Okänd typ', color: FALLBACK_COLOR, prefix: null }
}

function toMapTypes(types: StationTypeRow[], usedNames: Set<string>): MapStationType[] {
  const out: MapStationType[] = types
    .filter(t => usedNames.has(t.name))
    .map(t => ({ name: t.name, color: t.color || FALLBACK_COLOR, prefix: t.prefix, description: t.description }))
  // Typer som bara finns som fritext (ingen station_types-rad)
  for (const name of usedNames) {
    if (!out.some(t => t.name === name)) out.push({ name, color: FALLBACK_COLOR, prefix: null, description: null })
  }
  return out
}

// ------------------------------------------------------------------
// Kundinfo (enheter ärver org.nr och avtal från huvudkontoret)
// ------------------------------------------------------------------

interface CustomerRow {
  id: string
  company_name: string
  site_name: string | null
  site_type: string | null
  organization_id: string | null
  parent_customer_id: string | null
  organization_number: string | null
  contact_address: string | null
  contact_person: string | null
  contract_type: string | null
  contract_start_date: string | null
  contract_end_date: string | null
  assigned_account_manager: string | null
  is_regional: boolean | null
}

const CUSTOMER_COLUMNS = 'id, company_name, site_name, site_type, organization_id, parent_customer_id, organization_number, contact_address, contact_person, contract_type, contract_start_date, contract_end_date, assigned_account_manager, is_regional'

async function loadCustomer(id: string): Promise<CustomerRow | null> {
  const { data } = await supabase.from('customers').select(CUSTOMER_COLUMNS).eq('id', id).maybeSingle()
  return (data as CustomerRow | null) ?? null
}

async function toCustomerInfo(c: CustomerRow): Promise<MapCustomerInfo> {
  let parent: CustomerRow | null = null
  if (c.parent_customer_id) parent = await loadCustomer(c.parent_customer_id)
  return {
    company_name: c.company_name,
    site_name: c.site_type === 'enhet' ? c.site_name : null,
    organization_number: c.organization_number || parent?.organization_number || null,
    contact_address: c.contact_address,
    contact_person: c.contact_person,
    contract_type: c.contract_type || parent?.contract_type || null,
    contract_start_date: c.contract_start_date || parent?.contract_start_date || null,
    contract_end_date: c.contract_end_date || parent?.contract_end_date || null,
    account_manager: c.assigned_account_manager || parent?.assigned_account_manager || null,
    parent_company_name: parent?.company_name || null,
  }
}

// ------------------------------------------------------------------
// Bilder och kartor
// ------------------------------------------------------------------

async function fetchFloorPlanBase64(imagePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from('floor-plans').createSignedUrl(imagePath, 3600)
    if (error || !data?.signedUrl) return null
    const response = await fetch(data.signedUrl)
    if (!response.ok) return null
    const buffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/png'
    return `data:${contentType};base64,${Buffer.from(buffer).toString('base64')}`
  } catch {
    return null
  }
}

interface MapMarker { lat: number; lng: number; label: string; color: string }
interface MapPolygon { path: Array<{ lat: number; lng: number }>; color: string; label: string }

// Satellitkarta med numrerade markörer och/eller regionpolygoner med antal.
// Samma metod som kontrollrapporten: Google Maps JS API i en Puppeteer-sida
// (Static Maps saknar satellitvy i EU).
async function renderSatelliteMap(browser: Browser, markers: MapMarker[], polygons: MapPolygon[]): Promise<string | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return null
  if (markers.length === 0 && polygons.length === 0) return null

  const html = `<!DOCTYPE html>
<html><head><style>* { margin:0; padding:0; } #map { width:1000px; height:560px; }
.cnt { background:#0f172a; color:#fff; font:700 12px 'Segoe UI',Arial,sans-serif; padding:3px 8px; border-radius:10px; border:2px solid #fff; white-space:nowrap; }
</style></head><body><div id="map"></div>
<script>
  function initMap() {
    var markers = ${JSON.stringify(markers)};
    var polygons = ${JSON.stringify(polygons)};
    var bounds = new google.maps.LatLngBounds();
    var map = new google.maps.Map(document.getElementById('map'), {
      mapTypeId: 'satellite', disableDefaultUI: true, isFractionalZoomEnabled: true
    });
    polygons.forEach(function(p) {
      new google.maps.Polygon({ paths: p.path, map: map, strokeColor: p.color, strokeOpacity: 0.95, strokeWeight: 2, fillColor: p.color, fillOpacity: 0.28 });
      var pb = new google.maps.LatLngBounds();
      p.path.forEach(function(pt) { pb.extend(pt); bounds.extend(pt); });
      var c = pb.getCenter();
      var el = document.createElement('div'); el.className = 'cnt'; el.textContent = p.label; el.style.borderColor = p.color;
      new google.maps.marker.AdvancedMarkerElement({ position: c, map: map, content: el });
    });
    markers.forEach(function(m) {
      var pos = { lat: m.lat, lng: m.lng };
      bounds.extend(pos);
      new google.maps.Marker({
        position: pos, map: map,
        label: { text: m.label, color: 'white', fontWeight: 'bold', fontSize: '10px' },
        icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: m.color, fillOpacity: 1, strokeColor: 'white', strokeWeight: 1.5, scale: 11 }
      });
    });
    map.fitBounds(bounds, 40);
    google.maps.event.addListenerOnce(map, 'tilesloaded', function() {
      setTimeout(function() { window.__MAP_READY = true; }, 600);
    });
  }
</script>
<script src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker&callback=initMap" async defer></script>
</body></html>`

  let page: Page | null = null
  try {
    page = await browser.newPage()
    await page.setViewport({ width: 1000, height: 560, deviceScaleFactor: 2 })
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 })
    await page.waitForFunction('window.__MAP_READY === true', { timeout: 15000 })
    const shot = await page.screenshot({ type: 'png' })
    await page.close()
    return `data:image/png;base64,${Buffer.from(shot).toString('base64')}`
  } catch (err) {
    console.error('[station-map] satellitkarta misslyckades:', err)
    if (page) await page.close().catch(() => {})
    return null
  }
}

function geoJsonToPath(geojson: { type?: string; coordinates?: unknown } | null): Array<{ lat: number; lng: number }> | null {
  if (!geojson?.coordinates || !Array.isArray(geojson.coordinates)) return null
  const coords = geojson.coordinates as unknown[]
  const toPath = (ring: unknown): Array<{ lat: number; lng: number }> | null =>
    Array.isArray(ring) ? ring.map((pt) => ({ lat: Number((pt as number[])[1]), lng: Number((pt as number[])[0]) })) : null
  if (geojson.type === 'Polygon') return toPath(coords[0])
  if (geojson.type === 'MultiPolygon' && Array.isArray(coords[0])) return toPath((coords[0] as unknown[])[0])
  return null
}

function safeFilename(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()
}

// ------------------------------------------------------------------
// Stationskarta
// ------------------------------------------------------------------

export async function buildStationMap(browser: Browser, customer: CustomerRow, documentDate: string) {
  const types = await loadStationTypes()
  const info = await toCustomerInfo(customer)

  const [{ data: plans }, { data: outdoor }] = await Promise.all([
    supabase
      .from('floor_plans')
      .select('id, name, building_name, image_path, sort_order')
      .eq('customer_id', customer.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('equipment_placements')
      .select('id, serial_number, equipment_type, station_type_id, latitude, longitude, comment, status, placed_at')
      .eq('customer_id', customer.id)
      .eq('status', 'active')
      .order('placed_at', { ascending: true }),
  ])

  const usedNames = new Set<string>()
  const sections: Array<IndoorSection | OutdoorSection> = []
  let idx = 0

  // Utomhus först (så numreringen följer portalens ordning: karta, sedan planritningar)
  const outdoorRows = (outdoor || []).filter(r => r.latitude != null && r.longitude != null)
  if (outdoorRows.length > 0) {
    const stations = outdoorRows.map(r => {
      const t = resolveType(types, r.station_type_id, r.equipment_type)
      usedNames.add(t.name)
      return {
        idx: ++idx,
        code: r.serial_number || null,
        type: t.name,
        color: t.color,
        location: r.comment || null,
        status: r.status,
        placed_at: r.placed_at,
        lat: Number(r.latitude),
        lng: Number(r.longitude),
      }
    })
    const mapDataUri = await renderSatelliteMap(
      browser,
      stations.map(s => ({ lat: s.lat, lng: s.lng, label: String(s.idx), color: s.color })),
      []
    )
    sections.push({ kind: 'outdoor', title: 'Utomhus', mapDataUri, stations })
  }

  for (const plan of plans || []) {
    const { data: rows } = await supabase
      .from('indoor_stations')
      .select('id, station_number, station_type, station_type_id, position_x_percent, position_y_percent, location_description, status, placed_at')
      .eq('floor_plan_id', plan.id)
      .neq('status', 'removed')
      .order('station_number', { ascending: true })
    const stations = (rows || []).map(r => {
      const t = resolveType(types, r.station_type_id, r.station_type)
      usedNames.add(t.name)
      return {
        idx: ++idx,
        code: r.station_number || null,
        type: t.name,
        color: t.color,
        location: r.location_description || null,
        status: r.status,
        placed_at: r.placed_at,
        x: Number(r.position_x_percent),
        y: Number(r.position_y_percent),
      }
    })
    if (stations.length === 0) continue
    const imageDataUri = plan.image_path ? await fetchFloorPlanBase64(plan.image_path) : null
    sections.push({
      kind: 'indoor',
      title: plan.name || plan.building_name || 'Planritning',
      subtitle: plan.building_name,
      imageDataUri,
      stations,
    })
  }

  return buildStationMapHtml({
    customer: info,
    documentDate,
    types: toMapTypes(types, usedNames),
    sections,
  })
}

// ------------------------------------------------------------------
// Stationsöversikt (regionskund)
// ------------------------------------------------------------------

export async function buildStationOverview(browser: Browser, organizationId: string, documentDate: string) {
  const { data: hq } = await supabase
    .from('customers')
    .select(CUSTOMER_COLUMNS)
    .eq('organization_id', organizationId)
    .eq('site_type', 'huvudkontor')
    .maybeSingle()
  if (!hq) return null
  const org = await toCustomerInfo(hq as CustomerRow)

  const { data: sites } = await supabase
    .from('customers')
    .select('id, site_name, company_name, region')
    .eq('organization_id', organizationId)
    .eq('site_type', 'enhet')
    .eq('is_active', true)
    .order('region', { ascending: true })
    .order('site_name', { ascending: true })
  const siteRows = sites || []
  const siteIds = siteRows.map(s => s.id)

  const types = await loadStationTypes()
  const [{ data: placements }, { data: regionRows }] = await Promise.all([
    supabase
      .from('equipment_placements')
      .select('customer_id, station_type_id, equipment_type')
      .in('customer_id', siteIds.length ? siteIds : ['00000000-0000-0000-0000-000000000000'])
      .eq('status', 'active'),
    supabase
      .from('customer_regions')
      .select('customer_id, geojson_polygon, color')
      .in('customer_id', siteIds.length ? siteIds : ['00000000-0000-0000-0000-000000000000']),
  ])

  const usedNames = new Set<string>()
  const countsBySite = new Map<string, Record<string, number>>()
  for (const p of placements || []) {
    const t = resolveType(types, p.station_type_id, p.equipment_type)
    usedNames.add(t.name)
    const c = countsBySite.get(p.customer_id) || {}
    c[t.name] = (c[t.name] || 0) + 1
    countsBySite.set(p.customer_id, c)
  }

  const regionBySite = new Map<string, { path: Array<{ lat: number; lng: number }> | null; color: string | null }>()
  for (const r of regionRows || []) {
    regionBySite.set(r.customer_id, { path: geoJsonToPath(r.geojson_polygon), color: r.color })
  }

  const regions: OverviewRegion[] = siteRows.map((s, i) => {
    const counts = countsBySite.get(s.id) || {}
    return {
      name: s.site_name || s.company_name,
      region: s.region,
      color: regionBySite.get(s.id)?.color || REGION_COLORS[i % REGION_COLORS.length],
      counts,
      total: Object.values(counts).reduce((n, v) => n + v, 0),
    }
  })

  const polygons: MapPolygon[] = siteRows
    .map((s, i) => {
      const geo = regionBySite.get(s.id)
      if (!geo?.path) return null
      return { path: geo.path, color: regions[i].color, label: `${regions[i].name}: ${regions[i].total}` }
    })
    .filter((p): p is MapPolygon => p !== null)

  const mapDataUri = await renderSatelliteMap(browser, [], polygons)

  return buildStationOverviewHtml({
    organization: org,
    documentDate,
    types: toMapTypes(types, usedNames),
    regions,
    mapDataUri,
  })
}

// ------------------------------------------------------------------
// Handler
// ------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const auth = await requireAuthenticated(req, res)
  if (!auth) return

  const { customerId, organizationId } = (req.body || {}) as { customerId?: string; organizationId?: string }
  if (!customerId && !organizationId) {
    return res.status(400).json({ error: 'customerId eller organizationId krävs' })
  }

  const documentDate = formatDateSv(new Date().toISOString())
  let browser: Browser | null = null

  try {
    let html: string | null = null
    let filename = ''

    if (customerId) {
      const customer = await loadCustomer(customerId)
      if (!customer) return res.status(404).json({ error: 'Kunden hittades inte' })
      if (!(await canAccessCustomer(auth.userId, customer))) {
        return res.status(403).json({ error: 'Behörighet saknas' })
      }
      browser = await launchBrowser()
      html = await buildStationMap(browser, customer, documentDate)
      filename = `Stationskarta ${safeFilename(customer.site_name || customer.company_name)} ${documentDate}.pdf`
    } else if (organizationId) {
      if (!(await canAccessOrganization(auth.userId, organizationId))) {
        return res.status(403).json({ error: 'Behörighet saknas' })
      }
      browser = await launchBrowser()
      html = await buildStationOverview(browser, organizationId, documentDate)
      if (!html) return res.status(404).json({ error: 'Organisationen hittades inte' })
      const { data: hq } = await supabase
        .from('customers').select('company_name').eq('organization_id', organizationId).eq('site_type', 'huvudkontor').maybeSingle()
      filename = `Stationsöversikt ${safeFilename(hq?.company_name || 'Organisation')} ${documentDate}.pdf`
    }

    if (!browser || !html) {
      return res.status(500).json({ error: 'Kunde inte skapa PDF' })
    }
    const activeBrowser: Browser = browser
    const page = await activeBrowser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
    })
    await activeBrowser.close()
    browser = null

    return res.status(200).json({
      success: true,
      pdf: Buffer.from(pdf).toString('base64'),
      filename,
    })
  } catch (error) {
    console.error('[station-map] PDF-generering misslyckades:', error)
    if (browser) await browser.close().catch(() => {})
    return res.status(500).json({
      error: 'Kunde inte skapa PDF',
      details: error instanceof Error ? error.message : 'Okänt fel',
    })
  }
}

async function launchBrowser() {
  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: (chromium as unknown as { defaultViewport: { width: number; height: number } }).defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: (chromium as unknown as { headless: boolean }).headless,
  })
}
