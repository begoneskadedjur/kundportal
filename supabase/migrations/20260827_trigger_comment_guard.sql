-- 20260827_trigger_comment_guard.sql
-- Skydda systemkommentaren i handle_invoice_paid.
--
-- Bakgrund: trg_invoice_paid är AFTER UPDATE och kör i samma transaktion som
-- UPDATE:n. Ett fel i case_comments-inserten rullade därför tillbaka HELA
-- transaktionen — både status='paid' och provisionsflytten till ready_for_payout.
-- Notisen är en bekvämlighet; betalningen och provisionen är affärskritiska.
--
-- Scope (viktigt): exception-blocket omsluter ENBART notisblocket. Uppdateringen
-- av commission_posts ligger FÖRE blocket och påverkas inte — ett fel där ska
-- fortfarande rulla tillbaka, annars kunde en faktura markeras betald utan att
-- teknikerns provision flyttas, tyst, och upptäckas först vid löneunderlaget.
--
-- Samtidigt: deterministiskt val av systemförfattare (order by), tidigare var
-- "limit 1" utan sortering godtyckligt bland flera admins.

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
  if new.case_id is null then
    return new;
  end if;

  v_payout_month := public.compute_payout_month(coalesce(new.paid_at, now())::date);

  -- AFFÄRSKRITISKT: provisionsflytten ligger utanför exception-blocket nedan.
  update commission_posts cp
  set status = 'ready_for_payout',
      invoice_paid_date = coalesce(new.paid_at, now())::date,
      payout_month = v_payout_month,
      updated_at = now()
  where cp.case_id = new.case_id::text
    and cp.status = 'pending_invoice';

  get diagnostics v_moved = row_count;

  v_comment_case_type := coalesce(new.case_type, 'contract');
  v_amount_text := replace(trim(to_char(coalesce(new.total_amount, 0), 'FM999G999G990')), ',', ' ');

  -- Endast notisen är skyddad: begin/exception sätter en implicit savepoint, så
  -- ett fel här ångrar bara inserten. Betalningen och provisionsflytten består.
  begin
    if not exists (
      select 1 from case_comments
      where case_id = new.case_id
        and system_event_type = 'invoice_paid'
        and content like ('%' || coalesce(new.invoice_number, new.id::text) || '%')
    ) then
      select user_id into v_system_author
      from profiles
      where is_admin = true
      order by created_at, user_id
      limit 1;

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
                 then ' - ' || v_moved || ' provisionspost' ||
                      case when v_moved = 1 then '' else 'er' end || ' flyttad till utbetalningsklar.'
                 else '.' end,
          true,
          'invoice_paid',
          '[]'::jsonb, '{}'::uuid[], '{}'::text[], false
        );
      end if;
    end if;
  exception when others then
    raise warning 'handle_invoice_paid: kunde inte skriva systemkommentar for faktura % (%): %',
      coalesce(new.invoice_number, new.id::text), sqlstate, sqlerrm;
  end;

  return new;
end;
$$;

comment on function public.handle_invoice_paid() is
  'Vid betald faktura: flyttar provision till ready_for_payout och skriver systemkommentar. Notisen ar skyddad av exception-block sa den aldrig kan rulla tillbaka betalning eller provisionsflytt.';
