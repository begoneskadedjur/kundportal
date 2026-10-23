-- 2026-10-23: interna kommentarer stängda för kunder och multisite-användare.
--
-- Före: case_comments "Users can view all comments" (using true),
-- comment_read_receipts "Alla kan se läsbekräftelser" (using true, roll public)
-- och bucketen comment-attachments "Anyone can view attachments" släppte alla
-- inloggade, även de 17 kundkontona (vanliga kunder och multisite), till alla
-- interna trådar, läskvitton och bilagor. Kunder kunde dessutom skriva
-- kommentarer, svara, sätta status via set_case_comment_status och ladda upp
-- bilagor.
--
-- Kartläggning: ingen kod i kundportalen eller multisite-portalen läser eller
-- skriver case_comments, comment_read_receipts eller bucketen. Inga
-- kommentarer har någonsin skrivits av ett kundkonto. Tabellen saknar fält
-- för kundsynlighet (is_internal e.d.), allt i den är internt.
-- min_kundresa och övriga SECURITY DEFINER-funktioner påverkas inte.
--
-- Nu: läsa och skriva kräver ett internt konto, profiles.role admin,
-- koordinator, technician eller säljare. Personalens läsning är oförändrad
-- (allt). Tekniker snävas INTE i det här steget: teknikerns dokumentvy
-- (DokumentDetalj, useCaseComments på avtalsärenden), Frågor och uppdrag
-- (analyzeMentionQuestions läser alla kommentarer i ärendet för att avgöra om
-- en fråga är besvarad) och @alla/gruppnämningar kräver bred läsning, och
-- sidan Frågor och uppdrag byggs om samtidigt.
--
-- Inga borttagningar: befintliga policyer snävas med ALTER POLICY.

create or replace function public.is_internal_user()
returns boolean
language sql
stable
security definer
set search_path to ''
as $fn$
  select coalesce((
    select p.role::text in ('admin', 'koordinator', 'technician', 'säljare')
      from public.profiles p
     where p.user_id = (select auth.uid())
     limit 1
  ), false);
$fn$;

revoke all on function public.is_internal_user() from public, anon;
grant execute on function public.is_internal_user() to authenticated, service_role;

-- ─── case_comments ─────────────────────────────────────────────────────────

alter policy "Users can view all comments" on public.case_comments
  to authenticated
  using ((select public.is_internal_user()));

alter policy "Users can create comments" on public.case_comments
  to authenticated
  with check ((select auth.uid()) = author_id and (select public.is_internal_user()));

alter policy "Users can update own comments" on public.case_comments
  to authenticated
  using ((select auth.uid()) = author_id and (select public.is_internal_user()));

alter policy "Users can delete own comments or admins can delete any" on public.case_comments
  to authenticated
  using ((select public.is_internal_user()) and (
    (select auth.uid()) = author_id
    or exists (select 1 from public.profiles
                where profiles.id = (select auth.uid()) and profiles.role::text = 'admin')));

-- ─── comment_read_receipts ─────────────────────────────────────────────────

alter policy "Alla kan se läsbekräftelser" on public.comment_read_receipts
  to authenticated
  using ((select public.is_internal_user()));

alter policy "Användare kan skapa egna läsbekräftelser" on public.comment_read_receipts
  to authenticated
  with check ((select public.is_internal_user()) and (
    user_id = (select auth.uid())
    or user_id in (select profiles.id from public.profiles where profiles.user_id = (select auth.uid()))));

alter policy "Användare kan uppdatera egna läsbekräftelser" on public.comment_read_receipts
  to authenticated
  using ((select public.is_internal_user()) and (
    user_id = (select auth.uid())
    or user_id in (select profiles.id from public.profiles where profiles.user_id = (select auth.uid()))))
  with check ((select public.is_internal_user()) and (
    user_id = (select auth.uid())
    or user_id in (select profiles.id from public.profiles where profiles.user_id = (select auth.uid()))));

alter policy "Användare kan ta bort egna läsbekräftelser" on public.comment_read_receipts
  to authenticated
  using ((select public.is_internal_user()) and (
    user_id = (select auth.uid())
    or user_id in (select profiles.id from public.profiles where profiles.user_id = (select auth.uid()))));

-- ─── storage: comment-attachments ──────────────────────────────────────────
-- Bucketen är publik: den som har en fils URL kan fortfarande hämta den
-- (URL:erna ligger i case_comments.attachments, som kunder nu inte kan läsa,
-- och sökvägen har en slumpdel). Policyn stänger listning och API-nedladdning.

alter policy "Anyone can view attachments" on storage.objects
  to authenticated
  using (bucket_id = 'comment-attachments' and (select public.is_internal_user()));

alter policy "Authenticated users can upload attachments" on storage.objects
  to authenticated
  with check (bucket_id = 'comment-attachments' and (select public.is_internal_user()));
