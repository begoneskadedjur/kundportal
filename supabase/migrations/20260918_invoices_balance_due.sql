-- Kvar att betala (inkl. moms) enligt Fortnox. null = okänt (fakturan inte läst från Fortnox).
-- Delbetalda fakturor visades som förfallna på hela beloppet; nu kan fliken visa resten.
alter table public.invoices add column if not exists balance_due numeric(12,2);
comment on column public.invoices.balance_due is 'Kvar att betala inkl. moms enligt Fortnox (Balance). null = okänt. 0 = fullt betald.';
