"use client";

import { useEffect, useState } from "react";
import { useGame } from "./GameProvider";
import { SUPPORTED_REGIONS } from "@/lib/constants";
import { Bulbs, Check, ChevronDown, Ticket, display, label } from "./palace";

interface Provider {
  id: number;
  name: string;
  logoUrl: string | null;
}

// Setup, built to docs/design/picture-palace/SetupA.dc.html: the marquee sign,
// the plain-words line, region, every service in a two-column logo grid, renting,
// and the ADMIT TWO ticket. Fits a 390 x 844 screen with ten services.
export function SetupScreen() {
  const { state, dispatch } = useGame();
  const { region, services, willingToPay } = state.setup;

  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Provider list, re-fetched whenever the region changes. Loading/error are set
  // in the region-change handler (and via initial state) so the effect never
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
    <div className="pp-enter flex min-h-full flex-1 flex-col gap-4">
      {/* The marquee sign. */}
      <div className="flex flex-none flex-col gap-3.5 rounded-2xl bg-aisle py-3.5">
        <Bulbs />
        <div className="flex flex-col gap-2 px-5 py-0.5">
          <span className={`${label} text-brass`}>Tonight only</span>
          <h1 className={`${display} text-[52px] leading-[0.86]`}>
            One film.
            <br />
            <span className="text-signal">Two of you.</span>
          </h1>
        </div>
        <Bulbs />
      </div>

      <p className="text-[15px] leading-[1.5] text-cream/75">
        A quick 2-minute game. We use AI to match your moods to a movie you can both watch
        tonight.
      </p>

      {/* Region. */}
      <div className="flex flex-none flex-col gap-1">
        <label htmlFor="setup-region" className={`${label} text-cream/65`}>
          Screening in
        </label>
        <div className="relative flex items-center shadow-[inset_0_-1px_0_rgba(214,162,74,0.5)]">
          <select
            id="setup-region"
            value={region}
            onChange={(e) => {
              // Set loading/clear error here (event handler), not in the effect.
              setError(null);
              setLoading(true);
              dispatch({ type: "SET_REGION", region: e.target.value });
            }}
            className="min-h-11 w-full cursor-pointer appearance-none bg-transparent pb-1.5 pr-[34px] font-display text-[28px] font-extrabold uppercase text-cream"
          >
            {SUPPORTED_REGIONS.map((r) => (
              <option key={r.code} value={r.code} className="text-[16px] text-projection">
                {r.name}
              </option>
            ))}
          </select>
          <ChevronDown size={20} className="pointer-events-none absolute right-1 top-2.5 text-brass" />
        </div>
      </div>

      {/* Services. */}
      <div className="flex flex-none flex-col gap-0.5">
        <div className="flex items-baseline gap-2.5">
          <span className={`${label} text-cream/65`}>Your services</span>
          {services.length > 0 ? (
            <span className={`${label} text-brass`}>{services.length} selected</span>
          ) : (
            !willingToPay && <span className={`${label} text-brass`}>Pick one, or rent</span>
          )}
        </div>

        {loading ? (
          <div aria-busy className="grid grid-cols-2 gap-2 pt-1.5">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} className="h-[46px] rounded-xl bg-aisle" />
            ))}
            <span className="sr-only">Loading services</span>
          </div>
        ) : error ? (
          <p className="py-5 text-center text-[14px] text-cream/75">
            Couldn’t load services. {error}
          </p>
        ) : providers.length === 0 ? (
          <p className="py-5 text-center text-[14px] text-cream/75">No services listed for this region.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 pt-1.5">
            {providers.map((p) => {
              const selected = services.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => dispatch({ type: "TOGGLE_SERVICE", serviceId: p.id })}
                  aria-pressed={selected}
                  title={p.name}
                  className={`flex h-[46px] items-center gap-2.5 rounded-xl pl-[9px] pr-3 text-left transition-[background-color,box-shadow,transform] duration-300 ease-entry active:scale-[0.97] ${
                    selected
                      ? "bg-[#241911] shadow-[inset_0_0_0_1.5px_rgba(214,162,74,0.75),0_10px_26px_-14px_rgba(214,162,74,0.55)]"
                      : "bg-aisle"
                  }`}
                >
                  {p.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small external TMDB logos
                    <img
                      src={p.logoUrl}
                      alt=""
                      width={32}
                      height={32}
                      className="pp-logo h-8 w-8 flex-none rounded-lg bg-[#2a1d19] object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-[#2a1d19] text-[11px] font-semibold text-cream/75">
                      {p.name.slice(0, 2)}
                    </span>
                  )}
                  <span
                    className={`min-w-0 flex-1 truncate text-[15px] font-semibold ${
                      selected ? "text-cream" : "text-cream/80"
                    }`}
                  >
                    {p.name}
                  </span>
                  <Check
                    size={18}
                    className={`flex-none text-brass transition-[opacity,transform] duration-300 ease-entry ${
                      selected ? "scale-100 opacity-100" : "scale-[0.6] opacity-0"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Renting. */}
      <label
        htmlFor="setup-rent"
        className="flex flex-none cursor-pointer items-center justify-between gap-4 pt-3.5 shadow-[inset_0_1px_0_rgba(214,162,74,0.25)]"
      >
        <span className="flex flex-col gap-[3px]">
          <span className="text-[15px] font-semibold">Open to renting tonight?</span>
          <span className="text-[13px] text-cream/65">Adds paid titles. Never changes the ranking.</span>
        </span>
        <input
          id="setup-rent"
          type="checkbox"
          className="pp-switch"
          checked={willingToPay}
          onChange={() => dispatch({ type: "SET_WILLING_TO_PAY", value: !willingToPay })}
        />
      </label>

      <div className="mt-auto pt-1">
        <Ticket
          disabled={!canContinue}
          onClick={() => dispatch({ type: "COMPLETE_TURN", player: state.currentPlayer })}
        >
          Take your seats
        </Ticket>
      </div>
    </div>
  );
}
