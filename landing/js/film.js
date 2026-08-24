/* Taxi Food — lecteur de film multilingue.
   Partage par les six pages du site. Aucune dependance, aucun build.

   POURQUOI UN FICHIER A PART. Les pages EN et IT sont GENEREES a partir des
   deux pages francaises (tools/build-i18n.py). Un manifeste recopie dans les
   deux sources serait donc recopie six fois a l'arrivee : le jour ou une
   langue s'ajoute, il faudrait penser aux deux sources ET relancer la
   generation. Ici, il y a un seul fichier, servi tel quel aux six pages.

   AJOUTER UNE LANGUE : ajouter son code dans `locales` des deux films
   ci-dessous. C'est tout. La source, la vignette et le bouton du selecteur
   en decoulent. */
(function () {
  "use strict";

  /* ================== MANIFESTE — le seul endroit a modifier ================== */

  var VIDEO_BASE =
    "https://bmdveawomizjpiebgtkj.supabase.co/storage/v1/object/public/marketing/video/multilingue";

  var FILMS = {
    client: { slug: "film-client", locales: ["fr", "en", "it"] },
    resto:  { slug: "film-resto",  locales: ["fr", "en", "it"] }
  };

  /* Endonymes : le nom d'une langue ne se traduit pas. Servent de title et
     d'aria-label ; le bouton affiche le code court. `mg` est deja la, prete
     pour le jour ou les fichiers arrivent — elle n'apparait pas tant qu'elle
     n'est pas dans `locales`. */
  var VIDEO_LOCALE_LABELS = {
    fr: "Français",
    en: "English",
    it: "Italiano",
    mg: "Malagasy"
  };

  var FALLBACK_LOCALE = "fr";

  /* ============================== Composition ============================== */

  function srcUrl(film, loc)    { return VIDEO_BASE + "/" + FILMS[film].slug + "-" + loc + ".mp4"; }
  function posterUrl(film, loc) { return VIDEO_BASE + "/" + FILMS[film].slug + "-" + loc + ".jpg"; }

  function resolveLocale(film, voulue) {
    return FILMS[film].locales.indexOf(voulue) !== -1 ? voulue : FALLBACK_LOCALE;
  }

  /* ============================ Langue courante ============================ */

  var CLE_SESSION = "tf_video_lang";

  /* La langue du site est celle de la page. On ne cree PAS une seconde source
     de verite : chaque page est servie dans une langue et le declare dans
     <html lang>. Le selecteur de langue du site est fait de vrais liens, donc
     changer de langue = changer de page — il n'y a rien a ecouter. */
  function langueSite() {
    return (document.documentElement.getAttribute("lang") || FALLBACK_LOCALE).slice(0, 2);
  }

  function langueEpinglee() {
    try { return sessionStorage.getItem(CLE_SESSION); } catch (e) { return null; }
  }

  /* sessionStorage et pas localStorage : l'epinglage vaut pour la visite en
     cours. Il survit a un rechargement et au passage d'une page a l'autre du
     site — c'est ce qui fait qu'un choix explicite l'emporte sur la langue de
     la page — mais un nouvel onglet repart sur le comportement automatique.
     Un choix de confort n'a pas a etre memorise pour toujours. */
  function epingler(loc) {
    try { sessionStorage.setItem(CLE_SESSION, loc); } catch (e) { /* mode prive */ }
  }

  function langueInitiale(film) {
    var epinglee = langueEpinglee();
    if (epinglee && FILMS[film].locales.indexOf(epinglee) !== -1) return epinglee;
    return resolveLocale(film, langueSite());
  }

  /* ========================== Changement de langue ========================== */

  /* Les trois versions durent EXACTEMENT le meme temps, a l'image pres
     (37,433 s / 44,433 s). C'est ce qui autorise a garder la position : la
     seconde 12 du francais est la seconde 12 de l'italien. Si un jour un
     montage differait d'une langue a l'autre, cette fonction deviendrait
     fausse — et silencieusement. */
  function changerLangue(video, film, loc) {
    var t = video.currentTime;
    var lisait = !video.paused && !video.ended;
    var intacte = t === 0 && video.paused;

    video.pause();
    video.poster = posterUrl(film, loc);
    video.src = srcUrl(film, loc);
    video.setAttribute("lang", loc);

    /* Jamais lancee : on echange les attributs et on s'arrete la. Pas de
       load(), donc AUCUN octet demande au reseau. */
    if (intacte) return;

    video.load();
    video.addEventListener("loadeddata", function () {
      if (isFinite(video.duration)) {
        video.currentTime = Math.min(t, video.duration - 0.05);
      }
      /* Apres un changement de source, un navigateur peut refuser la reprise.
         Sans ce catch, la promesse rejetee salit la console. */
      if (lisait) { var p = video.play(); if (p && p["catch"]) p["catch"](function () {}); }
    }, { once: true });
  }

  /* ============================== Le selecteur ============================== */

  var STYLE_BOUTON =
    "-webkit-appearance:none;appearance:none;border:0;background:none;padding:2px 6px;" +
    "margin:0;cursor:pointer;font:700 11px/1 'JetBrains Mono',monospace;letter-spacing:.08em;" +
    "border-radius:6px;transition:color .16s";

  function construireSelecteur(boite, film, etat, cadre) {
    var liste = document.createElement("span");
    liste.style.cssText = "display:inline-flex;align-items:center;gap:2px";

    var boutons = {};
    FILMS[film].locales.forEach(function (loc, i) {
      if (i) {
        var sep = document.createElement("span");
        sep.textContent = "·";
        sep.setAttribute("aria-hidden", "true");
        sep.style.cssText = "color:#B9B4AF;font:700 11px/1 'JetBrains Mono',monospace";
        liste.appendChild(sep);
      }
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = loc.toUpperCase();
      b.title = VIDEO_LOCALE_LABELS[loc] || loc;
      b.setAttribute("aria-label", VIDEO_LOCALE_LABELS[loc] || loc);
      b.setAttribute("lang", loc);
      b.style.cssText = STYLE_BOUTON;

      /* Le malgache est un cas a part : voix malgache, mais textes a l'ecran
         en francais. On le dit, plutot que de laisser la surprise au clic.
         La mention est fournie par la page (donc traduite) via data-note-mg. */
      if (loc === "mg") {
        var note = boite.getAttribute("data-note-mg");
        if (note) { b.title = b.title + " — " + note; }
      }

      b.addEventListener("click", function () {
        if (etat.loc === loc) return;
        etat.loc = loc;
        epingler(loc);
        if (etat.video) {
          /* La bascule recharge la source : meme attente, meme signal. */
          if (!(etat.video.currentTime === 0 && etat.video.paused)) {
            suivreChargement(cadre, etat.video);
          }
          changerLangue(etat.video, film, loc);
        }
        peindre();
        /* Seule mesure qui dira si une version malgache merite d'etre
           produite. Ne fait rien tant qu'aucun analytics n'est installe. */
        if (typeof window.plausible === "function") {
          window.plausible("video_lang_change", { props: { film: film, langue: loc } });
        }
        if (Array.isArray(window.dataLayer)) {
          window.dataLayer.push({ event: "video_lang_change", film: film, langue: loc });
        }
      });

      boutons[loc] = b;
      liste.appendChild(b);
    });

    function peindre() {
      FILMS[film].locales.forEach(function (loc) {
        var actif = etat.loc === loc;
        boutons[loc].setAttribute("aria-pressed", actif ? "true" : "false");
        boutons[loc].style.color = actif ? "#C42419" : "#6B6662";
        boutons[loc].style.fontWeight = actif ? "800" : "700";
      });
    }

    peindre();
    boite.appendChild(liste);
  }

  /* ================================ Montage ================================ */

  /* Une roue posee sur le cadre pendant que la video se telecharge. Sur la
     liaison de Nosy Be, 13 Mo prennent du temps : sans ce signal, le visiteur
     voit un rectangle noir et croit que rien ne s'est passe. On la retire au
     premier `playing`, pas au `canplay` — c'est le moment ou l'image bouge
     reellement. */
  function attente(cadre) {
    var d = document.createElement("div");
    d.setAttribute("aria-label", "Chargement de la vidéo");
    d.setAttribute("role", "status");
    d.style.cssText =
      "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;" +
      "background:#000;z-index:2";
    d.innerHTML =
      '<span style="width:34px;height:34px;border-radius:999px;border:3px solid rgba(255,255,255,.25);' +
      'border-top-color:#fff;animation:tf-tourne-video .7s linear infinite"></span>';
    if (!document.getElementById("tf-style-video")) {
      var st = document.createElement("style");
      st.id = "tf-style-video";
      st.textContent = "@keyframes tf-tourne-video{to{transform:rotate(360deg)}}" +
        "@media (prefers-reduced-motion:reduce){#tf-style-video~*[role=status]>span{animation-duration:2.5s}}";
      document.head.appendChild(st);
    }
    cadre.appendChild(d);
    return d;
  }

  function suivreChargement(cadre, video) {
    var roue = attente(cadre);
    var fini = false;
    function retirer() {
      if (fini) return;
      fini = true;
      if (roue && roue.parentNode) roue.parentNode.removeChild(roue);
    }
    video.addEventListener("playing", retirer, { once: true });
    /* Filet : si la lecture automatique est refusee, la roue ne doit pas
       rester par-dessus les controles natifs. */
    video.addEventListener("canplay", function () { setTimeout(retirer, 400); }, { once: true });
    video.addEventListener("error", retirer, { once: true });
    /* Et si le reseau ne repond pas du tout, on rend la main au bout de 25 s
       plutot que de laisser une roue tourner indefiniment. */
    setTimeout(retirer, 25000);
    return retirer;
  }

  function monter(cadre) {
    var film = cadre.getAttribute("data-film");
    if (!FILMS[film]) return;

    var etat = { loc: langueInitiale(film), video: null };
    var bouton = cadre.querySelector("[data-film-play]");

    /* La vidéo n'existe qu'apres le tap : c'est plus fort que preload="none",
       aucun element media n'est meme cree au chargement. La vignette visible
       avant le tap est l'image locale de la page (WebP, ~20-48 Ko) ; le
       poster distant sert de fond a l'element une fois cree, le temps que la
       premiere image se decode. */
    if (bouton) {
      bouton.addEventListener("click", function () {
        if (etat.video) return;
        var v = document.createElement("video");
        v.setAttribute("playsinline", "");
        v.setAttribute("controls", "");
        v.setAttribute("preload", "none");
        v.setAttribute("width", "540");
        v.setAttribute("height", "960");
        v.setAttribute("lang", etat.loc);
        v.poster = posterUrl(film, etat.loc);
        /* Attribut src, jamais des enfants <source> : avec des <source>,
           reaffecter video.src ne fait rien de fiable et le changement de
           langue echoue sans erreur. */
        v.src = srcUrl(film, etat.loc);
        v.style.cssText = "width:100%;height:100%;object-fit:contain;display:block;background:#000";
        cadre.innerHTML = "";
        cadre.appendChild(v);
        etat.video = v;
        suivreChargement(cadre, v);
        /* play() appele de facon synchrone dans le gestionnaire de clic :
           seule maniere fiable de demarrer une video non muette sur iOS. */
        var p = v.play();
        if (p && p["catch"]) p["catch"](function () {});
      });
    }

    var boite = document.querySelector('[data-film-langs="' + film + '"]');
    if (boite) construireSelecteur(boite, film, etat, cadre);
  }

  function demarrer() {
    var cadres = document.querySelectorAll("[data-film]");
    for (var i = 0; i < cadres.length; i++) monter(cadres[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", demarrer);
  } else {
    demarrer();
  }
})();
