import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Icon } from '@iconify/react';
import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { flip } from '@remotion/transitions/flip';

export interface SceneItem {
  chapter: string;
  narration: string;
  subtitle: string;
  coActor?: 'none' | 'boy' | 'girl' | 'dog' | 'shopkeeper' | 'worker';
  interaction?:
    | 'solo_hero'
    | 'throw_catch'
    | 'dog_chase'
    | 'hand_carry'
    | 'buy_exchange'
    | 'drop_abandon';
  emotion: 'happy' | 'curious' | 'proud' | 'sad' | 'lonely' | 'hopeful' | 'shocked';
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

const OBJECT_ICON_MAP: Record<string, string> = {
  bag: 'fluent-emoji:backpack',
  pencil: 'fluent-emoji:pencil',
  bottle: 'fluent-emoji:cup-with-straw',
  note: 'fluent-emoji:dollar-banknote',
  charger: 'fluent-emoji:electric-plug',
  umbrella: 'fluent-emoji:umbrella',
  ball: 'fluent-emoji:cricket-game',
  teddy: 'fluent-emoji:teddy-bear',
  bench: 'fluent-emoji:chair',
  ticket: 'fluent-emoji:admission-tickets',
  light: 'fluent-emoji:light-bulb',
  slipper: 'fluent-emoji:thong-sandal',
};

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

/* === ANIMATED HUMAN CHARACTER (Boy / Girl / Shopkeeper / Worker) === */
const HumanActor: React.FC<{
  role: 'boy' | 'girl' | 'shopkeeper' | 'worker';
  x: number;
  y: number;
  facing: 1 | -1;
  pose: 'run' | 'catch_arms_up' | 'walk_carry' | 'hand_over' | 'walk_away';
}> = ({ role, x, y, facing, pose }) => {
  const frame = useCurrentFrame();
  const stride = Math.sin(frame * 0.35);

  const shirtColor =
    role === 'boy'
      ? '#2563EB'
      : role === 'girl'
      ? '#EC4899'
      : role === 'shopkeeper'
      ? '#D97706'
      : '#475569';

  const leftLeg = pose === 'run' || pose === 'walk_carry' || pose === 'walk_away' ? stride * 36 : -8;
  const rightLeg = pose === 'run' || pose === 'walk_carry' || pose === 'walk_away' ? -stride * 36 : 8;

  let leftArm = 20;
  let rightArm = -20;
  if (pose === 'catch_arms_up') {
    leftArm = -145 + Math.sin(frame * 0.3) * 8;
    rightArm = -135 - Math.sin(frame * 0.3) * 8;
  } else if (pose === 'walk_carry' || pose === 'hand_over') {
    leftArm = -65;
    rightArm = -75;
  } else if (pose === 'run' || pose === 'walk_away') {
    leftArm = -stride * 42;
    rightArm = stride * 42;
  }

  const bob = pose === 'run' ? Math.abs(stride) * -14 : Math.abs(stride) * -5;

  return (
    <g transform={`translate(${x}, ${y + bob}) scale(${facing}, 1)`}>
      {/* Ground Shadow */}
      <ellipse cx="0" cy={210 - bob} rx="65" ry="14" fill="rgba(0,0,0,0.35)" />

      {/* Legs */}
      <g transform={`translate(-18, 75) rotate(${leftLeg})`}>
        <rect x="-12" y="0" width="24" height="115" rx="12" fill="#1E293B" />
      </g>
      <g transform={`translate(18, 75) rotate(${rightLeg})`}>
        <rect x="-12" y="0" width="24" height="115" rx="12" fill="#0F172A" />
      </g>

      {/* Torso */}
      <rect x="-42" y="-55" width="84" height="145" rx="28" fill={shirtColor} />

      {/* Head */}
      <circle cx="0" cy="-105" r="46" fill="#FDBA74" />
      {/* Hair */}
      {role === 'girl' ? (
        <>
          <path d="M -46 -105 Q 0 -170 46 -105 Z" fill="#1E293B" />
          <circle cx="-48" cy="-115" r="22" fill="#1E293B" />
        </>
      ) : (
        <path d="M -46 -110 Q 0 -168 46 -110 Z" fill="#0F172A" />
      )}

      {/* Happy Eyes & Smile */}
      <circle cx="14" cy="-108" r="5.5" fill="#0F172A" />
      <circle cx="32" cy="-108" r="5.5" fill="#0F172A" />
      <path d="M 14 -88 Q 24 -76 34 -88" fill="none" stroke="#0F172A" strokeWidth="4.5" strokeLinecap="round" />

      {/* Front & Back Arms */}
      <g transform={`translate(10, -35) rotate(${rightArm})`}>
        <rect x="-10" y="0" width="20" height="95" rx="10" fill="#FDBA74" />
      </g>
      <g transform={`translate(-10, -35) rotate(${leftArm})`}>
        <rect x="-10" y="0" width="20" height="95" rx="10" fill="#FB923C" />
      </g>
    </g>
  );
};

/* === ANIMATED PLAYFUL DOG === */
const DogActor: React.FC<{ x: number; y: number }> = ({ x, y }) => {
  const frame = useCurrentFrame();
  const runCycle = Math.sin(frame * 0.45);
  const hopY = Math.abs(runCycle) * -22;
  const tailWag = Math.sin(frame * 0.8) * 28;

  return (
    <g transform={`translate(${x}, ${y + hopY})`}>
      <ellipse cx="0" cy={95 - hopY} rx="75" ry="14" fill="rgba(0,0,0,0.35)" />

      {/* Wagging Tail */}
      <g transform={`translate(-75, -15) rotate(${tailWag})`}>
        <path d="M 0 0 Q -35 -35 -20 -60" fill="none" stroke="#92400E" strokeWidth="14" strokeLinecap="round" />
      </g>

      {/* Running Legs */}
      <g transform={`translate(-45, 35) rotate(${runCycle * 40})`}>
        <rect x="-9" y="0" width="18" height="55" rx="9" fill="#78350F" />
      </g>
      <g transform={`translate(45, 35) rotate(${-runCycle * 40})`}>
        <rect x="-9" y="0" width="18" height="55" rx="9" fill="#78350F" />
      </g>

      {/* Dog Body */}
      <rect x="-80" y="-25" width="160" height="75" rx="36" fill="#B45309" />
      {/* Collar */}
      <rect x="42" y="-28" width="18" height="72" rx="8" fill="#EF4444" />

      {/* Dog Head & Snout */}
      <g transform={`translate(85, -35) rotate(${Math.sin(frame * 0.25) * 6})`}>
        <circle cx="0" cy="0" r="42" fill="#B45309" />
        <ellipse cx="32" cy="10" rx="26" ry="18" fill="#FDE68A" />
        <circle cx="52" cy="4" r="8" fill="#0F172A" />
        {/* Floppy Ear */}
        <ellipse cx="-16" cy="8" rx="14" ry="30" fill="#78350F" />
        {/* Excited Eye & Tongue */}
        <circle cx="14" cy="-10" r="6" fill="#0F172A" />
        <circle cx="12" cy="-12" r="2" fill="#FFFFFF" />
        <path d="M 28 24 Q 36 42 44 24" fill="#FB7185" />
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

  const progress = frame / Math.max(1, durationInFrames);
  const subPop = spring({ frame, fps, config: { damping: 15, stiffness: 140 } });

  const coActor = scene.coActor || 'none';
  const interaction = scene.interaction || 'solo_hero';

  // === CHOREOGRAPH POSITIONS OF BOTH HERO OBJECT & CO-ACTOR ===
  let objX = 960;
  let objY = 560 + Math.sin(frame * 0.08) * 10;
  let objScale = 1;
  let objRot = Math.sin(frame * 0.06) * 4;

  let actorX = -300;
  let actorY = 620;
  let actorFacing: 1 | -1 = 1;
  let actorPose: 'run' | 'catch_arms_up' | 'walk_carry' | 'hand_over' | 'walk_away' = 'run';

  if (interaction === 'throw_catch') {
    // Boy/Girl runs in from right with arms up and catches the flying object!
    objX = interpolate(progress, [0, 0.75, 1], [320, 1240, 1240]);
    const arc = progress < 0.75 ? Math.sin((progress / 0.75) * Math.PI) * 340 : 0;
    objY = 540 - arc;
    objRot = progress < 0.75 ? frame * 12 : 0;
    objScale = 0.65;

    actorX = interpolate(progress, [0, 0.65, 1], [1560, 1300, 1300]);
    actorFacing = -1;
    actorPose = progress < 0.65 ? 'run' : 'catch_arms_up';
  } else if (interaction === 'dog_chase') {
    // Object bounces across the screen while the dog chases right behind it!
    objX = interpolate(progress, [0, 1], [540, 1620]);
    objY = 670 - Math.abs(Math.sin(frame * 0.25)) * 150;
    objRot = frame * 10;
    objScale = 0.62;

    actorX = interpolate(progress, [0, 1], [180, 1260]);
    actorY = 710;
  } else if (interaction === 'hand_carry') {
    // Boy/Girl walks happily carrying the object beside them
    actorX = interpolate(progress, [0, 1], [420, 1380]);
    actorFacing = 1;
    actorPose = 'walk_carry';

    objX = actorX + 95;
    objY = 580 + Math.abs(Math.sin(frame * 0.35)) * -10;
    objScale = 0.68;
  } else if (interaction === 'buy_exchange') {
    // Shopkeeper on left hands object to buyer on right
    actorX = 640;
    actorFacing = 1;
    actorPose = 'hand_over';

    objX = interpolate(progress, [0, 1], [760, 1140]);
    objY = 540 - Math.sin(progress * Math.PI) * 70;
    objScale = 0.72;
  } else if (interaction === 'drop_abandon') {
    // Object falls down in sadness while person walks away off-screen
    objX = 760;
    objY = interpolate(progress, [0, 0.35, 1], [500, 690, 690]);
    objRot = interpolate(progress, [0, 0.35, 1], [0, -28, -28]);
    objScale = 0.78;

    actorX = interpolate(progress, [0, 1], [960, 1780]);
    actorFacing = 1;
    actorPose = 'walk_away';
  }

  const isSad = scene.emotion === 'sad' || scene.emotion === 'lonely';
  const isShocked = scene.emotion === 'shocked';
  const isBlinking = frame % 95 > 90;
  const mouthOpen = Math.abs(Math.sin(frame * 0.35)) > 0.48;
  const chosenIcon = OBJECT_ICON_MAP[episode.objectType] || OBJECT_ICON_MAP.ball;

  // Ken Burns Camera Motion
  const camScale =
    scene.cameraMove === 'zoom_in'
      ? interpolate(frame, [0, durationInFrames], [1.0, 1.1])
      : scene.cameraMove === 'zoom_out'
      ? interpolate(frame, [0, durationInFrames], [1.1, 1.0])
      : 1.04;

  return (
    <AbsoluteFill style={{ backgroundColor: palette.top, overflow: 'hidden' }}>
      <div style={{ width: '100%', height: '100%', transform: `scale(${camScale})` }}>
        <svg width="1920" height="1080" viewBox="0 0 1920 1080">
          <defs>
            <linearGradient id={`bg-${scene.setting}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={palette.top} />
              <stop offset="100%" stopColor={palette.bottom} />
            </linearGradient>
            <radialGradient id={`spot-${scene.setting}`} cx="50%" cy="45%" r="55%">
              <stop offset="0%" stopColor={palette.light} stopOpacity="0.3" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.45" />
            </radialGradient>
          </defs>

          <rect width="1920" height="820" fill={`url(#bg-${scene.setting})`} />
          <rect x="0" y="780" width="1920" height="300" fill={palette.floor} />
          <rect width="1920" height="1080" fill={`url(#spot-${scene.setting})`} />

          {/* Rain Streaks for Dark/Rainy Scenes */}
          {scene.setting === 'rainy_street' &&
            Array.from({ length: 34 }).map((_, i) => {
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

          {/* === RENDER SECONDARY CO-ACTOR (Boy / Girl / Dog / Shopkeeper / Worker) === */}
          {coActor === 'dog' && <DogActor x={actorX} y={actorY} />}
          {(coActor === 'boy' ||
            coActor === 'girl' ||
            coActor === 'shopkeeper' ||
            coActor === 'worker') && (
            <HumanActor
              role={coActor}
              x={actorX}
              y={actorY}
              facing={actorFacing}
              pose={actorPose}
            />
          )}

          {/* Extra Second Kid on Right during Shop Purchase */}
          {interaction === 'buy_exchange' && (
            <HumanActor role="boy" x={1260} y={620} facing={-1} pose="catch_arms_up" />
          )}
        </svg>

        {/* === HERO OBJECT CHARACTER (Positioned dynamically inside the action) === */}
        <div
          style={{
            position: 'absolute',
            left: objX,
            top: objY,
            transform: `translate(-50%, -50%) rotate(${objRot}deg) scale(${objScale})`,
            width: 380,
            height: 380,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon icon={chosenIcon} width={330} height={330} />

          {/* Expressive Eyes & Mouth on the Object */}
          <svg
            width="380"
            height="380"
            viewBox="-190 -190 380 380"
            style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
          >
            <g transform="translate(0, 5)">
              {isBlinking ? (
                <>
                  <line x1="-54" y1="0" x2="-16" y2="0" stroke="#0F172A" strokeWidth="6" strokeLinecap="round" />
                  <line x1="16" y1="0" x2="54" y2="0" stroke="#0F172A" strokeWidth="6" strokeLinecap="round" />
                </>
              ) : (
                <>
                  <circle cx="-35" cy="0" r={isShocked ? 25 : 21} fill="#FFFFFF" stroke="#0F172A" strokeWidth="3.5" />
                  <circle cx="35" cy="0" r={isShocked ? 25 : 21} fill="#FFFFFF" stroke="#0F172A" strokeWidth="3.5" />
                  <circle cx="-31" cy={isSad ? 5 : -2} r={isShocked ? 8 : 10.5} fill="#0F172A" />
                  <circle cx="39" cy={isSad ? 5 : -2} r={isShocked ? 8 : 10.5} fill="#0F172A" />
                  <circle cx="-36" cy={isSad ? 0 : -6} r="4" fill="#FFFFFF" />
                  <circle cx="34" cy={isSad ? 0 : -6} r="4" fill="#FFFFFF" />
                </>
              )}

              {isSad && (
                <circle
                  cx="-52"
                  cy={22 + (frame % 35) * 2}
                  r={Math.max(0, 6.5 - (frame % 35) * 0.15)}
                  fill="#38BDF8"
                />
              )}

              {mouthOpen ? (
                <ellipse cx="0" cy="44" rx="15" ry="11" fill="#0F172A" />
              ) : isSad ? (
                <path d="M -22 52 Q 0 36 22 52" fill="none" stroke="#0F172A" strokeWidth="5" strokeLinecap="round" />
              ) : (
                <path d="M -24 42 Q 0 60 24 42" fill="none" stroke="#0F172A" strokeWidth="5" strokeLinecap="round" />
              )}
            </g>
          </svg>
        </div>
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

      {/* Bottom Subtitle */}
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
          transform: `translateY(${interpolate(subPop, [0, 1], [24, 0])}px)`,
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
