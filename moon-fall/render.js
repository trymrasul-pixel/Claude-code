// Usage:
//   node render.js stills <outdir> t1 t2 ...          -> JPEG stills at times (s)
//   node render.js range <startFrame> <endFrame> <out.mp4>
//   node render.js events <out.json>                   -> control curves for audio
import http from 'http'; import fs from 'fs'; import path from 'path'; import { spawn } from 'child_process';
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const root = path.dirname(new URL(import.meta.url).pathname);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((q, r) => { const p = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
await new Promise(r => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text()); });
page.on('pageerror', e => console.error('[pageerror]', e));
await page.goto(`http://localhost:${port}/index.html`);
await page.waitForFunction(() => window.READY || window.ERR, null, { timeout: 180000 });
const err = await page.evaluate(() => window.ERR); if (err) { console.error(err); process.exit(1); }
const [mode, ...rest] = process.argv.slice(2);
const FPS = await page.evaluate(() => window.FPS);
if (mode === 'stills') {
  const [dir, ...times] = rest; fs.mkdirSync(dir, { recursive: true });
  for (const t of times) {
    const t0 = Date.now();
    const url = await page.evaluate(i => window.renderFrame(i, 0.9), Math.round(parseFloat(t) * FPS));
    fs.writeFileSync(path.join(dir, `t${String(t).padStart(6, '0')}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
    console.log('still', t, Date.now() - t0, 'ms');
  }
} else if (mode === 'range') {
  const [a, b, out] = rest; const A = +a, B = +b;
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let i = A; i < B; i++) {
    const url = await page.evaluate(k => window.renderFrame(k, 0.94), i);
    const buf = Buffer.from(url.split(',')[1], 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((i - A) % 150 === 0) console.log(`${out}: frame ${i} (${i - A}/${B - A}) ${((Date.now() - t0) / 1000 / Math.max(1, i - A + 1)).toFixed(3)} s/frame`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  console.log('done', out, ((Date.now() - t0) / 1000).toFixed(0), 's');
} else if (mode === 'events') {
  const [out] = rest;
  const data = await page.evaluate(() => { const D = window.DURATION, arr = []; for (let t = 0; t < D; t += 0.1) { const s = window.stateAt(t); const st = s.st; arr.push({ t: +t.toFixed(2), shot: s.shot, shake: st.shake || 0, wind: st.wind || 0, amp: (st.water && st.water.amp) || 0, level: (st.water && st.water.level) || 0, meteors: st.meteors || 0, flashes: st.horizonFlashes || 0, fire: st.skyFire || 0, white: st.white || 0, chaos: st.chaos || 0, moonHeat: st.moonHeat || 0, moonSep: st.moonSep || 0, collapse: st.collapse || 0, crowd: (st.crowd && st.crowd.mode) || 'walk', traffic: st.traffic ?? 1, flicker: st.flicker ? 1 : 0, power: st.power ?? 1, orbitSpeed: st.orbitSpeed ?? null, lava: st.lava || 0, vapor: st.vapor || 0 }); } return { D, arr, ev: window.events() }; });
  fs.writeFileSync(out, JSON.stringify(data));
}
await browser.close(); server.close();
