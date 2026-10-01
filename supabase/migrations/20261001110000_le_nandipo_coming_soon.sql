-- Le Nandipo passe de hidden a coming_soon (« En negociation » dans l'app), decision du
-- porteur du projet le 2026-10-01 : il veut le voir affiche comme Les Siciliens.
-- Toujours jamais commandable : commandable_maintenant() exige listing_status = 'visible'.
update public.restaurants set listing_status = 'coming_soon'
where id = 'cb7fda65-3ed0-41aa-940c-b8974f7363c8' and name = 'Le Nandipo';
update public.prospects_restaurant
set notes = replace(notes, 'hidden au catalogue', 'coming_soon au catalogue'), updated_at = now()
where id = 'd526a567-a5a0-452f-99ac-4fd03ff6254b';
