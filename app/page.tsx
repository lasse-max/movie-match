// Minimal holding page for the early Vercel deploy. The real 3-round game flow
// (setup → R1 → R2 → R3 → match) replaces this in the next steps.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="text-5xl" aria-hidden>
        🎬
      </div>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Movie Match
      </h1>
      <p className="max-w-md text-balance text-base text-foreground/70">
        Two people, one phone, three rounds, ~2 minutes — and a movie you both
        actually want to watch tonight.
      </p>
      <p className="text-sm text-foreground/50">Phase&nbsp;1 MVP — under construction.</p>
    </main>
  );
}
