-- Canal Telegram par restaurant.
--
-- Troisieme canal de notification, a cote de la push et de l'e-mail. Le
-- restaurateur n'a pas besoin de compte dans l'app pour le recevoir : il lui
-- suffit d'ouvrir Telegram et de demarrer une conversation avec le robot. C'est
-- ce qui en fait le canal le plus simple a mettre en service sur le terrain, et
-- le seul qui fonctionne meme si personne n'a installe l'application.
--
-- `telegram_chat_id` est un identifiant NUMERIQUE fourni par Telegram, pas un
-- @pseudo : un pseudo peut changer, l'identifiant non. On le stocke en texte
-- car il peut etre negatif et depasser l'entier 32 bits (les groupes ont des
-- identifiants tres grands).
--
-- ⚠️ Lisible uniquement par les administrateurs et le personnel du restaurant
-- concerne : c'est une adresse de contact, elle n'a rien a faire dans la
-- reponse publique de l'accueil.
alter table public.restaurants
  add column if not exists telegram_chat_id text;

comment on column public.restaurants.telegram_chat_id is
  'Identifiant numerique du canal Telegram ou notifier ce restaurant. Null = canal non configure.';

create or replace function public.set_restaurant_telegram(p_restaurant_id uuid, p_chat_id text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Reserve aux administrateurs'; end if;
  update public.restaurants
     set telegram_chat_id = nullif(btrim(coalesce(p_chat_id, '')), '')
   where id = p_restaurant_id;
end $$;

revoke execute on function public.set_restaurant_telegram(uuid, text) from public, anon;
grant  execute on function public.set_restaurant_telegram(uuid, text) to authenticated;
