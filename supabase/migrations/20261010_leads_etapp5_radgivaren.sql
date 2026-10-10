-- Leads etapp 5, rådgivaren (2026-10-10): lead_far_se_arende anropas bara inifrån
-- lead_arende_underlag, lead_fran_arende och lead_anteckning_fran_arende och behöver inte vara en RPC.
-- Övriga varningar (authenticated_security_definer_function_executable) gäller avsiktliga RPC:er
-- som själva kontrollerar behörigheten, samma mönster som lead_dela och is_web_inquiry_staff.
revoke execute on function public.lead_far_se_arende(text, uuid) from public, anon, authenticated;
