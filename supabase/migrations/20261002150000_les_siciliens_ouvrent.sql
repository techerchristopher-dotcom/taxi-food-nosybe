-- Les Siciliens ouvrent (décision du porteur du projet, 2026-10-02 : « ils ne sont plus en
-- négociation »). Horaires donnés par lui : lundi au samedi 9h30–13h50 et 18h00–20h50,
-- dimanche fermé. Position : fiche Google Maps « Les siciliens » (lien maps.app.goo.gl
-- 19VhQEu8dUEphE4j9). Téléphone : celui de la fiche prospect, faute d'autre source.
-- weekday suit extract(dow) : 0 = dimanche (voir ouvert_maintenant()).
-- ⚠️ auto_open ne passe à true qu'APRÈS l'insertion des 7 jours (sinon fermé en permanence).

delete from public.restaurant_hours where restaurant_id = 'aee1c612-5ee0-402b-a7b4-aec9c6825b0b';

insert into public.restaurant_hours (restaurant_id, weekday, service, opens_at, closes_at, is_closed)
select 'aee1c612-5ee0-402b-a7b4-aec9c6825b0b', d, s,
       case when d = 0 then null when s = 1 then time '09:30' else time '18:00' end,
       case when d = 0 then null when s = 1 then time '13:50' else time '20:50' end,
       d = 0
from generate_series(0, 6) d, generate_series(1, 2) s;

update public.restaurants set
  latitude = -13.4048975, longitude = 48.2732053,
  phone = coalesce(phone, '+261348610294'),
  auto_open = true,
  listing_status = 'visible'
where id = 'aee1c612-5ee0-402b-a7b4-aec9c6825b0b';

update public.prospects_restaurant set
  statut = 'partenaire',
  latitude = -13.4048975, longitude = 48.2732053,
  notes = 'partenaire depuis le 2026-10-02 (visible au catalogue). Communication en italien.',
  updated_at = now()
where id = '27cb7607-deae-44ec-889b-3315ab037c13';
