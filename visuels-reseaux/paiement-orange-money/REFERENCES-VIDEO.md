# Références vidéo — annonce « Paiement Orange Money »

## Donnée par le porteur du projet le 18/10/2026

**« Comment faire du Motion Design PRO avec Claude Opus 5.5 (guide complet) »**, Maxence Tison, 23 min —
https://www.youtube.com/watch?v=DBQqB8eqpFI

Ce n'est pas une pub mais un **tutoriel** : même outil que nous (HyperFrames, piloté par Claude), trois méthodes
(prompt seul · images de référence animées · vidéos de référence), quatre pubs montrées, toutes **avec voix off**
(Google Text-to-Speech, pas la voix robotique par défaut), toutes faites en un prompt, à l'effort maximal.
Vidéo supprimée après analyse ; transcription lue en entier.

| Pub montrée | Durée | Ce qui fait la qualité |
|---|---|---|
| Père Noël & Cie (prompt seul) | ~40 s | scènes **3D isométriques générées**, compteurs (« 2 000 000 000 enfants »), mots plein cadre, carte du monde, notif de fin « Votre colis a été livré », voix off qui raconte |
| **Yuka** (captures App Store comme référence) | ~22 s, **9:16** | la plus proche de nous : **un message par écran**, gros titre + sous-titre, **téléphone maquette avec le VRAI écran de l'app**, vert de marque plein cadre, zoom sur le détail (« 9 additifs »), chiffre de preuve (« 85 millions d'utilisateurs »), fin logo + « c'est gratuit », voix synchronisée au geste (le scan au mot « scanne ») |
| Génération IA (4 vidéos Twitter en référence) | 30 s | crème + jaune, éditorial, étiquettes « post-it », mosaïque de vignettes, compteurs « 50+ », avatars qui s'empilent, carte produit finale |
| Flora (bonus) | 22 s | fond noir, serif italique, interface réelle qui se construit, « Every model. One canvas. » |

### Ce qu'on en retient pour Taxi Food

1. **La voix off change tout** : les quatre pubs sont racontées, et le geste tombe sur le mot. Notre vidéo est muette
   (musique + effets). Levier n° 1 pour la prochaine passe : une voix off française, tutoiement, ~9 phrases calées
   sur les 9 scènes (`/media-use` tts, ou Google TTS).
2. **Un chiffre de preuve** (85 M d'utilisateurs, 200+ créateurs). À prévoir le jour où « X commandes déjà payées
   par Orange Money » sera vrai — jamais avant.
3. **Le vrai écran dans un téléphone maquette** fonctionne (Yuka). Notre charte redessine l'interface (référence
   Uber) ; les deux approches tiennent, la nôtre évite les captures qui vieillissent.
4. **Les scènes 3D isométriques** du Père Noël sont des images générées : hors charte Taxi Food, sauf via les
   éléments validés (Maki, scooter).
5. ⚠️ **L'auteur juge la version Fable 5.1 (ultra code) MOINS bonne qu'Opus 5.5** : textes coupés, chevauchements,
   « énormément d'efforts pour l'animer dans tous les sens », plus de tokens. Et GPT-6 Astra nettement derrière.
   Leçon : le modèle n'est pas le levier ; les garde-fous le sont (`hyperframes check`, snapshots à mi-transition,
   contrôles de débord) — exactement ce que notre chaîne fait déjà.
6. Son outil « Editing OS » = retours image par image envoyés à Claude. Équivalent chez nous : le porteur du projet
   dit la scène et le temps, on corrige la scène seule.

## Référence d'origine (héritée du 1er film)

- **« Uber Motion Ad Concept 🚗 »**, Yasin Sevdigim — https://www.youtube.com/watch?v=TCiSxF6Ag4c : interface
  redessinée, jamais de capture, mots plein cadre, caméra rapide. Analyse détaillée dans
  `../commande-programmee/REFERENCES-VIDEO.md`.
