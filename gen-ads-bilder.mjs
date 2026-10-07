// Kontaktark för annonsbilder i Google Ads (fas 1), ur docs/begone-se/ads/bilder/manifest.json.
// Kör: node gen-ads-bilder.mjs   (skriver Ads_Bilder_2026-10-06.pdf i repo-roten)
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import puppeteer from 'puppeteer-core';

const sharp = createRequire('C:/Users/chris/begone-se/package.json')('sharp');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const logoSrc = `data:image/jpeg;base64,${fs.readFileSync('Begone - Tyro group (1).jpeg').toString('base64')}`;
const BRAND = '#20c58f';
const DATUM = '2026-10-06';
const UTFIL = `Ads_Bilder_${DATUM}.pdf`;
const MAPP = 'docs/begone-se/ads/bilder';
const manifest = JSON.parse(fs.readFileSync(path.join(MAPP, 'manifest.json'), 'utf8'));
const forslag = JSON.parse(fs.readFileSync('docs/begone-se/ads/andringar/2026-10-06_bilder-fas1.json', 'utf8'));

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const FORMATNAMN = { '1.91:1': 'Liggande 1,91:1 (1200 × 628)', '1:1': 'Kvadrat 1:1 (1200 × 1200)', '4:5': 'Stående 4:5 (960 × 1200)' };
const bildSrc = (id) => `data:image/jpeg;base64,${fs.readFileSync(path.join(MAPP, 'klara', `${id}.jpg`)).toString('base64')}`;
const tumme = async (fil) => `data:image/jpeg;base64,${(await sharp(fil).resize(360).jpeg({ quality: 70 }).toBuffer()).toString('base64')}`;

const godkanda = manifest.filter((b) => b.status === 'godkand');
const strukna = manifest.filter((b) => b.status === 'underkand');
const forsokTotalt = manifest.reduce((s, b) => s + (b.forsok || 0), 0);
const kopplingarPer = (id) => forslag.kopplingar.filter(([i]) => i === id).map(([, k]) => k);

const grupper = [
  ['Råttor', (b) => b.id.startsWith('ratt-')],
  ['Fåglar', (b) => b.id.startsWith('fagel-')],
  ['Varumärke och allmänt', (b) => b.id.startsWith('allm-')],
];

const kort = (b) => `
<div class="kort">
  <div class="bild"><img src="${bildSrc(b.id)}"></div>
  <div class="text">
    <div class="id">${esc(b.id)}</div>
    <div><b>Motiv:</b> ${esc(b.motiv)}</div>
    <div><b>Format:</b> ${FORMATNAMN[b.format]}</div>
    <div><b>Kopplas till:</b> ${esc(kopplingarPer(b.id).join(', ') || 'ingen kampanj i fas 1')}</div>
    <div><b>Försök:</b> ${b.forsok}</div>
    <div class="exp"><b>Skadedjursexperten:</b> ${esc(b.kommentar)}</div>
  </div>
</div>`;

// Underkända försök: alla försök som inte blev den valda bilden, med orsak ur historiken.
const underkandaRader = [];
for (const b of manifest) {
  const hist = b.historik || [];
  for (let i = 0; i < hist.length; i++) {
    const fil = path.join(MAPP, 'original', `${b.id}-f${i + 1}.png`);
    underkandaRader.push({ id: b.id, forsok: i + 1, orsak: hist[i], tumme: fs.existsSync(fil) ? await tumme(fil) : '' });
  }
}

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
  p { margin: 0 0 8px; }
  ul { margin: 4px 0 10px; padding-left: 18px; }
  li { margin-bottom: 3px; }
  table { width:100%; border-collapse: collapse; margin: 6px 0 12px; font-size: 8.8pt; }
  tr { page-break-inside: avoid; }
  th, td { border:1px solid #e5e7eb; padding: 4px 7px; text-align:left; vertical-align: top; }
  th { background:#f0fdf9; color:#0f172a; font-weight:600; }
  tr:nth-child(even) td { background:#fafafa; }
  .callout { background:#f0fdf9; border-left:4px solid ${BRAND}; padding:10px 14px; border-radius:4px; margin: 10px 0 14px; page-break-inside: avoid; }
  .callout .ct { font-weight:700; color:#0f172a; margin-bottom:2px; }
  .nyckel { display:flex; gap:10px; margin: 8px 0 14px; }
  .nyckel div { flex:1; border:1px solid #e5e7eb; border-radius:4px; padding:8px 10px; }
  .nyckel b { display:block; font-size:14pt; color:#0f172a; }
  .nyckel span { font-size:8.5pt; color:#6b7280; }
  .brytsida { page-break-before: always; }
  .kort { display:flex; gap:12px; border:1px solid #e5e7eb; border-radius:4px; padding:8px; margin-bottom:10px; page-break-inside: avoid; }
  .kort .bild { width: 62%; flex: none; display:flex; align-items:center; justify-content:center; background:#f8fafc; }
  .kort .bild img { max-width: 100%; max-height: 92mm; display:block; }
  .kort .text { font-size: 8.8pt; }
  .kort .text div { margin-bottom: 4px; }
  .kort .id { font-weight:700; color:#0f172a; font-size: 9.6pt; border-bottom: 2px solid ${BRAND}; padding-bottom: 3px; margin-bottom: 6px !important; }
  .kort .exp { background:#f0fdf9; padding:5px 7px; border-radius:3px; }
  .tumme img { width: 120px; display:block; }
  .muted { color:#6b7280; font-size:8.8pt; }
</style>
</head>
<body>

<section class="cover">
  <div class="cover-top">
    <img src="${logoSrc}" alt="Begone Skadedjur">
    <div class="cover-doctype">Internt underlag<br>Google Ads</div>
  </div>
  <div class="cover-center">
    <div class="cover-kicker">Kontaktark</div>
    <h1>Annonsbilder<br>fas 1</h1>
    <div class="subtitle">Nya bilder till råttor, fåglar och varumärket, framtagna med Gemini och granskade av skadedjursexperten. Inget är uppladdat till Google Ads.</div>
    <div class="cover-rule"></div>
    <div class="cover-meta">
      <div><b>Organisation:</b> Begone Skadedjur</div>
      <div><b>Annonskonto:</b> BeGone.se - Ny (940-760-4856)</div>
      <div><b>Datum:</b> ${DATUM}</div>
      <div><b>Version:</b> 1.0</div>
      <div><b>Status:</b> Förslag, väntar på Christians beslut</div>
      <div><b>Framtagen av:</b> Google Ads-specialisten</div>
      <div><b>Granskad av:</b> Skadedjursexperten (art, anatomi, metod, utrustning, miljö)</div>
    </div>
  </div>
  <div class="cover-footer">
    <span>Begone Skadedjur · Internt dokument</span>
    <span>Annonsbilder fas 1 · v1.0 · ${DATUM}</span>
  </div>
</section>

<h2><span class="num">1.</span>Sammanfattning</h2>
<div class="nyckel">
  <div><b>${manifest.length}</b><span>bilder i fas 1</span></div>
  <div><b>${godkanda.length}</b><span>godkända av experten</span></div>
  <div><b>${strukna.length}</b><span>strukna efter tre försök</span></div>
  <div><b>${forsokTotalt}</b><span>genereringar i Gemini</span></div>
</div>
<p>Vi har tagit fram bilderna enligt motivlistan i kontoplanen och råttrapporten och bildnormen för begone.se: dokumentärt foto i svensk miljö, inga personer eller händer, ingen text, inga logotyper och inga döda djur. Motiv där kontoplanen visade en tekniker bakifrån har gjorts om till bilder av det utförda arbetet, eftersom bildnormen inte tillåter personer. Råttan är brunråtta (Rattus norvegicus) i alla bilder.</p>
<p>Skadedjursexperten har granskat varje bild. Underkända bilder har genererats om med skärpt prompt, högst tre försök per bild. Sidan med underkända försök visar vad som var fel.</p>
<div class="callout">
  <div class="ct">Förslag</div>
  Ladda upp de ${godkanda.length} godkända bilderna och koppla dem till Christian | Sök | Råttor, Christian | Sök | Fåglar och Christian | Sök | Varumärke som bildtillägg (liggande och kvadrat) och till BrightBid PMax - Fågelsäkring (alla tre formaten). Förslagsfilen docs/begone-se/ads/andringar/2026-10-06_bilder-fas1.json har ${forslag.operationer.length} operationer och är provkörd mot Google. De gamla bilderna i PMax Fåglar rörs inte i det här steget.
</div>

${grupper.map(([namn, f], gi) => `
<h2 class="brytsida"><span class="num">${gi + 2}.</span>${esc(namn)}</h2>
${godkanda.filter(f).map(kort).join('')}`).join('')}

<h2 class="brytsida"><span class="num">5.</span>Underkända försök och strukna bilder</h2>
<p>Varje rad är ett försök som experten underkände. Bilden genererades sedan om med en prompt som rättar felet.</p>
<table>
<tr><th style="width:24%">Bild</th><th style="width:22%">Försök</th><th>Varför den underkändes</th></tr>
${underkandaRader.map((r) => `<tr><td><b>${esc(r.id)}</b><br>försök ${r.forsok}</td><td class="tumme">${r.tumme ? `<img src="${r.tumme}">` : ''}</td><td>${esc(r.orsak)}</td></tr>`).join('\n')}
</table>
${strukna.length ? `<p><b>Strukna efter tre försök:</b></p><ul>${strukna.map((b) => `<li><b>${esc(b.id)}</b> (${esc(b.motiv)}): ${esc(b.kommentar)}</li>`).join('')}</ul>` : '<p>Ingen bild behövde strykas.</p>'}

<h2><span class="num">6.</span>Kopplingar och uppföljning</h2>
<table>
<tr><th>Kampanj</th><th>Bilder</th></tr>
${['Christian | Sök | Råttor', 'Christian | Sök | Fåglar', 'Christian | Sök | Varumärke', 'BrightBid PMax - Fågelsäkring'].map((k) => `<tr><td><b>${esc(k)}</b></td><td>${forslag.kopplingar.filter(([, kk]) => kk === k).map(([i]) => esc(i)).join(', ')}</td></tr>`).join('')}
</table>
<ul>
  <li>Sökkampanjerna är pausade. Bilderna granskas av Google även när kampanjen står still, så policystatus kontrolleras dagen efter uppladdning.</li>
  <li>PMax Fåglar har i dag tolv bilder, varav flera gamla med okänd granskning. När de nya är godkända av Google föreslår vi att de gamla tas bort i ett eget steg.</li>
  <li>Spillningsbilden används bara i fågelsöket, inte i PMax, eftersom den är grövre än de andra.</li>
  <li>Efter fyra veckor jämför vi bildernas visningar och klick per bild i tillgångsrapporten och byter ut de svagaste.</li>
  <li>Fas 2: insekter (vägglöss och värmetält, silverfisk, pälsänger, mjölbaggar) och möss (husmus inomhus), samma flöde och samma granskning.</li>
</ul>

<p class="muted" style="margin-top:16px">Datum: ${DATUM} · Version 1.0 · Skript: scripts/ads/generera-annonsbilder.mjs (Gemini gemini-3.1-flash-image-preview), manifest docs/begone-se/ads/bilder/manifest.json, färdiga filer i docs/begone-se/ads/bilder/klara/.</p>

</body>
</html>`;

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle0' });
await page.pdf({ path: UTFIL, format: 'A4', printBackground: true, displayHeaderFooter: false, preferCSSPageSize: true });
await browser.close();
console.log('Skapade ' + UTFIL);
