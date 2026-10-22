-- Manson 2.0 : groupe Telegram « Taxi Food - Manson » (créé le 2026-10-22, groupe simple, robot membre).
-- Message de test du robot remis (message_id 272).
do $$
declare v_n int;
begin
  update public.restaurants set telegram_chat_id = '-5518041106'
  where id = 'f418e6c3-4dfa-4494-8a47-d744cdf0ac02';
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'Manson attendu 1, trouve %', v_n; end if;
end $$;
