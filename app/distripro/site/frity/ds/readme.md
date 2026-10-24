# Building with FRITY

FRITY is the product brand of **Distripro** (Nosy Be, Madagascar): fresh-cut potatoes sold to
restaurant owners. The UI copy is **French**, addressed to a professional (`vous`), and the look
is warm cartoon — never clinical. There is **no provider and no theme object**: components read
plain CSS custom properties, so the only setup is loading `styles.css` and putting the page on
the brand ground.

## Page setup — do this first

`styles.css` defines the tokens but does **not** style `<body>`. A page without `f-body` renders
white with browser-default type, which is off-brand and easy to miss:

```jsx
const { Section, Button } = window.Frity;

<div className="f-body">
  <Section>
    <p className="f-label">Distripro · Nosy Be</p>
    <h2>Coupées ce matin, livrées ce soir</h2>
    <p>Congelées crues, en sachets de 2,5 kg.</p>
    <Button>commander</Button>
  </Section>
</div>
```

`<Section>` already wraps its children in the content column, so don't add `f-col` inside one.

## The styling idiom: tokens + a small class vocabulary

Write your own layout glue with `var(--token)` values and these classes. **Never hard-code a
colour, size, radius or spacing** — a hand-written value is a bug, not a choice.

| Class | Use |
|---|---|
| `f-body` | page ground: crème background, ink text, Karla |
| `f-col` / `f-wide` | content column (760px) / wide container (1200px), both centred |
| `f-tiles` | the 2-column grid `<Tile>` expects (1 column under 640px) |
| `f-label` | small uppercase mono eyebrow label |
| `f-num` | tabular mono figures (prices, quantities) |
| `f-title` | apply heading type to a non-heading element |

Tokens, by family — real names, use them verbatim:

- **Ink & brand**: `--or` `--or-fonce` `--rouge` `--rouge-fonce` `--encre` `--peau`
- **Surfaces**: `--creme` (default page) `--sable` `--paille` `--tuile` `--carte` `--trait`
- **Text**: `--texte` `--texte-doux` `--texte-inverse`
- **Interface only** (never on a brand visual): `--dispo` `--attente` `--erreur` and their
  `--*-fond` backgrounds
- **Spacing**, base 4: `--e-1` (4px) → `--e-9` (96px)
- **Type**: `--titre` (Fredoka 600) `--texte-f` (Karla) `--chiffre` (Space Mono);
  sizes `--pas-1` → `--pas-8`; `--inter-titre` `--inter-texte` `--chasse-mono`
- **Shape**: `--r-pilule` `--r-tuile` `--r-champ` `--r-etiquette` `--trait-large`
- **Shadow**: `--ombre-bouton` `--ombre-carte` `--ombre-perso` — offset, never blur alone
- **Motion**: `--vite` `--moyen` `--lent` `--courbe`
- **Measure**: `--colonne` (760px) `--mesure` (66ch max paragraph width)

Dark mode is already handled inside the tokens (`prefers-color-scheme` plus a
`[data-theme="dark"]` override). Don't write your own dark palette.

## The five rules that make it FRITY

1. **No pure white, no pure black.** Ground is `--creme`, text is `--encre`.
2. **One heading weight** — Fredoka 600 everywhere; hierarchy comes from size, never weight.
   Big headings are tight (`--inter-titre` 0.96). **Never a serif.**
3. **Buttons are full pills**, never rounded rectangles. One `primaire` per screen.
4. **A boundary between two backgrounds is a knife cut**, never a rule or a wave — pass `cut`
   to `<Section>`. Never two cuts visible at once.
5. **Semantic colours are interface-only.** On a brand visual, the only badge is `tone="marque"`.

## Where the truth lives

- `styles.css` and its imports — the compiled tokens and component CSS, authoritative.
- `guidelines/RULES.md` — the non-negotiables (brand architecture, the mascot family, spelling).
- `guidelines/VOICE.md` — who the reader is and how to write to them. Read before writing copy.
- `components/<group>/<Name>/<Name>.prompt.md` — per-component usage, with examples.

Image props (`<Tile image={{src}}>`, `<Character src>`) take **URLs**; the data-URIs in the
preview cards are only there to make a card self-contained.

# Frity (frity-design-system@1.0.0)

This design system is the published frity-design-system React library, bundled as a single
browser global. All 9 components are the real upstream code.

## Where things are

- `_ds_bundle.js` — the whole-DS bundle at the project root; loads every component to `window.Frity`. First line is a `/* @ds-bundle: … */` metadata header.
- `styles.css` — the single stylesheet entry: it `@import`s the tokens, fonts, and component styles (`_ds_bundle.css`). Link this one file.
- `components/<group>/<Name>/<Name>.prompt.md` (example JSX + variants), `<Name>.d.ts` (types), `<Name>.html` (variant grid).
- `tokens/*.css` — CSS custom properties, names verbatim from upstream.
- `fonts/` — `@font-face` files + `fonts.css` (when the package ships fonts).
- `guidelines/` — the design system's own usage guidance (3 doc(s), see `guidelines/index.md`). Read these before composing larger layouts.

For a specific component, `read_file("components/<group>/<Name>/<Name>.prompt.md")`.

## Loading

Add these two lines to your page once (React must be on the page first):

```html
<link rel="stylesheet" href="styles.css">
<script src="_ds_bundle.js"></script>
```

Components are then available at `window.Frity.*`. Mount into a dedicated child node (e.g. `<div id="ds-root">`), not the host page's own React root, so the two trees don't collide:

```jsx
const { Badge } = window.Frity;
ReactDOM.createRoot(document.getElementById('ds-root')).render(<Badge />);
```

## Tokens

59 CSS custom properties from frity-design-system. Names are
preserved verbatim from upstream. They are declared inside `_ds_bundle.css` (this DS ships one compiled stylesheet rather than separate token files).

- **other** (59): `--or`, `--or-fonce`, `--rouge`, …

## Components

### etiquettes
- `Badge`
- `PriceTag`

### actions
- `Button`

### mise-en-page
- `Callout`
- `CutEdge`
- `Section`
- `Tile`

### marque
- `Character`

### formulaires
- `Field`
