// src/lib/fetchAllRows.ts
// Hämtar alla rader från en Supabase-fråga i block om 1 000.
//
// PostgREST lämnar som mest 1 000 rader per anrop (max_rows). En fråga utan
// range() stannar där tyst: 2026-10-02 visade teknikerns karta 1 000 av 1 154
// utomhusstationer. build() ska bygga en NY fråga varje gång (en builder kör
// om anropet vid varje await) och ha en stabil sortering, annars kan rader
// hoppas över eller dubbleras mellan blocken.

const PAGE = 1000

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PageResult<T> = PromiseLike<{ data: T[] | null; error: any }>

export async function fetchAllRows<T>(build: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw error
    const page = data ?? []
    rows.push(...page)
    if (page.length < PAGE) return rows
  }
}
