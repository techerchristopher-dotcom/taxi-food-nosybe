import React from 'react';
import {
  AbsoluteFill, Audio, Img, OffthreadVideo, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig,
} from 'remotion';

/* ---------------------------------------------------------------------------
   La carte ne vient PAS d'ici. Elle vient de gabarit.py, decoupee en DOUZE
   calques transparents par calques_tiktok.py. Ce fichier ne fait que les faire
   entrer. Redessiner la carte en React, c'est se garantir qu'un jour la video
   et la publication ne diront plus la meme chose.
--------------------------------------------------------------------------- */

export const W = 1080;
export const H = 1920;
export const FPS = 30;
export const SCENE = 880;
export const FILET = 8;
export const DUREE = 14;

const STUDIO =
  'radial-gradient(ellipse 55% 68% at 50% 34%, #909090 0%, #6A6A6A 45%, ' +
  '#3A3A3A 72%, #0A0A0A 96%)';
const OR = '#FFC72C';

/* --- La correction de cadrage (mesuree, jamais retouchee a l'oeil) ---------
   clip, derniere image : x  81..998   y 420..1415
   cible (la carte)     : x 194..886   y 205..896
   L'echelle est NON UNIFORME parce que le disque rendu est elliptique : une
   echelle uniforme laisse 15 px, au-dessus de la tolerance.
--------------------------------------------------------------------------- */
const KX = 0.75463, KY = 0.69447, DX = 0.4, DY = -380.0;
const COR_DEBUT = Math.round(7.0 * FPS);   // la camera du modele bouge encore
const COR_FIN = Math.round(9.4 * FPS);     // elle se pose ici, la correction aussi
const CLIP_IMAGES = Math.round(10.0416 * FPS);

/* --- Geometrie des calques, lue sur leur alpha ----------------------------- */
const BADGE = {cx: 766.5, cy: 1079.5};     // L07 : x 612..921, y 925..1234
const CODE = {cx: 774, cy: 1139.5};        // L09 : x 666..882, y 1108..1171
const URL = {x0: 452, x1: 905, bas: 1556}; // L12 : x 452..905, y 1523..1547
const PRIX = {x: 88, y: 1280};             // L05 : ancre du tampon

/* --- Le deroule. Une arrivee a la fois, jamais deux ensemble. --------------- */
const T = (s: number) => Math.round(s * FPS);
const A = {
  bande: T(8.2), pastille: T(8.5), eclat: T(8.7), titre: T(8.8), desc: T(9.05),
  prix: T(9.25), lieu: T(9.45), disque: T(9.7), remise: T(9.95), code: T(10.25),
  promo: T(10.6), stores: T(10.85), url: T(11.05), trait: T(11.2),
  battement1: T(11.6), zoomCode: T(12.5), battement2: T(13.0),
};

const plein: React.CSSProperties = {position: 'absolute', inset: 0, width: W, height: H};

/** Ressort BORNE. damping eleve = il se pose ; plus bas = il deborde un peu.
 *  durationInFrames n'est pas un detail : un ressort libre a une queue
 *  asymptotique qui traine 30 images. Mesure sur le premier rendu, le texte
 *  bougeait encore a 12,0 s alors que le badge commencait a battre a 11,6 —
 *  et la regle est que rien ne bouge pendant qu'on lit. */
const res = (f: number, fps: number, t0: number, damping = 200, stiffness = 110) =>
  spring({frame: f - t0, fps, durationInFrames: 14,
          config: {damping, stiffness, mass: 0.9}});

/** Un battement de coeur : deux pulsations, la seconde plus faible. Pas un
 *  clignotement — ca lit comme une alerte, et ca fait bon marche. */
const battement = (f: number, t0: number) => {
  const l = f - t0;
  if (l < 0 || l > 21) return {k: 1, rot: 0};
  const k = interpolate(l, [0, 5, 10, 14, 21], [1, 1.06, 1, 1.03, 1], {
    easing: (t) => t * t * (3 - 2 * t),
  });
  return {k, rot: (k - 1) * 25};   // la rotation respire avec : -7deg -> -5,5deg
};

export const Pizza: React.FC<{carte?: boolean}> = ({carte = true}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();

  // --- le clip et sa correction --------------------------------------------
  const p = interpolate(frame, [COR_DEBUT, COR_FIN], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: (t) => t * t * (3 - 2 * t),
  });
  // Le fondu des bords suit la correction : a p = 1 le clip laisse 133 px de
  // chaque cote. 70 px — la pizza va jusqu'a x = 998, le fondu s'arrete a 1010.
  const plume = Math.round(70 * p);
  const masque = plume > 0
    ? `linear-gradient(to right, transparent 0px, black ${plume}px, black ${W - plume}px, transparent ${W}px)`
    : 'none';

  // --- les gestes ------------------------------------------------------------
  const gBande = res(frame, fps, A.bande);
  const gPastille = res(frame, fps, A.pastille, 170);
  const gTitre = res(frame, fps, A.titre);
  const gDesc = res(frame, fps, A.desc);
  const gPrix = res(frame, fps, A.prix, 150, 150);
  const gLieu = res(frame, fps, A.lieu);
  const gDisque = res(frame, fps, A.disque, 150);
  const gRemise = res(frame, fps, A.remise, 220, 200);   // « arrive sec »
  const gCode = res(frame, fps, A.code, 120, 170);       // tampon, leger debord
  const gPromo = res(frame, fps, A.promo);
  const gStores = res(frame, fps, A.stores);
  const gUrl = res(frame, fps, A.url);

  const trait = interpolate(frame, [A.trait, A.trait + 12], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    easing: (t) => 1 - (1 - t) * (1 - t),
  });

  // L'eclat qui traverse le filet or, une fois.
  const eclat = interpolate(frame, [A.eclat, A.eclat + 15], [-360, W + 60], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // Les deux battements du badge, et le zoom du code entre les deux.
  const b1 = battement(frame, A.battement1);
  const b2 = battement(frame, A.battement2);
  const bat = b1.k !== 1 ? b1 : b2;
  const zoomCode = interpolate(frame, [A.zoomCode, A.zoomCode + 5, A.zoomCode + 12],
    [1, 1.16, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
                   easing: (t) => t * t * (3 - 2 * t)});

  const monte = (g: number, dy: number) => ({
    opacity: g, transform: `translateY(${interpolate(g, [0, 1], [dy, 0])}px)`,
  });

  return (
    <AbsoluteFill style={{backgroundColor: '#0A0A0A'}}>
      <Audio src={staticFile('son.m4a')} />

      <AbsoluteFill style={{background: STUDIO, height: SCENE}} />

      <AbsoluteFill
        style={{
          transform: `translate(${DX * p}px, ${DY * p}px) scale(${1 + (KX - 1) * p}, ${1 + (KY - 1) * p})`,
          transformOrigin: 'center center',
          WebkitMaskImage: masque, maskImage: masque,
        }}
      >
        {/* l'image gelee tient le cadre apres la fin du clip ; a l'image 301
            les deux sont identiques, il n'y a donc pas de saut */}
        <Img src={staticFile('gel.png')} style={{width: W, height: H, display: 'block'}} />
        {frame < CLIP_IMAGES && (
          <OffthreadVideo
            src={staticFile('clip.mp4')} muted
            style={{...plein, objectFit: 'fill'}}
          />
        )}
      </AbsoluteFill>

      {carte && (<>
        {/* 1. la bande rouge monte, le filet or avec elle */}
        <Img src={staticFile('L01.png')}
          style={{...plein, transform: `translateY(${interpolate(gBande, [0, 1], [H - SCENE, 0])}px)`}} />

        {/* un eclat traverse le filet, une fois : il relie la scene a la bande */}
        <div style={{position: 'absolute', left: 0, top: SCENE, width: W, height: FILET, overflow: 'hidden'}}>
          <div style={{
            position: 'absolute', top: 0, left: eclat, width: 300, height: FILET,
            background: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.92) 50%, rgba(255,255,255,0) 100%)',
          }} />
        </div>

        {/* 2. la pastille du restaurant se pose a cheval sur le filet */}
        <Img src={staticFile('L02.png')} style={{...plein, opacity: gPastille,
          transform: `scale(${interpolate(gPastille, [0, 1], [0.84, 1])})`,
          transformOrigin: '180px 876px'}} />

        {/* 3. le titre, seul : c'est le plus gros mot, il merite son temps */}
        <Img src={staticFile('L03.png')} style={{...plein, ...monte(gTitre, 20)}} />
        <Img src={staticFile('L04.png')} style={{...plein, ...monte(gDesc, 14)}} />

        {/* le prix ne se fond pas, il se tamponne : il doit peser */}
        <Img src={staticFile('L05.png')} style={{...plein, opacity: gPrix,
          transform: `scale(${interpolate(gPrix, [0, 1], [1.15, 1])})`,
          transformOrigin: `${PRIX.x}px ${PRIX.y}px`}} />

        <Img src={staticFile('L06.png')} style={{...plein, ...monte(gLieu, 12)}} />

        {/* 4. le badge. Les trois calques battent ENSEMBLE, autour du meme
               centre : le disque, le nombre et le code sont un seul objet. */}
        <div style={{...plein,
          transform: `rotate(${bat.rot}deg) scale(${bat.k})`,
          transformOrigin: `${BADGE.cx}px ${BADGE.cy}px`}}>
          <Img src={staticFile('L07.png')} style={{...plein, opacity: gDisque,
            transform: `translateY(${interpolate(gDisque, [0, 1], [-70, 0])}px) scale(${interpolate(gDisque, [0, 1], [0.72, 1])})`,
            transformOrigin: `${BADGE.cx}px ${BADGE.cy}px`}} />
          {/* « -50 % » arrive sec, dans une phrase deja posee */}
          <Img src={staticFile('L08.png')} style={{...plein, opacity: gRemise,
            transform: `scale(${interpolate(gRemise, [0, 1], [1.35, 1])})`,
            transformOrigin: `${BADGE.cx}px ${BADGE.cy}px`}} />
          {/* puis, apres un silence de 0,3 s, le code tamponne dessous.
              C'est ce silence qui fait lire la phrase : moins cinquante
              pour cent... AVEC ce code. */}
          <Img src={staticFile('L09.png')} style={{...plein, opacity: gCode,
            transform: `scale(${interpolate(gCode, [0, 1], [0.6, 1]) * zoomCode})`,
            transformOrigin: `${CODE.cx}px ${CODE.cy}px`}} />
        </div>

        {/* 5. le bloc noir : l'instruction, pas l'offre */}
        <Img src={staticFile('L10.png')} style={{...plein, ...monte(gPromo, 16)}} />

        {/* 6. les stores, puis l'url — la seule porte d'entree */}
        <Img src={staticFile('L11.png')} style={{...plein, ...monte(gStores, 12)}} />
        <Img src={staticFile('L12.png')} style={{...plein, ...monte(gUrl, 12)}} />
        {/* un trait or se dessine dessous : « c'est ici que tu vas » */}
        <div style={{position: 'absolute', left: URL.x0, top: URL.bas, height: 4,
          width: (URL.x1 - URL.x0) * trait, background: OR, borderRadius: 2}} />
      </>)}
    </AbsoluteFill>
  );
};
