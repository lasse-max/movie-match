import { describe, it, expect } from "vitest";
import {
  evaluateAvailability,
  labelText,
  selectWatchable,
  type MovieAvailability,
} from "@/lib/filter";

// One of the three permanent pure-logic suites (reducer / filter / overlap).
const NETFLIX = { id: 8, name: "Netflix" };
const APPLE = { id: 2, name: "Apple TV" };
const HULU = { id: 15, name: "Hulu" };

const avail = (over: Partial<MovieAvailability> = {}): MovieAvailability => ({
  flatrate: [],
  rent: [],
  buy: [],
  justWatchLink: "https://justwatch.test/x",
  ...over,
});

describe("evaluateAvailability", () => {
  it("is eligible and 'Included with X' when on a selected subscription", () => {
    const r = evaluateAvailability(avail({ flatrate: [NETFLIX] }), [8], false);
    expect(r.eligible).toBe(true);
    expect(r.label).toEqual({ type: "flatrate", provider: "Netflix", justWatchLink: "https://justwatch.test/x" });
  });

  it("ignores flatrate on a service the couple did NOT select", () => {
    const r = evaluateAvailability(avail({ flatrate: [HULU] }), [8], false);
    expect(r.eligible).toBe(false);
  });

  it("is ineligible when not on a service and not willing to pay (but flags rent/buy)", () => {
    const r = evaluateAvailability(avail({ rent: [APPLE] }), [8], false);
    expect(r.eligible).toBe(false);
    expect(r.rentBuyAvailable).toBe(true);
  });

  it("becomes eligible (Rent on X) once willing-to-pay is on", () => {
    const r = evaluateAvailability(avail({ rent: [APPLE] }), [8], true);
    expect(r.eligible).toBe(true);
    expect(r.label?.type).toBe("rent");
    expect(r.label?.provider).toBe("Apple TV");
  });

  it("prefers flatrate-on-service over paying even when willing to pay", () => {
    const r = evaluateAvailability(avail({ flatrate: [NETFLIX], rent: [APPLE] }), [8], true);
    expect(r.label?.type).toBe("flatrate");
  });

  it("labels buy-only when willing to pay and no rental", () => {
    const r = evaluateAvailability(avail({ buy: [APPLE] }), [8], true);
    expect(r.label?.type).toBe("buy");
  });

  it("is ineligible when nothing is available at all", () => {
    const r = evaluateAvailability(avail(), [8], true);
    expect(r.eligible).toBe(false);
    expect(r.rentBuyAvailable).toBe(false);
  });
});

describe("labelText", () => {
  it("formats each availability type", () => {
    expect(labelText({ type: "flatrate", provider: "Netflix", justWatchLink: null })).toBe("Included with Netflix");
    expect(labelText({ type: "rent", provider: "Apple TV", justWatchLink: null })).toBe("Rent on Apple TV");
    expect(labelText({ type: "buy", provider: "Amazon", justWatchLink: null })).toBe("Buy on Amazon");
  });
});

// selectWatchable is the never-dead-end resolver: exactly one watchable view, and
// it NEVER mixes unwatchable titles into the pickable rows.
describe("selectWatchable", () => {
  const item = (id: number, over: Partial<MovieAvailability> = {}) => ({ id, availability: avail(over) });

  it("returns only eligible rows — never an unwatchable selectable title", () => {
    const view = selectWatchable(
      [
        item(1, { flatrate: [NETFLIX] }), // eligible (on selected service)
        item(2, { flatrate: [HULU] }), // on an unselected service → excluded
        item(3, { rent: [APPLE] }), // rent only, not paying → excluded
      ],
      [8],
      false
    );
    expect(view.kind).toBe("watchable");
    if (view.kind === "watchable") {
      expect(view.rows.map((r) => r.item.id)).toEqual([1]);
      expect(view.rows.every((r) => r.label.type === "flatrate")).toBe(true);
    }
  });

  it("caps eligible rows at the limit", () => {
    const items = [1, 2, 3, 4, 5, 6].map((id) => item(id, { flatrate: [NETFLIX] }));
    const view = selectWatchable(items, [8], false, 5);
    expect(view.kind === "watchable" && view.rows.length).toBe(5);
  });

  it("offers rentals when nothing's included but paying would unlock a title", () => {
    const view = selectWatchable([item(1, { flatrate: [HULU] }), item(2, { rent: [APPLE] })], [8], false);
    expect(view.kind).toBe("offer-rentals");
    if (view.kind === "offer-rentals") expect(view.rentable.map((i) => i.id)).toContain(2);
  });

  it("is the honest 'none' end-state when nothing's watchable even paying", () => {
    // Nothing on the selected service, nothing rentable, already willing to pay.
    const view = selectWatchable([item(1, { flatrate: [HULU] }), item(2)], [8], true);
    expect(view.kind).toBe("none");
  });

  it("widens but never REORDERS when rentals are enabled (price ≠ ranking)", () => {
    // Input (fit) order: paid title 1 first, free title 2 second.
    const items = [item(1, { rent: [APPLE] }), item(2, { flatrate: [NETFLIX] })];
    const free = selectWatchable(items, [8], false);
    expect(free.kind === "watchable" && free.rows.map((r) => r.item.id)).toEqual([2]); // only the free one
    const paid = selectWatchable(items, [8], true);
    // Enabling rentals adds title 1 in its ORIGINAL position — not reordered by access type.
    expect(paid.kind === "watchable" && paid.rows.map((r) => r.item.id)).toEqual([1, 2]);
  });
});
