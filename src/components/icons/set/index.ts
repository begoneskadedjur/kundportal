// src/components/icons/set/index.ts
// Slår ihop domänregistren till ett. IconName är unionen av alla nycklar,
// så ett felstavat namn blir ett typfel.

import { allmanIcons } from './allman'
import { arendeIcons } from './arende'
import { bokningIcons } from './bokning'
import { dokIcons } from './dok'
import { kallaIcons } from './kalla'
import { kontaktIcons } from './kontakt'
import { leadIcons } from './lead'
import { rapportIcons } from './rapport'
import { sokIcons } from './sok'
import { stationIcons } from './station'
import { tjanstIcons } from './tjanst'
import { upphandlingIcons } from './upphandling'
import { guideIcons } from './guide'
import { kundIcons } from './kund'
import { faltIcons } from './falt'

export const ICONS = {
  ...allmanIcons,
  ...leadIcons,
  ...arendeIcons,
  ...kontaktIcons,
  ...dokIcons,
  ...tjanstIcons,
  ...kallaIcons,
  ...sokIcons,
  ...stationIcons,
  ...rapportIcons,
  ...bokningIcons,
  ...upphandlingIcons,
  ...guideIcons,
  ...kundIcons,
  ...faltIcons,
}

export type IconName = keyof typeof ICONS

/** Alla namn i registrets ordning, för granskningssidan. */
export const ICON_NAMES = Object.keys(ICONS) as IconName[]
