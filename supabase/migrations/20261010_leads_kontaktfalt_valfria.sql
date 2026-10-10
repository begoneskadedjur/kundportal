-- Leads etapp 3: ett tips kan sakna kontaktperson, telefon eller e-post.
-- Ny lead kräver bara företag/namn och telefon ELLER e-post (kontrolleras i klienten).
alter table public.leads alter column contact_person drop not null;
alter table public.leads alter column phone_number drop not null;
alter table public.leads alter column email drop not null;
