import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export interface SceneItem {
  narration: string;
  caption: string;
  action: 'run' | 'jump_flip' | 'think' | 'celebrate';
  setting: 'paper_gap' | 'apartment' | 'blank_spotlight';
  startFrame: number;
  durationInFrames: number;
}

export interface EpisodeData {
  title: string;
  description: string;
  totalFrames: number;
  scenes: SceneItem[];
}

const StickmanScene: React.FC<{ scene: SceneItem }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Audio-reactive mouth simulation + periodic eye blink
  const mouthOpen = Math.abs(Math.sin(frame * 0.65)) > 0.45;
  const isBlinking = frame % 95 > 90;

  // Action choreography
  const progress = frame / Math.max(1, durationInFrames);
  const stride = (frame / fps) * Math.PI * 2 * 3.8;

  let x = 960;
  let y = 635;
  let rotation = 0;
  let leftThigh = 0, leftKnee = 0, rightThigh = 0, rightKnee = 0;
  let leftArm = 15, leftElbow = -20, rightArm = -15, rightElbow = 20;

  if (scene.action === 'run') {
    x = interpolate(progress, [0, 1], [320, 1580]);
    y = 635 - Math.abs(Math.sin(stride)) * 16;
    rotation = 16;
    leftThigh = Math.sin(stride) * 45;
    leftKnee = Math.max(0, Math.sin(stride - 0.7)) * 70;
    rightThigh = Math.sin(stride + Math.PI) * 45;
    rightKnee = Math.max(0, Math.sin(stride + Math.PI - 0.7)) * 70;
    leftArm = Math.sin(stride + Math.PI) * 50;
    rightArm = Math.sin(stride) * 50;
  } else if (scene.action === 'jump_flip') {
    x = interpolate(progress, [0, 1], [480, 1440]);
    y = 635 - Math.sin(progress * Math.PI) * 300;
    rotation = interpolate(progress, [0.15, 0.85], [0, 360], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.cubic),
    });
    leftThigh = -65; leftKnee = 105;
    rightThigh = -55; rightKnee = 95;
    leftArm = -100; rightArm = -90;
  } else if (scene.action === 'celebrate') {
    y = 635 - Math.abs(Math.sin(frame * 0.25)) * 22;
    leftArm = 145 + Math.sin(frame * 0.4) * 8;
    rightArm = -145 - Math.sin(frame * 0.4) * 8;
  } else {
    // 'think' pose: hand on chin, subtle head tilt
    rotation = Math.sin(frame * 0.08) * 3;
    rightArm = -115;
    rightElbow = -110;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#FAF9F6' }}>
      <svg width="1920" height="1080" viewBox="0 0 1920 1080">
        {/* Notebook Ruled Lines */}
        {Array.from({ length: 22 }).map((_, i) => (
          <line key={i} x1="0" y1={i * 48} x2="1920" y2={i * 48} stroke="#E2E8F0" strokeWidth="1.5" />
        ))}
        <line x1="110" y1="0" x2="110" y2="1080" stroke="#FCA5A5" strokeWidth="3" />

        {/* Setting Prop */}
        {scene.setting === 'paper_gap' ? (
          <>
            <path d="M 0 760 L 790 760 L 780 1080" fill="none" stroke="#0F172A" strokeWidth="7" />
            <path d="M 1180 1080 L 1190 760 L 1920 760" fill="none" stroke="#0F172A" strokeWidth="7" />
          </>
        ) : (
          <line x1="0" y1="760" x2="1920" y2="760" stroke="#0F172A" strokeWidth="7" />
        )}

        {/* Apartment Window Accent */}
        {scene.setting === 'apartment' && (
          <g transform="translate(1420, 220)">
            <rect width="260" height="300" fill="#E0F2FE" stroke="#0F172A" strokeWidth="6" />
            <line x1="130" y1="0" x2="130" y2="300" stroke="#0F172A" strokeWidth="5" />
            <line x1="0" y1="150" x2="260" y2="150" stroke="#0F172A" strokeWidth="5" />
          </g>
        )}

        {/* Stickman Character */}
        <g transform={`translate(${x}, ${y}) rotate(${rotation})`}>
          <line x1="0" y1="-48" x2="0" y2="52" stroke="#0F172A" strokeWidth="8" strokeLinecap="round" />
          <circle cx="0" cy="-82" r="28" fill="#FAF9F6" stroke="#0F172A" strokeWidth="7" />

          {/* Eyes */}
          {isBlinking ? (
            <>
              <line x1="4" y1="-86" x2="12" y2="-86" stroke="#0F172A" strokeWidth="3.5" />
              <line x1="16" y1="-86" x2="24" y2="-86" stroke="#0F172A" strokeWidth="3.5" />
            </>
          ) : (
            <>
              <circle cx="8" cy="-86" r="3.2" fill="#0F172A" />
              <circle cx="19" cy="-86" r="3.2" fill="#0F172A" />
            </>
          )}

          {/* Talking Mouth */}
          {mouthOpen ? (
            <ellipse cx="14" cy="-71" rx="6" ry="5" fill="#0F172A" />
          ) : (
            <line x1="8" y1="-71" x2="20" y2="-71" stroke="#0F172A" strokeWidth="3.5" strokeLinecap="round" />
          )}

          {/* Limbs */}
          <g transform={`translate(0, -34) rotate(${leftArm})`}>
            <line x1="0" y1="0" x2="0" y2="46" stroke="#0F172A" strokeWidth="7" strokeLinecap="round" />
            <g transform={`translate(0, 46) rotate(${leftElbow})`}>
              <line x1="0" y1="0" x2="0" y2="42" stroke="#0F172A" strokeWidth="7" strokeLinecap="round" />
            </g>
          </g>
          <g transform={`translate(0, -34) rotate(${rightArm})`}>
            <line x1="0" y1="0" x2="0" y2="46" stroke="#0F172A" strokeWidth="7" strokeLinecap="round" />
            <g transform={`translate(0, 46) rotate(${rightElbow})`}>
              <line x1="0" y1="0" x2="0" y2="42" stroke="#0F172A" strokeWidth="7" strokeLinecap="round" />
            </g>
          </g>
          <g transform={`translate(0, 52) rotate(${leftThigh})`}>
            <line x1="0" y1="0" x2="0" y2="58" stroke="#0F172A" strokeWidth="7.5" strokeLinecap="round" />
            <g transform={`translate(0, 58) rotate(${leftKnee})`}>
              <line x1="0" y1="0" x2="0" y2="58" stroke="#0F172A" strokeWidth="7.5" strokeLinecap="round" />
            </g>
          </g>
          <g transform={`translate(0, 52) rotate(${rightThigh})`}>
            <line x1="0" y1="0" x2="0" y2="58" stroke="#0F172A" strokeWidth="7.5" strokeLinecap="round" />
            <g transform={`translate(0, 58) rotate(${rightKnee})`}>
              <line x1="0" y1="0" x2="0" y2="58" stroke="#0F172A" strokeWidth="7.5" strokeLinecap="round" />
            </g>
          </g>
        </g>
      </svg>

      {/* Bold Scene Caption Banner */}
      <div
        style={{
          position: 'absolute',
          top: 90,
          left: 160,
          right: 160,
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 58,
          fontWeight: 900,
          color: '#0F172A',
          backgroundColor: 'rgba(255,255,255,0.9)',
          border: '4px solid #0F172A',
          borderRadius: 16,
          padding: '18px 32px',
        }}
      >
        {scene.caption}
      </div>
    </AbsoluteFill>
  );
};

export const MainVideo: React.FC<{ episode: EpisodeData }> = ({ episode }) => {
  if (!episode) return null;

  return (
    <AbsoluteFill>
      <Audio src={staticFile('voiceover.mp3')} />
      {episode.scenes.map((scene, idx) => (
        <Sequence key={idx} from={scene.startFrame} durationInFrames={scene.durationInFrames}>
          <StickmanScene scene={scene} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
