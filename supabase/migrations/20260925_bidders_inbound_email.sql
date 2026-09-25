-- 20260925_bidders_inbound_email.sql
-- Additiv: anbudsgivare som AI läst ut ur en inkommen e-post får en länk till
-- mejlet, så att de följer med när mejlet flyttas till en annan upphandling
-- eller tas bort när mejlet läggs tillbaka i Osorterat.
--
-- Användare saknar kolumnbehörighet att flytta anbudsgivare, därför sker
-- flytten i en security definer-funktion som kontrollerar has_procurement_access().

alter table public.procurement_bidders
  add column if not exists inbound_email_id uuid references public.procurement_inbound_emails(id) on delete set null;

create index if not exists procurement_bidders_inbound_email_idx on public.procurement_bidders (inbound_email_id);

comment on column public.procurement_bidders.inbound_email_id is
  'Inkommen e-post som anbudsgivaren lästes ut ur (via bilagan i document_id). Styr flytt och borttagning när mejlet kopplas om.';

-- Befintliga rader: härled mejlet ur dokumentet
update public.procurement_bidders b
   set inbound_email_id = d.inbound_email_id
  from public.procurement_documents d
 where d.id = b.document_id
   and d.inbound_email_id is not null
   and b.inbound_email_id is null
   and b.source in ('email', 'document');

-- ---------------------------------------------------------------------------
-- Flytta ett inkommet mejl: till en upphandling, till Osorterat eller ignorera.
-- Bilagorna följer med. Anbudsgivare ur mejlet (källa email eller document)
-- flyttas med ny nyckel handling:{upphandling}:{vem}; finns samma anbudsgivare
-- redan på målet tas den flyttade raden bort. Utan mål tas de bort.

create or replace function public.procurement_move_inbound_email(
  p_email_id uuid,
  p_notice_id uuid,
  p_ignore boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_email record;
  v_actor_name text;
  v_docs integer := 0;
  v_moved integer := 0;
  v_removed integer := 0;
  v_b record;
  v_who text;
  v_key text;
  v_status text;
begin
  if not public.has_procurement_access() then
    raise exception 'Behörighet saknas';
  end if;

  select id, notice_id, subject, from_email into v_email
    from public.procurement_inbound_emails where id = p_email_id for update;
  if not found then
    raise exception 'E-postmeddelandet finns inte';
  end if;

  if p_notice_id is not null and not exists (select 1 from public.procurement_notices where id = p_notice_id) then
    raise exception 'Upphandlingen finns inte';
  end if;

  v_status := case when p_ignore then 'ignored' when p_notice_id is not null then 'matched' else 'unsorted' end;

  update public.procurement_inbound_emails
     set notice_id = case when p_ignore then null else p_notice_id end,
         match_method = case when p_notice_id is not null and not p_ignore then 'manual' else null end,
         status = v_status
   where id = p_email_id;

  -- Bilagor
  update public.procurement_documents
     set notice_id = case when p_ignore then null else p_notice_id end
   where inbound_email_id = p_email_id;
  get diagnostics v_docs = row_count;

  -- Anbudsgivare ur mejlet eller dess bilagor
  for v_b in
    select b.id, b.bidder_key
      from public.procurement_bidders b
     where b.source in ('email', 'document')
       and (b.inbound_email_id = p_email_id
            or b.document_id in (select d.id from public.procurement_documents d where d.inbound_email_id = p_email_id))
  loop
    if p_notice_id is null or p_ignore then
      delete from public.procurement_bidders where id = v_b.id;
      v_removed := v_removed + 1;
    else
      v_who := regexp_replace(v_b.bidder_key, '^.*:', '');
      v_key := 'handling:' || p_notice_id::text || ':' || v_who;
      if exists (select 1 from public.procurement_bidders where bidder_key = v_key and id <> v_b.id) then
        delete from public.procurement_bidders where id = v_b.id;
        v_removed := v_removed + 1;
      else
        update public.procurement_bidders
           set notice_id = p_notice_id,
               award_id = null,
               bidder_key = v_key,
               inbound_email_id = p_email_id
         where id = v_b.id;
        v_moved := v_moved + 1;
      end if;
    end if;
  end loop;

  select coalesce(display_name, email) into v_actor_name from public.profiles where user_id = auth.uid();

  if v_email.notice_id is not null and v_email.notice_id is distinct from p_notice_id then
    insert into public.procurement_events (notice_id, event_type, title, detail, metadata, actor_id, actor_name)
    values (v_email.notice_id, 'inbound_moved',
            case when p_notice_id is null then 'Inkommen e-post flyttad till Osorterat' else 'Inkommen e-post flyttad till annan upphandling' end,
            coalesce(v_email.from_email, 'Okänd avsändare') || ': ' || coalesce(nullif(v_email.subject, ''), '(inget ämne)'),
            jsonb_build_object('inbound_email_id', p_email_id, 'to_notice_id', p_notice_id, 'documents', v_docs, 'bidders_moved', v_moved, 'bidders_removed', v_removed),
            auth.uid(), v_actor_name);
  end if;

  if p_notice_id is not null and not p_ignore and v_email.notice_id is distinct from p_notice_id then
    insert into public.procurement_events (notice_id, event_type, title, detail, metadata, actor_id, actor_name)
    values (p_notice_id, 'inbound_assigned', 'Inkommen e-post kopplad manuellt',
            coalesce(v_email.from_email, 'Okänd avsändare') || ': ' || coalesce(nullif(v_email.subject, ''), '(inget ämne)'),
            jsonb_build_object('inbound_email_id', p_email_id, 'from_notice_id', v_email.notice_id, 'documents', v_docs, 'bidders_moved', v_moved),
            auth.uid(), v_actor_name);
  end if;

  return jsonb_build_object('status', v_status, 'documents', v_docs, 'bidders_moved', v_moved, 'bidders_removed', v_removed);
end;
$$;

revoke all on function public.procurement_move_inbound_email(uuid, uuid, boolean) from public, anon;
grant execute on function public.procurement_move_inbound_email(uuid, uuid, boolean) to authenticated;
