// src/constants/rotRutHjalp.ts
// Hjälptexterna för ROT och RUT i Skapa avtal eller offert (3.127.0), samlade
// här så att samma text används i tjänsteväljaren, wizarden och guiderna.
// Texterna kommer från skissen "Hjälp i ROT/RUT-wizarden" (2026-11-10).

import type { Avdrag, RadRoll } from '../shared/rotRutOffert'
import { ROT_RUT_PROCENT } from '../shared/rotRutOffert'

export interface HjalpText {
  rubrik: string
  text: string
}

/** Slug till guiden för kontoret, länken "Hela guiden" */
export const ROT_RUT_GUIDE_SLUG = 'guide-rot-rut-offert-kontor'
/** Slug till teknikerns guide (tekniker ser aldrig kontorets guider) */
export const ROT_RUT_GUIDE_SLUG_TEKNIKER = 'guide-rot-rut-offert-tekniker'
export const ROT_RUT_GUIDE_TITEL = 'Skapa en ROT- eller RUT-offert'

export const introText = (typ: Avdrag) =>
  `Mallen har ${typ}-avdrag ${ROT_RUT_PROCENT[typ]} %. Raderna nedan har skapats åt dig. Lägg de interna kostnaderna på rätt rad, så räknar prisguiden ut priset.`

export const INTRO_HJALP: { rubrik: string; punkter: string[] } = {
  rubrik: 'ROT och RUT i korthet',
  punkter: [
    'ROT: byggarbete på huset, till exempel tätning. 30 % avdrag.',
    'RUT: vissa saneringsarbeten. 50 % avdrag.',
    'Avdraget gäller bara arbetskostnaden, aldrig material, bil eller övrigt.',
    'Bara privatpersoner som äger eller bor i bostaden.',
    'Fastighetsbeteckning behövs bara för ROT. RUT har ingen fastighet.',
    'Kunden ser priset för arbetet men aldrig antalet timmar.',
  ],
}

export const AVSER_HJALP: HjalpText = {
  rubrik: 'Rubrik, inget pris',
  text: 'Ärendets tjänst visar vad jobbet gäller. Den kostar 0 kr och står som rubrik överst i offerten och på fakturan. Den används också i statistiken, så byt den inte.',
}

export const RAD_HJALP: Record<RadRoll, HjalpText> = {
  arbete: {
    rubrik: 'Bara arbetstid hör hit',
    text: 'Lägg Arbetstid Privatperson här med de timmar du planerar. Välj ROT eller RUT. Resten sköts automatiskt. Kunden ser bara beloppet. Timmarna går till Skatteverket via Fortnox. Tid för inspektion eller bekämpning ger inget avdrag och läggs inte här.',
  },
  material: {
    rubrik: 'Det du använder på plats',
    text: 'Fällor, preparat, tätningsmaterial och tillbehör. Interna kostnader i kategorierna Bekämpning, Tillbehör och Inspektion hamnar här av sig själva. Inget avdrag.',
  },
  servicebil: {
    rubrik: 'Skriv in priset själv',
    text: 'Antal gånger bilen används och pris per gång, till exempel 1 × 500 kr. Används ingen bil, lämna 0 kr så syns raden inte för kunden. Inget avdrag.',
  },
  ovrigt: {
    rubrik: 'Allt som inte är arbete eller material',
    text: 'Hundsök, hyra av skylift eller högtryckstvätt och annat från underentreprenörer. Kategorierna Underentreprenör och Övrigt hamnar här av sig själva. Inget avdrag.',
  },
}

/** Raden under radens namn i tjänsteväljaren */
export const RAD_UNDERTEXT: Record<RadRoll, string> = {
  arbete: 'Skadedjurstekniker timpris · visas som "Arbetskostnad, 1 st"',
  material: 'prisguiden räknar priset',
  servicebil: 'Priset skrivs in för hand',
  ovrigt: 'prisguiden räknar priset',
}

export const FASTIGHET_HJALP: HjalpText = {
  rubrik: 'Var hittar jag den?',
  text: 'Kommun, område och nummer, till exempel Exempelby 1:23. Kunden har den på lagfarten eller fastighetsskatten. Fråga kunden om du är osäker. Bor kunden i bostadsrätt? Kryssa Bostadsrätt och fyll i föreningens org.nr och lägenhetsnummer i stället.',
}

export const PERSONNUMMER_HJALP: HjalpText = {
  rubrik: 'Den som får avdraget',
  text: 'ÅÅÅÅMMDD-XXXX eller ÅÅMMDD-XXXX. Personen ska äga eller bo i bostaden och betala fakturan. Ett org.nr fungerar inte. Företag kan inte få ROT eller RUT.',
}

export const FALT_UNDERTEXT = {
  fastighet: 'Skriv som Kommun område 1:23, med kolon.',
  brf: 'Föreningens org.nr och lägenhetsnumret, till exempel 1102.',
  personnummer: 'ÅÅÅÅMMDD-XXXX eller ÅÅMMDD-XXXX. Ett org.nr fungerar inte.',
}

export const TIMMAR_UNDERTEXT =
  'Timmarna syns aldrig för kunden. Planera som vanligt, de ligger till grund för priset och rapporten till Skatteverket.'

export const typAvArbeteText = (typ: Avdrag) =>
  typ === 'ROT' ? 'Rapporteras som byggarbete' : 'Rapporteras som RUT-arbete, samma typ varje gång'

export const KVAR_RUBRIK = 'Kvar innan du kan gå vidare'
