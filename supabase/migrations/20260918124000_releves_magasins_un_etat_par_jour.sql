-- Le journal des releves : UN etat par jour, pas un par statut.
--
-- L'index unique partiel (magasin, jour, statut) where statut <> 'echec' ne
-- pouvait PAS servir a un `on conflict` de PostgREST : l'inference d'un index
-- partiel exige la meme clause WHERE, que PostgREST n'envoie pas. Resultat :
-- toutes les ecritures du journal echouaient en silence (la fonction ignorait
-- l'erreur), et le rattrapage repassait donc sur des journees deja relevees.
-- Constate le 2026-09-18 : 14 journees collectees, journal vide.
--
-- La fonction `collecter-telechargements` REMONTE desormais l'erreur d'ecriture
-- du journal dans sa reponse : le meme defaut ne peut plus passer inapercu.
drop index if exists public.releves_magasins_jour_idx;
create unique index if not exists releves_magasins_magasin_jour_idx
  on public.releves_magasins (magasin, jour);
