// src/pages/shared/intranet/interactive/tillagg/TillaggArbetslistan.tsx
// Guiden Besluta och fakturera tilläggsstationer: arbetslistan överst i
// avtalskartan, rad för rad. Läsaren trycker på en rad och ser när den visas
// och vad knapparna gör. Rubriker, ikoner och knappnamn ur ContractWorkList
// och WORK_ITEM_TITLE; instruktionerna ur contract_work_items_internal
// (kontrollerat 2026-11-02). Platt text med statuspunkt, inga piller.

import { useState } from 'react'
import { Icon, type IconName } from '../../../../../components/icons/Icon'
import { WORK_ITEM_TITLE, type WorkItemKind } from '../../../../../shared/contractWorkItems'

interface Rad {
  kind: WorkItemKind
  ikon: IconName
  exempel: string
  nar: string
  knappar: { namn: string; gor: string }[]
}

const RADER: Rad[] = [
  {
    kind: 'coverage_cancelled',
    ikon: 'sok.faktura',
    exempel: 'Faktura INV-202611-0012 makulerades. Ska stationerna faktureras igen eller efterskänkas?',
    nar: 'En faktura som betalade tilläggsstationer har makulerats.',
    knappar: [
      { namn: 'Fakturera igen', gor: 'Dagarna blir obetalda igen. Planera fakturor tar med dem på nästa faktura.' },
      { namn: 'Efterskänk', gor: 'Skriv varför. Dagarna räknas som betalda utan faktura.' },
    ],
  },
  {
    kind: 'coverage_conflict',
    ikon: 'rapport.avvikelse',
    exempel: 'Faktura INV-202611-0014 täcker dagar som redan är täckta av Fortnox-faktura 744.',
    nar: 'En skickad faktura tar betalt för dagar som redan är betalda på annat sätt.',
    knappar: [
      { namn: 'Öppna fakturan', gor: 'Fakturan öppnas så att du kan se raderna.' },
      { namn: 'Hanterad', gor: 'Raden försvinner när du har rättat det som behövs.' },
    ],
  },
  {
    kind: 'addon_decide',
    ikon: 'kund.beslut',
    exempel: '2 tilläggsstationer på Exempel AB Lager väntar på beslut. Välj om de ingår i premien eller faktureras som tillägg. Pro rata skapas först efter beslutet.',
    nar: 'En tekniker har satt ut tilläggsstationer som ingen har beslutat om. Meningen om pro rata står bara när avtalet följer premien.',
    knappar: [
      { namn: 'Tillägg utöver avtalet', gor: 'Rutan Besluta tillägg öppnas med Tillägg utöver avtalet valt.' },
      { namn: 'Ingår i premien', gor: 'Samma ruta med Lägg till i avtalet valt. Årspremien höjs.' },
    ],
  },
  {
    kind: 'addon_no_case',
    ikon: 'arende.arende',
    exempel: 'Stationen på Exempel AB Lager sattes ut utan ärende. Välj ärendet den hör till.',
    nar: 'Stationen är beslutad men hör inte till något ärende. Visas bara när avtalet följer premien.',
    knappar: [
      { namn: 'Välj ärende', gor: 'Välj ärendet där stationen sattes ut. Är det öppet hamnar pro rata där, annars tar nästa planering det som en egen faktura.' },
    ],
  },
  {
    kind: 'gap_invoice',
    ikon: 'kund.period',
    exempel: '2 stationer på Exempel AB Lager saknar betalning 2026-11-02 t.o.m. 2027-06-29. Planera fakturor skapar fakturan.',
    nar: 'Stationer saknar betalning från utsättningen till nästa period, oftast för att ärendet stängdes före beslutet.',
    knappar: [
      { namn: 'Planera fakturor', gor: 'Förhandsvisningen visar fakturan som tillägg från utsättning. Tryck Applicera plan för att skapa den.' },
    ],
  },
  {
    kind: 'anchor_verify',
    ikon: 'kund.avtal',
    exempel: 'Kontrollera startdatum mot Oneflow-avtalet och markera avtalsdagen.',
    nar: 'Avtalsåret följer avtalsdagen men startdatumet är inte kontrollerat, till exempel för att någon har ändrat det.',
    knappar: [
      { namn: 'Öppna avtalet i Oneflow', gor: 'Läs startdatumet i det signerade avtalet.' },
      { namn: 'Markera avtalsdag', gor: 'Panelen öppnas på Fakturering. Kryssa i att startdatumet stämmer och tryck Markera som kontrollerad.' },
    ],
  },
]

export default function TillaggArbetslistan() {
  const [vald, setVald] = useState<WorkItemKind>('addon_decide')
  const rad = RADER.find(r => r.kind === vald) ?? RADER[0]

  return (
    <div className="my-6 rounded-xl border border-slate-700 bg-slate-800/30 p-4">
      <p className="text-sm font-semibold text-white">Arbetslistans rader</p>
      <p className="mt-0.5 text-sm text-slate-400">
        Överst i avtalskartan står det som måste göras på kunden. Tryck på en rad. Tillägg att besluta ser alla som öppnar kartan, de andra raderna bara den som är Faktureringsansvarig.
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,15rem)_1fr]">
        <ul className="grid gap-1" role="listbox" aria-label="Arbetslistans rader">
          {RADER.map(r => (
            <li key={r.kind}>
              <button type="button" role="option" aria-selected={r.kind === vald} onClick={() => setVald(r.kind)}
                className={`flex min-h-[44px] w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm ${r.kind === vald ? 'bg-[#20c58f]/10 text-white shadow-[inset_3px_0_0_#20c58f]' : 'text-slate-300 hover:bg-slate-800/60'}`}>
                <Icon name={r.ikon} size={20} className="shrink-0 text-amber-300" />
                {WORK_ITEM_TITLE[r.kind]}
              </button>
            </li>
          ))}
        </ul>

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden />
            {WORK_ITEM_TITLE[rad.kind]}
          </div>
          <p className="mt-1 text-sm text-slate-200">{rad.exempel}</p>
          <p className="mt-3 text-xs font-medium text-slate-400">När den visas</p>
          <p className="text-sm text-slate-300">{rad.nar}</p>
          <p className="mt-3 text-xs font-medium text-slate-400">Knapparna</p>
          <dl className="mt-1 grid gap-1.5">
            {rad.knappar.map(k => (
              <div key={k.namn}>
                <dt className="text-sm font-medium text-[#20c58f]">{k.namn}</dt>
                <dd className="text-sm text-slate-300">{k.gor}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  )
}
