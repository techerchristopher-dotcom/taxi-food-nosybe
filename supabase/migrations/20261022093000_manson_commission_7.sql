-- Manson 2.0 : commission 7 % (décision du porteur du projet, 2026-10-22).
do $$
declare v_n int;
begin
  update public.restaurants set commission_rate = 0.07 where id = 'f418e6c3-4dfa-4494-8a47-d744cdf0ac02';
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'Manson attendu 1, trouve %', v_n; end if;
end $$;
