-- Prisbilagan i fyra steg (docs/upphandlingsportal-ux-plan.md, beslut 4 2026-10-15).
-- Rader som lästs in ur köparens prisbilaga minns vilket dokument, vilket blad
-- och vilken cell priset ska skrivas i, så att exporten kan fylla en kopia av
-- köparens egen fil. Bara additiva kolumner; befintliga rader påverkas inte.
-- Tabellen har redan insert/update för authenticated på tabellnivå
-- (20260924_upphandlingsportal.sql), så nya kolumner omfattas.

alter table public.procurement_price_lines
  add column if not exists source_document_id uuid references public.procurement_documents(id) on delete set null,
  add column if not exists source_sheet text,
  add column if not exists source_cell text,
  add column if not exists source_row integer;

comment on column public.procurement_price_lines.source_document_id is 'Köparens prisbilaga som raden lästes in ur';
comment on column public.procurement_price_lines.source_sheet is 'Bladets namn i köparens xlsx';
comment on column public.procurement_price_lines.source_cell is 'Cellen där vårt à-pris skrivs vid export, t.ex. E12';
comment on column public.procurement_price_lines.source_row is 'Radnummer i köparens blad eller ordning i PDF:en';

create index if not exists procurement_price_lines_source_doc_idx
  on public.procurement_price_lines (source_document_id)
  where source_document_id is not null;
