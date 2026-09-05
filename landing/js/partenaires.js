/**
 * Restaurants partenaires, lus depuis Supabase.
 *
 * Cette liste etait ecrite EN DUR dans les trois index.html. C'est exactement
 * pour cela qu'elle etait devenue fausse : elle annoncait encore « La Cabane
 * confirme, Angelo et Taxi Be en negociation » alors qu'il y a desormais
 * plusieurs partenaires actifs, qu'Angelo a ete retire du catalogue et que
 * Les Siciliens arrive. Une page vitrine qui ment sur ses partenaires coute
 * plus cher qu'une page un peu moins riche.
 *
 * On lit donc la meme source que l'application : la table `restaurants`, en
 * lecture publique (la cle anon est publique par conception, la RLS protege).
 *
 * ⚠️ On respecte `listing_status` : `hidden` n'apparait nulle part, et
 * `coming_soon` s'affiche avec la mention « bientot ». Sans ce filtre, la
 * vitrine reafficherait un partenaire que l'app a justement retire.
 *
 * ⚠️ Degradation : si la requete echoue (reseau coupe, projet en pause), on
 * laisse le contenu de repli deja present dans le HTML plutot que d'afficher
 * une section vide. Une vitrine sans restaurants ferait douter de l'existence
 * du service.
 */
(function () {
  var URL_SB = 'https://bmdveawomizjpiebgtkj.supabase.co';
  var CLE = 'sb_publishable_PIgdG97zTlRIAYX_3MBm3A_Le6YUMjv';
  var COMMANDE = 'https://taxifood.distripro207.com';

  var hote = document.getElementById('partenaires');
  if (!hote) return;

  var T = {
    fr: { bientot: 'Bientôt disponible', actif: 'Déjà dans l’aventure ✅', voir: 'Voir la carte', livraison: 'Livraison' },
    en: { bientot: 'Coming soon', actif: 'Already on board ✅', voir: 'See the menu', livraison: 'Delivery' },
    it: { bientot: 'Presto disponibile', actif: 'Già a bordo ✅', voir: 'Vedi il menu', livraison: 'Consegna' },
  };
  var langue = (document.documentElement.lang || 'fr').slice(0, 2);
  var t = T[langue] || T.fr;

  function ariary(n) {
    return new Intl.NumberFormat('fr-FR').format(n).replace(/ | /g, ' ') + ' Ar';
  }
  function initiales(nom) {
    return nom.split(/\s+/).filter(Boolean).slice(0, 2).map(function (m) { return m[0]; }).join('').toUpperCase();
  }
  function echapper(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function carte(r, photos) {
    var bientot = r.listing_status === 'coming_soon';
    var logo = r.logo_url
      ? '<img src="' + echapper(r.logo_url) + '" alt="Logo ' + echapper(r.name) + '" width="56" height="56" loading="lazy" decoding="async" style="width:56px;height:56px;border-radius:15px;flex:none;object-fit:cover;background:#EAE5E0">'
      : '<div style="width:56px;height:56px;border-radius:15px;flex:none;background:#1A1A1A;color:#FFC72C;display:flex;align-items:center;justify-content:center;font:800 19px/1 Archivo,sans-serif">' + echapper(initiales(r.name)) + '</div>';

    var bande = photos.length
      ? '<div style="margin-top:16px;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent);mask-image:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)">'
        + '<div style="display:flex;gap:10px;width:max-content;animation:menuScroll 42s linear infinite">'
        + photos.concat(photos).map(function (p) {
            return '<img src="' + echapper(p.url) + '" alt="' + echapper(p.nom) + '" width="128" height="128" loading="lazy" decoding="async" style="width:128px;height:128px;border-radius:18px;object-fit:cover;background:#EAE5E0">';
          }).join('')
        + '</div></div>'
      : '';

    var pastille = bientot
      ? '<div style="display:inline-flex;align-self:flex-start;align-items:center;gap:6px;height:26px;padding:0 12px;border-radius:999px;background:#FFF4E0;color:#A75B09;font:700 11px/1 Archivo,sans-serif;letter-spacing:.04em">' + t.bientot + '</div>'
      : '<div style="display:inline-flex;align-self:flex-start;align-items:center;gap:6px;height:26px;padding:0 12px;border-radius:999px;background:#E7F6EC;color:#157F3C;font:700 11px/1 Archivo,sans-serif;letter-spacing:.04em">' + t.actif + '</div>';

    var lien = bientot ? '' :
      '<a href="' + COMMANDE + '/restaurant/' + echapper(r.id) + '" style="margin-top:14px;align-self:flex-start;height:40px;padding:0 18px;border-radius:999px;background:#1A1A1A;color:#fff;display:inline-flex;align-items:center;font:700 13px/1 Archivo,sans-serif;text-decoration:none">' + t.voir + '</a>';

    return '<div style="flex:1 1 300px;min-width:min(260px,100%);background:#fff;border-radius:20px;padding:22px;box-shadow:0 2px 8px rgba(26,26,26,.06);border:1px solid #E9E5E0;display:flex;flex-direction:column;gap:14px' + (bientot ? ';opacity:.72' : '') + '">'
      + '<div style="display:flex;align-items:center;gap:13px">' + logo
      + '<div style="min-width:0">'
      + '<div style="font:500 9px/1 \'JetBrains Mono\',monospace;letter-spacing:.18em;color:#6B6662">' + echapper((r.zone_served || 'Nosy Be').toUpperCase()) + '</div>'
      + '<div style="font:800 20px/1.15 Archivo,sans-serif;letter-spacing:-.02em;margin-top:5px">' + echapper(r.name) + '</div>'
      + '</div></div>'
      + pastille
      + '<p style="font:400 14px/1.55 Archivo,sans-serif;color:#4A4744;margin:0">' + echapper(r.cuisine_type || '') + ' · ' + t.livraison + ' ' + ariary(r.delivery_fee || 0) + '</p>'
      + bande + lien + '</div>';
  }

  function api(chemin) {
    return fetch(URL_SB + '/rest/v1/' + chemin, {
      headers: { apikey: CLE, Authorization: 'Bearer ' + CLE },
    }).then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); });
  }

  api('restaurants?listing_status=neq.hidden&select=id,name,cuisine_type,zone_served,logo_url,delivery_fee,listing_status&order=listing_status.asc,created_at.asc')
    .then(function (restos) {
      if (!restos.length) return;
      var ids = restos.map(function (r) { return r.id; }).join(',');
      return api('products?restaurant_id=in.(' + ids + ')&photo_url=not.is.null&is_available=eq.true&select=restaurant_id,name,photo_url&limit=300')
        .then(function (prods) {
          var par = {};
          prods.forEach(function (p) {
            (par[p.restaurant_id] = par[p.restaurant_id] || []).push({ url: p.photo_url, nom: p.name });
          });
          hote.innerHTML = restos.map(function (r) {
            return carte(r, (par[r.id] || []).slice(0, 8));
          }).join('');
        });
    })
    .catch(function (e) {
      // On garde le repli deja dans le HTML — voir l'en-tete de ce fichier.
      console.warn('[partenaires] lecture impossible, repli conserve', e);
    });
})();
