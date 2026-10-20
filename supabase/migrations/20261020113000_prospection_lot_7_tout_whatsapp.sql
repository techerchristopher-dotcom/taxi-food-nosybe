-- Lot 7 (20/10, 11 h 30) : « avance au max, on épuise tous ceux ayant un numéro WhatsApp ».
-- Toutes les fiches encore en étape whatsapp_1 et non validées, sauf : discothèques, noms dans une
-- autre langue que le français, L'Oasis (peut-être fermé), Baobab & Basilic (numéro d'Oh Hazar, en
-- négociation), et tout numéro déjà contacté dans la prospection hébergements. Appliqué : 121 fiches.
with cand as (
  select s.id, s.slug, s.numero_wa, s.type_etablissement
    from public.prospects_restaurant_sequence s join public.prospects_restaurant p on p.id = s.id
   where s.etape = 'whatsapp_1' and p.whatsapp_valide_le is null),
exclus as (
  select c.id from cand c
   where c.type_etablissement = 'discotheque'
      or c.slug in ('dagli-amici','polska-restauracja-nosy-be-loock-ness','mamma-mia','il-palazzetto','alta-marea-restaurant',
                    'a-casa-di-giorgia-lodge-nosy-be-andilana','ismael-escursioni','pily-pily-ristorante','la-dolce-vita',
                    'amodomio-nosy-be','danae-barea-restaurant-pizza-cabaret','coin-sauvage','l-oasis',
                    'restaurant-mediterraneen-baobab-basilic')
      or exists (select 1 from public.prospects_hebergement h
                  where h.statut in ('contacte','partenaire','refuse','exclu')
                    and c.numero_wa in (public.numero_whatsapp(h.telephone), public.numero_whatsapp(h.telephone_2),
                                        regexp_replace(coalesce(h.whatsapp,''),'\D','','g'))))
update public.prospects_restaurant p set whatsapp_valide_le = now(), whatsapp_lot = 7
  from cand c where p.id = c.id and c.id not in (select id from exclus);
