import React from 'react';
import {
  AbsoluteFill, Img, OffthreadVideo, interpolate, spring, staticFile,
  useCurrentFrame, useVideoConfig,
} from 'remotion';

/* ---------------------------------------------------------------------------
   La carte ne vient PAS d'ici. Elle vient de gabarit.py, decoupee en quatre
   calques par calques_tiktok.py. Ce fichier ne fait que les faire entrer.
   Redessiner la carte en React, c'est se garantir qu'un jour la video et la
   publication ne diront plus la meme chose.
--------------------------------------------------------------------------- */

export const W = 1080;
export const H = 1920;
export const FPS = 30;
export const SCENE = 880;

// Le fond de la serie, copie de gabarit.FONDS['studio'] — il remplit les bandes
// que la correction de cadrage laisse vides sur les cotes.
const STUDIO =
  'radial-gradient(ellipse 55% 68% at 50% 34%, #909090 0%, #6A6A6A 45%, ' +
  '#3A3A3A 72%, #0A0A0A 96%)';

/* --- La correction de cadrage -----------------------------------------------
   Le modele a fini sur la bonne composition mais 32 % trop gros, et la pizza y
   est 8 % plus haute que large (la camera n'est pas tout a fait a la verticale).
   Ces quatre nombres sont MESURES sur l'image 240 du clip et sur l'image de fin,
   avec le meme detecteur :
       clip  x  81..998   y 420..1415
       cible x 194..886   y 205..896
   Ils ne se retouchent pas a l'oeil : si le clip change, on remesure.
--------------------------------------------------------------------------- */
const KX = 0.75463;
const KY = 0.69447;
const DX = 0.4;
const DY = -380.0;

// La camera du clip decelere entre 7,0 s et 9,4 s puis se fige : la correction
// epouse exactement cette course, elle ne s'y ajoute pas.
const COR_DEBUT = Math.round(7.0 * FPS);
const COR_FIN = Math.round(9.4 * FPS);

const CLIP_IMAGES = Math.round(10.0416 * FPS); // 241 images a 24 i/s

// Les quatre gestes de la carte. Un par calque, jamais deux ensemble.
const T_BANDE = Math.round(8.2 * FPS);
const T_PASTILLE = Math.round(8.6 * FPS);
const T_BADGE = Math.round(8.8 * FPS);
const T_TEXTE = Math.round(9.1 * FPS);

const doux = (frame: number, fps: number, retard: number, damping = 200) =>
  spring({frame: frame - retard, fps, config: {damping, stiffness: 110, mass: 0.9}});

/** carte = false : le clip corrige, sans la carte. C'est la seule facon de
 *  MESURER le pivot : dans la video finie la bande rouge couvre le bas du plat,
 *  et un controle qui ne peut pas voir ce qu'il mesure ne controle rien. */
export const Pizza: React.FC<{carte?: boolean}> = ({carte = true}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();

  // 0 -> 1, adouci aux deux bouts : la correction ne doit ni demarrer ni
  // s'arreter brusquement, sinon on voit la camera « tirer ».
  const p = interpolate(frame, [COR_DEBUT, COR_FIN], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => t * t * (3 - 2 * t),
  });

  const kx = 1 + (KX - 1) * p;
  const ky = 1 + (KY - 1) * p;
  const dx = DX * p;
  const dy = DY * p;

  // Le fondu des bords suit la correction : a p = 0 le clip remplit le cadre et
  // il ne faut rien ronger ; a p = 1 il laisse 133 px de chaque cote et le
  // raccord avec le fond doit disparaitre. 70 px : la pizza va jusqu'a x = 998,
  // le fondu s'arrete a 1010. Mesure, pas estime.
  const plume = Math.round(70 * p);
  const masque =
    plume > 0
      ? `linear-gradient(to right, transparent 0px, black ${plume}px, black ${W - plume}px, transparent ${W}px)`
      : 'none';

  const scene: React.CSSProperties = {
    transform: `translate(${dx}px, ${dy}px) scale(${kx}, ${ky})`,
    transformOrigin: 'center center',
    WebkitMaskImage: masque,
    maskImage: masque,
  };

  const bande = doux(frame, fps, T_BANDE);
  const pastille = doux(frame, fps, T_PASTILLE, 170);
  const badge = doux(frame, fps, T_BADGE, 150);
  const texte = doux(frame, fps, T_TEXTE);

  // Le son s'eteint sur la derniere seconde : le clip s'arrete avant la fin de
  // la composition, une coupure nette s'entend.
  const volume = interpolate(frame, [durationInFrames - 45, durationInFrames - 10], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{backgroundColor: '#0A0A0A'}}>
      {/* le fond de la serie, sous tout le reste */}
      <AbsoluteFill style={{background: STUDIO, height: SCENE}} />

      <AbsoluteFill style={scene}>
        {/* l'image gelee tient le cadre apres la fin du clip ; a l'image 301
            les deux sont identiques, il n'y a donc pas de saut */}
        <Img src={staticFile('gel.png')} style={{width: W, height: H, display: 'block'}} />
        {frame < CLIP_IMAGES && (
          <OffthreadVideo
            src={staticFile('clip.mp4')}
            volume={volume}
            style={{position: 'absolute', inset: 0, width: W, height: H, objectFit: 'fill'}}
          />
        )}
      </AbsoluteFill>

      {carte && (<>
      {/* 1. la bande rouge monte du bas, le filet or avec elle */}
      <Img
        src={staticFile('L1.png')}
        style={{
          position: 'absolute', inset: 0, width: W, height: H,
          transform: `translateY(${interpolate(bande, [0, 1], [H - SCENE, 0])}px)`,
        }}
      />

      {/* 2. la pastille du restaurant se pose a cheval sur le filet */}
      <Img
        src={staticFile('L3.png')}
        style={{
          position: 'absolute', inset: 0, width: W, height: H,
          opacity: pastille,
          transform: `scale(${interpolate(pastille, [0, 1], [0.84, 1])})`,
          transformOrigin: '180px 890px',
        }}
      />

      {/* 3. le badge tombe */}
      <Img
        src={staticFile('L4.png')}
        style={{
          position: 'absolute', inset: 0, width: W, height: H,
          opacity: badge,
          transform: `translateY(${interpolate(badge, [0, 1], [-70, 0])}px) scale(${interpolate(badge, [0, 1], [0.72, 1])})`,
          transformOrigin: '769px 1098px',
        }}
      />

      {/* 4. le texte, une fois la bande posee */}
      <Img
        src={staticFile('L2.png')}
        style={{
          position: 'absolute', inset: 0, width: W, height: H,
          opacity: texte,
          transform: `translateY(${interpolate(texte, [0, 1], [26, 0])}px)`,
        }}
      />
      </>)}
    </AbsoluteFill>
  );
};
