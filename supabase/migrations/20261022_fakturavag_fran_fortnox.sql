-- Fakturavägen från Fortnox-korten: läst 2026-10-22 från alla 958 aktiva
-- kundkort (GET /3/customers/{nr}, DefaultDeliveryTypes.Invoice). Alla 187
-- portalkunder med kundnummer fanns bland dem. Sätts där vägen saknas.
with fortnox(customer_number, method) as (
  select unnest(array[1,10,11,18,21,24,26,28,30,51,55,59,62,63,65,66,70,71,75,77,78,79,81,83,84,86,87,88,90,91,92,94,95,107,110,113,119,125,128,526,537,1511,1512,1514,1515,1546,1549,2000,2001,2005,2006,2008,2503,2504,2505,2508,2514,2520,2525,2528,2531,2532,2535,2543,2544,2546,2547,2548,2549,2556,2557,2559,2560,2565,2567,2572,2584,2587,3500,3502,3508,3511,3540,3541,3549,3551,3557,3560,3561,3567,3575,3576,3577,4000,4001,4002,4003,4004,4005,4006,4011,4012,6501,10009,10013,10018,10021,10040,10047,10051,10072,10078,10154,10350,10413,10421,10427,10437,10438,10460,10465,10496,10497,10498,10519,10521,10526,10527,10528,10529]), 'email'
  union all
  select unnest(array[89,111]), 'print'
  union all
  select unnest(array[2,8,15,20,23,74,80,82,93,105,106,115,129,502,503,505,509,513,514,515,528,1000,1501,1506,1540,1552,2007,2502,2510,2511,2512,2515,2516,2522,2526,2537,2539,2577,2578,2583,2585,2586,3513,3558,3563,5003,5004,5005,5006,5007,5608,6001,6002,6503,6506]), 'einvoice'
)
update public.customers c
set invoice_delivery_method = f.method,
    invoice_delivery_source = 'fortnox',
    invoice_delivery_confirmed_at = now(),
    invoice_delivery_confirmed_by_name = 'Fortnox-kortet 2026-10-22'
from fortnox f
where c.customer_number = f.customer_number
  and (c.invoice_delivery_method is null or c.invoice_delivery_source in ('upplaggning', 'fortnox'));
