# What If the Moon Fell to Earth? (YouTube long-form video)

A procedurally rendered, low-poly 3D "what if" simulation (16:9, 1920×1080, 30 fps, ~11 min).

- `src/` — three.js scenes (coastal city, Earth/Moon space scenes), timeline, captions, HUD.
- `render.js` — headless-Chromium frame renderer (`stills`, `range`, `events` modes).
- `render_all.sh` — resumable chunked full render → `out/chunk_*.mp4`.
- `audio.py` — procedural music + sound design from `out/events.json` → `out/soundtrack.wav`.
- `finalize.sh` — concat + mux → `out/what_if_the_moon_fell_to_earth.mp4`.
- `youtube/` — thumbnail(s), title/description/tags/hashtags, English subtitles (`.srt`).

Rebuild: `npm install && N=3 ./render_all.sh && node render.js events out/events.json && python3 audio.py && ffmpeg -i out/soundtrack.wav -af "acompressor=threshold=-34dB:ratio=3.5:attack=30:release=600:knee=8:makeup=1,loudnorm=I=-16:TP=-1.5:LRA=9" -ar 48000 out/soundtrack_mastered.wav && ./finalize.sh`
