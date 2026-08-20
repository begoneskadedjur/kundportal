// src/components/admin/customers/record/ContractStamp.tsx
// Gummistämpeln på avtalspappret. Egen SVG — inga ikonbibliotek, ingen emoji:
// den ska läsa som bläck stämplat på papper, inte som ett UI-element.
//
// Formen: dubbel ram (tjock ytterlinje, tunn innerlinje), lätt oregelbundna
// hörn via path i stället för rect, roterad några grader, och ett brusfilter
// som knaprar upp kanten så trycket blir ojämnt. Degraderar till en ren ram
// i webbläsare som inte klarar filtret — fullt läsbart ändå.

export type StampVariant = 'active' | 'terminated' | 'ended'

const STAMP: Record<StampVariant, { label: string; color: string }> = {
  active: { label: 'AKTIVT', color: '#157a5b' },
  terminated: { label: 'UPPSAGT', color: '#b45309' },
  ended: { label: 'AVSLUTAT', color: '#9b3535' },
}

interface Props {
  variant: StampVariant
  /** Aktivt avtal använder pappersaccenten; uppsagt/avslutat sin egen färg. */
  color?: string
  /** Andra raden i stämpeln, t.ex. "T.O.M. 2026-12-31". */
  subLabel?: string | null
}

export default function ContractStamp({ variant, color, subLabel }: Props) {
  const spec = STAMP[variant]
  const ink = color ?? spec.color
  const uid = `stamp-${variant}`
  const h = subLabel ? 54 : 42
  const vbH = h * 2

  return (
    <svg
      width="118"
      height={h}
      viewBox={`0 0 236 ${vbH}`}
      className="overflow-visible shrink-0"
      role="img"
      aria-label={`Avtalsstatus: ${spec.label}${subLabel ? `, ${subLabel}` : ''}`}
    >
      <defs>
        {/* Ojämn gummikant: lågfrekvent brus som förskjuter linjerna */}
        <filter id={`${uid}-rough`} x="-12%" y="-25%" width="124%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.055" numOctaves="3" seed="7" result="n" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="n"
            scale="2.4"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        {/* Ojämnt bläckpålägg: fläckar som drar ner opaciteten ställvis */}
        <filter id={`${uid}-ink`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="grain" />
          <feColorMatrix
            in="grain"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.1 0.92"
            result="mask"
          />
          <feComposite in="SourceGraphic" in2="mask" operator="in" />
        </filter>
      </defs>

      <g transform={`rotate(-7 118 ${h})`} filter={`url(#${uid}-rough)`} opacity="0.9">
        {/* Yttre ram — path, inte rect: hörnen sitter aldrig exakt lika */}
        <path
          d={`M 9 7 L 227 5 Q 232 5 232 11 L 231 ${vbH - 10}
              Q 231 ${vbH - 4} 225 ${vbH - 5} L 10 ${vbH - 3}
              Q 4 ${vbH - 3} 4 ${vbH - 9} L 5 12 Q 5 7 9 7 Z`}
          fill="none"
          stroke={ink}
          strokeWidth="4.5"
          strokeLinejoin="round"
        />
        {/* Inre hårlinje */}
        <path
          d={`M 15 13 L 221 11.5 Q 225 11.5 225 16 L 224.5 ${vbH - 16}
              Q 224.5 ${vbH - 11} 220 ${vbH - 11.5} L 16 ${vbH - 10}
              Q 11 ${vbH - 10} 11 ${vbH - 15} L 11.5 17 Q 11.5 13 15 13 Z`}
          fill="none"
          stroke={ink}
          strokeWidth="1.6"
          strokeLinejoin="round"
          opacity="0.75"
        />
        <text
          x="118"
          y={subLabel ? vbH * 0.44 : h + 6}
          textAnchor="middle"
          fill={ink}
          fontFamily="ui-sans-serif, system-ui, 'Inter', sans-serif"
          fontSize="25"
          fontWeight="800"
          letterSpacing="4.2"
        >
          {spec.label}
        </text>
        {subLabel && (
          <text
            x="118"
            y={vbH * 0.74}
            textAnchor="middle"
            fill={ink}
            fontFamily="ui-sans-serif, system-ui, 'Inter', sans-serif"
            fontSize="14"
            fontWeight="600"
            letterSpacing="1.6"
            opacity="0.85"
          >
            {subLabel}
          </text>
        )}
      </g>

      {/* Ojämnt bläck ovanpå hela stämpeln */}
      <g transform={`rotate(-7 118 ${h})`} filter={`url(#${uid}-ink)`} opacity="0.16" aria-hidden>
        <rect x="4" y="4" width="228" height={vbH - 8} rx="8" fill={ink} />
      </g>
    </svg>
  )
}
