// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useArmed } from "@/components/palace";

// D6 §6 (mobile audit item 2): a button that shares its spot with the previous
// screen's ignores taps for 450 ms after it appears, and again whenever the view
// it belongs to changes (Round 3 keys it on its gate and its view, so a double tap
// from the gate or the rentals offer can't lock a turn at 0 picks).
let root: Root;
let host: HTMLDivElement;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function Probe({ view }: { view: string }) {
  return <span>{useArmed(view) ? "armed" : "waiting"}</span>;
}
const render = (view: string) => act(async () => root.render(<Probe view={view} />));

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe("useArmed", () => {
  it("arms 450 ms after the screen appears, and re-arms when its view changes", async () => {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);

    await render("gate");
    expect(host.textContent).toBe("waiting");
    await act(async () => sleep(500));
    expect(host.textContent).toBe("armed");

    await render("list"); // the gate passed: the list replaces it in the same spot
    expect(host.textContent).toBe("waiting");
    await act(async () => sleep(300));
    expect(host.textContent).toBe("waiting");
    await act(async () => sleep(250));
    expect(host.textContent).toBe("armed");
  });
});
