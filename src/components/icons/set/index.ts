// src/components/icons/set/index.ts
// Slår ihop domänregistren till ett. IconName är unionen av alla nycklar,
// så ett felstavat namn blir ett typfel.

import { allmanIcons } from './allman'
import { arendeIcons } from './arende'
import { dokIcons } from './dok'
import { kallaIcons } from './kalla'
import { kontaktIcons } from './kontakt'
import { leadIcons } from './lead'
import { sokIcons } from './sok'
import { tjanstIcons } from './tjanst'

export const ICONS = {
  ...allmanIcons,
  ...leadIcons,
  ...arendeIcons,
  ...kontaktIcons,
  ...dokIcons,
  ...tjanstIcons,
  ...kallaIcons,
  ...sokIcons,
}

export type IconName = keyof typeof ICONS

/** Alla namn i registrets ordning, för granskningssidan. */
export const ICON_NAMES = Object.keys(ICONS) as IconName[]
