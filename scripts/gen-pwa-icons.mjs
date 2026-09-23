// scripts/gen-pwa-icons.mjs
// Genererar appikonerna för hemskärmen (PWA) ur en SVG som bygger på BeGones
// logotyp: den gröna färgen och det feta B:et ur ordmärket.
//
//   node scripts/gen-pwa-icons.mjs
//
// Skriver till public/:
//   pwa-icon.svg               källan, rundad platta (visas i manifestet som "any")
//   pwa-192x192.png            Android, listor och genvägar
//   pwa-512x512.png            Android, splash och butiksytor
//   pwa-maskable-512x512.png   Android maskable: hel platta, glyfen inom säkra zonen
//   apple-touch-icon.png       iOS 180 px: hel platta, iOS rundar själv
//
// Rastrerar med samma Chrome som PDF-skripten (puppeteer-core).

import fs from 'node:fs'
import puppeteer from 'puppeteer-core'

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const BRAND = '#20c58f'

/**
 * @param {boolean} rounded  rundade hörn (false = hel platta för maskable/iOS)
 * @param {number} fontSize  B:ets storlek i en 512-ruta
 */
const svg = (rounded, fontSize) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="${BRAND}"/>
  <text x="256" y="${256 + fontSize * 0.36}" text-anchor="middle"
        font-family="Montserrat, 'Segoe UI', Arial, Helvetica, sans-serif"
        font-weight="800" font-size="${fontSize}" fill="#ffffff">B</text>
</svg>
`

fs.writeFileSync('public/pwa-icon.svg', svg(true, 320))

const jobs = [
  ['pwa-192x192.png', 192, true, 320],
  ['pwa-512x512.png', 512, true, 320],
  ['pwa-maskable-512x512.png', 512, false, 250],
  ['apple-touch-icon.png', 180, false, 300],
]

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })
try {
  const page = await browser.newPage()
  for (const [name, size, rounded, fontSize] of jobs) {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 })
    const markup = svg(rounded, fontSize).replace('<svg ', `<svg width="${size}" height="${size}" `)
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${markup}</body></html>`)
    await page.screenshot({
      path: `public/${name}`,
      omitBackground: true,
      clip: { x: 0, y: 0, width: size, height: size },
    })
    console.log('skrev public/' + name)
  }
} finally {
  await browser.close()
}
