import React from 'react';
import {Composition} from 'remotion';
import {Pizza, W, H, FPS, DUREE} from './Pizza';

const commun = {component: Pizza, durationInFrames: Math.round(DUREE * FPS),
                fps: FPS, width: W, height: H} as const;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="pizza-oriental" {...commun} defaultProps={{carte: true}} />
    {/* le meme plan sans la carte : sert au controle du pivot, pas a la diffusion */}
    <Composition id="pizza-oriental-nu" {...commun} defaultProps={{carte: false}} />
  </>
);
