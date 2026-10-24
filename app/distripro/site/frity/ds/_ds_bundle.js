/* @ds-bundle: {"namespace":"Frity","components":[{"name":"Badge","sourcePath":"components/etiquettes/Badge/Badge.jsx"},{"name":"Button","sourcePath":"components/actions/Button/Button.jsx"},{"name":"Callout","sourcePath":"components/mise-en-page/Callout/Callout.jsx"},{"name":"Character","sourcePath":"components/marque/Character/Character.jsx"},{"name":"CutEdge","sourcePath":"components/mise-en-page/CutEdge/CutEdge.jsx"},{"name":"Field","sourcePath":"components/formulaires/Field/Field.jsx"},{"name":"PriceTag","sourcePath":"components/etiquettes/PriceTag/PriceTag.jsx"},{"name":"Section","sourcePath":"components/mise-en-page/Section/Section.jsx"},{"name":"Tile","sourcePath":"components/mise-en-page/Tile/Tile.jsx"}],"sourceHashes":{"components/etiquettes/Badge/Badge.jsx":"edd508831928","components/etiquettes/Badge/Badge.d.ts":"71cf230279d1","components/etiquettes/Badge/Badge.prompt.md":"5f91c036804f","components/actions/Button/Button.jsx":"30330adee397","components/actions/Button/Button.d.ts":"9c8c47929396","components/actions/Button/Button.prompt.md":"df2c6318c80e","components/mise-en-page/Callout/Callout.jsx":"dff89b4b9630","components/mise-en-page/Callout/Callout.d.ts":"25d14f4611ca","components/mise-en-page/Callout/Callout.prompt.md":"a4bf354cadf4","components/marque/Character/Character.jsx":"80327d76ecc8","components/marque/Character/Character.d.ts":"d382fbf7b499","components/marque/Character/Character.prompt.md":"6d317fefa6e8","components/mise-en-page/CutEdge/CutEdge.jsx":"0e77c82216cf","components/mise-en-page/CutEdge/CutEdge.d.ts":"4d823ad77d71","components/mise-en-page/CutEdge/CutEdge.prompt.md":"1ea7f5b25cac","components/formulaires/Field/Field.jsx":"f13cdbadea0c","components/formulaires/Field/Field.d.ts":"d00abd81b8be","components/formulaires/Field/Field.prompt.md":"2380c70f5d08","components/etiquettes/PriceTag/PriceTag.jsx":"e1126657997e","components/etiquettes/PriceTag/PriceTag.d.ts":"ef0f4b930133","components/etiquettes/PriceTag/PriceTag.prompt.md":"e1e666407101","components/mise-en-page/Section/Section.jsx":"03c2d5b51d24","components/mise-en-page/Section/Section.d.ts":"321034c80749","components/mise-en-page/Section/Section.prompt.md":"06e9d544408c","components/mise-en-page/Tile/Tile.jsx":"6f43797d653e","components/mise-en-page/Tile/Tile.d.ts":"54fed880e967","components/mise-en-page/Tile/Tile.prompt.md":"7df037bd0271"},"inlinedExternals":[],"builtBy":"cc-design-sync"} */
var Frity = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.js
  var index_exports = {};
  __export(index_exports, {
    Badge: () => Badge,
    Button: () => Button,
    Callout: () => Callout,
    Character: () => Character,
    CutEdge: () => CutEdge,
    Field: () => Field,
    PriceTag: () => PriceTag,
    Section: () => Section,
    Tile: () => Tile
  });

  // src/components/Button.jsx
  function Button({
    variant = "primaire",
    // 'primaire' | 'secondaire' | 'texte'
    size = "md",
    // 'sm' | 'md' | 'lg'
    arrow = true,
    // la flèche « → » à droite, présente par défaut
    as: Tag = "button",
    className = "",
    children,
    ...rest
  }) {
    return /* @__PURE__ */ React.createElement(Tag, { className: `f-btn f-btn--${variant} f-btn--${size} ${className}`, ...rest }, /* @__PURE__ */ React.createElement("span", { className: "f-btn__label" }, children), arrow && /* @__PURE__ */ React.createElement("span", { className: "f-btn__arrow", "aria-hidden": "true" }, "\u2192"));
  }

  // src/components/Tile.jsx
  function Tile({
    tone = "paille",
    // 'paille' | 'tuile' | 'sable' | 'creme'
    title,
    note,
    image,
    // { src, alt, focus? }  focus = object-position
    badge,
    // <Badge/> optionnel, posé en haut à droite
    as: Tag = "div",
    className = "",
    children,
    ...rest
  }) {
    return /* @__PURE__ */ React.createElement(Tag, { className: `f-tile f-tile--${tone} ${className}`, ...rest }, badge && /* @__PURE__ */ React.createElement("div", { className: "f-tile__badge" }, badge), title && /* @__PURE__ */ React.createElement("h3", { className: "f-tile__title" }, title), note && /* @__PURE__ */ React.createElement("p", { className: "f-tile__note" }, note), image && /* @__PURE__ */ React.createElement(
      "img",
      {
        className: "f-tile__img",
        src: image.src,
        alt: image.alt,
        loading: "lazy",
        style: image.focus ? { objectPosition: image.focus } : void 0
      }
    ), children);
  }

  // src/components/Badge.jsx
  function Badge({ tone = "marque", children, className = "", ...rest }) {
    return /* @__PURE__ */ React.createElement("span", { className: `f-badge f-badge--${tone} ${className}`, ...rest }, children);
  }

  // src/components/Field.jsx
  function Field({
    id,
    label,
    help,
    error,
    type = "text",
    unit,
    // « Ar », « kg »… affiché à droite, en Space Mono
    className = "",
    ...rest
  }) {
    const helpId = help ? `${id}-aide` : void 0;
    const errId = error ? `${id}-erreur` : void 0;
    return /* @__PURE__ */ React.createElement("div", { className: `f-field ${error ? "is-error" : ""} ${className}` }, /* @__PURE__ */ React.createElement("label", { className: "f-field__label", htmlFor: id }, label), help && /* @__PURE__ */ React.createElement("p", { className: "f-field__help", id: helpId }, help), /* @__PURE__ */ React.createElement("div", { className: "f-field__box" }, /* @__PURE__ */ React.createElement(
      "input",
      {
        id,
        type,
        "aria-describedby": [helpId, errId].filter(Boolean).join(" ") || void 0,
        "aria-invalid": error ? "true" : void 0,
        ...rest
      }
    ), unit && /* @__PURE__ */ React.createElement("span", { className: "f-field__unit", "aria-hidden": "true" }, unit)), error && /* @__PURE__ */ React.createElement("p", { className: "f-field__error", id: errId }, error));
  }

  // src/components/PriceTag.jsx
  function PriceTag({ weight = "2,5 kg", amount, unit = "Ar / kg", note, className = "" }) {
    return /* @__PURE__ */ React.createElement("div", { className: `f-price ${className}` }, /* @__PURE__ */ React.createElement("div", { className: "f-price__weight" }, weight), /* @__PURE__ */ React.createElement("div", { className: "f-price__amount" }, amount, /* @__PURE__ */ React.createElement("span", { className: "f-price__unit" }, " ", unit)), note && /* @__PURE__ */ React.createElement("p", { className: "f-price__note" }, note));
  }

  // src/components/CutEdge.jsx
  var SEED = 24301;
  function cuts(count, height, seedOffset = 0) {
    let s = SEED + seedOffset;
    const rnd = () => (s = s * 1103515245 + 12345 & 2147483647) / 2147483647;
    const xs = [0];
    while (xs[xs.length - 1] < 1200) xs.push(xs[xs.length - 1] + 42 + Math.round(rnd() * 54));
    xs[xs.length - 1] = 1200;
    return xs.map((x) => [x, 3 + Math.round(rnd() * (height - 9))]);
  }
  function CutEdge({ side = "haut", fill = "var(--creme)", height = 34, variant = 0, className = "" }) {
    const pts = cuts(0, height, variant * 977);
    const d = side === "haut" ? `M0 ${pts[0][1]}` + pts.slice(1).map(([x, y]) => `L${x} ${y}`).join("") + `L1200 ${height}L0 ${height}Z` : `M0 0L1200 0` + [...pts].reverse().map(([x, y]) => `L${x} ${height - y}`).join("") + "Z";
    return /* @__PURE__ */ React.createElement(
      "svg",
      {
        className: `f-cut ${className}`,
        viewBox: `0 0 1200 ${height}`,
        preserveAspectRatio: "none",
        "aria-hidden": "true",
        style: { height }
      },
      /* @__PURE__ */ React.createElement("path", { d, fill })
    );
  }

  // src/components/Character.jsx
  function Character({
    src,
    alt,
    member = "monsieur",
    // 'monsieur' | 'madame' | 'enfants'
    splat = true,
    // la tache de couleur au sol
    size = "md",
    // 'sm' | 'md' | 'lg'
    className = ""
  }) {
    return /* @__PURE__ */ React.createElement("figure", { className: `f-perso f-perso--${member} f-perso--${size} ${className}` }, splat && /* @__PURE__ */ React.createElement("span", { className: "f-perso__splat", "aria-hidden": "true" }), /* @__PURE__ */ React.createElement("img", { className: "f-perso__img", src, alt, loading: "lazy" }));
  }

  // src/components/Callout.jsx
  function Callout({ tone = "note", title, className = "", children }) {
    return /* @__PURE__ */ React.createElement("aside", { className: `f-callout f-callout--${tone} ${className}` }, title && /* @__PURE__ */ React.createElement("h4", { className: "f-callout__title" }, title), /* @__PURE__ */ React.createElement("div", { className: "f-callout__body" }, children));
  }

  // src/components/Section.jsx
  function Section({
    tone = "creme",
    // 'creme' | 'sable' | 'paille' | 'encre'
    cut = false,
    // pose une coupe en entrée de section
    cutVariant = 0,
    wide = false,
    // laisse le contenu occuper toute la largeur
    className = "",
    children,
    ...rest
  }) {
    return /* @__PURE__ */ React.createElement(React.Fragment, null, cut && /* @__PURE__ */ React.createElement(CutEdge, { side: "haut", fill: `var(--${tone})`, variant: cutVariant }), /* @__PURE__ */ React.createElement("section", { className: `f-section f-section--${tone} ${className}`, ...rest }, /* @__PURE__ */ React.createElement("div", { className: wide ? "f-wide" : "f-col" }, children)));
  }
  return __toCommonJS(index_exports);
})();
window.Frity=Frity.__dsMainNs?Object.assign({},Frity,Frity.__dsMainNs,{__dsMainNs:undefined}):Frity;
