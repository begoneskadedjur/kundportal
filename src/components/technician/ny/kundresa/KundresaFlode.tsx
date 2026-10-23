// src/components/technician/ny/kundresa/KundresaFlode.tsx
// Flödet i Min kundresa: ett band som smalnar av i proportion till antalet.
//
// Varje segment är en egen SVG-bana (en path per segment och gren), bredden är
// antal × enhet. Vägen framåt i brandfärg med mörk text, förluster i neutral grå,
// Väntar på svar streckat och ljusare, det som inte mäts än randigt. Etiketterna står
// direkt vid grenarna. Hover och tangentbordsfokus på en bana visar en ruta med
// antal och andel, övriga banor tonas ned. Under flödet finns samma siffror som tabell.
//
// Dator: från vänster till höger. Telefon (lodrätt = true): uppifrån och ned, förlusterna
// böjer av åt höger.

import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { Icon } from '../../../icons/Icon'
import { BOKNING_MATS_FRAN, pct, tidText, typOrd, type DokTyp, type Flode } from './kundresaData'

const BRAND = '#20c58f'
const NOD_FARG = '#17a578'
const BRAND_TEXT = '#04281c'
const NOD = 8
const GAP = 2

type Slag = 'fram' | 'vantar' | 'bort' | 'ejmatt' | 'bokad' | 'nod'

interface Bana {
  id: string
  d: string
  slag: Slag
  etikett: string
  /** Rutan vid hover och fokus */
  ruta: { rubrik: string; rad: string; x: number; y: number }
}

// ─── Banornas geometri ───

/** Vågrät ribbon, vågräta tangenter */
function ribbonH(x0: number, y0a: number, y0b: number, x1: number, y1a: number, y1b: number) {
  const xm = (x0 + x1) / 2
  return `M${x0} ${y0a}C${xm} ${y0a} ${xm} ${y1a} ${x1} ${y1a}L${x1} ${y1b}C${xm} ${y1b} ${xm} ${y0b} ${x0} ${y0b}Z`
}
/** Lodrät in, vågrät ut åt höger */
function ribbonVH(y0: number, x0a: number, x0b: number, x1: number, y1a: number, y1b: number) {
  const k = 0.55
  return `M${x0a} ${y0}C${x0a} ${y0 + k * (y1b - y0)} ${x0a + (1 - k) * (x1 - x0a) * 0.6} ${y1b} ${x1} ${y1b}L${x1} ${y1a}C${x0b + (1 - k) * (x1 - x0b) * 0.6} ${y1a} ${x0b} ${y0 + k * (y1a - y0)} ${x0b} ${y0}Z`
}
const rekt = (x: number, y: number, w: number, h: number) => `M${x} ${y}H${x + w}V${y + h}H${x}Z`

/** Staplar segment med 2 px mellanrum mellan de som finns */
function stapla(start: number, antal: number[], u: number): Array<[number, number]> {
  let p = start
  return antal.map(n => {
    if (n <= 0) return [p, p]
    const a = p
    p = a + n * u
    const ut: [number, number] = [a, p]
    p += GAP
    return ut
  })
}

interface Props {
  flode: Flode
  typ: DokTyp
  /** Skickade perioden före, null när ingen jämförelse görs */
  foreSkickade: number | null
  foreAndel: number | null
  lodratt: boolean
}

function useBredd<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setW(el.clientWidth)
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

const efterText = (typ: DokTyp) =>
  typ === 'offer'
    ? `Bokad, utförd, fakturerad och betald mäts inte än för offerter. Räknas från ${BOKNING_MATS_FRAN}, när kontoret bokar in med Boka in.`
    : 'Bokad, fakturerad och betald mäts inte än för avtal.'

/** Kortare text ovanför bandet på datorn */
const efterKort = (typ: DokTyp) =>
  typ === 'offer'
    ? `Mäts inte än för offerter. Bokad räknas från ${BOKNING_MATS_FRAN} (Boka in).`
    : 'Fakturerad och betald mäts inte än för avtal.'

export function KundresaFlode(props: Props) {
  const { flode: f, typ } = props
  const [ref, bredd] = useBredd<HTMLDivElement>()
  const [aktiv, setAktiv] = useState<string | null>(null)
  const monster = `randig-${useId().replace(/:/g, '')}`

  const geo = bredd > 0 && f.skickade > 0 ? (props.lodratt ? lodrat(props, bredd) : vagrat(props, bredd)) : null
  const ruta = geo && aktiv ? geo.banor.find(b => b.id === aktiv)?.ruta : null

  return (
    <div ref={ref} className="relative w-full" onMouseLeave={() => setAktiv(null)}>
      {geo && (
        <div className="relative" style={{ height: geo.h }}>
          <svg
            width={bredd}
            height={geo.h}
            viewBox={`0 0 ${bredd} ${geo.h}`}
            role="group"
            aria-label={`Flödet för ${typOrd(typ, 2)}, ${f.skickade} skickade`}
            className="absolute inset-0 block overflow-visible"
          >
            <defs>
              <pattern id={monster} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="8" height="8" className="fill-slate-800" />
                <line x1="0" y1="0" x2="0" y2="8" strokeWidth="3" className="stroke-slate-700" />
              </pattern>
            </defs>
            {geo.banor.map(b => (
              <path
                key={b.id}
                d={b.d}
                tabIndex={b.slag === 'nod' ? -1 : 0}
                role="img"
                aria-label={b.etikett}
                onMouseEnter={() => setAktiv(b.id)}
                onFocus={() => setAktiv(b.id)}
                onBlur={() => setAktiv(null)}
                strokeLinejoin="round"
                {...stil(b.slag, monster)}
                style={{ opacity: aktiv && aktiv !== b.id && b.slag !== 'nod' ? 0.45 : 1, transition: 'opacity .15s' }}
                className={`${stil(b.slag, monster).className ?? ''} outline-none focus-visible:[stroke:var(--color-white)] focus-visible:[stroke-width:2]`}
              >
                <title>{b.etikett}</title>
              </path>
            ))}
          </svg>
          {geo.etiketter}
          {ruta && (
            <div
              role="status"
              className="pointer-events-none absolute z-10 max-w-[260px] rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 shadow-xl"
              style={{ left: Math.min(Math.max(ruta.x, 0), Math.max(bredd - 260, 0)), top: ruta.y }}
            >
              <p className="text-sm font-semibold text-white">{ruta.rubrik}</p>
              <p className="text-[13px] text-slate-300 leading-snug">{ruta.rad}</p>
            </div>
          )}
        </div>
      )}
      {geo?.under}
    </div>
  )
}

function stil(slag: Slag, monster: string): { fill?: string; stroke?: string; strokeWidth?: number; strokeDasharray?: string; fillOpacity?: number; className?: string } {
  switch (slag) {
    case 'fram': return { fill: BRAND }
    case 'bokad': return { fill: BRAND }
    case 'nod': return { fill: NOD_FARG }
    case 'vantar': return { fill: BRAND, fillOpacity: 0.28, stroke: BRAND, strokeWidth: 1.5, strokeDasharray: '5 4' }
    case 'bort': return { className: 'fill-slate-500' }
    case 'ejmatt': return { fill: `url(#${monster})`, strokeWidth: 1, strokeDasharray: '4 4', className: 'stroke-slate-500' }
  }
}

// ─── Små etiketter ───

function Etikett({ x, y, w, children, className = '' }: { x: number; y: number; w: number; children: ReactNode; className?: string }) {
  return (
    <div className={`absolute pointer-events-none ${className}`} style={{ left: x, top: y, width: w }}>
      {children}
    </div>
  )
}

function GrenEtikett({ x, y, w, rubrik, text }: { x: number; y: number; w: number; rubrik: string; text: string }) {
  return (
    <Etikett x={x} y={y} w={w}>
      <p className="text-sm font-semibold leading-snug text-white">{rubrik}</p>
      <p className="text-sm leading-snug text-slate-400">{text}</p>
    </Etikett>
  )
}

function StegRubrik({ namn, tal, under }: { namn: string; tal: number; under?: string }) {
  return (
    <>
      <p className="text-sm font-semibold text-slate-300">{namn}</p>
      <p className="font-mono text-3xl font-bold leading-tight text-white tabular-nums">{tal}</p>
      {under && <p className="text-sm text-slate-400">{under}</p>}
    </>
  )
}

function texter(p: Props) {
  const f = p.flode
  const sig = pct(f.signerade, f.skickade)
  return {
    sig,
    skickadeUnder: p.foreSkickade !== null ? `perioden före ${p.foreSkickade}` : undefined,
    signeradeUnder: `${sig} % av skickade${p.foreAndel !== null ? `, före ${p.foreAndel} %` : ''}`,
    lbl: {
      skickade: `Skickade: ${f.skickade} ${typOrd(p.typ, f.skickade)}`,
      signerade: `Signerade: ${f.signerade} av ${f.skickade}, ${sig} %${f.medianSignerad !== null ? `. Hälften inom ${tidText(f.medianSignerad)}` : ''}`,
      vantar: `Väntar på svar: ${f.vantar}, fristen är inte ute`,
      forfoll: `Förföll: ${f.forfoll}, fristen gick ut`,
      raderades: `Raderades: ${f.raderades}, togs bort i Oneflow innan signering`,
      annat: `Avslutades utan signering: ${f.annat}`,
      bokad: `Bokade: ${f.bokade} av ${f.signerade} signerade har ett bokat besök`,
      ejmatt: `Efter signeringen: mäts inte än`,
    },
    rad: (n: number) => `${n} av ${f.skickade} skickade, ${pct(n, f.skickade)} %`,
  }
}

// ─── Dator: vänster till höger ───

function vagrat(p: Props, W: number) {
  const f = p.flode
  const t = texter(p)
  const U = Math.min(14, 130 / f.skickade)
  const Y0 = 120
  const [sS, sV, sF, sR, sA] = stapla(Y0, [f.signerade, f.vantar, f.forfoll, f.raderades, f.annat], U)
  const kallaSlut = Math.max(sS[1], sV[1], sF[1], sR[1], sA[1])
  const XS = Math.round(W * 0.58)
  const XL = Math.round(W * 0.4)
  const efterBred = W - (XS + 196) >= 230

  // Grenarnas slut, med plats för etiketterna under varandra
  const vTop = sS[1] + 18
  const vBot = vTop + f.vantar * U
  let nasta = Math.max(f.vantar > 0 ? Math.max(vBot + 30, vTop + 56) : sS[1] + 30, kallaSlut + 30)
  const gren = (n: number) => {
    if (n <= 0) return [nasta, nasta] as [number, number]
    const top = nasta
    const bot = top + n * U
    nasta = Math.max(top + 48, bot + 14)
    return [top, bot] as [number, number]
  }
  const [fTop, fBot] = gren(f.forfoll)
  const [rTop, rBot] = gren(f.raderades)
  const [aTop, aBot] = gren(f.annat)
  const H = Math.max(nasta + 8, sS[1] + 40, vBot + 50)

  const banor: Bana[] = []
  const lagg = (b: Bana) => banor.push(b)
  lagg({ id: 'skickade', d: rekt(0, Y0, NOD, kallaSlut - Y0), slag: 'nod', etikett: t.lbl.skickade, ruta: { rubrik: 'Skickade', rad: `${f.skickade} ${typOrd(p.typ, f.skickade)}`, x: 16, y: Y0 - 8 } })
  if (f.signerade > 0) {
    lagg({ id: 'signerade', d: ribbonH(NOD, sS[0], sS[1], XS, sS[0], sS[1]), slag: 'fram', etikett: t.lbl.signerade, ruta: { rubrik: 'Signerade', rad: t.rad(f.signerade), x: XS - 270, y: sS[1] + 6 } })
    lagg({ id: 'signerade-nod', d: rekt(XS, sS[0], NOD, sS[1] - sS[0]), slag: 'nod', etikett: t.lbl.signerade, ruta: { rubrik: 'Signerade', rad: t.rad(f.signerade), x: XS - 270, y: sS[1] + 6 } })
    const bokH = f.bokade * U
    if (f.bokade > 0) {
      lagg({ id: 'bokad', d: rekt(XS + NOD + GAP, sS[0], W - XS - NOD - GAP, bokH), slag: 'bokad', etikett: t.lbl.bokad, ruta: { rubrik: 'Bokade', rad: `${f.bokade} av ${f.signerade} signerade`, x: XS + 20, y: sS[1] + 6 } })
    }
    const ejTop = sS[0] + bokH + (f.bokade > 0 ? GAP : 0)
    if (sS[1] - ejTop > 0) {
      lagg({ id: 'ejmatt', d: rekt(XS + NOD + GAP, ejTop, W - XS - NOD - GAP, sS[1] - ejTop), slag: 'ejmatt', etikett: t.lbl.ejmatt, ruta: { rubrik: 'Efter signeringen', rad: efterText(p.typ), x: XS + 20, y: sS[1] + 6 } })
    }
  }
  if (f.vantar > 0) lagg({ id: 'vantar', d: ribbonH(NOD, sV[0], sV[1], XS, vTop, vBot), slag: 'vantar', etikett: t.lbl.vantar, ruta: { rubrik: 'Väntar på svar', rad: t.rad(f.vantar), x: XS - 270, y: vBot + 6 } })
  if (f.forfoll > 0) lagg({ id: 'forfoll', d: ribbonH(NOD, sF[0], sF[1], XL, fTop, fBot), slag: 'bort', etikett: t.lbl.forfoll, ruta: { rubrik: 'Förföll', rad: t.rad(f.forfoll), x: XL + 200, y: fTop - 4 } })
  if (f.raderades > 0) lagg({ id: 'raderades', d: ribbonH(NOD, sR[0], sR[1], XL, rTop, rBot), slag: 'bort', etikett: t.lbl.raderades, ruta: { rubrik: 'Raderades', rad: t.rad(f.raderades), x: XL + 200, y: rTop - 4 } })
  if (f.annat > 0) lagg({ id: 'annat', d: ribbonH(NOD, sA[0], sA[1], XL, aTop, aBot), slag: 'bort', etikett: t.lbl.annat, ruta: { rubrik: 'Avslutades utan signering', rad: t.rad(f.annat), x: XL + 200, y: aTop - 4 } })

  const bandHojd = sS[1] - sS[0]
  const etiketter = (
    <>
      <Etikett x={0} y={0} w={XL - 16}><StegRubrik namn="Skickade" tal={f.skickade} under={t.skickadeUnder} /></Etikett>
      <Etikett x={XS} y={0} w={190}><StegRubrik namn="Signerade" tal={f.signerade} under={t.signeradeUnder} /></Etikett>
      {efterBred && (
        <Etikett x={XS + 196} y={0} w={W - XS - 196}>
          <p className="text-sm font-semibold text-slate-300">Efter signeringen</p>
          <p className="mt-1 text-sm leading-snug text-slate-400">{efterKort(p.typ)}</p>
        </Etikett>
      )}
      {f.signerade > 0 && bandHojd >= 44 && (
        <Etikett x={Math.round(W * 0.16)} y={sS[0] + Math.max(6, bandHojd / 2 - 22)} w={Math.round(W * 0.36)}>
          <p className="text-[15px] font-bold leading-snug" style={{ color: BRAND_TEXT }}>
            <span className="font-mono">{f.signerade}</span> av <span className="font-mono">{f.skickade}</span> signerades
          </p>
          {f.medianSignerad !== null && (
            <p className="flex items-center gap-1.5 text-sm font-medium" style={{ color: BRAND_TEXT }}>
              <Icon name="allman.klocka" size={16} />
              hälften inom <span className="font-mono font-bold">{tidText(f.medianSignerad)}</span>
            </p>
          )}
        </Etikett>
      )}
      {f.signerade > 0 && bandHojd >= 30 && W - XS > 220 && (
        <Etikett x={XS + NOD + 18} y={sS[0] + (f.bokade * U) + Math.max(4, (bandHojd - f.bokade * U) / 2 - 12)} w={Math.min(320, W - XS - 30)}>
          <p className="inline-flex rounded-lg bg-slate-900/90 px-2.5 py-1 text-sm font-semibold text-white">
            {f.bokade > 0 ? `${f.bokade} bokade, resten mäts inte än` : 'Mäts inte än'}
          </p>
        </Etikett>
      )}
      {f.vantar > 0 && <GrenEtikett x={XS + NOD + 18} y={vTop - 2} w={Math.max(160, W - XS - 30)} rubrik={`${f.vantar} väntar på svar`} text="Fristen är inte ute" />}
      {f.forfoll > 0 && <GrenEtikett x={XL + 12} y={fTop - 4} w={W - XL - 20} rubrik={`${f.forfoll} förföll`} text="Fristen gick ut" />}
      {f.raderades > 0 && <GrenEtikett x={XL + 12} y={rTop - 6} w={W - XL - 20} rubrik={`${f.raderades} raderades`} text="Togs bort i Oneflow innan signering" />}
      {f.annat > 0 && <GrenEtikett x={XL + 12} y={aTop - 6} w={W - XL - 20} rubrik={`${f.annat} avslutades utan signering`} text="Annat slutläge i Oneflow" />}
    </>
  )
  const under = !efterBred ? <p className="mt-2 text-sm leading-snug text-slate-400">{efterText(p.typ)}</p> : null
  return { h: H, banor, etiketter, under }
}

// ─── Telefon: uppifrån och ned ───

function lodrat(p: Props, W: number) {
  const f = p.flode
  const t = texter(p)
  const U = Math.min(13, (W * 0.42) / f.skickade)
  const Y0 = 64
  const YB = Y0 + NOD
  const [xS, xV, xF, xR, xA] = stapla(0, [f.signerade, f.vantar, f.forfoll, f.raderades, f.annat], U)
  const XR = Math.max(xS[1], xV[1], xF[1], xR[1], xA[1])
  const XS = xS[1]
  const XE = Math.min(Math.max(XR + 40, W * 0.45), W - 150)

  // Grenar böjer av åt höger, den längst till höger först
  let nasta = YB + 56
  const gren = (n: number) => {
    if (n <= 0) return [nasta, nasta] as [number, number]
    const top = nasta
    const bot = top + n * U
    nasta = Math.max(top + 50, bot + 16)
    return [top, bot] as [number, number]
  }
  const [aTop, aBot] = gren(f.annat)
  const [rTop, rBot] = gren(f.raderades)
  const [fTop, fBot] = gren(f.forfoll)
  const [vTop, vBot] = gren(f.vantar)
  const YS = Math.max(nasta + 110, YB + 200)
  const YE = YS + NOD + 150
  const H = YE + 12

  const banor: Bana[] = []
  const lagg = (b: Bana) => banor.push(b)
  const rx = Math.min(XS + 18, W - 260)
  lagg({ id: 'skickade', d: rekt(0, Y0, XR, NOD), slag: 'nod', etikett: t.lbl.skickade, ruta: { rubrik: 'Skickade', rad: `${f.skickade} ${typOrd(p.typ, f.skickade)}`, x: 0, y: Y0 + 14 } })
  if (f.signerade > 0) {
    lagg({ id: 'signerade', d: rekt(0, YB, XS, YS - YB), slag: 'fram', etikett: t.lbl.signerade, ruta: { rubrik: 'Signerade', rad: t.rad(f.signerade), x: rx, y: YS - 120 } })
    lagg({ id: 'signerade-nod', d: rekt(0, YS, XS, NOD), slag: 'nod', etikett: t.lbl.signerade, ruta: { rubrik: 'Signerade', rad: t.rad(f.signerade), x: rx, y: YS - 120 } })
    const bokW = f.bokade * U
    if (f.bokade > 0) lagg({ id: 'bokad', d: rekt(0, YS + NOD + GAP, bokW, YE - YS - NOD - GAP), slag: 'bokad', etikett: t.lbl.bokad, ruta: { rubrik: 'Bokade', rad: `${f.bokade} av ${f.signerade} signerade`, x: rx, y: YS + 20 } })
    const ejX = bokW + (f.bokade > 0 ? GAP : 0)
    if (XS - ejX > 0) lagg({ id: 'ejmatt', d: rekt(ejX, YS + NOD + GAP, XS - ejX, YE - YS - NOD - GAP), slag: 'ejmatt', etikett: t.lbl.ejmatt, ruta: { rubrik: 'Efter signeringen', rad: efterText(p.typ), x: rx, y: YS + 20 } })
  }
  const grenRuta = (rubrik: string, n: number, y: number) => ({ rubrik, rad: t.rad(n), x: Math.max(0, XE - 120), y: y + 44 })
  if (f.annat > 0) lagg({ id: 'annat', d: ribbonVH(YB, xA[0], xA[1], XE, aTop, aBot), slag: 'bort', etikett: t.lbl.annat, ruta: grenRuta('Avslutades utan signering', f.annat, aTop) })
  if (f.raderades > 0) lagg({ id: 'raderades', d: ribbonVH(YB, xR[0], xR[1], XE, rTop, rBot), slag: 'bort', etikett: t.lbl.raderades, ruta: grenRuta('Raderades', f.raderades, rTop) })
  if (f.forfoll > 0) lagg({ id: 'forfoll', d: ribbonVH(YB, xF[0], xF[1], XE, fTop, fBot), slag: 'bort', etikett: t.lbl.forfoll, ruta: grenRuta('Förföll', f.forfoll, fTop) })
  if (f.vantar > 0) lagg({ id: 'vantar', d: ribbonVH(YB, xV[0], xV[1], XE, vTop, vBot), slag: 'vantar', etikett: t.lbl.vantar, ruta: grenRuta('Väntar på svar', f.vantar, vTop) })

  const lw = W - XE - 10
  const sidoW = W - XS - 18
  const etiketter = (
    <>
      <Etikett x={0} y={0} w={W}>
        <p className="flex items-baseline gap-2.5">
          <span className="text-sm font-semibold text-slate-300">Skickade</span>
          <span className="font-mono text-[30px] font-bold leading-none text-white tabular-nums">{f.skickade}</span>
        </p>
        {t.skickadeUnder && <p className="mt-0.5 text-sm text-slate-400">{t.skickadeUnder}</p>}
      </Etikett>
      {f.annat > 0 && <GrenEtikett x={XE + 10} y={aTop - 8} w={lw} rubrik={`${f.annat} avslutades utan signering`} text="Annat slutläge i Oneflow" />}
      {f.raderades > 0 && <GrenEtikett x={XE + 10} y={rTop - 8} w={lw} rubrik={`${f.raderades} raderades`} text="Togs bort i Oneflow" />}
      {f.forfoll > 0 && <GrenEtikett x={XE + 10} y={fTop - 4} w={lw} rubrik={`${f.forfoll} förföll`} text="Fristen gick ut" />}
      {f.vantar > 0 && <GrenEtikett x={XE + 10} y={vTop - 2} w={lw} rubrik={`${f.vantar} väntar på svar`} text="Fristen är inte ute" />}
      {f.signerade > 0 && XS >= 72 && (
        <Etikett x={0} y={Math.round((Math.max(vBot, fBot, rBot, aBot, YB) + YS) / 2) - 20} w={XS}>
          <p className="text-center font-mono text-xl font-bold" style={{ color: BRAND_TEXT }}>{t.sig} %</p>
          <p className="text-center text-[13px] font-medium" style={{ color: BRAND_TEXT }}>signerades</p>
        </Etikett>
      )}
      {f.medianSignerad !== null && (
        <Etikett x={XS + 18} y={YS - 76} w={sidoW}>
          <p className="flex items-center gap-1.5 text-sm text-slate-300">
            <Icon name="allman.klocka" size={16} className="text-slate-400" />
            Hälften inom <span className="font-mono font-bold text-white">{tidText(f.medianSignerad)}</span>
          </p>
          <p className="text-sm text-slate-400">efter utskicket</p>
        </Etikett>
      )}
      <Etikett x={XS + 18} y={YS - 20} w={sidoW}>
        <p className="flex items-baseline gap-2.5">
          <span className="text-sm font-semibold text-slate-300">Signerade</span>
          <span className="font-mono text-[30px] font-bold leading-none text-white tabular-nums">{f.signerade}</span>
        </p>
        <p className="mt-0.5 text-sm text-slate-400">{t.signeradeUnder}</p>
      </Etikett>
      {f.signerade > 0 && (
        <Etikett x={XS + 18} y={YS + 52} w={sidoW}>
          <p className="text-sm font-semibold text-white">Efter signeringen{f.bokade > 0 ? `, ${f.bokade} bokade` : ''}</p>
          <p className="mt-0.5 text-sm leading-snug text-slate-400">{efterText(p.typ)}</p>
        </Etikett>
      )}
    </>
  )
  return { h: H, banor, etiketter, under: null }
}

// ─── Teckenförklaring och tabellvy ───

function Prov({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <span aria-hidden="true" className={`inline-block w-[22px] h-3 rounded-[3px] flex-shrink-0 ${className}`} style={style} />
}

export function FlodeTeckenforklaring({ bokade }: { bokade: boolean }) {
  return (
    <div aria-label="Teckenförklaring" className="grid grid-cols-2 gap-x-3 gap-y-2 sm:flex sm:flex-wrap sm:items-center sm:gap-5 text-sm text-slate-300">
      <span className="inline-flex items-center gap-2"><Prov style={{ background: BRAND }} />{bokade ? 'Signerade och bokade' : 'Signerade'}</span>
      <span className="inline-flex items-center gap-2"><Prov className="border-[1.5px] border-dashed" style={{ background: 'rgba(32,197,143,.28)', borderColor: BRAND }} />Väntar på svar</span>
      <span className="inline-flex items-center gap-2"><Prov className="bg-slate-500" />Föll bort</span>
      <span className="inline-flex items-center gap-2"><Prov className="border border-dashed border-slate-500 bg-[repeating-linear-gradient(45deg,var(--color-slate-800)_0_3px,var(--color-slate-700)_3px_6px)]" />Mäts inte än</span>
    </div>
  )
}

export function FlodeTabell({ flode: f, foreSkickade }: { flode: Flode; foreSkickade: number | null }) {
  const rader: Array<[string, number, string, boolean]> = [
    ['Skickade', f.skickade, foreSkickade !== null ? `Perioden före ${foreSkickade}` : 'Ingen jämförelse', true],
    ['Signerade', f.signerade, `${pct(f.signerade, f.skickade)} % av skickade${f.medianSignerad !== null ? `, hälften inom ${tidText(f.medianSignerad)}` : ''}`, true],
  ]
  if (f.bokade > 0) rader.push(['Bokade', f.bokade, `Av de signerade, via Boka in`, false])
  rader.push(['Väntar på svar', f.vantar, 'Fristen är inte ute', false])
  rader.push(['Förföll', f.forfoll, f.medianForfoll !== null ? `Fristen gick ut, i mitten efter ${tidText(f.medianForfoll)}` : 'Fristen gick ut', false])
  rader.push(['Raderades', f.raderades, 'Togs bort i Oneflow innan signering', false])
  if (f.annat > 0) rader.push(['Avslutades utan signering', f.annat, 'Annat slutläge i Oneflow', false])
  return (
    <details className="group">
      <summary className="list-none cursor-pointer min-h-[44px] inline-flex items-center gap-2 text-sm font-semibold text-[#20c58f] rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] [&::-webkit-details-marker]:hidden">
        <Icon name="allman.lista" size={16} />
        <span className="group-open:hidden">Visa flödet som tabell</span>
        <span className="hidden group-open:inline">Dölj tabellen</span>
      </summary>
      <div className="mt-1 overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-sm text-white">
          <thead>
            <tr className="text-slate-400">
              <th scope="col" className="pb-2 pr-3 text-left font-semibold">Steg</th>
              <th scope="col" className="pb-2 px-3 text-right font-semibold">Antal</th>
              <th scope="col" className="pb-2 pl-3 text-left font-semibold">Andel och tid</th>
            </tr>
          </thead>
          <tbody>
            {rader.map(([steg, antal, text, fet]) => (
              <tr key={steg} className="border-t border-slate-700/60">
                <th scope="row" className={`py-2 pr-3 text-left ${fet ? 'font-semibold' : 'font-medium'}`}>{steg}</th>
                <td className="py-2 px-3 text-right font-mono font-bold tabular-nums">{antal}</td>
                <td className="py-2 pl-3 text-slate-400">{text}</td>
              </tr>
            ))}
            <tr className="border-t border-slate-700/60">
              <th scope="row" className="py-2 pr-3 text-left font-medium">Efter signeringen</th>
              <td className="py-2 px-3 text-right text-slate-400">Mäts inte än</td>
              <td className="py-2 pl-3 text-slate-400">Utförd, fakturerad och betald</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  )
}
