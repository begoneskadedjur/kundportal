// src/components/shared/stationIcons.tsx
// Gemensamt ikonregister för stationstyper och produkter.
//
// station_types.icon och articles.icon sparar ett ikonnamn härifrån. Egna
// ikoner är ritade efter produkterna som står ute (Killgerm-katalogen 2026 och
// tillverkarnas produktblad): 24 × 24, linje 1,75, rundade ändar, samma rutnät
// som Lucide så att de kan stå bredvid varandra. De äldre namnen (target, box,
// package, crosshair, circle) ritas med Lucide som förut, så befintliga typer
// byter inte utseende förrän någon väljer en ny ikon.
//
// På en station gäller produktens ikon före stationstypens (resolveStationIcon).

import { memo, type ComponentType } from 'react'
import { Box, Circle, Crosshair, Package, Target } from 'lucide-react'
import { PATHS, stationIconPaths as sharedIconPaths } from '../../shared/stationMarkers'

export type StationIconGroup = 'typ' | 'produkt' | 'form'

export interface StationIconDef {
  key: string
  label: string
  group: StationIconGroup
  /** Ritad efter, visas som hjälptext i väljaren */
  hint?: string
}


const LUCIDE: Record<string, ComponentType<{ className?: string }>> = {
  target: Target,
  box: Box,
  package: Package,
  crosshair: Crosshair,
  circle: Circle,
  // Äldre koder från tiden före station_types
  mechanical_trap: Crosshair,
  concrete_station: Box,
  bait_station: Target,
}

/** Alla ikoner som går att välja, i den ordning väljaren visar dem. */
export const STATION_ICONS: StationIconDef[] = [
  { key: 'betesstation', label: 'Betesstation', group: 'typ', hint: 'AF Rat Box, AF Atom' },
  { key: 'betongstation', label: 'Betongstation', group: 'typ' },
  { key: 'platstation', label: 'Plåtstation', group: 'typ', hint: 'Galvad plåt på vägg, ingång nedåt' },
  { key: 'mekanisk-falla', label: 'Mekanisk fälla', group: 'typ', hint: 'Slagfälla Fox, Gorilla' },
  { key: 'ljusfalla', label: 'Ljusfälla', group: 'typ', hint: 'PW Chameleon 1x2' },
  { key: 'klisterfalla-krypande', label: 'Klisterfälla krypande', group: 'typ', hint: 'AF Insect Monitor, S-trap' },
  { key: 'klisterfalla-flygande', label: 'Klisterfälla flygande', group: 'typ', hint: 'AF Demi-Diamond' },
  { key: 'avloppsfalla', label: 'Avloppsfälla', group: 'typ', hint: 'WiseTrap, SMART Pipe' },
  { key: 'aurotrap', label: 'Aurotrap', group: 'produkt', hint: 'Nature, Collect, Collect Guard' },
  { key: 'goodnature-a24', label: 'Goodnature A24', group: 'produkt' },
  { key: 'snap-e', label: 'Snap-E', group: 'produkt' },
  { key: 'af-multis', label: 'AF Multis', group: 'produkt' },
  { key: 'af-tunnel', label: 'AF Tunnel', group: 'produkt' },
  { key: 'af-underground', label: 'AF Underground', group: 'produkt' },
  { key: 'chameleon-uplight', label: 'Chameleon Uplight', group: 'produkt' },
  { key: 'nemesis-titan', label: 'Nemesis X, Titan 300', group: 'produkt' },
  { key: 'climbup', label: 'Climbup', group: 'produkt' },
  { key: 'funnel-trap', label: 'Funnel Trap', group: 'produkt' },
  { key: 'daddi-long-legs', label: 'Daddi Long Legs', group: 'produkt' },
  { key: 'eagle-eye', label: 'Eagle Eye, Bird Breezer', group: 'produkt' },
  { key: 'target', label: 'Måltavla', group: 'form' },
  { key: 'box', label: 'Låda', group: 'form' },
  { key: 'package', label: 'Paket', group: 'form' },
  { key: 'crosshair', label: 'Sikte', group: 'form' },
  { key: 'circle', label: 'Cirkel', group: 'form' },
]

export const STATION_ICON_GROUP_LABEL: Record<StationIconGroup, string> = {
  typ: 'Stationstyper',
  produkt: 'Produkter',
  form: 'Enkla former',
}

export function stationIconLabel(name: string | null | undefined): string {
  return STATION_ICONS.find((i) => i.key === name)?.label ?? 'Låda'
}

/** SVG-innehållet för en ikon (se src/shared/stationMarkers.ts). */
export const stationIconPaths = sharedIconPaths


/** Produktens ikon gäller före stationstypens. */
export function resolveStationIcon(
  articleIcon: string | null | undefined,
  typeIcon: string | null | undefined
): string {
  return articleIcon || typeIcon || 'box'
}

interface StationIconProps {
  name: string | null | undefined
  className?: string
}

/** Ritar en stationsikon. Okänt namn blir Låda, som tidigare. */
export const StationIcon = memo(function StationIcon({ name, className }: StationIconProps) {
  const paths = name ? PATHS[name] : undefined
  if (paths) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: paths }}
      />
    )
  }
  const Lucide = (name && LUCIDE[name]) || Box
  return <Lucide className={className} />
})

// Komponenter per namn, för ställen som vill ha `const Icon = ...; <Icon className />`
const componentCache = new Map<string, ComponentType<{ className?: string }>>()

export function getStationIconComponent(name: string | null | undefined): ComponentType<{ className?: string }> {
  const key = name || 'box'
  const hit = componentCache.get(key)
  if (hit) return hit
  const C = ({ className }: { className?: string }) => <StationIcon name={key} className={className} />
  C.displayName = `StationIcon(${key})`
  componentCache.set(key, C)
  return C
}
