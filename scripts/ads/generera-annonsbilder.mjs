// Genererar annonsbilder för Google Ads med Gemini, enligt bildnormen (docs/begone-se/BILDNORM.md) och
// samma flöde som begone-se/scripts/generera-bilder.mjs.
//
// Manifest: docs/begone-se/ads/bilder/manifest.json, en lista med { id, kampanj, motiv, format, prompt,
//   status, kommentar }. format är "1.91:1" (1200x628), "1:1" (1200x1200) eller "4:5" (960x1200).
// Original som PNG i docs/begone-se/ads/bilder/original/ (committas inte), varje försök <id>-fN.png och det
// valda <id>.png. Färdiga JPG i docs/begone-se/ads/bilder/klara/<id>.jpg (exakt mått, metadata borttagen).
//
// Kör från kundportalens rot (nyckeln läses bara ur miljön och skrivs aldrig ut):
//   node --env-file=.env.local scripts/ads/generera-annonsbilder.mjs [--id <id>] [--om]
//   node scripts/ads/generera-annonsbilder.mjs --bara-bearbeta
// Bilder med status "underkand" hoppas över. --om ger ett nytt försök även om originalet finns. Högst 3 försök.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// sharp finns i begone-se:s node_modules.
const sharp = createRequire('C:/Users/chris/begone-se/package.json')('sharp');

const MODELL = 'gemini-3.1-flash-image-preview';
const URL_API = `https://generativelanguage.googleapis.com/v1beta/models/${MODELL}:generateContent`;
const MAX_FORSOK = 3;
const ROT = process.cwd();
const MAPP = path.join(ROT, 'docs', 'begone-se', 'ads', 'bilder');
const MANIFEST = path.join(MAPP, 'manifest.json');
const ORIGINAL = path.join(MAPP, 'original');
const KLARA = path.join(MAPP, 'klara');

// Google Ads-format: målmått och närmaste format som Gemini kan ge.
const FORMAT = {
  '1.91:1': { b: 1200, h: 628, gemini: '16:9' },
  '1:1': { b: 1200, h: 1200, gemini: '1:1' },
  '4:5': { b: 960, h: 1200, gemini: '4:5' },
};

// Stilraden ur BILDNORM, plus annonsens krav på ren yta.
const STIL =
  'Documentary photograph, natural daylight, realistic colours, shot in Sweden in a Nordic setting. ' +
  'No text, no letters, no numbers, no signs, no watermarks, no logos or brands, no stickers or labels, ' +
  'no people and no human faces or hands. ' +
  'Anatomically correct animals: mammals and birds with exactly the right number of legs, toes, eyes and ears; ' +
  'insects with exactly six legs, correct number of wings and two antennae. ' +
  'Calm, uncluttered composition with the subject clearly visible, suitable as a small advertising image.';

const arg = process.argv.slice(2);
const flagga = (f) => arg.includes(f);
const baraId = arg.includes('--id') ? arg[arg.indexOf('--id') + 1] : undefined;
const baraBearbeta = flagga('--bara-bearbeta');
const om = flagga('--om');

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const nyckel = process.env.GOOGLE_AI_API_KEY;
if (!baraBearbeta && !nyckel) {
  console.error('GOOGLE_AI_API_KEY saknas i miljön. Kör med node --env-file=.env.local.');
  process.exit(1);
}

let anrop = 0;
async function generera(prompt, aspect) {
  anrop++;
  const svar = await fetch(URL_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': nyckel },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `${prompt}\n\n${STIL}` }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: aspect, imageSize: '2K' } },
    }),
  });
  if (!svar.ok) throw new Error(`Gemini svarade ${svar.status}: ${(await svar.text()).slice(0, 300)}`);
  const data = await svar.json();
  const del = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!del) throw new Error(`Ingen bild i svaret: ${JSON.stringify(data).slice(0, 300)}`);
  return Buffer.from(del.inlineData.data, 'base64');
}

async function bearbeta(bild) {
  const kalla = path.join(ORIGINAL, `${bild.id}.png`);
  if (!fs.existsSync(kalla)) return;
  const { b: mb, h: mh } = FORMAT[bild.format];
  const meta = await sharp(kalla).metadata();
  // Beskär till exakt format från mitten, sedan skala till målmåttet.
  let b = meta.width;
  let h = Math.round((b * mh) / mb);
  if (h > meta.height) {
    h = meta.height;
    b = Math.round((h * mb) / mh);
  }
  fs.mkdirSync(KLARA, { recursive: true });
  const ut = path.join(KLARA, `${bild.id}.jpg`);
  await sharp(kalla)
    .extract({ left: Math.floor((meta.width - b) / 2), top: Math.floor((meta.height - h) / 2), width: b, height: h })
    .resize(mb, mh, { fit: 'cover' })
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(ut);
  const kb = Math.round(fs.statSync(ut).size / 1024);
  console.log(`klar ${bild.id}.jpg (${mb}x${mh}, ${kb} kB)`);
}

fs.mkdirSync(ORIGINAL, { recursive: true });
for (const bild of manifest) {
  if (baraId && bild.id !== baraId) continue;
  if (bild.status === 'underkand') continue;
  if (!FORMAT[bild.format]) throw new Error(`Okänt format ${bild.format} för ${bild.id}`);
  const vald = path.join(ORIGINAL, `${bild.id}.png`);
  if (!baraBearbeta && (om || !fs.existsSync(vald))) {
    const forsok = fs.readdirSync(ORIGINAL).filter((f) => f.startsWith(`${bild.id}-f`)).length;
    if (forsok >= MAX_FORSOK) {
      console.log(`${bild.id}: ${MAX_FORSOK} försök gjorda, stryk bilden med orsak i manifestet.`);
      continue;
    }
    console.log(`genererar ${bild.id}, försök ${forsok + 1}`);
    try {
      const png = await sharp(await generera(bild.prompt, FORMAT[bild.format].gemini)).png().toBuffer();
      fs.writeFileSync(path.join(ORIGINAL, `${bild.id}-f${forsok + 1}.png`), png);
      fs.writeFileSync(vald, png);
      bild.forsok = forsok + 1;
    } catch (e) {
      console.error(`${bild.id}: ${e.message}`);
      continue;
    }
  }
  await bearbeta(bild);
}
fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Gemini-anrop i den här körningen: ${anrop}`);
