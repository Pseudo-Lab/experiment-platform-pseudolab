import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { AbHold } from './AbHold.jsx';
import { AbReels, REELS_FRAMES } from './AbReels.jsx';

registerRoot(() => <>
  <Composition id="AbHold" component={AbHold} durationInFrames={600} fps={30} width={1920} height={1080}/>
  <Composition id="AbReels" component={AbReels} durationInFrames={REELS_FRAMES} fps={30} width={1080} height={1920}/>
</>);
