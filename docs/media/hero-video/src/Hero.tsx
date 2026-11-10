import React, { createContext, useContext } from "react";
import {
  AbsoluteFill,
  Easing,
  Freeze,
  Html5Audio,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadDisplay } from "@remotion/google-fonts/BigShoulders";
import { loadFont as loadMono } from "@remotion/google-fonts/CourierPrime";
import { loadFont as loadSans } from "@remotion/google-fonts/LibreFranklin";

// The app's own type and colours (app/layout.tsx, app/globals.css).
export const display = loadDisplay("normal", { weights: ["800", "900"] }).fontFamily;
export const mono = loadMono("normal", { weights: ["700"] }).fontFamily;
export const sans = loadSans("normal", { weights: ["500", "600"] }).fontFamily;
export const C = {
  projection: "#0e0a09",
  aisle: "#17100e",
  cream: "#f2e8d5",
  brass: "#d6a24a",
  brassLight: "#f2cf7e",
  bulb: "#ffe9b0",
  signal: "#e3312d",
};

// ---- the cut list: one full game recorded on the live beta (390 px, 2x) ------------
// Times are seconds in public/game.mp4. The two AI waits are cut; some parts run faster.
export type Seg = { from: number; to: number; rate: number; cap: number; hold?: number };
export type Cap = { kicker: string; title: string[]; accent?: number; note?: string; url?: string; tech?: string };

export const CAPS: Cap[] = [
  { kicker: "Movie Match", title: ["One phone.", "Two of you.", "One film."], accent: 2 },
  { kicker: "Round 1 · The mood", title: ["Each of you", "picks a mood"], accent: 1 },
  { kicker: "Pass the phone", title: ["Picks stay", "hidden"], accent: 1 },
  { kicker: "Round 2 · The vibe", title: ["React to", "films"], accent: 1, note: "Not sure counts for nothing" },
  { kicker: "Round 3 · Shortlist", title: ["Pick every film", "you'd watch"], accent: 1, note: "Only films on your services" },
  { kicker: "The match", title: ["You both", "picked it"], accent: 1, note: "And where to watch it tonight" },
  { kicker: "Live beta", title: ["Try it with", "someone tonight"], accent: 1, url: "movie-match-rho.vercel.app" },
  // 7 onwards: the 2.0 video (Upgrade.tsx).
  { kicker: "Movie night", title: ["Endless", "scrolling"], accent: 1 },
  { kicker: "Movie night", title: ["Not on your", "service"], accent: 1 },
  { kicker: "Movie night", title: ["About to", "give up?"], accent: 1 },
  { kicker: "Setup", title: ["Tick what", "you pay for"], accent: 1 },
  { kicker: "Round 2 · The vibe", title: ["It learns", "your taste"], accent: 1, note: "No watch history needed" },
  { kicker: "Behind the scenes", title: ["Every film,", "mapped"], accent: 1, note: "Searched for films close to what you both liked" },
  { kicker: "Behind the scenes", title: ["AI ranks", "your list"], accent: 1, note: "Tonight's mood and your movie taste" },
  { kicker: "Behind the scenes", title: ["Only what you", "can stream"], accent: 1, note: "Your services, in your region" },
  { kicker: "Behind the scenes", title: ["Built for", "both of you"], accent: 1, note: "Both your moods and tastes, not one each" },
  { kicker: "The match", title: ["You both", "picked it"], accent: 1, note: "And where to watch it tonight", tech: "Match score: where it ranks on both your lists" },
];

const CUTS = {
  // 20 s, silent: the README GIF.
  short: [
    { from: 4.3, to: 5.8, rate: 1, cap: 0 },
    { from: 6.0, to: 8.3, rate: 1, cap: 1 },
    { from: 8.45, to: 9.95, rate: 1, cap: 2 },
    { from: 21.9, to: 31.0, rate: 2.5, cap: 3 },
    { from: 33.0, to: 35.0, rate: 1.25, cap: 3 },
    { from: 59.8, to: 63.1, rate: 1.4, cap: 4 },
    // Real speed for the payoff. Ends before 73.2 s, where the capture script's
    // full-page screenshot briefly resized the page.
    { from: 67.6, to: 72.9, rate: 1, cap: 5 },
    { from: 72.9, to: 72.9, rate: 1, cap: 6, hold: 1.8 },
  ],
  // 30 s, paced for the voiceover in voiceover-config.json (scene starts in comments).
  narrated: [
    { from: 2.2, to: 5.8, rate: 1, cap: 0 }, // 0.0 s
    { from: 6.0, to: 8.3, rate: 1, cap: 1 }, // 3.6 s
    { from: 8.45, to: 9.95, rate: 1, cap: 2 }, // 5.9 s
    { from: 9.95, to: 9.95, rate: 1, cap: 2, hold: 1.0 },
    { from: 21.9, to: 31.0, rate: 1.6, cap: 3 }, // 8.4 s
    { from: 33.0, to: 35.0, rate: 1, cap: 3 },
    { from: 59.8, to: 63.1, rate: 1, cap: 4 }, // 16.1 s
    { from: 65.9, to: 67.3, rate: 1, cap: 4 },
    { from: 67.6, to: 72.9, rate: 1, cap: 5 }, // 20.8 s
    { from: 72.9, to: 72.9, rate: 1, cap: 6, hold: 3.9 }, // 26.1 s
  ],
} satisfies Record<string, Seg[]>;
export type Cut = keyof typeof CUTS;
const XF = 5; // crossfade between clips, frames

export const segFrames = (s: Seg, fps: number) =>
  Math.round((s.hold ?? (s.to - s.from) / s.rate) * fps);

export const totalFrames = (fps: number, cut: Cut) =>
  CUTS[cut].reduce((n: number, s: Seg) => n + segFrames(s, fps), 0);

// ---- layout ---------------------------------------------------------------------
type Layout = { width: number; height: number; portrait: boolean; segs: Seg[] };
export const LayoutCtx = createContext<Layout>({ width: 1920, height: 1080, portrait: false, segs: CUTS.short });
export const useLayout = () => useContext(LayoutCtx);

// `audio` is a file in public/, for example the mixed voiceover; leave it out for silent.
export const Hero: React.FC<{ portrait?: boolean; cut?: Cut; audio?: string }> = ({
  portrait = false,
  cut = "short",
  audio,
}) => {
  const { width, height } = useVideoConfig();
  return (
    <LayoutCtx.Provider value={{ width, height, portrait, segs: CUTS[cut] }}>
      <AbsoluteFill style={{ backgroundColor: C.projection }}>
        <Room />
        <Bulbs />
        <Phone />
        <Captions />
        {audio && <Html5Audio src={staticFile(audio)} />}
      </AbsoluteFill>
    </LayoutCtx.Provider>
  );
};

// A warm spotlight in a dark room, as on the match screen.
export const Room: React.FC = () => {
  const { portrait } = useLayout();
  return (
    <AbsoluteFill
      style={{
        background: portrait
          ? "radial-gradient(ellipse 90% 55% at 50% 62%, #2a1612 0%, #0e0a09 75%)"
          : "radial-gradient(ellipse 60% 85% at 32% 52%, #2a1612 0%, #0e0a09 72%)",
      }}
    />
  );
};

// The marquee bulb row from the app, breathing slowly (smooth, no flicker).
export const Bulbs: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, portrait } = useLayout();
  const count = portrait ? 18 : 30;
  const gap = width / count;
  return (
    <div style={{ position: "absolute", top: portrait ? 56 : 44, left: 0, width, height: 20 }}>
      {Array.from({ length: count }, (_, i) => {
        const lit = i % 3 === 0;
        const glow = lit ? 0.75 + 0.25 * Math.sin((frame + i * 9) / 18) : 0.28;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: gap * i + gap / 2 - 7,
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: lit ? C.bulb : "#6b5a50",
              opacity: glow,
              boxShadow: lit ? `0 0 ${14 * glow}px ${4 * glow}px rgba(255,200,110,0.55)` : "none",
            }}
          />
        );
      })}
    </div>
  );
};

// ---- the phone --------------------------------------------------------------------
const SRC_W = 780;
const SRC_H = 1688;

// `tail` keeps the last clip on screen a little longer (for a crossfade out of the scene).
export const Phone: React.FC<{ tail?: number }> = ({ tail = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { width, height, portrait, segs: SEGS } = useLayout();

  const screenH = portrait ? 1250 : 900;
  const screenW = (screenH * SRC_W) / SRC_H;
  const bezel = portrait ? 18 : 14;
  const phoneW = screenW + bezel * 2;
  const phoneH = screenH + bezel * 2;
  const cx = portrait ? width / 2 : 620;
  const cy = portrait ? height - 96 - phoneH / 2 : height / 2 + 18;

  const enter = spring({ frame, fps, config: { damping: 200, mass: 0.9 }, durationInFrames: 28 });
  const durationInFrames = SEGS.reduce((n, s) => n + segFrames(s, fps), 0) + tail;

  let start = 0;
  const clips = SEGS.map((s, i) => {
    const dur = segFrames(s, fps);
    const el = (
      <Sequence key={i} from={start} durationInFrames={dur + (i < SEGS.length - 1 ? XF : tail)} premountFor={fps}>
        <Clip seg={s} first={i === 0} w={screenW} h={screenH} />
      </Sequence>
    );
    start += dur;
    return el;
  });

  return (
    <div
      style={{
        position: "absolute",
        left: cx - phoneW / 2,
        top: cy - phoneH / 2,
        width: phoneW,
        height: phoneH,
        perspective: 2400,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: portrait ? 82 : 64,
          padding: bezel,
          boxSizing: "border-box",
          background: "linear-gradient(150deg, #3a2c26 0%, #15100e 40%, #0b0807 100%)",
          boxShadow:
            "0 0 0 2px rgba(214,162,74,0.22), 0 60px 120px -30px rgba(0,0,0,0.95), 0 0 140px -40px rgba(214,162,74,0.35)",
          // Frame 0 is the poster frame wherever the GIF doesn't play, so the phone is
          // already there; it only settles a little.
          translate: `0px ${interpolate(enter, [0, 1], [24, 0])}px`,
          rotate: `y ${interpolate(frame, [0, durationInFrames], portrait ? [-7, -3] : [-13, -6], {
            easing: Easing.bezier(0.33, 0, 0.2, 1),
          })}deg`,
          transformStyle: "preserve-3d",
        }}
      >
        <div
          style={{
            position: "relative",
            width: screenW,
            height: screenH,
            borderRadius: portrait ? 66 : 50,
            overflow: "hidden",
            backgroundColor: C.projection,
          }}
        >
          {clips}
        </div>
      </div>
    </div>
  );
};

const Clip: React.FC<{ seg: Seg; first: boolean; w: number; h: number }> = ({ seg, first, w, h }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const video = (
    <OffthreadVideo
      src={staticFile("game.mp4")}
      trimBefore={Math.round(seg.from * fps)}
      playbackRate={seg.rate}
      muted
      style={{ width: w, height: h, objectFit: "cover" }}
    />
  );
  return (
    <AbsoluteFill
      style={{
        opacity: first ? 1 : interpolate(frame, [0, XF], [0, 1], { extrapolateRight: "clamp" }),
      }}
    >
      {seg.hold ? <Freeze frame={0}>{video}</Freeze> : video}
    </AbsoluteFill>
  );
};

// ---- captions -----------------------------------------------------------------------
export const Captions: React.FC<{ instantFirst?: boolean; holdLast?: boolean; tail?: number }> = ({
  instantFirst = true,
  holdLast = true,
  tail = 0,
}) => {
  const { fps } = useVideoConfig();
  const { segs: SEGS } = useLayout();
  // Merge consecutive clips that share a caption into one caption block.
  const blocks: { cap: number; from: number; dur: number; fast: boolean }[] = [];
  let t = 0;
  for (const s of SEGS) {
    const d = segFrames(s, fps);
    const last = blocks[blocks.length - 1];
    if (last && last.cap === s.cap) {
      last.dur += d;
      last.fast = last.fast || s.rate >= 1.2;
    } else blocks.push({ cap: s.cap, from: t, dur: d, fast: s.rate >= 1.2 });
    t += d;
  }
  if (blocks.length) blocks[blocks.length - 1].dur += tail;
  return (
    <>
      {blocks.map((b, i) => (
        <Sequence key={i} from={b.from} durationInFrames={b.dur} premountFor={fps}>
          <Caption cap={CAPS[b.cap]} dur={b.dur} fast={b.fast} last={holdLast && i === blocks.length - 1} instant={instantFirst && i === 0} />
        </Sequence>
      ))}
    </>
  );
};

export const Caption: React.FC<{ cap: Cap; dur: number; fast: boolean; last: boolean; instant: boolean }> = ({
  cap,
  dur,
  fast,
  last,
  instant,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { width, portrait } = useLayout();
  // The opening title is fully set on frame 0 (the poster frame).
  const inK = instant ? 1 : spring({ frame, fps, config: { damping: 200 }, durationInFrames: 14 });
  const out = last ? 1 : interpolate(frame, [dur - 6, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const line = (i: number) =>
    instant ? 1 : spring({ frame: frame - 3 - i * 3, fps, config: { damping: 200 }, durationInFrames: 16 });

  const titleSize = portrait ? 104 : 118;
  const box: React.CSSProperties = portrait
    ? { left: 90, right: 90, top: 150, alignItems: "flex-start" }
    : { left: 1010, width: width - 1010 - 110, top: 0, bottom: 0, justifyContent: "center" };

  return (
    <div style={{ position: "absolute", display: "flex", flexDirection: "column", gap: 26, opacity: out, ...box }}>
      <div style={{ display: "flex", alignItems: "center", gap: 22, opacity: inK, translate: `0px ${interpolate(inK, [0, 1], [18, 0])}px` }}>
        <span style={{ fontFamily: mono, fontWeight: 700, fontSize: portrait ? 28 : 30, letterSpacing: "0.22em", textTransform: "uppercase", color: C.brass }}>
          {cap.kicker}
        </span>
        {fast && (
          <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 20, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(242,232,213,0.55)", border: "1.5px solid rgba(242,232,213,0.3)", borderRadius: 6, padding: "5px 10px 3px" }}>
            Sped up
          </span>
        )}
      </div>
      <div>
        {cap.title.map((l, i) => (
          <div
            key={i}
            style={{
              fontFamily: display,
              fontWeight: 900,
              fontSize: titleSize,
              lineHeight: 0.88,
              textTransform: "uppercase",
              color: i === cap.accent ? C.signal : C.cream,
              opacity: line(i),
              translate: `0px ${interpolate(line(i), [0, 1], [34, 0])}px`,
            }}
          >
            {l}
          </div>
        ))}
      </div>
      {cap.note && (
        <div style={{ fontFamily: sans, fontWeight: 500, fontSize: portrait ? 38 : 40, color: "rgba(242,232,213,0.78)", opacity: line(cap.title.length) }}>
          {cap.note}
        </div>
      )}
      {cap.tech && (
        <div
          style={{
            fontFamily: mono,
            fontWeight: 700,
            fontSize: portrait ? 22 : 24,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: C.brass,
            opacity: line(cap.title.length + 1),
          }}
        >
          {cap.tech}
        </div>
      )}
      {cap.url && (
        <div
          style={{
            alignSelf: "flex-start",
            fontFamily: sans,
            fontWeight: 600,
            fontSize: portrait ? 42 : 46,
            color: C.projection,
            backgroundColor: C.brass,
            borderRadius: 18,
            padding: "18px 30px",
            boxShadow: "0 18px 40px -16px rgba(214,162,74,0.8)",
            opacity: line(cap.title.length),
            scale: interpolate(line(cap.title.length), [0, 1], [0.94, 1]),
          }}
        >
          {cap.url}
        </div>
      )}
    </div>
  );
};

// The phone with its clips and captions, for use as one scene of a longer video.
export const PhoneScene: React.FC<{ segs: Seg[]; tail?: number; holdLast?: boolean }> = ({ segs, tail = 0, holdLast = false }) => {
  const layout = useLayout();
  return (
    <LayoutCtx.Provider value={{ ...layout, segs }}>
      <Phone tail={tail} />
      <Captions instantFirst={false} holdLast={holdLast} tail={tail} />
    </LayoutCtx.Provider>
  );
};
