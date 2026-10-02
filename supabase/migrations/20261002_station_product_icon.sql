-- Produktens ikon kopierad till stationen, så att kunder kan se ikonen utan
-- läsrätt till articles (som har inköpspriser). Bara ikonnamnet följer med,
-- aldrig produktnamn eller pris. Hålls i synk av triggers åt båda hållen.

alter table public.equipment_placements add column if not exists product_icon text;
alter table public.indoor_stations add column if not exists product_icon text;

comment on column public.equipment_placements.product_icon is 'Kopia av articles.icon för stationens produkt. Visas för kund; produktnamn visas aldrig.';
comment on column public.indoor_stations.product_icon is 'Kopia av articles.icon för stationens produkt. Visas för kund; produktnamn visas aldrig.';

-- Stationen: sätt ikonen när produkten sätts eller byts
create or replace function public.station_product_icon_sync()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.article_id is null then
    new.product_icon := null;
  elsif tg_op = 'INSERT' or new.article_id is distinct from old.article_id then
    select icon into new.product_icon from public.articles where id = new.article_id;
  end if;
  return new;
end; $$;

create or replace trigger trg_equipment_placements_product_icon
  before insert or update of article_id on public.equipment_placements
  for each row execute function public.station_product_icon_sync();

create or replace trigger trg_indoor_stations_product_icon
  before insert or update of article_id on public.indoor_stations
  for each row execute function public.station_product_icon_sync();

-- Produkten: ny ikon slår igenom på alla stationer med produkten
create or replace function public.article_icon_propagate()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.equipment_placements set product_icon = new.icon
    where article_id = new.id and product_icon is distinct from new.icon;
  update public.indoor_stations set product_icon = new.icon
    where article_id = new.id and product_icon is distinct from new.icon;
  return new;
end; $$;

create or replace trigger trg_articles_icon_propagate
  after update of icon on public.articles
  for each row when (new.icon is distinct from old.icon)
  execute function public.article_icon_propagate();

-- Befintliga stationer
update public.equipment_placements e set product_icon = a.icon
  from public.articles a where a.id = e.article_id and e.product_icon is distinct from a.icon;
update public.indoor_stations s set product_icon = a.icon
  from public.articles a where a.id = s.article_id and s.product_icon is distinct from a.icon;
