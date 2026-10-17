# Légende — « Ton resto est fermé ? Commande quand même. » (lundi 19/10/2026)

Visuel : `PUB-commande-programmee.png` (1080 × 1350, rendu en 2160 × 2700).
Rendu : `sh rendre_programmee.sh` (Chrome du Mac, contrôles mesurés : débord 0, police Archivo).

Fonction en ligne depuis le 17/10 ; annonce le lundi 19/10 : notification + e-mail à 10 h
(programmés en base, migration `20261017100000`), publication Facebook le même jour.

## Publication Page Facebook

Ton resto est fermé ? Commande quand même. ⏰

Nouveau dans l'appli Taxi Food : tu peux commander à l'avance, pour le jour même.
Il est 10 h, La Cabane ouvre à 16 h ? Tu passes ta commande maintenant, tu choisis ton heure de livraison (19 h par exemple), et le resto la reçoit dès son ouverture.

Comment ça marche : tu remplis ton panier comme d'habitude, et au moment de payer, l'appli te demande « Quand veux-tu être livré ? ».
Tu peux annuler tant que le resto n'a pas accepté.

Dans tous les restos de l'appli. Livraison dès 2 000 Ar.

https://taxifoodnosybe.distripro207.com/

#NosyBe #Madagascar #Livraison #TaxiFood

## Version courte (groupes)

Nouveau sur Taxi Food : commande à l'avance pour le jour même ⏰ Ton resto est encore fermé ? Tu commandes maintenant, tu choisis ton heure de livraison, le resto la reçoit dès son ouverture. Livraison dès 2 000 Ar.
👉 https://taxifoodnosybe.distripro207.com/jour

## Notification + e-mail (programmés, lundi 10 h)

- Titre : ⏰ Ton resto est fermé ? Commande quand même
- Texte : Nouveau : commande dès maintenant et choisis ton heure de livraison pour aujourd'hui. Le resto reçoit ta commande à son ouverture 👉
- Ouvre : l'accueil de l'appli. Annuler avant 10 h : `select cron.unschedule('annonce_plus_tard_envoi');`

## Reel vidéo (lundi 19/10, 18 h)

Vidéo : `VIDEO-FINALE/taxi-food-commande-plus-tard-9x16.mp4` (1080 × 1920, 20 s, motion design HyperFrames,
sources dans `video/`, re-rendu : `cd video && npx hyperframes render -q delivery`).

Calendrier Rentanoo (marque Taxi Food) : ligne `21df0019-a093-46da-a3d0-d89ddce5497f`, pilier `reel_video`
(créneau 18:00 créé pour l'occasion), brouillon Facebook `569` ; vidéo et couverture dans le bucket
`social-media/editorial/videos/taxifood-2026-10-19-commande-plus-tard*`. Tâche pg_cron à usage unique
`reel_taxifood_commande_plus_tard` (15:00 UTC le 19/10) ; à défaut, le publieur vidéo de 19 h 05 prend le relais.

Ton resto est fermé ? Commande quand même ⏰

Tu choisis ton heure de livraison pour aujourd'hui, le resto reçoit ta commande dès son ouverture. Livraison dès 2 000 Ar.

👉 https://taxifoodnosybe.distripro207.com/

#NosyBe #Madagascar #TaxiFood
