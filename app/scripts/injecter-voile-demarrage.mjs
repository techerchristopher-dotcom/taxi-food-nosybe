#!/usr/bin/env node
/**
 * Injecte l'écran d'attente dans le `dist/index.html` produit par `expo export`.
 *
 * ⚠️ POURQUOI UN SCRIPT, ET PAS `app/+html.tsx`.
 * `+html.tsx` est le moyen normal de personnaliser l'enveloppe HTML — mais il
 * n'est lu QUE par le rendu statique. Ce projet est en `web.output: "single"`
 * (une seule page, le routage se fait dans le navigateur), et Expo ignore alors
 * le fichier en silence : essayé le 2026-09-07, `dist/index.html` sortait
 * inchangé, sans le moindre avertissement. Basculer en `"static"` pour un écran
 * d'attente reviendrait à changer tout le routage web, et à reposer le piège
 * des routes profondes déjà payé avec `_redirects`.
 *
 * ⚠️ POURQUOI C'EST NÉCESSAIRE : L'ÉCRAN BLANC.
 * Le bundle pèse ~2,7 Mo. Entre le clic et le premier pixel dessiné par React,
 * il s'écoule plusieurs secondes — bien plus sur la liaison de Nosy Be —
 * pendant lesquelles le visiteur ne voit RIEN. Une page blanche muette, après
 * avoir cliqué « Commander maintenant » depuis un lien WhatsApp, se lit comme
 * une panne : on repart.
 *
 * ⚠️ Le voile est du HTML PUR, dans la page. Il s'affiche donc avant qu'un seul
 * octet de JavaScript ne soit téléchargé — c'est tout l'intérêt.
 * Il est retiré par `app/_layout.tsx` au premier rendu de React (et NON sur
 * l'événement `load`, qui arriverait trop tôt : le bundle serait chargé mais
 * React pas encore monté, et on retomberait sur du blanc).
 *
 * ⚠️ Ce script ÉCHOUE BRUYAMMENT s'il ne reconnaît pas la page. Un script
 * d'injection qui ne trouve pas sa cible et se tait laisserait passer des
 * déploiements sans écran d'attente, sans que personne ne s'en aperçoive.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cible = resolve(racine, 'dist/index.html');

const MARQUEUR = 'id="tf-boot"';
const ANCRE = '<div id="root"></div>';

const STYLE = `
    <style id="tf-boot-style">
      #tf-boot {
        position: fixed; inset: 0; z-index: 9999;
        display: flex; align-items: center; justify-content: center;
        background: #F5F2EF;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      }
      #tf-boot .carte { text-align: center; padding: 24px; }
      #tf-boot img { width: 64px; height: 64px; border-radius: 16px; animation: tfPulse 1.4s ease-in-out infinite; }
      /* Une barre qui avance, plutot qu'un rond qui tourne : elle dit « ca
         progresse », la ou un cercle indefini dit surtout « ca attend ». */
      #tf-boot .barre { width: 168px; height: 4px; margin: 20px auto 0; background: #E9E5E0; border-radius: 999px; overflow: hidden; }
      #tf-boot .barre span { display: block; width: 40%; height: 100%; background: #E8342A; border-radius: 999px; animation: tfGlisse 1.1s ease-in-out infinite; }
      #tf-boot p { margin: 14px 0 0; color: #8A827A; font-size: 14px; font-weight: 500; }
      @keyframes tfPulse { 0%,100% { transform: scale(1); opacity: 1; } 50% { transform: scale(.93); opacity: .75; } }
      @keyframes tfGlisse { 0% { transform: translateX(-110%); } 100% { transform: translateX(360%); } }
      /* Une animation en boucle est penible, voire nauseeuse, pour qui a demande
         moins de mouvement : on garde alors une barre pleine, immobile. */
      @media (prefers-reduced-motion: reduce) {
        #tf-boot img, #tf-boot .barre span { animation: none; }
        #tf-boot .barre span { width: 100%; }
      }
    </style>`;

const VOILE = `<div id="tf-boot"><div class="carte"><img src="/favicon.ico" alt=""><div class="barre"><span></span></div><p>Chargement du menu…</p></div></div>
    <div id="root"></div>`;

if (!existsSync(cible)) {
  console.error(`[voile] ${cible} est introuvable — « expo export » a-t-il tourné ?`);
  process.exit(1);
}

let html = readFileSync(cible, 'utf8');

if (html.includes(MARQUEUR)) {
  console.log('[voile] déjà présent, rien à faire.');
  process.exit(0);
}

if (!html.includes(ANCRE)) {
  console.error(
    `[voile] ancre « ${ANCRE} » introuvable dans dist/index.html.\n` +
      "         Expo a change la forme de sa page : adapter ce script AVANT de deployer,\n" +
      "         sinon le site repart avec un ecran blanc de plusieurs secondes.",
  );
  process.exit(1);
}

html = html.replace('</head>', `${STYLE}\n  </head>`).replace(ANCRE, VOILE);
// La page est en francais : le declarer sert aux lecteurs d'ecran et a la
// proposition de traduction automatique des navigateurs.
html = html.replace('<html lang="en">', '<html lang="fr">');

writeFileSync(cible, html);
console.log('[voile] écran d’attente injecté dans dist/index.html.');
