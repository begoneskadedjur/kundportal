#!/usr/bin/env node
// scripts/backfill-procurement-contacts.mjs
// Engångsfyllning (3.65.0): kontaktperson hos köparen ur TED eForms för
// upphandlingar och tilldelningar som redan finns i databasen. Synken
// (api/cron/procurement-sync-ted.ts) sparar kontakten för nya annonser.
//
//   - Hämtar buyer-contact-point (BT-502), buyer-email (BT-506) och
//     organisation-tel-buyer (BT-503) ur TED Search API v3, 50 nummer per
//     anrop, högst ett anrop per sekund.
//   - Fyller procurement_notices.contact_name/email/phone när de är tomma.
//   - Lägger kontakten i procurement_contacts per köpare (nyckel köpare plus
//     e-post eller namn), fyller tomma fält och notice_ids. Rör aldrig manuellt
//     ifyllda värden och tar aldrig bort något.
//
// Körning:
//   node scripts/backfill-procurement-contacts.mjs --dry-run   visar vad som skulle skrivas
//   node scripts/backfill-procurement-contacts.mjs
// Kräver VITE_SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY i .env.

import { cleanText, loadEnvFiles, normalizeName, parseArgs, politeFetch } from './lib/procurementImportShared.mjs'

const args = parseArgs()
const API = 'https://api.ted.europa.eu/v3/notices/search'
const FIELDS = ['publication-number', 'buyer-contact-point', 'buyer-email', 'organisation-tel-buyer']

async function client() {
  loadEnvFiles()
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('VITE_SUPABASE_URL och SUPABASE_SERVICE_ROLE_KEY saknas i .env')
  const { createClient } = await import('@supabase/supabase-js')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

const first = (v) => {
  const list = Array.isArray(v) ? v : v == null ? [] : [v]
  const s = list.length ? cleanText(String(list[0])) : ''
  return s || null
}

/** Spegel av contactFromTed i src/shared/procurementRules.ts */
function contactFromTed(n) {
  const name = first(n['buyer-contact-point'])
  const emailRaw = first(n['buyer-email'])
  const email = emailRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw.toLowerCase() : null
  const phone = first(n['organisation-tel-buyer'])
  if (!name && !email) return null
  return { name, email, phone }
}

function contactKey(buyerId, c) {
  const who = c.email ? c.email.toLowerCase() : c.name ? normalizeName(c.name) : ''
  return who ? `${buyerId}:${who}` : null
}

async function main() {
  const sb = await client()
  // TED-nummer per upphandling (källposter) och per tilldelning
  const { data: sources, error: sErr } = await sb.from('procurement_notice_sources').select('notice_id, source_id').eq('source', 'ted').limit(5000)
  if (sErr) throw new Error(sErr.message)
  const { data: awards, error: aErr } = await sb.from('procurement_awards').select('notice_id, buyer_id, source_ref').eq('source', 'ted').limit(5000)
  if (aErr) throw new Error(aErr.message)
  const { data: notices, error: nErr } = await sb.from('procurement_notices').select('id, buyer_id, contact_name, contact_email, contact_phone').limit(10000)
  if (nErr) throw new Error(nErr.message)
  const noticeById = new Map(notices.map((n) => [n.id, n]))

  const byRef = new Map() // ref -> { noticeIds:Set, buyerIds:Set }
  const add = (ref, noticeId, buyerId) => {
    if (!ref) return
    const e = byRef.get(ref) ?? { noticeIds: new Set(), buyerIds: new Set() }
    if (noticeId) e.noticeIds.add(noticeId)
    if (buyerId) e.buyerIds.add(buyerId)
    byRef.set(ref, e)
  }
  for (const s of sources ?? []) add(s.source_id, s.notice_id, noticeById.get(s.notice_id)?.buyer_id ?? null)
  for (const a of awards ?? []) add(a.source_ref, a.notice_id, a.buyer_id)
  const refs = [...byRef.keys()].filter((r) => /^\d+-\d{4}$/.test(r))
  console.log(`TED-nummer att läsa: ${refs.length}${args.dryRun ? ' (torrkörning, inget skrivs)' : ''}`)

  const found = new Map()
  for (let i = 0; i < refs.length; i += 50) {
    const batch = refs.slice(i, i + 50)
    const res = await politeFetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: `publication-number IN (${batch.join(' ')})`, fields: FIELDS, limit: 100, page: 1, scope: 'ALL' }),
    })
    if (!res.ok) throw new Error(`TED svarade ${res.status}: ${(await res.text()).slice(0, 300)}`)
    const body = await res.json()
    for (const n of body.notices ?? []) {
      const ref = String(n['publication-number'] ?? '').replace(/^0+/, '')
      const c = contactFromTed(n)
      if (c) found.set(ref, c)
    }
  }
  console.log(`Annonser med kontaktperson i TED: ${found.size} av ${refs.length}`)

  let noticeUpdates = 0
  let contactsNew = 0
  let contactsUpdated = 0
  const buyersWithContact = new Set()
  const contactRows = new Map() // contact_key -> row
  for (const [ref, c] of found) {
    const e = byRef.get(ref)
    if (!e) continue
    for (const id of e.noticeIds) {
      const n = noticeById.get(id)
      if (!n) continue
      const patch = {}
      if (!n.contact_name && c.name) patch.contact_name = c.name
      if (!n.contact_email && c.email) patch.contact_email = c.email
      if (!n.contact_phone && c.phone) patch.contact_phone = c.phone
      if (Object.keys(patch).length === 0) continue
      noticeUpdates++
      Object.assign(n, patch)
      if (!args.dryRun) {
        const { error } = await sb.from('procurement_notices').update(patch).eq('id', id)
        if (error) throw new Error(`${id}: ${error.message}`)
      }
    }
    for (const buyerId of e.buyerIds) {
      const key = contactKey(buyerId, c)
      if (!key) continue
      buyersWithContact.add(buyerId)
      const row = contactRows.get(key) ?? { buyer_id: buyerId, contact_key: key, name: c.name, email: c.email, phone: c.phone, notice_ids: new Set() }
      row.name ??= c.name
      row.phone ??= c.phone
      for (const id of e.noticeIds) row.notice_ids.add(id)
      contactRows.set(key, row)
    }
  }

  const keys = [...contactRows.keys()]
  const existing = new Map()
  for (let i = 0; i < keys.length; i += 200) {
    const { data } = await sb.from('procurement_contacts').select('id, contact_key, name, email, phone, notice_ids').in('contact_key', keys.slice(i, i + 200))
    for (const r of data ?? []) existing.set(r.contact_key, r)
  }
  const now = new Date().toISOString()
  for (const [key, row] of contactRows) {
    const cur = existing.get(key)
    if (cur) {
      const ids = new Set([...(cur.notice_ids ?? []), ...row.notice_ids])
      contactsUpdated++
      if (!args.dryRun) {
        const { error } = await sb
          .from('procurement_contacts')
          .update({ name: cur.name ?? row.name, email: cur.email ?? row.email, phone: cur.phone ?? row.phone, notice_ids: [...ids], last_seen_at: now })
          .eq('id', cur.id)
        if (error) throw new Error(`${key}: ${error.message}`)
      }
    } else {
      contactsNew++
      if (!args.dryRun) {
        const { error } = await sb.from('procurement_contacts').insert({
          buyer_id: row.buyer_id,
          contact_key: key,
          name: row.name,
          email: row.email,
          phone: row.phone,
          role: 'Kontaktperson i annonsen',
          source: 'ted',
          notice_ids: [...row.notice_ids],
          first_seen_at: now,
          last_seen_at: now,
        })
        if (error) throw new Error(`${key}: ${error.message}`)
      }
    }
  }
  console.log(`Upphandlingar som fått kontaktperson: ${noticeUpdates}`)
  console.log(`Kontakter hos köpare: ${contactsNew} nya, ${contactsUpdated} uppdaterade, ${buyersWithContact.size} köpare`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
