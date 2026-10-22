// src/pages/shared/intranet/handbokSektioner.ts
// Handbokens ordning: ämnen i den ordning man lär sig jobbet, och guiderna inom
// varje ämne i läsordning. Tekniker- och kontorsversionen av samma uppgift står
// bredvid varandra i listan; var och en ser bara sin roll, så ordningen blir rätt
// för båda. En guide som inte står här hamnar under Fler guider.

import type { IconName } from '../../../components/icons/Icon'

export interface HandbokSektion {
  id: string
  titel: string
  text: string
  ikon: IconName
  slugs: string[]
}

export const HANDBOK_SEKTIONER: HandbokSektion[] = [
  {
    id: 'kom-igang',
    titel: 'Kom igång',
    text: 'Börja här. Menyn, sökrutan, frågor till kollegor och vad du gör om något händer.',
    ikon: 'guide.var',
    slugs: [
      'guide-roller-och-vyer', 'guide-roller-och-vyer-kontor',
      'guide-sokrutan-tekniker', 'guide-sokrutan-kontor', 'guide-sokrutan-saljare',
      'guide-ticket-systemet', 'guide-ticket-systemet-kontor',
      'guide-rapportera-tillbud', 'guide-rapportera-tillbud-kontor',
    ],
  },
  {
    id: 'arenden',
    titel: 'Ärenden och besök',
    text: 'Skapa och boka ärenden, nästa besök, nytt skadedjur hos samma kund och när kunden avbokar.',
    ikon: 'arende.arende',
    slugs: [
      'guide-skapa-arenden', 'guide-schemavyn',
      'guide-aterbesok', 'guide-aterbesok-kontor', 'guide-aterbesok-avtal',
      'guide-foljearenden', 'guide-foljearenden-kontor',
      'guide-avbryta-arenden', 'guide-avbryta-arenden-kontor',
    ],
  },
  {
    id: 'stationer',
    titel: 'Stationer och kontroller',
    text: 'Hos avtalskunderna: sätta ut stationer, tillägg, återkommande kontroller och rapporterna till kunden.',
    ikon: 'arende.station',
    slugs: [
      'guide-placera-stationer', 'guide-tillaggsstationer', 'guide-tillaggsstationer-koordinator',
      'guide-aterkommande-schema', 'guide-kontrollrapport',
      'guide-specialrapporter', 'guide-specialrapporter-kontor',
    ],
  },
  {
    id: 'ekonomi',
    titel: 'Pris och fakturering',
    text: 'Rätt pris i ärendet, fakturaraderna, delfakturor och vägen från ärende till betald faktura.',
    ikon: 'sok.faktura',
    slugs: [
      'guide-fakturering', 'guide-prissattning', 'guide-delfakturering',
      'guide-fakturering-kontor', 'guide-fakturavag', 'guide-prissattning-kontor', 'guide-tillaggsstationer-fakturering',
    ],
  },
  {
    id: 'forsaljning',
    titel: 'Försäljning',
    text: 'Offerter, avtal för signering och leads, från tipset till vunnen affär.',
    ikon: 'dok.offert',
    slugs: [
      'guide-dokumentsignering-tekniker', 'guide-leads-tekniker',
      'guide-leads-saljare', 'guide-dokumentsignering', 'guide-leads-kontor',
    ],
  },
]

export const ROLL_NAMN: Record<string, string> = {
  technician: 'tekniker',
  koordinator: 'koordinator',
  admin: 'admin',
  'säljare': 'säljare',
}
