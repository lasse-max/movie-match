import { describe, it, expect } from "vitest";
import {
  evaluateAvailability,
  labelText,
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
