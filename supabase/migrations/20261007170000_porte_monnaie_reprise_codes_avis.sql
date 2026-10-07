-- Reprise de l'existant (décision du porteur du projet, 2026-10-07).
--
-- Les codes AVIS<PRENOM> encore actifs, non expirés et JAMAIS utilisés sont convertis en
-- crédit de porte-monnaie à LEUR valeur promise (2 000 Ar chacun), puis désactivés, avec
-- la trace du motif (colonne `note` du mouvement + description du code). Les codes déjà
-- utilisés restent tels quels. Au 2026-10-07 : AVISOPALINE, AVISOPALINE2 (Opaline) et
-- AVISSULLI2 (Sulli) — 6 000 Ar au total.
--
-- Rejouable sans effet : l'index unique `porte_monnaie_une_reprise_par_code` et le filtre
-- `actif` empêchent toute double conversion.

with a_convertir as (
  select pc.id, pc.code, pc.valeur, pc.beneficiaire_id
    from public.promo_codes pc
   where pc.code_normalise like 'AVIS%'
     and pc.description = 'Merci pour votre avis'
     and pc.beneficiaire_id is not null
     and pc.actif
     and (pc.expire_le is null or pc.expire_le > now())
     and pc.porte_sur = 'livraison'
     and pc.type_remise = 'montant'
     and not exists (select 1 from public.promo_redemptions r where r.code_id = pc.id)
     and exists (select 1 from auth.users u where u.id = pc.beneficiaire_id)
),
credits as (
  insert into public.porte_monnaie_mouvements (user_id, montant, motif, code_promo_id, note)
  select beneficiaire_id, valeur, 'reprise_code_avis', id,
         'Code ' || code || ' non utilisé converti en porte-monnaie (2026-10-07)'
    from a_convertir
  on conflict do nothing
  returning code_promo_id
)
update public.promo_codes pc
   set actif = false,
       description = pc.description || ' — converti en porte-monnaie le 2026-10-07'
  from credits c
 where pc.id = c.code_promo_id;
