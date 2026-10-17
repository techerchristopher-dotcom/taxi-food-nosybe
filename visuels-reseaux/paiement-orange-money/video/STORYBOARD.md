---
format: 1080x1920
duration: 20s
message: "Plus besoin de monnaie : paie avec Orange Money, directement dans l'appli. Sans frais."
arc: Marque → Problème (pas de monnaie) → Retournement (plus besoin) → Comment (choisis Orange Money) → Geste (#144#, le code) → Preuve (paiement confirmé) → Promesse (rien à sortir) → Livraison sans rien à payer → Appel
audience: clients Taxi Food à Nosy Be
mode: autonomous
---

Grille : 135 BPM, un temps = 0,444 s, 45 temps = 20 s ; chaque coupe sur un temps, la reprise de la
musique (temps 13) tombe sur l'écran de paiement.

## Frame 1: Logo (temps 0-3)
- src: compositions/frames/01-logo.html
- scene: le carré rouge Taxi Food se déplie, le scooter glisse, filet or (même ouverture que le premier film : la série se reconnaît)

## Frame 2: Pas de monnaie (temps 3-9)
- src: compositions/frames/02-monnaie.html
- scene: « Ton livreur est devant chez toi », À payer 43 000 Ar, le billet de 50 000 glisse, la bulle du livreur « Désolé… j'ai pas la monnaie sur 50 000 » claque, tout tremble
- sound: whoosh, pop du billet, impact de la bulle

## Frame 3: PLUS BESOIN DE MONNAIE. (temps 9-13)
- src: compositions/frames/03-plus-besoin.html
- scene: mots plein cadre sur encre, MONNAIE. en orange Orange Money
- sound: frappe sur chaque mot

## Frame 4: Choisis Orange Money (temps 13-21)
- src: compositions/frames/04-choix.html
- scene: récap La Cabane 43 000 Ar, feuille « Comment veux-tu payer ? », le cadre glisse d'Espèces à Orange Money (pastille Nouveau), la ligne devient orange, le bouton « Payer 43 000 Ar » se remplit, appui + onde
- sound: glissé, clics, confirm

## Frame 5: #144# (temps 21-27)
- src: compositions/frames/05-code.html
- scene: clavier redessiné, #144# se tape touche par touche, puis le code à 6 chiffres arrive case par case
- sound: clic par touche

## Frame 6: Paiement confirmé (temps 27-31)
- src: compositions/frames/06-confirme.html
- scene: la coche se trace dans un disque orange, éclats orange et or, « Paiement confirmé · La Cabane reçoit ta commande »
- sound: carillon

## Frame 7: PAYÉ. RIEN À SORTIR. (temps 31-34)
- src: compositions/frames/07-paye.html
- scene: mots plein cadre sur fond ORANGE (nouveauté de la série)
- sound: frappes

## Frame 8: Le livreur est là (temps 34-40)
- src: compositions/frames/08-livre.html
- scene: iPhone, l'îlot s'ouvre « Ton livreur est devant chez toi · Déjà payé · Orange Money », le tacos arrive, « Rien à sortir. Bon appétit ! »
- sound: carillon de notification

## Frame 9: Fin (temps 40-45)
- src: compositions/frames/09-fin.html
- scene: Taxi Food × Orange Money, « Paie avec Orange Money, directement dans l'appli. », pastille « Sans frais », badges, adresse
- sound: scintillement, pop final
