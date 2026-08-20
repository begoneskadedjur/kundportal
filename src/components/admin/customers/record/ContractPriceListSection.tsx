// src/components/admin/customers/record/ContractPriceListSection.tsx
// § 2 Prislista för avrop: vad kunden kan avropa och till vilket pris.
//
// Två kategorier:
//  - Fast pris — tjänsten finns i avtalets (eller kundens) prislista med ett
//    custom_price. Teknikern kan inte ändra priset i ärendet.
//  - Separat offert — tjänsten saknas i prislistan. Priset sätts av teknikern
//    via Prisguiden per ärende och blir en offert till kunden.
//
// Den prissatta listan är kort och visas öppet; offertlistan är lång
// (~55 tjänster) och ligger hopfälld.

import { useEffect, useState } from 'react'
import { ChevronRight, Loader2 } from 'lucide-react'
import { supabase } from '../../../../lib/supabase'
import { formatKr } from '../../../../hooks/useCustomerRecord'

export interface AvropService {
  serviceId: string
  name: string
  code: string | null
  groupName: string
  /** null = inget fast pris → prissätts via Prisguiden (separat offert) */
  price: number | null
}

export interface AvropCatalog {
  priced: AvropService[]
  quoted: AvropService[]
}

const EMPTY: AvropCatalog = { priced: [], quoted: [] }

/**
 * Hämtar avropskatalogen för ett avtal: aktiva tjänster som kunden kan avropa,
 * uppdelade på fast pris (ur prislistan) och separat offert.
 *
 * Exkluderar dels avtalstyperna (is_contract_service — de ÄR avtal, inte
 * avrop), dels tjänster som redan ingår i avtalet enligt § 4 (excludeServiceIds).
 * Utan prislista offereras allt.
 */
export function useAvropCatalog(
  priceListId: string | null | undefined,
  excludeServiceIds: string[] = []
) {
  const [catalog, setCatalog] = useState<AvropCatalog>(EMPTY)
  const [loading, setLoading] = useState(false)
  // Stabil nyckel: arrayen är ny vid varje render, strängen är det inte
  const excludeKey = excludeServiceIds.slice().sort().join(',')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        // Alla avropbara tjänster (avtalstyper är inte avrop — de ÄR avtalet)
        const { data: services } = await supabase
          .from('services')
          .select('id, code, name, sort_order, group:service_groups(name, sort_order)')
          .eq('is_active', true)
          .eq('is_contract_service', false)
          .order('sort_order', { ascending: true })

        // Prislistans fasta priser
        let priceByService = new Map<string, number>()
        if (priceListId) {
          const { data: items } = await supabase
            .from('price_list_items')
            .select('service_id, custom_price')
            .eq('price_list_id', priceListId)
            .not('service_id', 'is', null)
          priceByService = new Map(
            (items ?? [])
              .filter((i) => i.service_id != null)
              .map((i) => [i.service_id as string, Number(i.custom_price)])
          )
        }

        type ServiceRow = {
          id: string
          code: string | null
          name: string
          sort_order: number | null
          group: { name: string; sort_order: number | null } | { name: string; sort_order: number | null }[] | null
        }
        const rows = (services ?? []) as unknown as ServiceRow[]
        const mapped: AvropService[] = rows.map((s) => {
          const g = Array.isArray(s.group) ? s.group[0] : s.group
          return {
            serviceId: s.id,
            name: s.name,
            code: s.code,
            groupName: g?.name ?? 'Övrigt',
            price: priceByService.has(s.id) ? (priceByService.get(s.id) as number) : null,
          }
        })

        // Tjänster som redan ingår i avtalet (§ 4) är inte avrop
        const excluded = new Set(excludeKey ? excludeKey.split(',') : [])
        const avrop = mapped.filter((s) => !excluded.has(s.serviceId))

        if (cancelled) return
        setCatalog({
          priced: avrop.filter((s) => s.price !== null),
          quoted: avrop.filter((s) => s.price === null),
        })
      } catch (err) {
        console.error('Kunde inte hämta avropskatalogen:', err)
        if (!cancelled) setCatalog(EMPTY)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [priceListId, excludeKey])

  return { catalog, loading }
}

/** Gruppera tjänster per tjänstegrupp, i den ordning de kommer */
function byGroup(services: AvropService[]): [string, AvropService[]][] {
  const map = new Map<string, AvropService[]>()
  for (const s of services) {
    const list = map.get(s.groupName) ?? []
    list.push(s)
    map.set(s.groupName, list)
  }
  return Array.from(map.entries())
}

interface Props {
  catalog: AvropCatalog
  loading: boolean
  priceListLabel: string | null
}

/**
 * Avropstjänsterna som en prisbilaga på avtalspappret. Prissatta tjänster
 * grupperade med belopp; offert-tjänsterna hopfällda under en rad.
 */
export default function ContractPriceListSection({ catalog, loading, priceListLabel }: Props) {
  const [showQuoted, setShowQuoted] = useState(false)
  const { priced, quoted } = catalog

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2 font-sans text-[11.5px] text-[#8a9099]">
        <Loader2 className="w-3 h-3 animate-spin" />
        Hämtar avropspriser…
      </div>
    )
  }

  if (priced.length === 0 && quoted.length === 0) return null

  return (
    <div className="mt-2">
      {/* Fasta avropspriser */}
      {priced.length > 0 && (
        <div className="space-y-2">
          {byGroup(priced).map(([group, services]) => (
            <div key={group}>
              <div className="font-sans text-[9.5px] uppercase tracking-[0.14em] text-[#8a9099] mb-0.5">
                {group}
              </div>
              {services.map((s) => (
                <div
                  key={s.serviceId}
                  className="flex items-baseline gap-2 py-[3px] text-[12.5px] border-b border-dotted border-[#e5e0d0] last:border-b-0"
                >
                  <span className="text-[#262e38] truncate">{s.name}</span>
                  <span className="flex-1 border-b border-dotted border-[#e5e0d0] translate-y-[-2px] min-w-3" />
                  <span className="tabular-nums text-[#262e38] font-semibold whitespace-nowrap shrink-0">
                    {formatKr(s.price as number)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {priced.length === 0 && priceListLabel && (
        <p className="font-sans text-[11.5px] italic text-[#8a9099] py-1">
          Prislistan har inga tjänstepriser ännu.
        </p>
      )}

      {/* Övriga tjänster — offereras per ärende. Hopfälld: listan är lång. */}
      {quoted.length > 0 && (
        <div className={priced.length > 0 ? 'mt-2.5 pt-2 border-t border-[#d9d3c2]' : 'mt-1'}>
          <button
            onClick={() => setShowQuoted((v) => !v)}
            className="w-full flex items-center gap-1.5 font-sans text-[11.5px] text-[#5d6672] hover:text-[#262e38] transition-colors"
          >
            <ChevronRight
              className={`w-3 h-3 shrink-0 transition-transform ${showQuoted ? 'rotate-90' : ''}`}
            />
            <span>
              Övriga {quoted.length} tjänster — <span className="italic">separat offert</span>
            </span>
            <span className="flex-1" />
            <span className="text-[10.5px] text-[#8a9099]">{showQuoted ? 'dölj' : 'visa'}</span>
          </button>
          {!showQuoted && (
            <p className="font-sans text-[10.5px] text-[#8a9099] mt-1 pl-[18px] leading-relaxed">
              Prissätts via prisguiden i ärendet och offereras till kunden innan arbetet utförs.
            </p>
          )}
          {showQuoted && (
            <div className="mt-1.5 pl-[18px] space-y-1.5 max-h-56 overflow-y-auto">
              {byGroup(quoted).map(([group, services]) => (
                <div key={group}>
                  <div className="font-sans text-[9.5px] uppercase tracking-[0.14em] text-[#8a9099]">
                    {group}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {services.map((s) => (
                      <span key={s.serviceId} className="text-[11.5px] text-[#5d6672]">
                        {s.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
