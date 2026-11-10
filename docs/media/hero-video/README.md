# Hero video source

The Remotion project that cut the README hero (`docs/media/movie-match-full-game.*`) from one recorded demo game. It is not part of the app: it has its own `package.json`, and the app's lint, type-check and build skip this folder.

- `src/Hero.tsx`: the clips, captions and phone frame. `SEGS` lists which seconds of the recording are shown and how fast.
- `src/Root.tsx`: two compositions from the same scenes, `Promo-Landscape` (1920x1080) and `Promo-Portrait` (1080x1920), both 20 s at 30 fps.

## Rebuild it

The recording (`public/game.mp4`, about 90 MB) is not committed, so record it first.

1. Record a demo game with the capture script (see the notes at the top of `../capture-demo-game.mjs`). It needs Playwright in this folder:

   ```bash
   npm i --no-save playwright@1.49.1 && npx playwright install chromium
   node ../capture-demo-game.mjs ./capture
   ```

2. Turn the frames into a 30 fps video:

   ```bash
   mkdir -p public && cd capture && ffmpeg -y -f concat -safe 0 -i frames.txt -vf "scale=780:1688:flags=lanczos,format=yuv420p" -fps_mode cfr -r 30 -c:v libx264 -crf 14 -preset slow ../public/game.mp4 && cd ..
   ```

3. A new recording has different timings, so update the start and end seconds in `SEGS` to match. `capture/timeline.json` has a timestamp for every step of the game.

4. Install, preview and render:

   ```bash
   npm install
   npm run studio
   npm run render
   ```

5. Make the README files from the renders:

   ```bash
   ffmpeg -y -i out/promo-landscape.mp4 -an -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p -movflags +faststart ../movie-match-full-game.mp4
   ffmpeg -y -i out/promo-portrait.mp4 -an -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p -movflags +faststart ../movie-match-full-game-portrait.mp4
   ffmpeg -y -i out/promo-landscape.mp4 -r 10 -vf "scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" ../movie-match-full-game.gif
   ```

   Keep the GIF under 5 MB. If it grows, lower `max_colors`.

Remotion is free for individuals and small teams; some companies need a licence ([terms](https://www.remotion.dev/license)).
