// api/_lib/procurementOwnMaterial.ts
// Kurerat eget material för kvalitetssvar i anbudsverkstaden
// (docs/upphandlingsportal-plan.md avsnitt 5 Anbudsstöd och 5b Kvalitetssvar).
//
// Korta faktablock om vad BeGone och BeGones system faktiskt gör. Varje block
// har en källa i repot eller databasen. REGEL: skriv bara in sådant som stöds
// av koden, dokumenten eller policytexterna. Inga säljformuleringar, inga
// siffror som inte går att belägga. Ändras en funktion ska blocket ändras i
// samma leverans. AI:n får bara använda dessa block och tidigare svar ur
// anbudsbiblioteket; allt annat ska den markera som [KOMPLETTERA: ...].
//
// Underscore-prefix: exponeras inte som endpoint.

/** Kriterietyper i anbudsbiblioteket. Samma lista finns i src/services/procurementAnswerService.ts. */
export const CRITERION_TYPES = [
  'rapportering',
  'egenkontroll',
  'miljo',
  'kvalitetssakring',
  'bemanning',
  'installelsetid',
  'kommunikation',
  'annat',
] as const

export type CriterionType = (typeof CRITERION_TYPES)[number]

export const CRITERION_TYPE_LABEL_SV: Record<CriterionType, string> = {
  rapportering: 'Rapportering',
  egenkontroll: 'Egenkontroll',
  miljo: 'Miljö',
  kvalitetssakring: 'Kvalitetssäkring',
  bemanning: 'Bemanning och kompetens',
  installelsetid: 'Inställelsetid',
  kommunikation: 'Kommunikation och kundtjänst',
  annat: 'Annat',
}

export function isCriterionType(v: unknown): v is CriterionType {
  return typeof v === 'string' && (CRITERION_TYPES as readonly string[]).includes(v)
}

export interface MaterialBlock {
  id: string
  rubrik: string
  text: string
  /** Fil i repot eller tabell och rad i databasen */
  kalla: string
  /** Kriterietyper blocket främst stöder, för sortering i prompten */
  typer: CriterionType[]
}

export const OWN_MATERIAL: MaterialBlock[] = [
  {
    id: 'foretag',
    rubrik: 'Företagsuppgifter',
    text:
      'BeGone Skadedjur & Sanering AB, organisationsnummer 559378-9208. Telefon 010 280 44 10, e-post info@begone.se, webb begone.se. Uppgifterna står i sidhuvudet och sidfoten på kontrollrapporten som kunden får.',
    kalla: 'api/generate-inspection-report-pdf.ts (kontrollrapportens utförarblock och sidfot)',
    typer: ['annat', 'kommunikation'],
  },
  {
    id: 'ledningssystem',
    rubrik: 'Ledningssystem för kvalitet och miljö',
    text:
      'BeGone har ett ledningssystem som enligt den interna introduktionen uppfyller kraven i ISO 9001 (kvalitet) och ISO 14001 (miljö). Arbetet beskrivs i en KM-handbok med rutiner för bland annat skadedjursbekämpning och sanering, utrustning, hantering av bekämpningsmedel och avfall samt nödlägesberedskap. Personalen kvitterar introduktionen, kvalitetspolicyn och miljöpolicyn. Materialet säger inte om ledningssystemet är tredjepartscertifierat.',
    kalla: 'Databas: intranet_documents, slug introduktion-km-arbete',
    typer: ['kvalitetssakring', 'miljo', 'bemanning'],
  },
  {
    id: 'kvalitetspolicy',
    rubrik: 'Kvalitetspolicy',
    text:
      'Hög kvalitet betyder för BeGone: snabb handläggning så att kunden inte behöver vänta på återkoppling; att åtgärda grundorsaken och inte bara symptomen; ett team med de behörigheter, den kunskap och erfarenhet som behövs; val av bekämpningsmetod utifrån kundens problem, bara godkända bekämpningsmedel och miljöanpassade alternativ när det är möjligt; att uppfylla kraven från kunder, myndigheter och andra intressenter; ständig förbättring av metoder och arbetssätt. Motto: Vi skapar en säker miljö, fri från skadedjur.',
    kalla: 'Databas: intranet_documents, slug kvalitetspolicy',
    typer: ['kvalitetssakring', 'bemanning'],
  },
  {
    id: 'miljopolicy',
    rubrik: 'Miljöpolicy',
    text:
      'Målet är att lösa kundernas skadedjursproblem med minsta möjliga miljöpåverkan. Det innebär: bekämpningsmetod väljs utifrån kundens problem, bara godkända bekämpningsmedel och miljöanpassade alternativ prioriteras; snabb åtgärd så att mindre medel behövs; uppdrag samordnas för att minska transporterna och onödiga transporter undviks; servicebilar väljs utifrån EURO-klass och koldioxidutsläpp; gällande miljöförfattningar följs; miljöarbetet förbättras ständigt.',
    kalla: 'Databas: intranet_documents, slug miljopolicy',
    typer: ['miljo'],
  },
  {
    id: 'miljopaverkan',
    rubrik: 'Kartlagd miljöpåverkan och prioriterade områden',
    text:
      'Miljöpåverkan är kartlagd ur ett livscykelperspektiv, från råvaror och tillverkning av inköpta produkter via transport och bekämpning till avfall. Prioriterade områden: transporter i egna fordon, bekämpningsmedel och gnagarfällor. Det integrerade kvalitets- och miljömålet är att lösa problemet med så få besök som möjligt, vilket ger mindre spridning av bekämpningsmedel och färre transporter. Teknikern ska kartlägga grundorsaken till angreppet och anpassa behandlingen efter den.',
    kalla: 'Databas: intranet_documents, slug introduktion-km-arbete',
    typer: ['miljo', 'kvalitetssakring'],
  },
  {
    id: 'avvikelser',
    rubrik: 'Avvikelser, tillbud och olyckor',
    text:
      'Rutiner som inte fungerar, tillbud, olyckor, brand, spill av bekämpningsmedel, lagöverträdelser, avtal med kunder som inte uppfylls och kundklagomål rapporteras som avvikelser. Personalen rapporterar direkt i portalen via Rapportera tillbud, avvikelse eller olycka. Mottagare ställs in per typ (tillbud, olycka, avvikelse) och får notis i portalen och e-post. Incidenter utreds i ett flöde med grundorsak, åtgärd och uppföljning. Syftet är att hitta återkommande eller allvarliga problem och förhindra att de inträffar igen.',
    kalla: 'Databas: intranet_documents, slug introduktion-km-arbete; src/services/incidentRecipientService.ts; src/constants/changelog.ts (1.0.0)',
    typer: ['kvalitetssakring', 'egenkontroll'],
  },
  {
    id: 'stationsregister',
    rubrik: 'Digitalt stationsregister med karta och planritning',
    text:
      'Varje fälla och station registreras i BeGones system. Utomhusstationer får GPS-position, foto och kommentar. Inomhusstationer placeras på kundens planritningar och får ett stationsnummer automatiskt. Stationerna har typ (till exempel ljusfälla) med egna tröskelvärden för aktivitet. Stationer som satts ut utöver avtalet märks som tillägg.',
    kalla: 'Databas: intranet_documents, slug guide-placera-stationer; .claude/skills/egenkontroll-rondering/SKILL.md; src/constants/changelog.ts (2.3.0, 3.12.0)',
    typer: ['egenkontroll', 'rapportering'],
  },
  {
    id: 'stationskontroll',
    rubrik: 'Kontrollbesök registreras station för station',
    text:
      'Vid kontrollbesök registrerar teknikern i mobilen per station status, mätvärde, preparat, anteckning och foto. Aktivitetsnivån räknas fram automatiskt ur stationstypens tröskelvärden och sparas låst, så att historiken inte ändras om trösklarna ändras senare. Stationens senaste preparat föreslås vid nästa kontroll och arbetsrapporten fylls i automatiskt. Kontrollbesök kan återöppnas och kompletteras.',
    kalla: '.claude/skills/egenkontroll-rondering/SKILL.md (delsystem A, frysta statusar); src/constants/changelog.ts (2.3.0)',
    typer: ['egenkontroll', 'kvalitetssakring'],
  },
  {
    id: 'kontrollrapport',
    rubrik: 'Kontrollrapport efter varje kontrollbesök',
    text:
      'Efter kontrollbesöket skapas en kontrollrapport som PDF. Den innehåller utförare och tekniker, kunduppgifter, sammanställning av antal stationer per aktivitetsnivå (ingen, lite, medelhög och betydande aktivitet), teknikerns anteckningar, bilder från besöket, satellitkarta med utomhusstationerna och en tabell per station med nummer, typ, status, mätvärde, enhet, anteckning, preparat och tid för kontrollen. Inomhusstationer redovisas per planritning. Samma underlag kan tas ut som Excel.',
    kalla: 'api/generate-inspection-report-pdf.ts; src/services/inspectionReportService.ts',
    typer: ['rapportering', 'egenkontroll'],
  },
  {
    id: 'kundportal',
    rubrik: 'Kundportal',
    text:
      'Kunden har en egen inloggning till BeGones kundportal med flikarna Översikt, Fällor och stationer, Genomförda kontroller, Ärenden, Rapporter och Offerter. Kunden ser sina stationer på karta och planritning, historiken per station som trenddiagram, genomförda kontroller med rapporter samt statistik över ärenden. Portalen går att lägga på hemskärmen i mobilen som app.',
    kalla: 'src/components/customer/CustomerPortalLayout.tsx; src/components/customer/StationHistoryModal.tsx; src/components/customer/CustomerStatistics.tsx; src/constants/changelog.ts (3.10.0)',
    typer: ['rapportering', 'kommunikation'],
  },
  {
    id: 'stationskarta',
    rubrik: 'Stationskarta som PDF',
    text:
      'Kunden kan själv ladda ned en stationskarta som PDF från kundportalen: planritningar, satellitkarta med numrerade markörer och en stationslista. Kunder med flera regioner kan ladda ned en stationsöversikt med antal stationer per region.',
    kalla: 'api/generate-station-map-pdf.ts; api/_lib/stationMapHtml.ts; src/constants/changelog.ts (3.5.0)',
    typer: ['rapportering', 'egenkontroll'],
  },
  {
    id: 'bedomning',
    rubrik: 'Bedömning med trafikljus och läskvitto vid kritiskt läge',
    text:
      'Teknikern gör en bedömning på ärendet: skadedjursnivå på en skala 0 till 3 och problemnivå på en skala 1 till 5, med rekommendationer till kunden. Bedömningen visas för kunden som trafikljus. När nivån är kritisk (skadedjursnivå 3 eller problemnivå 4 eller högre) måste kunden bekräfta med ett läskvitto i portalen, så att det går att visa att kunden tagit del av rekommendationerna.',
    kalla: 'src/types/acknowledgment.ts (requiresAcknowledgment); src/components/customer/ProfessionalAssessment.tsx; src/components/customer/CriticalAcknowledgmentBanner.tsx',
    typer: ['rapportering', 'kommunikation', 'kvalitetssakring'],
  },
  {
    id: 'saneringsrapport',
    rubrik: 'Sanerings- och ärenderapporter',
    text:
      'För ärenden skapas sanerings- och ärenderapporter som PDF enligt företagets dokumentstandard, med ärendets bilder och bedömning. Rapporterna sparas och visas för kunden under Rapporter i kundportalen och kan skickas med e-post. Priser visas aldrig i ärenderapporterna.',
    kalla: '.claude/skills/pdf-rapporter/SKILL.md; src/pages/customer/SanitationReports.tsx; api/send-work-report.ts; src/constants/changelog.ts (1.3.0)',
    typer: ['rapportering'],
  },
  {
    id: 'aterkommande',
    rubrik: 'Återkommande kontrollschema',
    text:
      'Kontrollbesök läggs upp som ett återkommande schema per kund, med frekvens från varje vecka till en gång per år eller eget intervall. Besöken skapas i schemat automatiskt och kopplas till rätt avtal. Kontrollschemat i avtalet styr antalet besök.',
    kalla: 'src/services/recurringScheduleService.ts; src/types/recurringSchedule.ts; Databas: intranet_documents, slug guide-aterkommande-schema; src/constants/changelog.ts (1.6.0, 3.4.0)',
    typer: ['egenkontroll', 'kvalitetssakring'],
  },
  {
    id: 'rondering',
    rubrik: 'Rondering och egenkontroll för stora uppdrag',
    text:
      'För ett kommunalt ronderingsuppdrag (Trafikkontoret) finns ett eget flöde: rondering station för station, egenkontroll med frågemallar per station och avvikelser markerade på karta med foto. I portalen visas riskzoner där stationer med hög beteåtgång ligger tätt. En periodrapport som PDF sammanställer egenkontrollen, utförda rondering-tillfällen, avvikelser och högriskstationer, det vill säga stationer där allt bete gått åt vid två eller fler inspektionstillfällen.',
    kalla: 'src/pages/admin/RonderingPage.tsx; src/utils/ronderingPdfGenerator.ts; .claude/skills/egenkontroll-rondering/SKILL.md (delsystem B och C)',
    typer: ['egenkontroll', 'rapportering'],
  },
  {
    id: 'multisite',
    rubrik: 'Organisationer med många enheter',
    text:
      'Kunder med många enheter läggs upp som organisation med huvudkontor, regioner och enheter. Kundens användare får roller som verksamhetschef, regionchef eller platsansvarig och ser då hela organisationen, sina regioner eller sin enhet i portalen. Enhetskoden följer med som märkning på fakturan.',
    kalla: 'src/types/multisite.ts (MultisiteUserRoleType); .claude/skills/multisite-organisation/SKILL.md; src/constants/changelog.ts (3.6.0)',
    typer: ['kommunikation', 'rapportering'],
  },
  {
    id: 'serviceanmalan',
    rubrik: 'Serviceanmälan direkt i portalen',
    text:
      'Kunden kan anmäla ett nytt ärende direkt i kundportalen med beskrivning, prioritet och kontaktperson, och ange adress, märkning och enhet. Ärendet skapas med ärendenummer och status Öppen.',
    kalla: 'src/components/customer/PremiumServiceRequest.tsx; src/constants/changelog.ts (2.1.0)',
    typer: ['kommunikation', 'installelsetid'],
  },
  {
    id: 'rumsanalys',
    rubrik: 'Statistik per rum',
    text:
      'För kunder med boendeverksamhet registreras upp till tre rumsnummer per ärende. Kundkortet visar statistik per rum och pekar ut problemrum efter frekvens och riktning, och grundorsaksbesök kan bokas med rätt tjänst och tekniker föreslagna.',
    kalla: 'src/services/caseRoomService.ts; src/components/admin/customers/record/RoomAnalysisSection.tsx; src/constants/changelog.ts (1.8.0)',
    typer: ['rapportering', 'kvalitetssakring'],
  },
  {
    id: 'personal-policys',
    rubrik: 'Policys med läskvittens för personalen',
    text:
      'Personalens intranät innehåller policys och handbok. Obligatoriska dokument (introduktion till KM-arbetet, kvalitetspolicy, miljöpolicy och arbetsmiljöpolicy) kräver läskvittens, och det syns vem som kvitterat vilken version. Kontinuerlig utbildning och kompetensutveckling för all personal är en av de punkter som ska genomsyra arbetet.',
    kalla: 'Databas: intranet_documents (sektion obligatoriskt) och intranet_acknowledgements; src/constants/changelog.ts (1.1.0)',
    typer: ['bemanning', 'kvalitetssakring'],
  },
  {
    id: 'atkomst',
    rubrik: 'Behörighetsstyrd åtkomst',
    text:
      'Sedan 2026-08-30 kräver alla anrop till portalens API:er inloggning och rätt behörighet, och kundkonton når bara sina egna uppgifter.',
    kalla: 'src/constants/changelog.ts (2.2.0); api/_lib/auth.ts',
    typer: ['annat'],
  },
]

const BY_ID = new Map(OWN_MATERIAL.map((b) => [b.id, b]))

export function materialById(id: string): MaterialBlock | undefined {
  return BY_ID.get(id)
}

/** Materialet sorterat så att block för kriterietypen kommer först */
export function materialFor(type: CriterionType | null): MaterialBlock[] {
  if (!type) return OWN_MATERIAL
  const first = OWN_MATERIAL.filter((b) => b.typer.includes(type))
  const rest = OWN_MATERIAL.filter((b) => !b.typer.includes(type))
  return [...first, ...rest]
}

// ---------------------------------------------------------------------------
// Kriterietyp ur kriterietexten (grov gissning innan AI:n svarar)

const TYPE_WORDS: Array<[CriterionType, RegExp]> = [
  ['installelsetid', /inställelse|utryckning|akut|responstid|svarstid|inom \d+ ?(timmar|tim|h)\b|jour/i],
  ['rapportering', /rapport|dokumentation|redovis|protokoll|uppföljning|statistik|kundportal|webbportal|digital/i],
  ['egenkontroll', /egenkontroll|kontrollprogram|station|fäll|betes|rondering|monitor|övervak/i],
  ['miljo', /miljö|kemikali|bekämpningsmedel|biocid|giftfri|fordon|transport|utsläpp|hållbar|iso ?14001/i],
  ['bemanning', /bemanning|personal|kompeten|utbildning|behörighet|certifi|erfarenhet|nyckelperson|cv\b/i],
  ['kommunikation', /kommunikation|kontaktperson|kundtjänst|samverkan|samarbete|information|avstämning|möte/i],
  ['kvalitetssakring', /kvalitet|iso ?9001|ledningssystem|avvikelse|reklamation|ständig förbättring|kvalitetssäkr/i],
]

export function guessCriterionType(text: string): CriterionType {
  let best: CriterionType = 'annat'
  let bestHits = 0
  for (const [type, re] of TYPE_WORDS) {
    const hits = (text.match(new RegExp(re.source, 'gi')) ?? []).length
    if (hits > bestHits) {
      best = type
      bestHits = hits
    }
  }
  return best
}
