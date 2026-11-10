import React from "react";
import {
  AbsoluteFill,
  Easing,
  Html5Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Bulbs, C, CAPS, Caption, LayoutCtx, PhoneScene, Room, Seg, display, mono, sans, segFrames, useLayout } from "./Hero";

// The 2.0 video: the problem, the game, and what happens behind the scenes.
// Timed to upgrade-voiceover.json; scene starts are noted in seconds.

const FPS = 30;
const XS = 10; // crossfade between scenes, frames
const sec = (s: number) => Math.round(s * FPS);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Phone clips, in seconds of public/game.mp4.
const PHONE_A: Seg[] = [
  { from: 3.1, to: 3.1, rate: 1, cap: 0, hold: 4.03 }, // 9.6 s: Meet Movie Match
  { from: 3.2, to: 5.8, rate: 1.4, cap: 10 }, // 13.6 s: services
  { from: 6.0, to: 7.6, rate: 1, cap: 1 }, // moods
  { from: 8.45, to: 9.95, rate: 1, cap: 2 }, // pass the phone
  { from: 9.95, to: 9.95, rate: 1, cap: 2, hold: 0.6 },
  { from: 21.9, to: 31.0, rate: 1.6, cap: 11 }, // 19.2 s: Round 2
  { from: 33.0, to: 34.2, rate: 1, cap: 11 },
];
const PHONE_B: Seg[] = [
  { from: 59.8, to: 62.3, rate: 1, cap: 4 }, // 48.1 s: Round 3
  { from: 65.9, to: 67.3, rate: 1, cap: 4 },
  { from: 67.6, to: 72.9, rate: 1, cap: 16 }, // the match and its score
  { from: 72.9, to: 72.9, rate: 1, cap: 6, hold: 3.6 }, // end card
];
const phoneFrames = (segs: Seg[]) => segs.reduce((n, s) => n + segFrames(s, FPS), 0);

const SCENES = {
  couch: sec(9.6), // 0 s
  phoneA: phoneFrames(PHONE_A), // 9.6 s
  map: sec(16.6), // 26.1 s
  filter: sec(5.4), // 42.7 s
  phoneB: phoneFrames(PHONE_B), // 48.1 s
};
export const upgradeFrames = Object.values(SCENES).reduce((a, b) => a + b, 0);

export const Upgrade: React.FC<{ portrait?: boolean; audio?: string }> = ({ portrait = false, audio }) => {
  const { width, height } = useVideoConfig();
  let at = 0;
  const scene = (dur: number, node: React.ReactNode, first = false, last = false) => {
    const from = at;
    at += dur;
    return (
      <Sequence key={from} from={from} durationInFrames={dur + (last ? 0 : XS)} premountFor={FPS}>
        <Fade dur={dur} first={first} last={last}>
          {node}
        </Fade>
      </Sequence>
    );
  };
  return (
    <LayoutCtx.Provider value={{ width, height, portrait, segs: [] }}>
      <AbsoluteFill style={{ backgroundColor: C.projection }}>
        <Room />
        <Bulbs />
        {scene(SCENES.couch, <Couch />, true)}
        {scene(SCENES.phoneA, <PhoneScene segs={PHONE_A} tail={XS} />)}
        {scene(SCENES.map, <MapScene />)}
        {scene(SCENES.filter, <FilterScene />)}
        {scene(SCENES.phoneB, <PhoneScene segs={PHONE_B} holdLast />, false, true)}
        {audio && <Html5Audio src={staticFile(audio)} />}
      </AbsoluteFill>
    </LayoutCtx.Provider>
  );
};

const Fade: React.FC<{ dur: number; first: boolean; last: boolean; children: React.ReactNode }> = ({
  dur,
  first,
  last,
  children,
}) => {
  const frame = useCurrentFrame();
  const fadeIn = first ? 1 : interpolate(frame, [0, XS], [0, 1], clamp);
  const fadeOut = last ? 1 : interpolate(frame, [dur, dur + XS], [1, 0], clamp);
  return <AbsoluteFill style={{ opacity: fadeIn * fadeOut }}>{children}</AbsoluteFill>;
};

// A 1000 x 1000 drawing area where the phone sits, with captions beside or above it.
const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { width, height, portrait } = useLayout();
  const size = portrait ? 960 : 820;
  const cx = portrait ? width / 2 : 575;
  const cy = portrait ? height - 96 - 643 : height / 2 + 18;
  return (
    <div style={{ position: "absolute", left: cx - size / 2, top: cy - size / 2, width: size, height: size }}>
      <div style={{ position: "relative", width: 1000, height: 1000, scale: String(size / 1000), transformOrigin: "0 0" }}>
        {children}
      </div>
    </div>
  );
};

const StageCaptions: React.FC<{ blocks: { cap: number; from: number; dur: number; instant?: boolean }[] }> = ({ blocks }) => (
  <>
    {blocks.map((b, i) => (
      <Sequence key={i} from={b.from} durationInFrames={b.dur} premountFor={FPS}>
        <Caption cap={CAPS[b.cap]} dur={b.dur} fast={false} last={false} instant={!!b.instant} />
      </Sequence>
    ))}
  </>
);

const Label: React.FC<{ x: number; y: number; children: React.ReactNode; color?: string; size?: number; opacity?: number }> = ({
  x,
  y,
  children,
  color = "rgba(242,232,213,0.82)",
  size = 21,
  opacity = 1,
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      fontFamily: mono,
      fontWeight: 700,
      fontSize: size,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color,
      opacity,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </div>
);

// Small deterministic random numbers, so every render draws the same picture.
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const TILE_COLORS = ["#5a2a24", "#3b2f28", "#6b4a2a", "#2e3a3a", "#4a2638", "#7a5a30", "#33302c", "#583a2c"];

// ---- 1. The problem: a couple on the couch, scrolling ---------------------------------
const STOP = 4.0; // the scrolling stops on a film...
const LOCK = 5.0; // ...that isn't on their service
const SLUMP = 7.7; // about to give up

const Couch: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;

  // Scrolling at a steady speed, then easing to a stop (same speed at the hand-over).
  const v = 300;
  const u = interpolate(t, [STOP, STOP + 0.7], [0, 1], clamp);
  const pos = t < STOP ? v * t : v * STOP + v * 0.35 * (1 - (1 - u) * (1 - u));
  const endPos = v * STOP + v * 0.35;
  const ROW = 166;
  const picked = Math.round((endPos + 80) / ROW);
  const focus = interpolate(t, [STOP + 0.55, STOP + 0.9], [0, 1], clamp);
  const lock = spring({ frame: frame - sec(LOCK), fps: FPS, config: { damping: 200 }, durationInFrames: 14 });
  const slump = interpolate(t, [SLUMP, SLUMP + 0.9], [0, 1], { ...clamp, easing: Easing.bezier(0.33, 0, 0.2, 1) });
  const look = interpolate(t, [LOCK + 0.4, LOCK + 1.0], [0, 1], clamp) * (1 - slump);

  const first = Math.floor(pos / ROW) - 1;
  const tiles: React.ReactNode[] = [];
  for (let r = first; r < first + 5; r++) {
    for (let c = 0; c < 5; c++) {
      const x = 208 + c * 120;
      const y = 150 + r * ROW - pos;
      const isPick = r === picked && c === 2;
      const color = TILE_COLORS[Math.abs(r * 5 + c * 3) % TILE_COLORS.length];
      tiles.push(
        <g key={`${r}-${c}`} opacity={isPick ? 1 : 1 - 0.7 * focus}>
          <rect x={x} y={y} width={104} height={150} rx={10} fill={color} />
          <rect x={x + 12} y={y + 118} width={60} height={9} rx={4} fill="rgba(242,232,213,0.35)" />
          {isPick && <rect x={x - 4} y={y - 4} width={112} height={158} rx={13} fill="none" stroke={C.brass} strokeWidth={5} opacity={focus} />}
        </g>,
      );
    }
  }
  const pickY = 150 + picked * ROW - endPos;

  const ink = { stroke: C.cream, strokeWidth: 6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const clock = t * 300 * (1 - slump * 0.6);

  return (
    <>
      <Stage>
        <svg width={1000} height={1000} viewBox="0 0 1000 1000" style={{ position: "absolute", inset: 0 }}>
          <defs>
            <clipPath id="screen">
              <rect x={190} y={130} width={620} height={350} rx={8} />
            </clipPath>
            <radialGradient id="tvglow" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="rgba(214,162,74,0.20)" />
              <stop offset="100%" stopColor="rgba(214,162,74,0)" />
            </radialGradient>
          </defs>
          <rect x={60} y={60} width={880} height={760} fill="url(#tvglow)" opacity={1 - slump * 0.6} />

          {/* wall clock, spinning: time passing */}
          <circle cx={92} cy={150} r={42} fill="none" {...ink} strokeWidth={5} opacity={0.75} />
          <line x1={92} y1={150} x2={92 + 28 * Math.sin((clock * Math.PI) / 180)} y2={150 - 28 * Math.cos((clock * Math.PI) / 180)} {...ink} strokeWidth={5} opacity={0.75} />
          <line x1={92} y1={150} x2={92 + 18 * Math.sin((clock * Math.PI) / 2160)} y2={150 - 18 * Math.cos((clock * Math.PI) / 2160)} {...ink} strokeWidth={5} opacity={0.75} />

          {/* the TV */}
          <rect x={170} y={110} width={660} height={390} rx={20} fill="#0b0807" {...ink} />
          <g clipPath="url(#screen)">
            {tiles}
            <rect x={190} y={130} width={620} height={350} fill="#000" opacity={slump * 0.55} />
          </g>
          {/* not on your plan */}
          <g opacity={lock * (1 - slump * 0.4)}>
            <rect x={442} y={pickY + 38} width={116} height={78} rx={10} fill="rgba(14,10,9,0.72)" />
            <rect x={481} y={pickY + 72} width={38} height={30} rx={5} fill={C.cream} />
            <path d={`M 488 ${pickY + 72} v -9 a 12 12 0 0 1 24 0 v 9`} fill="none" stroke={C.cream} strokeWidth={5} />
            <rect x={340} y={428} width={320} height={40} rx={20} fill={C.signal} />
            <text x={500} y={455} textAnchor="middle" fontFamily={mono} fontWeight={700} fontSize={19} letterSpacing="2" fill={C.cream}>
              NOT ON YOUR PLAN
            </text>
          </g>
          <line x1={500} y1={500} x2={500} y2={540} {...ink} />
          <line x1={420} y1={542} x2={580} y2={542} {...ink} />

          {/* the two of them, from behind */}
          <g transform={`translate(${-6 * look} ${14 * slump}) rotate(${-5 * look - 8 * slump} 390 640)`}>
            <path d="M 296 712 Q 300 664 390 658 Q 480 664 484 712" fill={C.projection} {...ink} />
            <circle cx={390} cy={600} r={56} fill={C.projection} {...ink} />
          </g>
          {/* his arm, holding the remote up, then dropping it */}
          <g opacity={1 - slump}>
            <line x1={462} y1={680} x2={interpolate(slump, [0, 1], [548, 520])} y2={interpolate(slump, [0, 1], [566, 690])} {...ink} />
            <rect x={536} y={530} width={24} height={46} rx={8} fill={C.projection} {...ink} strokeWidth={5} transform={`rotate(18 548 553) translate(0 ${120 * slump})`} />
          </g>
          <g transform={`translate(${-34 * slump + 4 * look} ${18 * slump}) rotate(${5 * look + 14 * slump} 612 640)`}>
            <path d="M 520 716 Q 524 668 612 662 Q 700 668 704 716" fill={C.projection} {...ink} />
            <circle cx={612} cy={606} r={54} fill={C.projection} {...ink} />
            <circle cx={612} cy={544} r={20} fill={C.projection} {...ink} strokeWidth={5} />
          </g>

          {/* the couch back, in front of them */}
          <rect x={92} y={630} width={96} height={250} rx={34} fill={C.projection} {...ink} />
          <rect x={812} y={630} width={96} height={250} rx={34} fill={C.projection} {...ink} />
          <rect x={150} y={690} width={700} height={190} rx={40} fill={C.projection} {...ink} />
          <line x1={500} y1={700} x2={500} y2={870} {...ink} strokeWidth={4} opacity={0.45} />
          <line x1={40} y1={905} x2={960} y2={905} {...ink} strokeWidth={4} opacity={0.35} />
        </svg>
      </Stage>
      <StageCaptions
        blocks={[
          { cap: 7, from: 0, dur: sec(STOP), instant: true },
          { cap: 8, from: sec(STOP), dur: sec(SLUMP - 0.1 - STOP) },
          { cap: 9, from: sec(SLUMP - 0.1), dur: SCENES.couch - sec(SLUMP - 0.1) },
        ]}
      />
    </>
  );
};

// ---- 2. Behind the scenes: the catalogue as a map, the search, the ranking --------------
// A schematic map: real counts and methods, illustrative positions.
type Dot = { x: number; y: number; c: number };
const DOTS: Dot[] = (() => {
  const r = rng(7);
  const centers = [
    [250, 330], [470, 270], [720, 330], [300, 600], [540, 520], [760, 640], [470, 740],
  ];
  const gauss = () => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r());
  const out: Dot[] = [];
  while (out.length < 900) {
    const c = Math.floor(r() * centers.length);
    const x = centers[c][0] + gauss() * 78;
    const y = centers[c][1] + gauss() * 62;
    if (x > 70 && x < 930 && y > 190 && y < 840) out.push({ x, y, c });
  }
  return out;
})();
const near = (px: number, py: number, k: number, skip: Set<number> = new Set()) =>
  DOTS.map((d, i) => ({ i, d: Math.hypot(d.x - px, d.y - py) }))
    .filter((e) => !skip.has(e.i))
    .sort((a, b) => a.d - b.d)
    .slice(0, k);
// Each player's Round 2 likes: four films around two spots on the map.
const LIKES = [near(370, 430, 4).map((e) => e.i), near(650, 565, 4).map((e) => e.i)];
const PRINTS = LIKES.map((ids) => ({
  x: ids.reduce((s, i) => s + DOTS[i].x, 0) / ids.length,
  y: ids.reduce((s, i) => s + DOTS[i].y, 0) / ids.length,
}));
const NEAREST = PRINTS.map((p, k) => near(p.x, p.y, 40, new Set(LIKES[k])));
// The shared seed: the midpoint of the closest pair of likes across the two players.
// The films nearest it go on both lists (up to 3), so a match is more likely.
const PAIR = (() => {
  let best = { a: LIKES[0][0], b: LIKES[1][0], d: Infinity };
  for (const a of LIKES[0])
    for (const b of LIKES[1]) {
      const d = Math.hypot(DOTS[a].x - DOTS[b].x, DOTS[a].y - DOTS[b].y);
      if (d < best.d) best = { a, b, d };
    }
  return best;
})();
const MID = { x: (DOTS[PAIR.a].x + DOTS[PAIR.b].x) / 2, y: (DOTS[PAIR.a].y + DOTS[PAIR.b].y) / 2 };
const SHARED = near(MID.x, MID.y, 40, new Set([...LIKES[0], ...LIKES[1]]));
const BOTH = new Set(SHARED.slice(0, 3).map((e) => e.i));
const PLAYER_COLOR = [C.brass, C.signal];
const TWO_TONE = `linear-gradient(135deg, ${C.brass} 0 50%, ${C.signal} 50% 100%)`;

const M = { dots: 0.1, likes: 2.0, prints: 2.6, search: 3.6, shared: 6.4, rank: 11.8 };
const WIDE = 1.55; // how far the circles open up to meet

const MapScene: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const counter = Math.round(15162 * interpolate(t, [0.2, 1.6], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }));
  const likeIn = spring({ frame: frame - sec(M.likes), fps: FPS, config: { damping: 14, stiffness: 160 }, durationInFrames: 18 });
  const printIn = interpolate(t, [M.prints, M.prints + 0.7], [0, 1], clamp);
  const reach = interpolate(t, [M.search, M.search + 1.6], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const widen = interpolate(t, [M.shared, M.shared + 1.2], [1, WIDE], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const pairIn = interpolate(t, [M.shared + 0.9, M.shared + 1.4], [0, 1], clamp);
  const sharedReach = interpolate(t, [M.shared + 1.5, M.shared + 2.8], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const bothIn = spring({ frame: frame - sec(M.shared + 2.9), fps: FPS, config: { damping: 12, stiffness: 140 }, durationInFrames: 20 });
  const toRank = interpolate(t, [M.rank, M.rank + 0.5], [0, 1], clamp);
  const marks = [M.likes, M.search, M.shared, M.rank];
  const step = t < M.search ? 0 : t < M.shared ? 1 : t < M.rank ? 2 : 3;
  const stepIn = interpolate(t, [marks[step], marks[step] + 0.4], [0, 1], clamp);
  const steps = [
    "Your likes, averaged: a taste fingerprint",
    "40 nearest each · cosine similarity · pgvector",
    "Where your tastes meet: up to 3 films for both lists",
    "Claude Sonnet 4.6 ranks both lists together",
  ];
  const sharedR = SHARED[SHARED.length - 1].d;

  return (
    <>
      <Stage>
        <div style={{ position: "absolute", left: 60, top: 18, fontFamily: display, fontWeight: 900, fontSize: 84, lineHeight: 1, color: C.brass }}>
          {counter.toLocaleString("en-US")} <span style={{ color: C.cream, fontSize: 52 }}>FILMS</span>
        </div>
        <Label x={62} y={118} opacity={interpolate(t, [0.5, 1.0], [0, 1], clamp)}>
          Each film = 1,536 numbers · OpenAI text-embedding-3-small
        </Label>

        <svg width={1000} height={1000} viewBox="0 0 1000 1000" style={{ position: "absolute", inset: 0, opacity: 1 - 0.82 * toRank }}>
          {DOTS.map((d, i) => {
            const appear = interpolate(frame, [sec(M.dots) + (i % 45), sec(M.dots) + (i % 45) + 8], [0, 1], clamp);
            return <circle key={i} cx={d.x} cy={d.y} r={3.4} fill={C.cream} opacity={0.32 * appear} />;
          })}
          {NEAREST.map((list, k) =>
            list.map((e) => {
              const lit = interpolate(reach * 1.08, [e.d / list[list.length - 1].d - 0.08, e.d / list[list.length - 1].d], [0, 1], clamp);
              const d = DOTS[e.i];
              return (
                <g key={`${k}-${e.i}`} opacity={lit * (1 - 0.45 * pairIn)}>
                  <line x1={PRINTS[k].x} y1={PRINTS[k].y} x2={d.x} y2={d.y} stroke={PLAYER_COLOR[k]} strokeWidth={1.4} opacity={0.45} />
                  <circle cx={d.x} cy={d.y} r={5.5} fill={PLAYER_COLOR[k]} />
                </g>
              );
            }),
          )}
          {PRINTS.map((p, k) => {
            const full = NEAREST[k][NEAREST[k].length - 1].d;
            const radius = full * reach * widen;
            return (
              <g key={k}>
                {LIKES[k].map((i) => (
                  <line key={i} x1={DOTS[i].x} y1={DOTS[i].y} x2={p.x} y2={p.y} stroke={PLAYER_COLOR[k]} strokeWidth={2.5} opacity={printIn * 0.8} />
                ))}
                {LIKES[k].map((i) => (
                  <circle key={`l${i}`} cx={DOTS[i].x} cy={DOTS[i].y} r={9 * likeIn} fill={PLAYER_COLOR[k]} stroke={C.projection} strokeWidth={2} />
                ))}
                <circle cx={p.x} cy={p.y} r={radius} fill="none" stroke={PLAYER_COLOR[k]} strokeWidth={2.5} strokeDasharray="8 10" opacity={0.7 * (reach > 0 ? 1 : 0)} />
                <g opacity={printIn}>
                  <circle cx={p.x} cy={p.y} r={19} fill={C.projection} stroke={PLAYER_COLOR[k]} strokeWidth={5} />
                  <circle cx={p.x} cy={p.y} r={7} fill={PLAYER_COLOR[k]} />
                  <text x={p.x} y={k === 0 ? p.y - full * WIDE - 18 : p.y + full * WIDE + 38} textAnchor="middle" fontFamily={mono} fontWeight={700} fontSize={20} letterSpacing="2" fill={PLAYER_COLOR[k]}>
                    {`PLAYER ${k + 1}`}
                  </text>
                </g>
              </g>
            );
          })}

          {/* where the two tastes meet */}
          <line
            x1={DOTS[PAIR.a].x}
            y1={DOTS[PAIR.a].y}
            x2={DOTS[PAIR.b].x}
            y2={DOTS[PAIR.b].y}
            stroke={C.cream}
            strokeWidth={2.5}
            strokeDasharray="4 7"
            opacity={pairIn * 0.85}
          />
          {SHARED.map((e) => {
            const lit = interpolate(sharedReach * 1.08, [e.d / sharedR - 0.08, e.d / sharedR], [0, 1], clamp);
            return <circle key={`s${e.i}`} cx={DOTS[e.i].x} cy={DOTS[e.i].y} r={5} fill={C.cream} opacity={lit * 0.9} />;
          })}
          <circle cx={MID.x} cy={MID.y} r={sharedR * sharedReach} fill="rgba(242,232,213,0.06)" stroke={C.cream} strokeWidth={3} opacity={sharedReach > 0 ? 0.9 : 0} />
          {[...BOTH].map((i) => (
            <g key={`b${i}`} opacity={bothIn}>
              <circle cx={DOTS[i].x} cy={DOTS[i].y} r={15 * bothIn} fill="none" stroke={C.brass} strokeWidth={4} />
              <circle cx={DOTS[i].x} cy={DOTS[i].y} r={9 * bothIn} fill={C.signal} />
            </g>
          ))}
          <g opacity={pairIn} transform={`translate(${MID.x} ${MID.y}) rotate(45)`}>
            <rect x={-10} y={-10} width={20} height={20} fill={C.cream} stroke={C.projection} strokeWidth={3} />
          </g>
        </svg>

        {toRank > 0 && <RankedLists />}

        {t >= M.likes && (
          <div style={{ position: "absolute", left: 60, top: 878, display: "flex", gap: 18, alignItems: "baseline", opacity: stepIn }}>
            <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 22, color: C.brass }}>{`0${step + 1}`}</span>
            <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 21, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(242,232,213,0.88)" }}>
              {steps[step]}
            </span>
          </div>
        )}
        <Label x={62} y={940} size={15} color="rgba(242,232,213,0.4)">
          Schematic map · real counts and methods
        </Label>
      </Stage>
      <StageCaptions
        blocks={[
          { cap: 12, from: 0, dur: sec(M.shared) },
          { cap: 15, from: sec(M.shared), dur: sec(M.rank - M.shared) },
          { cap: 13, from: sec(M.rank), dur: SCENES.map - sec(M.rank) },
        ]}
      />
    </>
  );
};

// Each player's candidates, put in order by Claude. Two films are on both lists.
const START_ORDER = [
  [3, 0, 5, 1, 4, 2],
  [2, 4, 0, 5, 1, 3],
];
const ON_BOTH = [new Set([1, 3]), new Set([0, 2])]; // ranks (0-based) of the shared films
const RankedLists: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - sec(M.rank);
  return (
    <>
      {[0, 1].map((k) => {
        const panelIn = spring({ frame: local - k * 4, fps: FPS, config: { damping: 200 }, durationInFrames: 16 });
        return (
          <div
            key={k}
            style={{
              position: "absolute",
              left: k === 0 ? 70 : 520,
              top: 190,
              width: 410,
              height: 660,
              opacity: panelIn,
              translate: `0px ${interpolate(panelIn, [0, 1], [30, 0])}px`,
            }}
          >
            <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 21, letterSpacing: "0.18em", color: PLAYER_COLOR[k] }}>
              {`PLAYER ${k + 1} · RANKED`}
            </div>
            {START_ORDER[k].map((rankIdx, slot) => {
              const sorted = spring({ frame: local - sec(1.2) - rankIdx * 3, fps: FPS, config: { damping: 18, stiffness: 120 }, durationInFrames: 30 });
              const y = 48 + interpolate(sorted, [0, 1], [slot, rankIdx]) * 98;
              const both = ON_BOTH[k].has(rankIdx);
              const color = TILE_COLORS[(rankIdx * 3 + k * 2) % TILE_COLORS.length];
              return (
                <div
                  key={slot}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: y,
                    width: 410,
                    height: 84,
                    borderRadius: 14,
                    backgroundColor: both ? "rgba(242,232,213,0.1)" : "rgba(242,232,213,0.06)",
                    border: `2px solid ${both ? "rgba(242,232,213,0.55)" : rankIdx === 0 ? PLAYER_COLOR[k] : "rgba(242,232,213,0.12)"}`,
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "0 18px",
                    boxSizing: "border-box",
                  }}
                >
                  <span style={{ fontFamily: display, fontWeight: 900, fontSize: 40, width: 30, color: rankIdx === 0 ? PLAYER_COLOR[k] : C.cream, opacity: sorted }}>
                    {rankIdx + 1}
                  </span>
                  <div style={{ width: 40, height: 58, borderRadius: 6, background: both ? TWO_TONE : color }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ width: 200 - rankIdx * 14, height: 12, borderRadius: 6, backgroundColor: "rgba(242,232,213,0.55)" }} />
                    {both ? (
                      <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 14, letterSpacing: "0.16em", color: C.cream }}>BOTH LISTS</div>
                    ) : (
                      <div style={{ width: 120, height: 9, borderRadius: 5, backgroundColor: "rgba(214,162,74,0.55)" }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
};

// ---- 3. Behind the scenes: only what you can stream ---------------------------------------
// The kept films and their services are from the demo game's real Round 3 screen.
type Tile = { title: string; meta: string; service: string } | null;
const TILES: Tile[] = [
  { title: "Enemy", meta: "2014 · Thriller", service: "HBO Max" },
  null,
  { title: "Companion", meta: "2025 · Horror", service: "Hulu" },
  null,
  { title: "Mr. Nobody", meta: "2009 · Science Fiction", service: "Amazon Prime Video" },
  { title: "The Girl Who Leapt Through Time", meta: "2006 · Animation", service: "HBO Max" },
  { title: "Scarlet", meta: "2025 · Animation", service: "Netflix" },
  null,
  null,
  { title: "The Running Man", meta: "2025 · Action", service: "Amazon Prime Video" },
  { title: "The Hunger Games", meta: "2012 · Science Fiction", service: "Hulu" },
  null,
];
const SCAN = [0.8, 2.2];

const FilterScene: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const scanY = interpolate(t, SCAN, [120, 960], clamp);
  return (
    <>
      <Stage>
        <Label x={20} y={60} opacity={interpolate(t, [0.2, 0.6], [0, 1], clamp)}>
          Where to watch · checked in code · TMDB data · region US
        </Label>
        {TILES.map((tile, i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const x = 20 + col * 330;
          const y = 130 + row * 210;
          const appear = spring({ frame: frame - i * 2, fps: FPS, config: { damping: 200 }, durationInFrames: 14 });
          const hit = interpolate(scanY, [y + 60, y + 120], [0, 1], clamp);
          const color = TILE_COLORS[(i * 5) % TILE_COLORS.length];
          return (
            <div key={i} style={{ position: "absolute", left: x, top: y, width: 300, height: 180, opacity: appear }}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 16,
                  backgroundColor: "rgba(242,232,213,0.05)",
                  border: `2px solid ${tile ? `rgba(214,162,74,${0.15 + 0.75 * hit})` : "rgba(242,232,213,0.12)"}`,
                  opacity: tile ? 1 : 1 - 0.8 * hit,
                  display: "flex",
                  gap: 14,
                  padding: 14,
                  boxSizing: "border-box",
                }}
              >
                <div style={{ width: 84, height: 124, borderRadius: 8, flexShrink: 0, backgroundColor: tile ? color : "#2a2320" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                  {tile ? (
                    <>
                      <div
                        style={{
                          fontFamily: display,
                          fontWeight: 800,
                          fontSize: 28,
                          lineHeight: 0.95,
                          textTransform: "uppercase",
                          color: C.cream,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {tile.title}
                      </div>
                      <div style={{ fontFamily: sans, fontWeight: 500, fontSize: 16, color: "rgba(242,232,213,0.6)" }}>{tile.meta}</div>
                    </>
                  ) : (
                    <>
                      <div style={{ width: 140, height: 16, borderRadius: 8, backgroundColor: "rgba(242,232,213,0.25)" }} />
                      <div style={{ width: 90, height: 12, borderRadius: 6, backgroundColor: "rgba(242,232,213,0.15)" }} />
                    </>
                  )}
                </div>
              </div>
              {tile ? (
                <div
                  style={{
                    position: "absolute",
                    left: 112,
                    right: 12,
                    bottom: 16,
                    fontFamily: mono,
                    fontWeight: 700,
                    fontSize: 13,
                    lineHeight: 1.3,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: C.brass,
                    opacity: hit,
                  }}
                >
                  {`Included with ${tile.service}`}
                </div>
              ) : (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: 74,
                    textAlign: "center",
                    fontFamily: mono,
                    fontWeight: 700,
                    fontSize: 15,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: C.signal,
                    opacity: hit,
                  }}
                >
                  Not on your services
                </div>
              )}
            </div>
          );
        })}
        <div
          style={{
            position: "absolute",
            left: 0,
            width: 1000,
            top: scanY,
            height: 4,
            borderRadius: 2,
            backgroundColor: C.brass,
            boxShadow: "0 0 24px 6px rgba(214,162,74,0.45)",
            opacity: interpolate(t, [SCAN[0], SCAN[0] + 0.15, SCAN[1] - 0.15, SCAN[1]], [0, 1, 1, 0], clamp),
          }}
        />
      </Stage>
      <StageCaptions blocks={[{ cap: 14, from: 0, dur: SCENES.filter }]} />
    </>
  );
};
