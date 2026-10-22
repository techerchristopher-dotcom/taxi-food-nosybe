-- Manson 2.0 : hidden → coming_soon (« En négociation », visible, jamais commandable).
-- Demande du porteur du projet, 2026-10-22.
do $$
declare v_n int;
begin
  update public.restaurants set listing_status = 'coming_soon'
  where id = 'f418e6c3-4dfa-4494-8a47-d744cdf0ac02' and listing_status = 'hidden';
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'Manson hidden attendu 1, trouve %', v_n; end if;
end $$;
