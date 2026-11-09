// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { selectSwipeSamples, type PoolMovie } from "@/lib/blendTypes";

// F1 (Cato's 2.0 review, finding 1): one decision per visible card. The real
// Round 2 screen in a DOM, with the game context stubbed so the test can read
// exactly which film ids the turn records. Taps and drags go through the same
// guard; a second decision only counts once the next card is on top and visible.
const { dispatch, game } = vi.hoisted(() => ({
  dispatch: vi.fn(),
  game: { state: null as unknown },
}));
vi.mock("@/components/GameProvider", () => ({ useGame: () => ({ state: game.state, dispatch }) }));

// happy-dom's Web Animations support is partial (a cancelled animation rejects a
// promise nobody awaits), so Motion runs on its own frame loop here instead.
delete (Element.prototype as { animate?: unknown }).animate;

import { Round2Screen } from "@/components/Round2Screen";

const film = (id: number, voteCount: number): PoolMovie => ({
  id,
  title: `Film ${id}`,
  year: "2015",
  overview: "",
  posterUrl: null,
  genreIds: [878],
  voteAverage: 7.2,
  voteCount,
  directionIndex: 0,
  directionTheme: "Sci-fi",
  collectionId: null,
});
// Eight films: four cards a player (a short deck keeps the real-time waits short).
const pool = Array.from({ length: 8 }, (_, i) => film(101 + i, 2000 - i * 10));
const cards = selectSwipeSamples(pool)[1].map((m) => m.id); // Player 1's cards, in order

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let root: Root;
let host: HTMLDivElement;
let reduceMotion = false;
// Motion reads the reduce-motion setting once and then listens for changes, so a
// test that switches it must tell those listeners (otherwise it silently keeps
// whatever the first test saw).
const mediaListeners = new Set<() => void>();
const setReduceMotion = (on: boolean) => {
  reduceMotion = on;
  mediaListeners.forEach((listener) => listener());
};

beforeEach(async () => {
  dispatch.mockClear();
  game.state = { blend: { pool }, currentPlayer: 1 };
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return query.includes("prefers-reduced-motion") && reduceMotion;
    },
    media: query,
    onchange: null,
    addEventListener: (_: string, listener: () => void) => mediaListeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => mediaListeners.delete(listener),
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => root.render(<Round2Screen />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  setReduceMotion(false);
  vi.unstubAllGlobals();
});

/** Start the turn again with the phone's reduce-motion setting on. */
async function remountReduced() {
  await act(async () => root.unmount());
  setReduceMotion(true);
  host.innerHTML = "";
  root = createRoot(host);
  await act(async () => root.render(<Round2Screen />));
}

const counter = () => Number(/Player 1 · (\d+)\/\d+/.exec(host.textContent ?? "")?.[1]);
const button = (text: string) =>
  [...host.querySelectorAll("button")].find((b) => b.textContent?.trim() === text)!;
const tap = (text: string) => act(async () => button(text).click());

/** A drag on the card on top, released to the right (the card's threshold is
 * zero here: the DOM has no layout, so any rightward drag decides "This vibe"). */
async function dragRight() {
  const card = host.querySelector("article")!;
  const at = (type: string, x: number, target: EventTarget) => {
    const e = new PointerEvent(type, { bubbles: true, isPrimary: true, button: 0, pointerId: 1, pointerType: "mouse", clientX: x, clientY: 200 });
    // Motion reads page coordinates, which happy-dom leaves at 0 (no scroll here,
    // so page and client coordinates are the same).
    Object.defineProperties(e, { pageX: { value: x }, pageY: { value: 200 } });
    target.dispatchEvent(e);
  };
  await act(async () => {
    at("pointerdown", 100, card);
    for (const x of [110, 130, 160, 200]) {
      at("pointermove", x, window);
      await sleep(16);
    }
    at("pointerup", 200, window);
  });
}

/** Wait for the deck to settle (the card gone, the next one in view long enough):
 * about 0.54 s after a tap, or 0.75 s with reduce-motion (hold, fade, then the floor). */
const settle = () => sleep(reduceMotion ? 900 : 700);

/** Cards on the table: the one on top, plus the one still leaving, if any. */
const topCards = () => host.querySelectorAll("article").length;
/** Wait until the decided card has finished leaving (the next one is revealed). */
async function untilRevealed() {
  for (let waited = 0; topCards() > 1 && waited < 2000; waited += 5) await sleep(5);
  expect(topCards()).toBe(1);
}
/** A stamp's opacity on the card that's leaving (it sits above the next one). */
function leavingStamp(text: string) {
  const card = [...host.querySelectorAll("article")].find(
    (a) => (a.parentElement as HTMLElement).style.zIndex === "4"
  );
  const stamp = [...(card?.querySelectorAll("span") ?? [])].find((s) => s.textContent === text);
  return Number(stamp?.style.opacity);
}

/** Decide every remaining card "Not it", one at a time, then finish the turn. */
async function finishWithNotIt() {
  while (button("Not it")) {
    await settle();
    await tap("Not it");
    if (!button("Not it")) break;
  }
  await settle();
  await tap("Done, pass the phone");
  const call = dispatch.mock.calls.find(([a]) => a.type === "SET_SWIPES");
  return call?.[0] as { yes: number[]; no: number[]; neutral: number[] };
}

describe("Round 2: one decision per visible card", () => {
  it("a double tap 30 ms apart records one decision, on the card that was on top", async () => {
    await tap("This vibe");
    await sleep(30);
    await tap("This vibe");
    expect(counter()).toBe(2); // moved one card, not two

    const swipes = await finishWithNotIt();
    expect(swipes.yes).toEqual([cards[0]]);
    expect(swipes.no).toEqual(cards.slice(1));
    expect(swipes.neutral).toEqual([]);
  }, 20000);

  it("a drag, then a button on the same card 30 ms later, records only the drag", async () => {
    await dragRight();
    expect(counter()).toBe(2); // the drag counted
    await sleep(30);
    await tap("Not it");
    expect(counter()).toBe(2); // the button did not decide the card underneath

    const swipes = await finishWithNotIt();
    expect(swipes.yes).toEqual([cards[0]]);
    expect(swipes.no).toEqual(cards.slice(1));
  }, 20000);

  // The reverse order. Without the fix this one passes too (Motion ignores a drag
  // on a card that is already leaving), so it guards behaviour rather than
  // proving the fix; the three other cases fail without it.
  it("a button, then a drag on the card that is leaving, records only the button", async () => {
    await tap("Not sure");
    await sleep(30);
    await dragRight(); // lands on the leaving card or the one under it: neither counts yet
    expect(counter()).toBe(2);

    const swipes = await finishWithNotIt();
    expect(swipes.neutral).toEqual([cards[0]]);
    expect(swipes.yes).toEqual([]);
    expect(swipes.no).toEqual(cards.slice(1));
  }, 20000);

  it("with reduce-motion on, a double tap during the stamp's hold records one decision", async () => {
    await remountReduced();

    await tap("This vibe");
    await sleep(40);
    // Reduce-motion really is on: the stamp is at full at once, on a card that holds still.
    expect(leavingStamp("This vibe")).toBe(1);
    await sleep(310);
    await tap("This vibe"); // past 300 ms from the first tap, but the card is still leaving
    expect(counter()).toBe(2);

    const swipes = await finishWithNotIt();
    expect(swipes.yes).toEqual([cards[0]]);
    expect(swipes.no).toEqual(cards.slice(1));
  }, 20000);

  // D6 §1.8: with the hold, the old card leaves 0.45 s after the tap. Counted from
  // the tap, the 300 ms floor would already be over, and a tap the moment the next
  // card appears would decide a film nobody saw. It counts from the reveal instead.
  it("with reduce-motion on, the next card counts only once it has been in view for 300 ms", async () => {
    await remountReduced();

    await tap("Not sure");
    await untilRevealed();
    await tap("This vibe"); // the next card has only just appeared
    expect(counter()).toBe(2);
    await sleep(350);
    await tap("This vibe"); // in view long enough now
    expect(counter()).toBe(3);

    const swipes = await finishWithNotIt();
    expect(swipes.neutral).toEqual([cards[0]]);
    expect(swipes.yes).toEqual([cards[1]]);
    expect(swipes.no).toEqual(cards.slice(2));
  }, 20000);

  // D6 §1.1: on a tap all three stamps show the same way (Not sure used to peak at
  // about 40%, fading with its card).
  it.each(["This vibe", "Not it", "Not sure"])("a tap on %s lands its stamp at full", async (choice) => {
    await tap(choice);
    await sleep(200); // the stamp has landed; the card hasn't flown yet
    expect(leavingStamp(choice)).toBe(1);
  });
});
