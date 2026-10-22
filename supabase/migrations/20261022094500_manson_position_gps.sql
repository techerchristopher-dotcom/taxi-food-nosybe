-- Manson 2.0 : position de l'épingle Google « MANSON 2.0 » (lien du porteur du projet, 2026-10-22).
do $$
declare v_n int;
begin
  update public.restaurants set latitude = -13.3984373, longitude = 48.2070724
  where id = 'f418e6c3-4dfa-4494-8a47-d744cdf0ac02';
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'Manson attendu 1, trouve %', v_n; end if;
  update public.prospects_restaurant set latitude = -13.3984373, longitude = 48.2070724
  where id = '2dff7c86-b882-47c4-a387-85524b6a6502';
end $$;
