/**
 * Restaurants partenaires et visuels, lus depuis Supabase.
 *
 * Cette liste etait ecrite EN DUR dans les trois index.html, et c'est
 * exactement pour cela qu'elle etait FAUSSE : elle annoncait encore « La Cabane
 * confirme, Angelo et Taxi Be en negociation ». Une vitrine qui ment sur ses
 * partenaires coute plus cher qu'une vitrine moins riche.
 *
 * ⚠️ `listing_status` est respecte : `hidden` n'apparait nulle part,
 * `coming_soon` s'affiche grise. Sans ce filtre la vitrine reafficherait un
 * partenaire que l'application a justement retire.
 *
 * ⚠️ AUCUNE BOISSON. Demande explicite du porteur du projet : la vitrine ne
 * montre que ce qui se mange. Une biere ou un soda en photo ne donne envie de
 * rien et occupe la place d'un plat.
 *
 * ⚠️ Degradation : si la requete echoue, on laisse le contenu de repli deja
 * present dans le HTML. Une section vide ferait douter de l'existence du
 * service.
 */
(function () {
  var URL_SB = 'https://bmdveawomizjpiebgtkj.supabase.co';
  var CLE = 'sb_publishable_PIgdG97zTlRIAYX_3MBm3A_Le6YUMjv';
  var COMMANDE = 'https://taxifood.distripro207.com';
  var PAR_RESTO = 20;

  /**
   * Categories exclues des visuels.
   *
   * Bieres, sodas et cocktails uniquement : une bouteille en photo ne donne
   * envie de rien et prend la place d'un plat. Les MILKSHAKES restent — decision
   * du porteur du projet, et elle se defend : un milkshake se photographie
   * comme un dessert, pas comme une boisson.
   */
  var BOISSONS = ['bières', 'bieres', 'softs', 'cocktails', 'boissons', 'drinks', 'sodas'];

  var hote = document.getElementById('partenaires');
  if (!hote) return;

  var T = {
    fr: { bientot: 'Bientôt disponible', actif: 'Déjà dans l’aventure ✅', voir: 'Voir la carte',
          livraison: 'Livraison', plats: 'plats en photo', fermer: 'Fermer', prec: 'Précédent', suiv: 'Suivant' },
    en: { bientot: 'Coming soon', actif: 'Already on board ✅', voir: 'See the menu',
          livraison: 'Delivery', plats: 'dishes in pictures', fermer: 'Close', prec: 'Previous', suiv: 'Next' },
    it: { bientot: 'Presto disponibile', actif: 'Già a bordo ✅', voir: 'Vedi il menu',
          livraison: 'Consegna', plats: 'piatti in foto', fermer: 'Chiudi', prec: 'Precedente', suiv: 'Successivo' },
  };
  var t = T[(document.documentElement.lang || 'fr').slice(0, 2)] || T.fr;

  function ariary(n) { return new Intl.NumberFormat('fr-FR').format(n).replace(/ | /g, ' ') + ' Ar'; }
  function initiales(n) { return n.split(/\s+/).filter(Boolean).slice(0, 2).map(function (m) { return m[0]; }).join('').toUpperCase(); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /**
   * Redimensionnement a la volee par Supabase.
   *
   * ⚠️ Sans cela, la page servait les PNG D'ORIGINE : 1,9 Mo par plat, et
   * jusqu'a une centaine d'images sur l'accueil. Les cases restaient grises
   * plusieurs secondes — signale par le porteur du projet, et c'etait bien plus
   * grave qu'un defaut d'affichage : personne n'attend un carrousel qui charge.
   *
   * `render/image` sert la meme image redimensionnee et compressee : la meme
   * pizza passe de 1 918 092 a 16 072 octets a 256 px de large. Facteur 120.
   *
   * `resize=cover` garde le cadrage carre ; le navigateur recoit du WebP quand
   * il l'accepte, sans qu'on ait a le demander.
   */
  function visuel(url, largeur) {
    if (!url) return url;
    var m = '/storage/v1/object/public/';
    var i = url.indexOf(m);
    if (i < 0) return url;
    // x2 pour les ecrans a haute densite ; au-dela l'oeil ne voit plus la
    // difference et le poids repart a la hausse.
    var w = largeur * 2;
    return url.slice(0, i) + '/storage/v1/render/image/public/' + url.slice(i + m.length)
      + '?width=' + w + '&height=' + w + '&resize=cover&quality=60';
  }

  function api(chemin) {
    return fetch(URL_SB + '/rest/v1/' + chemin, { headers: { apikey: CLE, Authorization: 'Bearer ' + CLE } })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); });
  }

  // ---------------------------------------------------------------- Visionneuse
  /**
   * Agrandissement au clic, avec defilement.
   *
   * Construite une seule fois et reutilisee : creer l'overlay a chaque
   * ouverture ferait clignoter la page et perdrait le focus clavier.
   * Fermeture au clic hors image, a la croix, et a Echap ; navigation aux
   * fleches — sans cela l'agrandissement serait un cul-de-sac au clavier.
   */
  var vue = { liste: [], i: 0, el: null, img: null, leg: null };
  function construireVue() {
    if (vue.el) return;
    var o = document.createElement('div');
    o.setAttribute('role', 'dialog');
    o.setAttribute('aria-modal', 'true');
    o.style.cssText = 'position:fixed;inset:0;z-index:100;background:rgba(10,10,11,.93);display:none;align-items:center;justify-content:center;padding:16px';
    o.innerHTML =
      '<button type="button" data-a="x" aria-label="' + t.fermer + '" style="position:absolute;top:14px;right:14px;width:44px;height:44px;border-radius:999px;border:0;background:rgba(255,255,255,.14);color:#fff;font:700 20px/1 Archivo,sans-serif;cursor:pointer">✕</button>'
      + '<button type="button" data-a="p" aria-label="' + t.prec + '" style="position:absolute;left:10px;width:48px;height:48px;border-radius:999px;border:0;background:rgba(255,255,255,.14);color:#fff;font:700 22px/1 Archivo,sans-serif;cursor:pointer">‹</button>'
      + '<button type="button" data-a="s" aria-label="' + t.suiv + '" style="position:absolute;right:10px;width:48px;height:48px;border-radius:999px;border:0;background:rgba(255,255,255,.14);color:#fff;font:700 22px/1 Archivo,sans-serif;cursor:pointer">›</button>'
      + '<figure style="margin:0;max-width:min(92vw,560px);display:flex;flex-direction:column;gap:14px;align-items:center">'
      + '<img alt="" style="max-width:100%;max-height:72vh;border-radius:22px;object-fit:contain;background:#1A1A1A">'
      + '<figcaption style="color:#fff;font:700 16px/1.3 Archivo,sans-serif;text-align:center"></figcaption>'
      + '</figure>';
    document.body.appendChild(o);
    vue.el = o;
    vue.img = o.querySelector('img');
    vue.leg = o.querySelector('figcaption');
    o.addEventListener('click', function (e) {
      var a = e.target.getAttribute && e.target.getAttribute('data-a');
      if (a === 'x' || e.target === o) fermer();
      else if (a === 'p') aller(-1);
      else if (a === 's') aller(1);
    });
    document.addEventListener('keydown', function (e) {
      if (o.style.display === 'none') return;
      if (e.key === 'Escape') fermer();
      if (e.key === 'ArrowLeft') aller(-1);
      if (e.key === 'ArrowRight') aller(1);
    });
  }
  function peindre() {
    var p = vue.liste[vue.i];
    if (!p) return;
    vue.img.src = visuel(p.url, 720);
    vue.img.alt = p.nom;
    vue.leg.textContent = p.nom + (p.resto ? ' — ' + p.resto : '') + '  ·  ' + (vue.i + 1) + '/' + vue.liste.length;
  }
  function aller(d) { vue.i = (vue.i + d + vue.liste.length) % vue.liste.length; peindre(); }
  function fermer() { vue.el.style.display = 'none'; document.body.style.overflow = ''; }
  function ouvrir(liste, i) {
    construireVue();
    vue.liste = liste; vue.i = i;
    vue.el.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    peindre();
  }

  // ------------------------------------------------------------------- Rendu
  function bande(photos, id) {
    if (!photos.length) return '';
    // Dupliquee pour que la boucle du defilement soit invisible (-50 %).
    return '<div style="margin-top:16px;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent);mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)">'
      + '<div class="defile" data-galerie="' + id + '" style="display:flex;gap:10px;width:max-content;animation:menuScroll ' + (34 + photos.length) + 's linear infinite">'
      + photos.concat(photos).map(function (p, k) {
          return '<button type="button" data-i="' + (k % photos.length) + '" title="' + esc(p.nom) + '" '
            + 'style="border:0;padding:0;background:none;cursor:zoom-in;flex:none;line-height:0;border-radius:18px;overflow:hidden">'
            + '<img src="' + esc(visuel(p.url, 128)) + '" alt="' + esc(p.nom) + '" loading="lazy" decoding="async" '
            + 'style="width:128px;height:128px;object-fit:cover;background:#EAE5E0;display:block"></button>';
        }).join('')
      + '</div></div>';
  }

  function carte(r, photos, idx) {
    var bientot = r.listing_status === 'coming_soon';
    var logo = r.logo_url
      ? '<img src="' + esc(visuel(r.logo_url, 56)) + '" alt="Logo ' + esc(r.name) + '" width="56" height="56" loading="lazy" decoding="async" style="width:56px;height:56px;border-radius:15px;flex:none;object-fit:cover;background:#EAE5E0">'
      : '<div style="width:56px;height:56px;border-radius:15px;flex:none;background:#1A1A1A;color:#FFC72C;display:flex;align-items:center;justify-content:center;font:800 19px/1 Archivo,sans-serif">' + esc(initiales(r.name)) + '</div>';
    var pastille = bientot
      ? '<div style="display:inline-flex;align-self:flex-start;align-items:center;height:26px;padding:0 12px;border-radius:999px;background:#FFF4E0;color:#A75B09;font:700 11px/1 Archivo,sans-serif">' + t.bientot + '</div>'
      : '<div style="display:inline-flex;align-self:flex-start;align-items:center;height:26px;padding:0 12px;border-radius:999px;background:#E7F6EC;color:#157F3C;font:700 11px/1 Archivo,sans-serif">' + t.actif + '</div>';
    var lien = bientot ? '' :
      '<a href="' + COMMANDE + '/restaurant/' + esc(r.id) + '" style="margin-top:14px;align-self:flex-start;height:40px;padding:0 18px;border-radius:999px;background:#1A1A1A;color:#fff;display:inline-flex;align-items:center;font:700 13px/1 Archivo,sans-serif;text-decoration:none">' + t.voir + '</a>';

    return '<div style="flex:1 1 320px;min-width:min(280px,100%);background:#fff;border-radius:20px;padding:22px;box-shadow:0 2px 8px rgba(26,26,26,.06);border:1px solid #E9E5E0;display:flex;flex-direction:column;gap:14px' + (bientot ? ';opacity:.78' : '') + '">'
      + '<div style="display:flex;align-items:center;gap:13px">' + logo
      + '<div style="min-width:0">'
      + '<div style="font:500 9px/1 \'JetBrains Mono\',monospace;letter-spacing:.18em;color:#6B6662">' + esc((r.zone_served || 'Nosy Be').toUpperCase()) + '</div>'
      + '<div style="font:800 20px/1.15 Archivo,sans-serif;letter-spacing:-.02em;margin-top:5px">' + esc(r.name) + '</div>'
      + '</div></div>'
      + pastille
      + '<p style="font:400 14px/1.55 Archivo,sans-serif;color:#4A4744;margin:0">' + esc(r.cuisine_type || '') + ' · ' + t.livraison + ' ' + ariary(r.delivery_fee || 0)
      + (photos.length ? ' · <strong>' + photos.length + '</strong> ' + t.plats : '') + '</p>'
      + bande(photos, idx) + lien + '</div>';
  }

  // ------------------------------------------------------------- Grand bandeau
  function carrousel(photos) {
    var h = document.getElementById('carrousel');
    if (!h || photos.length < 6) return;
    var a = photos.filter(function (_, i) { return i % 2 === 0; });
    var b = photos.filter(function (_, i) { return i % 2 === 1; });
    function rangee(liste, inv, cle) {
      var items = liste.slice(0, 16);
      if (!items.length) return '';
      return '<div style="overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 4%,#000 96%,transparent);mask-image:linear-gradient(90deg,transparent,#000 4%,#000 96%,transparent)">'
        + '<div class="defile" data-galerie="' + cle + '" style="display:flex;gap:12px;width:max-content;animation:menuScroll ' + (inv ? '74s' : '60s') + ' linear infinite' + (inv ? ' reverse' : '') + '">'
        + items.concat(items).map(function (p, k) {
            return '<button type="button" data-i="' + (k % items.length) + '" style="border:0;padding:0;background:none;cursor:zoom-in;flex:none;line-height:0;position:relative;border-radius:20px;overflow:hidden">'
              + '<img src="' + esc(visuel(p.url, 176)) + '" alt="' + esc(p.nom) + '" loading="lazy" decoding="async" style="width:176px;height:176px;object-fit:cover;background:#EAE5E0;display:block">'
              + '<span style="position:absolute;left:0;right:0;bottom:0;padding:22px 12px 10px;background:linear-gradient(transparent,rgba(0,0,0,.72));color:#fff;font:700 12px/1.25 Archivo,sans-serif;text-align:left;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(p.nom) + '</span>'
              + '</button>';
          }).join('')
        + '</div></div>';
    }
    galeries['tousA'] = a.slice(0, 16);
    galeries['tousB'] = b.slice(0, 16);
    h.innerHTML = rangee(a, false, 'tousA') + '<div style="height:12px"></div>' + rangee(b, true, 'tousB');
  }

  var galeries = {};

  // Un seul ecouteur pour toutes les vignettes, poses une fois : reattacher un
  // ecouteur par image (il y en a plusieurs centaines, dupliquees) serait
  // inutilement lourd.
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button[data-i]');
    if (!b) return;
    var p = b.closest('[data-galerie]');
    if (!p) return;
    var g = galeries[p.getAttribute('data-galerie')];
    if (g && g.length) ouvrir(g, parseInt(b.getAttribute('data-i'), 10) || 0);
  });

  api('restaurants?listing_status=neq.hidden&select=id,name,cuisine_type,zone_served,logo_url,delivery_fee,listing_status&order=listing_status.asc,created_at.asc')
    .then(function (restos) {
      if (!restos.length) return;
      var ids = restos.map(function (r) { return r.id; }).join(',');
      return Promise.all([
        api('categories?restaurant_id=in.(' + ids + ')&select=id,name'),
        api('products?restaurant_id=in.(' + ids + ')&photo_url=not.is.null&is_available=eq.true&select=restaurant_id,category_id,name,photo_url&limit=500'),
      ]).then(function (res) {
        var catNom = {};
        res[0].forEach(function (c) { catNom[c.id] = (c.name || '').toLowerCase(); });
        var nomResto = {};
        restos.forEach(function (r) { nomResto[r.id] = r.name; });

        var par = {};
        res[1].forEach(function (p) {
          if (BOISSONS.indexOf(catNom[p.category_id] || '') !== -1) return; // pas de boissons
          (par[p.restaurant_id] = par[p.restaurant_id] || [])
            .push({ url: p.photo_url, nom: p.name, resto: nomResto[p.restaurant_id] });
        });

        hote.innerHTML = restos.map(function (r, i) {
          var photos = (par[r.id] || []).slice(0, PAR_RESTO);
          galeries['r' + i] = photos;
          return carte(r, photos, 'r' + i);
        }).join('');

        // Grand bandeau : restaurants entrelaces, pour ne pas aligner vingt
        // pizzas du meme etablissement.
        var files = restos.map(function (r) { return (par[r.id] || []).slice(); });
        var melange = [];
        for (var i = 0; melange.length < 48; i++) {
          var reste = false;
          for (var k = 0; k < files.length; k++) {
            if (files[k][i]) { melange.push(files[k][i]); reste = true; }
          }
          if (!reste) break;
        }
        carrousel(melange);
      });
    })
    .catch(function (e) { console.warn('[partenaires] lecture impossible, repli conserve', e); });
})();
