// src/components/technician/ny/besokTyp.ts
// Ikon per besökstyp och statusens ton, delas av Idag, Karta och Mina ärenden.

import type { IconName } from '../../icons/Icon'
import type { BesokTyp, DagBesok } from '../../../services/teknikerDagService'

export type Ton = 'gron' | 'gul' | 'rod' | 'bla' | 'gra'

export const TYP_IKON: Record<BesokTyp, IconName> = {
  inspection: 'station.runda',
  establishment: 'bokning.etablering',
  routine: 'arende.aterbesok',
  contract_extra: 'bokning.extrabesok',
  rondering: 'arende.rondering',
  egenkontroll: 'rapport.inspektion',
  contract: 'kund.avtal',
  private: 'arende.privat',
  business: 'allman.foretag',
}


export function statusTon(b: DagBesok): { ton: Ton; text: string } {
  if (b.avslutad) return { ton: 'gron', text: 'Klart' }
  switch (b.status) {
    case 'Bokad': return { ton: 'bla', text: 'Bokad' }
    case 'Återbesök': return { ton: 'bla', text: 'Återbesök' }
    case 'Öppen': return { ton: 'gul', text: 'Inte bokad' }
    case 'Offert signerad - boka in': return { ton: 'gul', text: 'Offert signerad, boka in' }
    case 'Avtal signerat - Etablera': return { ton: 'gul', text: 'Avtal signerat, etablera' }
    case 'Offert skickad': return { ton: 'gra', text: 'Offert skickad' }
    case 'Avtal skickat': return { ton: 'gra', text: 'Avtal skickat' }
    case 'Bomkörning':
    case 'Ombokning':
    case 'Reklamation': return { ton: 'rod', text: b.status }
    default: return { ton: 'gra', text: b.status || 'Okänd status' }
  }
}
