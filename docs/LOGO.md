# Logo — Taxi Food

## Palette de couleurs (pistes de départ)

- Rouge : `#E8342A`
- Orange : `#FF8A1E`
- Jaune : `#FFC72C`

⚠️ Palette non encore validée définitivement — à confirmer avant intégration dans la charte graphique.

## Pistes explorées

Quatre directions ont été générées pour validation (voir `assets/logo/`) :

1. **Fusion icône** (`direction1_fusion_icon.png`) — la roue du scooter livreur devient une part de pizza, lignes de vitesse suggérant la rapidité de livraison. Icône + wordmark, style app moderne.
2. **Mascotte** (`direction2_mascotte.png`) — personnage burger-scooter, ton fun et street-food.
3. **Badge emblème** (`direction3_badge.png`) — sceau circulaire avec pizza/tacos/burger, style premium artisanal.
4. **Flamme food abstraite** (`direction4_flame_food.png`) — mark épuré fusionnant pizza/taco/burger, sans référence transport.

## Statut

Aucune direction n'est encore validée. Prochaine étape : choisir une direction (ou un mix), confirmer la palette, puis produire l'asset final haute résolution et la charte graphique complète (icône app, splash screen, typographie).

## Prompt de génération — Direction 1 (référence)

Prompt JSON utilisé pour générer la version finale de la Direction 1 (icône fusion), à réutiliser si besoin de régénérer un asset :

```json
{
  "type": "final production-ready app logo, single clean asset, no mockup frame, no labels, no annotations",
  "style": "modern flat vector illustration, bold clean geometric shapes, smooth vibrant gradient, thick crisp white outlines, professional mobile food-delivery branding, pixel-perfect vector-clean edges, high resolution, print and app-store ready, no photorealism, no texture noise, no stray text or gibberish",
  "canvas": "large rounded-square app icon tile (iOS superellipse shape), filling the full frame edge to edge",
  "background_gradient": "diagonal gradient from deep red #E8342A at bottom-left, through bright orange #FF8A1E in the middle, to golden yellow #FFC72C at top-right",
  "icon_mark": "a bold minimal icon merging a delivery scooter wheel and a pizza slice into one continuous shape — the wheel's spokes read as pizza slice cuts, a small pepperoni-like dot accent near the rim, thick clean white outline (6-8% of icon width), flat vector style, perfectly centered with balanced negative space, three short dynamic speed-motion lines trailing to the left suggesting fast delivery",
  "wordmark": {
    "position": "on a separate white background directly beneath the icon tile, NOT inside the icon tile itself",
    "text": "TAXI FOOD",
    "style": "extra bold modern condensed sans-serif, near-black #1A1A1A, tight letter spacing, perfectly horizontal baseline",
    "tagline": "small thin uppercase red #E8342A text below the wordmark reading 'NOSY BE DELIVERY'"
  },
  "composition_notes": "the icon tile and the wordmark lockup below it should read as one cohesive vertical logo composition on a plain white canvas, generous even margins, nothing cropped or touching the edges, no shadows or reflections, no additional graphic elements"
}
```
