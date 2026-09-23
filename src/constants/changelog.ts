// src/constants/changelog.ts
// Uppdateringslogg som visas för personalen via "Uppdateringar" i sidomenyn.
//
// Skriv för en kollega som inte följt utvecklingen: vad kan man göra nu som man
// inte kunde igår? Konkret nytta, inte teknik. Två till fyra punkter per release,
// en rad var. Nyast överst - listan renderas i den ordning den står här.
//
// Vid ny release: lägg till högst upp och höj versionen. Alla som inte sett den
// versionen får en prick i sidomenyn.
//
// Versionsnummer: generation.release.rättning, utan koppling till datum.
//   - Ny generation (första siffran) när en central del byggs om i grunden,
//     som Fakturering 2.0 (2.0.0) eller Avtalskartans motor (3.0.0).
//   - Ny release (andra siffran) för varje leverans med ny funktion.
//   - Rättning (tredje siffran) för en leverans som bara rättar fel.
//
// Varje punkt får en kategori: nyhet (kan göra något nytt), andring (något
// bekant fungerar annorlunda) eller buggfix (något som var fel är rättat).
// Skriv { kind, text }. Punkter från tiden före kategorierna är rena
// strängar och visas utan etikett.
//
// VARJE leverans till main ska in här, samma dag: ny post om dagen saknar en,
// annars en punkt till i dagens post. Loggen är det personalen läser.

export type ChangelogKind = 'nyhet' | 'andring' | 'buggfix'

export type ChangelogItem = string | { kind: ChangelogKind; text: string }

export const CHANGELOG_KIND_LABEL: Record<ChangelogKind, string> = {
  nyhet: 'Nyhet',
  andring: 'Ändring',
  buggfix: 'Buggfix',
}

export interface ChangelogEntry {
  /** Visas som mono-etikett, t.ex. "3.10.0" */
  version: string
  /** ÅÅÅÅ-MM-DD */
  date: string
  /** Kort rubrik för vad releasen handlar om */
  title: string
  /** En rad per punkt, skriven som nytta för användaren */
  items: ChangelogItem[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '3.11.0',
    date: '2026-09-23',
    title: 'Ny version av sig själv',
    items: [
      { kind: 'nyhet', text: 'Portalen märker när en ny version finns, till exempel när appen öppnas igen efter en paus, och visar "Ny version finns" med en knapp för att ladda om' },
      { kind: 'nyhet', text: 'Vid nästa sidbyte hämtas den nya versionen av sig själv, aldrig mitt i ett formulär' },
      { kind: 'andring', text: 'Punkterna under Uppdateringar är märkta Nyhet, Ändring eller Buggfix' },
    ],
  },
  {
    version: '3.10.1',
    date: '2026-09-23',
    title: 'Uppdateringar fungerar på telefonen',
    items: [
      { kind: 'buggfix', text: 'Listan under Uppdateringar går att scrolla och stänga på mobilen, även i appläget' },
    ],
  },
  {
    version: '3.10.0',
    date: '2026-09-23',
    title: 'Portalen som app på mobilen',
    items: [
      { kind: 'nyhet', text: 'Under Mitt konto finns "Använd som app": lägg portalen på hemskärmen och kör den utan adressfält, med egen ikon' },
      { kind: 'nyhet', text: 'Android installerar direkt från knappen, iPhone får en kort guide till Dela-menyn' },
      { kind: 'nyhet', text: 'Ny version hämtas av sig själv vid nästa start - inga omladdningar mitt i arbetet' },
    ],
  },
  {
    version: '3.9.0',
    date: '2026-09-23',
    title: 'Tydligare kartor vid utplacering',
    items: [
      { kind: 'nyhet', text: 'Andra kunders stationer visas nedtonade på kartan när du placerar ut, så de inte blandas ihop med kundens egna' },
      { kind: 'nyhet', text: 'Knappen "Dölj andra kunder" på kartan stänger av dem helt - valet kommer ihåg sig' },
      { kind: 'nyhet', text: 'Fliken Karta följer den kund du håller på med och visar grannarna inom 500 meter nedtonade' },
      { kind: 'andring', text: 'Kundfiltret på fliken Karta är en kundväljare i stället för kryssrutor' },
    ],
  },
  {
    version: '3.8.0',
    date: '2026-09-21',
    title: 'Signerade avtal aktiveras själva',
    items: [
      'Ett avtal som signeras i Oneflow blir aktivt av sig självt och kundraden följer det riktiga avtalet',
      'Kundkortets tidslinje visar när kommande fakturor skapas och skickas',
      'Fortnox-verifieringen stämplas automatiskt ur kundspegeln',
      'Avtalskartan går ner i lugnt läge när fakturorna redan är planerade',
    ],
  },
  {
    version: '3.7.0',
    date: '2026-09-18',
    title: 'Fakturaplan och utrustning',
    items: [
      'Avtal som förlängs får rullande slutdatum och planeras förbi det gamla slutdatumet',
      'En passerad period kan registreras som fakturerad utanför portalen',
      'Kvar att betala hämtas från Fortnox, delbetalda fakturor får egen status',
      'Faktureringsansvariga får en notis när ett avtal signeras',
      'Utrustningssidan visar kundens alla stationer, med växeln Alla/Mina',
    ],
  },
  {
    version: '3.6.0',
    date: '2026-09-17',
    title: 'Fakturafliken på kundkortet',
    items: [
      'Fakturafliken delar upp årspremie, merförsäljning och avtal, och visar kommande fakturor',
      'Avtalskartan har fakturaplanen som eget steg och en markör i kundlistan',
      'Enhetskoden är fakturamärkningen och kontakten följer enheten',
      'Tilläggsstationer utan avtal syns som brickor att besluta',
    ],
  },
  {
    version: '3.5.0',
    date: '2026-09-15',
    title: 'Stationskarta som PDF',
    items: [
      'Kunden kan ladda ned stationskarta och stationsöversikt som PDF från kundportalen',
    ],
  },
  {
    version: '3.4.0',
    date: '2026-09-09',
    title: 'Avtalet har en källa för premien',
    items: [
      'Avtalstypen bär premien, § 4 visar andelar och trappan styr kolumnerna',
      'Kontrollschemat kommer ur § 3 och nästa faktura står på pappret',
      'Ramavtalet skrivs en gång och enheterna står i en bilaga',
      'Ekonomin har fått en egen läsyta med strukturerad historik och hopfällbara paragrafer',
    ],
  },
  {
    version: '3.3.0',
    date: '2026-09-08',
    title: 'Avtalskartan i tre lager',
    items: [
      'Pappret läser, panelen styr och pulsen visar hur avtalet mår',
      'Ronden visas som en svärm på ärendefliken - en rad per enhet på gemensam tidsaxel',
      'Obeslutade tilläggsstationer letar upp faktureringsansvarig och kan beslutas samlat per avtal',
    ],
  },
  {
    version: '3.2.0',
    date: '2026-09-05',
    title: 'Stationstyper med produkt och pris',
    items: [
      'Varje stationstyp har produkt och pris, tilläggsstationer faktureras i tre lägen',
      'Kundens prislista styrs av avtalskartan',
      'Varaktig utrustning bokförs som engångskostnad och all marginal räknas i en motor',
      'Tekniker kan avsluta ärenden med faktura och kunder ser inga inköpspriser',
    ],
  },
  {
    version: '3.1.0',
    date: '2026-09-03',
    title: 'Tilläggsstationer och kundpriser',
    items: [
      'Tilläggsstationer kan betalas på tre sätt och teknikern väljer vid utsättningen',
      'Avtalade kundpriser på artiklar följer med till fakturan med låst tjänst och specifikation',
      'Engångskunder får kundnummer från Fortnox via en spegel som synkas var tionde minut',
      'Privatpersoner får priser inklusive moms på fakturautkasten',
    ],
  },
  {
    version: '3.0.0',
    date: '2026-09-02',
    title: 'Avtalskartans motor',
    items: [
      'Avtalsbladet har fått § 7 Premie, § 8 Referenser och § 9 Löptid, och avtalet är källan till årspremiefakturan',
      'Besök per enhet, optioner och bevakning planeras ur avtalet',
      'Ingår i avtalet, katalog, arkiv och ångra på avtalskartan',
      'Fakturering kan pausas per avtal och kundkortsavtal nollas när kunden fått ett riktigt avtal',
    ],
  },
  {
    version: '2.4.0',
    date: '2026-09-01',
    title: 'Kundansvarig och prislistor',
    items: [
      'Kundansvarig sätts på avtalet i Avtalskartan och följer avtalets omfattning',
      'Prislista, avtalstyp och säljare från avtalet speglas till kundens inställningar',
      'Artikelväljaren visar alla artiklar och kan lägga till en hel kategori i taget',
    ],
  },
  {
    version: '2.3.0',
    date: '2026-08-31',
    title: 'Tilläggsstationer',
    items: [
      'Stationer utöver avtalet kan placeras, märkas och faktureras - både etablering och per kontrollrunda',
      'Preparat kommer ihåg sig per station till nästa kontroll och arbetsrapporten fylls i automatiskt',
      'Etableringsärenden går inte längre att avsluta utan placerade stationer',
      'Enhetens egna uppgifter visas i ärendemodalen med val av rätt avtal',
    ],
  },
  {
    version: '2.2.0',
    date: '2026-08-30',
    title: 'Säkrad åtkomst till systemets API:er',
    items: [
      'Alla API-anrop kräver nu inloggning och rätt behörighet',
      'Kunder och enheter kan bara nå sina egna uppgifter',
    ],
  },
  {
    version: '2.1.0',
    date: '2026-08-28',
    title: 'Besök och provisioner',
    items: [
      'Besöket är nu en egen post - flera tekniker kan dela på samma ärende med provision per besök',
      'Provisionen frigörs i takt med att kunden betalar fakturan',
      'Kunden anger adress, märkning och enhet direkt i serviceanmälan',
      'Kundkortet visar inloggningsrytm, täckning och kontohistorik',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-08-26',
    title: 'Fakturering 2.0 och Provisioner 2.0',
    items: [
      'Faktureringen har fått arbetskö, färgsatt status och egen arkivvy',
      'Faktureringsansvarig kvitterar innan fakturan kan skickas till Fortnox',
      'Rabatt och provision visas i godkännandet, betalvillkor räknas från sändningen',
      'Provisioner samlas till en utbetalning per tekniker och månad',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-08-25',
    title: 'Fakturamodal och ärendehistorik',
    items: [
      'Fakturamodalen visar prisavstämning, besökstidslinje och hela fakturakedjan',
      'Ärendehistoriken ger en ny tekniker full besökskontext med fakturor och betalstatus',
      'Avtalskunder utan rumsnummer får en vaktrondsvy i stället för rumsdesignen',
      'Ärenden kan öppnas direkt i schemat från kundkortet',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-08-24',
    title: 'Rumsanalys',
    items: [
      'Nytt fält Rum nr för kunder med boendeverksamhet',
      'Kundkortet visar statistik per rum och pekar ut problemrum efter frekvens och riktning',
      'Grundorsaksbokning förifyller tjänsten och föreslår rätt tekniker',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-08-21',
    title: 'Intäktsmodell och säljare',
    items: [
      'En gemensam intäktsmodell för portalen och historiken - inga dubbelräknade ärenden',
      'Avtalspremien tillhör säljaren och ärendet teknikern',
      'Säljare kan sättas direkt på avtalskartan',
      'Svenskt datumformat i hela portalen',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-08-20',
    title: 'Avtalskartan',
    items: [
      'Avtal visas som dokument med drag och släpp för vilka enheter som omfattas',
      'Tjänster, interna kostnader och marginal syns direkt på avtalet',
      'Avtal kan sägas upp, avslutade avtal ligger kvar synliga',
      'Kontrollbesök och scheman kopplas till rätt avtal',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-08-19',
    title: 'Ny kundvy och utrustningssida',
    items: [
      'Kundsidan har byggts om med avtalskort, tidslinje och faktureringskedja',
      'Ny listvy med grupper och snabbpanel utan paginering',
      'Egen flik för Åtkomst och konton per kund',
      'Utrustningssidan har fått tabbar för Kunder, Karta och Kontroller med sökbara kundrader',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-08-18',
    title: 'Dokumentsignering',
    items: [
      'Master-detail-arbetsyta med prioriterad kö för avtal och offerter',
      'Statistikvy med djupanalys och jämförelse mellan tekniker',
      'Konversationen synkar från Oneflow och ursprungsärendet länkas i panelen',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-08-17',
    title: 'Rapporter enligt dokumentstandarden',
    items: [
      'Saneringsrapporten och ärenderapporten följer företagets dokumentstandard',
      'Ärendets bilder följer med i saneringsrapporten',
      'Schemat visar beläggning uppdelad på engångskunder och avtalskunder',
      'Tekniker kan bytas och fördelas på scheman med kontroll mot krockar',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-08-12',
    title: 'Avtalstillägg och rabattgodkännande',
    items: [
      'Tekniker kan lägga till en tjänst i avtalet från fältet - pro rata nu, höjd årspremie sedan',
      'Rabatter kräver motivering och godkännande av ansvarig',
      'Ärendemodalerna har designats om för avtal, privat och företag',
      'Avtalshistoriken visas som tidslinje på kundkortet',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-08-11',
    title: 'Intranät och handbok',
    items: [
      'Nytt intranät med start, anslag, kontakter, KMA och handbok',
      'Policys kräver läskvittens och visar vem som kvitterat vilken version',
      'Interaktiva guider för prissättning, fakturering, ärendetyper och schema',
      'Mitt konto för profil och byte av lösenord i alla rollvyer',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-08-10',
    title: 'Ljust läge och incidentflöde',
    items: [
      'Ljust läge finns i hela systemet och väljs per användare',
      'Portalroller kan kombineras fritt med växlare mellan vyerna',
      'ISO-utredningsflöde för incidenter med grundorsak, åtgärd och uppföljning',
      'Mottagare för tillbud och olyckor ställs in direkt på personkorten',
    ],
  },
]

/** Senaste versionen - används för att avgöra om användaren har osedda uppdateringar */
export const LATEST_VERSION = CHANGELOG[0]?.version ?? ''
