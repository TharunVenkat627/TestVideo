import React from 'react';
import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export interface SceneItem {
  chapter: string;
  narration: string;
  subtitle: string;
  emotion: 'happy' | 'curious' | 'proud' | 'sad' | 'lonely' | 'hopeful';
  setting:
    | 'factory'
    | 'store_shelf'
    | 'home_desk'
    | 'school_outdoor'
    | 'rainy_street'
    | 'dustbin_dark'
    | 'recycling_light';
  cameraMove: 'zoom_in' | 'zoom_out' | 'pan_left' | 'pan_right';
  startFrame: number;
  durationInFrames: number;
}

export interface EpisodeData {
  objectName: string;
  objectType: string;
  primaryColor: string;
  accentColor: string;
  title: string;
  description: string;
  totalFrames: number;
  scenes: SceneItem[];
}

const SETTING_PALETTES: Record<
  SceneItem['setting'],
  { top: string; bottom: string; floor: string; light: string }
> = {
  factory: { top: '#1E293B', bottom: '#334155', floor: '#475569', light: '#F59E0B' },
  store_shelf: { top: '#FEF3C7', bottom: '#FDE68A', floor: '#B45309', light: '#FFFFFF' },
  home_desk: { top: '#1E3A5F', bottom: '#2B547E', floor: '#78350F', light: '#FBBF24' },
  school_outdoor: { top: '#0284C7', bottom: '#7DD3FC', floor: '#15803D', light: '#FEF08A' },
  rainy_street: { top: '#0F172A', bottom: '#1E293B', floor: '#090D16', light: '#38BDF8' },
  dustbin_dark: { top: '#09090B', bottom: '#18181B', floor: '#27272A', light: '#71717A' },
  recycling_light: { top: '#064E3B', bottom: '#10B981', floor: '#047857', light: '#A7F3D0' },
};

const ObjectCharacter: React.FC<{
  objectType: string;
  primaryColor: string;
  accentColor: string;
  emotion: SceneItem['emotion'];
}> = ({ objectType, primaryColor, accentColor, emotion }) => {
  const frame = useCurrentFrame();

  // Gentle breathing float & subtle emotional tilt
  const breathY = Math.sin(frame * 0.08) * 8;
  const tilt =
    emotion === 'sad' || emotion === 'lonely'
      ? -8
      : emotion === 'curious'
      ? Math.sin(frame * 0.05) * 6
      : Math.sin(frame * 0.06) * 3;

  // Periodic blinking + audio-driven mouth
  const isBlinking = frame % 110 > 105;
  const mouthOpen = Math.abs(Math.sin(frame * 0.55)) > 0.42;
  const isSad = emotion === 'sad' || emotion === 'lonely';

  return (
    <g transform={`translate(960, ${560 + breathY}) rotate(${tilt})`}>
      {/* Soft Ground Contact Shadow */}
      <ellipse cx="0" cy={240 - breathY} rx="135" ry="24" fill="rgba(0,0,0,0.45)" />

      {/* 3D-Shaded Object Body Silhouette */}
      {objectType === 'pencil' ? (
        <g>
          {/* Eraser & Metal Ferrule */}
          <rect x="-42" y="-235" width="84" height="45" rx="14" fill="#F43F5E" />
          <rect x="-44" y="-195" width="88" height="24" fill="#CBD5E1" />
          {/* Hexagonal Pencil Shaft */}
          <rect x="-42" y="-171" width="84" height="310" fill={primaryColor || '#F59E0B'} />
          <rect x="-14" y="-171" width="28" height="310" fill={accentColor || '#D97706'} opacity="0.45" />
          {/* Wooden Cone & Graphite Tip */}
          <polygon points="-42,139 42,139 0,225" fill="#FDE68A" />
          <polygon points="-13,198 13,198 0,225" fill="#1E293B" />
        </g>
      ) : objectType === 'note' || objectType === 'ticket' ? (
        <g>
          <rect
            x="-190"
            y="-115"
            width="380"
            height="230"
            rx="16"
            fill={primaryColor || '#D97706'}
            stroke={accentColor || '#FEF3C7'}
            strokeWidth="8"
          />
          <rect
            x="-165"
            y="-90"
            width="330"
            height="180"
            rx="10"
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="3"
            strokeDasharray="10 6"
          />
        </g>
      ) : objectType === 'ball' ? (
        <g>
          <circle cx="0" cy="10" r="155" fill={primaryColor || '#DC2626'} />
          <path
            d="M -110 -95 Q 0 10 -110 115"
            fill="none"
            stroke="#F8FAFC"
            strokeWidth="5"
            strokeDasharray="10 8"
          />
          <path
            d="M 110 -95 Q 0 10 110 115"
            fill="none"
            stroke="#F8FAFC"
            strokeWidth="5"
            strokeDasharray="10 8"
          />
        </g>
      ) : (
        /* Default expressive 3D Bottle / Everyday Capsule Silhouette */
        <g>
          <rect x="-38" y="-225" width="76" height="36" rx="8" fill={accentColor || '#0284C7'} />
          <path
            d="M -34 -189 L -85 -120 L -85 185 Q -85 215 -55 215 L 55 215 Q 85 215 85 185 L 85 -120 L 34 -189 Z"
            fill={primaryColor || '#38BDF8'}
          />
          {/* 3D Specular Rim Highlight */}
          <rect x="-58" y="-100" width="18" height="270" rx="9" fill="rgba(255,255,255,0.32)" />
        </g>
      )}

      {/* === PIXAR-STYLE EXPRESSIVE FACE === */}
      <g transform="translate(0, -15)">
        {/* Left & Right Eye Whites */}
        {isBlinking ? (
          <>
            <line x1="-58" y1="0" x2="-18" y2="0" stroke="#0F172A" strokeWidth="6" strokeLinecap="round" />
            <line x1="18" y1="0" x2="58" y2="0" stroke="#0F172A" strokeWidth="6" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="-38" cy="0" r="24" fill="#FFFFFF" />
            <circle cx="38" cy="0" r="24" fill="#FFFFFF" />
            {/* Pupils */}
            <circle cx="-34" cy={isSad ? 5 : -2} r="12" fill="#0F172A" />
            <circle cx="42" cy={isSad ? 5 : -2} r="12" fill="#0F172A" />
            {/* Eye Catchlight Reflections */}
            <circle cx="-39" cy={isSad ? 0 : -7} r="4.5" fill="#FFFFFF" />
            <circle cx="37" cy={isSad ? 0 : -7} r="4.5" fill="#FFFFFF" />
          </>
        )}

        {/* Expressive Eyebrows */}
        {isSad ? (
          <>
            <line x1="-62" y1="-26" x2="-18" y2="-36" stroke="#0F172A" strokeWidth="6" strokeLinecap="round" />
            <line x1="18" y1="-36" x2="62" y2="-26" stroke="#0F172A" strokeWidth="6" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d="M -60 -32 Q -38 -44 -16 -32" fill="none" stroke="#0F172A" strokeWidth="6" strokeLinecap="round" />
            <path d="M 16 -32 Q 38 -44 60 -32" fill="none" stroke="#0F172A" strokeWidth="6" strokeLinecap="round" />
          </>
        )}

        {/* Animated Talking Mouth */}
        {mouthOpen ? (
          <ellipse cx="0" cy="48" rx="16" ry="12" fill="#0F172A" />
        ) : isSad ? (
          <path d="M -22 54 Q 0 38 22 54" fill="none" stroke="#0F172A" strokeWidth="5.5" strokeLinecap="round" />
        ) : (
          <path d="M -24 44 Q 0 62 24 44" fill="none" stroke="#0F172A" strokeWidth="5.5" strokeLinecap="round" />
        )}
      </g>
    </g>
  );
};

const DocumentaryScene: React.FC<{
  scene: SceneItem;
  episode: EpisodeData;
}> = ({ scene, episode }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const palette = SETTING_PALETTES[scene.setting] || SETTING_PALETTES.home_desk;

  // Dynamic Ken Burns camera movement per scene (prevents static visual fatigue)
  const scale =
    scene.cameraMove === 'zoom_in'
      ? interpolate(frame, [0, durationInFrames], [1.0, 1.12])
      : scene.cameraMove === 'zoom_out'
      ? interpolate(frame, [0, durationInFrames], [1.12, 1.0])
      : 1.06;

  const panX =
    scene.cameraMove === 'pan_left'
      ? interpolate(frame, [0, durationInFrames], [25, -25])
      : scene.cameraMove === 'pan_right'
      ? interpolate(frame, [0, durationInFrames], [-25, 25])
      : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: palette.top, overflow: 'hidden' }}>
      {/* Camera Transform Container */}
      <div
        style={{
          width: '100%',
          height: '100%',
          transform: `scale(${scale}) translateX(${panX}px)`,
        }}
      >
        <svg width="1920" height="1080" viewBox="0 0 1920 1080">
          <defs>
            <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={palette.top} />
              <stop offset="100%" stopColor={palette.bottom} />
            </linearGradient>
            <radialGradient id="spotlight" cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor={palette.light} stopOpacity="0.28" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.45" />
            </radialGradient>
          </defs>

          {/* Atmospheric Backdrop */}
          <rect width="1920" height="820" fill="url(#bgGrad)" />
          <rect x="0" y="780" width="1920" height="300" fill={palette.floor} />
          <rect width="1920" height="1080" fill="url(#spotlight)" />

          {/* Rain Overlay for Dark Phase */}
          {scene.setting === 'rainy_street' &&
            Array.from({ length: 28 }).map((_, i) => {
              const rx = (i * 73 + frame * 9) % 1920;
              const ry = (i * 137 + frame * 26) % 1080;
              return (
                <line
                  key={i}
                  x1={rx}
                  y1={ry}
                  x2={rx - 10}
                  y2={ry + 32}
                  stroke="rgba(186,230,253,0.35)"
                  strokeWidth="2.5"
                />
              );
            })}

          {/* Expressive 3D-Styled Object Hero */}
          <ObjectCharacter
            objectType={episode.objectType}
            primaryColor={episode.primaryColor}
            accentColor={episode.accentColor}
            emotion={scene.emotion}
          />
        </svg>
      </div>

      {/* Top-Left Chapter Pill */}
      <div
        style={{
          position: 'absolute',
          top: 48,
          left: 64,
          backgroundColor: 'rgba(15, 23, 42, 0.78)',
          border: '2px solid rgba(255,255,255,0.2)',
          color: '#F8FAFC',
          padding: '10px 24px',
          borderRadius: 999,
          fontFamily: 'system-ui, sans-serif',
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: 1.5,
        }}
      >
        {episode.objectName.toUpperCase()} • {scene.chapter}
      </div>

      {/* Cinematic Documentary Subtitle Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 64,
          left: 180,
          right: 180,
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 42,
          fontWeight: 700,
          color: '#FFFFFF',
          backgroundColor: 'rgba(9, 13, 22, 0.82)',
          padding: '20px 36px',
          borderRadius: 16,
          lineHeight: 1.3,
        }}
      >
        {scene.subtitle}
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
          <DocumentaryScene scene={scene} episode={episode} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
