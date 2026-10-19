-- Spärr mot besök där sluttiden ligger före starttiden (3.70.3).
-- Ett sådant besök ritas inte i schemat och teknikerns beläggning blir negativ
-- (BE-0009027, BE-0009178). Appen stoppar det i modalerna, det här är sista
-- skyddet för alla skrivvägar (dra och släpp, API, RPC).
--
-- Kontrollen körs bara när tiderna faktiskt ändras, så att gamla rader med fel
-- tider fortfarande kan sparas för annat (fakturering, status).

create or replace function public.kontrollera_besokstid()
returns trigger
language plpgsql
as $$
declare
  ny_start timestamptz;
  ny_slut timestamptz;
  gammal_start timestamptz;
  gammal_slut timestamptz;
begin
  if tg_table_name = 'cases' then
    ny_start := new.scheduled_start;
    ny_slut := new.scheduled_end;
    if tg_op = 'UPDATE' then
      gammal_start := old.scheduled_start;
      gammal_slut := old.scheduled_end;
    end if;
  else
    ny_start := new.start_date;
    ny_slut := new.due_date;
    if tg_op = 'UPDATE' then
      gammal_start := old.start_date;
      gammal_slut := old.due_date;
    end if;
  end if;

  if ny_start is not null and ny_slut is not null and ny_slut < ny_start
     and (tg_op = 'INSERT'
          or ny_start is distinct from gammal_start
          or ny_slut is distinct from gammal_slut) then
    raise exception 'Sluttid kan inte vara tidigare än starttiden.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create or replace trigger kontrollera_besokstid
  before insert or update of scheduled_start, scheduled_end on public.cases
  for each row execute function public.kontrollera_besokstid();

create or replace trigger kontrollera_besokstid
  before insert or update of start_date, due_date on public.private_cases
  for each row execute function public.kontrollera_besokstid();

create or replace trigger kontrollera_besokstid
  before insert or update of start_date, due_date on public.business_cases
  for each row execute function public.kontrollera_besokstid();
