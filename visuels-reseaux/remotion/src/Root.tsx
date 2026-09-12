import React from 'react';
import {Composition} from 'remotion';
import {Pizza, W, H, FPS, DUREE, Plat} from './Pizza';
import plats from './plats.json';

const commun = {component: Pizza, durationInFrames: Math.round(DUREE * FPS),
                fps: FPS, width: W, height: H} as const;

export const RemotionRoot: React.FC = () => (
  <>
    {(plats as Plat[]).flatMap((plat) => [
      <Composition key={plat.slug} id={plat.slug} {...commun}
        defaultProps={{plat, carte: true}} />,
      // le meme plan sans la carte : sert au controle du pivot, pas a la diffusion
      <Composition key={plat.slug + '-nu'} id={plat.slug + '-nu'} {...commun}
        defaultProps={{plat, carte: false}} />,
    ])}
  </>
);
