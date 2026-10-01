"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { AvailabilityLabel } from "@/lib/filter";
import { genreNames } from "@/lib/genres";
import type { MatchMovie } from "@/lib/inferTypes";
import { display, mono } from "./palace";

/** The strip when the poster's colours can't be read: the house colours, light to dark. */
const HOUSE_STRIP = ["#f2e8d5", "#d6a24a", "#b8141e", "#6e0b12", "#0e0a09"];

/**
 * The match as a collectible poster card (MatchOpen board): poster stock, the real
 * TMDB poster, the title in big red caps, year and genres, a colour strip taken
 * from the poster, where to watch, and the brass match stamp. Only fields the match
 * already has. Its own component so Track C can reuse it for the 9:16 share card.
 */
export function PosterCard({ movie, where }: { movie: MatchMovie; where: AvailabilityLabel | null }) {
  const strip = usePosterStrip(movie.posterUrl);
  const [titleRef, titleSize] = useTitleFit(movie.title);
  const meta = [movie.year, ...genreNames(movie.genreIds).slice(0, 2)].filter(Boolean).join(" · ");
  const verb = where?.type === "rent" ? "Rent on" : where?.type === "buy" ? "Buy on" : "Watch on";

  return (
    <figure className="relative flex w-full max-w-[264px] flex-none flex-col gap-2.5 rounded-md bg-cream px-2.5 pb-3.5 pt-2.5 text-projection shadow-[0_30px_60px_-20px_rgba(0,0,0,0.9)]">
      <div className="aspect-[2/3] overflow-hidden rounded-[3px] bg-[#e3d5bc]">
        {movie.posterUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- external TMDB poster
          <img src={movie.posterUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>

      <figcaption className="flex flex-col gap-[7px] px-1">
        <h2 ref={titleRef} className={`${display} ${titleSize} text-velvet [overflow-wrap:anywhere]`}>
          {movie.title}
        </h2>
        {meta && <span className={`${mono} text-[10px] tracking-[0.16em] [text-wrap:balance]`}>{meta}</span>}
      </figcaption>

      <div className="flex items-end justify-between gap-3 px-1">
        <div aria-hidden className="flex">
          {(strip ?? HOUSE_STRIP).map((c, i) => (
            <span
              key={i}
              className="h-[22px] w-[22px] shadow-[inset_0_0_0_1px_rgba(14,10,9,0.2)] transition-[background-color] duration-500"
              // Blank while the poster is still being read, so the strip never flips.
              style={{ backgroundColor: strip ? c : "rgba(14,10,9,0.08)" }}
            />
          ))}
        </div>
        {where && (
          <span className={`${mono} text-right text-[10px] leading-[1.5] tracking-[0.14em]`}>
            {verb}
            <br />
            {where.provider}
          </span>
        )}
      </div>

      {/* The brass match stamp, slapped on the corner. */}
      <div className="absolute -right-3.5 -top-[18px] flex h-[86px] w-[86px] -rotate-12 flex-col items-center justify-center gap-0.5 rounded-full bg-brass text-projection shadow-[0_10px_24px_-8px_rgba(0,0,0,0.8),inset_0_0_0_3px_#0e0a09,inset_0_0_0_5px_#d6a24a,inset_0_0_0_6px_#0e0a09]">
        <span className={`${display} text-[30px] leading-none`}>{movie.matchPercent}%</span>
        <span className={`${mono} text-[9px] tracking-[0.2em]`}>Match</span>
      </div>
    </figure>
  );
}

/** Title sizes, largest first: 52 px as on the board, smaller for long titles. */
const TITLE_STEPS = [
  { px: 52, className: "text-[52px] leading-[0.82]" },
  { px: 42, className: "text-[42px] leading-[0.84]" },
  { px: 34, className: "text-[34px] leading-[0.88]" },
];

/**
 * The largest title size at which every word fits the card and the title runs to
 * about three lines at most, measured with the loaded display font (letter counts
 * are a poor guide: at 52 px, TERMINATOR is wider than EXTINCTION).
 */
function useTitleFit(title: string) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(0);

  useLayoutEffect(() => {
    let live = true;
    document.fonts.ready.then(() => {
      const el = ref.current;
      const ctx = document.createElement("canvas").getContext("2d");
      if (!live || !el || !ctx) return;
      const words = title.toUpperCase().split(/\s+/);
      const room = el.clientWidth;
      const fits = (px: number) => {
        ctx.font = `900 ${px}px ${getComputedStyle(el).fontFamily}`;
        const widths = words.map((w) => ctx.measureText(w).width);
        const total = widths.reduce((a, b) => a + b, 0) + ctx.measureText(" ").width * (words.length - 1);
        return Math.max(...widths) <= room && total <= room * 2.6;
      };
      const fit = TITLE_STEPS.findIndex((s) => fits(s.px));
      setStep(fit === -1 ? TITLE_STEPS.length - 1 : fit);
    });
    return () => {
      live = false;
    };
  }, [title]);

  return [ref, TITLE_STEPS[step].className] as const;
}

/**
 * Five colours read from the poster, light to dark: null while reading, the house
 * strip if the poster can't be read. The visible poster never depends on this read.
 */
function usePosterStrip(src: string | null): string[] | null {
  const [read, setRead] = useState<{ src: string; colours: string[] } | null>(null);

  useEffect(() => {
    if (!src) return;
    let live = true;
    // TMDB sends its CORS header only when asked, and the browser has usually
    // cached the poster from an earlier round without it, which would leave the
    // pixels unreadable. "reload" fetches a fresh, CORS-enabled copy instead.
    fetch(src, { mode: "cors", cache: "reload" })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`poster ${r.status}`))))
      .then((blob) => createImageBitmap(blob))
      .then((bitmap) => {
        const colours = paletteOf(bitmap);
        bitmap.close();
        if (live) setRead({ src, colours: colours ?? HOUSE_STRIP });
      })
      .catch(() => live && setRead({ src, colours: HOUSE_STRIP }));
    return () => {
      live = false;
    };
  }, [src]);

  if (!src) return HOUSE_STRIP;
  return read?.src === src ? read.colours : null;
}

/** The five most common, clearly different colours in an image, light to dark. */
function paletteOf(img: CanvasImageSource): string[] | null {
  try {
    const w = 30;
    const h = 45;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h).data;

    // Bucket at 3 bits a channel, then rank buckets by how much of the poster they cover.
    const buckets = new Map<number, [number, number, number, number]>();
    for (let i = 0; i < px.length; i += 4) {
      const key = ((px[i] >> 5) << 6) | ((px[i + 1] >> 5) << 3) | (px[i + 2] >> 5);
      const b = buckets.get(key) ?? [0, 0, 0, 0];
      b[0] += px[i];
      b[1] += px[i + 1];
      b[2] += px[i + 2];
      b[3] += 1;
      buckets.set(key, b);
    }
    const ranked = [...buckets.values()]
      .sort((a, b) => b[3] - a[3])
      .map(([r, g, b, n]) => [r / n, g / n, b / n]);

    // Prefer colours far apart; relax the gap for posters with a narrow palette.
    for (const gap of [64, 40, 20]) {
      const picked: number[][] = [];
      for (const c of ranked) {
        if (picked.every((p) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) >= gap)) picked.push(c);
        if (picked.length === 5) break;
      }
      if (picked.length === 5) return picked.sort((a, b) => luma(b) - luma(a)).map(hex);
    }
    return null;
  } catch {
    return null;
  }
}

const luma = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const hex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
