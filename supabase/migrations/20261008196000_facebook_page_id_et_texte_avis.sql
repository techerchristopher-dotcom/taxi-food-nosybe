-- Publication des avis sur Facebook — mise en service (2026-10-08).
--
-- * Jeton de Page : copié depuis la base Rentanoo (cowork_secrets.meta_page_access_token_taxi_food,
--   valable jusqu'au 2027-01-03) vers le Vault Taxi Food (`facebook_page_token`) par un guichet à
--   usage unique (`recevoir_jeton_facebook`, clé jetable), SUPPRIMÉ aussitôt après. Le jeton n'a
--   transité ni par la conversation ni par le dépôt. Graph `/me` a confirmé : « Taxi Food Nosy Be ».
-- * `facebook_page_id` = 1350723891454039 (identifiant Graph de la Page). ⚠️ PAS 61594104278047,
--   qui est l'identifiant de l'adresse profile.php de la Page.
-- * Texte : le nom des plats entre guillemets (« Rougail saucisse »).
-- ⚠️ Le jeton Rentanoo meurt si le mot de passe Facebook du porteur du projet change : les deux
--   copies (Rentanoo et Taxi Food) sont alors à remplacer ensemble.
select vault.update_secret((select id from vault.secrets where name = 'facebook_page_id'), '1350723891454039', 'facebook_page_id');

create or replace function public.texte_publication_avis(p_avis_id uuid, p_product_id uuid)
returns text
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  a record; v_resto text; v_plats text[]; v_plat text; v_etoiles text; v_lien text;
begin
  select * into a from public.avis where id = p_avis_id;
  select name into v_resto from public.restaurants where id = a.restaurant_id;
  v_plats := public.plats_de_commande(a.order_id);
  v_plat := coalesce('« ' || array_to_string(v_plats, ' », « ') || ' »', 'son repas');
  v_etoiles := repeat('⭐', greatest(1, least(5, round(a.note_restaurant)::int)));
  v_lien := case when p_product_id is not null
                 then 'https://taxifoodnosybe.distripro207.com/p/' || p_product_id
                 else 'https://taxifoodnosybe.distripro207.com/r/' || a.restaurant_id end;
  return v_etoiles || ' ' || a.prenom_affiche || ' a commandé ' || v_plat || ' chez ' || v_resto || ', livré par Taxi Food.'
      || case when a.commentaire is not null then E'\n\n« ' || a.commentaire || ' »' else '' end
      || case when a.photo_url is not null then E'\n\n📸 La vraie photo du plat livré, prise par ' || a.prenom_affiche || '.' else '' end
      || E'\n\n👉 Commande-le à ton tour : ' || v_lien
      || E'\n\n#NosyBe #TaxiFood #LivraisonDeRepas';
end $$;
