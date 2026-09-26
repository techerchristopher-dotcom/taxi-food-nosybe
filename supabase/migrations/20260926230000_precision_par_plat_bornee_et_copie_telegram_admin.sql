-- Chantier « précision par plat » (26/09/2026) — le client peut dire « sans tomate ».
--
-- 1) `order_items.comment` existait déjà et `create_order` l'écrit tel quel
--    (`v_item->>'comment'`). On ne touche PAS à `create_order` (deux surcharges,
--    piège PGRST203 du 2026-09-05) : on borne la valeur par un trigger sur la
--    table, ce qui vaut pour tous les chemins d'écriture.
create or replace function public.order_items_normaliser_comment()
returns trigger
language plpgsql
as $$
begin
  new.comment := nullif(left(btrim(coalesce(new.comment, '')), 140), '');
  return new;
end;
$$;

drop trigger if exists order_items_normaliser_comment on public.order_items;
create trigger order_items_normaliser_comment
  before insert or update of comment on public.order_items
  for each row execute function public.order_items_normaliser_comment();

-- 2) La copie Telegram de l'ADMIN (envoyée par la base elle-même, pas par n8n)
--    n'imprimait ni les options ni le commentaire — le restaurant, lui, les a
--    déjà via n8n (« ✎ … », vérifié sur le jsCode en production le 26/09). On
--    patche la seule ligne concernée SANS retaper la fonction : on relit sa
--    définition, on remplace l'ancre, on la ré-exécute. Si l'ancre a bougé, on
--    s'arrête net plutôt que de casser les notifications.
do $$
declare
  v_def   text;
  v_ancre constant text :=
    $a$string_agg('- ' || (a->>'quantite') || ' x ' || (a->>'nom'), chr(10))$a$;
  v_neuf  constant text :=
    $b$string_agg('- ' || (a->>'quantite') || ' x ' || (a->>'nom')
                         || coalesce((select chr(10) || '   > ' || string_agg(o->>'nom', ', ')
                                        from jsonb_array_elements(a->'options') o), '')
                         || coalesce(chr(10) || '   ✎ ' || nullif(btrim(a->>'commentaire'), ''), ''),
                       chr(10))$b$;
begin
  select pg_get_functiondef(p.oid) into v_def
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'notify_order_status';
  if v_def is null then
    raise exception 'notify_order_status introuvable';
  end if;
  if position(v_ancre in v_def) = 0 then
    raise exception 'ancre Telegram admin introuvable dans notify_order_status : rien modifie';
  end if;
  v_def := replace(v_def, v_ancre, v_neuf);
  execute v_def;
end $$;
