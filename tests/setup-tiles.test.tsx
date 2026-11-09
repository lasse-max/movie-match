// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

// D6 §4: service tiles show a name short enough for the tile; the full name stays
// in the tooltip. The real setup screen, with the provider list stubbed at fetch.
vi.mock("@/components/GameProvider", () => ({
  useGame: () => ({
    state: { setup: { region: "US", services: [], willingToPay: false } },
    dispatch: () => {},
  }),
}));

import { SetupScreen } from "@/components/SetupScreen";

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("Setup service tiles", () => {
  it("shorten long service names and keep the full name as the tooltip", async () => {
    const providers = ["Netflix", "Amazon Prime Video", "Paramount Plus Premium", "Disney Plus", "Apple TV Plus"].map(
      (name, i) => ({ id: i + 1, name, logoUrl: null })
    );
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ region: "US", providers })));
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => root.render(<SetupScreen />));
    await act(async () => new Promise((r) => setTimeout(r, 20)));

    const tiles = [...host.querySelectorAll("button[aria-pressed]")].map((b) => ({
      shown: b.querySelector(".truncate")?.textContent,
      title: b.getAttribute("title"),
    }));
    expect(tiles).toEqual([
      { shown: "Netflix", title: "Netflix" },
      { shown: "Prime Video", title: "Amazon Prime Video" },
      { shown: "Paramount+", title: "Paramount Plus Premium" },
      { shown: "Disney+", title: "Disney Plus" },
      { shown: "Apple TV+", title: "Apple TV Plus" },
    ]);
    await act(async () => root.unmount());
  });
});
