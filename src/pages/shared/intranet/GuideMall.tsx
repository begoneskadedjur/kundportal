// src/pages/shared/intranet/GuideMall.tsx
// Guidemallen (godkänd 2026-10-16): rendering av mallens åtta delar och mallkollen.
//   1 intro  2 kortsvar  3 visning  4 felsok  5 bra  6 ovning  7 quiz  8 avslut
// Delarna 3 till 8 får en fast rubrik med ikon och ett fast ankare, så att alla
// guider ser likadana ut och innehållsförteckningen blir densamma.

import { Fragment, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from '../../../components/icons/Icon'
import { useRoleBasePath } from '../../../hooks/useRoleBasePath'
import type { GuideFraga, GuideRoll, GuideSteg, IntranetBlock } from '../../../types/intranet'
import { GUIDE_MODULER } from './guider/registry'

export const GUIDE_DELAR = {
  visning: { id: 'gor-sa-har', titel: 'Gör så här', ikon: 'guide.steg' },
  felsok: { id: 'blev-det-fel', titel: 'Blev det inte som du tänkt?', ikon: 'guide.felsok' },
  bra: { id: 'bra-att-veta', titel: 'Bra att veta', ikon: 'guide.bra-att-veta' },
  ovning: { id: 'prova-sjalv', titel: 'Prova själv', ikon: 'guide.prova' },
  quiz: { id: 'kolla-att-du-kan', titel: 'Kolla att du kan', ikon: 'guide.kolla' },
  avslut: { id: 'las-ocksa', titel: 'Läs också', ikon: 'guide.las-ocksa' },
} as const satisfies Record<string, { id: string; titel: string; ikon: IconName }>

export type GuideDelTyp = keyof typeof GUIDE_DELAR

export const ROLL_TEXT: Record<GuideRoll, { text: string; ikon: IconName }> = {
  technician: { text: 'Tekniker', ikon: 'roll.tekniker' },
  koordinator: { text: 'Koordinator', ikon: 'roll.koordinator' },
  admin: { text: 'Admin', ikon: 'roll.admin' },
  'säljare': { text: 'Säljare', ikon: 'roll.saljare' },
}

/** Är dokumentet byggt med guidemallen? */
export function arMallguide(content: IntranetBlock[]): boolean {
  return content.some(b => b.type === 'intro')
}

// ─── Text med knappar ──────────────────────────────

/** [[Knapp]] och [[Knapp|ikon.namn]] blir knappar i texten */
export function MallText({ text }: { text: string }) {
  const delar = text.split(/(\[\[[^\]]+\]\])/g)
  return (
    <>
      {delar.map((d, i) => {
        const m = d.match(/^\[\[([^|\]]+)(?:\|([^\]]+))?\]\]$/)
        if (!m) return <Fragment key={i}>{d}</Fragment>
        const ikon = m[2]?.trim() as IconName | undefined
        return (
          <span key={i} className="mx-0.5 inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-slate-600 bg-slate-800 px-1.5 py-px align-baseline text-[0.92em] font-semibold text-white">
            {ikon && <Icon name={ikon} size={16} className="h-[15px] w-[15px]" />}
            {m[1].trim()}
          </span>
        )
      })}
    </>
  )
}

function Rubrik({ del }: { del: GuideDelTyp }) {
  const d = GUIDE_DELAR[del]
  return (
    <h2 id={d.id} className="mb-3 mt-10 flex scroll-mt-24 items-center gap-2.5 text-lg font-semibold text-white first:mt-0">
      <Icon name={d.ikon} size={24} className="text-[#20c58f]" />
      {d.titel}
    </h2>
  )
}

// ─── 1 och 2 ───────────────────────────────────────

function Intro({ block }: { block: Extract<IntranetBlock, { type: 'intro' }> }) {
  const rutor: { ikon: IconName; rubrik: string; text: ReactNode }[] = [
    {
      ikon: block.roller.length === 1 ? ROLL_TEXT[block.roller[0]].ikon : 'roll.koordinator',
      rubrik: 'För vem',
      text: block.roller.map(r => ROLL_TEXT[r].text).join(' och '),
    },
    { ikon: 'guide.var', rubrik: 'Var', text: <MallText text={block.var} /> },
    { ikon: block.enhet === 'mobil' ? 'guide.mobil' : 'guide.dator', rubrik: 'Tar', text: `${block.tar}, ${block.enhet === 'mobil' ? 'i telefonen' : 'på datorn'}` },
  ]
  if (block.behover) rutor.push({ ikon: 'guide.du-behover', rubrik: 'Du behöver', text: <MallText text={block.behover} /> })
  return (
    <div className="mb-5 grid gap-2 sm:grid-cols-2">
      {rutor.map(r => (
        <div key={r.rubrik} className="flex items-start gap-2.5 rounded-xl bg-slate-800/40 px-3 py-2.5">
          <Icon name={r.ikon} size={20} className="mt-0.5 flex-none text-slate-400" />
          <div className="min-w-0 text-sm text-slate-200">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{r.rubrik}</p>
            {r.text}
          </div>
        </div>
      ))}
    </div>
  )
}

function Kortsvar({ text }: { text: string }) {
  return (
    <div className="my-5 flex gap-3 rounded-xl border border-[#20c58f]/30 bg-[#20c58f]/10 p-4">
      <Icon name="guide.kort-svar" size={24} className="mt-0.5 flex-none text-[#20c58f]" />
      <div>
        <p className="text-sm font-semibold text-white">Kort svar</p>
        <p className="mt-0.5 text-[15px] leading-relaxed text-slate-200"><MallText text={text} /></p>
      </div>
    </div>
  )
}

// ─── 3 Gör så här ──────────────────────────────────

function Visning({ steg, modul }: { steg: GuideSteg[]; modul?: string }) {
  const [aktiv, setAktiv] = useState(0)
  const Skarm = modul ? GUIDE_MODULER[modul]?.Visning : undefined
  const ga = (i: number) => setAktiv(Math.max(0, Math.min(steg.length - 1, i)))
  const sista = aktiv === steg.length - 1
  return (
    <>
      <Rubrik del="visning" />
      {Skarm && <p className="-mt-1 mb-3 text-sm text-slate-400">Tryck på ett steg så visar skärmen hur det ser ut. Den gröna markören visar var du trycker.</p>}
      <div className={`grid items-start gap-5 ${Skarm ? 'lg:grid-cols-[minmax(0,1fr)_auto]' : ''}`}>
        <div>
          <ol className="grid gap-1.5">
            {steg.map((s, i) => (
              <li key={i}>
                <button type="button" onClick={() => setAktiv(i)} aria-current={Skarm && i === aktiv ? 'step' : undefined}
                  className={`grid w-full grid-cols-[32px_1fr] gap-3 rounded-xl border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${Skarm && i === aktiv ? 'border-[#20c58f]/60 bg-slate-800/60' : 'border-transparent hover:bg-slate-800/40'}`}>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-sm font-bold ${Skarm && i === aktiv ? 'border-[#20c58f] bg-[#20c58f] text-[#fff]' : 'border-[#20c58f]/50 text-[#20c58f]'}`}>{i + 1}</span>
                  <span className="grid gap-0.5">
                    <span className="text-[15px] leading-relaxed text-slate-200"><MallText text={s.text} /></span>
                    {s.ser && <span className="text-sm text-slate-400"><MallText text={s.ser} /></span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          {Skarm && (
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => ga(aktiv - 1)} disabled={aktiv === 0}
                className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-40">
                Föregående
              </button>
              <button type="button" onClick={() => (sista ? setAktiv(0) : ga(aktiv + 1))}
                className="rounded-lg bg-[#20c58f] px-3 py-1.5 text-sm font-semibold text-[#fff] hover:bg-[#1ab37e]">
                {sista ? 'Börja om' : 'Nästa steg'}
              </button>
            </div>
          )}
        </div>
        {Skarm && (
          <div className="min-w-0 lg:sticky lg:top-24">
            <Skarm steg={aktiv} onNasta={() => !sista && ga(aktiv + 1)} />
            <p className="mt-2 text-center text-xs text-slate-500">Steg {aktiv + 1} av {steg.length}</p>
          </div>
        )}
      </div>
    </>
  )
}

// ─── 4 och 5 ───────────────────────────────────────

function Felsok({ items }: { items: { fraga: string; svar: string }[] }) {
  return (
    <>
      <Rubrik del="felsok" />
      <div className="grid gap-2">
        {items.map((it, i) => (
          <details key={i} className="group rounded-xl border border-slate-700 bg-slate-800/30">
            <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3.5 py-3 text-[15px] font-medium text-white">
              <Icon name="guide.felsok" size={20} className="flex-none text-amber-400" />
              <span className="flex-1"><MallText text={it.fraga} /></span>
              <Icon name="allman.chevron" size={16} className="flex-none text-slate-500 transition-transform group-open:rotate-90" />
            </summary>
            <p className="px-3.5 pb-3.5 pl-[46px] text-[15px] leading-relaxed text-slate-300"><MallText text={it.svar} /></p>
          </details>
        ))}
      </div>
    </>
  )
}

function Bra({ items }: { items: string[] }) {
  return (
    <>
      <Rubrik del="bra" />
      <ul className="grid gap-2">
        {items.map((t, i) => (
          <li key={i} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-slate-300">
            <span className="mt-2.5 h-1.5 w-1.5 flex-none rounded-full bg-[#20c58f]" />
            <span><MallText text={t} /></span>
          </li>
        ))}
      </ul>
    </>
  )
}

// ─── 6 Prova själv ─────────────────────────────────

function Ovning({ uppdrag, modul }: { uppdrag: string; modul?: string }) {
  const Komponent = modul ? GUIDE_MODULER[modul]?.Ovning : undefined
  return (
    <>
      <Rubrik del="ovning" />
      <div className="mb-3 flex gap-3 rounded-xl bg-slate-800/40 p-3.5">
        <Icon name="guide.prova" size={20} className="mt-0.5 flex-none text-[#20c58f]" />
        <p className="text-[15px] leading-relaxed text-slate-200"><span className="font-semibold text-white">Uppdrag: </span><MallText text={uppdrag} /></p>
      </div>
      {Komponent ? <Komponent /> : <p className="text-sm text-slate-500">Övningen laddas inte. Kontakta admin.</p>}
      <p className="mt-2 text-xs text-slate-500">Övning med påhittade kunder. Ingenting sparas.</p>
    </>
  )
}

// ─── 7 Kolla att du kan ────────────────────────────

function Quiz({ fragor }: { fragor: GuideFraga[] }) {
  const [svar, setSvar] = useState<Record<number, number>>({})
  const antalRatt = fragor.filter((f, i) => svar[i] === f.ratt).length
  const allaSvarade = Object.keys(svar).length === fragor.length
  return (
    <>
      <Rubrik del="quiz" />
      <div className="grid gap-3">
        {fragor.map((f, i) => {
          const valt = svar[i]
          return (
            <div key={i} className="grid gap-2.5 rounded-xl border border-slate-700 bg-slate-800/30 p-3.5">
              <p className="text-[15px] font-semibold text-white">{i + 1}. <MallText text={f.fraga} /></p>
              <div className="grid gap-1.5">
                {f.alternativ.map((a, j) => {
                  const stil = valt === undefined
                    ? 'border-slate-700 hover:border-[#20c58f]/60'
                    : j === f.ratt && valt === j ? 'border-[#20c58f] bg-[#20c58f]/10'
                    : j === valt ? 'border-red-500/60 bg-red-500/10' : 'border-slate-700 opacity-70'
                  return (
                    <button key={j} type="button" onClick={() => setSvar(s => ({ ...s, [i]: j }))}
                      className={`rounded-lg border px-3 py-2 text-left text-[15px] text-slate-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20c58f] ${stil}`}>
                      <MallText text={a} />
                    </button>
                  )
                })}
              </div>
              {valt !== undefined && (
                <p className={`text-sm leading-relaxed ${valt === f.ratt ? 'text-[#20c58f]' : 'text-red-300'}`} role="status">
                  {valt === f.ratt ? 'Rätt. ' : 'Inte riktigt. '}<span className="text-slate-300"><MallText text={f.forklaring} /></span>
                </p>
              )}
            </div>
          )
        })}
        {allaSvarade && (
          <p className={`rounded-xl p-3 text-sm font-semibold ${antalRatt === fragor.length ? 'bg-[#20c58f]/10 text-[#20c58f]' : 'bg-slate-800/40 text-slate-200'}`}>
            {antalRatt === fragor.length ? `Alla ${fragor.length} rätt. Du kan det här.` : `${antalRatt} av ${fragor.length} rätt. Läs förklaringarna och prova igen.`}
          </p>
        )}
      </div>
    </>
  )
}

// ─── 8 Läs också ───────────────────────────────────

function Avslut({ lankar, fraga }: { lankar: { slug: string; label: string; description?: string }[]; fraga: string }) {
  const basePath = useRoleBasePath()
  return (
    <>
      <Rubrik del="avslut" />
      <div className="grid gap-2 sm:grid-cols-2">
        {lankar.map(l => (
          <Link key={l.slug} to={`${basePath}/intranat/dokument/${l.slug}`}
            className="group flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/40 p-3.5 transition-colors hover:border-[#20c58f]/50">
            <Icon name="guide.las-ocksa" size={20} className="flex-none text-[#20c58f]" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-white group-hover:text-[#20c58f]">{l.label}</span>
              {l.description && <span className="block text-xs text-slate-400">{l.description}</span>}
            </span>
            <Icon name="allman.chevron" size={16} className="flex-none text-slate-500" />
          </Link>
        ))}
        <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/20 p-3.5">
          <Icon name="guide.fraga" size={20} className="flex-none text-[#20c58f]" />
          <span className="min-w-0 text-sm text-slate-300"><span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Fråga</span><MallText text={fraga} /></span>
        </div>
      </div>
    </>
  )
}

// ─── Inkoppling i dokumentläsaren ──────────────────

/** Renderar ett av mallens block, annars null (då tar den vanliga renderaren över) */
export function MallBlock({ block, slug }: { block: IntranetBlock; slug: string }) {
  switch (block.type) {
    case 'intro': return <Intro block={block} />
    case 'kortsvar': return <Kortsvar text={block.text} />
    case 'visning': return <Visning steg={block.steg} modul={block.modul ?? slug} />
    case 'felsok': return <Felsok items={block.items} />
    case 'bra': return <Bra items={block.items} />
    case 'ovning': return <Ovning uppdrag={block.uppdrag} modul={block.modul ?? slug} />
    case 'quiz': return <Quiz fragor={block.fragor} />
    case 'avslut': return <Avslut lankar={block.lankar} fraga={block.fraga} />
    default: return null
  }
}

/** Mallens delar som rubriker för innehållsförteckningen */
export function mallToc(content: IntranetBlock[]): { id: string; text: string }[] {
  return content
    .filter((b): b is Extract<IntranetBlock, { type: GuideDelTyp }> => b.type in GUIDE_DELAR)
    .map(b => ({ id: GUIDE_DELAR[b.type as GuideDelTyp].id, text: GUIDE_DELAR[b.type as GuideDelTyp].titel }))
}

const ORDNING = ['intro', 'kortsvar', 'visning', 'felsok', 'bra', 'ovning', 'quiz', 'avslut'] as const
const KRAVS = ['intro', 'kortsvar', 'visning', 'ovning', 'quiz', 'avslut'] as const

/** Mallkoll: vad som saknas eller bryter mot mallen. Tom lista = allt i ordning. */
export function kollaMall(content: IntranetBlock[], slug: string): string[] {
  const fel: string[] = []
  const typer = content.map(b => b.type)
  for (const k of KRAVS) if (!typer.includes(k)) fel.push(`Delen ${k} saknas.`)
  const delar = typer.filter((t): t is (typeof ORDNING)[number] => (ORDNING as readonly string[]).includes(t))
  for (let i = 1; i < delar.length; i++) {
    if (ORDNING.indexOf(delar[i]) < ORDNING.indexOf(delar[i - 1])) { fel.push(`Delen ${delar[i]} ligger före ${delar[i - 1]} i mallen.`); break }
  }
  for (const b of content) {
    if (b.type === 'visning') {
      if (b.steg.length > 7) fel.push(`Gör så här har ${b.steg.length} steg, högst 7. Dela guiden.`)
      if (!GUIDE_MODULER[b.modul ?? slug]?.Visning) fel.push('Visningen saknar skärm i guidemodulen.')
    }
    if (b.type === 'bra' && b.items.length > 5) fel.push(`Bra att veta har ${b.items.length} punkter, högst 5.`)
    if (b.type === 'quiz' && (b.fragor.length < 2 || b.fragor.length > 3)) fel.push(`Kolla att du kan har ${b.fragor.length} frågor, ska vara 2 eller 3.`)
    if (b.type === 'quiz') b.fragor.forEach((f, i) => { if (f.ratt < 0 || f.ratt >= f.alternativ.length) fel.push(`Fråga ${i + 1} pekar på ett svar som inte finns.`) })
    if (b.type === 'ovning' && !GUIDE_MODULER[b.modul ?? slug]?.Ovning) fel.push('Övningen saknas i guidemodulen.')
    if (b.type === 'avslut' && b.lankar.length > 3) fel.push(`Läs också har ${b.lankar.length} länkar, högst 3.`)
  }
  return fel
}
