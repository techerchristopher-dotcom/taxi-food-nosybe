/**
 * 📢 Bandeau d'annonce de la vitrine (2026-10-03) — le MÊME que celui de l'app.
 *
 * Écrit dans l'admin (onglet 📢 Bandeau), lu ici par la RPC publique
 * `bandeau_actif(p_langue)`, qui renvoie le bandeau du moment déjà traduit dans
 * la langue de la page (`<html lang>`), ou rien. Jamais de texte en dur : changer
 * ou retirer l'annonce ne demande aucun redéploiement du site.
 *
 * ⚠️ La date de fin est tenue par la base : passé `fin`, la RPC ne renvoie plus
 * rien et le bandeau n'est tout simplement pas inséré.
 *
 * Fermable : la croix retient la `version` (localStorage). Un bandeau réécrit
 * dans l'admin change de version et réapparaît.
 *
 * Dégradation : base injoignable ou stockage bloqué → pas de bandeau, la page
 * reste entière. Rien n'est réservé dans la mise en page avant la réponse.
 */
(function () {
  var URL_SB = 'https://bmdveawomizjpiebgtkj.supabase.co';
  var CLE = 'sb_publishable_PIgdG97zTlRIAYX_3MBm3A_Le6YUMjv';
  var COMMANDE = 'https://taxifood.distripro207.com';
  var STOCKAGE = 'bandeau_ferme';

  var langue = (document.documentElement.lang || 'fr').slice(0, 2);
  if (langue !== 'en' && langue !== 'it') langue = 'fr';
  var T = {
    fr: { voir: 'Commander', fermer: 'Fermer l’annonce' },
    en: { voir: 'Order now', fermer: 'Close the announcement' },
    it: { voir: 'Ordina', fermer: 'Chiudi l’annuncio' },
  }[langue];

  // « 2 000 Ar » ne se coupe jamais entre ses chiffres.
  function insecable(t) { return String(t || '').replace(/(\d) (?=\d{3}\b)/g, '$1\u00A0'); }

  function lireFerme() {
    try { return localStorage.getItem(STOCKAGE); } catch (e) { return null; }
  }
  function ecrireFerme(v) {
    try { localStorage.setItem(STOCKAGE, v); } catch (e) { /* tant pis : fermé pour cette visite */ }
  }

  fetch(URL_SB + '/rest/v1/rpc/bandeau_actif', {
    method: 'POST',
    headers: { apikey: CLE, Authorization: 'Bearer ' + CLE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_langue: langue }),
  })
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (lignes) {
      var b = lignes && lignes[0];
      if (!b || lireFerme() === b.version) return;
      var header = document.querySelector('header');
      if (!header || !header.parentNode) return;

      var barre = document.createElement('div');
      barre.setAttribute('role', 'region');
      barre.setAttribute('aria-label', b.titre);
      barre.style.cssText = 'background:linear-gradient(100deg,#1A1A1A,#3A2A22);color:#fff;border-bottom:3px solid #FFC72C';

      var dedans = document.createElement('div');
      dedans.style.cssText = 'max-width:1120px;margin:0 auto;padding:10px clamp(18px,4vw,40px);display:flex;align-items:center;gap:10px';

      var mots = document.createElement('div');
      mots.style.cssText = 'flex:1 1 0;min-width:0;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px';
      var titre = document.createElement('strong');
      titre.textContent = insecable(b.titre);
      titre.style.cssText = "font:800 15px/1.3 Archivo,sans-serif";
      mots.appendChild(titre);
      if (b.texte) {
        var texte = document.createElement('span');
        texte.textContent = insecable(b.texte);
        texte.style.cssText = 'font:400 13.5px/1.4 Inter,system-ui,sans-serif;color:rgba(255,255,255,.85)';
        mots.appendChild(texte);
      }
      dedans.appendChild(mots);

      var lien = document.createElement('a');
      lien.href = COMMANDE + (b.route && b.route !== '/' ? b.route : '/');
      lien.textContent = T.voir + ' →';
      lien.style.cssText = "flex:none;display:inline-flex;align-items:center;height:32px;padding:0 14px;border-radius:999px;background:#FFC72C;color:#1A1A1A;font:800 13px/1 Archivo,sans-serif;text-decoration:none";
      dedans.appendChild(lien);

      var croix = document.createElement('button');
      croix.type = 'button';
      croix.setAttribute('aria-label', T.fermer);
      croix.textContent = '✕';
      croix.style.cssText = 'flex:none;width:32px;height:32px;border:0;border-radius:999px;background:transparent;color:rgba(255,255,255,.75);font-size:16px;cursor:pointer';
      croix.addEventListener('click', function () {
        ecrireFerme(b.version);
        barre.remove();
      });
      dedans.appendChild(croix);

      barre.appendChild(dedans);
      header.parentNode.insertBefore(barre, header);
    })
    .catch(function () { /* pas de bandeau, page entière */ });
})();
