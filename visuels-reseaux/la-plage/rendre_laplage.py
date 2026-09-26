# -*- coding: utf-8 -*-
"""Rend la carte en PDF + PNG, et la controle. Aucun jugement a l'oeil.

Quatre controles :
  1. debord BAS   — aucun bloc ne descend sous la limite utile de la page
  2. debord DROITE — aucun bloc ne sort de sa colonne (un controle vertical
     n'est pas un controle horizontal : page 4 de la carte de Bidul avait
     silencieusement deborde dans une troisieme colonne)
  3. hauteur de page exacte a 297 mm
  4. presence : chaque ligne des donnees se retrouve dans le HTML rendu
"""
import asyncio, os, re, sys, unicodedata
import donnees_laplage as D

MM = 3.7795275591

async def main(sortie='CARTE-LA-PLAGE.pdf'):
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--font-render-hinting=none', '--disable-lcd-text'])
        pg = await b.new_page(viewport={'width': 794, 'height': 1123}, device_scale_factor=2)
        await pg.goto('file://' + os.path.abspath('carte-laplage.html'))
        await pg.wait_for_timeout(2200)
        # LA MESURE PASSE AVANT LE PDF ET LES CAPTURES, et ce n'est pas un detail :
        # `page.pdf()` bascule le rendu en media `print`, et `element.screenshot()`
        # fait defiler la page jusqu'a l'element. Apres ces deux appels, les
        # coordonnees renvoyees par getBoundingClientRect() ne sont plus celles de
        # la page qu'on croit mesurer — les premieres pages passent en negatif et
        # les colonnes remontent vides. Mesure d'abord, rends ensuite.
        mes = await pg.evaluate("""() => {
          const MM = 3.7795275591;
          return [...document.querySelectorAll('.pg')].map((pg, i) => {
            const r = pg.getBoundingClientRect();
            const bas = 297*MM - 12*MM;
            let deb = 0, pire = null;
            for (const el of pg.querySelectorAll('.pl,.bl,.ent,.acc,.cv-in,.ds-in,.bd')) {
              const e = el.getBoundingClientRect();
              const y = e.bottom - r.top;
              if (y > bas + 0.5) { deb++; if (!pire || y > pire.y) pire = {y: y/MM, t: el.className}; }
            }
            let hors = 0;
            const cx = [...pg.querySelectorAll('.cx')];
            for (const c of cx) {
              const cr = c.getBoundingClientRect();
              for (const el of c.querySelectorAll('.pl,.bl,.st,.ent,.acc')) {
                const e = el.getBoundingClientRect();
                if (e.right > cr.right + 1) hors++;
              }
            }
            // Le bandeau ne doit chevaucher AUCUNE colonne : c'est tout
            // l'interet d'avoir reserve sa hauteur dans le composeur.
            const bd = pg.querySelector('.bd');
            let sous_bandeau = 0, ecart_bd = null;
            // LE CONTENU DU BANDEAU DOIT TENIR DANS LE BANDEAU. La premiere
            // version de ce controle ne regardait que la BOITE : avec une
            // hauteur fixe et `align-items:center`, un texte trop long deborde
            // sans que la boite change d'un millimetre. Le debord etait
            // invisible a la mesure et parfaitement visible a l'impression.
            let bd_debord = 0, bd_lignes = [];
            if (bd) {
              const br = bd.getBoundingClientRect();
              ecart_bd = 999;
              // `bas` existe deja dans la portee du dessus (la limite basse de
              // page) : reutiliser ce nom ici donnait une mesure fausse sans
              // lever d'erreur. On le renomme.
              const pad = 1.2;   // mm de garde interieure
              // Vertical ET horizontal. `white-space:nowrap` supprime le
              // retour a la ligne : un texte trop long ne grandit plus en
              // hauteur, il sort par la droite. Un controle vertical seul ne
              // le verrait pas — deja paye une fois sur la carte de Bidul.
              for (const k of bd.children) {
                const e = k.getBoundingClientRect();
                if ((br.top + pad*MM) - e.top > 0.5) bd_debord++;
                else if (e.bottom - (br.bottom - pad*MM) > 0.5) bd_debord++;
                else if ((br.left + pad*MM) - e.left > 0.5) bd_debord++;
                else if (e.right - (br.right - pad*MM) > 0.5) bd_debord++;
              }
              // et la somme des largeurs ne doit pas exceder la boite
              {
                let somme = 0;
                for (const k of bd.children) somme += k.getBoundingClientRect().width;
                const dispo = br.width - 2*(5*MM) - 2*(4.5*MM);   // padding + gaps
                if (somme > dispo + 1) bd_debord++;
              }
              // et combien de lignes fait chaque texte du bandeau
              for (const sel of ['.bd-t', '.bd-p']) {
                const e = bd.querySelector(sel);
                if (!e) continue;
                const lh = parseFloat(getComputedStyle(e).lineHeight);
                bd_lignes.push({sel, n: Math.round(e.getBoundingClientRect().height/lh),
                                h: e.getBoundingClientRect().height/MM});
              }
              for (const c of cx) {
                let bas_col = 0;
                for (const k of c.children)
                  bas_col = Math.max(bas_col, k.getBoundingClientRect().bottom);
                if (bas_col > br.top + 0.5) sous_bandeau++;
                if (bas_col > 0) ecart_bd = Math.min(ecart_bd, (br.top - bas_col)/MM);
              }
            }
            return {page: i+1, hauteur: r.height/MM, colonnes: cx.length,
                    debord_bas: deb, pire, debord_droite: hors,
                    bandeau: !!bd, sous_bandeau, ecart_bd, bd_debord, bd_lignes,
                    dos: !!pg.querySelector('.ds-in')};
          });
        }""")
        await pg.pdf(path=sortie, format='A4', print_background=True,
                     margin={'top': '0', 'right': '0', 'bottom': '0', 'left': '0'})
        for i, s in enumerate(await pg.query_selector_all('.pg'), 1):
            await s.screenshot(path=f'page-{i}.png')
        html = await pg.content()
        await b.close()
    return mes, html

def sans(s):
    s = unicodedata.normalize('NFD', s)
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn')

if __name__ == '__main__':
    mes, html = asyncio.run(main(*sys.argv[1:]))
    txt = sans(re.sub(r'<[^>]+>', ' ', html))
    txt = re.sub(r'\s+', ' ', txt)

    ok = True
    print('CARTE LA PLAGE')
    n_bd = 0
    for m in mes:
        bon = (m['debord_bas'] == 0 and m['debord_droite'] == 0
               and abs(m['hauteur'] - 297) < 0.6 and m['colonnes'] in (0, 2)
               and m['sous_bandeau'] == 0 and m.get('bd_debord', 0) == 0
               and all(l['n'] == 1 for l in m.get('bd_lignes', [])))
        ok &= bon
        n_bd += 1 if m['bandeau'] else 0
        p = '  pire : %s a %.1f mm' % (m['pire']['t'], m['pire']['y']) if m['pire'] else ''
        b = ''
        if m['bandeau']:
            lg = '+'.join(str(l['n']) for l in m['bd_lignes'])
            b = '  bandeau TF : air %.1f mm, texte %s ligne(s)' % (m['ecart_bd'], lg)
            if m['sous_bandeau']: b += '  COLONNE SOUS LE BANDEAU'
            if m['bd_debord']:   b += '  TEXTE HORS DU BANDEAU (%d)' % m['bd_debord']
            if any(l['n'] != 1 for l in m['bd_lignes']): b += '  TEXTE SUR 2 LIGNES'
        elif m['dos']: b = '  dos de carte'
        elif m['page'] == 1: b = '  couverture'
        print('  page %d  %6.1f mm  %d col.  debord bas %d  debord droite %d%s%s   %s'
              % (m['page'], m['hauteur'], m['colonnes'], m['debord_bas'],
                 m['debord_droite'], b, p, 'CONFORME' if bon else 'NON CONFORME'))
    # Chaque page de carte porte son bandeau, et couverture + dos portent la marque.
    attendu = len(mes) - 2
    if n_bd != attendu:
        ok = False
        print('  BANDEAUX : %d sur %d pages de carte' % (n_bd, attendu))
    else:
        print('\n  Taxi Food : %d bandeaux + la couverture + le dos = %d occurrences sur %d pages'
              % (n_bd, n_bd + 2, len(mes)))

    manque = []
    for cle in ('ENTREES','GRILLADES','SANDWICHS','PLATS','DESSERTS'):
        for x in getattr(D, cle):
            if sans(x[0].split(' — ')[0]) not in txt: manque.append(x[0])
    for cle in ('FRAICHES','CHAUDES','BIERES','COCKTAILS','VIN','SPIRITUEUX'):
        for x in getattr(D, cle):
            if sans(x[0]) not in txt: manque.append(x[0])
    nb = sum(len(getattr(D, c)) for c in ('ENTREES','GRILLADES','SANDWICHS','PLATS','DESSERTS'))
    nbo = sum(len(getattr(D, c)) for c in ('FRAICHES','CHAUDES','BIERES','COCKTAILS','VIN','SPIRITUEUX'))
    print('\n  presence : %d plats + %d boissons = %d lignes attendues' % (nb, nbo, nb+nbo))
    if manque:
        ok = False
        print('  MANQUANTES (%d) : %s' % (len(manque), ' | '.join(manque[:8])))
    else:
        print('  toutes presentes dans le rendu')
    print('  pages : %d   ->  %s' % (len(mes), 'CONFORME' if ok else 'A CORRIGER'))
