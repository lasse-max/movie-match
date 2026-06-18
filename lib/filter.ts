// The subscription/pay eligibility filter — pure and isomorphic so the client
// applies it before Round 3 renders (and the "include rentals?" expand is
// instant). One of the three permanent unit-tested pure pieces.
//
// Canonical rule (BRD): a title is eligible if it's on a SELECTED subscription
// service (flatrate), OR — only if willing-to-pay is on — available to rent/buy.
// Willing-to-pay expands eligibility; it never affects ranking. Eligibility
// produces a label only; the caller preserves the taste ranking.

export interface Provider {
  id: number;
  name: string;
}

/** Region-scoped availability facts for one movie (from TMDB watch/providers). */
export interface MovieAvailability {
  flatrate: Provider[]; // included with a subscription
  rent: Provider[];
  buy: Provider[];
  justWatchLink: string | null;
}

/** Placeholder until region availability is fetched (treated as ineligible). */
export const NO_AVAILABILITY: MovieAvailability = {
  flatrate: [],
  rent: [],
  buy: [],
  justWatchLink: null,
};

export interface AvailabilityLabel {
  type: "flatrate" | "rent" | "buy";
  provider: string;
  justWatchLink: string | null;
}

export interface FilterResult {
  eligible: boolean;
  label: AvailabilityLabel | null;
  /** True when rent/buy exists — i.e. enabling willing-to-pay would unlock it. */
  rentBuyAvailable: boolean;
}

export function evaluateAvailability(
  availability: MovieAvailability,
  selectedServices: number[],
  willingToPay: boolean
): FilterResult {
  const selected = new Set(selectedServices);
  const rentBuyAvailable = availability.rent.length + availability.buy.length > 0;

  // Included with one of the couple's subscriptions → eligible, "Included with X".
  const onService = availability.flatrate.find((p) => selected.has(p.id));
  if (onService) {
    return {
      eligible: true,
      label: { type: "flatrate", provider: onService.name, justWatchLink: availability.justWatchLink },
      rentBuyAvailable,
    };
  }

  // Otherwise eligible only if they'll pay and it's rentable/buyable. Prefer rent.
  if (willingToPay && rentBuyAvailable) {
    const rent = availability.rent[0];
    const buy = availability.buy[0];
    const label: AvailabilityLabel = rent
      ? { type: "rent", provider: rent.name, justWatchLink: availability.justWatchLink }
      : { type: "buy", provider: buy.name, justWatchLink: availability.justWatchLink };
    return { eligible: true, label, rentBuyAvailable };
  }

  return { eligible: false, label: null, rentBuyAvailable };
}

/** Human-readable label text, e.g. "Included with Netflix" / "Rent on Apple TV". */
export function labelText(label: AvailabilityLabel): string {
  const prefix =
    label.type === "flatrate" ? "Included with" : label.type === "rent" ? "Rent on" : "Buy on";
  return `${prefix} ${label.provider}`;
}
