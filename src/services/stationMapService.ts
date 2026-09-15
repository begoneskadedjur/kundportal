// src/services/stationMapService.ts
// Nedladdning av Stationskarta (kund/enhet) och Stationsöversikt (regionskund)
// via /api/generate-station-map-pdf.

import { apiFetch } from '../lib/api'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function requestPdf(body: Record<string, string>): Promise<void> {
  const response = await apiFetch('/api/generate-station-map-pdf', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || `PDF-generering misslyckades (${response.status})`)
  }
  const result = await response.json()
  if (!result.success || !result.pdf) {
    throw new Error('Ogiltig PDF-respons från servern')
  }
  const pdfBytes = Uint8Array.from(atob(result.pdf), c => c.charCodeAt(0))
  downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), result.filename)
}

export class StationMapService {
  /** Stationskarta för en kund eller multisite-enhet: planritningar, satellitkarta, stationslista */
  static downloadStationMap(customerId: string): Promise<void> {
    return requestPdf({ customerId })
  }

  /** Stationsöversikt för en regionskund: antal stationer per region */
  static downloadStationOverview(organizationId: string): Promise<void> {
    return requestPdf({ organizationId })
  }
}
