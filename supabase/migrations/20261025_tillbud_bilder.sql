-- Bilder i tillbudsrapporter (2026-10-24).
-- Privat bucket incident-attachments, sökväg <incident_id>/<uuid>.<ext>, och tabellen
-- incident_attachments med en rad per bild. Den som får se rapporten (can_view_incident:
-- rapportören, mottagarna av typen och berörda tekniker) får se bilderna. Rapportören och
-- mottagarna får lägga till; den som laddat upp och mottagarna får ta bort.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('incident-attachments', 'incident-attachments', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;

create table if not exists public.incident_attachments (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.case_incidents(id) on delete cascade,
  file_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size integer,
  uploaded_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists incident_attachments_incident_idx on public.incident_attachments (incident_id);

alter table public.incident_attachments enable row level security;

-- Får lägga till bilder: rapportören och mottagarna av typen
create or replace function public.kan_lagga_bild_pa_tillbud(p_incident_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from case_incidents ci
    where ci.id = p_incident_id
      and (ci.reported_by_id = auth.uid()
           or exists (select 1 from incident_recipients ir where ir.user_id = auth.uid() and ir.incident_type = ci.type))
  );
$$;

create policy "Se bilder i synliga tillbud" on public.incident_attachments
  for select to authenticated
  using (public.can_view_incident(incident_id));

create policy "Rapportör och mottagare lägger till bilder" on public.incident_attachments
  for insert to authenticated
  with check (uploaded_by = auth.uid() and public.kan_lagga_bild_pa_tillbud(incident_id));

create policy "Uppladdare och mottagare tar bort bilder" on public.incident_attachments
  for delete to authenticated
  using (uploaded_by = auth.uid() or exists (
    select 1 from public.case_incidents ci
    where ci.id = incident_attachments.incident_id and public.is_incident_recipient_of(ci.type)
  ));

-- Filerna: mappen är rapportens id
create policy "Se tillbudsbilder" on storage.objects
  for select to authenticated
  using (bucket_id = 'incident-attachments'
         and public.can_view_incident(((storage.foldername(name))[1])::uuid));

create policy "Ladda upp tillbudsbilder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'incident-attachments'
              and public.kan_lagga_bild_pa_tillbud(((storage.foldername(name))[1])::uuid));

create policy "Ta bort tillbudsbilder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'incident-attachments'
         and (owner_id = auth.uid()::text
              or exists (select 1 from public.case_incidents ci
                         where ci.id = ((storage.foldername(name))[1])::uuid
                           and public.is_incident_recipient_of(ci.type))));
