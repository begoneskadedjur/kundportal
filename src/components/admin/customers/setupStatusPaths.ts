// src/components/admin/customers/setupStatusPaths.ts
// Ikonnamn, textfärger och klickmål för uppläggningens statusikoner
// (komponenterna ligger i SetupStatus.tsx).

import type { IconName } from '../../icons/Icon'
import type { SetupKey, SetupState, SetupTarget } from '../../../shared/customerSetupStatus'

export const SETUP_ICON: Record<SetupKey, IconName> = {
  avtal: 'kund.avtal',
  fortnox: 'kund.fortnox',
  vag: 'kund.fakturavag',
  schema: 'kund.schema',
  portal: 'kund.portal',
}

/** Färgen på lägestexten i förklaringen */
export const STATE_TEXT_TONE: Record<SetupState, string> = {
  done: 'text-emerald-400',
  partial: 'text-amber-400',
  missing: 'text-orange-400',
  na: 'text-slate-400',
}

/** Sökvägen ett klickmål leder till. basePath är t.ex. "/admin/befintliga-kunder". */
export function setupTargetPath(t: SetupTarget, basePath: string): string {
  const prefix = basePath.split('/befintliga-kunder')[0]
  switch (t.page) {
    case 'record':
      return `${basePath}/${t.customerId}?tab=${t.tab}`
    case 'edit':
      return `${basePath}?edit=${t.customerId}`
    case 'schema':
      // Rondering & Schema finns för admin och koordinator; säljare får kundsidan
      return prefix === '/admin' || prefix === '/koordinator'
        ? `${prefix}/rondering-schema?q=${encodeURIComponent(t.query)}`
        : `${basePath}/${t.customerId}`
  }
}
