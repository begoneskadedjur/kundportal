-- 20261017_ticket_status_rpc.sql
-- Statusändring på tickets (case_comments) via security definer-RPC:er.
--
-- Bakgrund: RLS-policyn "Users can update own comments" (auth.uid() = author_id) släppte bara
-- igenom författaren. Knappen Markera löst syns för alla, och klienten kontrollerade inte hur
-- många rader som ändrades, så för alla andra såg det ut som Löst tills sidan laddades om.
-- Samma tysta fel gällde återöppningen när någon annan än författaren svarade i en löst ticket.
--
-- Lösning: ingen bredare UPDATE-policy. Två RPC:er som bara rör statusfälten
-- (status, resolved_at, resolved_by) och själva prövar behörigheten.
--
-- 1. set_case_comment_status(p_comment_id, p_status) -> case_comments
--    Får anropas av:
--      * författaren till kommentaren eller till trådens rotkommentar (ticketen)
--      * den som är nämnd i ticketen (rot eller något svar): mentioned_user_ids
--      * medlem i en nämnd grupp: mentioned_roles ('admin' | 'koordinator' | 'technician')
--        prövat mot profiles.role, is_admin, is_koordinator och extra_roles
--      * alla interna (role <> 'customer') när ticketen eller ett svar har mentions_all (@alla)
--      * admin och koordinator (role, is_admin, is_koordinator, extra_roles)
--    Kastar fel (42501) vid saknad behörighet, (P0002) om kommentaren inte finns,
--    (22023) vid ogiltig status. Returnerar den uppdaterade raden.
--
-- 2. reopen_ticket_on_reply(p_reply_id) -> boolean
--    Anropas efter att ett svar skapats. Den som skrev svaret (auth.uid() = author_id på svaret)
--    återöppnar trådens rotkommentar om den är löst, oavsett vem det är. Det är systemets avsikt:
--    ett nytt svar betyder att frågan lever igen. Kravet på att man själv skrivit svaret hindrar
--    att RPC:n används för att återöppna godtyckliga tickets. Returnerar true om något återöppnades.
--
-- resolved_by refererar auth.users(id) och sätts alltid till auth.uid() på servern.

create or replace function public.case_comment_root_id(p_comment_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_id uuid := p_comment_id;
  v_parent uuid;
  v_guard int := 0;
begin
  loop
    select c.parent_comment_id into v_parent from public.case_comments c where c.id = v_id;
    if not found then
      return null;
    end if;
    exit when v_parent is null;
    v_id := v_parent;
    v_guard := v_guard + 1;
    exit when v_guard > 50;
  end loop;
  return v_id;
end;
$$;

revoke all on function public.case_comment_root_id(uuid) from public, anon;
grant execute on function public.case_comment_root_id(uuid) to authenticated;

create or replace function public.can_set_case_comment_status(p_comment_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_root uuid;
  v_role text;
  v_is_admin boolean;
  v_is_koord boolean;
  v_is_tech boolean;
  v_internal boolean;
  v_extra text[];
begin
  if v_uid is null then
    return false;
  end if;

  v_root := public.case_comment_root_id(p_comment_id);
  if v_root is null then
    return false;
  end if;

  select p.role::text,
         coalesce(p.is_admin, false),
         coalesce(p.is_koordinator, false),
         coalesce(p.extra_roles, '{}'::text[])
    into v_role, v_is_admin, v_is_koord, v_extra
    from public.profiles p
   where p.user_id = v_uid or p.id = v_uid
   order by (p.user_id = v_uid) desc
   limit 1;

  if not found or coalesce(v_role, 'customer') = 'customer' then
    -- Kunder och okända konton: bara egna kommentarer (finns inte i praktiken, author_role kräver intern roll)
    return exists (
      select 1 from public.case_comments c
       where c.id in (p_comment_id, v_root) and c.author_id = v_uid
    );
  end if;

  v_is_admin := v_is_admin or v_role = 'admin' or 'admin' = any(v_extra);
  v_is_koord := v_is_koord or v_role = 'koordinator' or 'koordinator' = any(v_extra);
  v_is_tech  := v_role = 'technician' or 'technician' = any(v_extra);
  v_internal := true;

  -- Admin och koordinator får alltid
  if v_is_admin or v_is_koord then
    return true;
  end if;

  -- Författaren till kommentaren eller till ticketen
  if exists (
    select 1 from public.case_comments c
     where c.id in (p_comment_id, v_root) and c.author_id = v_uid
  ) then
    return true;
  end if;

  -- Nämnd personligen, i grupp eller via @alla någonstans i tråden (rot + alla svar)
  return exists (
    with recursive thread as (
      select c.id from public.case_comments c where c.id = v_root
      union all
      select c.id from public.case_comments c join thread t on c.parent_comment_id = t.id
    )
    select 1
      from public.case_comments c
      join thread t on t.id = c.id
     where v_uid = any(coalesce(c.mentioned_user_ids, '{}'::uuid[]))
        or (v_internal and coalesce(c.mentions_all, false))
        or ('admin' = any(coalesce(c.mentioned_roles, '{}'::text[])) and v_is_admin)
        or ('koordinator' = any(coalesce(c.mentioned_roles, '{}'::text[])) and v_is_koord)
        or ('technician' = any(coalesce(c.mentioned_roles, '{}'::text[])) and v_is_tech)
  );
end;
$$;

revoke all on function public.can_set_case_comment_status(uuid) from public, anon;
grant execute on function public.can_set_case_comment_status(uuid) to authenticated;

create or replace function public.set_case_comment_status(p_comment_id uuid, p_status text)
returns public.case_comments
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.case_comments;
begin
  if v_uid is null then
    raise exception 'Du måste vara inloggad för att ändra status' using errcode = '42501';
  end if;

  if p_status is null or p_status not in ('open', 'resolved') then
    raise exception 'Ogiltig status: %', coalesce(p_status, 'null') using errcode = '22023';
  end if;

  perform 1 from public.case_comments c where c.id = p_comment_id;
  if not found then
    raise exception 'Ticketen finns inte längre' using errcode = 'P0002';
  end if;

  if not public.can_set_case_comment_status(p_comment_id) then
    raise exception 'Bara den som skrev ticketen, den som är nämnd i den eller admin och koordinator kan ändra status'
      using errcode = '42501';
  end if;

  update public.case_comments c
     set status      = p_status,
         resolved_at = case when p_status = 'resolved' then now() else null end,
         resolved_by = case when p_status = 'resolved' then v_uid else null end
   where c.id = p_comment_id
  returning c.* into v_row;

  if not found then
    raise exception 'Statusen kunde inte ändras' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

revoke all on function public.set_case_comment_status(uuid, text) from public, anon;
grant execute on function public.set_case_comment_status(uuid, text) to authenticated;

create or replace function public.reopen_ticket_on_reply(p_reply_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_parent uuid;
  v_author uuid;
  v_root uuid;
begin
  if v_uid is null then
    raise exception 'Du måste vara inloggad' using errcode = '42501';
  end if;

  select c.parent_comment_id, c.author_id into v_parent, v_author
    from public.case_comments c where c.id = p_reply_id;

  if not found then
    raise exception 'Svaret finns inte' using errcode = 'P0002';
  end if;

  if v_parent is null then
    return false; -- inte ett svar
  end if;

  if v_author is distinct from v_uid then
    raise exception 'Bara den som skrev svaret kan återöppna ticketen via svaret' using errcode = '42501';
  end if;

  v_root := public.case_comment_root_id(p_reply_id);

  update public.case_comments c
     set status = 'open', resolved_at = null, resolved_by = null
   where c.id = v_root and c.status = 'resolved';

  return found;
end;
$$;

revoke all on function public.reopen_ticket_on_reply(uuid) from public, anon;
grant execute on function public.reopen_ticket_on_reply(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS-TEST (kör i SQL-editorn som postgres, i en transaktion som rullas tillbaka).
-- Byt ut <...> mot riktiga id:n. auth.uid() läses från request.jwt.claims.
--
-- begin;
--   -- Välj en löst eller öppen rotkommentar och personerna kring den:
--   -- select id, author_id, mentioned_user_ids, mentioned_roles, mentions_all, status
--   --   from case_comments where parent_comment_id is null order by created_at desc limit 5;
--
--   set local role authenticated;
--
--   -- 1. Författaren: ska lyckas
--   set local request.jwt.claims = '{"sub":"<författarens profil-id>","role":"authenticated"}';
--   select status, resolved_by from set_case_comment_status('<ticket-id>', 'resolved');
--   select status from set_case_comment_status('<ticket-id>', 'open');
--
--   -- 2. Nämnd tekniker (finns i mentioned_user_ids): ska lyckas
--   set local request.jwt.claims = '{"sub":"<nämnd tekniker>","role":"authenticated"}';
--   select status from set_case_comment_status('<ticket-id>', 'resolved');
--
--   -- 3. Tekniker när ticketen har mentioned_roles = {technician} eller mentions_all: ska lyckas
--   -- 4. Admin (role admin eller is_admin eller 'admin' i extra_roles): ska lyckas
--   -- 5. Koordinator (role koordinator eller is_koordinator eller i extra_roles): ska lyckas
--
--   -- 6. Tekniker som inte skrev, inte är nämnd och vars grupp inte är nämnd: ska ge 42501
--   set local request.jwt.claims = '{"sub":"<annan tekniker>","role":"authenticated"}';
--   select set_case_comment_status('<ticket-id>', 'resolved');  -- förväntat: ERROR 42501
--
--   -- 7. Kundkonto: ska ge 42501
--   -- 8. Direkt UPDATE som icke-författare påverkar fortfarande 0 rader (policyn är orörd):
--   update case_comments set status = 'resolved' where id = '<ticket-id>' returning id;  -- 0 rader
--
--   -- 9. Återöppning via svar, oavsett vem som svarar:
--   set local request.jwt.claims = '{"sub":"<valfri intern användare>","role":"authenticated"}';
--   -- (rotkommentaren ska vara resolved först)
--   insert into case_comments (case_id, case_type, author_id, author_name, author_role, content, parent_comment_id)
--     select case_id, case_type, '<valfri intern användare>', 'Test', 'technician', 'test', id
--       from case_comments where id = '<ticket-id>' returning id;   -- ger <svar-id>
--   select reopen_ticket_on_reply('<svar-id>');                     -- förväntat: true
--   select reopen_ticket_on_reply('<svar-id>');                     -- förväntat: false (redan öppen)
--   -- Någon annans svar-id: förväntat ERROR 42501
--
--   -- 10. anon har ingen execute:
--   set local role anon;
--   select set_case_comment_status('<ticket-id>', 'open');          -- förväntat: permission denied
-- rollback;
-- ---------------------------------------------------------------------------
