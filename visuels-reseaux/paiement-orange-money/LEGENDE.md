# Légende — « Plus besoin de monnaie. Paie avec Orange Money. »

✅ **Vidéo v5 VALIDÉE par le porteur du projet le 18/10/2026 — c'est la version à publier** :
`VIDEO-FINALE/taxi-food-orange-money-9x16-v5.mp4` (31 s, voix off « Chloé » choisie parmi trois, 3D réelle, Maki).
Visuel fixe validé le 17/10. Ne plus retoucher sans sa demande. La v4 (28 s, sans voix, validée le 18/10 au matin)
reste dans `VIDEO-FINALE/` et se régénère par `video/gen.py` ; elle n'est plus la version de référence.

⛔ **À NE PAS PROGRAMMER avant l'ouverture officielle** : production Orange Money (compte marchand
Rentanoo, invitation « WebPay Madagascar »), clés de production au Vault, `om_environnement = 'mg'` et
`om_en_ligne_active = true`. Au 17/10/2026, le paiement tourne en bac à sable seulement.

- Visuel : `PUB-orange-money.png` (1080 × 1350, rendu en 2160 × 2700). Rendu : `sh rendre_orange_money.sh`
  (Chrome du Mac, contrôles mesurés : débord 0, police Archivo).
- 🆕 Visuel **3D** (18/10, demandé par le porteur du projet, **en attente de validation**) :
  `PUB-orange-money-3d.png`. Même HTML que le visuel validé, transformé par `pub_orange_money_3d.py` (le plat
  ressort à l'octet près) : étapes en objets Three.js comme dans la vidéo v5 (tuile au vrai logo Orange Money,
  tuile « #144# », pièce et coche), titres en volume, plats en tambour. Rendu : `sh rendre_orange_money_3d.sh`
  (Chrome du Mac avec `--allow-file-access-from-files`, sinon le logo ne passe pas en texture). Contrôles :
  objets 3D 3/3 visibles, air objet → libellé 16 px, marges des plats 76 px, mise en page identique au plat.
- Vidéo (v5) : `VIDEO-FINALE/taxi-food-orange-money-9x16-v5.mp4` (1080 × 1920, 31 s, -16,5 LUFS, motion design
  HyperFrames + Three.js, voix HeyGen « Chloé »). Re-rendu : `cd video && VOIX=chloe sh construire5.sh && npx --yes
  hyperframes@0.8.167 render -q delivery -o ../VIDEO-FINALE/taxi-food-orange-money-9x16-v5.mp4`.
- Vidéo (v4, sans voix) : `VIDEO-FINALE/taxi-food-orange-money-9x16.mp4` (28 s) ; re-rendu : `cd video && python3
  gen.py && npx --yes hyperframes@0.8.167 render -q delivery -o ../VIDEO-FINALE/taxi-food-orange-money-9x16.mp4`.
- v3 (17/10) : Maki, la mascotte livreur, dans l'ouverture (scooter), la scène « pas la monnaie » et la livraison ;
  et sur le visuel fixe (colonne droite). Poses : `video/assets/maki-*.png` (aussi dans `src/`).
- Logo officiel Orange Money (fourni par Orange) : utilisation validée par le porteur du projet le 17/10.
- « Sans frais » : validé par le porteur du projet le 17/10.

## Publication Page Facebook

Plus besoin de monnaie. Paie avec Orange Money. 🧡

Nouveau dans l'appli Taxi Food : tu peux payer ta commande avec Orange Money, directement dans l'appli.
Fini le livreur qui n'a pas la monnaie sur ton billet de 50 000 !

Comment ça marche :
1️⃣ Au moment de payer, tu choisis « Orange Money ».
2️⃣ Tu tapes ton code de paiement, reçu en composant le #144#.
3️⃣ C'est payé : le resto lance ta commande, et tu n'as rien à sortir à la livraison.

Sans frais, dans tous les restos de l'appli. Livraison dès 2 000 Ar.

https://taxifoodnosybe.distripro207.com/

#NosyBe #Madagascar #OrangeMoney #Livraison #TaxiFood

## Version courte (groupes)

Nouveau sur Taxi Food : paie avec Orange Money directement dans l'appli 🧡 Plus besoin de monnaie à la
livraison : tu choisis Orange Money, tu tapes ton code (#144#), c'est payé. Sans frais.
👉 https://taxifoodnosybe.distripro207.com/jour

## Notification + e-mail (le jour de l'annonce)

- Titre : 🧡 Plus besoin de monnaie
- Texte : Nouveau : paie avec Orange Money directement dans l'appli. Sans frais, rien à sortir à la livraison 👉
- Ouvre : l'accueil de l'appli.

## Reel / TikTok

Vidéo 9:16 ci-dessus. Légende : « Ton livreur n'a pas la monnaie ? Plus besoin 🧡 Paie avec Orange Money
dans l'appli Taxi Food, sans frais. #NosyBe #OrangeMoney #TaxiFood »
