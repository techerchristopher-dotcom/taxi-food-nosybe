/**
 * Etat « chargement » sur les boutons qui quittent la page.
 *
 * Pourquoi : « Commander maintenant » ouvre l'application web, dont le premier
 * chargement prend plusieurs secondes. Sans retour visuel, la personne clique,
 * il ne se passe rien de visible, elle reclique — voire abandonne. Le bouton
 * n'a pas besoin d'aller plus vite, il a besoin de DIRE qu'il travaille.
 *
 * ⚠️ On ne bloque jamais la navigation : le lien part normalement, on ne fait
 * qu'habiller le bouton. Un `preventDefault` casserait l'ouverture dans un
 * nouvel onglet, le clic du milieu et le menu contextuel.
 *
 * ⚠️ On ignore les clics avec touche de modification (Cmd, Ctrl, Maj) et le
 * clic du milieu : ils ouvrent un onglet en arriere-plan, la page courante ne
 * bouge pas, et laisser un bouton en « chargement » eternel serait pire que
 * rien.
 *
 * Au retour par le bouton Precedent, le navigateur peut restaurer la page
 * telle quelle (bfcache) : `pageshow` remet donc les boutons a l'etat normal.
 */
(function () {
  var MOTS = { fr: 'Chargement…', en: 'Loading…', it: 'Caricamento…' };
  var mot = MOTS[(document.documentElement.lang || 'fr').slice(0, 2)] || MOTS.fr;
  var enCours = [];

  var css = document.createElement('style');
  css.textContent =
    '@keyframes tf-spin{to{transform:rotate(360deg)}}'
    + '.tf-load{position:relative;pointer-events:none;opacity:.82}'
    + '.tf-load>*{visibility:hidden}'
    + '.tf-load::after{content:attr(data-load);visibility:visible;position:absolute;inset:0;'
    + 'display:flex;align-items:center;justify-content:center;gap:9px;font:inherit;color:inherit}'
    + '.tf-load::before{content:"";visibility:visible;position:absolute;top:50%;left:50%;'
    + 'transform:translate(-50%,-50%) translateX(-4.6em);width:15px;height:15px;border-radius:999px;'
    + 'border:2px solid currentColor;border-top-color:transparent;animation:tf-spin .7s linear infinite}'
    + '@media (prefers-reduced-motion:reduce){.tf-load::before{animation-duration:2.4s}}';
  document.head.appendChild(css);

  function externe(a) {
    try { return new URL(a.href, location.href).origin !== location.origin; }
    catch (e) { return false; }
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (a.target === '_blank') return;          // s'ouvre ailleurs, la page reste
    var h = a.getAttribute('href') || '';
    if (h.charAt(0) === '#' || h.indexOf('mailto:') === 0 || h.indexOf('tel:') === 0) return;
    if (!externe(a) && h.indexOf('http') !== 0) {
      // Navigation interne : quasi instantanee, l'indicateur clignoterait.
      if (h.indexOf('/') !== 0) return;
    }
    if (a.classList.contains('tf-load')) return;
    a.setAttribute('data-load', mot);
    a.classList.add('tf-load');
    enCours.push(a);
  }, true);

  window.addEventListener('pageshow', function () {
    enCours.forEach(function (a) { a.classList.remove('tf-load'); a.removeAttribute('data-load'); });
    enCours = [];
  });
})();
