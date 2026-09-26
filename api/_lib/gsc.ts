// api/_lib/gsc.ts
// Google Search Console (Search Analytics) utan nya beroenden.
//
// Tjänstekontots nyckel läses ur process.env.GSC_SERVICE_ACCOUNT_JSON (hela
// JSON-nyckeln som sträng). Vi signerar en JWT med RS256 via node:crypto och
// byter den mot en access token (OAuth 2.0 JWT bearer). Nyckeln, token och
// JWT loggas ALDRIG; fel från Google loggas bara med status och meddelande.

import { createSign } from 'node:crypto'

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const GSC_ROW_LIMIT = 25000

export type GscDimension = 'date' | 'page' | 'query' | 'country' | 'device' | 'searchAppearance'

export interface GscRow {
  keys?: string[]
  clicks?: number
  impressions?: number
  ctr?: number
  position?: number
}

export class GscError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly googleStatus: string,
    message: string,
  ) {
    super(message)
    this.name = 'GscError'
  }
}

interface ServiceAccount {
  client_email: string
  private_key: string
  token_uri?: string
}

function readServiceAccount(): ServiceAccount {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON
  if (!raw) throw new GscError(0, 'CONFIG', 'GSC_SERVICE_ACCOUNT_JSON saknas i miljön')
  let parsed: Partial<ServiceAccount>
  try {
    parsed = JSON.parse(raw) as Partial<ServiceAccount>
  } catch {
    throw new GscError(0, 'CONFIG', 'GSC_SERVICE_ACCOUNT_JSON är inte giltig JSON')
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new GscError(0, 'CONFIG', 'GSC_SERVICE_ACCOUNT_JSON saknar client_email eller private_key')
  }
  // Nyckeln kan ha fått bokstavliga \n om den klistrats in som en rad
  const privateKey = parsed.private_key.includes('\n')
    ? parsed.private_key.replace(/\n/g, '\n')
    : parsed.private_key
  return { client_email: parsed.client_email, private_key: privateKey, token_uri: parsed.token_uri }
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

let cachedToken: { token: string; expiresAt: number } | null = null

/** Hämtar (och cachar i processen) en access token med läsbehörighet i Search Console. */
export async function getGscAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) return cachedToken.token

  const sa = readServiceAccount()
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(
    JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }),
  )
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claims}`)
  let signature: string
  try {
    signature = base64url(signer.sign(sa.private_key))
  } catch {
    throw new GscError(0, 'CONFIG', 'private_key i GSC_SERVICE_ACCOUNT_JSON gick inte att använda för signering')
  }
  const assertion = `${header}.${claims}.${signature}`

  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
  })
  const body = (await resp.json().catch(() => ({}))) as {
    access_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }
  if (!resp.ok || !body.access_token) {
    throw new GscError(
      resp.status,
      body.error ?? `HTTP_${resp.status}`,
      `Tokenutbytet misslyckades: ${body.error_description ?? body.error ?? resp.statusText}`,
    )
  }
  cachedToken = { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 }
  return body.access_token
}

export interface GscQueryOptions {
  siteUrl: string
  startDate: string // ÅÅÅÅ-MM-DD
  endDate: string // ÅÅÅÅ-MM-DD
  dimensions: GscDimension[]
  /** Paus mellan sidanropen, ms */
  pauseMs?: number
  /** Anropas före varje sida; returnerar false för att avbryta (t.ex. tidsgräns) */
  shouldContinue?: () => boolean
}

export class GscAborted extends Error {
  constructor() {
    super('Avbruten före tidsgränsen')
    this.name = 'GscAborted'
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function readGoogleError(resp: Response): Promise<GscError> {
  let body: { error?: { code?: number; status?: string; message?: string } } = {}
  try {
    body = (await resp.json()) as typeof body
  } catch {
    // inte JSON
  }
  return new GscError(resp.status, body.error?.status ?? `HTTP_${resp.status}`, body.error?.message ?? resp.statusText)
}

/**
 * Search Analytics query med paginering (startRow, rowLimit 25000),
 * searchType web och dataState final. Returnerar alla rader för perioden.
 * Kastar GscError vid fel från Google och GscAborted om shouldContinue säger stopp.
 */
export async function querySearchAnalytics(opts: GscQueryOptions): Promise<GscRow[]> {
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(opts.siteUrl)}/searchAnalytics/query`
  const rows: GscRow[] = []
  let startRow = 0
  for (;;) {
    if (opts.shouldContinue && !opts.shouldContinue()) throw new GscAborted()
    const token = await getGscAccessToken()
    const send = () =>
      fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: opts.startDate,
          endDate: opts.endDate,
          dimensions: opts.dimensions,
          searchType: 'web',
          dataState: 'final',
          rowLimit: GSC_ROW_LIMIT,
          startRow,
        }),
      })
    let resp = await send()
    // Ett nytt försök vid kvot- eller tillfälliga fel
    if (resp.status === 429 || resp.status >= 500) {
      await sleep(5000)
      resp = await send()
    }
    if (!resp.ok) throw await readGoogleError(resp)
    const data = (await resp.json()) as { rows?: GscRow[] }
    const page = data.rows ?? []
    rows.push(...page)
    if (page.length < GSC_ROW_LIMIT) break
    startRow += page.length
    if (opts.pauseMs) await sleep(opts.pauseMs)
  }
  return rows
}
