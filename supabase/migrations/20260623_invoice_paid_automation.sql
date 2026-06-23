-- 20260623_invoice_paid_automation.sql
-- Automatik vid betald faktura:
--   1. Flytta tillhörande provision (commission_posts) pending_invoice -> ready_for_payout
--      med Fortnox faktiska betaldatum (NEW.paid_at), inte dagens datum.
--   2. Logga en systemkommentar "Faktura betald" i ärendets kommunikationspanel.
--
-- Trigger på `invoices` (täcker privat/företag via invoice_type case/private/business
-- OCH avtalskundernas ad-hoc/merförsäljning via invoice_type='adhoc' — alla har case_id).
--
-- Designval:
--   * Endast pending_invoice-provision rörs  -> ingen risk för dubbelutbetalning av
--     redan godkänd/utbetald provision.
--   * Fyrar bara vid faktisk övergång till 'paid' (WHEN-villkor).
--   * commission_posts.case_id är TEXT medan invoices.case_id är UUID -> casta.
--   * invoices.case_type är NULL för adhoc; case_comments kräver NOT NULL och tillåter
--     private/business/contract -> härled 'contract' när invoices.case_type är null.
--   * Dubblettskydd: skapar bara kommentar om ingen 'invoice_paid'-kommentar redan finns.
--   * SECURITY DEFINER så att webhook/cron (service_role) och RLS inte blockerar.

create or replace function public.handle_invoice_paid()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_system_author uuid;
  v_moved integer := 0;
  v_payout_month text;
  v_comment_case_type text;
  v_amount_text text;
begin
  -- Ingen case-koppling -> inget att göra (t.ex. månadsbatch-adhoc utan case_id)
  if new.case_id is null then
    return new;
  end if;

  v_payout_month := to_char((coalesce(new.paid_at, now())::date + interval '1 month'), 'YYYY-MM');

  -- 1) Flytta provision: bara poster som väntar på betalning
  update commission_posts cp
  set status = 'ready_for_payout',
      invoice_paid_date = coalesce(new.paid_at, now())::date,
      payout_month = v_payout_month,
      updated_at = now()
  where cp.case_id = new.case_id::text
    and cp.status = 'pending_invoice';

  get diagnostics v_moved = row_count;

  -- Härled case_type för kommentaren (case_comments.case_type är NOT NULL)
  v_comment_case_type := coalesce(new.case_type, 'contract');

  -- Svensk formatering: mellanslag som tusentalsavgränsare
  v_amount_text := replace(trim(to_char(coalesce(new.total_amount, 0), 'FM999G999G990')), ',', ' ');

  -- 2) Logga systemkommentar i kommunikationspanelen (en gång per faktura)
  if not exists (
    select 1 from case_comments
    where case_id = new.case_id
      and system_event_type = 'invoice_paid'
      and content like ('%' || coalesce(new.invoice_number, new.id::text) || '%')
  ) then
    select user_id into v_system_author from profiles where is_admin = true limit 1;

    if v_system_author is not null then
      insert into case_comments (
        case_id, case_type, author_id, author_name, author_role,
        content, is_system_comment, system_event_type,
        attachments, mentioned_user_ids, mentioned_roles, mentions_all
      ) values (
        new.case_id,
        v_comment_case_type,
        v_system_author,
        'System',
        'admin',
        'Faktura ' || coalesce(new.invoice_number, '') || ' betald (' || v_amount_text || ' kr)' ||
          case when v_moved > 0
               then ' — ' || v_moved || ' provisionspost' ||
                    case when v_moved = 1 then '' else 'er' end || ' flyttad till utbetalningsklar.'
               else '.' end,
        true,
        'invoice_paid',
        '[]'::jsonb, '{}'::uuid[], '{}'::text[], false
      );
    end if;
  end if;

  return new;
end;
$$;

-- Trigger: fyrar bara när status faktiskt övergår TILL 'paid'
drop trigger if exists trg_invoice_paid on public.invoices;
create trigger trg_invoice_paid
  after update on public.invoices
  for each row
  when (old.status is distinct from new.status and new.status = 'paid')
  execute function public.handle_invoice_paid();
