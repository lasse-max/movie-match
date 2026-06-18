"use client";

import { useEffect, useState } from "react";
import { useGame } from "./GameProvider";
import { SUPPORTED_REGIONS } from "@/lib/constants";

interface Provider {
  id: number;
  name: string;
  logoUrl: string | null;
}

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

  const canContinue = services.length > 0;

  return (
    <div className="flex w-full flex-col gap-6 text-left">
      <div className="text-center">
        <h2 className="text-xl font-semibold">Before you start</h2>
        <p className="mt-1 text-sm text-foreground/60">
          Tell us where you watch and what you’re signed up for, so every pick is
          something you can actually stream tonight.
        </p>
      </div>

      {/* Region */}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Region</span>
        <select
          value={region}
          onChange={(e) => {
            // Set loading/clear error here (event handler) — not in the effect.
            setError(null);
            setLoading(true);
            dispatch({ type: "SET_REGION", region: e.target.value });
          }}
          className="rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-sm"
        >
          {SUPPORTED_REGIONS.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
        </select>
      </label>

      {/* Services */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">
          Which services do you have?{" "}
          {services.length > 0 && (
            <span className="text-foreground/50">({services.length} selected)</span>
          )}
        </span>

        {loading ? (
          <p className="py-6 text-center text-sm text-foreground/50">Loading services…</p>
        ) : error ? (
          <p className="py-6 text-center text-sm text-red-500">
            Couldn’t load services. {error}
          </p>
        ) : providers.length === 0 ? (
          <p className="py-6 text-center text-sm text-foreground/50">
            No provider data for this region.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {providers.map((p) => {
              const selected = services.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => dispatch({ type: "TOGGLE_SERVICE", serviceId: p.id })}
                  aria-pressed={selected}
                  title={p.name}
                  className={`relative flex flex-col items-center gap-1 rounded-xl border p-2 transition ${
                    selected
                      ? "border-foreground ring-2 ring-foreground"
                      : "border-foreground/15 hover:border-foreground/40"
                  }`}
                >
                  {p.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small external TMDB logos; next/image adds little here
                    <img
                      src={p.logoUrl}
                      alt={p.name}
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded-lg object-contain"
                    />
                  ) : (
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground/10 text-xs">
                      {p.name.slice(0, 2)}
                    </span>
                  )}
                  <span className="line-clamp-1 text-[10px] text-foreground/70">{p.name}</span>
                  {selected && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-[10px] text-background">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Willing to pay */}
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-foreground/15 px-3 py-2.5">
        <span className="flex flex-col">
          <span className="text-sm font-medium">Willing to rent or buy tonight?</span>
          <span className="text-xs text-foreground/50">
            Include paid titles, not just your subscriptions.
          </span>
        </span>
        <input
          type="checkbox"
          checked={willingToPay}
          onChange={(e) => dispatch({ type: "SET_WILLING_TO_PAY", value: e.target.checked })}
          className="h-5 w-5 accent-foreground"
        />
      </label>

      {/* Continue */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          disabled={!canContinue}
          onClick={() => dispatch({ type: "COMPLETE_TURN", player: state.currentPlayer })}
          className="w-full rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition enabled:hover:opacity-90 enabled:active:scale-[0.98] disabled:opacity-40"
        >
          Start game
        </button>
        {!canContinue && (
          <p className="text-xs text-foreground/50">Pick at least one service to continue.</p>
        )}
      </div>
    </div>
  );
}
