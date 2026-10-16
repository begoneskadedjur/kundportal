// src/pages/shared/intranet/guider/_fakturering.tsx
// Delade skärmdelar för guiderna om återbesök och fakturering (guidemallen 2026-10-16):
// guide-aterbesok-kontor, guide-delfakturering, guide-aterbesok-avtal,
// guide-fakturering och guide-fakturering-kontor. Ingen guidemodul (filen börjar med _).
//
// Etiketterna är ordagrant desamma som i portalen:
// - Vad vill du göra?: EditCaseModal (privat/företag) och EditContractCaseModal (avtal)
// - Boka återbesök i två steg: RevisitModal (Datum för återbesök *, Besökslängd,
//   Visa förslag →, Ange tid manuellt, Skapa delfaktura för nuvarande tjänster,
//   Totalt (exkl. moms), Tjänsterna markeras som fakturerade och tas bort från ärendet.,
//   Inga ofakturerade tjänster på ärendet, ← Byt datum, Boka återbesök)
// - Tjänster & fakturarader, Inga tjänster tillagda än, Inkl. moms / Exkl. moms: CaseServiceSelector

import type { ReactNode } from 'react'
import { Ark, Falt, Kort, Knapprad, Kryssruta, PKnapp, Rad, Val, type MarkorProps } from '../skarmkit'

/** Markör bara på det element som är steg nr i visningen */
export const mk = (markera: string | undefined, id: string, nr: number): MarkorProps | undefined =>
  markera === id ? { pa: true, nr } : undefined

export type Tryck = (id: string) => void

interface Bas {
  tryck: Tryck
  markera?: string
  nr: number
}

/** Fakturarad: namn och belopp som text, t.ex. ['Råttbekämpning', '1 800 kr'] */
export type FRad = [string, string]

/** Liten textknapp i portalens stil (grön, understruken) */
export function TextKnapp({ children, onClick, markor }: { children: ReactNode; onClick: () => void; markor?: MarkorProps }) {
  return (
    <span className={markor?.pa ? 'relative inline-flex rounded-lg ring-[2.5px] ring-[#20c58f] ring-offset-2 ring-offset-slate-900 motion-safe:animate-pulse' : 'inline-flex'}>
      <button type="button" onClick={onClick} className="w-max text-[11.5px] text-[#20c58f] underline">{children}</button>
      {markor?.pa && (
        <span className="pointer-events-none absolute -right-2.5 -top-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#20c58f] text-[11px] font-bold text-[#fff] shadow" aria-hidden>
          {markor.nr}
        </span>
      )}
    </span>
  )
}

// ─── Vad vill du göra? ─────────────────────────────

/** Valrutan bakom fotspåren. avtal = EditContractCaseModal, annars EditCaseModal. */
export function ValArk({ avtal, tryck, markera, nr }: Bas & { avtal?: boolean }) {
  return (
    <Ark titel="Vad vill du göra?">
      <Val
        titel="Boka återbesök"
        text={avtal ? 'Flytta ärendet till ett framtida datum för uppföljning' : 'Flytta ärendet till ett framtida datum för uppföljning av skadedjursstatus'}
        onClick={() => tryck('val-aterbesok')}
        markor={mk(markera, 'val-aterbesok', nr)}
      />
      <Val titel={avtal ? 'Kopiera ärende' : 'Skapa nytt ärende'} text="Nytt problem hos samma kund (annat skadedjur)" onClick={() => tryck('val-nytt')} />
      <Val titel="Duplicera ärende" text="Skapa en kopia och välj vad som följer med" onClick={() => tryck('val-duplicera')} />
      <button type="button" onClick={() => tryck('val-avbryt')} className="py-1 text-xs text-slate-400">Avbryt</button>
    </Ark>
  )
}

// ─── Boka återbesök (privat och företag) ───────────

/** Steg 1 i RevisitModal: Välj datum och längd */
export function RevisitSteg1({ datum, datumText, tryck, markera, nr }: Bas & { datum: boolean; datumText: string }) {
  return (
    <Ark titel="Boka återbesök" under="Välj datum och längd">
      <Falt etikett="Datum för återbesök *" varde={datum ? datumText : 'Välj datum'} tom={!datum} onClick={() => tryck('datum')} markor={mk(markera, 'datum', nr)} />
      <Falt etikett="Besökslängd" varde="1 tim" onClick={() => tryck('langd')} />
      <Knapprad>
        <PKnapp onClick={() => tryck('avbryt')}>Avbryt</PKnapp>
        <PKnapp prim inaktiv={!datum} onClick={() => tryck('visa')} markor={mk(markera, 'visa', nr)}>Visa förslag →</PKnapp>
      </Knapprad>
    </Ark>
  )
}

export interface Tid {
  id: string
  tid: string
  tekniker: string
}

/** Steg 2 i RevisitModal: förslagen, delfakturan och Boka återbesök */
export function RevisitSteg2({ under, tider, tid, delfaktura, rader, total, tryck, markera, nr }: Bas & {
  under: string
  tider: Tid[]
  tid: string | null
  delfaktura: boolean
  /** Tom lista = Inga ofakturerade tjänster på ärendet */
  rader: FRad[]
  total: string
}) {
  return (
    <Ark titel="Boka återbesök" under={under}>
      {tider.map(t => (
        <Val key={t.id} titel={t.tid} text={t.tekniker} vald={tid === t.id} onClick={() => tryck(`tid-${t.id}`)} markor={mk(markera, `tid-${t.id}`, nr)} />
      ))}
      <TextKnapp onClick={() => tryck('manuellt')}>Ange tid manuellt</TextKnapp>
      <div className="grid gap-1 rounded-lg border border-slate-700 bg-slate-800/50 p-2">
        {rader.length === 0 ? (
          <Rad v="Inga ofakturerade tjänster på ärendet" />
        ) : (
          <>
            <Kryssruta pa={delfaktura} text="Skapa delfaktura för nuvarande tjänster" onClick={() => tryck('delfaktura')} markor={mk(markera, 'delfaktura', nr)} />
            {delfaktura && <>
              {rader.map((r, i) => <Rad key={i} v={r[0]} h={r[1]} />)}
              <Rad v="Totalt (exkl. moms)" h={<span className="text-[#20c58f]">{total}</span>} />
              <p className="text-[11px] text-amber-400/80">Tjänsterna markeras som fakturerade och tas bort från ärendet.</p>
            </>}
          </>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => tryck('byt-datum')} className="text-[11.5px] text-slate-400">← Byt datum</button>
        <Knapprad>
          <PKnapp onClick={() => tryck('avbryt')}>Avbryt</PKnapp>
          <PKnapp prim ikon="allman.kalender" inaktiv={!tid} onClick={() => tryck('boka')} markor={mk(markera, 'boka', nr)}>Boka återbesök</PKnapp>
        </Knapprad>
      </div>
    </Ark>
  )
}

// ─── Ekonomi-fliken ────────────────────────────────

/** Kortet Tjänster & fakturarader i Ekonomi-fliken, förenklat */
export function TjansterKort({ rader, summa, privat }: { rader: FRad[]; summa?: string; privat?: boolean }) {
  return (
    <Kort titel="Tjänster & fakturarader" ikon="sok.faktura">
      {rader.length === 0
        ? <p className="py-1 text-center text-[11.5px] text-slate-500">Inga tjänster tillagda än</p>
        : rader.map((r, i) => <Rad key={i} v={r[0]} h={r[1]} />)}
      {rader.length > 0 && summa && (
        <div className="mt-1 border-t border-slate-700/60 pt-1">
          <Rad v={privat ? 'Inkl. moms' : 'Exkl. moms'} h={summa} />
        </div>
      )}
    </Kort>
  )
}
