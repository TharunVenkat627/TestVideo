import React from 'react';
import { Composition, staticFile } from 'remotion';
import { MainVideo, EpisodeData } from './Composition';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MainVideo"
      component={MainVideo}
      durationInFrames={300}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ episode: null as unknown as EpisodeData }}
      calculateMetadata={async () => {
        const res = await fetch(staticFile('episode.json'));
        const episode: EpisodeData = await res.json();
        return {
          durationInFrames: episode.totalFrames || 300,
          props: { episode },
        };
      }}
    />
  );
};
