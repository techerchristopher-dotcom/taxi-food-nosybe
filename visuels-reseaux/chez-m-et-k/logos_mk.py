# -*- coding: utf-8 -*-
"""Les deux propositions de logo de Chez M&K. Tout est construit, rien n'est genere.

REGLE 1 DE LA CHARTE : « Le modele ne dessine jamais de texte ni de logo. »
Les lettres sont donc des CONTOURS DE VRAIES FONTES (Poiret One, Gloock, Jura,
Work Sans — toutes OFL) et l'embleme est de la geometrie calculee. Aucun trait
n'est estime a l'oeil : chaque rayon, chaque opacite, chaque interlettrage est
un nombre de ce fichier.

PALETTE, MESUREE SUR SON PROPRE MATERIEL (mes_univers.py, mes_rouge.py) :
  or      #FDC567  le lettrage de son enseigne actuelle (top 1 % de luminance,
                   39 804 px). A 0,02 pres le meme contraste que l'or Taxi Food.
  braise  #0A0705  son noir (#040300) rechauffe de 6 points pour cesser d'etre un vide.
  laque   #981A02  les 10 861 pixels rouges LES PLUS SATURES de ses 28 plats
                   (85e percentile, teinte 9 deg, sat 99 %). La mediane
                   (#7C341F) donnait un aplat brun chocolat : elle decrit la
                   photo du laque sous une lumiere faible, pas le laque.
CONTRASTES : or/braise 12,8:1 - or/laque 6,2:1 - braise/rouge charte 4,74:1.
Un disque ROUGE etait exclu par la mesure : 2,1 a 2,5:1 sur le rouge charte.

TYPOGRAPHIE, CHOISIE PAR EPREUVE (spec.png, 20 fontes composant « CHEZ M&K ») :
Italiana etait le premier choix — son esperluette se compose « Mœ K » et la
disqualifie. Retenues : Poiret One (geometrique fine) pour A, Gloock (serif a
fort contraste) pour B.
"""
OR      = '#FDC567'
BRAISE  = '#0A0705'
LAQUE   = '#981A02'

F = ('/root/.claude/skills/synced/aec50b4c-a11d-4564-b082-ed985abd2a29'
     '_503dea82-df58-4607-a359-41492125f335/canvas-design/canvas-fonts')
FONTES = ''.join(f'@font-face{{font-family:{n};src:url("file://{F}/{f}.ttf");}}' for n, f in [
    ('PoiretOne','PoiretOne-Regular'), ('Gloock','Gloock-Regular'),
    ('Jura','Jura-Medium'), ('WorkSans','WorkSans-Regular')])

Ro, Rh, C = 470, 444, 500
MARGE_EXT = 16           # braise au-dela du filet or

def _filets(fond):
    """Le disque, avec UNE MARGE DE BRAISE AU-DELA DU FILET OR.

    Sans elle, le filet or etait le bord meme du disque. Pose sur la bande
    rouge de la charte, son contraste mesure avec ce qui se trouve derriere
    tombait a 1,09:1 : le disque n'avait plus de bord. Avec 16 px de braise
    autour, c'est la braise qui borde — 4,74:1 sur le rouge charte — et le
    filet or redevient un filet au lieu d'une arete."""
    return (f'<circle cx="{C}" cy="{C}" r="{Ro+MARGE_EXT}" fill="{fond}"/>'
            f'<circle cx="{C}" cy="{C}" r="{Ro}" fill="none" stroke="{OR}" stroke-width="7"/>'
            f'<circle cx="{C}" cy="{C}" r="{Rh}" fill="none" stroke="{OR}" '
            f'stroke-width="1.8" stroke-opacity="0.42"/>')

def _reperes(n, op, sw):
    """Les reperes d'axe. Ils ne decorent pas : ils donnent un Nord au disque,
    donc la possibilite de verifier un alignement. Quatre pour A (une boussole),
    quarante-huit pour B (l'empreinte crantee d'un sceau)."""
    import math
    t = []
    for i in range(n):
        a = -math.pi/2 + 2*math.pi*i/n
        t.append(f'<line x1="{C+math.cos(a)*452:.2f}" y1="{C+math.sin(a)*452:.2f}" '
                 f'x2="{C+math.cos(a)*464:.2f}" y2="{C+math.sin(a)*464:.2f}" stroke="{OR}" '
                 f'stroke-width="{sw}" stroke-opacity="{op}" stroke-linecap="round"/>')
    return ''.join(t)

def _rule(y, w, op=0.50, sw=1.6):
    return (f'<line x1="{C-w/2}" y1="{y}" x2="{C+w/2}" y2="{y}" stroke="{OR}" '
            f'stroke-width="{sw}" stroke-opacity="{op}" stroke-linecap="round"/>')


# =========================================================== A : L'ECUELLE
# 242 et non 268 de demi-assiette : a 268 le debord de part et d'autre du dome
# atteignait 82 px et l'ensemble se lisait « chapeau ». A 242 il tombe a 56 px
# et redevient une assiette. Neuf stries et non sept : a sept, les 53 px du
# sommet restaient un aplat d'or nu, et le calibrage se voyait s'arreter.
YP, RD, DEMI = 566, 186, 242     # ligne d'assiette, rayon du dome, demi-assiette
PAS, N_CH, INSET = 19, 9, 16     # pas des stries, nombre, retrait sur l'arc

def embleme_A():
    """Le bol renverse fumant — et, pour qui connait l'ile, le mont vu de la mer.

    LE JAUNE A ETE RETIRE, ET C'EST LA DECISION QUI A COUTE LE PLUS.
    Trois montages ont ete essayes : disque plein pose sur la couronne, disque
    cerne, disque decoupe EN creux dans la masse. Les trois se lisent « soleil
    sur une colline », parce qu'un cercle au-dessus d'un dome se lit toujours
    ainsi. Un oeuf au plat ne tient pas en deux tons sans son blanc, et son
    blanc est une forme irreguliere qu'un logo ne supporte pas.

    LA VAPEUR dit ce que le jaune devait dire, et mieux : une colline ne fume
    pas. Trois volutes suffisent — la lecture « plat chaud » est immediate,
    la lecture « ile » reste disponible dessous. C'est la double lecture voulue.

    Le dome est PLEIN et non trace : a 48 px un trace de 5 px disparait, une
    masse survit. Les sept stries sont CREUSEES dans l'or : de pres, le grain
    du riz moule ; de loin, elles se referment et il ne reste que la masse.
    C'est la bonne degradation, pas une perte."""
    import math
    p = [f'<path d="M {C-DEMI} {YP} Q {C} {YP+32} {C+DEMI} {YP}" fill="none" '
         f'stroke="{OR}" stroke-width="5" stroke-linecap="round"/>',
         f'<path d="M {C-RD} {YP} A {RD} {RD} 0 0 1 {C+RD} {YP} Z" fill="{OR}"/>']
    for k in range(1, N_CH+1):
        y = YP - PAS*k
        dx = math.sqrt(max(RD*RD - (YP-y)**2, 0)) - INSET
        if dx <= 6: continue
        p.append(f'<line x1="{C-dx:.1f}" y1="{y}" x2="{C+dx:.1f}" y2="{y}" stroke="{BRAISE}" '
                 f'stroke-width="2.6" stroke-linecap="round"/>')
    # Les volutes. Hauteurs 128 / 92 / 92 et non trois egales : trois traits de
    # meme longueur font un peigne, pas de la vapeur.
    for x, y0, h, op in ((C, YP-RD-14, 128, 0.95), (C-78, YP-RD+34, 92, 0.70),
                         (C+78, YP-RD+34, 92, 0.70)):
        p.append(f'<path d="M {x} {y0} C {x-24} {y0-h*0.32:.1f} {x+24} {y0-h*0.60:.1f} '
                 f'{x} {y0-h}" fill="none" stroke="{OR}" stroke-width="3.6" '
                 f'stroke-opacity="{op}" stroke-linecap="round"/>')
    return ''.join(p)


# ============================================================= B : LE SCEAU
SC, SY, SR = 372, 404, 10        # cote, centre vertical, arrondi (presque vif)

def embleme_B():
    """Le sceau. Un carre presque vif — arrondi de 10 sur 372, soit 2,7 % :
    assez pour n'etre pas coupant, trop peu pour devenir une icone d'application.
    Un arrondi de 44 avait ete essaye et refuse pour cette raison."""
    x, y, i = C-SC/2, SY-SC/2, 16
    return (f'<rect x="{x}" y="{y}" width="{SC}" height="{SC}" rx="{SR}" '
            f'fill="{LAQUE}" stroke="{OR}" stroke-width="6"/>'
            f'<rect x="{x+i}" y="{y+i}" width="{SC-2*i}" height="{SC-2*i}" rx="{SR*0.5}" '
            f'fill="none" stroke="{OR}" stroke-width="1.6" stroke-opacity="0.50"/>')


def page(corps, w=1000, h=1000):
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>
{FONTES}
html,body{{margin:0;padding:0;background:transparent;}}
.cv{{position:relative;width:{w}px;height:{h}px;}}
svg{{position:absolute;inset:0;}}
.tx{{position:absolute;left:0;width:{w}px;text-align:center;color:{OR};
     white-space:nowrap;-webkit-font-smoothing:antialiased;}}
</style></head><body><div class="cv">{corps}</div></body></html>'''


def sceau(v):
    """Le logo EST le disque : c'est lui la pastille de 180 px de la charte,
    donc le nom vit dedans, comme chez les trois autres partenaires."""
    if v == 'A':
        svg = _filets(BRAISE) + _reperes(4, 0.70, 2.6) + embleme_A() + _rule(742, 300)
        nom = ('<div class="tx" style="top:622px;font-family:PoiretOne;font-size:94px;'
               'letter-spacing:12px;text-indent:12px;line-height:1;">CHEZ M&amp;K</div>')
        sous_y, sous = 760, ('font-family:Jura;font-weight:500;font-size:27px;'
                             'letter-spacing:6.6px;text-indent:6.6px;opacity:0.80;')
    else:
        svg = _filets(BRAISE) + _reperes(48, 0.45, 2.0) + embleme_B() + _rule(736, 300)
        nom = ('<div class="tx" style="top:330px;font-family:Gloock;font-size:150px;'
               'line-height:1;letter-spacing:2px;">M<span style="font-size:86px;'
               'opacity:0.74;padding:0 7px;vertical-align:9px;">&amp;</span>K</div>'
               '<div class="tx" style="top:650px;font-family:Gloock;font-size:64px;'
               'letter-spacing:5px;text-indent:5px;line-height:1;">CHEZ M&amp;K</div>')
        sous_y, sous = 754, ('font-family:WorkSans;font-size:25px;letter-spacing:6.2px;'
                             'text-indent:6.2px;opacity:0.78;')
    return page(f'<svg width="1000" height="1000" viewBox="0 0 1000 1000">{svg}</svg>' + nom +
                f'<div class="tx" style="top:{sous_y}px;{sous}">RESTAURANT CHINOIS '
                f'&middot; NOSY BE</div>')


if __name__ == '__main__':
    for v in 'AB':
        open(f'/root/logos/mk/sceau-{v}.html', 'w').write(sceau(v))
    print('sceau-A.html sceau-B.html ecrits')
