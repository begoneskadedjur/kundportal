-- Steg 6 (avtalsåret på avtalsdag): prov av periodregeln i SQL.
-- Rullas ALLTID tillbaka: blocket avslutas med raise exception som bär
-- resultatet, så att ändringen av billing_anchor_mode aldrig sparas.
-- Kör efter migrationen 20261030_avtalsar_perioder.sql (eller i samma
-- anrop, direkt efter migrationens satser, för prov före skarp körning).
-- Förväntat: alla rader "OK", inga "FEL".

do $t$
declare
  v_fev constant uuid := '72818957-73cb-4860-9080-ebcde5351670';  -- FEV, start 2026-06-30, ankare 7
  v_admin constant text := '4ef86aa9-8f9f-4602-a4fd-967d0424697a';
  v_out text := '';
  v_d date;
  v_ps date;
  v_pe date;
  v_j jsonb;
  v_n int;
begin
  -- 1. Gamla läget: dagens svar
  v_d := public.contract_next_period_start(v_fev, '2026-10-30');
  v_out := v_out || format(E'\n%s 1 gamla läget next_period_start = %s (väntat 2027-07-01)', case when v_d = '2027-07-01' then 'OK ' else 'FEL' end, v_d);
  select count(*) into v_n from public.contract_period_on(v_fev, '2026-10-30');
  v_out := v_out || format(E'\n%s 2 gamla läget contract_period_on tomt (%s rader)', case when v_n = 0 then 'OK ' else 'FEL' end, v_n);

  -- Exakt läge på FEV
  update public.contracts set billing_anchor_mode = 'start_day' where id = v_fev;

  select period_start, period_end into v_ps, v_pe from public.contract_period_on(v_fev, '2026-10-30');
  v_out := v_out || format(E'\n%s 3 period_on = %s t.o.m. %s (väntat 2026-06-30 t.o.m. 2027-06-29)',
    case when v_ps = '2026-06-30' and v_pe = '2027-06-29' then 'OK ' else 'FEL' end, v_ps, v_pe);
  v_d := public.contract_next_period_start(v_fev, '2026-10-30');
  v_out := v_out || format(E'\n%s 4 exakt next_period_start = %s (väntat 2027-06-30)', case when v_d = '2027-06-30' then 'OK ' else 'FEL' end, v_d);
  v_d := public.contract_next_period_start(v_fev, '2027-06-29');
  v_out := v_out || format(E'\n%s 5 sista dagen 2027-06-29 ger %s (väntat 2027-06-30)', case when v_d = '2027-06-30' then 'OK ' else 'FEL' end, v_d);
  v_d := public.contract_next_period_start(v_fev, '2027-06-30');
  v_out := v_out || format(E'\n%s 6 periodstart 2027-06-30 ger %s (väntat 2028-06-30)', case when v_d = '2028-06-30' then 'OK ' else 'FEL' end, v_d);

  -- contract_customer_view faller i prod redan före steg 6 på pli.price
  -- (kolumnen heter custom_price). Då provas vyns nya gren med samma uttryck.
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
  begin
    v_j := public.contract_customer_view(v_fev);
    v_d := (v_j->'premium'->>'next_invoice')::date;
    v_out := v_out || format(E'\n%s 7 contract_customer_view next_invoice = %s (väntat %s)',
      case when v_d = public.contract_next_period_start(v_fev, (now() at time zone 'Europe/Stockholm')::date) then 'OK ' else 'FEL' end,
      v_d, public.contract_next_period_start(v_fev, (now() at time zone 'Europe/Stockholm')::date));
  exception when undefined_column then
    v_d := public.contract_next_period_start(v_fev, (now() at time zone 'Europe/Stockholm')::date);
    v_out := v_out || format(E'\n%s 7 vyn faller på %s (fel sedan tidigare); vyns uttryck ger %s (väntat 2027-06-30)',
      case when v_d = '2027-06-30' then 'OK ' else 'FEL' end, sqlerrm, v_d);
  end;

  v_d := public.contract_next_unplanned_period(v_fev, '2026-10-30');
  v_out := v_out || format(E'\n%s 8 next_unplanned_period = %s (2027-06-30 om ingen faktura täcker perioden, annars tomt)',
    case when v_d is null or v_d = '2027-06-30' then 'OK ' else 'FEL' end, coalesce(v_d::text, 'null'));

  -- Klampning i den rena varianten
  select period_start, period_end into v_ps, v_pe from public.contract_period_on_pure('2024-02-29', 'annual', '2027-03-01');
  v_out := v_out || format(E'\n%s 9 29 feb årsvis: %s t.o.m. %s (väntat 2027-02-28 t.o.m. 2028-02-28)',
    case when v_ps = '2027-02-28' and v_pe = '2028-02-28' then 'OK ' else 'FEL' end, v_ps, v_pe);
  select period_start, period_end into v_ps, v_pe from public.contract_period_on_pure('2026-01-31', 'monthly', '2026-03-15');
  v_out := v_out || format(E'\n%s 10 31 jan månadsvis: %s t.o.m. %s (väntat 2026-02-28 t.o.m. 2026-03-30)',
    case when v_ps = '2026-02-28' and v_pe = '2026-03-30' then 'OK ' else 'FEL' end, v_ps, v_pe);
  select period_start, period_end into v_ps, v_pe from public.contract_period_on_pure('2025-03-31', null, '2026-10-30');
  v_out := v_out || format(E'\n%s 11 frekvens NULL = årsvis: %s t.o.m. %s (väntat 2026-03-31 t.o.m. 2027-03-30)',
    case when v_ps = '2026-03-31' and v_pe = '2027-03-30' then 'OK ' else 'FEL' end, v_ps, v_pe);
  select period_start, period_end into v_ps, v_pe from public.contract_period_on_pure('2026-11-15', 'quarterly', '2026-10-30');
  v_out := v_out || format(E'\n%s 12 dag före start ger första perioden: %s t.o.m. %s',
    case when v_ps = '2026-11-15' and v_pe = '2027-02-14' then 'OK ' else 'FEL' end, v_ps, v_pe);

  -- Övriga avtal opåverkade av FEV:s läge
  select count(*) into v_n from public.contracts where billing_anchor_mode is not null and id <> v_fev;
  v_out := v_out || format(E'\n%s 13 inga andra avtal i exakt läge (%s)', case when v_n = 0 then 'OK ' else 'FEL' end, v_n);

  raise exception 'RESULTAT (rullas tillbaka):%', v_out;
end $t$;
