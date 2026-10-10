// src/components/icons/Icon.tsx
// Portalens gemensamma ikonkomponent (ikonstandard 2026-10, docs/leads/leads-ux.md avsnitt 4).
//
// Spec: viewBox 0 0 24 24, fill none, stroke currentColor, streck 1,6 (sätts här,
// aldrig i ritningen), rundade ändar och hörn, 2 px marginal, en färg.
// Storlekar: 16 i text och rader, 20 i knappar och flikar, 24 i rubriker, 32 i tomma lägen.
// Ritningarna ligger i set/<domän>.tsx och namnen skrivs domän.namn utan å, ä och ö.

import { ICONS, type IconName } from './set'

export type { IconName }
export type IconSize = 16 | 20 | 24 | 32

interface IconProps {
  name: IconName
  /** 16, 20, 24 eller 32. En className med w-/h- vinner över storleken. */
  size?: IconSize
  className?: string
  /** Med titel blir ikonen en bild för skärmläsare, annars aria-hidden. */
  title?: string
  /** Nödutgång, normalt aldrig. Standarden är 1,6. */
  strokeWidth?: number
}

export function Icon({ name, size = 16, className, title, strokeWidth = 1.6 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...(title ? { role: 'img' } : { 'aria-hidden': true })}
    >
      {title && <title>{title}</title>}
      {ICONS[name]}
    </svg>
  )
}

export default Icon
