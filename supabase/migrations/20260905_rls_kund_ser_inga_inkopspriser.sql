-- ═══════════════════════════════════════════════════════════════
-- Kundrollen kunde läsa inköpspriser via API:t på tre vägar:
--   case_billing_items: artikelrader (intern kostnad) på egna ärenden,
--     234 rader hos 57 kunder, drygt 2 mkr i inköpsvärde
--   articles: default_price på alla 222 aktiva artiklar
--   price_list_items / price_lists: alla kunders avtalade priser
-- Gränssnittet dolde dem, men RLS gjorde det inte. Nu:
--   kund läser bara tjänsterader på basetabellen, artikelrader (namn och
--   antal, aldrig pris) via customer_case_article_lines(), och artiklar
--   och prislistor är personal-only (my_case_scope: staff, säljare, tekniker).
-- Verifierat 2026-09-05 som kundroll (0 artikelrader, 0 articles, 0
-- prislisteposter, RPC ger namn och antal) och som tekniker (allt läsbart).
-- ═══════════════════════════════════════════════════════════════

drop policy if exists cbi_customer_read on public.case_billing_items;
create policy cbi_customer_read on public.case_billing_items
  for select to authenticated
  using (
    item_type = 'service'
    and (
      customer_id in (select unnest(my_scope_customer_ids()))
      or (
        case_type = 'contract'
        and exists (
          select 1 from cases c
          where c.id = case_billing_items.case_id
            and c.customer_id in (select unnest(my_scope_customer_ids()))
        )
      )
    )
  );

create or replace function public.customer_case_article_lines(p_case_id uuid)
returns table (
  id uuid,
  article_name text,
  article_code text,
  quantity numeric,
  mapped_service_id uuid,
  status text,
  visit_number integer
)
language sql
stable
security definer
set search_path = public
as $$
  select cbi.id, cbi.article_name::text, cbi.article_code::text, cbi.quantity::numeric,
         cbi.mapped_service_id, cbi.status::text, cbi.visit_number::integer
  from case_billing_items cbi
  where cbi.case_id = p_case_id
    and cbi.item_type = 'article'
    and (
      (select s.is_staff or s.is_sales or s.technician_id is not null from my_case_scope() s)
      or cbi.customer_id in (select unnest(my_scope_customer_ids()))
      or (
        cbi.case_type = 'contract'
        and exists (
          select 1 from cases c
          where c.id = cbi.case_id
            and c.customer_id in (select unnest(my_scope_customer_ids()))
        )
      )
    );
$$;
revoke all on function public.customer_case_article_lines(uuid) from public;
grant execute on function public.customer_case_article_lines(uuid) to authenticated;
comment on function public.customer_case_article_lines(uuid) is
  'Artikelrader på ett ärende utan prisfält, för kundportalen. Inköpspriset lämnar aldrig personalens vyer.';

drop policy if exists "Alla kan läsa aktiva artiklar" on public.articles;
create policy "Personal kan läsa artiklar" on public.articles
  for select to authenticated
  using ((select s.is_staff or s.is_sales or s.technician_id is not null from my_case_scope() s));

drop policy if exists "Alla kan läsa aktiva prislistor" on public.price_lists;
create policy "Personal kan läsa prislistor" on public.price_lists
  for select to authenticated
  using ((select s.is_staff or s.is_sales or s.technician_id is not null from my_case_scope() s));

drop policy if exists "Alla kan läsa prislisteposter" on public.price_list_items;
create policy "Personal kan läsa prislisteposter" on public.price_list_items
  for select to authenticated
  using ((select s.is_staff or s.is_sales or s.technician_id is not null from my_case_scope() s));
