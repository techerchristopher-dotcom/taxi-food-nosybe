---
format: 1080x1920
duration: 20s
message: "Ton resto est fermé ? Commande quand même : choisis ton heure, le resto reçoit ta commande à son ouverture."
arc: Marque → Problème (resto fermé) → Retournement (commande quand même) → Comment (choisis l'heure) → Preuve (la frise 10h→16h→19h) → Promesse (livré à l'heure) → Notification vivante → Appel
audience: clients Taxi Food à Nosy Be
mode: collaborative
---

## Frame 1: Logo (0-1.5s)

- act: Ouverture
- status: built
- src: compositions/frames/01-logo.html
- duration: 1.5s
- poster: 1.1s
- transition_in: cut
- scene: Le carré rouge Taxi Food se déplie en logotype, le scooter entre en glissant, filet or dessous
- motion: card-morph-anchor + motion-blur-streak + spring-pop-entrance
- sound: whoosh court + « pop » au dépli

Ouverture de marque, comme le carré « Uber » de la référence.

## Frame 2: Le resto est fermé (1.5-3.5s)

- act: Problème
- status: built
- src: compositions/frames/02-ferme.html
- duration: 2s
- poster: 1.4s
- transition_in: zoom-blur
- scene: Horloge 10:00, la carte de La Cabane se construit, le badge « Fermé · Ouvre à 16h » claque
- motion: viewport-change (push-in caméra) + spring-pop-entrance (badge) + svg-icon-enrichment (aiguilles)
- sound: tic-tac, « thud » du badge

## Frame 3: Commande quand même (3.5-5s)

- act: Retournement
- status: built
- src: compositions/frames/03-quand-meme.html
- duration: 1.5s
- poster: 1.3s
- transition_in: cut
- scene: Mots plein cadre RESTO / FERMÉ ? / COMMANDE / QUAND MÊME. alternés crème / encre / rouge
- motion: kinetic-beat-slam
- sound: frappe sur chaque mot, sur le temps

## Frame 4: Choisis ton heure (5-8.5s)

- act: Comment
- status: built
- src: compositions/frames/04-heure.html
- duration: 3.5s
- poster: 3s
- transition_in: whip-up
- scene: Le panneau « Quand veux-tu être livré ? » monte, le cadre de sélection glisse jusqu'à 19:00, le bouton se remplit
- motion: anchored-layout-expand (panneau) + control-target-sync (cadre de sélection) + press-release-spring (bouton)
- sound: glissé du panneau, clics sur les heures, « confirm » au bouton

## Frame 5: CHOISIS TON HEURE (8.5-10s)

- act: Comment
- status: built
- src: compositions/frames/05-choisis.html
- duration: 1.5s
- poster: 1.3s
- transition_in: cut
- scene: CHOISIS / TON / HEURE. plein cadre sur crème
- motion: kinetic-beat-slam
- sound: frappes sur le temps

## Frame 6: La frise (10-14s)

- act: Preuve
- status: built
- src: compositions/frames/06-frise.html
- duration: 4s
- poster: 3.4s
- transition_in: zoom-blur
- scene: 10h commandé → 16h La Cabane ouvre (bulle « a reçu ta commande ») → 19h livré ; le scooter roule sur la ligne or
- motion: svg-path-draw (ligne) + stat-bars-and-fills (progression) + spring-pop-entrance (bulle, jalons)
- sound: tic à chaque jalon, « ding » de la bulle, moteur léger du scooter

## Frame 7: LIVRÉ À L'HEURE (14-15.5s)

- act: Promesse
- status: built
- src: compositions/frames/07-livre.html
- duration: 1.5s
- poster: 1.3s
- transition_in: cut
- scene: LIVRÉ / À L'HEURE. plein cadre sur encre
- motion: kinetic-beat-slam
- sound: frappes sur le temps

## Frame 8: La notification (15.5-18s)

- act: Notification vivante
- status: built
- src: compositions/frames/08-notif.html
- duration: 2.5s
- poster: 2.1s
- transition_in: zoom-blur
- scene: iPhone, la notification s'ouvre en direct : « Livraison prévue à 19h00 · La Cabane prépare ta commande »
- motion: anchored-layout-expand (îlot qui s'ouvre) + stat-bars-and-fills (progression)
- sound: « ding » de notification

## Frame 9: Fin (18-20s)

- act: Appel
- status: built
- src: compositions/frames/09-fin.html
- duration: 2s
- poster: 1.6s
- transition_in: crossfade
- scene: Logo, « Commande à l'avance, le jour même. », badges des magasins, adresse
- motion: waterfall-entry + ambient-glow-bloom
- sound: accord final de la musique
