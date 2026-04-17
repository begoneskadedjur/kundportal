// src/utils/rotRutConstants.ts
// Centraliserade ROT/RUT-konstanter för hela appen.
// Procentsatser kan överridas per service (services.rot_rate_percent / rut_rate_percent).
// Maxbelopp är lagstadgade tak per person och år — ändras sällan.

export const DEFAULT_ROT_PERCENT = 30
export const DEFAULT_RUT_PERCENT = 50
export const ROT_MAX_DEDUCTION = 50000
export const RUT_MAX_DEDUCTION = 75000

interface ServiceRateSource {
  rot_rate_percent?: number | null
  rut_rate_percent?: number | null
}

export function getEffectiveRotPercent(service?: ServiceRateSource | null): number {
  return service?.rot_rate_percent ?? DEFAULT_ROT_PERCENT
}

export function getEffectiveRutPercent(service?: ServiceRateSource | null): number {
  return service?.rut_rate_percent ?? DEFAULT_RUT_PERCENT
}
