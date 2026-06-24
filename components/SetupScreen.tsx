"use client";

import { useEffect, useState } from "react";
import { useGame } from "./GameProvider";
import { SUPPORTED_REGIONS } from "@/lib/constants";
import { Check, Chevron, Clapperboard, goldCta } from "./marquee";

interface Provider {
  id: number;
  name: string;
  logoUrl: string | null;
}

const label = "text-[12px] uppercase tracking-[1.5px] text-text/45";

export function SetupScreen() {
  const { state, dispatch } = useGame();
  const { region, services, willingToPay } = state.setup;

  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Provider list — re-fetched whenever the region changes. Loading/error are
  // set in the region-change handler (and via initial state) so the effect never
  // calls setState synchronously. Cancellation-safe via AbortController.
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    fetch(`/api/providers?region=${encodeURIComponent(region)}`, {
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.error) {
          setError(d.error);
          setProviders([]);
        } else {
          setProviders(d.providers ?? []);
        }
      })
      .catch((e: unknown) => {
        if (cancelled || (e instanceof DOMException && e.name === "AbortError")) return;
        setError(e instanceof Error ? e.message : "Network error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [region]);

  // Continue rule (BRD): start with at least one subscription OR willing-to-pay.
  const canContinue = services.length > 0 || willingToPay;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="flex-1">
        {/* brand */}
        <div className="mb-7 flex items-center gap-2.5">
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-[linear-gradient(150deg,#E8C07D,#C99B53)] shadow-[0_6px_18px_-6px_rgba(232,192,125,0.7)]">
            <Clapperboard size={16} className="text-ink" />
          </span>
          <span className="text-[15px] font-semibold tracking-[0.4px]">Movie Match</span>
        </div>

        {/* hero */}
        <p className="mb-1.5 text-[13px] uppercase tracking-[2.5px] text-gold">Tonight, together</p>
        <h1 className="mb-3 font-display text-[42px] leading-[1.04]">
          One film you
          <br />
          <span className="italic text-gold">both</span> actually want.
        </h1>
        <p className="mb-7 text-[14.5px] leading-[1.5] text-text/55">
          Tell us where you watch, so every pick is something you can stream right now.
        </p>

        {/* region */}
        <p className={`mb-2.5 ${label}`}>Region</p>
        <div className="relative mb-6">
          <select
            value={region}
            onChange={(e) => {
              // Set loading/clear error here (event handler) — not in the effect.
              setError(null);
              setLoading(true);
              dispatch({ type: "SET_REGION", region: e.target.value });
            }}
            className="w-full appearance-none rounded-2xl border border-text/12 bg-text/[0.03] px-4 py-3 text-[14.5px] font-medium text-text"
          >
            {SUPPORTED_REGIONS.map((r) => (
              <option key={r.code} value={r.code} className="bg-ink text-text">
                {r.name}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
            <Chevron size={14} className="text-gold" />
          </span>
        </div>

        {/* services */}
        <p className={`mb-2.5 ${label}`}>
          Your services{" "}
          {services.length > 0 && (
            <span className="tracking-normal text-gold">· {services.length} selected</span>
          )}
        </p>

        {loading ? (
          <p className="py-6 text-center text-sm text-text/50">Loading services…</p>
        ) : error ? (
          <p className="py-6 text-center text-sm text-rose">Couldn’t load services. {error}</p>
        ) : providers.length === 0 ? (
          <p className="py-6 text-center text-sm text-text/50">No provider data for this region.</p>
        ) : (
          <div className="mb-6 grid grid-cols-2 gap-[9px]">
            {providers.map((p) => {
              const selected = services.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => dispatch({ type: "TOGGLE_SERVICE", serviceId: p.id })}
                  aria-pressed={selected}
                  title={p.name}
                  className={`flex items-center gap-2.5 rounded-2xl border p-3 transition active:scale-[0.98] ${
                    selected ? "border-gold/70 bg-gold/10" : "border-text/10 bg-text/[0.03]"
                  }`}
                >
                  <span className="flex h-6 w-6 flex-none items-center justify-center overflow-hidden rounded-[7px] bg-text/10">
                    {p.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- small external TMDB logos
                      <img
                        src={p.logoUrl}
                        alt={p.name}
                        width={24}
                        height={24}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-[9px] text-text/70">{p.name.slice(0, 2)}</span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-text">
                    {p.name}
                  </span>
                  {selected && <Check size={15} className="flex-none text-gold" />}
                </button>
              );
            })}
          </div>
        )}

        {/* willing to pay */}
        <button
          type="button"
          aria-pressed={willingToPay}
          onClick={() => dispatch({ type: "SET_WILLING_TO_PAY", value: !willingToPay })}
          className={`flex w-full items-center justify-between gap-3.5 rounded-2xl border p-4 text-left transition ${
            willingToPay ? "border-gold/50 bg-gold/[0.07]" : "border-text/10 bg-text/[0.03]"
          }`}
        >
          <span>
            <span className="block text-[13.5px] font-semibold text-text">
              Open to renting tonight?
            </span>
            <span className="block text-[12px] text-text/50">
              Include paid titles, not just subscriptions.
            </span>
          </span>
          <span
            className={`relative h-[27px] w-[46px] flex-none rounded-full transition ${
              willingToPay ? "bg-gold" : "bg-text/15"
            }`}
          >
            <span
              className={`absolute top-[3px] h-[21px] w-[21px] rounded-full transition-all ${
                willingToPay ? "left-[22px] bg-ink" : "left-[3px] bg-text"
              }`}
            />
          </span>
        </button>
      </div>

      {/* continue */}
      <div className="mt-5">
        <button
          type="button"
          disabled={!canContinue}
          onClick={() => dispatch({ type: "COMPLETE_TURN", player: state.currentPlayer })}
          className={goldCta}
        >
          Start the night
        </button>
        {!canContinue && (
          <p className="mt-2.5 text-center text-[12px] text-text/45">
            Pick at least one service, or turn on renting to continue.
          </p>
        )}
      </div>
    </div>
  );
}
