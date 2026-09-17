/**
 * Mesure d'audience de la vitrine ET des pages de partage (/j/, /r/, /s/, /p/).
 *
 * ── Ce qu'on veut savoir ─────────────────────────────────────────────────────
 * Est-ce que les gens regardent ce qu'on publie ? D'où viennent-ils (Facebook,
 * WhatsApp, Google) ? Combien cliquent « Télécharger », « Commander », WhatsApp ?
 *
 * ── Pourquoi Umami, et pourquoi sans cookie ──────────────────────────────────
 * Umami ne pose AUCUN cookie et ne garde aucune donnée personnelle : pas de
 * bandeau de consentement à imposer — donc pas de visiteurs européens qui
 * refusent et disparaissent des chiffres. Script de ~2 Ko : la liaison de Nosy Be
 * ne le sent pas. Décision du porteur du projet, 2026-09-17.
 *
 * ── Pourquoi UN fichier ──────────────────────────────────────────────────────
 * Douze pages HTML et la fonction de partage l'incluent. Les règles (quel clic
 * compte, comment on marque un lien de magasin) vivent ici, une fois : sinon
 * elles divergent d'une page à l'autre.
 *
 * ⚠️ CHARGÉ EN SYNCHRONE dans le <head>, avant tout autre script : les scripts
 * des pages appellent `window.tfMesure(...)` dès leur exécution (succès d'un
 * formulaire). Le tracker Umami, lui, est chargé en asynchrone : tant qu'il n'est
 * pas prêt, les événements attendent dans une file.
 *
 * ⚠️ INERTE tant que UMAMI_ID est vide, et hors du domaine de production : les
 * aperçus de déploiement Netlify et le poste de développement ne polluent pas les
 * chiffres. Le marquage des liens de magasins, lui, ne dépend que du domaine.
 */
(function () {
  // ── Réglages ───────────────────────────────────────────────────────────────
  // Identifiant du site dans Umami Cloud (compte techerchristopher@gmail.com). Public
  // par nature : il est écrit dans le HTML de toute page mesurée.
  // ⚠️ La vitrine SEULE. Le plan gratuit d'Umami n'accepte qu'un site par compte
  // (« Website limit reached », 2026-09-17) : l'app web a donc son propre compte et
  // son propre identifiant, dans app/public/index.html. Ne pas recopier celui-ci
  // là-bas, les deux audiences se mélangeraient.
  var UMAMI_ID = '8be3907d-295a-4b7f-ac06-c398d6a20c57';
  // Jeton fournisseur App Store Connect (« pt »), public lui aussi : App Analytics →
  // Sources → Campagnes. Sans lui, Apple ignore la campagne : on n'ajoute rien.
  var APP_STORE_PT = '';
  var HOTE_PRODUCTION = 'taxifoodnosybe.distripro207.com';

  var APP_STORE_ID = 'id6802418114';
  var PLAY_ID = 'com.chris97416.taxifoodnosybe';
  var APP_WEB = 'taxifood.distripro207.com';

  var enProduction = location.hostname === HOTE_PRODUCTION;

  // ── « Ne pas me compter » ──────────────────────────────────────────────────
  // Le porteur du projet visite son propre site sans arrêt : sans ceci, ses
  // passages gonflent les chiffres qu'il cherche justement à lire. Ouvrir UNE fois
  // `/?ne-pas-me-compter` sur un appareil l'exclut pour toujours ; `/?me-compter`
  // annule. Le réglage `umami.disabled` est celui que le tracker Umami lit lui-même
  // avant chaque envoi (vérifié dans son script le 2026-09-17).
  //
  // ⚠️ Propre à CHAQUE site : la mémoire du navigateur est rangée par domaine. Il
  // faut l'ouvrir aussi sur l'app web, qui gère la même adresse de son côté.
  var exclu = false;
  var q = new URLSearchParams(location.search);
  var demande = q.has('ne-pas-me-compter') ? 'exclure' : q.has('me-compter') ? 'inclure' : null;
  var stockageOk = true;
  try {
    if (demande === 'exclure') localStorage.setItem('umami.disabled', '1');
    if (demande === 'inclure') localStorage.removeItem('umami.disabled');
    exclu = !!localStorage.getItem('umami.disabled');
  } catch (e) {
    // Navigation privée, stockage bloqué : le réglage ne peut pas tenir, et on le DIT.
    stockageOk = false;
  }
  if (demande) {
    // L'adresse est nettoyée : partagée par erreur, elle ne ferait sortir personne
    // d'autre des statistiques.
    q.delete('ne-pas-me-compter');
    q.delete('me-compter');
    var reste = q.toString();
    try { history.replaceState(null, '', location.pathname + (reste ? '?' + reste : '') + location.hash); } catch (e) {}
    // ⚠️ Le bandeau s'affiche DANS TOUS LES CAS, échec compris. La première version
    // n'affichait rien quand le stockage était bloqué : « aucun bandeau », sans
    // qu'on sache pourquoi. Il reste affiché jusqu'à un appui.
    (function (message) {
        var montrer = function () {
          var b = document.createElement('div');
          b.textContent = message + '  ✕';
          b.setAttribute('role', 'status');
          b.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;'
            + 'background:#1A1A1A;color:#fff;font:600 15px/1.4 system-ui,-apple-system,sans-serif;cursor:pointer;'
            + 'padding:14px 20px;border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.3);max-width:90vw;text-align:center';
          b.onclick = function () { b.remove(); };
          document.body.appendChild(b);
          // Permanent jusqu'à un appui : demande du porteur du projet, qui ne le voyait
          // pas passer en 5 s.
        };
        if (document.body) montrer(); else document.addEventListener('DOMContentLoaded', montrer);
      })(
      !stockageOk ? 'Réglage impossible : ce navigateur bloque le stockage (navigation privée ?).'
        : exclu ? 'Cet appareil n’est plus compté dans les statistiques.'
        : 'Cet appareil est de nouveau compté dans les statistiques.');
  }

  // ── Où sommes-nous ─────────────────────────────────────────────────────────
  var m = location.pathname.match(/^\/(j|r|s|p)\//);
  // « partage » = une page ouverte depuis un lien publié ; « vitrine » = le site.
  var surface = m ? 'partage' : 'vitrine';
  var typePartage = m ? m[1] : null;
  var page = (function () {
    if (m) return 'partage-' + m[1];
    var seg = location.pathname.split('/').filter(Boolean);
    if (!seg.length) return 'accueil';
    if ((seg[0] === 'en' || seg[0] === 'it') && seg.length === 1) return 'accueil-' + seg[0];
    return seg.join('-');
  })();

  // ── File d'attente et envoi ────────────────────────────────────────────────
  var file = [];
  function envoyer(nom, donnees) {
    try { window.umami.track(nom, donnees); } catch (e) { /* une mesure ne casse jamais la page */ }
  }
  window.tfMesure = function (nom, donnees) {
    if (!enProduction || !UMAMI_ID || exclu) return;
    var d = { surface: surface, page: page };
    for (var k in donnees || {}) d[k] = donnees[k];
    if (window.umami && typeof window.umami.track === 'function') envoyer(nom, d);
    else file.push([nom, d]);
  };

  // ── Liens de magasins marqués ──────────────────────────────────────────────
  // C'est ce qui relie un TÉLÉCHARGEMENT à la page qui l'a provoqué : Apple et
  // Google le rapportent dans leurs propres consoles (App Analytics → Campagnes,
  // Play Console → Acquisition). Le site seul ne voit que le clic, jamais
  // l'installation.
  function campagne() {
    // « vitrine-accueil », « partage-j » : la page d'un partage porte déjà son
    // préfixe. 40 caractères au plus côté Apple.
    return (page.indexOf(surface) === 0 ? page : surface + '-' + page).slice(0, 40);
  }
  function lienMagasin(url) {
    var u = String(url || '');
    if (!enProduction) return u;
    if (u.indexOf('play.google.com') !== -1 && u.indexOf(PLAY_ID) !== -1 && u.indexOf('referrer=') === -1) {
      var ref = 'utm_source=taxifood-site&utm_medium=' + surface + '&utm_campaign=' + campagne();
      return u + (u.indexOf('?') === -1 ? '?' : '&') + 'referrer=' + encodeURIComponent(ref);
    }
    if (u.indexOf('apps.apple.com') !== -1 && u.indexOf(APP_STORE_ID) !== -1 && APP_STORE_PT && u.indexOf('pt=') === -1) {
      return 'https://apps.apple.com/app/apple-store/' + APP_STORE_ID
        + '?pt=' + encodeURIComponent(APP_STORE_PT) + '&ct=' + encodeURIComponent(campagne()) + '&mt=8';
    }
    return u;
  }
  window.tfLienMagasin = lienMagasin;

  // ── Les clics qui comptent ─────────────────────────────────────────────────
  // Délégation en phase de CAPTURE : elle voit aussi les liens créés après coup
  // (cartes des partenaires, boutons de la page de partage), et elle réécrit le
  // lien du magasin AVANT que le navigateur ne le suive.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';

    if (href.indexOf(APP_STORE_ID) !== -1 || href.indexOf(PLAY_ID) !== -1) {
      a.setAttribute('href', lienMagasin(href));
      window.tfMesure('telecharger', { magasin: href.indexOf(PLAY_ID) !== -1 ? 'google-play' : 'app-store' });
    } else if (href.indexOf(APP_WEB) !== -1) {
      // « Commander », « Voir la carte », « Mon espace » : le passage vers l'app web.
      var cible = href.split(APP_WEB)[1] || '/';
      window.tfMesure('vers-app', { cible: cible.split('/')[1] || 'accueil', type: typePartage || '' });
    } else if (href.indexOf('wa.me/') !== -1) {
      window.tfMesure('contact-whatsapp');
    } else if (href.indexOf('tel:') === 0) {
      window.tfMesure('appel');
    } else if (/facebook\.com|instagram\.com|tiktok\.com/.test(href)) {
      window.tfMesure('reseau-social', { reseau: (href.match(/(facebook|instagram|tiktok)/) || [])[1] });
    }
  }, true);

  // ── Chargement du tracker ──────────────────────────────────────────────────
  // Appareil exclu : on ne charge même pas le tracker.
  if (!enProduction || !UMAMI_ID || exclu) return;

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://cloud.umami.is/script.js';
  s.setAttribute('data-website-id', UMAMI_ID);
  // Double garde : même copié ailleurs, le tracker ne compte que le vrai domaine.
  s.setAttribute('data-domains', HOTE_PRODUCTION);
  s.onload = function () {
    var f = file; file = [];
    for (var i = 0; i < f.length; i++) envoyer(f[i][0], f[i][1]);
  };
  document.head.appendChild(s);

  // Une page de partage ouverte = quelqu'un a cliqué sur ce qu'on a publié. La vue
  // de page est déjà comptée ; cet événement la rend filtrable par TYPE de partage
  // (plats du jour, restaurant, sélection, plat), avec le titre de ce qui était
  // partagé. La provenance (Facebook, WhatsApp) vient du référent et des utm.
  if (typePartage) {
    window.tfMesure('partage-ouvert', { type: typePartage, titre: document.title.replace(/ — Taxi Food$/, '') });
  }
})();
