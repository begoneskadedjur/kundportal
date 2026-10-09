// Tolkar fri text ("3 år", "36 månader", "12", "2 years") till antal månader.
// Returnerar null för tomt/oläsligt (t.ex. avropsavtal utan längd).
export function parseContractLengthMonths(text: string | null | undefined): number | null {
  if (!text) return null
  const trimmed = String(text).trim()
  if (!trimmed) return null

  const match = trimmed.match(/(\d+(?:[.,]\d+)?)\s*(år|year|years|månader|månad|months?|mån|m)?/i)
  if (!match) return null

  const n = parseFloat(match[1].replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return null

  const unit = (match[2] || '').toLowerCase()
  if (/^(år|year|years)$/.test(unit)) return Math.round(n * 12)
  // Utan enhet eller med månadsenhet → tolka som månader
  return Math.round(n)
}

export type ContractLengthUnit = 'år' | 'månader'

// Avtalslängd som den står i avtalet: "2 år", "1 månad", "6 månader".
// Oneflow-mallarna skriver "inledande period om {avtalslängd}", så enheten
// måste följa med i värdet.
export function formatContractLength(value: string | number, unit: ContractLengthUnit): string {
  const n = String(value).trim()
  if (!n) return ''
  if (unit === 'år') return `${n} år`
  return `${n} ${n === '1' ? 'månad' : 'månader'}`
}

// "2 år" → { value: '2', unit: 'år' }, "6 månader" → { value: '6', unit: 'månader' }.
// Hela år i månader ("36 månader") visas som år. Bara en siffra är år:
// så skickade avtalswizarden längden före enhetsväljaren.
export function splitContractLength(
  text: string | null | undefined,
  fallback: { value: string; unit: ContractLengthUnit } = { value: '1', unit: 'år' }
): { value: string; unit: ContractLengthUnit } {
  if (!text) return fallback
  const bare = String(text).match(/^\s*(\d+)\s*$/)
  if (bare) return { value: bare[1], unit: 'år' }
  const months = parseContractLengthMonths(text)
  if (months == null) return fallback
  if (months % 12 === 0) return { value: String(months / 12), unit: 'år' }
  return { value: String(months), unit: 'månader' }
}

// Beräknar totalt avtalsvärde från årspremie och avtalslängd.
// Null om något saknas (avropsavtal eller ofullständig data).
export function calculateTotalContractValue(
  annualValue: number | null | undefined,
  contractLengthText: string | null | undefined
): number | null {
  if (annualValue == null || annualValue <= 0) return null
  const months = parseContractLengthMonths(contractLengthText)
  if (months == null) return null
  return Math.round(annualValue * (months / 12))
}

// Avtalslängd i år (kan vara bråk, "6 månader" → 0,5). Bara en siffra räknas
// som år, som avtalswizarden skickade den före enhetsväljaren. Null om oläsligt.
export function contractLengthYears(text: string | null | undefined): number | null {
  if (!text) return null
  const { value, unit } = splitContractLength(text, { value: '', unit: 'år' })
  if (!value) return null
  const n = Number(value)
  return unit === 'år' ? n : n / 12
}
