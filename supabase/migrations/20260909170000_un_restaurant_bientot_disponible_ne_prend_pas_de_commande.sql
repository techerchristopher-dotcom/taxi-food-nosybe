-- Un restaurant « bientot disponible » ne prend pas de commande.
--
-- La garde posee le 2026-09-07 testait `ouvert_maintenant`, qui ne regarde que
-- `auto_open`, `is_open` et les horaires — jamais `listing_status`. Les Siciliens
-- et Taxi Be, en `coming_soon`, avaient donc `ouvert_maintenant` = true : l'app
-- affichait « bientot disponible » et la commande passait quand meme, avec le
-- message Telegram au restaurant. Verifie en base le 2026-09-09.
--
-- On separe les deux questions, qui n'ont jamais ete la meme :
--   ouvert_maintenant     — le restaurant sert-il a cette heure-ci ?
--   commandable_maintenant — a-t-on le droit de lui envoyer une commande ?
-- `ouvert_maintenant` reste inchange : l'ecran du restaurateur s'en sert pour
-- afficher « ouvert / ferme en ce moment », et un `coming_soon` qui se verrait
-- « ferme » pousserait son gerant a chercher un interrupteur inexistant.
--
-- Le motif leve reste `service:restaurant_ferme`, deja compris par les versions
-- installees sur les magasins. Un motif inedit leur afficherait « la commande
-- n'a pas pu etre creee », qui ne dit rien a personne.

create or replace function public.commandable_maintenant(r public.restaurants)
returns boolean
language sql
stable
as $cm$
  select r.listing_status = 'visible' and public.ouvert_maintenant(r);
$cm$;

-- La garde est UNE ligne au milieu de deux cents. On la remplace par programme
-- plutot que de recopier la fonction entiere : une faute de recopie dans le
-- calcul des totaux ou des options couterait bien plus cher que l'opacite de ce
-- bloc. Le remplacement est idempotent, et s'interrompt s'il ne reconnait rien.
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
    'if not public.ouvert_maintenant(v_resto) then',
    'if not public.commandable_maintenant(v_resto) then');

  -- Le commentaire d'origine affirmait que l'ecran grisait le bouton. C'est
  -- faux : `isOpen` n'a jamais servi qu'a peindre un badge, aucun bouton du
  -- parcours de commande n'y est conditionne (verifie le 2026-09-09).
  v_new := replace(v_new,
    'L''ecran grisait le bouton — l''ecran n''est pas',
    'L''ecran ne grisait rien, contrairement a ce qui etait ecrit ici — il n''est pas');

  if v_new not like '%not public.commandable_maintenant(v_resto)%' then
    raise exception 'garde d''ouverture introuvable — migration abandonnee';
  end if;

  execute v_new;
end
$mig$;
