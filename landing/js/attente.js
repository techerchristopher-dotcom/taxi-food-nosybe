/* Taxi Food — retour visuel pendant les attentes reseau.
   Partage par les sept pages du site. Aucune dependance.

   POURQUOI. Sur la liaison de Nosy Be, changer de page prend parfois
   plusieurs secondes. Sans signal, le visiteur croit que son clic n'a pas
   pris : il reclique, ou il part. Ce fichier ne rend rien plus rapide — il
   rend l'attente LISIBLE, ce qui n'est pas la meme chose mais decide de qui
   reste.

   Deux signaux, volontairement redondants :
   - une barre de progression en haut de l'ecran, visible ou que soit le
     regard ;
   - l'element clique lui-meme, qui prend un etat occupe.
   L'un attrape l'oeil qui regarde ailleurs, l'autre confirme QUE c'est bien
   ce bouton-la qui a pris. */
(function () {
  "use strict";

  var CSS =
    /* L'etat occupe : le contenu s'efface (en fondu, les pastilles ayant
       deja une transition sur la couleur) et une roue tourne au centre.
       min-width/min-height sont figes a la volee pour que le bouton ne se
       retracte pas quand son texte disparait. */
    ".tf-occupe{position:relative!important;pointer-events:none!important;color:transparent!important}" +
    ".tf-occupe>*{opacity:0!important}" +
    ".tf-occupe::after{content:'';position:absolute;top:50%;left:50%;width:15px;height:15px;" +
    "margin:-8px 0 0 -8px;border-radius:999px;border:2px solid rgba(26,26,26,.28);" +
    "border-top-color:#C42419;animation:tf-tourne .62s linear infinite}" +
    "@keyframes tf-tourne{to{transform:rotate(360deg)}}" +
    /* Sur fond sombre ou colore, la roue passe en blanc. */
    ".tf-occupe-clair::after{border-color:rgba(255,255,255,.35);border-top-color:#fff}" +
    "#tf-barre{position:fixed;top:0;left:0;height:3px;width:0;background:#E8342A;z-index:9999;" +
    "pointer-events:none;transition:width .3s ease-out,opacity .3s;box-shadow:0 0 8px rgba(232,52,42,.6)}" +
    "@media (prefers-reduced-motion:reduce){.tf-occupe::after{animation-duration:2s}" +
    "#tf-barre{transition:none}}";

  var style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  /* ---------------------------- La barre ---------------------------- */

  var barre = null, minuterie = null;

  function demarrerBarre() {
    if (!barre) {
      barre = document.createElement("div");
      barre.id = "tf-barre";
      barre.setAttribute("role", "progressbar");
      barre.setAttribute("aria-hidden", "true");
      document.body.appendChild(barre);
    }
    barre.style.opacity = "1";
    barre.style.width = "0";
    /* On monte vite jusqu'a 80 %, puis on s'arrete : on ne CONNAIT pas la
       progression reelle d'une navigation. Aller jusqu'a 100 % avant que la
       page arrive serait un mensonge, et le visiteur le voit. */
    setTimeout(function () { if (barre) barre.style.width = "80%"; }, 30);
    clearTimeout(minuterie);
  }

  function arreterBarre() {
    if (!barre) return;
    barre.style.width = "100%";
    barre.style.opacity = "0";
    minuterie = setTimeout(function () {
      if (barre) { barre.style.width = "0"; barre.style.opacity = "1"; }
    }, 350);
  }

  /* ------------------------- L'element clique ------------------------- */

  /* Un fond sombre ou sature demande une roue claire. On regarde la couleur
     calculee plutot que de maintenir une liste de selecteurs. */
  function fondSombre(el) {
    var c = getComputedStyle(el).backgroundColor;
    var m = c.match(/\d+/g);
    if (!m || m.length < 3) return false;
    if (m.length > 3 && parseFloat(m[3]) < 0.5) return false;
    return (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) < 150;
  }

  function occuper(el) {
    if (!el || el.classList.contains("tf-occupe")) return;
    /* On fige la taille : sans ca, un bouton dont le texte disparait se
       retracte et la mise en page saute au pire moment. */
    var r = el.getBoundingClientRect();
    el.style.minWidth = Math.round(r.width) + "px";
    el.style.minHeight = Math.round(r.height) + "px";
    el.classList.add("tf-occupe");
    if (fondSombre(el)) el.classList.add("tf-occupe-clair");
    el.setAttribute("aria-busy", "true");
  }

  function liberer(el) {
    if (!el) return;
    el.classList.remove("tf-occupe", "tf-occupe-clair");
    el.removeAttribute("aria-busy");
    el.style.minWidth = "";
    el.style.minHeight = "";
  }

  function toutLiberer() {
    var occupes = document.querySelectorAll(".tf-occupe");
    for (var i = 0; i < occupes.length; i++) liberer(occupes[i]);
    arreterBarre();
  }

  /* --------------------------- Les clics --------------------------- */

  function interne(a) {
    if (a.target && a.target !== "_self") return false;
    if (a.hasAttribute("download")) return false;
    var h = a.getAttribute("href") || "";
    if (!h || h.charAt(0) === "#") return false;
    if (/^(mailto|tel|sms|javascript):/i.test(h)) return false;
    try {
      var u = new URL(a.href, location.href);
      if (u.origin !== location.origin) return false;
      /* Meme page + ancre : pas de navigation, donc pas d'attente. */
      if (u.pathname === location.pathname && u.hash) return false;
      return true;
    } catch (e) { return false; }
  }

  document.addEventListener("click", function (e) {
    /* Un clic modifie ouvre un nouvel onglet : la page courante reste, et un
       etat occupe y resterait bloque pour toujours. */
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    var a = e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;

    if (interne(a)) {
      occuper(a);
      demarrerBarre();
      return;
    }

    /* Lien sortant (WhatsApp, telephone, prise de rendez-vous) : la page
       reste, mais l'ouverture prend un instant. On montre l'attente, et on la
       retire toute seule — sinon le bouton resterait fige au retour. */
    var h = a.getAttribute("href") || "";
    if (/^https?:/i.test(h) || /^(tel|mailto):/i.test(h)) {
      occuper(a);
      setTimeout(function () { liberer(a); }, 2200);
    }
  }, true);

  /* PAS de barre sur l'envoi d'un formulaire. Les trois formulaires du site
     partent en fetch et ne rechargent pas la page : la barre monterait a 80 %
     et y resterait, a annoncer un chargement termine depuis longtemps. Leurs
     boutons basculent deja sur « Envoi… » puis sur l'ecran de succes, ce qui
     est le bon signal — et il est plus precis qu'une barre. */

  /* ------------------------- Retours en arriere ------------------------- */

  /* Bouton Precedent : la page revient du cache AVEC ses classes. Sans ce
     reveil, le visiteur retrouve un bouton fige en chargement pour toujours. */
  window.addEventListener("pageshow", function (e) { if (e.persisted) toutLiberer(); });
  window.addEventListener("pagehide", function () { toutLiberer(); });

  /* Filet : si la navigation echoue (hors ligne, serveur muet), on rend la
     main au bout de 12 s plutot que de laisser la page inerte. */
  document.addEventListener("click", function () {
    setTimeout(function () { if (document.visibilityState === "visible") toutLiberer(); }, 12000);
  }, true);
})();
