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
