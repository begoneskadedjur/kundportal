// Kontoplan Google Ads: kontot sätts upp från noll.
// Kör: node gen-ads-kontoplan.mjs                 (skriver Ads_Kontoplan_2026-10-06.pdf i repo-roten)
//      node --env-file=.env.local gen-ads-kontoplan.mjs --json
//                                                  (skriver förslagsfilerna docs/begone-se/ads/andringar/2026-10-06_konto_*.json;
//                                                   läser befintliga delade listor ur kontot så att fas 2 pekar på rätt id)
// Siffrorna är hämtade ur Google Ads API (v25) 2026-10-06, hela historiken i kontot 940-760-4856 (2022-06 till 2026-10-06).
// Kampanjer, sökord, annonser och tillägg ligger i docs/begone-se/ads/kontoplan-data.mjs.
import fs from 'fs';
import puppeteer from 'puppeteer-core';
import { kampanjer, webbplatslankar, framhavningar, rotFramhavning, utdrag, negativaListor, korsnegativ, lan } from './docs/begone-se/ads/kontoplan-data.mjs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BRAND = '#20c58f';
const DATUM = '2026-10-06';
const UTFIL = `Ads_Kontoplan_${DATUM}.pdf`;
const KUND = '9407604856';
const C = `customers/${KUND}`;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const kr = (n) => `${Math.round(n).toLocaleString('sv-SE').replace(/\u00a0/g, ' ')} kr`;
const tabell = (rubriker, rader, bredder = []) => `<table>
<tr>${rubriker.map((r, i) => `<th${bredder[i] ? ` style="width:${bredder[i]}"` : ''}>${r}</th>`).join('')}</tr>
${rader.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('\n')}
</table>`;

// ---------- Förslagsfiler (bara med --json) ----------
const GAMLA = {
  rattSok: '19729967497', rattPmax: '20818570318', generellPmax: '17655089896', fagelSok: '17434641058',
  fagelPmax: '21697769249', insekter: '17434641064', moss: '17434641052', myror: '17434641046', getingar: '17434641049',
};
const LAN_ID = ['21000', '21003', '21004', '21005', '21017', '21018'];
const SVENSKA = 'languageConstants/1015';
const VARDAGAR = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].map((d) => ({ dayOfWeek: d, startHour: 8, startMinute: 'ZERO', endHour: 17, endMinute: 'ZERO' }));
const MATCH = { exakt: 'EXACT', fras: 'PHRASE' };

async function lasDeladeListor() {
  const env = process.env;
  if (!env.GOOGLE_ADS_REFRESH_TOKEN) return {};
  const tok = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.GOOGLE_ADS_CLIENT_ID, client_secret: env.GOOGLE_ADS_CLIENT_SECRET, refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN, grant_type: 'refresh_token' }) })).json();
  const h = { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json', 'login-customer-id': (env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/-/g, '') };
  if (env.GOOGLE_ADS_DEVELOPER_TOKEN) h['developer-token'] = env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const s = await fetch(`https://googleads.googleapis.com/v25/${C}/googleAds:searchStream`, { method: 'POST', headers: h, body: JSON.stringify({ query: "SELECT shared_set.resource_name, shared_set.name FROM shared_set WHERE shared_set.status = 'ENABLED'" }) });
  const d = await s.json();
  const ut = {};
  for (const r of d.flatMap((x) => x.results || [])) ut[r.sharedSet.name] = r.sharedSet.resourceName;
  return ut;
}

function byggKampanj(k, tmp, listor) {
  const ops = [];
  const budget = `${C}/campaignBudgets/${tmp()}`;
  const kamp = `${C}/campaigns/${tmp()}`;
  ops.push({ campaignBudgetOperation: { create: { resourceName: budget, name: `${k.namn} budget`, amountMicros: String((k.budget || 10) * 1e6), deliveryMethod: 'STANDARD', explicitlyShared: false } } });
  const bud = k.kort === 'varumarke' ? { targetSpend: { cpcBidCeilingMicros: '12000000' } } : { maximizeConversions: {} };
  ops.push({ campaignOperation: { create: { resourceName: kamp, name: k.namn, status: 'PAUSED', advertisingChannelType: 'SEARCH', campaignBudget: budget, networkSettings: { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false, targetPartnerSearchNetwork: false }, geoTargetTypeSetting: { positiveGeoTargetType: 'PRESENCE', negativeGeoTargetType: 'PRESENCE' }, containsEuPoliticalAdvertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING', finalUrlSuffix: 'utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_content={adgroupid}&utm_term={keyword}', ...bud } } });
  for (const id of LAN_ID) ops.push({ campaignCriterionOperation: { create: { campaign: kamp, location: { geoTargetConstant: `geoTargetConstants/${id}` } } } });
  ops.push({ campaignCriterionOperation: { create: { campaign: kamp, language: { languageConstant: SVENSKA } } } });
  for (const l of negativaListor) {
    if (k.kort === 'varumarke' && /Konkurrenter|Information|Engelska/.test(l.namn) === false) continue;
    ops.push({ campaignSharedSetOperation: { create: { campaign: kamp, sharedSet: listor[l.namn] } } });
  }
  for (const g of k.grupper) {
    const ag = `${C}/adGroups/${tmp()}`;
    ops.push({ adGroupOperation: { create: { resourceName: ag, campaign: kamp, name: g.namn, status: 'ENABLED', type: 'SEARCH_STANDARD' } } });
    for (const [typ, lista] of Object.entries(g.sokord)) for (const text of lista) ops.push({ adGroupCriterionOperation: { create: { adGroup: ag, status: 'ENABLED', keyword: { text, matchType: MATCH[typ] } } } });
    ops.push({ adGroupAdOperation: { create: { adGroup: ag, status: 'ENABLED', ad: { finalUrls: [g.url], responsiveSearchAd: { headlines: g.rubriker.map((text) => ({ text })), descriptions: g.beskrivningar.map((text) => ({ text })), path1: g.sokvag[0], ...(g.sokvag[1] ? { path2: g.sokvag[1] } : {}) } } } } });
    if (g.insp) {
      const a = `${C}/assets/${tmp()}`;
      ops.push({ assetOperation: { create: { resourceName: a, calloutAsset: { calloutText: 'Kostnadsfri inspektion' } } } });
      ops.push({ adGroupAssetOperation: { create: { adGroup: ag, asset: a, fieldType: 'CALLOUT' } } });
    }
    if (g.rot) {
      const a = `${C}/assets/${tmp()}`;
      ops.push({ assetOperation: { create: { resourceName: a, calloutAsset: { calloutText: rotFramhavning[String(g.rot)] } } } });
      ops.push({ adGroupAssetOperation: { create: { adGroup: ag, asset: a, fieldType: 'CALLOUT' } } });
    }
  }
  // Tillägg
  const lankar = webbplatslankar[k.sitelinks] || webbplatslankar.konto;
  for (const [linkText, description1, description2, url] of lankar) {
    const a = `${C}/assets/${tmp()}`;
    ops.push({ assetOperation: { create: { resourceName: a, finalUrls: [url], sitelinkAsset: { linkText, description1, description2 } } } });
    ops.push({ campaignAssetOperation: { create: { campaign: kamp, asset: a, fieldType: 'SITELINK' } } });
  }
  for (const text of [...(framhavningar[k.kort] || []), ...framhavningar.konto].slice(0, 8)) {
    const a = `${C}/assets/${tmp()}`;
    ops.push({ assetOperation: { create: { resourceName: a, calloutAsset: { calloutText: text } } } });
    ops.push({ campaignAssetOperation: { create: { campaign: kamp, asset: a, fieldType: 'CALLOUT' } } });
  }
  const [hdr, vals] = utdrag[k.kort] || utdrag.konto;
  const su = `${C}/assets/${tmp()}`;
  ops.push({ assetOperation: { create: { resourceName: su, structuredSnippetAsset: { header: hdr, values: vals } } } });
  ops.push({ campaignAssetOperation: { create: { campaign: kamp, asset: su, fieldType: 'STRUCTURED_SNIPPET' } } });
  const ca = `${C}/assets/${tmp()}`;
  ops.push({ assetOperation: { create: { resourceName: ca, callAsset: { countryCode: 'SE', phoneNumber: '010 280 44 10', callConversionReportingState: 'USE_RESOURCE_LEVEL_CALL_CONVERSION_ACTION', callConversionAction: `${C}/conversionActions/949482895`, adScheduleTargets: VARDAGAR } } } });
  ops.push({ campaignAssetOperation: { create: { campaign: kamp, asset: ca, fieldType: 'CALL' } } });
  return ops;
}

function korsNeg(k) {
  const m = { ratt: ['möss', 'mus', 'mössen'], moss: ['råtta', 'råttor'], fagel: ['getingar', 'råttor'], vaggloss: ['pälsänger', 'silverfisk'], insekter: ['vägglöss', 'vägglus'] };
  const ord = [...(m[k.kort] || []), ...(k.kort === 'varumarke' ? [] : ['begone', 'be gone'])];
  return ord.map((text) => ({ text, matchType: 'PHRASE' }));
}

async function skrivJson() {
  const dir = 'docs/begone-se/ads/andringar';
  const finns = await lasDeladeListor();
  const hdr = (namn, beskr, ops) => ({ status: 'FÖRSLAG, ej godkänt. EJ PROVKÖRD: provkörningen nekades av behörighetsspärren i sessionen 2026-10-06, kör mutate.mjs utan --genomfor först.', framtagen: DATUM, beskrivning: beskr, operationer: ops, namn });
  const skriv = (fil, obj) => { delete obj.namn; fs.writeFileSync(`${dir}/${fil}`, JSON.stringify(obj, null, 2)); console.log(`${fil}: ${obj.operationer.length} operationer`); };

  // 1. Mätningen
  const ca = (id) => `${C}/conversionActions/${id}`;
  const matning = [
    ...['6757755502', '6757892796', '6758016197', '951702856'].map((id) => ({ conversionActionOperation: { update: { resourceName: ca(id), primaryForGoal: false }, updateMask: 'primaryForGoal' } })),
    { conversionActionOperation: { update: { resourceName: ca('949482895'), primaryForGoal: true, countingType: 'ONE_PER_CLICK', phoneCallDurationSeconds: '60', valueSettings: { defaultValue: 1400, alwaysUseDefaultValue: false, defaultCurrencyCode: 'SEK' } }, updateMask: 'primaryForGoal,countingType,phoneCallDurationSeconds,valueSettings.defaultValue,valueSettings.alwaysUseDefaultValue,valueSettings.defaultCurrencyCode' } },
    { conversionActionOperation: { create: { name: 'Samtal från webbplatsen 60 s', type: 'WEBSITE_CALL', category: 'PHONE_CALL_LEAD', status: 'ENABLED', primaryForGoal: true, countingType: 'ONE_PER_CLICK', phoneCallDurationSeconds: '60', valueSettings: { defaultValue: 1400, alwaysUseDefaultValue: false, defaultCurrencyCode: 'SEK' } } } },
    { conversionActionOperation: { create: { name: 'Bokat uppdrag (kundportalen)', type: 'UPLOAD_CLICKS', category: 'QUALIFIED_LEAD', status: 'ENABLED', primaryForGoal: false, countingType: 'ONE_PER_CLICK', clickThroughLookbackWindowDays: '90', valueSettings: { defaultValue: 0, alwaysUseDefaultValue: false, defaultCurrencyCode: 'SEK' } } } },
    { conversionActionOperation: { create: { name: 'Genomfört uppdrag (kundportalen)', type: 'UPLOAD_CLICKS', category: 'CONVERTED_LEAD', status: 'ENABLED', primaryForGoal: false, countingType: 'ONE_PER_CLICK', clickThroughLookbackWindowDays: '90', valueSettings: { defaultValue: 0, alwaysUseDefaultValue: false, defaultCurrencyCode: 'SEK' } } } },
    { customerConversionGoalOperation: { update: { resourceName: `${C}/customerConversionGoals/DEFAULT~WEBSITE`, biddable: false }, updateMask: 'biddable' } },
    { customerConversionGoalOperation: { update: { resourceName: `${C}/customerConversionGoals/PAGE_VIEW~WEBSITE`, biddable: false }, updateMask: 'biddable' } },
  ];
  skriv('2026-10-06_konto_1-matning.json', hdr('', 'Kontoplan steg 1, mätningen: telefonklick (click_phone, click_akut, click_phone_akut) och GA4 generate_lead blir sekundära; Calls from ads blir primär (60 s, en per klick, värde 1 400 kr); nya åtgärder Samtal från webbplatsen 60 s (primär, kräver Googles vidarekopplingsnummer på sajten) och Bokat uppdrag / Genomfört uppdrag för offline-import (sekundära tills vidare); målen Övrigt och Sidvisning slutar styra budgivningen.', matning));

  // 2. Fas 1: negativa listor och kampanjerna Råttor, Fåglar, Varumärke (pausade)
  let n = 0; const tmp = () => String(--n);
  const listor = {};
  const listOps = [];
  for (const l of negativaListor) {
    const rn = `${C}/sharedSets/${tmp()}`;
    listor[l.namn] = rn;
    listOps.push({ sharedSetOperation: { create: { resourceName: rn, name: l.namn, type: 'NEGATIVE_KEYWORDS' } } });
    for (const text of l.ord) listOps.push({ sharedCriterionOperation: { create: { sharedSet: rn, keyword: { text, matchType: 'PHRASE' } } } });
  }
  listOps.push({ customerNegativeCriterionOperation: { create: { negativeKeywordList: { sharedSet: listor['Neg | Konkurrenter'] } } } });
  const fas1 = [...listOps];
  for (const k of kampanjer.filter((x) => ['ratt', 'fagel', 'varumarke'].includes(x.kort))) {
    const ops = byggKampanj(k, tmp, listor);
    const kamp = ops[1].campaignOperation.create.resourceName;
    for (const kw of korsNeg(k)) ops.push({ campaignCriterionOperation: { create: { campaign: kamp, negative: true, keyword: kw } } });
    fas1.push(...ops);
  }
  skriv('2026-10-06_konto_2-fas1-bygg.json', hdr('', 'Kontoplan steg 2: nio delade negativa listor (Konkurrenter också på kontonivå, så att den gäller Performance Max) och de nya sökkampanjerna Sök | Råttor, Sök | Fåglar och Sök | Varumärke, alla PAUSADE, med annonsgrupper, sökord, annonser och tillägg. Startas först efter granskning (steg 4).', fas1));

  // 3. Fas 2: Vägglöss, Insekter i hemmet, Möss, Företag och avtal, Getingar, Myror (pausade)
  n = -1000;
  const listor2 = {};
  for (const l of negativaListor) listor2[l.namn] = finns[l.namn] || `<<${l.namn}: id fylls i när steg 2 är genomfört, kör om --json>>`;
  const fas2 = [];
  for (const k of kampanjer.filter((x) => ['vaggloss', 'insekter', 'moss', 'foretag', 'getingar', 'myror'].includes(x.kort))) {
    const ops = byggKampanj(k, tmp, listor2);
    const kamp = ops[1].campaignOperation.create.resourceName;
    for (const kw of korsNeg(k)) ops.push({ campaignCriterionOperation: { create: { campaign: kamp, negative: true, keyword: kw } } });
    fas2.push(...ops);
  }
  skriv('2026-10-06_konto_3-fas2-bygg.json', hdr('', 'Kontoplan steg 6: Sök | Vägglöss, Sök | Insekter i hemmet, Sök | Möss, Sök | Företag och avtal, Sök | Getingar (säsong) och Sök | Myror (säsong), alla PAUSADE. Kopplas till de delade listorna från steg 2.', fas2));

  // 4. Start fas 1 och paus av gamla kampanjer
  const status = (id, s) => ({ campaignOperation: { update: { resourceName: `${C}/campaigns/${id}`, status: s }, updateMask: 'status' } });
  skriv('2026-10-06_konto_4-start-fas1.json', hdr('', 'Kontoplan steg 5 (körs samma dag som de nya kampanjerna startas i gränssnittet eller med status ENABLED): pausa gamla råttsöket, Råttbekämpning_PMax, den generella PMax-kampanjen och gamla fågelsöket. PMax Fåglar döps om och får budget 200 kr. Nya kampanjers id fylls i efter steg 2.', [
    status(GAMLA.rattSok, 'PAUSED'), status(GAMLA.rattPmax, 'PAUSED'), status(GAMLA.generellPmax, 'PAUSED'), status(GAMLA.fagelSok, 'PAUSED'),
    { campaignOperation: { update: { resourceName: `${C}/campaigns/${GAMLA.fagelPmax}`, name: 'PMax | Fåglar (övergång)' }, updateMask: 'name' } },
  ]));
  skriv('2026-10-06_konto_5-start-fas2.json', hdr('', 'Kontoplan steg 7: pausa gamla insektskampanjen, Möss, Myror och Getingar när de nya kampanjerna startas.', [
    status(GAMLA.insekter, 'PAUSED'), status(GAMLA.moss, 'PAUSED'), status(GAMLA.myror, 'PAUSED'), status(GAMLA.getingar, 'PAUSED'),
  ]));
}

if (process.argv.includes('--json')) { await skrivJson(); process.exit(0); }

// ---------- PDF ----------
// Bildmotiv, granskade av skadedjursexperten 2026-10-06 (rättade motiv står i rättad form).
const bildmotiv = [
  ['Råttor', 'Liggande', 'Låst grå betesstation tätt mot en husgrund längs löpvägen vid ett soprum. Locket stängt, inget innehåll och ingen logotyp synlig.'],
  ['Råttor', 'Kvadrat', 'Betongstation på en innergård med gatsten, eller vid en industri- eller offentlig fasad.'],
  ['Råttor', 'Stående', 'Händer i arbetshandskar som fäster finmaskigt rostfritt metallnät över en grundventil på en villagrund. Aldrig fogskum eller silikon.'],
  ['Råttor', 'Kvadrat', 'Tekniker bakifrån på knä vid en öppen rensbrunn av plast på en villatomt, ficklampa ned i brunnen. Ingen detalj av råttspärren.'],
  ['Råttor', 'Liggande', 'Levande brunråtta (Rattus norvegicus) ute vid en husgrund i skymning: gråbrun och kraftig, trubbig nos, små öron, svansen kortare än kroppen. Inte svartråtta, inte tamråtta.'],
  ['Fåglar', 'Liggande', 'Sträckt fågelnät utan glipor över en balkong på ett flerbostadshus, fäst i en ram. Ingen fågel i nätet.'],
  ['Fåglar', 'Kvadrat', 'Tamduvor (Columba livia f. domestica) på takfoten ovanför ett fönsterbleck som är täckt med piggar ända ut i kanten. Ingen duva bland piggarna.'],
  ['Fåglar', 'Liggande', 'Solpaneler med svart nät eller fågelband längs underkanten, fäst med clips i ramen, utan borrhål.'],
  ['Fåglar', 'Stående', 'Tekniker bakifrån i lift, eller i sele med förankrad lina och hjälm, som monterar vajer på låga stolpar några centimeter över nocken.'],
  ['Fåglar', 'Kvadrat', 'Gråtrutar (Larus argentatus) på ett tegeltak: stor, ljusgrå rygg, gul näbb med röd fläck, skära ben. Inget bo med ägg eller ungar.'],
  ['Fåglar', 'Liggande', 'Sanering av duvträck på en vind: engångsdräkt, helmask eller halvmask med P3-filter och glasögon, spillningen fuktas. Ingen högtryckstvätt, inga döda fåglar.'],
  ['Vägglöss', 'Kvadrat', 'Madrassöm i närbild, hand i nitrilhandske med ficklampa. Vägglus (Cimex lectularius): platt, oval, rödbrun, 4 till 5 mm. Svarta prickar, skal och vita ägg i sömmen.'],
  ['Vägglöss', 'Liggande', 'Ångbehandling av en sängram med smalt munstycke i fogar och skruvhål. Ingen märkning på utrustningen.'],
  ['Vägglöss', 'Liggande', 'Värmetält på ungefär 2,4 × 2,4 × 2,2 m med möbler inne i en lägenhet, aggregatet en halv meter stort, givarkablar synliga. Aldrig värmekanoner i ett öppet rum.'],
  ['Vägglöss', 'Kvadrat', 'Hund som söker vid en säng, föraren bakifrån. Ingen logotyp och ingen väst med text (hunden kommer via samarbetspartner).'],
  ['Insekter', 'Kvadrat', 'Långsprötad silverfisk (Ctenolepisma longicaudatum) vid en golvlist i torr miljö, gärna nära kartong. Antenner och stjärtspröt minst lika långa som kroppen.'],
  ['Insekter', 'Kvadrat', 'Vanlig silverfisk (Lepisma saccharinum), silverglänsande och droppformad, vid en golvbrunn eller fog i badrummet.'],
  ['Insekter', 'Liggande', 'Behandskad hand med en omärkt betesspruta som lägger en liten droppe gel i springan mellan golvlist och golv.'],
  ['Insekter', 'Kvadrat', 'Larv av brun pälsänger (Attagenus smirnovi) på en ullmatta: gyllenbrun, segmenterad, 7 till 10 mm, lång hårtofs bakåt, gärna med larvskinn bredvid.'],
  ['Insekter', 'Liggande', 'Behandskade händer som ångbehandlar golvlist och golvfog i en tömd garderob.'],
  ['Insekter', 'Liggande', 'Tömt, städat skafferi med rena hyllor, förberett för behandling.'],
  ['Insekter', 'Kvadrat', 'Kastanjebrun mjölbagge (Tribolium castaneum), rödbrun, 3 till 4 mm, i mjöl i en genomskinlig burk utan etikett. Ingen mjölmask.'],
  ['Möss', 'Kvadrat', 'Levande större skogsmus (Apodemus flavicollis) i mineralull på en villavind: brun rygg, vit buk, gul halsfläck, stora ögon och öron. Alternativ: husmus (Mus musculus) i källare eller kök.'],
  ['Möss', 'Stående', 'Händer som fäster finmaskigt metallnät över en springa vid grunden. Ingen fogmassa.'],
  ['Företag', 'Liggande', 'Låst station längs väggen intill en lastkajsport, tekniker bakifrån med surfplatta. Inga logotyper på byggnad eller fordon.'],
  ['Företag', 'Kvadrat', 'Surfplatta med en karta med färgade punkter, utan text och logotyp. Alternativ utanför Gemini: riktig skärmbild av kundportalens demokund med adressen dold.'],
  ['Getingar', 'Kvadrat', 'Vanlig geting (Vespula vulgaris): grått, rundat pappersbo under en takfot med ingångshål underifrån.'],
  ['Getingar', 'Stående', 'Tekniker bakifrån i skylift med sele förankrad i korgen, skyddsdräkt med nät för ansiktet, vid ett getingbo under takfoten.'],
  ['Myror', 'Kvadrat', 'Hästmyror (Camponotus herculeanus), svarta med rödbrun mellankropp, på en fuktig träregel med en hög fibrigt träspån nedanför. Inte borrmjöl.'],
];
const BILDER = tabell(['Kampanj', 'Format', 'Motiv (godkänt eller rättat av experten)'], bildmotiv.map((r) => r.map(esc)), ['12%', '11%', '77%']);
const GRANSKNING = `Skadedjursexperten granskade alla texter och bildmotiv 2026-10-06 mot faktabladen, TJANSTEINNEHALL (bara Belagt) och SKRIVGUIDE 13. Första omgången underkände "Takrunda inför häckningen" (takrunda är inget fast erbjudande) och rättade bland annat "Ofta hjälp redan samma dag" till "Ofta på plats redan samma dag" för råttor och möss (inspektion först), "Bon och spillning tas bort" till "Gamla bon tas bort" (fredade bon under häckningen), avloppsraden till "Vi ser till att skadan hittas och lagas" (underleverantör), metodraden för råttor utomhus till Christians metodnamn, ROT bara för privatpersoner och "Ånga, kiselgur och värmetält" (tältet kompletteras alltid). ROT-framhävningen ligger därför per annonsgrupp och aldrig hos BRF, företag, sanering eller skyddsjakt. Säljchefen prövade budskapen mot landningssidorna: "Skriftlig offert efter besöket" för fåglar (sidan och formuläret säger offert), en egen företagsgrupp till /skadedjursbekampning-foretag/, ?kundtyp=foretag för fastighetsgruppen, "Alla tekniker har 1SO" struken som jargong och "Vi packar tältet åt dig" i värmegruppen. Andra omgången hos experten godkände de ändrade raderna och rättade varumärkets fjärde beskrivning till "Du får teknikerns bedömning och ett pris innan vi börjar." (getingar, silverfisk och mjölbaggar letar vi ingen orsak för, och fåglar får offert). Framhävningen Kostnadsfri inspektion ligger per annonsgrupp och inte på avloppsgruppen. <b>Utfall: GODKÄND.</b>`;

const logoSrc = `data:image/jpeg;base64,${fs.readFileSync('Begone - Tyro group (1).jpeg').toString('base64')}`;
const textrader = (lista, max) => lista.map((t, i) => [String(i + 1), esc(t), `${t.length} / ${max}`]);
const sumBudget = kampanjer.reduce((p, k) => p + k.budget, 0) + 200;

const annonsAvsnitt = kampanjer.map((k, ki) => `
<h3>5.${ki + 1} ${esc(k.namn)}</h3>
${k.grupper.map((g) => `
<div class="grupp">
<p class="gr"><b>${esc(g.namn)}</b> · ${esc(g.avsikt)}<br><span class="muted">Slutadress: ${esc(g.url)} · Visad sökväg: begone.se/${esc(g.sokvag.join('/'))}${g.anm ? ' · ' + esc(g.anm) : ''}</span></p>
<div class="tva">
${tabell(['#', 'Rubrik', 'Tecken'], textrader(g.rubriker, 30), ['8%', '72%', '20%'])}
${tabell(['#', 'Beskrivning', 'Tecken'], textrader(g.beskrivningar, 90), ['8%', '72%', '20%'])}
</div>
</div>`).join('')}`).join('');

const sokordTabell = kampanjer.map((k) => k.grupper.map((g) => [
  `<b>${esc(k.namn.replace('Sök | ', ''))}</b><br>${esc(g.namn)}`,
  esc(g.avsikt),
  g.sokord.exakt.length ? esc(g.sokord.exakt.map((s) => `[${s}]`).join(', ')) : '<span class="muted">inga</span>',
  esc(g.sokord.fras.map((s) => `"${s}"`).join(', ')),
  esc(g.url.replace('https://begone.se', '')),
])).flat();

const html = `<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 20mm 16mm 18mm 16mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color: #1f2937; font-size: 10pt; line-height: 1.5; }
  .cover { height: 255mm; display: flex; flex-direction: column; page-break-after: always; position: relative; }
  .cover-top { display:flex; align-items:flex-start; justify-content:space-between; }
  .cover img { width: 150px; height: auto; }
  .cover-doctype { text-align:right; font-size: 9pt; letter-spacing: 1.5px; text-transform: uppercase; color:#6b7280; padding-top: 6px; }
  .cover-center { margin-top: auto; margin-bottom: auto; }
  .cover-kicker { color: ${BRAND}; font-weight: 700; font-size: 11pt; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 10px; }
  .cover h1 { font-size: 30pt; line-height:1.15; margin: 0 0 14px; color:#0f172a; font-weight: 700; }
  .cover .subtitle { font-size: 13pt; color:#475569; max-width: 85%; }
  .cover-rule { height: 4px; width: 70px; background: ${BRAND}; margin: 22px 0; border-radius:2px; }
  .cover-meta { font-size: 10pt; color:#475569; }
  .cover-meta div { margin-bottom: 3px; }
  .cover-meta b { color:#0f172a; font-weight:600; }
  .cover-footer { position:absolute; bottom:0; left:0; right:0; border-top:1px solid #e5e7eb; padding-top:8px; font-size: 8.5pt; color:#9ca3af; display:flex; justify-content:space-between; }
  h2 { font-size: 13.5pt; color:#0f172a; margin: 22px 0 8px; padding-bottom: 5px; border-bottom: 2px solid #e5e7eb; page-break-after: avoid; }
  h2 .num { color: ${BRAND}; font-weight:700; margin-right: 8px; }
  h3 { font-size: 11pt; color:#111827; margin: 14px 0 4px; page-break-after: avoid; }
  p { margin: 0 0 8px; }
  ul, ol { margin: 4px 0 10px; padding-left: 18px; }
  li { margin-bottom: 3px; }
  table { width:100%; border-collapse: collapse; margin: 6px 0 12px; font-size: 8.6pt; page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  th, td { border:1px solid #e5e7eb; padding: 4px 7px; text-align:left; vertical-align: top; }
  th { background:#f0fdf9; color:#0f172a; font-weight:600; }
  tr:nth-child(even) td { background:#fafafa; }
  .callout { background:#f0fdf9; border-left:4px solid ${BRAND}; padding:10px 14px; border-radius:4px; margin: 10px 0 14px; page-break-inside: avoid; }
  .callout .ct { font-weight:700; color:#0f172a; margin-bottom:2px; }
  .varning { background:#fff7ed; border-left:4px solid #f59e0b; padding:10px 14px; border-radius:4px; margin: 10px 0 14px; page-break-inside: avoid; }
  .varning .ct { font-weight:700; color:#0f172a; margin-bottom:2px; }
  .muted { color:#6b7280; font-size:8.6pt; }
  .nyckel { display:flex; gap:10px; margin: 8px 0 14px; }
  .nyckel div { flex:1; border:1px solid #e5e7eb; border-radius:4px; padding:8px 10px; }
  .nyckel b { display:block; font-size:14pt; color:#0f172a; }
  .nyckel span { font-size:8.5pt; color:#6b7280; }
  .brytsida { page-break-before: always; }
  .grupp { page-break-inside: avoid; margin-bottom: 6px; }
  .gr { margin: 8px 0 2px; }
  .tva table { margin: 2px 0 6px; }
  .liten table { font-size: 8pt; }
</style>
</head>
<body>

<section class="cover">
  <div class="cover-top">
    <img src="${logoSrc}" alt="Begone Skadedjur">
    <div class="cover-doctype">Internt underlag<br>Google Ads</div>
  </div>
  <div class="cover-center">
    <div class="cover-kicker">Kontoplan</div>
    <h1>Google Ads<br>från noll</h1>
    <div class="subtitle">Ny struktur för hela annonskontot: mätning, kampanjer, sökord, annonser, bilder och övergången från de gamla kampanjerna. Inget är ändrat i kontot.</div>
    <div class="cover-rule"></div>
    <div class="cover-meta">
      <div><b>Organisation:</b> Begone Skadedjur</div>
      <div><b>Annonskonto:</b> BeGone.se - Ny (940-760-4856)</div>
      <div><b>Datum:</b> ${DATUM}</div>
      <div><b>Version:</b> 1.0</div>
      <div><b>Status:</b> Förslag, väntar på Christians beslut</div>
      <div><b>Framtagen av:</b> Google Ads-specialisten</div>
      <div><b>Granskad av:</b> Skadedjursexperten (fakta, bilder) och säljchefen (budskap, landningssidor)</div>
    </div>
  </div>
  <div class="cover-footer">
    <span>Begone Skadedjur · Internt dokument</span>
    <span>Kontoplan Google Ads · v1.0 · ${DATUM}</span>
  </div>
</section>

<h2><span class="num">1.</span>Sammanfattning och rekommendation</h2>
<p>Kontot har fyra år av historik och 2,37 miljoner kronor i annonskostnad sedan juni 2022. Det har vuxit kampanj för kampanj, styrts av BrightBid och bjuder i dag på telefonklick som om de vore förfrågningar. Vi bygger därför ett nytt konto bredvid det gamla: nio sökkampanjer med tydliga namn, en kampanj per tjänst och annonsgrupper efter vad den som söker vill. Historiken använder vi som underlag för sökord, negativa sökord och vad en förfrågan får kosta.</p>

<div class="nyckel">
  <div><b>2,37 mkr</b><span>annonskostnad 2022-06 till 2026-10</span></div>
  <div><b>528 kr</b><span>per formulär för råttor 2024 (sök och PMax)</span></div>
  <div><b>845 kr</b><span>per formulär, råttsöket 2024</span></div>
  <div><b>1 av 111</b><span>samtal utanför vardagar 08 till 17 var 60 s eller längre</span></div>
</div>

<p>Det viktigaste vi lär oss ur historiken:</p>
<ul>
  <li><b>De billiga råttförfrågningarna kom till stor del från Performance Max och från sökningar på konkurrenter.</b> Råttornas Performance Max gav formulär för cirka 300 kr, men av de synliga söktermerna gick 40 047 kr av 53 354 kr (75 %) till Anticimex, Nomor och Rentokil, och i september 2024 registrerades 139 formulär på en månad för 135 kr styck. Det mönstret brukar betyda skräpformulär eller felklick. Råttsöket har legat på 770 till 850 kr per formulär varje år. Målet 300 till 600 kr är rimligt för hela råttarbetet, men bara om vi mäter riktiga förfrågningar och sedan bokade uppdrag.</li>
  <li><b>Mätningen har styrt fel.</b> Sedan mars 2024 har telefonklick (click_phone, click_akut) räknats som primära konverteringar, 2 644 stycken, medan riktiga samtal från annonser räknades som sekundära. Mellan 2026-09-23 och 2026-10-06 mättes ingenting.</li>
  <li><b>Fras och exakt matchning har gett billigare formulär än bred.</b> "bli av med råttor inomhus" som fras kostade 236 kr per formulär, "sanering råttor" som fras 492 kr mot 711 kr som bred.</li>
  <li><b>Formulären kommer dygnet runt och lika mycket på helger, men samtalen bara på kontorstid.</b> Formulär sent på kvällen var billigast (523 kr). Annonserna ska gå dygnet runt, samtalstillägget bara vardagar 08 till 17.</li>
</ul>

<div class="callout">
  <div class="ct">Rekommendation, i den här ordningen</div>
  <ol style="margin:4px 0 0">
    <li><b>Mätningen först (vecka 0).</b> Telefonklick blir sekundära, samtal från annons 60 s eller längre blir primära, och vi förbereder import av bokade och genomförda uppdrag från kundportalen.</li>
    <li><b>Råttsidan får formuläret först</b> innan råttkampanjen startar (säljchefen).</li>
    <li><b>Fas 1 (vecka 1):</b> Sök | Råttor, Sök | Fåglar och Sök | Varumärke byggs pausade, granskas och startas samma dag som gamla råttsöket, råttornas Performance Max, den generella Performance Max och gamla fågelsöket pausas. Fåglarnas Performance Max får gå kvar med 200 kr per dag tills vi kan jämföra bokade uppdrag.</li>
    <li><b>Fas 2 (vecka 2):</b> Sök | Vägglöss, Sök | Insekter i hemmet, Sök | Möss och Sök | Företag och avtal startas, de gamla motsvarigheterna pausas. Getingar och myror byggs men står pausade till säsongen.</li>
    <li><b>Vecka 4:</b> första utvärderingen och mål-CPA där underlaget räcker. <b>Vecka 8:</b> bokade uppdrag per kampanj, beslut om Performance Max för fåglar och om bredare matchning.</li>
  </ol>
</div>
<p>Total budget ligger kvar på ${kr(sumBudget)} per dag. Råttor får 1 550 kr, fåglar 1 000 kr (varav 200 kr Performance Max), insekter 1 050 kr, möss 450 kr, företag 200 kr och varumärket 180 kr.</p>

<h2 class="brytsida"><span class="num">2.</span>Lärdomar ur historiken</h2>

<h3>2.1 Underlaget och dess brister</h3>
<ul>
  <li><b>Det avslutade kontot 773-630-6196 går inte att läsa.</b> Google svarar CUSTOMER_NOT_ENABLED: kontot är avstängt och API:et ger ingen historik, inte heller via MCC. Vill vi se det måste det öppnas i gränssnittet (rapporter för avslutade konton kan ibland laddas ned där).</li>
  <li><b>Kontot 940-760-4856 har historik från juni 2022.</b> Allt nedan kommer därifrån: 528 kampanjmånader, 10 242 söktermer med klick, 2 153 sökord, 836 samtal från annonser.</li>
  <li><b>Formulär ifyllt</b> mätte gamla WordPress-sajtens formulär, utan uppgift om tjänst. Ett formulär från råttkampanjen kan alltså ha gällt något annat. Vi vet inte hur många som blev uppdrag.</li>
  <li><b>Telefonklick som primära.</b> click_phone, click_akut och click_phone_akut är GA4-händelser för klick på ett nummer (flera per besök möjligt), inte samtal. De räknas som primära sedan mars 2024. Calls from ads (riktiga samtal, minst 60 s) har varit sekundär sedan 2025.</li>
  <li><b>Glappet 2026-09-23 till 2026-10-06:</b> ingen tagg på nya sajten och nästan inga annonser 2026-09-24 till 2026-10-04. Perioden säger inget om konvertering.</li>
  <li><b>Misstänkt skräp i Performance Max.</b> September 2024: råttornas PMax 139 formulär, generella PMax 39, fåglarnas PMax 32 på en månad, långt över alla andra månader. Utan koppling till riktiga ärenden går det inte att skilja riktiga förfrågningar från skräp. Därför ska vi i fortsättningen bedöma kampanjerna på bokade uppdrag.</li>
</ul>

<h3>2.2 Kontot per år</h3>
${tabell(['År', 'Kostnad', 'Klick', 'Formulär', 'Samtal från annons', 'Telefonklick (GA4)', 'Kr per formulär'], [
  ['2022 (från juni)', kr(145738), '8 730', '180', '100', '', '810 kr'],
  ['2023', kr(414206), '27 167', '540', '48', '', '767 kr'],
  ['2024', kr(739578), '62 090', '1 105', '31', '1 271', '669 kr'],
  ['2025', kr(699242), '33 487', '902', '63', '780', '775 kr'],
  ['2026 (till 10-06)', kr(374861), '26 908', '525', '100', '593', '714 kr'],
], ['17%', '14%', '11%', '12%', '15%', '15%', '16%'])}
<p class="muted">Formulär = Formulär ifyllt och äldre formuläråtgärder. Samtal från annons räknas från 60 sekunder. Telefonklick är GA4-händelser, inte samtal.</p>

<h3>2.3 Per tjänst, 2024 till 2026</h3>
${tabell(['Tjänst', 'Kostnad', 'Formulär', 'Kr per formulär', 'Klickpris', 'Kommentar'], [
  ['Råttor (sök + PMax)', kr(541439), '852', '636 kr', '13 kr', 'Sök 771 till 1 398 kr per formulär, PMax 185 till 318 kr men mest konkurrentsökningar. 2026: 890 kr.'],
  ['Fåglar (sök + PMax)', kr(219210), '365', '601 kr', '11 kr', 'Sök 1 319 till 1 469 kr per formulär, PMax 133 till 285 kr. PMax-söktermerna syns bara till 13 %, resten är display och YouTube.'],
  ['Insekter (silverfisk, pälsänger, mjölbaggar, vägglöss)', kr(286379), '336', '852 kr', '23 kr', 'Pälsänger, silverfisk och mjölbaggar 270 till 630 kr. Värmebehandling av vägglöss 1 339 till 10 049 kr, sämst i kontot.'],
  ['Möss', kr(190750), '189', '1 009 kr', '13 kr', '"bli av med möss i" (fras) kostade 53 086 kr för 23 formulär. Mycket gör det själv-trafik.'],
  ['Getingar', kr(246157), '179', '1 375 kr', '41 kr', 'Säsong juli till september. "ta bort getingbo" bär allt.'],
  ['Myror', kr(55921), '82', '682 kr', '16 kr', 'Säsong maj till augusti.'],
  ['Varumärke (begone)', kr(48650), '115', '423 kr', '21 kr', 'Exakt [begone] 298 kr per formulär. Köps i dag dessutom i råttsöket och båda PMax.'],
  ['Generell PMax', kr(96370), '340', '283 kr', '5 kr', '24 365 kr av 48 830 kr synligt till konkurrentnamn.'],
  ['Skadedjursbekämpning, jour, övrigt', kr(128806), '74', '1 741 kr', '', 'Breda branschord och jour. Dyrt.'],
], ['17%', '11%', '9%', '10%', '8%', '45%'])}

<h3>2.4 Sökord som gav formulär till rimlig kostnad (2024 till 2026)</h3>
<div class="liten">
${tabell(['Tjänst', 'Sökord (matchning) · kostnad · formulär · kr per formulär'], [
  ['Råttor', 'bli av med råttor inomhus (fras) 1 654 kr · 7 · 236 kr; täta mot råttor (fras) 1 521 kr · 5 · 304 kr; bli av med råttor i trädgården (fras) 1 060 kr · 3 · 353 kr; råttbekämpning stockholm (exakt) 771 kr · 2 · 386 kr; sanering råttor (fras) 6 025 kr · 12 · 492 kr; råttsanering stockholm (exakt) 2 139 kr · 4 · 535 kr; råttor i huset (bred) 20 813 kr · 37 · 563 kr; bekämpa råttor (fras) 17 406 kr · 30 · 581 kr; bli av med råttor (fras) 12 078 kr · 21 · 589 kr; råttsanering (fras) 9 559 kr · 15 · 659 kr'],
  ['Fåglar', 'fågelskydd (bred) 563 kr · 3 · 188 kr; få bort måsar (fras) 555 kr · 2 · 277 kr; fågelbekämpning (fras) 852 kr · 2 · 426 kr; duvor solceller (bred) 1 843 kr · 3 · 614 kr; fågelskydd (fras) 1 869 kr · 3 · 623 kr; få bort duvor från balkongen (bred) 2 561 kr · 4 · 640 kr; sanera fågelspillning (fras) 2 651 kr · 3 · 884 kr; fågelskydd tak (bred) 5 768 kr · 6 · 961 kr. Dyrt: få bort duvor (bred) 1 496 kr, bli av med duvor (bred) 1 662 kr, skrämma bort fåglar 1 628 kr.'],
  ['Insekter', 'sanera silverfiskar (fras) 268 kr; bli av med pälsänger (fras) 4 258 kr · 16 · 275 kr; vägglushund pris (bred) 2 611 kr · 9 · 304 kr; bli av med mjölbaggar (fras) 5 235 kr · 16 · 327 kr; pälsänger sanering (fras) 393 kr; vägglushund (bred) 10 167 kr · 20 · 515 kr; bekämpa silverfisk (fras) 557 kr; sanering vägglöss (bred) 17 324 kr · 26 · 679 kr. Utan formulär: värmesanering vägglöss (fras) 8 055 kr, kackerlackor 3 357 kr.'],
  ['Möss', 'bli av med möss (fras) 83 310 kr · 126 · 664 kr; tätning för möss (bred) 671 kr; möss i väggarna (fras) 12 116 kr · 15 · 836 kr. Dyrt: utrota möss (bred) 1 406 kr, bli av med möss i (fras) 2 291 kr.'],
  ['Varumärke', 'begone (exakt) 13 821 kr · 46 · 298 kr; begone skadedjur & sanering ab (exakt) 318 kr; begone skadedjur (exakt) 384 kr. Som fras dyrare (512 till 1 981 kr).'],
], ['14%', '86%'])}
</div>

<h3>2.5 Söktermer: vad som fungerat och vad som läckt</h3>
${tabell(['Tjänst', 'Gav formulär', 'Slöseri utan formulär'], [
  ['Råttor', 'råttbekämpning (21), råttor i huset (22), sanering råttor (15), råttsanering (14), råttor i trädgården (10), bli av med råttor (11), råttbekämpning stockholm (8), råttsanering stockholm (8), få bort råttor i väggen (5)', 'saneringsfirma 1 846 kr, trygghansa skadedjur 1 328 kr, "40 råttor" 1 069 kr, antisimex se 809 kr, hur många råttor finns det i stockholm 698 kr, engelska sökningar, gift och fällor'],
  ['Fåglar', 'problem med duvor (4), fågelsanering (2), problem med duvor på balkongen (2), ta bort fågelbo under taket (2), problem med duvor på taket (2)', 'duvor på balkongen 4 327 kr, hur får man bort duvor från balkongen 1 219 kr, hur blir man av med duvor 1 133 kr, skrämma duvor, duvskrämma, fågelspik, insecta'],
  ['Insekter', 'sanering vägglöss (17), vägglöss sanering (13), värmebehandling vägglöss (13), sanera vägglöss (10), bli av med pälsängrar (9), bli av med silverfiskar (8), vägglushund pris (6)', 'fosfin vägglöss 1 065 kr, vägglöss norrköping 1 043 kr, långsprötad silverfisk bekämpning 762 kr, vägglusfälla 629 kr, mjölbagge (exakt) 730 kr'],
  ['Möss', 'möss i väggarna (6), bli av med möss (4), få bort möss från huset (3), bekämpa möss (2), möss på vinden (2)', 'få bort möss i väggarna 2 215 kr, vad gillar inte möss 872 kr, råttgift 864 kr, skrämma bort möss 819 kr, råttskrämma utomhus 720 kr'],
  ['Konkurrenter', 'anticimex gav 9 formulär och 14 samtal 2022 (kampanjen Konkurrenter)', 'I PMax: anticimex kontakt 19 920 kr, nomor kontakt 3 535 kr, rentokil kontakt 2 476 kr. Den som söker "kontakt" vill nå sitt bolag.'],
], ['12%', '44%', '44%'])}
<p>Google döljer en stor del av söktermerna. För råttsöket syntes söktermer för cirka 37 % av kostnaden de senaste 90 dagarna. Negativa listor byggs därför också på mönster (gör det själv, produkter, information), inte bara på det som syns.</p>

<h3>2.6 Geografi, enhet och tid (2024 till 2026)</h3>
${tabell(['Län', 'Kostnad', 'Formulär', 'Kr per formulär'], [
  ['Stockholms län', kr(1395566), '1 995', '699 kr'],
  ['Östergötlands län', kr(138181), '152', '912 kr'],
  ['Uppsala län', kr(110035), '164', '671 kr'],
  ['Södermanlands län', kr(70472), '94', '746 kr'],
  ['Gävleborgs län', kr(37325), '26', '1 436 kr'],
  ['Dalarnas län', kr(31899), '30', '1 063 kr'],
  ['Västmanlands och Örebro län (utanför våra län)', kr(28118), '66', '426 kr'],
], ['46%', '18%', '18%', '18%'])}
<p>Vi har betalat 28 118 kr för klick i två län där vi inte arbetar. Kampanjerna har haft inställningen intresse, inte bara närvaro. Det rättas i den nya strukturen. Gävleborg och Dalarna är dyra per formulär, men underlaget är litet och Smart Bidding bortser från budjusteringar per län. Vi justerar inte budet per län; vi följer kostnad per bokat uppdrag per län efter åtta veckor.</p>
${tabell(['Enhet', 'Kostnad', 'Klick', 'Formulär', 'Kr per formulär'], [
  ['Mobil', kr(1373052), '101 368', '2 009', '683 kr'],
  ['Dator', kr(409197), '12 374', '464', '882 kr'],
  ['Surfplatta', kr(31212), '8 738', '59', '529 kr'],
], ['28%', '18%', '18%', '18%', '18%'])}
${tabell(['Tid', 'Kostnad', 'Formulär', 'Samtal från annons', 'Kr per formulär'], [
  ['00 till 06', kr(95054), '170', '0', '560 kr'],
  ['06 till 08', kr(101837), '156', '3', '653 kr'],
  ['08 till 12', kr(555837), '636', '91', '874 kr'],
  ['12 till 17', kr(580210), '750', '98', '773 kr'],
  ['17 till 20', kr(248594), '376', '2', '661 kr'],
  ['20 till 24', kr(232148), '444', '1', '523 kr'],
], ['28%', '18%', '18%', '18%', '18%'])}
<p>Veckodagarna skiljer sig lite: måndag 697 kr per formulär, fredag 764 kr, lördag och söndag 728 till 729 kr. Av 360 samtal från annonser sedan 2025 kom 249 vardagar 08 till 17 (163 av dem 60 s eller längre). De 111 samtalen på kvällar och helger gav ett enda samtal över 60 sekunder.</p>

<div class="callout">
  <div class="ct">Slutsatser för den nya strukturen</div>
  <ul style="margin:4px 0 0">
    <li>Bedöm på riktiga förfrågningar och sedan bokade uppdrag, aldrig på klick på telefonnummer.</li>
    <li>Fras och exakt matchning för kärnsökorden. Bred matchning först när Smart Bidding har ren data och de negativa listorna är på plats.</li>
    <li>Inga konkurrentnamn, varken i sök eller via Performance Max.</li>
    <li>Annonserna dygnet runt, samtalstillägget vardagar 08 till 17, bara närvaro i våra sex län.</li>
    <li>Vägglöss i värmetält och breda branschord ("skadedjursbekämpning") har varit dyra. De får egna annonsgrupper eller utgår.</li>
  </ul>
</div>

<h2 class="brytsida"><span class="num">3.</span>Mätningen först</h2>
<p>Budgivningen kan bara bli så bra som det vi säger åt Google att jaga. Därför ändras mätningen innan någon ny kampanj startar.</p>

<h3>3.1 Konverteringsåtgärder</h3>
${tabell(['Åtgärd', 'I dag', 'Efter', 'Varför'], [
  ['Formulär ifyllt (webbplatsen)', 'Primär, en per klick, värde 1 400 kr, förbättrade konverteringar', '<b>Primär</b>, oförändrad', 'Det nya formuläret på begone.se, live sedan 2026-10-06.'],
  ['Calls from ads (samtal från annonsen)', 'Sekundär, flera per klick', '<b>Primär</b>, 60 s, en per klick, värde 1 400 kr', 'Riktiga samtal som varar minst en minut. Tilläggen visas bara vardagar 08 till 17.'],
  ['Samtal från webbplatsen 60 s (ny)', 'Finns inte', '<b>Primär</b>, kräver Googles vidarekopplingsnummer på sajten', 'Fångar den som klickar på annonsen och sedan ringer från sidan. Se 3.3.'],
  ['GA4 click_phone, click_akut, click_phone_akut', 'Primära', 'Sekundära (syns i kolumnen Alla konv.)', 'Klick, inte samtal. click_akut hör till jouren som inte finns.'],
  ['GA4 generate_lead', 'Primär', 'Sekundär', 'Dubbelräknar formulären om GA4 skickar samma händelse.'],
  ['Bokat uppdrag (kundportalen, ny)', 'Finns inte', 'Sekundär, offline-import', 'Första steget mot budgivning på riktiga affärer. Se 3.4.'],
  ['Genomfört uppdrag (kundportalen, ny)', 'Finns inte', 'Sekundär, offline-import med värde exkl. moms', 'Grund för värdebaserad budgivning.'],
  ['Kontots mål Övrigt och Sidvisning', 'Får styra budgivningen', 'Styr inte', 'Annars kan GA4-händelser smyga in som mål igen.'],
], ['24%', '22%', '24%', '30%'])}
<p><b>Värdet 1 400 kr</b> på formulär och samtal är ett schablonvärde från tidigare (säljchefen uppger att taggen på sajten skickar värdet 1 kr; det kontrolleras vecka 0). Det påverkar inget så länge vi bjuder på antal konverteringar, men ska spegla ett snittuppdrag exkl. moms när vi går över till värde. Christian beslutar värdet (avsnitt 8).</p>

<h3>3.2 Förbättrade konverteringar för leads</h3>
<p>Kontot har förbättrade konverteringar för leads påslaget och kunddatavillkoren godkända. Taggen skickar hashad e-post och telefon med Formulär ifyllt sedan 2026-10-06. Det gör att Google kan koppla en förfrågan till ett annonsklick även när klick-id saknas, och det är samma uppgifter som offline-importen matchar mot. Kontroll vecka 1: diagnostiken för förbättrade konverteringar i Google Ads ska visa matchade händelser.</p>

<h3>3.3 Samtal från webbplatsen</h3>
<p>Den som klickar på en annons, läser sidan och sedan ringer 010 280 44 10 syns i dag inte alls. Google kan byta numret på sidan mot ett vidarekopplingsnummer för besökare som kommit från en annons och räkna samtalet om det varar minst 60 sekunder. Det kräver en rad i taggen på begone.se (phone_conversion_number) och fungerar bara när besökaren har godkänt kakor, eftersom taggen laddas först då. Vi rekommenderar det, men det betyder att en del besökare ser ett annat nummer än 010-numret. Beslut från Christian.</p>

<h3>3.4 Offline-import från kundportalen</h3>
<p>Kundportalen har redan det som behövs: tabellen web_inquiries sparar gclid, gbraid, wbraid, utm-fälten, status, bokad_at, fakturerad_at och kopplingen till ärendet. Det som saknas är jobbet som skickar utfallen till Google.</p>
${tabell(['Steg', 'Händelse i kundportalen', 'Till Google', 'Värde'], [
  ['Förfrågan', 'Formuläret skickas (web_inquiries skapas)', 'Formulär ifyllt via taggen, direkt', 'Schablon tills vidare'],
  ['Bokat uppdrag', 'bokad_at sätts eller förfrågan kopplas till ett bokat ärende', 'Bokat uppdrag (kundportalen)', 'Inget värde, räknas i antal'],
  ['Genomfört uppdrag', 'Ärendet är klart och fakturerat (fakturerad_at)', 'Genomfört uppdrag (kundportalen)', 'Fakturerat belopp exkl. moms'],
  ['Offert skickad', 'offert_skickad_at sätts (fåglar, avtal och större ärenden)', 'Offert skickad (kundportalen), kan läggas till i steg 2', 'Inget värde'],
  ['Avtal', 'Offert signerad i Oneflow för en förfrågan från annons', 'Genomfört uppdrag med årspremien exkl. moms', 'Årspremien, sätts när avtalet signeras'],
], ['16%', '34%', '28%', '22%'])}
<ul>
  <li><b>Hur:</b> ett schemalagt jobb i kundportalen (api/cron) varje natt som laddar upp nya händelser med ConversionUploadService (uploadClickConversions) och gclid, gbraid eller wbraid. När klick-id saknas skickas hashad e-post och telefon (förbättrade konverteringar för leads). Varje uppladdning loggas så att inget skickas två gånger.</li>
  <li><b>Samtycke:</b> bara förfrågningar där besökaren godkände kakor för annonsmätning, och kunddata enligt Googles villkor. Integritetstexten på sajten ska nämna att vi mäter annonsernas resultat. Ingen remarketing.</li>
  <li><b>Skräp dras tillbaka:</b> förfrågningar som markeras som skräp, ligger utanför våra län (omrade_tackt false) eller är dubbletter justeras bort i Google (konverteringsjustering), så att budgivningen inte lär sig av dem.</li>
  <li><b>Fönster:</b> Google tar emot uppladdningar upp till 90 dagar efter klicket. Uppdrag som faktureras senare räknas inte.</li>
  <li><b>Samtal:</b> förfrågningar som kommer per telefon kan inte kopplas till klick i dag. Vi följer dem som andel i kundportalen.</li>
  <li><b>När budgivningen byter mål:</b> Bokat uppdrag blir primärt (och formulär sekundärt) när en kampanj har minst 15 till 20 bokade uppdrag per månad från annonser. Värdebaserad budgivning (Maximera konverteringsvärde) när det finns minst 30 genomförda uppdrag med värde per månad, troligen tidigast under första kvartalet 2027.</li>
</ul>

<h3>3.5 Förslagsfil</h3>
<p>docs/begone-se/ads/andringar/2026-10-06_konto_1-matning.json innehåller tio operationer: fyra åtgärder blir sekundära, Calls from ads blir primär med 60 s och en per klick, tre nya åtgärder skapas och två mål slutar styra budgivningen. De nya kampanjerna får ett slutadressuffix med utm_campaign={campaignid}, utm_content={adgroupid} och utm_term={keyword}, så att web_inquiries visar vilken annonsgrupp och vilket sökord som gav förfrågan. <b>Filen är inte provkörd.</b> Provkörningen (mutate.mjs utan --genomfor, som bara validerar) nekades av behörighetsspärren i den här sessionen och behöver köras i huvudsessionen innan den visas för godkännande.</p>

<h2 class="brytsida"><span class="num">4.</span>Kontostruktur</h2>

<h3>4.1 Kampanjerna</h3>
${tabell(['Kampanj', 'Roll', 'Budget per dag', 'Budstrategi', 'Start'], [
  ...kampanjer.map((k) => [`<b>${esc(k.namn)}</b>`, `${k.grupper.length} annonsgrupp${k.grupper.length > 1 ? 'er' : ''}: ${esc(k.grupper.map((g) => g.namn).join(', '))}`, k.budget ? kr(k.budget) : '0 kr (pausad)', esc(k.bud), esc(k.start)]),
  ['<b>PMax | Fåglar (övergång)</b>', 'Befintliga BrightBid PMax - Fågelsäkring, omdöpt och städad', kr(200), 'Maximera konverteringar, som i dag', 'Går vidare, utvärderas vecka 8'],
  ['<b>Summa</b>', '', `<b>${kr(sumBudget)}</b>`, '', ''],
], ['18%', '33%', '12%', '25%', '12%'])}
<p>Kampanjnamnen börjar med typen (Sök, PMax) och sedan tjänsten. BrightBid försvinner ur alla namn. Gamla kampanjer behåller sina namn tills de pausas och tas sedan bort efter åtta veckor, när vi inte behöver jämföra längre.</p>

<h3>4.2 Performance Max</h3>
<p>Ingen ny Performance Max vid start. Av de tre PMax-kampanjerna i dag har två köpt konkurrentnamn för mer än hälften av de synliga pengarna, och vi kan inte se om formulären blev affärer. Fåglarnas PMax är undantaget: den har gett formulär för 133 till 285 kr där fågelsöket kostat 1 300 till 1 500 kr, och den köper få konkurrentsökningar (2 256 kr av 6 412 kr synligt). Den får gå kvar med 200 kr per dag, med de här villkoren:</p>
<ul>
  <li>Kontonivåns negativa lista Konkurrenter gäller också PMax (ingår i steg 2).</li>
  <li>Varumärkesuteslutning med Begone, så att PMax inte tar våra egna varumärkessökningar. Varumärkeslistan skapas i gränssnittet; API:et kan inte lägga upp ett nytt varumärke.</li>
  <li>URL-utvidgningen stängs av eller begränsas till /tjanster/fagelsakring/, /tjanster/fagelspillning/ och /tjanster/skyddsjakt/.</li>
  <li>Bilderna byts mot expertgodkända fågelmotiv (avsnitt 6). Inga personer i bild.</li>
  <li>Vecka 8 jämför vi bokade uppdrag per krona med Sök | Fåglar. Ger PMax inte bokade uppdrag pausas den.</li>
</ul>
<p>En ny PMax för råttor prövas tidigast när offline-importen ger bokade uppdrag, så att vi bedömer den på affärer och inte på formulär.</p>

<h3>4.3 Annonsgrupper och sökord</h3>
<p>Fras och exakt matchning. Exakt för de sökord som bevisligen gett formulär, fras för resten. Bred matchning prövas tidigast vecka 8, en annonsgrupp i taget.</p>
<div class="liten">
${tabell(['Kampanj och annonsgrupp', 'Avsikt', 'Exakt', 'Fras', 'Landning'], sokordTabell, ['15%', '12%', '22%', '36%', '15%'])}
</div>
<p><b>Korsnegativa sökord</b> styr sökningen till rätt kampanj:</p>
${tabell(['Kampanj', 'Negativt (fras)'], korsnegativ.map(([a, b]) => [esc(a), esc(b)]), ['30%', '70%'])}

<h3>4.4 Delade negativa listor</h3>
<p>Alla som fras. Kopplas till alla sökkampanjer; varumärkeskampanjen får bara Konkurrenter, Information och Engelska. Listan Konkurrenter läggs också på kontonivå så att den gäller Performance Max. De gamla BrightBid-listorna (Brightbid - General, BrightBid account exclusion) följer inte med.</p>
<div class="liten">
${tabell(['Lista', 'Sökord'], negativaListor.map((l) => [`<b>${esc(l.namn)}</b>`, esc(l.ord.join(', '))]), ['24%', '76%'])}
</div>
<p class="muted">"akut" är medvetet inte negativt: den som söker akut hjälp dagtid kan vara en bra förfrågan även utan jour. Annonserna lovar ingen akut hjälp. Listan Jour tas bort när jouren startar.</p>

<h3>4.5 Geografi, språk och schema</h3>
<ul>
  <li><b>Län:</b> ${lan.join(', ')}. Alla kampanjer samma sex län.</li>
  <li><b>Platsalternativ:</b> bara närvaro (personer som är i eller regelbundet är i länen), inte intresse. Rättar läckan till Västmanland och Örebro.</li>
  <li><b>Budjustering per län:</b> ingen. Smart Bidding bortser från den, och underlaget utanför Stockholm är litet.</li>
  <li><b>Språk:</b> svenska. Engelska sökningar utesluts med negativa sökord.</li>
  <li><b>Schema:</b> annonserna dygnet runt alla dagar. Samtalstillägget bara måndag till fredag 08 till 17.</li>
  <li><b>Nätverk:</b> bara Google Sök, inga sökpartner och ingen display i sökkampanjerna.</li>
</ul>

<h3>4.6 Budstrategi per fas</h3>
${tabell(['Fas', 'När', 'Strategi', 'Byte sker när'], [
  ['Start', 'Vecka 1 till 4', 'Maximera konverteringar utan mål-CPA. Budgeten är taket. Varumärket: Maximera klick med tak 12 kr.', 'Kampanjen har minst 15 primära konverteringar på 30 dagar och ren mätning i minst två veckor.'],
  ['Styrning', 'Vecka 4 till 8 och framåt', 'Maximera konverteringar med mål-CPA, satt till faktisk kostnad per konvertering de senaste 30 dagarna. Sänks högst 10 till 15 % åt gången.', 'Råttor: start cirka 650 kr. Andra: efter utfallet.'],
  ['Affär', 'När offline-importen ger 15 till 20 bokade uppdrag per månad och kampanj', 'Bokat uppdrag blir primärt mål, formulär och samtal sekundära.', 'Bedöms vid vecka 8 och därefter månadsvis.'],
  ['Värde', 'Minst 30 genomförda uppdrag med värde per månad', 'Maximera konverteringsvärde med mål-ROAS.', 'Troligen första kvartalet 2027.'],
], ['12%', '20%', '40%', '28%'])}

<h3>4.7 Budget</h3>
${tabell(['Kampanj', 'I dag (gamla kampanjer)', 'Ny budget', 'Skäl'], [
  ['Råttor', '2 000 kr sök + 300 kr PMax', '1 550 kr', 'Högst prioritet. Det gamla söket spenderade aldrig mer än cirka 500 kr per dag med mål-CPA 800 kr. 1 550 kr ger utrymme utan mål-CPA under start.'],
  ['Fåglar', '200 kr sök + 100 kr PMax', '800 kr sök + 200 kr PMax', 'Prioriterat. Säsongen för fågelskydd är vår och försommar, men fågelspillning, solceller och skyddsjakt går året runt.'],
  ['Vägglöss', 'del av 300 kr insekter', '600 kr', 'Året runt, stor volym.'],
  ['Silverfisk, pälsänger, mjölbaggar', 'del av 300 kr insekter', '450 kr', 'Billigast per formulär i historiken.'],
  ['Möss', '10 kr', '450 kr', 'Hösten är mössens säsong.'],
  ['Varumärke', '0 kr (köps i andra kampanjer)', '180 kr', 'Billigare än att köpa begone i råttsöket och PMax.'],
  ['Företag och avtal', '0 kr', '200 kr', 'Liten test. Bedöms på bokade möten och avtal.'],
  ['Generell PMax', '1 500 kr', '0 kr (pausas)', 'Hälften till konkurrentnamn, mätt på telefonklick.'],
  ['Getingar och myror', '10 + 10 kr', '0 kr (pausade)', 'Säsong. Budget sätts inför maj och juni 2027.'],
], ['18%', '22%', '16%', '44%'])}
<p>Förväntan om allt går till förfrågningar för 700 kr i snitt: cirka sex förfrågningar per dag, 190 per månad. Budgeten ses över vecka 4 och flyttas till de kampanjer som ger bokade uppdrag billigast.</p>

<h2 class="brytsida"><span class="num">5.</span>Annonser och tillägg</h2>
<p>En responsiv sökannons per annonsgrupp, alla texter nedan ordagrant med teckenantal. Inga fästa rubriker, så att Google kan pröva kombinationerna. Ett andra annonsförslag per grupp kommer vecka 4 när vi ser vilka rubriker som drar.</p>
<div class="callout">
  <div class="ct">Granskning</div>
  <span id="granskning">GRANSKNING_TEXT</span>
</div>
${annonsAvsnitt}

<h3>5.${kampanjer.length + 1} Tillägg</h3>
<p><b>Webbplatslänkar</b> (länktext högst 25, rader högst 35):</p>
<div class="liten">
${tabell(['Kampanj', 'Länktext', 'Rad 1', 'Rad 2', 'Adress'], Object.entries(webbplatslankar).flatMap(([k, L]) => L.map((s) => [esc(k), `${esc(s[0])} (${s[0].length})`, `${esc(s[1])} (${s[1].length})`, `${esc(s[2])} (${s[2].length})`, esc(s[3].replace('https://begone.se', ''))])), ['10%', '20%', '24%', '24%', '22%'])}
</div>
<p><b>Framhävningar</b> (högst 25): ${Object.entries(framhavningar).map(([k, L]) => `<i>${esc(k)}:</i> ${L.map((t) => `${esc(t)} (${t.length})`).join(', ')}`).join('; ')}.</p>
<p><b>Strukturerade utdrag</b>, rubrik Tjänster: ${Object.entries(utdrag).map(([k, [, L]]) => `<i>${esc(k)}:</i> ${esc(L.join(', '))}`).join('; ')}.</p>
<p><b>Samtal:</b> 010 280 44 10 i alla kampanjer, måndag till fredag 08 till 17, kopplat till Calls from ads.</p>
<p><b>Bild:</b> se avsnitt 6. <b>Logotyp och företagsnamn:</b> Begones gröna symbol finns. Företagsnamnet BeGone Skadedjur är underkänt som tillgång och måste rättas under annonsörsverifiering i gränssnittet (skriv Begone Skadedjur). <b>Plats:</b> används inte. Företagsprofilen har dold adress som serviceområdesföretag, och adressen i Huddinge är ingen besöksadress.</p>

<h3>5.${kampanjer.length + 2} Landningssidorna (säljchefen)</h3>
<p>Fem tjänstesidor bryter i dag mot regeln att formuläret ska stå ovanför vikningen, och några lovar mer eller annat än annonsen. Säljchefen äger ändringarna; inget är byggt.</p>
${tabell(['#', 'Sida', 'Ändring', 'Klart före'], [
  ['1', 'rattbekampning.md', 'formular_forst: true. Heron visar i dag Ring först och raden om att vi ringer upp med ett pris, som inte gäller råttor. Med ändringen har formuläret råttor förvalt.', 'Start av Sök | Råttor'],
  ['2', 'Mallen Tjanst.astro', 'Skicka kundtyp=foretag till formuläret när sidans intent är företag, så att skyddsjakt och ?kundtyp=foretag fungerar. Med ?kundtyp=foretag får ROT inte visas.', 'Start av Sök | Fåglar'],
  ['3', 'fagelspillning.md', 'formular_forst: true, och motsägelsen mellan fast pris på sidan och offert i formuläret löses (Christian väljer modell).', 'Start av Sök | Fåglar'],
  ['4', 'skyddsjakt.md', 'formular_forst: true.', 'Start av Sök | Fåglar'],
  ['5', 'moss.md', 'Title, h1 och fem ställen till lovar kostnadsfri inspektion. Antingen bekräftar Christian att den är kostnadsfri för möss (då får annonsen säga det), eller så ändras sidan.', 'Start av Sök | Möss'],
  ['6', 'palsanger.md', 'Stryk "eller bokar en kostnadsfri inspektion" i kort_svar; pälsänger har ingen inspektion.', 'Fas 2'],
  ['7', 'vaggloss-sanering.md', 'Rensa flaggorna utan_telefonpris och kvittens_utan_telefonpris eller bekräfta pris per telefon.', 'Fas 2'],
  ['8', 'getingar.md och myror.md', 'formular_forst: true. Title, description och FAQ lovar kostnadsfri inspektion (och getingsidans FAQ länkar till jour), vilket strider mot fast pris per telefon.', 'Säsongen 2027'],
], ['5%', '20%', '55%', '20%'])}

<h2 class="brytsida"><span class="num">6.</span>Bilder</h2>
<p>Alla gamla bilder kopplas bort när kampanjerna byts. Nya bilder tas fram med Gemini och godkänns av skadedjursexperten innan de föreslås. Format: liggande 1,91:1 (1200 × 628), kvadrat 1:1 (1200 × 1200), stående 4:5 (960 × 1200, för PMax). Logotyp 1:1 finns.</p>
<div id="bilder">BILDER_TABELL</div>
<p>Får aldrig synas: ansikten, text i bilden, förpackningar eller etiketter, fällor där fälltypen går att se, döda djur, varumärken och ordet gift. Sökkampanjerna behöver minst fyra godkända bilder var (två liggande, två kvadratiska); PMax Fåglar behöver alla tre formaten.</p>

<h2 class="brytsida"><span class="num">7.</span>Lansering och övergång</h2>
${tabell(['Steg', 'Vad', 'Förslagsfil', 'Villkor'], [
  ['1', 'Mätningen: konverteringsåtgärderna enligt 3.1', '2026-10-06_konto_1-matning.json', 'Christians ja. Först av allt.'],
  ['2', 'Negativa listor och fas 1 byggs pausade: Sök | Råttor, Sök | Fåglar, Sök | Varumärke', '2026-10-06_konto_2-fas1-bygg.json', 'Christians ja. Provkörs först.'],
  ['3', 'Granskning i gränssnittet: annonserna godkända av Google (ett till två dygn, granskas även när kampanjen är pausad), annonsstyrka, tillägg. Råttsidan har formuläret först. Bilder godkända av experten.', '', 'Allt grönt'],
  ['4', 'Fas 1 startas och de gamla pausas samma dag: gamla råttsöket, Råttbekämpning_PMax, generell PMax och gamla fågelsöket. Fågel-PMax döps om, budget 200 kr, varumärkesuteslutning, URL-styrning.', '2026-10-06_konto_4-start-fas1.json', 'Samma dag, så att totalbudgeten inte dubbleras'],
  ['5', 'Fas 2 byggs pausade: Vägglöss, Insekter i hemmet, Möss, Företag och avtal, Getingar och Myror (säsong)', '2026-10-06_konto_3-fas2-bygg.json', 'Fas 1 har gått en vecka utan fel'],
  ['6', 'Fas 2 startas, gamla insekts-, möss-, myr- och getingkampanjerna pausas', '2026-10-06_konto_5-start-fas2.json', 'Annonserna godkända'],
  ['7', 'Offline-import byggs i kundportalen och slås på', '(kod, inte Ads-ändring)', 'Klart senast vecka 4'],
  ['8', 'Gamla kampanjer tas bort', '', 'Vecka 8, efter utvärderingen'],
], ['6%', '50%', '26%', '18%'])}

<h3>7.1 Vecka för vecka</h3>
${tabell(['När', 'Vad vi gör'], [
  ['Vecka 0', 'Mätningen ändras. Råttsidan får formuläret först. Fas 1 byggs pausad. Bilder tas fram och granskas.'],
  ['Vecka 1', 'Fas 1 startas och gamla pausas. Dagligen: att annonserna visas, kostnad mot budget, policystatus, söktermer (nya negativa). Kontroll av förbättrade konverteringar.'],
  ['Vecka 2', 'Fas 2 byggs och startas. Första söktermsgenomgången för fas 1 med negativa sökord. Uppföljning av samtalstillägget.'],
  ['Vecka 4', 'Första utvärderingen (rapport till Christian): kostnad per förfrågan per kampanj och annonsgrupp, visningsandel, söktermer, annonsernas rubriker. Mål-CPA där det finns minst 15 konverteringar på 30 dagar. Budgeten flyttas mellan kampanjer. Andra annonsen per grupp. Offline-importen igång.'],
  ['Vecka 8', 'Utvärdering på bokade uppdrag: kostnad per bokat uppdrag per tjänst och län, andel bokade. Beslut om PMax Fåglar, om bred matchning för råttor och om getingar och myror inför säsongen. Gamla kampanjer tas bort.'],
], ['14%', '86%'])}

<h3>7.2 Mål och nyckeltal</h3>
${tabell(['Kampanj', 'Historiskt per formulär (sök)', 'Mål per förfrågan vecka 1 till 8', 'Mål på sikt', 'Andel bokade'], [
  ['Råttor', '771 till 1 398 kr', 'högst 700 kr', '300 till 600 kr per förfrågan, mätt som kostnad per bokat uppdrag under 1 500 kr', 'minst 40 %'],
  ['Fåglar', '1 319 till 1 469 kr', 'högst 1 000 kr', 'högst 700 kr', 'minst 30 %'],
  ['Vägglöss', '565 till 1 700 kr', 'högst 900 kr', 'högst 700 kr', 'minst 40 %'],
  ['Insekter i hemmet', '270 till 630 kr', 'högst 550 kr', 'högst 450 kr', 'minst 50 %'],
  ['Möss', '664 till 1 060 kr', 'högst 850 kr', 'högst 650 kr', 'minst 40 %'],
  ['Varumärke', '298 till 384 kr', 'högst 350 kr', 'högst 300 kr', ''],
  ['Företag och avtal', 'saknas', 'mäts i bokade möten', 'ett avtal per månad', ''],
], ['16%', '19%', '19%', '30%', '16%'])}
<p>Förfrågan = formulär plus samtal från annons på minst 60 sekunder. Andel bokade = bokade uppdrag delat med förfrågningar från annonser, ur web_inquiries. Andelarna är startvärden; vi har inget tidigare utfall att jämföra med och justerar efter vecka 8.</p>

<h2><span class="num">8.</span>Beslut som behövs från Christian</h2>
<ol>
  <li>Godkänner du ordningen (mätning, fas 1, fas 2) och budgetfördelningen i 4.7?</li>
  <li>Mätningen (steg 1): får telefonklick bli sekundära och samtal från annons 60 s bli primära?</li>
  <li>Ska Google byta telefonnumret på sajten för besökare från annonser (samtal från webbplatsen, 3.3)?</li>
  <li>Får kundportalen skicka bokade och genomförda uppdrag till Google (hashade kontaktuppgifter, värde exkl. moms)? Behöver integritetstexten ändras?</li>
  <li>Vilket värde ska en förfrågan ha tills riktiga värden finns (i dag 1 400 kr)?</li>
  <li>Inga konkurrentnamn i annonseringen: håller du med?</li>
  <li>Får fåglarnas Performance Max gå kvar med 200 kr per dag till vecka 8, medan råttornas och den generella pausas?</li>
  <li>Getingar och myror pausade helt till säsongen 2027?</li>
  <li>Kan du rätta företagsnamnet under annonsörsverifiering i Google Ads (det kräver inloggning i gränssnittet)?</li>
  <li>Säljchefens sidändringar (avsnitt 5, landningssidorna) före respektive kampanjstart?</li>
  <li>Är inspektionen kostnadsfri för möss? Ska fågelspillning ha offert eller inspektion med fast pris? Gäller fast pris per telefon eller mejl också värmebehandling av vägglöss?</li>
</ol>

<p class="muted" style="margin-top:18px">Datum: ${DATUM} · Version 1.0 · Underlag: Google Ads API v25, hämtat 2026-10-06, hela historiken i kontot 940-760-4856. Data: docs/begone-se/ads/kontoplan-data.mjs. Förslagsfiler: docs/begone-se/ads/andringar/2026-10-06_konto_1-matning.json till _5-start-fas2.json (ej provkörda).</p>

</body>
</html>`;

const ut = html.replace('BILDER_TABELL', BILDER).replace('GRANSKNING_TEXT', GRANSKNING);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setContent(ut, { waitUntil: 'networkidle0' });
await page.pdf({ path: UTFIL, format: 'A4', printBackground: true, displayHeaderFooter: false, preferCSSPageSize: true });
await browser.close();
console.log('Skapade ' + UTFIL);
