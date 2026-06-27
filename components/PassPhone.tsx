import { Phone, eyebrow as eyebrowClass, goldCta } from "./marquee";

/**
 * Shared pass-the-phone handoff gate (Marquee). Pulsing gold rings + a floating
 * phone, a serif "Pass the phone {lead} {player}" headline, and an "I'm ready" CTA.
 * Used for the round-BOUNDARY "back to Player 1" handoff on the loading screens
 * (the within-round P1→P2 gates stay inline in the round screens). Pure UI overlay —
 * the caller owns when it shows and what happens on ready.
 */
export function PassPhone({
  kicker,
  lead,
  player,
  subcopy,
  onReady,
}: {
  kicker: string;
  lead: string; // "to" | "back to"
  player: string; // "Player 1" | "Player 2"
  subcopy: string;
  onReady: () => void;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-2 text-center">
      <div className="relative mb-7 flex h-[120px] w-[120px] items-center justify-center">
        <span className="absolute inset-0 rounded-full border-[1.5px] border-gold/50 motion-safe:animate-[mmPulseRing_2.4s_ease-out_infinite]" />
        <span className="absolute inset-0 rounded-full border-[1.5px] border-gold/50 motion-safe:animate-[mmPulseRing_2.4s_ease-out_infinite_1.2s]" />
        <div className="flex h-[78px] w-[78px] items-center justify-center rounded-3xl border border-gold/40 bg-[linear-gradient(150deg,rgba(232,192,125,0.18),rgba(232,192,125,0.04))] text-gold motion-safe:animate-[mmFloat_3.5s_ease-in-out_infinite]">
          <Phone size={34} />
        </div>
      </div>
      <p className={`mb-2 ${eyebrowClass} tracking-[2px]`}>{kicker}</p>
      <h2 className="mb-3 font-display text-[36px] leading-[1.05]">
        Pass the phone
        <br />
        {lead} <span className="italic text-gold">{player}</span>
      </h2>
      <p className="mb-8 max-w-[260px] text-[14.5px] leading-[1.5] text-text/55">{subcopy}</p>
      <button className={goldCta} onClick={onReady}>
        I’m ready
      </button>
    </div>
  );
}
