// src/pages/shared/intranet/guider/_sok.tsx
// Delade delar för guiderna om sökrutan (guide-sokrutan-tekniker, guide-sokrutan-kontor och guide-sokrutan-saljare).
// Efterbildning av GlobalSearch.tsx: sökfältet med platshållaren "Sök ärende, kund, org.nr,
// telefon eller sida", tolkningen "tolkas som …", grupperna ur GROUP_LABELS, raderna med
// ikonplattan (SearchIconTile, samma som portalen), snabbvalen under den markerade raden och
// foten "↑ ↓ välj · Enter öppna · Tab fler val". Påhittade kunder, ingenting söks på riktigt.

import { Icon } from '../../../../components/icons/Icon'
import { SearchIconTile, type SearchIconName, type SearchTone } from '../../../../components/shared/search/SearchIcons'
import { GROUP_LABELS, KIND_LABELS, type GroupKey, type QueryKind } from '../../../../components/shared/search/searchModel'
import { Markor, type MarkorProps } from '../skarmkit'

/** Samma punktfärger som DOT_CLASSES i GlobalSearch */
const PUNKT = { ok: 'bg-emerald-500', info: 'bg-sky-400', warn: 'bg-amber-400', bad: 'bg-red-400', faint: 'bg-slate-500' } as const

export interface SokTraff {
  id: string
  ikon: SearchIconName
  ton: SearchTone
  titel: string
  nr?: string
  status?: { text: string; ton: keyof typeof PUNKT }
  meta?: string
  /** Till höger på raden (syns bara på datorn) */
  typ: string
  /** Snabbvalen. Det första är radens huvudval (Enter). */
  val: string[]
}

export interface SokGrupp {
  key: GroupKey
  rader: SokTraff[]
}

export type Mk = (id: string) => MarkorProps | undefined

/** Ett tryck i sökrutan: falt, stang, pil-ner, pil-upp, rad:<id>, val:<id>:<etikett>, guide */
export type Tryck = (id: string) => void

export const SCOPE_TEXT = {
  technician: 'Dina ärenden och ärenden du delar',
  koordinator: 'Alla ärenden',
  admin: 'Allt',
  säljare: 'Kunder, dokument och webbleads',
} as const

function Rad({ r, vald, tryck, mk, onHover, visaTyp }: { r: SokTraff; vald: boolean; tryck: Tryck; mk: Mk; onHover?: (id: string) => void; visaTyp: boolean }) {
  return (
    <div>
      <Markor markor={mk(`rad:${r.id}`)} block>
        <button type="button" onClick={() => tryck(`rad:${r.id}`)} onMouseEnter={() => onHover?.(r.id)}
          className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left ${vald ? 'bg-[#20c58f]/10' : 'hover:bg-slate-800/60'}`}>
          <SearchIconTile name={r.ikon} tone={r.ton} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[12.5px] text-white">
              {r.nr && <span className="mr-1.5 font-mono text-[11.5px] text-slate-400">{r.nr}</span>}
              {r.titel}
            </span>
            {(r.status || r.meta) && (
              <span className="truncate text-[11px] text-slate-400">
                {r.status && <><i className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-[1px] ${PUNKT[r.status.ton]}`} />{r.status.text}{r.meta ? ' · ' : ''}</>}
                {r.meta}
              </span>
            )}
          </span>
          {visaTyp && <span className="whitespace-nowrap text-[11px] text-slate-500">{r.typ}</span>}
        </button>
      </Markor>
      {vald && r.val.length > 1 && (
        <div className="flex flex-wrap gap-1.5 pb-1.5 pl-[48px] pr-2 pt-0.5">
          {r.val.map((v, i) => (
            <Markor key={v} markor={mk(`val:${r.id}:${v}`)}>
              <button type="button" onClick={() => tryck(`val:${r.id}:${v}`)}
                className={`rounded-md border px-2 py-[3px] text-[11px] ${i === 0 ? 'border-[#20c58f]/70 bg-[#20c58f]/10 text-white' : 'border-slate-700 bg-slate-900 text-slate-300'}`}>
                {v}
              </button>
            </Markor>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Söklådan. mobil = helskärm med Stäng och tolkningen under fältet,
 * annars rutan i mitten med Esc, tolkningen till höger och foten med tangenterna.
 */
export function SokLada({ mobil, fraga, tolkas, grupper, aktiv, tryck, mk, onHover, scope }: {
  mobil: boolean
  /** Det som står i fältet. Tomt = platshållaren och Senast öppnade. */
  fraga: string
  tolkas?: QueryKind
  grupper: SokGrupp[]
  /** id på den markerade raden (standard: första raden) */
  aktiv?: string
  tryck: Tryck
  mk: Mk
  onHover?: (id: string) => void
  scope: string
}) {
  const forsta = grupper[0]?.rader[0]?.id
  const markerad = aktiv ?? forsta
  const hint = tolkas ? `tolkas som ${KIND_LABELS[tolkas]}` : ''

  const falt = (
    <div className="flex items-center gap-2 border-b border-slate-700/70 px-3 py-2.5">
      <Icon name="sok.glas" size={20} strokeWidth={1.8} className="h-4 w-4 flex-none text-slate-500" />
      <Markor markor={mk('falt')} block>
        <button type="button" onClick={() => tryck('falt')}
          className={`block w-full min-w-0 truncate text-left text-[13px] ${fraga ? 'text-white' : 'text-slate-500'}`}>
          {fraga || 'Sök ärende, kund, org.nr, telefon eller sida'}
        </button>
      </Markor>
      {!mobil && hint && <span className="whitespace-nowrap font-mono text-[10.5px] text-slate-500">{hint}</span>}
      {mobil
        ? <button type="button" onClick={() => tryck('stang')} className="px-1.5 text-[12px] text-slate-400">Stäng</button>
        : <button type="button" onClick={() => tryck('stang')} className="rounded border border-slate-700 px-1 font-mono text-[10.5px] text-slate-500">Esc</button>}
    </div>
  )

  const lista = (
    <div className="flex-1 overflow-hidden px-1 pb-2 pt-1">
      {mobil && hint && <p className="px-2.5 pb-0.5 pt-1.5 font-mono text-[10.5px] text-slate-500">{hint}</p>}
      {grupper.map(g => (
        <div key={g.key}>
          <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{GROUP_LABELS[g.key]}</p>
          {g.rader.map(r => <Rad key={r.id} r={r} vald={r.id === markerad} tryck={tryck} mk={mk} onHover={onHover} visaTyp={!mobil} />)}
        </div>
      ))}
      {!fraga && (
        <button type="button" onClick={() => tryck('guide')} className="w-full px-2 pb-1 pt-2.5 text-left text-[11px] text-slate-500">
          Ny här? Så fungerar sökningen
        </button>
      )}
    </div>
  )

  if (mobil) {
    return (
      <div className="absolute inset-0 z-20 flex flex-col bg-slate-900">
        {falt}
        {lista}
      </div>
    )
  }

  const kbd = 'rounded border border-slate-700 px-1 font-mono text-[10.5px] text-slate-400'
  return (
    <div className="absolute inset-0 z-20 flex items-start justify-center bg-black/60 px-3 pt-6">
      <div className="flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        {falt}
        {lista}
        <div className="flex flex-wrap justify-between gap-3 border-t border-slate-700/70 px-3 py-2 text-[11px] text-slate-500">
          <span className="flex flex-wrap items-center gap-1">
            <button type="button" onClick={() => tryck('pil-upp')} className={kbd} aria-label="Pil upp">↑</button>
            <Markor markor={mk('pil-ner')}>
              <button type="button" onClick={() => tryck('pil-ner')} className={kbd} aria-label="Pil ned">↓</button>
            </Markor>
            välj · <span className={kbd}>Enter</span> öppna · <span className={kbd}>Tab</span> fler val
          </span>
          <span>{scope}</span>
        </div>
      </div>
    </div>
  )
}
