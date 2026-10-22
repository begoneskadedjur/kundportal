-- Ny arbetsvy för tekniker (2026-10-22)
--
-- Flaggor på profiles, alla avstängda som standard så att ingen annan än den
-- som får flaggan märker något:
--   ny_arbetsvy         den nya teknikervyn (startsida, ärendelista, steg i ärendet)
--   tekniker_far_byta   personen får själv slå av och på ny_arbetsvy under Mitt konto
--   visa_hjalptexter    personens egen inställning för hjälptexter
--   visa_genomgangar    personens egen inställning för genomgångar
--   sedda_genomgangar   id:n på genomgångar personen har sett
--
-- Skydd: profiles_consolidated_update låter användaren uppdatera sin egen rad.
-- Triggern a_guard_ny_arbetsvy spärrar därför tekniker_far_byta för alla utom
-- administratör/service role, och ny_arbetsvy om inte old.tekniker_far_byta är
-- true. Den reagerar bara när just de kolumnerna ändras.
--
-- Christian (user_id 4ef86aa9-8f9f-4602-a4fd-967d0424697a) fick ny_arbetsvy = true
-- som separat dataändring, inte i denna fil.

alter table public.profiles
  add column if not exists ny_arbetsvy boolean not null default false,
  add column if not exists tekniker_far_byta boolean not null default false,
  add column if not exists visa_hjalptexter boolean not null default true,
  add column if not exists visa_genomgangar boolean not null default true,
  add column if not exists sedda_genomgangar text[] not null default '{}';

create or replace function public.guard_profile_ny_arbetsvy()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.tekniker_far_byta is distinct from old.tekniker_far_byta
     and not public.is_admin_writer() then
    raise exception 'Behörighet saknas: endast administratör får ändra om personen får byta vy själv'
      using errcode = '42501';
  end if;

  if new.ny_arbetsvy is distinct from old.ny_arbetsvy
     and old.tekniker_far_byta is not true
     and not public.is_admin_writer() then
    raise exception 'Behörighet saknas: du får inte byta till eller från den nya arbetsvyn själv'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'a_guard_ny_arbetsvy' and tgrelid = 'public.profiles'::regclass
  ) then
    create trigger a_guard_ny_arbetsvy
      before update on public.profiles
      for each row
      execute function public.guard_profile_ny_arbetsvy();
  end if;
end $$;
