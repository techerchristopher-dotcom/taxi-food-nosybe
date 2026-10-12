-- now() est l'heure de DÉBUT de transaction : deux messages écrits dans la même transaction
-- (ou une écriture et la mise à jour de « lu jusqu'à ») partagent la même heure, et un message
-- d'un autre participant peut alors passer pour déjà lu. clock_timestamp() donne l'heure réelle.
alter table public.messages_commande alter column created_at set default clock_timestamp();
