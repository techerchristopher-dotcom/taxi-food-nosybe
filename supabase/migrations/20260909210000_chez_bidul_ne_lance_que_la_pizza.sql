-- Chez Bidul & Truc ne lance que la pizza.
--
-- Le restaurant n'est pas pret sur le reste de sa carte : on ne garde que la
-- categorie Pizza (13 plats, servie 18 h - 22 h) et on coupe les six autres
-- (Entree, Plat, Pates, Tapas, Hamburger, Dessert — 48 plats au total).
--
-- ⚠️ Sa carte sera donc VIDE avant 18 h, puisque Pizza porte une plage horaire.
-- C'est assume : son four ne tourne pas avant. Le jour ou il ouvre le reste,
-- il suffit de repasser `is_active` a true sur les categories voulues.
--
-- Deux morceaux, et le premier compte autant que le second : `is_active`
-- n'etait respecte que par l'ECRAN (data/api.ts filtre les categories sur
-- `is_active`), jamais par `create_order`. Un lien partage vers un plat d'une
-- categorie coupee, ou un appel direct a l'API avec la cle anon — publique par
-- conception — passait encore. Meme lecon que la garde d'ouverture du meme
-- jour : l'ecran n'est pas l'autorite.

-- 1. La base fait respecter `is_active`.
--
-- Le verdict rendu est celui d'un plat indisponible, et non un motif inedit :
-- c'est exactement ce dont il s'agit du point de vue du client, et les versions
-- deja installees sur les magasins savent l'afficher. Un `service:` inconnu
-- leur donnerait « la commande n'a pas pu etre creee », qui ne dit rien.
--
-- Remplacement par programme plutot que recopie des deux cents lignes de
-- `create_order` : une faute de recopie dans le calcul des totaux couterait
-- bien plus cher que l'opacite de ce bloc. Idempotent, et s'interrompt s'il ne
-- reconnait rien.
do $mig$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'create_order'
    and pg_get_function_identity_arguments(p.oid) like '%p_code_promo%';

  if v_def is null then
    raise exception 'create_order (5 arguments) introuvable';
  end if;

  v_new := replace(v_def,
'    select * into v_categorie from public.categories where id = v_product.category_id;
    if v_categorie.id is not null and not public.categorie_servie_maintenant(v_categorie) then',
'    select * into v_categorie from public.categories where id = v_product.category_id;

    -- Categorie desactivee : le restaurant ne la sert pas encore. L''app la
    -- masque deja ; ceci ferme la porte de derriere (lien partage, appel direct).
    if v_categorie.id is not null and not v_categorie.is_active then
      raise exception ''Produit indisponible ou introuvable'';
    end if;

    if v_categorie.id is not null and not public.categorie_servie_maintenant(v_categorie) then');

  if v_new not like '%not v_categorie.is_active then%' then
    raise exception 'garde de categorie introuvable — migration abandonnee';
  end if;

  execute v_new;
end
$mig$;

-- 2. On coupe les six categories, en nommant Pizza plutot qu'en listant les
-- autres : si une nouvelle categorie apparait chez lui d'ici son ouverture
-- complete, elle sera coupee elle aussi, et non ouverte par oubli.
update public.categories
   set is_active = false
 where restaurant_id = '700e8f32-e966-476a-b371-02884d08dea1'
   and name <> 'Pizza'
   and is_active;

-- 3. Retirer de « l'offre du jour » les plats des categories coupees.
--
-- Ses deux plats mis en avant etaient un Œuf mimosa (Entree) et une Salade de
-- fruit (Dessert) : les deux categories qu'on vient de couper. Le carrousel
-- « Offre du jour » lit `products.is_featured` SANS regarder `is_active` de la
-- categorie (data/api.ts) — ils seraient donc restes affiches, ajoutables, et
-- refuses au dernier bouton. Exactement la mauvaise experience qu'on vient de
-- supprimer ailleurs.
--
-- ⚠️ Correctif de DONNEES, pas de structure : si un plat d'une categorie coupee
-- est remis en avant plus tard, le carrousel le reaffichera. Le vrai correctif
-- est de filtrer `featured` sur `is_active` cote app — a joindre a une
-- prochaine mise a jour.
update public.products p
   set is_featured = false
  from public.categories c
 where c.id = p.category_id
   and not c.is_active
   and p.is_featured;
