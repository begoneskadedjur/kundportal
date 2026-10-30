#!/usr/bin/env node
// scripts/regression/compare.mjs
// Jämför två dumpar från plan-dump.mts eller sql-dump.mts.
//
//   node scripts/regression/compare.mjs out/plan-A.json out/plan-B.json
//
// Skriver skillnaderna per avtal (eller synth-kund, samlingsgrupp): antal
// tillagda, borttagna och ändrade perioder och vilka fält som ändrats.
// Exitkod 0 när dumparna är identiska i innehåll, 1 vid skillnader, 2 vid fel.
// meta.git_sha och meta.today jämförs inte (de skiljer sig med flit mellan
// före och efter); allt annat gör det.

import { readFileSync } from 'node:fs'

const [fileA, fileB] = process.argv.slice(2)
if (!fileA || !fileB) {
  console.error('Användning: node scripts/regression/compare.mjs <dump A> <dump B>')
  process.exit(2)
}

function load(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    console.error(`Kunde inte läsa ${path}: ${err.message}`)
    process.exit(2)
  }
}

const a = load(fileA)
const b = load(fileB)
if (a.meta?.kind !== b.meta?.kind) {
  console.error(`Olika slags dumpar: ${a.meta?.kind} och ${b.meta?.kind}`)
  process.exit(2)
}

/** Platta ut ett objekt till sökväg -> JSON-värde. */
function flatten(value, prefix = '', out = {}) {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const k of Object.keys(value)) flatten(value[k], prefix ? `${prefix}.${k}` : k, out)
  } else if (Array.isArray(value) && value.some((v) => v !== null && typeof v === 'object')) {
    if (value.length === 0) out[prefix] = '[]'
    value.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out))
  } else {
    out[prefix] = JSON.stringify(value)
  }
  return out
}

function changedFields(x, y) {
  const fx = flatten(x)
  const fy = flatten(y)
  const keys = [...new Set([...Object.keys(fx), ...Object.keys(fy)])].sort()
  return keys.filter((k) => fx[k] !== fy[k]).map((k) => ({ field: k, before: fx[k], after: fy[k] }))
}

let differences = 0
const lines = []

function compareKeyed(label, rowsA, rowsB, keyOf, groupOf) {
  const mapA = new Map(rowsA.map((r) => [keyOf(r), r]))
  const mapB = new Map(rowsB.map((r) => [keyOf(r), r]))
  const groups = new Map()
  const bump = (g) => {
    if (!groups.has(g)) groups.set(g, { added: [], removed: [], changed: [] })
    return groups.get(g)
  }
  for (const [k, r] of mapA) {
    if (!mapB.has(k)) bump(groupOf(r)).removed.push(k)
    else {
      const diff = changedFields(r, mapB.get(k))
      if (diff.length) bump(groupOf(r)).changed.push({ key: k, diff })
    }
  }
  for (const [k, r] of mapB) if (!mapA.has(k)) bump(groupOf(r)).added.push(k)

  for (const g of [...groups.keys()].sort()) {
    const { added, removed, changed } = groups.get(g)
    differences += added.length + removed.length + changed.length
    lines.push(`${label} ${g}: ${added.length} tillagda, ${removed.length} borttagna, ${changed.length} ändrade`)
    for (const k of added) lines.push(`  + ${k}`)
    for (const k of removed) lines.push(`  - ${k}`)
    for (const c of changed) {
      lines.push(`  ~ ${c.key}`)
      for (const d of c.diff) lines.push(`      ${d.field}: ${d.before ?? '(saknas)'} -> ${d.after ?? '(saknas)'}`)
    }
  }
}

if (a.meta.kind === 'plan-dump') {
  compareKeyed('Avtal', a.contracts ?? [], b.contracts ?? [], (r) => r.contract_id, (r) => r.contract_id)
  compareKeyed('Synth', a.synth_customers ?? [], b.synth_customers ?? [], (r) => r.customer_id, (r) => r.customer_id)
  compareKeyed('Perioder', a.rows ?? [], b.rows ?? [], (r) => r.key, (r) => `${r.owner_type}:${r.owner_id}`)
  const metaDiff = changedFields(
    { ...a.meta, git_sha: null, today: null },
    { ...b.meta, git_sha: null, today: null }
  )
  if (metaDiff.length) {
    lines.push(`Meta: ${metaDiff.length} fält skiljer`)
    for (const d of metaDiff) lines.push(`      ${d.field}: ${d.before ?? '(saknas)'} -> ${d.after ?? '(saknas)'}`)
    differences += metaDiff.length
  }
} else if (a.meta.kind === 'sql-dump') {
  compareKeyed('Avtal', a.rows ?? [], b.rows ?? [], (r) => `${r.contract_id}|${r.day}`, (r) => r.contract_id)
} else {
  console.error(`Okänd dumptyp: ${a.meta?.kind}`)
  process.exit(2)
}

console.log(`A: ${fileA} (sha ${a.meta.git_sha}${a.meta.today ? `, idag ${a.meta.today}` : ''})`)
console.log(`B: ${fileB} (sha ${b.meta.git_sha}${b.meta.today ? `, idag ${b.meta.today}` : ''})`)
if (differences === 0) {
  console.log('Inga skillnader.')
  process.exit(0)
}
for (const l of lines) console.log(l)
console.log(`Totalt ${differences} skillnader.`)
process.exit(1)
