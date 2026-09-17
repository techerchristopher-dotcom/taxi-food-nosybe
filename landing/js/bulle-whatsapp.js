/**
 * Bulle WhatsApp flottante de la vitrine et des pages de partage.
 *
 * Demande du porteur du projet (2026-09-17), « comme sur le site Rentanoo » : un visiteur
 * écrit à Taxi Food en un tap. Même numéro et même message que la bulle de l'app
 * (`app/components/BulleWhatsApp.tsx`) — les changer ici, c'est les changer là-bas aussi.
 *
 * ⚠️ `wa.me` et pas `whatsapp://` : il ouvre l'application si elle est installée,
 * WhatsApp Web sinon. Le clic est compté par `mesure.js` (`contact-whatsapp`), qui voit
 * tout lien `wa.me/` : rien à ajouter ici.
 *
 * ⚠️ Pas incluse sur `/mon-espace/` ni `/telegram/` : ce sont des écrans d'outils pour les
 * restaurateurs, en plein écran, où elle couvrirait les boutons.
 *
 * Langue : lue sur `<html lang>`, la seule source que les 12 pages et la fonction de
 * partage ont en commun.
 */
(function () {
  var NUMERO = '261361574521';
  var TEXTES = {
    fr: { message: 'Bonjour Taxi Food 👋 J’ai une question : ', label: 'Écrire à Taxi Food sur WhatsApp' },
    en: { message: 'Hello Taxi Food 👋 I have a question: ', label: 'Message Taxi Food on WhatsApp' },
    it: { message: 'Ciao Taxi Food 👋 Ho una domanda: ', label: 'Scrivi a Taxi Food su WhatsApp' }
  };
  // Logo WhatsApp (Simple Icons, CC0).
  var LOGO = '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>';

  function poser() {
    if (document.getElementById('tf-bulle-whatsapp')) return;
    var lang = (document.documentElement.getAttribute('lang') || 'fr').slice(0, 2);
    var t = TEXTES[lang] || TEXTES.fr;
    var a = document.createElement('a');
    a.id = 'tf-bulle-whatsapp';
    a.href = 'https://wa.me/' + NUMERO + '?text=' + encodeURIComponent(t.message);
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', t.label);
    a.title = t.label;
    a.innerHTML = LOGO;
    a.style.cssText = 'position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:2147483000;'
      + 'width:56px;height:56px;border-radius:50%;background:#25D366;display:flex;align-items:center;'
      + 'justify-content:center;box-shadow:0 6px 18px rgba(0,0,0,.25);text-decoration:none';
    document.body.appendChild(a);
  }
  if (document.body) poser(); else document.addEventListener('DOMContentLoaded', poser);
})();
