import { NextResponse } from "next/server";
import { getAnthropic } from "@/lib/anthropic";
import { genreNames } from "@/lib/genres";

// EVAL-ONLY LLM-as-judge (dev only — 404 in production). Independent of the
// matching engine: a DIFFERENT model from the engine's claude-sonnet-4-6, and a
// clean rubric that judges the pick from the raw game path only — it is never fed
// the engine's own match tags, percentages, or reasoning. (Both are Anthropic
// models, so a residual shared-model bias remains; a non-Anthropic judge would be
// strictly more independent — flagged in the calibration report.)
const JUDGE_MODEL = "claude-opus-4-8";

const JUDGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    rating: { type: "integer" },
    rationale: { type: "string" },
  },
  required: ["rating", "rationale"],
} as const;

const JUDGE_SYSTEM = `You are an independent film critic scoring movie-night matchmaking. Two people are choosing ONE film to watch together. You are given each person's chosen moods, the titles they swiped toward/away in a quick round, the shortlist each picked from, and a read of their mood — then the FINAL film a system chose for them. Rate how good that single pick is for THIS couple tonight, 0–100.

How to judge — read carefully:
- A great pick satisfies at least ONE person's stated mood AND is endorsed by what they swiped TOWARD. It does NOT need to match every genre both people named — couples rarely share all genres, and a pick that nails one person's mood while staying acceptable to the other is a valid mutual match. Do NOT deduct points merely because a genre one of them listed is absent.
- Reward subgenre and TONE fit, and "best mutual pick" judgment — would a thoughtful friend who knows both of them choose this for them? Reward a pick that threads their two moods together.
- Penalize: a pick whose tone or subgenre CLASHES with what they swiped toward (e.g. a fun superhero romp for a couple after bleak apocalyptic dread; a horror film for a cozy viewer); a generic crowd-pleaser that ignores the couple's specific mood; a pick neither of them would plausibly have chosen.
- Bands: 85–100 excellent mutual fit · 70–84 good · 50–69 mediocre / merely acceptable · 30–49 weak or off-tone · 0–29 clashing or wrong.

Judge the pick in retrospect against the path. Be discerning: reserve 85+ for picks that genuinely thread both moods, and do not be afraid to score a clashing or generic pick below 50. Respond only with JSON: {"rating": <integer 0-100>, "rationale": "<one sentence>"}.`;

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("eval is dev-only", { status: 404 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const c = body?.context ?? {};
    const pick = body?.pick ?? {};
    if (!pick.title) {
      return NextResponse.json({ error: "pick.title required" }, { status: 400 });
    }
    const list = (a: unknown) => (Array.isArray(a) && a.length ? a.join("; ") : "(none)");
    const userMsg = [
      `Person A chose moods: ${list(c.p1cats)}.  Mood read: ${c.p1mood ?? "—"}.`,
      `Person A swiped TOWARD: ${list(c.p1Yes)}`,
      `Person A swiped AWAY: ${list(c.p1No)}`,
      `Person A's shortlist picks: ${list(c.p1picks)}`,
      ``,
      `Person B chose moods: ${list(c.p2cats)}.  Mood read: ${c.p2mood ?? "—"}.`,
      `Person B swiped TOWARD: ${list(c.p2Yes)}`,
      `Person B swiped AWAY: ${list(c.p2No)}`,
      `Person B's shortlist picks: ${list(c.p2picks)}`,
      ``,
      `The system's final pick for them to watch together: ${pick.title}${pick.year ? ` (${pick.year})` : ""} — genres: ${genreNames(pick.genreIds ?? []).join(", ") || "unknown"}.`,
      ``,
      `Rate this pick 0–100 for this couple tonight, with a one-sentence rationale.`,
    ].join("\n");

    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: JUDGE_MODEL,
      max_tokens: 512,
      // No `temperature` — removed on Opus 4.8 (400 if sent). Thinking disabled is
      // still accepted on Opus 4.8, and json_schema output keeps the reply clean.
      thinking: { type: "disabled" },
      system: JUDGE_SYSTEM,
      messages: [{ role: "user", content: userMsg }],
      output_config: { format: { type: "json_schema", schema: JUDGE_SCHEMA } },
    });
    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "judge refused" }, { status: 500 });
    }
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") {
      return NextResponse.json({ error: "no judge output" }, { status: 500 });
    }
    const parsed = JSON.parse(block.text) as { rating: number; rationale: string };
    return NextResponse.json({ model: JUDGE_MODEL, rating: parsed.rating, rationale: parsed.rationale });
  } catch (err) {
    console.error("[/api/eval/judge]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "judge error" }, { status: 500 });
  }
}
