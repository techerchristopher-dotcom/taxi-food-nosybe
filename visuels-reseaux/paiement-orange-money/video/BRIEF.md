---
workflow: general-video
flow: automation
storyboard: yes
message: "Plus besoin de monnaie : paie avec Orange Money, directement dans l'appli Taxi Food. Sans frais."
destination: tiktok-reels
aspect: 1080x1920
language: fr
length: 28s
audience: clients Taxi Food à Nosy Be (Réunionnais, expatriés, Malgaches), sur Facebook / TikTok / Reels
---

## Intent

Annoncer le paiement Orange Money DANS l'app Taxi Food (API Orange Money WebPay, testé le 17/10/2026 en
prePROD ; à publier une fois la production ouverte). Deuxième film de la série, même chaîne que
« commande pour plus tard » (`../../commande-programmee/video`) : interface REDESSINÉE et animée — jamais de
capture d'écran —, caméra rapide avec flou, mots plein cadre entre les séquences, fin sur l'appel.

Ce qui change par rapport au premier film (demande du porteur du projet : « innover, on ne parle pas de la
même chose ») :
- une couleur d'action en plus, l'orange Orange Money #FF7900, à côté du rouge Taxi Food ;
- l'accroche est un problème vécu à Nosy Be : le livreur n'a pas la monnaie ;
- le geste montré est le #144# (code de paiement), que tout le monde connaît déjà ;
- une scène sur fond orange (les mots « PAYÉ. RIEN À SORTIR. »).

v4 (18/10) — passe avec les skills de domaine (hyperframes-animation, -registry, -core) : vrais raccords simultanés
(clips chevauchés de 0,3 s, fond de scène porté par `.cam`), fouetté latéral en transition principale avec flou
directionnel plafonné à 16 px et couture or (whip-pan-cut), fouetté vertical pour les mots, zoom traversant au
climax, fondu flou en sortie ; confettis balistiques déterministes (particle-burst) ; traînée fantôme sur le
scooter (motion-blur-streak) ; rotation d'arrivée de la coche (success-check). Composants du registre installés
dans `compositions/components/` pour référence ; aucun bloc hébergé (tout reste dans gen.py / motion.py).

## Assets

- assets/maki-desole.png, maki-scooter.png, maki-livre.png — Maki, la mascotte livreur (élément Higgsfield
  `Maki-livreur` + `taxifood-scooter-sr`, nano_banana_pro, détourés par remove_background, 17/10). v3 : « le livreur
  illustré » demandé par le porteur du projet ; Maki est le livreur illustré déjà validé de la marque.
- assets/om-logo.png — logo officiel « payer avec Orange Money » fourni par Orange (utilisation validée
  par le porteur du projet le 17/10).
- assets/taxifood-transparent.png — icône Taxi Food (scooter).
- assets/c2.png — tacos de La Cabane (packshot réel, plat commandable).
- assets/logo-cabane.jpg — logo de La Cabane.
- assets/appstore.png, assets/googleplay.png — badges des magasins.
- assets/audio/* — même musique (HeyGen bgm_001, 135 BPM) et mêmes effets que le premier film.

## Notes

- Charte : crème #F6EFE2, rouge #E8342A, or #FFC72C, encre #18130F, orange OM #FF7900 ; police Archivo.
- Seules images générées : les trois poses de Maki, depuis l'élément validé (aucun texte ni logo dessiné par l'IA ;
  le logo du top-case vient de l'élément `taxifood-topcase`). Le billet de 50 000 Ar est un rectangle stylisé (aucune reproduction de billet).
- « Sans frais » : validé par le porteur du projet le 17/10.
- Exemple chiffré : commande La Cabane de 43 000 Ar ; le client n'a qu'un billet de 50 000.
- Trame validée par le porteur du projet le 17/10 (9 séquences). v2 du 17/10 : « trop rapide » → 28 s, tout ralenti.
