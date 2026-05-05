// api/_lib/cronLogger.ts
// Wrappar cron-jobb och loggar resultatet i cron_runs-tabellen.
// Används av månadsrapporten för att visa cron-aktivitet historiskt.

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY!,
)

type CronStatus = 'running' | 'success' | 'partial' | 'failed'

export interface CronRunResult<T = unknown> {
  status: Exclude<CronStatus, 'running'>
  summary: T
  errorMessage?: string
}

/**
 * Wrappa en cron-handler med automatisk loggning till cron_runs-tabellen.
 *
 * Inserter en row med status='running' innan fn körs.
 * Uppdaterar med status + summary + finished_at efter.
 * Loggning är "best-effort" — om DB-anrop misslyckas körs fn ändå.
 *
 * @param jobName Identifierar cron-jobbet (t.ex. 'generate-continuing-contracts')
 * @param fn Funktion som returnerar { status, summary, errorMessage? }. Får runId för progressuppdateringar (valfritt).
 */
export async function withCronLog<T>(
  jobName: string,
  fn: (runId: string | null) => Promise<CronRunResult<T>>,
): Promise<CronRunResult<T>> {
  const started = new Date().toISOString()
  let runId: string | null = null

  try {
    const { data, error } = await supabase
      .from('cron_runs')
      .insert({
        job_name: jobName,
        started_at: started,
        status: 'running',
      })
      .select('id')
      .single()
    if (!error && data) runId = data.id
  } catch (err) {
    console.warn(`[cronLogger] Kunde inte starta logg för ${jobName}:`, err)
  }

  let result: CronRunResult<T>
  try {
    result = await fn(runId)
  } catch (err: any) {
    result = {
      status: 'failed',
      summary: {} as T,
      errorMessage: err?.message ?? 'Okänt fel',
    }
  }

  if (runId) {
    try {
      await supabase
        .from('cron_runs')
        .update({
          finished_at: new Date().toISOString(),
          status: result.status,
          summary: result.summary,
          error_message: result.errorMessage ?? null,
        })
        .eq('id', runId)
    } catch (err) {
      console.warn(`[cronLogger] Kunde inte avsluta logg för ${jobName}:`, err)
    }
  }

  return result
}
