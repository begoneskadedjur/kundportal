// src/shared/kontaktFormat.ts
// Snyggar till kontaktuppgifter innan de hamnar i ett avtal: namn med stor bokstav,
// telefonnummer som "070-123 45 67", adress som "Storgatan 15, 111 22 Stockholm".
//
// Grundregel: det som redan är medvetet skrivet rörs inte. Versaler och gemener ändras
// bara i ord som är skrivna helt med gemener eller helt med versaler ("anna", "ANNA"),
// så "McDonald" och "IKEA Kungens Kurva AB" står kvar. Det som inte går att tolka
// (utländska nummer, ovanliga adresser) lämnas som det skrevs, bara utan dubbla mellanslag.

import { delaGatufalt, formatPostnummer, ortMedVersal, versalForst, adressRad, tolkaIdNummer } from './webLeadUppgifter'

const SV = 'sv-SE'

function rensa(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim()
}

/** Ordet är skrivet med bara gemener eller bara versaler. */
function enhetligSkiftning(ord: string): boolean {
  const b = ord.replace(/[^\p{L}]/gu, '')
  return b.length > 0 && (b === b.toLocaleLowerCase(SV) || b === b.toLocaleUpperCase(SV))
}

function storForst(ord: string): string {
  const g = ord.toLocaleLowerCase(SV)
  return g.charAt(0).toLocaleUpperCase(SV) + g.slice(1)
}

// Adelspartiklar och liknande skrivs med gemen inne i namnet ("Carl von Linné")
const NAMNPARTIKLAR = new Set(['von', 'af', 'de', 'van', 'der', 'den', 'la', 'di', 'da'])

/** "anna-karin SVENSSON" → "Anna-Karin Svensson". Blandad skiftning ("McDonald") lämnas. */
export function formatPersonnamn(s: string | null | undefined): string {
  return rensa(s)
    .split(' ')
    .map((ord, i) => {
      if (!enhetligSkiftning(ord)) return ord
      const g = ord.toLocaleLowerCase(SV)
      if (i > 0 && NAMNPARTIKLAR.has(g)) return g
      return ord.split('-').map(del => (del ? storForst(del) : del)).join('-')
    })
    .join(' ')
}

// Bolagsformer som alltid skrivs med versaler
const BOLAGSFORMER = new Set(['ab', 'hb', 'kb', 'ek', 'brf', 'hsb'])

/**
 * Företagsnamn: bara när HELA namnet är skrivet med gemener får varje ord stor bokstav.
 * Bolagsformen ("ab", "hb") blir alltid versaler. Namn med versaler ("ICA MAXI") kan vara det
 * juridiska namnet och lämnas.
 */
export function formatForetagsnamn(s: string | null | undefined): string {
  const t = rensa(s)
  const bokstaver = t.replace(/[^\p{L}]/gu, '')
  const helaGemener = bokstaver.length > 0 && bokstaver === bokstaver.toLocaleLowerCase(SV)
  return t
    .split(' ')
    .map(ord => {
      const ren = ord.replace(/[().]/g, '').toLocaleLowerCase(SV)
      if (BOLAGSFORMER.has(ren)) return ord.toLocaleUpperCase(SV)
      if (!helaGemener) return ord
      if (ord === '&') return ord
      return ord.split('-').map(del => (del ? storForst(del) : del)).join('-')
    })
    .join(' ')
}

/** E-post utan mellanslag och med gemener. */
export function formatEpost(s: string | null | undefined): string {
  return (s ?? '').replace(/\s/g, '').toLocaleLowerCase(SV)
}

// Riktnummer med tre siffror (inklusive nollan). 08 är det enda med två; övriga har fyra.
const RIKTNUMMER_3 = new Set([
  '010', '011', '013', '016', '018', '019', '020', '021', '023', '026', '031', '033', '035', '036',
  '040', '042', '044', '046', '054', '060', '063', '090',
])

/** Abonnentnumret grupperat: 5 → "123 45", 6 → "12 34 56", 7 → "123 45 67", 8 → "123 456 78". */
function grupperaAbonnent(n: string): string {
  switch (n.length) {
    case 5: return `${n.slice(0, 3)} ${n.slice(3)}`
    case 6: return `${n.slice(0, 2)} ${n.slice(2, 4)} ${n.slice(4)}`
    case 7: return `${n.slice(0, 3)} ${n.slice(3, 5)} ${n.slice(5)}`
    case 8: return `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`
    default: return n
  }
}

/**
 * Svenskt telefonnummer i vanligt skrivsätt: "070-123 45 67", "08-602 33 38", "010-280 44 10",
 * "0480-123 45". +46 och 0046 blir 0. Utländska och otolkbara nummer lämnas som de skrevs.
 */
export function formatTelefon(s: string | null | undefined): string {
  const t = rensa(s)
  if (!t) return ''
  let siffror = t.replace(/[^\d+]/g, '')
  if (siffror.startsWith('+46')) siffror = '0' + siffror.slice(3)
  else if (siffror.startsWith('0046')) siffror = '0' + siffror.slice(4)
  else if (siffror.startsWith('+') || siffror.startsWith('00')) return t
  // "+46 (0)8 …" ger en nolla för mycket
  siffror = siffror.replace(/^00(?=[1-9])/, '0')
  if (!/^0[1-9]\d{6,9}$/.test(siffror)) return t

  let rikt: string
  if (/^07/.test(siffror)) rikt = siffror.slice(0, 3)
  else if (siffror.startsWith('08')) rikt = '08'
  else if (RIKTNUMMER_3.has(siffror.slice(0, 3))) rikt = siffror.slice(0, 3)
  else rikt = siffror.slice(0, 4)

  const abonnent = siffror.slice(rikt.length)
  if (abonnent.length < 5 || abonnent.length > 8) return t
  return `${rikt}-${grupperaAbonnent(abonnent)}`
}

/**
 * Adress på en rad: "storgatan 15 11122 stockholm" → "Storgatan 15, 111 22 Stockholm".
 * Klarar också orten före postnumret ("Östersund 831 90" → "831 90 Östersund").
 */
export function formatAdress(s: string | null | undefined): string {
  const t = rensa(s)
  if (!t) return ''
  const d = delaGatufalt(t)
  // Bara ort och postnummer, utan gata: "Östersund 831 90"
  if (d.postnummer && !d.ort && d.gata && !/\d/.test(d.gata)) {
    return adressRad({ gata: '', postnummer: formatPostnummer(d.postnummer), ort: ortMedVersal(d.gata) })
  }
  if (!d.postnummer) {
    // Inget postnummer att gå efter: bara stor bokstav först
    return versalForst(t)
  }
  return adressRad({ gata: versalForst(d.gata), postnummer: formatPostnummer(d.postnummer), ort: ortMedVersal(d.ort) })
}

/** Org.nr som "556549-8986", personnummer som "19850315-1234". Otolkbart lämnas. */
export function formatIdNummer(s: string | null | undefined): string {
  const t = rensa(s)
  const tolkat = tolkaIdNummer(t)
  return tolkat.tolkat ? tolkat.normaliserat : t
}
