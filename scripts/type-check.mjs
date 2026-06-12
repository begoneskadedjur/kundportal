#!/usr/bin/env node
// scripts/type-check.mjs - Type-check med baseline för befintlig teknisk skuld.
//
// Frontend-kodbasen har ~1000 befintliga typfel som aldrig upptäcktes eftersom
// "tsc --noEmit" mot rot-tsconfig (files: []) var en no-op. Det här scriptet
// kör riktig typkontroll på båda delprojekten men failar bara på NYA fel,
// jämfört med den incheckade baselinen (scripts/type-check-baseline.json).
//
// Användning:
//   node scripts/type-check.mjs            Failar om nya fel tillkommit
//   node scripts/type-check.mjs --update   Uppdatera baselinen (kör efter att
//                                          du betalat av skuld, ALDRIG för att
//                                          maskera nya fel)
//
// Fingeravtryck per fel: "fil|TS-kod" med antal. Radnummer ingår inte
// (de förskjuts vid varje redigering). Det betyder att ett nytt fel i en fil
// som redan har samma felkod inte upptäcks - acceptabel kompromiss tills
// skulden är nere på noll.

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const baselinePath = join(root, 'scripts', 'type-check-baseline.json')
const projects = ['tsconfig.app.json', 'tsconfig.node.json']
const update = process.argv.includes('--update')

function runTsc(project) {
  const result = spawnSync(
    process.execPath,
    [join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', project, '--noEmit', '--pretty', 'false'],
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  )
  if (result.error) {
    console.error(`Kunde inte köra tsc för ${project}:`, result.error.message)
    process.exit(1)
  }
  return (result.stdout || '') + (result.stderr || '')
}

function collectErrors() {
  const counts = new Map()
  let total = 0
  for (const project of projects) {
    for (const line of runTsc(project).split(/\r?\n/)) {
      const match = line.match(/^(.+?)\(\d+,\d+\): error (TS\d+):/)
      if (!match) continue
      const key = `${match[1].replace(/\\/g, '/')}|${match[2]}`
      counts.set(key, (counts.get(key) || 0) + 1)
      total++
    }
  }
  return { counts, total }
}

const { counts, total } = collectErrors()

if (update) {
  const sorted = Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(baselinePath, JSON.stringify(sorted, null, 2) + '\n')
  console.log(`Baseline uppdaterad: ${total} kända fel i ${counts.size} fil/felkod-kombinationer.`)
  process.exit(0)
}

if (!existsSync(baselinePath)) {
  console.error(`Baseline saknas (${baselinePath}). Skapa den med: node scripts/type-check.mjs --update`)
  process.exit(1)
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
const baselineTotal = Object.values(baseline).reduce((sum, n) => sum + n, 0)

const regressions = []
for (const [key, count] of counts) {
  const known = baseline[key] || 0
  if (count > known) {
    const [file, code] = key.split('|')
    regressions.push(`  ${file}: ${count - known} nytt/nya ${code}-fel (${known} kända, ${count} nu)`)
  }
}

if (regressions.length > 0) {
  console.error(`NYA typfel jämfört med baseline:\n${regressions.join('\n')}`)
  console.error(`\nKör "npx tsc -p tsconfig.app.json --noEmit" respektive "-p tsconfig.node.json" för detaljer.`)
  process.exit(1)
}

if (total < baselineTotal) {
  console.log(`Inga nya typfel. Skulden har minskat: ${total} fel (baseline: ${baselineTotal}).`)
  console.log(`Lås in förbättringen med: node scripts/type-check.mjs --update`)
} else {
  console.log(`Inga nya typfel (${total} kända fel kvar i baseline-skulden).`)
}
