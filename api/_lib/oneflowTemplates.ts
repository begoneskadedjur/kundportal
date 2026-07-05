// api/_lib/oneflowTemplates.ts - Dynamiska Oneflow-mallar för serverless-koden.
// Läser tabellen oneflow_templates (ALLA rader, även avaktiverade - webhook och
// sync ska känna igen befintliga avtal oavsett wizard-status).
//
// Snapshot-mönster: handlern anropar `await refreshTemplates()` en gång i början,
// därefter är alla uppslag synkrona - så slipper djupt liggande hjälpfunktioner
// bli asynkrona. Vid DB-fel behålls senast kända listan (initialt den hårdkodade
// legacy-listan) = degradering till dagens beteende, aldrig till tom lista.
//
// UNDANTAG: sync-oneflow får ALDRIG använda fallback - en föråldrad lista skulle
// trasha avtal på mallar som lagts till efteråt. Den använder fetchTemplatesStrict()
// som kastar vid fel/tom tabell så att syncen avbryts i stället.
import { createClient } from '@supabase/supabase-js'

// CJS-filen får inte konverteras till ESM (webhook-kravet i skill externa-integrationer)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const legacy = require('../constants/oneflowTemplates')

export type OneflowTemplateType = 'contract' | 'offer'

export interface OneflowTemplateInfo {
  id: string
  name: string
  type: OneflowTemplateType
  category: 'company' | 'individual' | null
  is_active: boolean
}

const LEGACY_TEMPLATES: OneflowTemplateInfo[] = (legacy.ALL_TEMPLATES as Array<{
  id: string; name: string; type: OneflowTemplateType; category?: 'company' | 'individual'
}>).map(t => ({ id: t.id, name: t.name, type: t.type, category: t.category ?? null, is_active: true }))

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!

let current: OneflowTemplateInfo[] = LEGACY_TEMPLATES
let fetchedAt = 0
const CACHE_TTL_MS = 60_000

async function fetchFromDb(): Promise<OneflowTemplateInfo[]> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
  const { data, error } = await supabase
    .from('oneflow_templates')
    .select('oneflow_template_id, name, type, category, is_active')
  if (error) throw new Error(`Kunde inte läsa oneflow_templates: ${error.message}`)
  const rows = (data ?? []).map(r => ({
    id: r.oneflow_template_id as string,
    name: r.name as string,
    type: r.type as OneflowTemplateType,
    category: (r.category ?? null) as 'company' | 'individual' | null,
    is_active: r.is_active as boolean
  }))
  if (rows.length === 0) {
    throw new Error('oneflow_templates är tom - tabellen ska alltid ha minst seed-mallarna')
  }
  return rows
}

/** Uppdatera snapshotet (cachas 60 s). Vid fel behålls senast kända listan. */
export async function refreshTemplates(): Promise<void> {
  if (Date.now() - fetchedAt < CACHE_TTL_MS) return
  try {
    current = await fetchFromDb()
    fetchedAt = Date.now()
  } catch (err) {
    console.error('[oneflowTemplates] DB-läsning misslyckades, använder senast kända listan:', err)
  }
}

/** STRIKT hämtning för sync-oneflow: kastar vid fel/tom - ingen fallback (trashing-skyddet). */
export async function fetchTemplatesStrict(): Promise<OneflowTemplateInfo[]> {
  const rows = await fetchFromDb()
  current = rows
  fetchedAt = Date.now()
  return rows
}

// ─── Synkrona uppslag mot snapshotet ─────────────────────────

export function isKnownTemplate(templateId: string): boolean {
  return current.some(t => t.id === templateId)
}

export function getKnownTemplateIds(): Set<string> {
  return new Set(current.map(t => t.id))
}

export function getOfferTemplateIds(): Set<string> {
  return new Set(current.filter(t => t.type === 'offer').map(t => t.id))
}

/** Motsvarar legacy getContractTypeFromTemplate. */
export function contractTypeOf(templateId: string): OneflowTemplateType | null {
  return current.find(t => t.id === templateId)?.type ?? null
}

/** Mallens visningsnamn (ersätter hårdkodade CONTRACT_TYPE_MAP i kundimporten). */
export function templateNameOf(templateId: string): string | null {
  return current.find(t => t.id === templateId)?.name ?? null
}
