# Hero video source

The Remotion project that made the videos from one recorded demo game: the 2.0 video at the top of the README (`docs/media/movie-match-behind-the-scenes*.mp4`) and a 20 s silent GIF (`docs/media/movie-match-full-game.gif`) for places that can't play video. GitHub only plays a video in a README when it's uploaded through its website, so the README embeds an uploaded copy of the landscape MP4. To change the video, upload the new MP4 the same way and swap the link. It is not part of the app: it has its own `package.json`, and the app's lint, type-check and build skip this folder.

- `src/Hero.tsx`: the clips, captions and phone frame. `SEGS` lists which seconds of the recording are shown and how fast.
- `src/Root.tsx`: the compositions. `Promo-Landscape` (1920x1080) and `Promo-Portrait` (1080x1920) are the 20 s silent cut. `Narrated-Landscape` and `Narrated-Portrait` are the 30 s cut for a voiceover. `Upgrade-Landscape` and `Upgrade-Portrait` are the 61 s 2.0 video. All run at 30 fps.
- `src/Upgrade.tsx`: the 2.0 video. A drawn opening (the problem), the game, and two behind-the-scenes scenes.

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

5. Make the README GIF from the landscape render:

   ```bash
   ffmpeg -y -i out/promo-landscape.mp4 -r 10 -vf "scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" ../movie-match-full-game.gif
   ```

   Keep the GIF under 5 MB. If it grows, lower `max_colors`.

## The 30 s narrated cut

`Narrated-Landscape` and `Narrated-Portrait` use the same scenes, paced for a voiceover. The 2.0 video replaced it in the README, so the repo no longer keeps its MP4s; the source stays for a short cut. The lines and when each one starts are in `voiceover-config.json` (ElevenLabs, voice Matilda). Every line describes what is on screen at that moment.

1. Make `ELEVENLABS_API_KEY` available: set it in your shell, or keep it in a git-ignored env file outside this repo and run the script with `node --env-file=<that file>`. Never put it in this repo.
2. Generate the voice with the promo-video skill's `generate-voiceover.ts --config voiceover-config.json`. It writes `public/voiceover-normalized.mp3` and warns if one line runs into the next. If one does, shorten that line or move its start, and run it again. Then transcribe the result (Whisper, or ElevenLabs speech-to-text) to check the words and that each line starts in its scene.
3. Mix in a quiet music bed (fade in 2 s, fade out over the last 3 s) and pad to 30 s. The repo's videos use the promo-video skill's "Inspired Ambient" track from Pixabay, about 20 dB under the voice:

   ```bash
   ffmpeg -y -i public/voiceover-normalized.mp3 -i music.mp3 -filter_complex "[0:a]apad=whole_dur=30[v];[1:a]atrim=0:30,volume='0.08*min(1,t/2)*min(1,(30-t)/3)':eval=frame[m];[v][m]amix=inputs=2:duration=first:normalize=0" -c:a libmp3lame -b:a 192k public/voiceover-with-music.mp3
   ```

4. Render with the audio, then compress (the same `ffmpeg` settings work for any of the videos):

   ```bash
   npx remotion render Narrated-Landscape out/narrated-landscape.mp4 --image-format png --crf 1 --props='{"audio":"voiceover-with-music.mp3"}'
   ffmpeg -y -i out/narrated-landscape.mp4 -c:v libx264 -crf 20 -preset slow -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart out/narrated-landscape-small.mp4
   ```

## The 61 s 2.0 video

`Upgrade-Landscape` and `Upgrade-Portrait` add a drawn opening (a couple scrolling, then a film that isn't on their service) and two behind-the-scenes scenes between the phone clips:

- **The catalogue map.** The counts and methods on screen come from the code: 15,162 films embedded with OpenAI `text-embedding-3-small` (1,536 numbers each, `scripts/build-catalog.mjs`), each player's taste fingerprint as the average of their liked films, the 40 nearest films by cosine similarity in pgvector, the shared seed (the midpoint of the two players' closest pair of likes, whose nearest films fill up to 3 slots on both lists when that pair is at least 0.45 similar), and Claude ranking both lists in one call with both players' moods and swipes (`lib/retrieve.ts`, `lib/infer.ts`). The dot positions are illustrative, and the scene says so.
- **The match score.** The percentage on the match screen comes from where the film ranks on both players' lists (`lib/overlap.ts`, `lib/matchInsight.ts`). The code calls it an engagement number, not a probability, so the video calls it a match score and nothing more.
- **Only what you can stream.** The seven kept films and their services are from the demo game's real Round 3 screen; the faded tiles are blank on purpose.

The lines and start times are in `upgrade-voiceover.json`. Make the voice and mix it the same way as the 30 s cut, with `whole_dur=61` and `public/upgrade-with-music.mp3` as the output, then render with `--props='{"audio":"upgrade-with-music.mp3"}'` and compress to `../movie-match-behind-the-scenes.mp4` and `../movie-match-behind-the-scenes-portrait.mp4`.

Remotion is free for individuals and small teams; some companies need a licence ([terms](https://www.remotion.dev/license)).
