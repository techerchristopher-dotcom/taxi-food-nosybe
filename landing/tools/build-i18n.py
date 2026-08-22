#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genere les versions EN et IT des deux pages de la landing Taxi Food.

PRINCIPE
--------
Les pages francaises sont la SOURCE. Le script en derive un gabarit en
remplacant (a) chaque segment de texte connu de i18n/fr.json par un jeton
{{cle}}, et (b) les quelques fragments qui dependent de la langue mais ne
sont pas du texte (URL canoniques, og:locale, selecteur de langue...) par
des jetons {{@nom}}. Le gabarit est ensuite rendu une fois par langue.

GARDE-FOU
---------
Avant d'ecrire quoi que ce soit, le gabarit est rendu EN FRANCAIS et compare
octet a octet au fichier source. S'ils different, la tokenisation a mange ou
deplace quelque chose, et le script s'arrete sans rien ecrire. C'est ce
controle qui garantit que les pages EN et IT ne different du francais que
par le dictionnaire.

Usage :  python3 tools/build-i18n.py        (depuis le dossier landing/)
"""

import json
import os
import re
import sys

BASE = "https://taxifood.rentanoo.com"
LANGS = ["fr", "en", "it"]
LABEL = {"fr": "FR", "en": "EN", "it": "IT"}
# Endonymes : le nom d'une langue ne se traduit pas dans un selecteur.
ENDONYM = {"fr": "Français", "en": "English", "it": "Italiano"}

PATHS = {
    "client": {"fr": "/", "en": "/en/", "it": "/it/"},
    "resto": {
        "fr": "/restaurants-partenaires/",
        "en": "/en/restaurant-partners/",
        "it": "/it/ristoranti-partner/",
    },
    # Un manifeste PWA par langue : sinon un visiteur anglophone qui ajoute le
    # site a son ecran d'accueil obtient une description francaise et un
    # start_url qui le ramene sur la page francaise.
    "manifeste": {
        "fr": "/site.webmanifest",
        "en": "/en/site.webmanifest",
        "it": "/it/site.webmanifest",
    },
}
SRC ={"client": "index.html", "resto": "restaurants-partenaires/index.html"}
OUT = {
    "client": {"en": "en/index.html", "it": "it/index.html"},
    "resto": {
        "en": "en/restaurant-partners/index.html",
        "it": "it/ristoranti-partner/index.html",
    },
}
PUBLISHED = {"fr": "2026-08-21", "en": "2026-08-22", "it": "2026-08-22"}
MODIFIED = "2026-08-22"

# Cles de i18n/fr.json qui ne sont PAS des segments de texte a chercher dans
# le HTML : « fr » et « fr_FR » matcheraient partout, et les mots-cles SEO
# n'apparaissent nulle part (le site n'a pas de <meta name="keywords">).
SKIP_KEYS = {
    "common.htmlLang",
    "common.og.locale",
    "schema.inLanguage",
    "client.seo.keywords",
    "resto.seo.keywords",
    # Les trois accroches multilingues sont posees par le jeton {{@teasers}} :
    # chaque page affiche les deux AUTRES langues, pas la sienne.
    "client.signup.teaserFr",
    "client.signup.teaserEn",
    "client.signup.teaserIt",
}

TEASER_STYLE = "font:400 14px/1.6 Archivo,sans-serif;color:#4A4744;margin:12px 0 0;max-width:460px"
LGT_STYLE = (
    "display:inline-flex;align-items:center;justify-content:center;min-width:36px;"
    "height:28px;padding:0 8px;border-radius:999px;font:800 11px/1 'JetBrains Mono',"
    "monospace;letter-spacing:.08em;"
)


def esc(s):
    """Le seul caractere a echapper dans nos valeurs est l'esperluette."""
    return s.replace("&", "&amp;")


LETTRE = r"[^\W\d_]"


def motif(needle):
    """Motif ancre sur des frontieres de mot.

    Sans cela, « Nom » mordrait dans l'italien « Nome » et la page sortirait
    avec « Last nameE E COGNOME ». On n'ancre que du cote ou la valeur
    commence (ou finit) par une lettre : beaucoup de segments commencent par
    une espace ou un chiffre.
    """
    pat = re.escape(needle)
    if re.match(LETTRE, needle[0]):
        pat = "(?<!" + LETTRE + ")" + pat
    if re.match(LETTRE, needle[-1]):
        pat = pat + "(?!" + LETTRE + ")"
    return re.compile(pat)


def lang_nav(page, loc, d):
    """Selecteur de langue : de VRAIS liens, pour que Google les suive."""
    out = [
        '<nav aria-label="%s" style="display:flex;align-items:center;gap:4px;'
        'padding:4px;border-radius:999px;background:#EAE5E0;border:1px solid #DCD8D3">'
        % esc(d["common.lang.ariaLabel"])
    ]
    for l in LANGS:
        cur = 'aria-current="page" ' if l == loc else ""
        colors = (
            "background:#1A1A1A;color:#fff"
            if l == loc
            else "background:transparent;color:#6B6662"
        )
        out.append(
            '<a href="%s" hreflang="%s" lang="%s" %saria-label="%s" class="lgt" '
            'style="%s%s">%s</a>'
            % (PATHS[page][l], l, l, cur, ENDONYM[l], LGT_STYLE, colors, LABEL[l])
        )
    out.append("</nav>")
    return "\n".join(out)


def teasers(loc, d):
    """Accroches dans les deux autres langues, sous le paragraphe principal."""
    key = {
        "fr": "client.signup.teaserFr",
        "en": "client.signup.teaserEn",
        "it": "client.signup.teaserIt",
    }
    return "\n".join(
        '<p lang="%s" style="%s">%s</p>' % (o, TEASER_STYLE, esc(d[key[o]]))
        for o in LANGS
        if o != loc
    )


def swap(html, old, new, expected, label):
    n = html.count(old)
    if n != expected:
        raise SystemExit(
            "STOP — %s : %d occurrence(s) trouvee(s), %d attendue(s).\n  %r"
            % (label, n, expected, old[:120])
        )
    return html.replace(old, new)


def structural(html, page):
    """Remplace les fragments dependants de la langue mais non textuels."""
    fr_path = PATHS[page]["fr"]
    fr_url = BASE + fr_path

    html = swap(html, '<html lang="fr">', '<html lang="{{@lang}}">', 1, "html lang")
    html = swap(
        html,
        '<link rel="manifest" href="/site.webmanifest">',
        '<link rel="manifest" href="{{@manifestUrl}}">',
        1,
        "manifeste",
    )
    html = swap(
        html,
        '<link rel="canonical" href="%s">' % fr_url,
        '<link rel="canonical" href="{{@pageUrl}}">',
        1,
        "canonical",
    )
    html = swap(
        html,
        '<meta property="og:locale" content="fr_FR">',
        '<meta property="og:locale" content="{{@ogLocale}}">',
        1,
        "og:locale",
    )
    html = swap(
        html,
        '<meta property="og:locale:alternate" content="en_US">\n'
        '<meta property="og:locale:alternate" content="it_IT">',
        "{{@ogAlternates}}",
        1,
        "og:locale:alternate",
    )
    html = swap(
        html,
        '<meta property="og:url" content="%s">' % fr_url,
        '<meta property="og:url" content="{{@pageUrl}}">',
        1,
        "og:url",
    )
    # JSON-LD : la WebPage est propre a la langue. Organization, Service,
    # Place, MobileApplication et WebSite gardent leur @id partage : c'est la
    # meme entite dans les trois langues.
    html = swap(
        html,
        '      "@id": "%s#webpage",\n      "url": "%s",' % (fr_url, fr_url),
        '      "@id": "{{@pageUrl}}#webpage",\n      "url": "{{@pageUrl}}",',
        1,
        "JSON-LD WebPage @id/url",
    )
    html = swap(
        html, '"inLanguage": "fr",', '"inLanguage": "{{@lang}}",', 1, "WebPage inLanguage"
    )
    html = swap(
        html,
        '"datePublished": "2026-08-21",\n      "dateModified": "2026-08-22"',
        '"datePublished": "{{@published}}",\n      "dateModified": "{{@modified}}"',
        1,
        "dates JSON-LD",
    )

    # Selecteur de langue : regenere en entier, langue active comprise.
    nav = re.search(r'<nav aria-label="Langue du site".*?</nav>', html, re.S)
    if not nav:
        raise SystemExit("STOP — selecteur de langue introuvable dans %s" % page)
    html = html.replace(nav.group(0), "{{@langNav}}", 1)

    # Onglets client / restaurateur : meme langue de part et d'autre.
    if page == "client":
        html = swap(
            html,
            '<a href="/" aria-current="page" class="vtab"',
            '<a href="{{@homeUrl}}" aria-current="page" class="vtab"',
            1,
            "onglet client",
        )
        html = swap(
            html,
            '<a href="/restaurants-partenaires/" class="vtab"',
            '<a href="{{@restoUrl}}" class="vtab"',
            1,
            "onglet restaurateur",
        )
        block = re.search(
            r'<p lang="en" style="[^"]*">.*?</p>\n<p lang="it" style="[^"]*">.*?</p>',
            html,
            re.S,
        )
        if not block:
            raise SystemExit("STOP — accroches multilingues introuvables")
        html = html.replace(block.group(0), "{{@teasers}}", 1)
    else:
        html = swap(
            html,
            '<a href="/" class="vtab"',
            '<a href="{{@homeUrl}}" class="vtab"',
            1,
            "onglet client",
        )
        html = swap(
            html,
            '<a href="/restaurants-partenaires/" aria-current="page" class="vtab"',
            '<a href="{{@restoUrl}}" aria-current="page" class="vtab"',
            1,
            "onglet restaurateur",
        )
        html = swap(
            html,
            '<a href="/" style="height:56px;padding:0 22px;',
            '<a href="{{@homeUrl}}" style="height:56px;padding:0 22px;',
            1,
            "bouton Voir la vue client",
        )
        html = swap(
            html,
            '"@id": "%s#breadcrumb"' % fr_url,
            '"@id": "{{@pageUrl}}#breadcrumb"',
            2,
            "fil d'Ariane @id",
        )
        html = swap(
            html,
            '"item": "%s/"' % BASE,
            '"item": "{{@homeAbs}}"',
            1,
            "fil d'Ariane accueil",
        )
        html = swap(
            html, '"item": "%s"' % fr_url, '"item": "{{@pageUrl}}"', 1, "fil d'Ariane page"
        )
    return html


def a_traduire(dicts):
    """Cles dont la valeur change d'une langue a l'autre.

    Une valeur identique dans les trois langues (« La Cabane », « WhatsApp »,
    « AMBATOLOAKA », le point final d'une phrase...) n'a rien a substituer, et
    la chercher dans le HTML est dangereux : « . » matcherait chaque point du
    document, y compris a l'interieur des jetons deja poses.
    """
    out = []
    for k in dicts["fr"]:
        if k in SKIP_KEYS:
            continue
        v = dicts["fr"][k]
        if all(dicts[l][k] == v for l in LANGS):
            continue
        if len(v) < 3:
            raise SystemExit(
                "STOP — la cle %r vaut %r : trop court pour etre cherche sans "
                "degat dans le HTML. Ajoutez-la a SKIP_KEYS." % (k, v)
            )
        out.append((k, v))
    # Du plus long au plus court : « Nom de votre restaurant » avant « Nom ».
    out.sort(key=lambda kv: (-len(kv[1]), kv[0]))
    return out


def tokenize(html, dicts):
    for key, val in a_traduire(dicts):
        jeton = "{{%s}}" % key
        html = motif(esc(val)).sub(lambda m: jeton, html)
    if re.search(r"\{\{[^{}]*\{", html):
        raise SystemExit("STOP — jeton imbrique : une valeur trop courte a mordu ailleurs.")
    return html


def render(tpl, page, loc, d):
    path = PATHS[page][loc]
    mapping = {k: esc(v) for k, v in d.items()}
    mapping.update(
        {
            "@lang": d["common.htmlLang"],
            "@ogLocale": d["common.og.locale"],
            "@pageUrl": BASE + path,
            "@homeUrl": PATHS["client"][loc],
            "@restoUrl": PATHS["resto"][loc],
            "@manifestUrl": PATHS["manifeste"][loc],
            "@homeAbs": BASE + PATHS["client"][loc],
            "@published": PUBLISHED[loc],
            "@modified": MODIFIED,
            "@langNav": lang_nav(page, loc, d),
            "@teasers": teasers(loc, d),
            "@ogAlternates": "\n".join(
                '<meta property="og:locale:alternate" content="%s">' % OGL[o]
                for o in LANGS
                if o != loc
            ),
        }
    )
    missing = []

    def sub(m):
        k = m.group(1)
        if k not in mapping:
            missing.append(k)
            return m.group(0)
        return mapping[k]

    out = re.sub(r"\{\{([^{}]+)\}\}", sub, tpl)
    if missing:
        raise SystemExit("STOP — jetons sans valeur : %s" % sorted(set(missing)))
    if "{{" in out:
        raise SystemExit("STOP — jetons non resolus dans %s/%s" % (page, loc))
    return out


def ecrire_manifestes(dicts):
    """Un manifeste PWA par langue, derive du manifeste francais.

    Le francais reste la source, comme pour les pages : on relit
    site.webmanifest et on ne remplace que les trois champs qui dependent de la
    langue (description, lang, start_url). Le nom de marque, les couleurs et
    les icones ne se traduisent pas.
    """
    with open("site.webmanifest", encoding="utf-8") as f:
        base = json.load(f)

    # Meme garde-fou que pour les pages : la source doit correspondre au
    # dictionnaire, sinon la traduction partirait d'un texte perime.
    attendu = {
        "description": dicts["fr"]["common.manifest.description"],
        "lang": dicts["fr"]["common.htmlLang"],
        "start_url": PATHS["client"]["fr"],
    }
    for champ, valeur in attendu.items():
        if base.get(champ) != valeur:
            raise SystemExit(
                "STOP — site.webmanifest[%r] vaut %r, i18n/fr.json attend %r."
                % (champ, base.get(champ), valeur)
            )

    ecrits = []
    for loc in ("en", "it"):
        m = dict(base)
        m["description"] = dicts[loc]["common.manifest.description"]
        m["lang"] = dicts[loc]["common.htmlLang"]
        m["start_url"] = PATHS["client"][loc]
        dest = PATHS["manifeste"][loc].lstrip("/")
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, "w", encoding="utf-8") as f:
            json.dump(m, f, ensure_ascii=False, indent=2)
            f.write("\n")
        ecrits.append(dest)
    return ecrits


def main():
    root = os.path.dirname(os.path.abspath(__file__))
    root = os.path.dirname(root)  # dossier landing/
    os.chdir(root)

    dicts = {}
    for l in LANGS:
        with open("i18n/%s.json" % l, encoding="utf-8") as f:
            dicts[l] = json.load(f)
    ref = set(dicts["fr"])
    for l in LANGS:
        if set(dicts[l]) != ref:
            raise SystemExit(
                "STOP — i18n/%s.json n'a pas les memes cles que fr.json : %s"
                % (l, sorted(ref ^ set(dicts[l])))
            )

    global OGL
    OGL = {l: dicts[l]["common.og.locale"] for l in LANGS}

    written = []
    for page in ("client", "resto"):
        with open(SRC[page], encoding="utf-8") as f:
            source = f.read()
        tpl = tokenize(structural(source, page), dicts)

        # Garde-fou : le francais rendu doit redonner la source, octet a octet.
        back = render(tpl, page, "fr", dicts["fr"])
        if back != source:
            for i, (a, b) in enumerate(zip(back, source)):
                if a != b:
                    raise SystemExit(
                        "STOP — aller-retour francais non conforme (%s), offset %d :\n"
                        "  rendu  : %r\n  source : %r"
                        % (page, i, back[max(0, i - 90) : i + 90], source[max(0, i - 90) : i + 90])
                    )
            raise SystemExit("STOP — aller-retour francais : longueurs differentes (%s)" % page)

        for loc in ("en", "it"):
            out = render(tpl, page, loc, dicts[loc])
            dest = OUT[page][loc]
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, "w", encoding="utf-8") as f:
                f.write(out)
            written.append(dest)

        # Controle de fuite : aucun segment francais qui differe de sa
        # traduction ne doit subsister dans la page produite.
        for loc in ("en", "it"):
            page_txt = open(OUT[page][loc], encoding="utf-8").read()
            # Les accroches <p lang="xx"> sont volontairement dans une autre
            # langue que la page : elles ne comptent pas comme une fuite.
            page_txt = re.sub(r'<p lang="[a-z]{2}" style="[^"]*">.*?</p>', "", page_txt, flags=re.S)
            leaks = [
                k
                for k, v in a_traduire(dicts)
                if dicts[loc][k] != v and motif(esc(v)).search(page_txt)
            ]
            if leaks:
                raise SystemExit(
                    "STOP — francais residuel dans %s : %s" % (OUT[page][loc], leaks)
                )

    written.extend(ecrire_manifestes(dicts))

    print("Aller-retour francais conforme sur les deux pages.")
    for w in written:
        print("ecrit :", w)


if __name__ == "__main__":
    main()
