import { GameProvider } from "@/components/GameProvider";
import { GameScreen } from "@/components/GameScreen";

// The game runs entirely client-side (pass-the-phone, no backend session).
// AI/TMDB work happens in serverless routes called from within the rounds.
export default function Home() {
  return (
    <GameProvider>
      <GameScreen />
    </GameProvider>
  );
}
