import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { flip } from '@remotion/transitions/flip';

export interface SceneItem {
  chapter: string;
  narration: string;
  subtitle: string;
  emotion: 'happy' | 'curious' | 'proud' | 'sad' | 'lonely' | 'hopeful' | 'shocked';
  bodyAnim:
    | 'bounce_joy'
    | 'shiver_fear'
    | 'spin_celebrate'
    | 'heartbeat_tense'
    | 'float_dream'
    | 'slump_sad'
    | 'wave_greet';
  transition: 'slide_left' | 'slide_up' | 'wipe_diagonal' | 'fade_smooth' | 'flip_card';
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
  overlapFrames?: number;
  totalFrames: number;
  scenes: SceneItem[];
}

const SETTING_PALETTES: Record<
  SceneItem['setting'],
  { top: string; bottom: string; floor: string; light: string; propColor: string }
> = {
  factory: { top: '#1E293B', bottom: '#334155', floor: '#475569', light: '#F59E0B', propColor: '#64748B' },
  store_shelf: { top: '#FEF3C7', bottom: '#FDE68A', floor: '#B45309', light: '#FFFFFF', propColor: '#D97706' },
  home_desk: { top: '#1E3A5F', bottom: '#2B547E', floor: '#78350F', light: '#FBBF24', propColor: '#92400E' },
  school_outdoor: { top: '#0284C7', bottom: '#7DD3FC', floor: '#15803D', light: '#FEF08A', propColor: '#166534' },
  rainy_street: { top: '#0F172A', bottom: '#1E293B', floor: '#090D16', light: '#38BDF8', propColor: '#334155' },
  dustbin_dark: { top: '#09090B', bottom: '#18181B', floor: '#27272A', light: '#71717A', propColor: '#3F3F46' },
  recycling_light: { top: '#064E3B', bottom: '#10B981', floor: '#047857', light: '#A7F3D0', propColor: '#34D399' },
};

const AnimatedObjectCharacter: React.FC<{
  objectType: string;
  primaryColor: string;
  accentColor: string;
  emotion: SceneItem['emotion'];
  bodyAnim: SceneItem['bodyAnim'];
}> = ({ objectType, primaryColor, accentColor, emotion, bodyAnim }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Natural expressive rhythm (even in mute video, character acts out the narration)
  const actPulse = Math.abs(Math.sin(frame * 0.35));
  const mouthOpen = actPulse > 0.48;
  const isBlinking = frame % 95 > 90;
  const isSad = emotion === 'sad' || emotion === 'lonely';
  const isShocked = emotion === 'shocked';
  const isHappy = emotion === 'happy' || emotion === 'proud' || emotion === 'hopeful';

  let offsetX = 0;
  let offsetY = Math.sin(frame * 0.08) * 6;
  let rotation = 0;
  let scaleX = 1;
  let scaleY = 1;
  let leftArmAngle = 25;
  let rightArmAngle = -25;

  if (bodyAnim === 'bounce_joy') {
    const bounce = Math.abs(Math.sin(frame * 0.26));
    offsetY = -bounce * 55;
    scaleY = 1 + bounce * 0.09;
    scaleX = 1 - bounce * 0.06;
    leftArmAngle = 130 + Math.sin(frame * 0.35) * 20;
    rightArmAngle = -130 - Math.sin(frame * 0.35) * 20;
  } else if (bodyAnim === 'shiver_fear') {
    offsetX = Math.sin(frame * 1.5) * 8;
    rotation = Math.sin(frame * 1.3) * 4.5;
    leftArmAngle = -35;
    rightArmAngle = 35;
  } else if (bodyAnim === 'spin_celebrate') {
    const spin = spring({ frame, fps, config: { damping: 12, stiffness: 85 } });
    rotation = interpolate(spin, [0, 1], [0, 360]);
    offsetY = -Math.sin(Math.min(1, frame / 28) * Math.PI) * 95;
    leftArmAngle = 148;
    rightArmAngle = -148;
  } else if (bodyAnim === 'heartbeat_tense') {
    const beat = Math.pow(Math.abs(Math.sin(frame * 0.22)), 6);
    scaleX = 1 + beat * 0.15;
    scaleY = 1 + beat * 0.15;
  } else if (bodyAnim === 'slump_sad') {
    offsetY = 26;
    rotation = -13;
    scaleY = 0.91;
    leftArmAngle = 8;
    rightArmAngle = -8;
  } else if (bodyAnim === 'wave_greet') {
    rotation = Math.sin(frame * 0.09) * 5;
    rightArmAngle = -138 + Math.sin(frame * 0.4) * 28;
    leftArmAngle = 22 + actPulse * 16;
  } else {
    offsetY = Math.sin(frame * 0.09) * 16;
    rotation = Math.sin(frame * 0.06) * 5;
    leftArmAngle = 35 + actPulse * 35;
    rightArmAngle = -35 - actPulse * 35;
  }

  return (
    <g
      transform={`translate(${960 + offsetX}, ${550 + offsetY}) rotate(${rotation}) scale(${scaleX}, ${scaleY})`}
    >
      {/* Dynamic Contact Shadow */}
      <ellipse
        cx="0"
        cy={250 - offsetY}
        rx={145 + offsetY * 0.4}
        ry="22"
        fill="rgba(0,0,0,0.45)"
      />

      {/* Floating Comic/Pixar Emotion Indicator above Head */}
      {isShocked && (
        <g transform={`translate(115, ${-210 + Math.sin(frame * 0.4) * 8})`}>
          <rect x="-10" y="-42" width="20" height="44" rx="10" fill="#FACC15" stroke="#0F172A" strokeWidth="4" />
          <circle cx="0" cy="16" r="10" fill="#FACC15" stroke="#0F172A" strokeWidth="4" />
        </g>
      )}
      {emotion === 'curious' && (
        <text
          x="110"
          y={-195 + Math.sin(frame * 0.2) * 8}
          fontSize="68"
          fontWeight="900"
          fill="#38BDF8"
          stroke="#0F172A"
          strokeWidth="3"
          fontFamily="system-ui, sans-serif"
        >
          ?
        </text>
      )}
      {isHappy && (
        <g transform={`translate(115, ${-200 - (frame % 40) * 0.8})`} opacity={1 - (frame % 40) / 40}>
          <path
            d="M 0 12 C -18 -6, -34 10, 0 34 C 34 10, 18 -6, 0 12 Z"
            fill="#FB7185"
          />
        </g>
      )}

      {/* Expressive Cartoon Arms */}
      <g transform={`translate(-76, 10) rotate(${leftArmAngle})`}>
        <path
          d="M 0 0 Q -48 36 -68 78"
          fill="none"
          stroke="#0F172A"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <circle cx="-68" cy="78" r="13" fill="#FFFFFF" stroke="#0F172A" strokeWidth="5" />
      </g>
      <g transform={`translate(76, 10) rotate(${rightArmAngle})`}>
        <path
          d="M 0 0 Q 48 36 68 78"
          fill="none"
          stroke="#0F172A"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <circle cx="68" cy="78" r="13" fill="#FFFFFF" stroke="#0F172A" strokeWidth="5" />
      </g>

      {/* 3D-Styled Object Body */}
      {objectType === 'pencil' ? (
        <g>
          <rect x="-44" y="-235" width="88" height="45" rx="14" fill="#F43F5E" />
          <rect x="-46" y="-195" width="92" height="24" fill="#CBD5E1" />
          <rect x="-44" y="-171" width="88" height="310" fill={primaryColor || '#F59E0B'} />
          <rect x="-14" y="-171" width="28" height="310" fill={accentColor || '#D97706'} opacity="0.45" />
          <polygon points="-44,139 44,139 0,225" fill="#FDE68A" />
          <polygon points="-14,198 14,198 0,225" fill="#1E293B" />
        </g>
      ) : objectType === 'note' || objectType === 'ticket' ? (
        <g>
          <rect
            x="-195"
            y="-115"
            width="390"
            height="230"
            rx="18"
            fill={primaryColor || '#D97706'}
            stroke={accentColor || '#FEF3C7'}
            strokeWidth="8"
          />
          <rect
            x="-170"
            y="-90"
            width="340"
            height="180"
            rx="12"
            fill="none"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="3"
            strokeDasharray="10 6"
          />
        </g>
      ) : objectType === 'ball' ? (
        <g>
          <circle cx="0" cy="10" r="158" fill={primaryColor || '#DC2626'} />
          <path d="M -110 -95 Q 0 10 -110 115" fill="none" stroke="#F8FAFC" strokeWidth="5" strokeDasharray="10 8" />
          <path d="M 110 -95 Q 0 10 110 115" fill="none" stroke="#F8FAFC" strokeWidth="5" strokeDasharray="10 8" />
        </g>
      ) : (
        <g>
          <rect x="-38" y="-225" width="76" height="36" rx="8" fill={accentColor || '#0284C7'} />
          <path
            d="M -34 -189 L -88 -120 L -88 185 Q -88 215 -55 215 L 55 215 Q 88 215 88 185 L 88 -120 L 34 -189 Z"
            fill={primaryColor || '#38BDF8'}
          />
          <rect x="-60" y="-100" width="18" height="270" rx="9" fill="rgba(255,255,255,0.35)" />
        </g>
      )}

      {/* Expressive Eyes & Mouth */}
      <g transform="translate(0, -15)">
        {isBlinking ? (
          <>
            <line x1="-60" y1="0" x2="-18" y2="0" stroke="#0F172A" strokeWidth="6" strokeLinecap="round" />
            <line x1="18" y1="0" x2="60" y2="0" stroke="#0F172A" strokeWidth="6" strokeLinecap="round" />
          </>
        ) : (
          <>
            <circle cx="-38" cy="0" r={isShocked ? 28 : 24} fill="#FFFFFF" />
            <circle cx="38" cy="0" r={isShocked ? 28 : 24} fill="#FFFFFF" />
            <circle cx="-34" cy={isSad ? 6 : -2} r={isShocked ? 9 : 12} fill="#0F172A" />
            <circle cx="42" cy={isSad ? 6 : -2} r={isShocked ? 9 : 12} fill="#0F172A" />
            <circle cx="-39" cy={isSad ? 1 : -7} r="4.5" fill="#FFFFFF" />
            <circle cx="37" cy={isSad ? 1 : -7} r="4.5" fill="#FFFFFF" />
          </>
        )}

        {isSad && (
          <circle
            cx="-56"
            cy={24 + (frame % 35) * 2.2}
            r={Math.max(0, 7 - (frame % 35) * 0.15)}
            fill="#38BDF8"
          />
        )}

        {isSad ? (
          <>
            <line x1="-64" y1="-26" x2="-18" y2="-38" stroke="#0F172A" strokeWidth="6" strokeLinecap="round" />
            <line x1="18" y1="-38" x2="64" y2="-26" stroke="#0F172A" strokeWidth="6" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d="M -62 -32 Q -38 -46 -16 -32" fill="none" stroke="#0F172A" strokeWidth="6" strokeLinecap="round" />
            <path d="M 16 -32 Q 38 -46 62 -32" fill="none" stroke="#0F172A" strokeWidth="6" strokeLinecap="round" />
          </>
        )}

        {isShocked ? (
          <ellipse cx="0" cy="52" rx="18" ry="22" fill="#0F172A" />
        ) : mouthOpen ? (
          <ellipse cx="0" cy="48" rx="17" ry={8 + actPulse * 7} fill="#0F172A" />
        ) : isSad ? (
          <path d="M -24 56 Q 0 38 24 56" fill="none" stroke="#0F172A" strokeWidth="5.5" strokeLinecap="round" />
        ) : (
          <path d="M -26 44 Q 0 64 26 44" fill="none" stroke="#0F172A" strokeWidth="5.5" strokeLinecap="round" />
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
  const { fps, durationInFrames } = useVideoConfig();
  const palette = SETTING_PALETTES[scene.setting] || SETTING_PALETTES.home_desk;

  const subPop = spring({ frame, fps, config: { damping: 15, stiffness: 140 } });

  // Continuous Ken Burns camera motion
  const camScale =
    scene.cameraMove === 'zoom_in'
      ? interpolate(frame, [0, durationInFrames], [1.0, 1.13])
      : scene.cameraMove === 'zoom_out'
      ? interpolate(frame, [0, durationInFrames], [1.13, 1.0])
      : 1.06;

  const camPanX =
    scene.cameraMove === 'pan_left'
      ? interpolate(frame, [0, durationInFrames], [32, -32])
      : scene.cameraMove === 'pan_right'
      ? interpolate(frame, [0, durationInFrames], [-32, 32])
      : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: palette.top, overflow: 'hidden' }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          transform: `translateX(${camPanX}px) scale(${camScale})`,
        }}
      >
        <svg width="1920" height="1080" viewBox="0 0 1920 1080">
          <defs>
            <linearGradient id={`bg-${scene.setting}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={palette.top} />
              <stop offset="100%" stopColor={palette.bottom} />
            </linearGradient>
            <radialGradient id={`spot-${scene.setting}`} cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor={palette.light} stopOpacity="0.34" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.48" />
            </radialGradient>
          </defs>

          <rect width="1920" height="820" fill={`url(#bg-${scene.setting})`} />
          <rect x="0" y="780" width="1920" height="300" fill={palette.floor} />

          {/* Parallax Distant Skyline / Trees / Shelves */}
          {(scene.setting === 'school_outdoor' || scene.setting === 'rainy_street') && (
            <g transform={`translate(${-camPanX * 0.4}, 0)`} opacity="0.35">
              <rect x="120" y="420" width="140" height="360" fill={palette.propColor} />
              <rect x="300" y="340" width="180" height="440" fill={palette.propColor} />
              <rect x="1420" y="380" width="160" height="400" fill={palette.propColor} />
              <rect x="1620" y="310" width="200" height="470" fill={palette.propColor} />
            </g>
          )}

          {/* Home Desk Study Lamp & Warm Beam */}
          {scene.setting === 'home_desk' && (
            <g transform="translate(1520, 320)">
              <polygon points="-40,80 40,80 180,460 -180,460" fill="#FDE047" opacity="0.14" />
              <path d="M -45 80 L 45 80 L 25 25 L -25 25 Z" fill="#F59E0B" />
              <rect x="-6" y="80" width="12" height="380" fill="#475569" />
            </g>
          )}

          {/* Moving Factory Conveyor Belt */}
          {scene.setting === 'factory' && (
            <g>
              <rect x="0" y="775" width="1920" height="30" fill="#0F172A" />
              {Array.from({ length: 16 }).map((_, i) => {
                const beltX = ((i * 130 + frame * 7) % 2080) - 80;
                return <circle key={i} cx={beltX} cy="790" r="9" fill="#94A3B8" />;
              })}
            </g>
          )}

          <rect width="1920" height="1080" fill={`url(#spot-${scene.setting})`} />

          {/* Floating Golden Dust / Fireflies */}
          {(scene.setting === 'home_desk' ||
            scene.setting === 'store_shelf' ||
            scene.setting === 'recycling_light') &&
            Array.from({ length: 20 }).map((_, i) => {
              const px = (i * 113 + Math.sin(frame * 0.03 + i) * 45) % 1920;
              const py = 1080 - ((i * 67 + frame * 1.9) % 920);
              return (
                <circle key={i} cx={px} cy={py} r={3 + (i % 4)} fill="#FEF08A" opacity="0.5" />
              );
            })}

          {/* Animated Rain Streaks */}
          {scene.setting === 'rainy_street' &&
            Array.from({ length: 36 }).map((_, i) => {
              const rx = (i * 67 + frame * 12) % 1920;
              const ry = (i * 131 + frame * 29) % 1080;
              return (
                <line
                  key={i}
                  x1={rx}
                  y1={ry}
                  x2={rx - 12}
                  y2={ry + 38}
                  stroke="rgba(186,230,253,0.45)"
                  strokeWidth="2.5"
                />
              );
            })}

          {/* Expressive Animated Object Character */}
          <AnimatedObjectCharacter
            objectType={episode.objectType}
            primaryColor={episode.primaryColor}
            accentColor={episode.accentColor}
            emotion={scene.emotion}
            bodyAnim={scene.bodyAnim}
          />
        </svg>
      </div>

      {/* Top-Left Chapter Pill */}
      <div
        style={{
          position: 'absolute',
          top: 44,
          left: 60,
          backgroundColor: 'rgba(15, 23, 42, 0.82)',
          border: '2px solid rgba(255,255,255,0.25)',
          color: '#F8FAFC',
          padding: '10px 24px',
          borderRadius: 999,
          fontFamily: 'system-ui, sans-serif',
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: 1.4,
        }}
      >
        {episode.objectName.toUpperCase()} • {scene.chapter}
      </div>

      {/* Kinetic Story Caption Card */}
      <div
        style={{
          position: 'absolute',
          bottom: 58,
          left: 160,
          right: 160,
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
          fontSize: 44,
          fontWeight: 800,
          color: '#FFFFFF',
          backgroundColor: 'rgba(9, 13, 22, 0.86)',
          border: '2px solid rgba(255,255,255,0.16)',
          padding: '18px 34px',
          borderRadius: 18,
          transform: `translateY(${interpolate(subPop, [0, 1], [24, 0])}px) scale(${interpolate(subPop, [0, 1], [0.94, 1])})`,
          opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateRight: 'clamp' }),
        }}
      >
        {scene.subtitle}
      </div>
    </AbsoluteFill>
  );
};

const getTransitionPresentation = (type: SceneItem['transition']) => {
  switch (type) {
    case 'slide_up':
      return slide({ direction: 'from-bottom' });
    case 'wipe_diagonal':
      return wipe({ direction: 'from-top-left' });
    case 'flip_card':
      return flip({ direction: 'from-right' });
    case 'fade_smooth':
      return fade();
    case 'slide_left':
    default:
      return slide({ direction: 'from-right' });
  }
};

export const MainVideo: React.FC<{ episode: EpisodeData }> = ({ episode }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  if (!episode || !episode.scenes?.length) return null;

  const overlap = episode.overlapFrames ?? 15;
  const progressPct = interpolate(frame, [0, durationInFrames], [0, 100], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#090D16' }}>
      <TransitionSeries>
        {episode.scenes.map((scene, idx) => (
          <React.Fragment key={idx}>
            <TransitionSeries.Sequence durationInFrames={scene.durationInFrames}>
              <DocumentaryScene scene={scene} episode={episode} />
            </TransitionSeries.Sequence>
            {idx < episode.scenes.length - 1 && (
              <TransitionSeries.Transition
                presentation={getTransitionPresentation(scene.transition)}
                timing={linearTiming({ durationInFrames: overlap })}
              />
            )}
          </React.Fragment>
        ))}
      </TransitionSeries>

      {/* Subtle YouTube-Style Chapter Progress Bar along Bottom Edge */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: 8,
          width: `${progressPct}%`,
          backgroundColor: episode.primaryColor || '#38BDF8',
        }}
      />
    </AbsoluteFill>
  );
};
