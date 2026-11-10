import { Composition } from "remotion";
import { Hero, totalFrames } from "./Hero";

const FPS = 30;
const DURATION = totalFrames(FPS);

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Promo-Landscape"
      component={Hero}
      defaultProps={{ portrait: false }}
      durationInFrames={DURATION}
      fps={FPS}
      width={1920}
      height={1080}
    />
    <Composition
      id="Promo-Portrait"
      component={Hero}
      defaultProps={{ portrait: true }}
      durationInFrames={DURATION}
      fps={FPS}
      width={1080}
      height={1920}
    />
  </>
);
