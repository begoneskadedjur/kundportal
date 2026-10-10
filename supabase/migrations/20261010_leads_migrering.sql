-- Leads etapp 3: migrering av befintliga leads till nya modellen (körs en gång, inget raderas).
--
-- * stage från gamla status: green_deal -> vunnen, red_lost -> forlorad (orsak ovrigt),
--   orange_hot -> offert_skickad om offertdatum eller en "Offert skickad"-händelse finns, annars kontaktad,
--   yellow_warm -> kontaktad, blue_cold -> ny. Gamla status sparas i legacy_status.
-- * ägare = skaparen. Skapad av tekniker: tipsare = skaparen och källa tekniker_tips (ägaren är ändå
--   skaparen så att ingen tappar sin lead).
-- * källa ur fritexten (source_fritext ligger kvar), resten ovrigt.
-- * nästa steg: öppna leads får follow_up_date som datum ("Följ upp"), annars tomt (hamnar i "Saknar nästa steg").
-- * kollegor i lead_technicians blir delade medlemmar (lead_members) så att ingen tappar synlighet.
-- * historik till lead_activities: en "skapad" per lead, statusbyten, offert skickad, värdeändringar,
--   manuella händelser (samtal, möte, anteckning, ny kontaktperson) och alla kommentarer. Brus
--   ("X uppdaterad", taggar, BANT, dubbla skapad, tester) kopieras inte. lead_events/lead_comments lämnas orörda.

do $$
declare
  v_klar boolean;
begin
  select exists (select 1 from public.lead_activities) into v_klar;
  if v_klar then
    raise notice 'lead_activities har redan rader, migreringen hoppas över';
    return;
  end if;

  perform set_config('begone.leads_migrering', 'on', true);

  update public.leads set legacy_status = status where legacy_status is null;

  update public.leads l set
    stage = case l.legacy_status
      when 'green_deal' then 'vunnen'
      when 'red_lost' then 'forlorad'
      when 'orange_hot' then case
        when l.quote_provided_date is not null
          or exists (select 1 from public.lead_events e where e.lead_id = l.id and e.event_type = 'quote_sent' and e.title = 'Offert skickad')
        then 'offert_skickad' else 'kontaktad' end
      when 'yellow_warm' then 'kontaktad'
      else 'ny'
    end::public.lead_stage,
    lost_reason = case when l.legacy_status = 'red_lost' then 'ovrigt' end::public.lead_lost_reason,
    lost_at = case when l.legacy_status = 'red_lost' then coalesce(
      (select max(e.created_at) from public.lead_events e where e.lead_id = l.id and e.event_type = 'status_changed' and e.data->>'new_status' = 'red_lost'),
      l.updated_at) end,
    won_at = case when l.legacy_status = 'green_deal' then coalesce(
      (select max(e.created_at) from public.lead_events e where e.lead_id = l.id and e.event_type = 'status_changed' and e.data->>'new_status' = 'green_deal'),
      l.updated_at) end,
    owner_profile_id = l.created_by,
    tipped_by_profile_id = case when p.role = 'technician' then l.created_by end,
    source = case
      when p.role = 'technician' then 'tekniker_tips'
      when l.source_fritext is null or btrim(l.source_fritext) = '' then 'ovrigt'
      when l.source_fritext ~* '(mail|mejl|e-post|@|infoadress)' then 'mejl'
      when l.source_fritext ~* '(telefon|telfon|samtal)' or regexp_replace(l.source_fritext, '[\s+-]', '', 'g') ~ '^[0-9]{7,}$' then 'telefon'
      when l.source_fritext ~* '(kompis|rekommend|tipsad)' then 'rekommendation'
      when l.source_fritext ~* 'sanering' then 'engangsarende'
      else 'ovrigt'
    end::public.lead_source,
    lead_type = 'nytt_avtal',
    customer_group = case
      when l.company_name ~* '(^|\s)brf(\s|$)|förening|samfällighet' then 'forening'
      else 'foretag'
    end::public.lead_customer_group,
    next_action_at = case when l.legacy_status not in ('green_deal', 'red_lost') then l.follow_up_date end,
    next_action = case when l.legacy_status not in ('green_deal', 'red_lost') and l.follow_up_date is not null then 'Följ upp' end
  from public.profiles p
  where p.id = l.created_by;

  -- Separat steg: before-triggern sätter stage_changed_at = now() när stage byts ovan
  update public.leads l set stage_changed_at = coalesce(
      (select max(e.created_at) from public.lead_events e where e.lead_id = l.id and e.event_type = 'status_changed'),
      l.created_at);

  -- Skapad: en per lead
  insert into public.lead_activities (lead_id, kind, till_varde, occurred_at, profile_id, created_at)
  select l.id, 'skapad', l.source::text, l.created_at, l.created_by, now()
    from public.leads l;

  -- Statusbyten (triggerns rader, inte klientens dubbletter "Status ändrad till ...")
  insert into public.lead_activities (lead_id, kind, fran_varde, till_varde, occurred_at, profile_id, created_at)
  select e.lead_id,
         case when e.data->>'new_status' = 'red_lost' then 'forlorad' else 'stage' end::public.lead_activity_kind,
         public.lead_stage_fran_status(e.data->>'old_status')::text,
         case when e.data->>'new_status' = 'red_lost' then 'ovrigt'
              else public.lead_stage_fran_status(e.data->>'new_status')::text end,
         e.created_at, e.created_by, now()
    from public.lead_events e
   where e.event_type = 'status_changed' and e.title = 'Status ändrad';

  -- Offert skickad (triggerns rader med offertdatum)
  insert into public.lead_activities (lead_id, kind, text, occurred_at, profile_id, created_at)
  select e.lead_id, 'offert_skickad',
         'Offertdatum ' || to_char((e.data->>'quote_date')::timestamptz at time zone 'Europe/Stockholm', 'YYYY-MM-DD'),
         e.created_at, e.created_by, now()
    from public.lead_events e
   where e.event_type = 'quote_sent' and e.title = 'Offert skickad';

  -- Värdeändringar
  insert into public.lead_activities (lead_id, kind, fran_varde, till_varde, occurred_at, profile_id, created_at)
  select e.lead_id, 'varde', e.data->>'old_estimated_value', e.data->>'new_estimated_value', e.created_at, e.created_by, now()
    from public.lead_events e
   where e.title = 'Uppskattat värde ändrat' and e.data ? 'new_estimated_value';

  -- Manuella händelser
  insert into public.lead_activities (lead_id, kind, text, occurred_at, profile_id, created_at)
  select e.lead_id,
         case e.event_type when 'contacted' then 'samtal' when 'meeting' then 'mote' else 'anteckning' end::public.lead_activity_kind,
         case when e.title like 'Ny kontaktperson tillagd:%' then coalesce(e.description, e.title)
              when e.description is null or btrim(e.description) = '' or e.description = e.title then e.title
              else e.title || ': ' || e.description end,
         e.created_at, e.created_by, now()
    from public.lead_events e
   where (e.event_type = 'contacted' and e.title not in ('Kontaktdatum uppdaterat', 'Huvudkontakt tillagd', 'RLS-policy test efter fix'))
      or (e.event_type = 'meeting' and e.title <> 'Test från frontend')
      or (e.event_type = 'assigned' and e.title not like 'Kollega tilldelad%')
      or e.title like 'Ny kontaktperson tillagd:%';

  -- Kommentarer
  insert into public.lead_activities (lead_id, kind, text, occurred_at, profile_id, created_at)
  select c.lead_id,
         case c.comment_type when 'call' then 'samtal' when 'meeting' then 'mote' when 'email' then 'mejl' else 'anteckning' end::public.lead_activity_kind,
         c.content, c.created_at, c.created_by, now()
    from public.lead_comments c;

  -- Kollegor blir delade medlemmar (inte ägaren själv)
  insert into public.lead_members (lead_id, profile_id, added_by, created_at)
  select distinct on (lt.lead_id, p.id) lt.lead_id, p.id, lt.assigned_by, lt.assigned_at
    from public.lead_technicians lt
    join public.profiles p on p.technician_id = lt.technician_id
    join public.leads l on l.id = lt.lead_id
   where p.id is distinct from l.owner_profile_id
   order by lt.lead_id, p.id, lt.assigned_at
  on conflict (lead_id, profile_id) do nothing;

  insert into public.lead_activities (lead_id, kind, till_varde, occurred_at, profile_id, created_at)
  select m.lead_id, 'delad', m.profile_id::text, m.created_at, m.added_by, now()
    from public.lead_members m;
end $$;
