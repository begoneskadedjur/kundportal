// Beslutsunderlag för den gemensamma starten av alla Claude-kampanjer i Google Ads.
// Kör: node gen-ads-start.mjs   (skriver Ads_Start_2026-10-07.pdf i repo-roten)
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import puppeteer from 'puppeteer-core';
import { annonserB } from './docs/begone-se/ads/annonser-b-data.mjs';
import * as pmax from './docs/begone-se/ads/pmax-fagel-data.mjs';

const sharp = createRequire('C:/Users/chris/begone-se/package.json')('sharp');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const logoSrc = `data:image/jpeg;base64,${fs.readFileSync('Begone - Tyro group (1).jpeg').toString('base64')}`;
const BRAND = '#20c58f';
const DATUM = '2026-10-07';
const UTFIL = `Ads_Start_${DATUM}.pdf`;
const ADS = 'docs/begone-se/ads';
const BILDER = `${ADS}/bilder`;
const manifest = JSON.parse(fs.readFileSync(`${BILDER}/manifest.json`, 'utf8'));
const fore = JSON.parse(fs.readFileSync(`${ADS}/pmax-fagel-fore-2026-10-07.json`, 'utf8'));
const las = (f) => JSON.parse(fs.readFileSync(`${ADS}/andringar/${f}`, 'utf8'));
const fas2 = las('2026-10-06_fas2-komplett.json');
const start = las('2026-10-06_start-alla.json');
const bort = las('2026-10-06_pmax-fagel-bilder-bort.json');

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tumme = async (fil, b = 420) => `data:image/jpeg;base64,${(await sharp(fil).resize(b).jpeg({ quality: 72 }).toBuffer()).toString('base64')}`;
const png = (fil) => `data:image/png;base64,${fs.readFileSync(fil).toString('base64')}`;

// ---------- Budget ----------
const budgetRader = [
  ['Claude | Sök | Råttor', 1550, 'Startas', 'Fas 1, byggd och pausad sedan 2026-10-06'],
  ['Claude | Sök | Fåglar', 800, 'Startas', 'Fas 1'],
  ['Claude | PMax | Fåglar (övergång)', 200, 'Går vidare (100 → 200 kr)', 'Byter namn från BrightBid PMax - Fågelsäkring, nya texter'],
  ['Claude | Sök | Varumärke', 180, 'Startas', 'Fas 1'],
  ['Claude | Sök | Vägglöss', 600, 'Byggs och startas', 'Fas 2'],
  ['Claude | Sök | Insekter i hemmet', 450, 'Byggs och startas', 'Fas 2: silverfisk, pälsänger, mjölbaggar'],
  ['Claude | Sök | Möss', 450, 'Byggs och startas', 'Fas 2'],
  ['Claude | Sök | Företag och avtal', 200, 'Byggs och startas', 'Fas 2'],
  ['Claude | Sök | Getingar (säsong)', 0, 'Byggs pausad', 'Startas inför säsongen 2027 (budget 10 kr i vila)'],
  ['Claude | Sök | Myror (säsong)', 0, 'Byggs pausad', 'Startas inför säsongen 2027 (budget 10 kr i vila)'],
];
const summaNy = budgetRader.reduce((s, r) => s + r[1], 0);
const gamla = [
  ['Claude | Råttbekämpning (gammal, rensad)', 2000], ['Brightbid - [Pmax] - Websites + Own Data + Generic Terms', 1500],
  ['BrightBid_High Priority_Råttbekämpning_PMax', 300], ['Brightbid - Standard - Silverfisk | Pälsänger | Mjölbaggar | Vägglöss', 300],
  ['BrightBid_High Priority_Fågelsäkring_Fågelbekämpning', 200], ['BrightBid PMax - Fågelsäkring (blir Claude | PMax | Fåglar)', 100],
  ['Brightbid - Standard - Möss', 10], ['Brightbid - Search - Getingar', 10], ['Brightbid - Standard - Myror', 10],
];
const summaGammal = gamla.reduce((s, r) => s + r[1], 0);
const kr = (n) => n.toLocaleString('sv-SE').replace(/\u00a0/g, ' ');

// ---------- Provkörningar ----------
const filer = [
  ['1', '2026-10-06_logotyp-namn.json', 18, 'OK', 'Nya logotyper och företagsnamnet BeGone: konto, fas 1, PMax Fåglar'],
  ['2', '2026-10-06_annonser-b-fas1.json', 11, 'OK', 'Annons B i elva annonsgrupper (Råttor, Fåglar, Varumärke)'],
  ['3', '2026-10-06_pmax-fagel-texter.json', 89, 'Ej provkörd: dagskvoten slut', 'Nya texter och tillägg i PMax Fåglar'],
  ['4', '2026-10-06_pmax-fagel-bilder-bort.json', 12, 'OK', 'De tolv gamla bilderna i PMax Fåglar bort'],
  ['5', '2026-10-06_fas2-komplett.json', fas2.operationer.length, 'Delvis: grunden (384 op) OK 2026-10-06, tilläggen ej provkörda (kvoten)', 'Fas 2 byggs pausad med annons A och B och bilder'],
  ['6', '2026-10-06_start-alla.json', start.operationer.length, 'OK (utan fas 2, se nedan)', 'Startar alla Claude-kampanjer, pausar alla gamla'],
];

// ---------- Bilder ----------
const fas2Bilder = manifest.filter((b) => b.fas === 2);
const godkanda = fas2Bilder.filter((b) => b.status === 'godkand');
const strukna = fas2Bilder.filter((b) => b.status === 'underkand');
const kopplingar = (id) => fas2.bildkopplingar.filter(([i]) => i === id).map(([, k]) => k.replace('Claude | Sök | ', ''));
const bildkort = [];
for (const b of godkanda) {
  bildkort.push(`<div class="bk"><img src="${await tumme(`${BILDER}/klara/${b.id}.jpg`)}"><div class="bt"><b>${esc(b.id)}</b><br>${esc(b.motiv)}<br><span class="muted">${b.format === '1:1' ? 'Kvadrat 1200 × 1200' : 'Liggande 1200 × 628'} · försök ${b.forsok} · ${esc(kopplingar(b.id).join(', '))}</span><div class="exp">${esc(b.kommentar)}</div></div></div>`);
}

// ---------- Annonstexter ----------
const kampanjOrdning = [...new Set(annonserB.map((a) => a.kampanj))];
const annonsTabell = (a) => `
<div class="annons">
  <div class="ah">${esc(a.kampanj.replace('Claude | Sök | ', ''))} · ${esc(a.grupp)}<span class="muted"> · ${esc(a.url.replace('https://begone.se', 'begone.se'))} · /${esc(a.sokvag.join('/'))}</span></div>
  <table class="txt">
    <tr><th style="width:4%">#</th><th style="width:44%">Rubrik</th><th style="width:5%">Tkn</th><th>Beskrivning</th><th style="width:5%">Tkn</th></tr>
    ${a.rubriker.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r)}</td><td>${r.length}</td><td>${a.beskrivningar[i] ? esc(a.beskrivningar[i]) : ''}</td><td>${a.beskrivningar[i] ? a.beskrivningar[i].length : ''}</td></tr>`).join('')}
  </table>
  ${a.anm ? `<div class="muted">${esc(a.anm)}</div>` : ''}
</div>`;

// ---------- PMax före och efter ----------
const foreTyp = (t) => fore.texter.filter((x) => x.typ === t).map((x) => x.text);
const fe = (rubrik, foreL, efterL) => `<tr><td><b>${rubrik}</b></td><td>${foreL.map(esc).join('<br>')}</td><td>${efterL.map((x) => `${esc(x)} <span class="muted">(${x.length})</span>`).join('<br>')}</td></tr>`;

const html = `<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 18mm 16mm 16mm 16mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color: #1f2937; font-size: 9.6pt; line-height: 1.45; }
  .cover { height: 258mm; display: flex; flex-direction: column; page-break-after: always; position: relative; }
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
  h2 { font-size: 13.5pt; color:#0f172a; margin: 18px 0 8px; padding-bottom: 5px; border-bottom: 2px solid #e5e7eb; page-break-after: avoid; }
  h2 .num { color: ${BRAND}; font-weight:700; margin-right: 8px; }
  h3 { font-size: 11pt; color:#0f172a; margin: 14px 0 6px; page-break-after: avoid; }
  p { margin: 0 0 8px; }
  ul, ol { margin: 4px 0 10px; padding-left: 18px; }
  li { margin-bottom: 3px; }
  table { width:100%; border-collapse: collapse; margin: 6px 0 12px; font-size: 8.8pt; }
  tr { page-break-inside: avoid; }
  th, td { border:1px solid #e5e7eb; padding: 4px 7px; text-align:left; vertical-align: top; }
  th { background:#f0fdf9; color:#0f172a; font-weight:600; }
  tr:nth-child(even) td { background:#fafafa; }
  td.num, th.num { text-align:right; }
  tr.summa td { font-weight:700; background:#f0fdf9 !important; }
  .callout { background:#f0fdf9; border-left:4px solid ${BRAND}; padding:10px 14px; border-radius:4px; margin: 10px 0 14px; page-break-inside: avoid; }
  .callout .ct { font-weight:700; color:#0f172a; margin-bottom:2px; }
  .varning { background:#fffbeb; border-left:4px solid #f59e0b; padding:10px 14px; border-radius:4px; margin: 10px 0 14px; page-break-inside: avoid; }
  .nyckel { display:flex; gap:10px; margin: 8px 0 14px; }
  .nyckel div { flex:1; border:1px solid #e5e7eb; border-radius:4px; padding:8px 10px; }
  .nyckel b { display:block; font-size:14pt; color:#0f172a; }
  .nyckel span { font-size:8.5pt; color:#6b7280; }
  .brytsida { page-break-before: always; }
  .annons { margin-bottom: 10px; page-break-inside: avoid; }
  .annons .ah { font-weight:700; color:#0f172a; border-bottom: 2px solid ${BRAND}; padding-bottom: 2px; margin-bottom: 3px; }
  table.txt { font-size: 8.2pt; margin: 3px 0 4px; }
  table.txt td, table.txt th { padding: 2px 5px; }
  .bilder { display:flex; flex-wrap:wrap; gap:8px; }
  .bk { width: calc(50% - 4px); border:1px solid #e5e7eb; border-radius:4px; padding:6px; page-break-inside: avoid; font-size: 8.2pt; }
  .bk img { width:100%; max-height: 62mm; object-fit: contain; background:#f8fafc; display:block; margin-bottom:4px; }
  .bk .exp { background:#f0fdf9; padding:4px 6px; border-radius:3px; margin-top:4px; }
  .logos { display:flex; gap:12px; align-items:flex-start; }
  .logos div { border:1px solid #e5e7eb; padding:6px; border-radius:4px; font-size:8.5pt; }
  .muted { color:#6b7280; font-size:8.4pt; font-weight:400; }
  .sign { margin-top: 16px; border:1px solid #e5e7eb; border-radius:4px; padding: 12px 14px; page-break-inside: avoid; }
  .sign .kol { display:flex; gap: 30px; margin-top: 26px; }
  .sign .kol div { flex:1; border-top:1px solid #9ca3af; padding-top:4px; font-size:8.5pt; color:#6b7280; }
</style>
</head>
<body>

<section class="cover">
  <div class="cover-top">
    <img src="${logoSrc}" alt="Begone Skadedjur">
    <div class="cover-doctype">Beslutsunderlag<br>Google Ads</div>
  </div>
  <div class="cover-center">
    <div class="cover-kicker">Gemensam start</div>
    <h1>Alla Claude-kampanjer<br>startar samtidigt</h1>
    <div class="subtitle">Fas 1 och fas 2 i ett svep: två annonser i varje annonsgrupp, nya logotyper och företagsnamn, bilder till fas 2 och en rensad PMax för fåglar. De gamla kampanjerna pausas samma minut.</div>
    <div class="cover-rule"></div>
    <div class="cover-meta">
      <div><b>Organisation:</b> Begone Skadedjur</div>
      <div><b>Annonskonto:</b> BeGone.se - Ny (940-760-4856)</div>
      <div><b>Datum:</b> ${DATUM}</div>
      <div><b>Version:</b> 1.0</div>
      <div><b>Status:</b> Förslag, inget är genomfört</div>
      <div><b>Framtagen av:</b> Google Ads-specialisten</div>
      <div><b>Granskad av:</b> Skadedjursexperten (texter och bilder)</div>
    </div>
  </div>
  <div class="cover-footer">
    <span>Begone Skadedjur · Internt dokument</span>
    <span>Gemensam start · v1.0 · ${DATUM}</span>
  </div>
</section>

<h2><span class="num">1.</span>Sammanfattning</h2>
<div class="nyckel">
  <div><b>${kr(summaNy)} kr</b><span>dagsbudget efter start (i dag ${kr(summaGammal)} kr)</span></div>
  <div><b>8</b><span>kampanjer igång, alla med Claude i namnet</span></div>
  <div><b>9</b><span>gamla kampanjer pausas eller tas över</span></div>
  <div><b>21</b><span>nya annonser (annons B)</span></div>
</div>
<p>Vi startar allt på en gång i stället för fas 1 nu och fas 2 om en vecka. Totalen ligger kvar på ${kr(summaNy)} kr per dag. Pengarna flyttas från de två stora PMax-kampanjerna och det gamla råttsöket till sökkampanjer per tjänst, där vi vet vad annonsen säger och vilken sida den leder till.</p>
<p>Varje annonsgrupp får en andra annons. Annons A (godkänd tidigare) beskriver processen: symptom, inspektion och metod. Annons B lyfter kvaliteten: erfarna skadedjurstekniker, ISO 9001 och 14001 och att vi följer upp tills skadedjuren är borta (inte för pälsänger, där uppföljning inte görs som rutin). Google får då två olika budskap att pröva mot varandra.</p>
<div class="callout">
  <div class="ct">Förslag</div>
  Godkänn alla sex filerna i avsnitt 8 i ett svep. Vi kör dem i den ordning som står där, samma dag, och avslutar med startfilen så att gamla och nya kampanjer aldrig går samtidigt.
</div>
<div class="varning">
  <b>Två filer är inte färdigprovkörda.</b> Explorer-nivån tillåter 2 880 operationer per dygn och även provkörningar räknas. Kvoten tog slut under arbetet i går kväll. PMax-texterna (89 operationer) och tilläggen i fas 2-filen (39 av 423 operationer) provkörs när kvoten har återställts, före genomförandet. Startfilen provkörs en gång till när fas 2 är byggd, eftersom de fyra nya kampanjernas id behövs.
</div>

<h2><span class="num">2.</span>Företagsnamnet</h2>
<p>Google har granskat sex varianter av företagsnamnet. Resultatet ur API:et (asset.field_type_policy_summaries):</p>
<table>
<tr><th>Namn</th><th>Tillgång</th><th>Status som företagsnamn</th><th>Skäl</th></tr>
<tr><td>BeGone</td><td>112323469970</td><td><b>Godkänt</b></td><td></td></tr>
<tr><td>Begone</td><td>43060816540</td><td><b>Godkänt</b></td><td></td></tr>
<tr><td>BeGone AB</td><td>218246566258</td><td>Godkänt</td><td></td></tr>
<tr><td>Begone.se</td><td>80817606500</td><td>Godkänt (skapat automatiskt)</td><td></td></tr>
<tr><td>BeGone Skadedjur</td><td>40472371487</td><td>Underkänt</td><td>BUSINESS_NAME_IRRELEVANCE</td></tr>
<tr><td>Begone Skadedjur</td><td>69900569157</td><td>Underkänt i sök, begränsat i PMax</td><td>BUSINESS_NAME_IRRELEVANCE</td></tr>
<tr><td>BeGone Skadedjur &amp; Sanering</td><td>40472371550</td><td>Används inte</td><td>27 tecken, taket är 25</td></tr>
</table>
<p>Det stämmer alltså inte att Begone och BeGone har underkänts. De är godkända och går i flera gamla kampanjer. Det som fälls är varianterna med "Skadedjur". BUSINESS_NAME_IRRELEVANCE betyder att namnet inte matchar det som Google kopplar till annonsören (den verifierade annonsören och domänen begone.se). "Skadedjur" läses som en beskrivning som lagts till namnet.</p>
<div class="callout"><div class="ct">Rekommendation: BeGone</div>Samma stavning som logotypen, redan godkänt, 6 tecken. Vi använder den befintliga tillgången 112323469970, så ingen ny granskning behövs. I annonstexterna står "Begone Skadedjur" kvar som rubrik, där det är tillåtet.</div>

<h2 class="brytsida"><span class="num">3.</span>Kampanjer och budget efter start</h2>
<table>
<tr><th>Kampanj</th><th class="num">Kr per dag</th><th>Åtgärd</th><th>Kommentar</th></tr>
${budgetRader.map((r) => `<tr><td>${esc(r[0])}</td><td class="num">${r[1] ? kr(r[1]) : '0'}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`).join('')}
<tr class="summa"><td>Summa i gång</td><td class="num">${kr(summaNy)}</td><td></td><td>Oförändrad total</td></tr>
</table>
<h3>Pausas samma minut</h3>
<table>
<tr><th>Kampanj</th><th class="num">Kr per dag i dag</th></tr>
${gamla.map((r) => `<tr><td>${esc(r[0])}</td><td class="num">${kr(r[1])}</td></tr>`).join('')}
<tr class="summa"><td>Summa i dag</td><td class="num">${kr(summaGammal)}</td></tr>
</table>
<p>Fördelningen följer kontoplanen utan justering. Råttor och fåglar får 2 550 kr (58 procent), insekter och vägglöss 1 050 kr, möss 450 kr. Råttsöket använde inte sina 2 000 kr (visningsandelen tappades på rankning, inte på budget), så 1 550 kr räcker. Den generella PMax-kampanjen på 1 500 kr köpte mest konkurrent- och varumärkessökningar; de pengarna går nu till sökkampanjer per tjänst.</p>
<p>Budstrategi: Maximera konverteringar utan mål-CPA de första fyra veckorna (Varumärke: Maximera klick med tak 12 kr). Mätningen är ren sedan 2026-10-06, så vi byter inte strategi förrän det finns två till fyra veckors data.</p>
<p><b>Negativa listor:</b> fas 2 kopplas till åtta delade listor. Neg | Konkurrenter kopplas inte per kampanj längre, eftersom kontolistan Konto | Konkurrenter (18 namn) redan gäller hela kontot, även PMax.</p>

<h2 class="brytsida"><span class="num">4.</span>Annons B, ordagrant</h2>
<p>Rubrik högst 30 tecken, beskrivning högst 90. Skadedjursexperten underkände första versionen och rättade elva rader (bland annat 1 till 3 dygn i värmetältet, ingen uppföljning för pälsänger, "gamla bon" för fåglarna, "pris per telefon" för fågelspillning). Versionen nedan är godkänd. Getingar och myror får ingen annons B nu, de står pausade till säsongen.</p>
${kampanjOrdning.map((k) => `<h3>${esc(k)}</h3>${annonserB.filter((a) => a.kampanj === k).map(annonsTabell).join('')}`).join('')}

<h2 class="brytsida"><span class="num">5.</span>Logotyper</h2>
<p>Gjorda ur ordbilden i begone-se (3561 × 648, transparent) med sharp. Ordbilden är oförändrad, bara centrerad på vit botten med luft runt om.</p>
<div class="logos">
  <div><img src="${png(`${BILDER}/klara/logo-1x1.png`)}" style="width:62mm;border:1px solid #e5e7eb"><br>logo-1x1.png, 1200 × 1200</div>
  <div><img src="${png(`${BILDER}/klara/logo-4x1.png`)}" style="width:96mm;border:1px solid #e5e7eb"><br>logo-4x1.png, 1200 × 300</div>
</div>
<ul>
  <li><b>Kontonivå:</b> ny företagslogotyp (ersätter 192 × 192 från 2022) och företagsnamnet BeGone. Alla sökkampanjer utan egna ärver dem, även fas 2.</li>
  <li><b>Claude | Sök | Råttor, Fåglar, Varumärke:</b> logotypen och BeGone direkt på kampanjen.</li>
  <li><b>PMax Fåglar:</b> kvadrat som LOGO, liggande som LANDSCAPE_LOGO. Taket är fem logotyper, så de tre minsta gamla (32 × 32, 150 × 150 från Instagram och 192 × 192) tas bort. Begone Skadedjur byts mot BeGone.</li>
</ul>

<h2 class="brytsida"><span class="num">6.</span>Bilder fas 2</h2>
<div class="nyckel">
  <div><b>${fas2Bilder.length}</b><span>bilder i fas 2</span></div>
  <div><b>${godkanda.length}</b><span>godkända av experten</span></div>
  <div><b>${strukna.length}</b><span>struken efter tre försök</span></div>
  <div><b>${fas2Bilder.reduce((s, b) => s + (b.forsok || 0), 0)}</b><span>genereringar i Gemini</span></div>
</div>
<p>Samma flöde som fas 1: Gemini med stilraden ur BILDNORM (inga personer, ingen text), högst tre försök, experten granskar varje bild. Bilderna laddas upp i fas 2-filen och kopplas som bildtillägg. I Vägglöss och Insekter i hemmet kopplas de per annonsgrupp, så att den som söker silverfisk inte får se pälsängerlarver. Möss och Företag får sina bilder på kampanjnivå.</p>
<div class="bilder">${bildkort.join('')}</div>
${strukna.length ? `<p style="margin-top:8px"><b>Struken:</b> ${strukna.map((b) => `${esc(b.id)}: ${esc(b.kommentar)}`).join(' ')}</p>` : ''}
<p class="muted">Underkända försök i omgång 1 och 2: värmetältet (campingtält med bäddad säng, sedan öppen bakvägg), silverfisk kvadrat (såg ut som en gråsugga), lagret (ingen station), gårdsstationen (kista med hänglås, sedan text på dörren), mjölbaggarna liggande (fel skala i alla tre försöken). Alla försök finns i manifest.json med orsak.</p>

<h2 class="brytsida"><span class="num">7.</span>Claude | PMax | Fåglar (övergång): rensning</h2>
<p>Kampanjen går kvar till vecka 8 med 200 kr per dag. BrightBids texter har inga ord om garanti eller jour, men flera påståenden vi inte kan belägga eller som strider mot skrivreglerna: "Hundratals nöjda kunder", "Snabb återkoppling", "Alltid ett steg före skadedjuren", "en miljö fri från skadedjur", "riktiga experter", tankstreck i en lång rubrik, och i tilläggen "Få hjälp inom 48 timmar", "I hela Stockholms Län" och "Miljövänligt". Allt byts.</p>
<table>
<tr><th style="width:14%">Fält</th><th style="width:43%">Före (tas bort)</th><th>Efter (granskat av experten, tecken)</th></tr>
${fe('Rubriker', foreTyp('HEADLINE'), pmax.rubriker)}
${fe('Långa rubriker', foreTyp('LONG_HEADLINE'), pmax.langaRubriker)}
${fe('Beskrivningar', foreTyp('DESCRIPTION'), pmax.beskrivningar)}
<tr><td><b>Sitelänkar</b></td><td>Skadedjur &amp; Sanering (I hela Stockholms Län)<br>Vad kan vi hjälpa er med?<br>Artiklar (underkänd)<br>Kontakta oss idag (Få svar inom 48 timmar, underkänd)</td><td>Fågelsökets: Kostnadsfri inspektion, Fågelspillning, Skyddsjakt</td></tr>
<tr><td><b>Framhävningar</b></td><td>Få hjälp inom 48 timmar<br>Miljövänligt<br>Skräddarsydda lösningar<br>Effektiva metoder</td><td>Kostnadsfri inspektion, Arbete på hög höjd, ISO 9001 och ISO 14001, Rapport när du behöver, Erfarna tekniker</td></tr>
<tr><td><b>Övrigt</b></td><td>Samtalstillägg utan schema<br>Företagsnamn Begone Skadedjur</td><td>Utdrag Tjänster (Fågelnät, Piggar, Vajer ...), samtalstillägg vardagar 08 till 17, företagsnamn BeGone</td></tr>
</table>
<h3>Gamla bilder bort (egen fil)</h3>
<p>De sex bilderna från fas 1 är godkända av Google och visas. ${bort.operationer.length} gamla bilder kopplas bort, så att PMax bara visar granskade bilder: ${bort.bilder.map((b) => esc(b.split(' ').slice(2).join(' ') || b)).join('; ')}. YouTube-filmerna (två) ligger kvar; de behöver ses igenom separat.</p>

<h2 class="brytsida"><span class="num">8.</span>Filer, provkörning och körordning</h2>
<p>Alla filer ligger i docs/begone-se/ads/andringar/ och byggs om med <i>node --env-file=.env.local scripts/ads/bygg-start.mjs</i>.</p>
<table>
<tr><th>Ordning</th><th>Fil</th><th class="num">Op</th><th>Provkörning</th><th>Innehåll</th></tr>
${filer.map((f) => `<tr><td>${f[0]}</td><td>${esc(f[1])}</td><td class="num">${f[2]}</td><td>${esc(f[3])}</td><td>${esc(f[4])}</td></tr>`).join('')}
</table>
<ol>
  <li>Provkör fil 3 och 5 när kvoten har återställts. Faller något, rättar vi och visar ändringen innan vi går vidare.</li>
  <li>Genomför fil 1 till 5 i ordning. Fas 2 står pausad efter fil 5.</li>
  <li>Kör <i>bygg-start.mjs --bara-start</i>. Den slår upp de fyra nya kampanjernas id och lägger dem i startfilen (17 operationer), utan att röra de andra filerna. Provkör.</li>
  <li>Genomför startfilen. Den startar sju sökkampanjer, döper om PMax Fåglar och sätter 200 kr, och pausar de åtta gamla i samma anrop. Lyckas inte allt, ändras inget.</li>
</ol>
<p>Hela starten är cirka 580 operationer, varav provkörningarna lika många. Det ryms i en dygnskvot om inget annat körs samma dag.</p>

<h2><span class="num">9.</span>Mätning och uppföljning</h2>
<ul>
  <li><b>Dag 1 och 2:</b> policystatus på alla nya annonser, logotyper, företagsnamnet och bilder. Annons A i fas 1 är godkänd sedan 2026-10-06.</li>
  <li><b>Vecka 1:</b> söktermer per kampanj, nya negativa sökord. Formulär ifyllt, Calls from ads 60 s och Samtal från webbplatsen kopplas till web_inquiries via gclid och utm_campaign.</li>
  <li><b>Vecka 2 (2026-10-21):</b> annons A mot B per grupp (CTR och konverteringar), budget mellan kampanjerna inom 4 430 kr.</li>
  <li><b>Vecka 4 (2026-11-04):</b> mål-CPA per kampanj om data räcker. Bokat uppdrag blir primärt vid 15 till 20 bokade i månaden.</li>
  <li><b>Vecka 8:</b> beslut om PMax Fåglar ska stängas eller få en ny tillgångsgrupp.</li>
</ul>

<div class="sign">
  <b>Beslut</b>
  <div class="kol"><div>Framtagen av: Google Ads-specialisten</div><div>Godkänd av: Christian</div></div>
  <div class="muted" style="margin-top:10px">Datum · Signatur · Version 1.0</div>
</div>

</body>
</html>`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'load' });
await page.pdf({ path: UTFIL, format: 'A4', printBackground: true, preferCSSPageSize: true });
await browser.close();
fs.writeFileSync('C:/Users/chris/AppData/Local/Temp/claude/c--Users-chris-begone-kundportal/c6229f2f-ee31-4459-8d69-8fde83868ab3/scratchpad/Ads_Start_kontroll.html', html);
console.log(`${UTFIL} skriven`);
