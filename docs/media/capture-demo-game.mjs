// Plays one full Movie Match game on the live beta at a 390 px viewport (2x),
// and saves the screenshots and screen recording used in docs/media.
//
// Demo inputs only: two made-up players, US region, four common services. The game
// stores nothing about the players, so no seed data is needed. A game makes the
// app's usual two Claude calls.
//
// Not part of the app and not a dependency of it. Run it from any folder that has
// Playwright installed (Playwright is resolved from the current folder):
//   npm i playwright@1.49.1 && npx playwright install chromium
//   node <repo>/docs/media/capture-demo-game.mjs ./out          # full game
//   node <repo>/docs/media/capture-demo-game.mjs ./out error    # the error screen
// Turn the frames into a video with ffmpeg:
//   ffmpeg -f concat -safe 0 -i out/frames.txt -r 30 -c:v libx264 -crf 14 -pix_fmt yuv420p game.mp4
// The hero video was cut from game.mp4 with the promo-video skill (Remotion).
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const { chromium } = createRequire(path.join(process.cwd(), "noop.js"))("playwright");

const URL = process.env.MM_URL ?? "https://movie-match-rho.vercel.app";
const OUT = process.argv[2] ?? "./out";
const MODE = process.argv[3] ?? "game"; // "game" | "error"
fs.mkdirSync(OUT, { recursive: true });

const P1 = { moods: ["Mind-bending", "Sci-Fi"], swipes: ["v", "n", "v", "s", "v", "v", "n", "v"] };
const P2 = { moods: ["Dark & gritty", "Thriller"], swipes: ["v", "v", "n", "v", "s", "v", "n", "v"] };
const SERVICES = [/netflix/i, /prime/i, /^max$|hbo/i, /hulu/i];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: "en-US",
  colorScheme: "dark",
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
});
const page = await context.newPage();
const t0 = Date.now();
// Crisp 2x frames straight from Chrome's screencast (Playwright's recorder is 1x).
const frames = [];
let cdp = null;
if (MODE === "game") {
  fs.mkdirSync(path.join(OUT, "frames"), { recursive: true });
  cdp = await context.newCDPSession(page);
  cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
    const i = frames.length;
    const file = `f${String(i).padStart(5, "0")}.jpg`;
    fs.writeFileSync(path.join(OUT, "frames", file), Buffer.from(data, "base64"));
    frames.push({ file, t: metadata.timestamp - t0 / 1000 });
    await cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
}
const marks = [];
const mark = (name) => {
  const t = (Date.now() - t0) / 1000;
  marks.push({ name, t });
  console.log(`${t.toFixed(2)}s  ${name}`);
};
const shot = async (name, opts = {}) => {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), ...opts });
  mark(`shot:${name}`);
};
const pause = (ms) => page.waitForTimeout(ms);
const btn = (name) => page.getByRole("button", { name });

if (MODE === "error") {
  // The real error screen, reached by failing the blend request in this browser only.
  await page.route("**/api/blend**", (r) => r.abort());
}

await page.goto(URL, { waitUntil: "networkidle" });
mark("loaded");

// ---- Setup -------------------------------------------------------------------
await page.locator("button[aria-pressed]").first().waitFor();
await pause(900);
if (MODE === "game") await shot("00-setup-empty");
const tiles = page.locator("button[aria-pressed]");
const n = await tiles.count();
for (const re of SERVICES) {
  for (let i = 0; i < n; i++) {
    const t = tiles.nth(i);
    const title = (await t.getAttribute("title")) ?? "";
    if (re.test(title) && (await t.getAttribute("aria-pressed")) === "false") {
      await t.click();
      await pause(350);
      break;
    }
  }
}
await pause(500);
if (MODE === "game") await shot("01-setup-services");
await btn(/Take your seats/).click();
mark("setup-done");

// ---- Round 1 -----------------------------------------------------------------
async function round1(player, cfg) {
  await page.getByText(`Player ${player}`, { exact: true }).first().waitFor();
  await pause(700);
  for (const m of cfg.moods) {
    await page.getByRole("button", { name: m, exact: true }).click();
    await pause(450);
  }
  await pause(400);
  if (MODE === "game" && player === 1) await shot("02-round1-mood");
  await btn(/Lock my picks/).click();
  mark(`r1-p${player}-locked`);
}
async function gate(to, shotName) {
  const b = btn(new RegExp(`I.m Player ${to}`));
  await b.waitFor();
  await pause(1100);
  if (shotName && MODE === "game") await shot(shotName);
  await pause(300);
  await b.click();
  mark(`gate-p${to}`);
}

await round1(1, P1);
await gate(2, "03-pass-the-phone");
await round1(2, P2);
await gate(1, "04-pass-back-warming-up");

if (MODE === "error") {
  await page.getByText("Film jam").waitFor({ timeout: 30000 });
  await pause(900);
  await shot("11-error-film-jam");
  await browser.close();
  process.exit(0);
}

// ---- Round 2 -----------------------------------------------------------------
async function round2(player, cfg, first) {
  const counter = page.getByText(new RegExp(`Player ${player} · \\d+/\\d+`));
  await counter.waitFor({ timeout: 60000 });
  mark(`r2-p${player}-start`);
  await pause(1200);
  if (first) await shot("05-round2-card");
  const total = cfg.swipes.length;
  const at = async () => Number(((await counter.textContent().catch(() => "")) ?? "").match(/(\d+)\//)?.[1] ?? 0);
  const wrapVisible = () => page.getByText(/a wrap\./).isVisible().catch(() => false);
  for (let i = 0; i < total; i++) {
    const label = { v: "This vibe", n: "Not it", s: "Not sure" }[cfg.swipes[i]];
    const last = i === total - 1;
    // The deck ignores a tap until the previous card has left: retry until it counts.
    for (let attempt = 0; attempt < 25; attempt++) {
      const b = page.getByRole("button", { name: label, exact: true });
      if (await b.isVisible().catch(() => false)) await b.click({ timeout: 2000 }).catch(() => {});
      if (first && i === 0 && attempt === 0) {
        await pause(170);
        await shot("06-round2-stamp");
      }
      await pause(250);
      if (last ? (await wrapVisible()) || !(await b.isVisible().catch(() => false)) : (await at()) >= i + 2) break;
      await pause(250);
    }
    if (!last) await pause(900); // a human beat between cards
  }
  await page.getByText(/a wrap\./).waitFor({ timeout: 10000 });
  mark(`r2-p${player}-wrap`);
  await pause(2200);
  if (first) await shot("07-round2-wrap");
  await btn(/Lock my picks/).click();
  mark(`r2-p${player}-locked`);
}

await round2(1, P1, true);
await gate(2);
await round2(2, P2, false);
await gate(1);

// ---- Round 3 -----------------------------------------------------------------
async function rows() {
  const items = page.locator("ul li button[aria-pressed]");
  await items.first().waitFor({ timeout: 90000 });
  await pause(1300);
  const out = [];
  const c = await items.count();
  for (let i = 0; i < c; i++) {
    const title = (await items.nth(i).locator("span.font-display").first().textContent())?.trim() ?? "";
    out.push({ i, title, el: items.nth(i) });
  }
  return out;
}

mark("r3-p1-wait");
const r1 = await rows();
mark("r3-p1-start");
await shot("08-round3-shortlist");
const p1Picks = [];
for (const r of r1.slice(0, 5)) {
  await r.el.click();
  p1Picks.push(r.title);
  await pause(380);
}
await pause(500);
await shot("08b-round3-picked");
await btn(/Lock my picks/).click();
mark("r3-p1-locked");
await gate(2);
const r2 = await rows();
mark("r3-p2-start");
const shared = r2.filter((r) => p1Picks.includes(r.title));
const p2Choose = shared.length ? [...shared, ...r2.filter((r) => !p1Picks.includes(r.title)).slice(0, 1)] : r2.slice(0, 4);
for (const r of p2Choose) {
  await r.el.click();
  await pause(380);
}
await pause(500);
await btn(/Lock my picks/).click();
mark("r3-p2-locked");
console.log("P1 picks:", p1Picks.join(" | "));
console.log("P2 list:", r2.map((r) => r.title).join(" | "), "shared:", shared.map((r) => r.title).join(" | "));

// ---- Match -------------------------------------------------------------------
await page.getByText(/It.s a match/).first().waitFor({ timeout: 60000 });
mark("match-shown");
await pause(400);
await shot("09a-match-curtain");
await pause(3200);
mark("match-open");
await shot("09-match");
await pause(1200);
const why = await page.getByText(/You both picked it|Your lists didn.t overlap/).first().textContent().catch(() => "");
console.log("Match line:", why);
await page.mouse.wheel(0, 500);
await pause(1500);
mark("end");

if (cdp) await cdp.send("Page.stopScreencast").catch(() => {});
await page.mouse.wheel(0, -2000);
await pause(600);
await shot("10-match-full", { fullPage: true });
fs.writeFileSync(path.join(OUT, "timeline.json"), JSON.stringify({ marks, p1Picks, why }, null, 2));
// ffmpeg concat list: each frame held until the next one arrived.
const lines = [];
for (let i = 0; i < frames.length; i++) {
  const next = frames[i + 1]?.t ?? frames[i].t + 0.5;
  lines.push(`file 'frames/${frames[i].file}'`, `duration ${Math.max(0.001, next - frames[i].t).toFixed(4)}`);
}
lines.push(`file 'frames/${frames.at(-1).file}'`);
fs.writeFileSync(path.join(OUT, "frames.txt"), lines.join("\n"));
console.log("frames:", frames.length, "first at", frames[0]?.t.toFixed(2), "last at", frames.at(-1)?.t.toFixed(2));
await context.close();
await browser.close();
