import { Composition } from "remotion";
import { Hero, totalFrames } from "./Hero";
import { Upgrade, upgradeFrames } from "./Upgrade";

const FPS = 30;

export const RemotionRoot: React.FC = () => (
  <>
    {/* 20 s, silent: the README GIF and its MP4s. */}
    <Composition
      id="Promo-Landscape"
      component={Hero}
      defaultProps={{ portrait: false, cut: "short" as const }}
      durationInFrames={totalFrames(FPS, "short")}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="Promo-Portrait"
      component={Hero}
      defaultProps={{ portrait: true, cut: "short" as const }}
      durationInFrames={totalFrames(FPS, "short")}
      fps={FPS}
      width={1080}
      height={1920}
    />
    {/* 30 s, for the voiceover. Render with --props='{"audio":"voiceover-with-music.mp3"}'. */}
    <Composition
      id="Narrated-Landscape"
      component={Hero}
      defaultProps={{ portrait: false, cut: "narrated" as const }}
      durationInFrames={totalFrames(FPS, "narrated")}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="Narrated-Portrait"
      component={Hero}
      defaultProps={{ portrait: true, cut: "narrated" as const }}
      durationInFrames={totalFrames(FPS, "narrated")}
      fps={FPS}
      width={1080}
      height={1920}
    />
    {/* 57 s, the 2.0 video with what happens behind the scenes. Render with --props='{"audio":"upgrade-with-music.mp3"}'. */}
    <Composition
      id="Upgrade-Landscape"
      component={Upgrade}
      defaultProps={{ portrait: false }}
      durationInFrames={upgradeFrames}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="Upgrade-Portrait"
      component={Upgrade}
      defaultProps={{ portrait: true }}
      durationInFrames={upgradeFrames}
      fps={FPS}
      width={1080}
      height={1920}
    />
  </>
);
