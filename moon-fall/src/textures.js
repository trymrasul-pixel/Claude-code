import * as THREE from 'three';
import { rng, fbm, fbmWrap, clamp, lerp } from './util.js';

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, wrap = true) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 4;
  return t;
}

// One facade cell = one window. Corner (0..0.12) is plain wall (used for roofs).
export function windowTexture() {
  const c = canvas(128, 128), g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#d9d4cc'; g.fillRect(0, 108, 128, 20); // floor slab line
  g.fillStyle = '#c9c3b8'; g.fillRect(28, 26, 72, 70);  // frame
  g.fillStyle = '#2d3a48'; g.fillRect(34, 32, 60, 58);  // glass
  g.fillStyle = '#4a5b6e'; g.fillRect(34, 32, 60, 14);  // sky reflection
  g.fillStyle = '#c9c3b8'; g.fillRect(62, 32, 4, 58);
  return tex(c);
}
// 8x8 cells with random lit windows (emissive map). Cell (0,0) corner stays black.
export function litTexture(seed = 3) {
  const R = rng(seed), c = canvas(1024, 1024), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    if (R() < 0.42) {
      const warm = R();
      g.fillStyle = warm < 0.7 ? `rgb(255,${190 + R() * 40 | 0},${110 + R() * 50 | 0})` : `rgb(${180 + R() * 40 | 0},${210 + R() * 30 | 0},255)`;
      g.fillRect(i * 128 + 34, j * 128 + 32, 60, 58);
    }
  }
  // flip-y aware: make sure uv (0.01,0.01) is black
  g.fillStyle = '#000'; g.fillRect(0, 1024 - 24, 24, 24); g.fillRect(0, 0, 24, 24);
  return tex(c);
}

export function roadTexture() {
  const c = canvas(256, 512), g = c.getContext('2d'), R = rng(7);
  g.fillStyle = '#3b3e45'; g.fillRect(0, 0, 256, 512);
  const id = g.getImageData(0, 0, 256, 512);
  for (let i = 0; i < id.data.length; i += 4) { const n = (R() - 0.5) * 18; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; }
  g.putImageData(id, 0, 0);
  g.fillStyle = '#d8c25a'; g.fillRect(124, 0, 3, 512); g.fillRect(130, 0, 3, 512);
  g.fillStyle = '#d9d9d9';
  for (let y = 0; y < 512; y += 128) { g.fillRect(60, y, 4, 64); g.fillRect(192, y, 4, 64); }
  return tex(c);
}
export function crosswalkTexture() {
  const c = canvas(256, 64), g = c.getContext('2d');
  g.fillStyle = '#3b3e45'; g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#e2e2e2'; for (let x = 6; x < 256; x += 26) g.fillRect(x, 4, 14, 56);
  return tex(c);
}
export function pavingTexture(base = '#9b968c') {
  const c = canvas(128, 128), g = c.getContext('2d'), R = rng(11);
  g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = `rgba(0,0,0,${0.03 + R() * 0.06})`; g.fillRect(i * 32 + 1, j * 32 + 1, 30, 30); }
  return tex(c);
}

// Cracks drawn on transparent canvas (white strokes, used as alpha-ish map)
export function crackTexture(seed = 5) {
  const c = canvas(1024, 1024), g = c.getContext('2d'), R = rng(seed);
  g.clearRect(0, 0, 1024, 1024);
  g.strokeStyle = '#0a0806'; g.lineCap = 'round'; g.lineJoin = 'round';
  function branch(x, y, a, len, w, d) {
    g.lineWidth = w; g.beginPath(); g.moveTo(x, y);
    for (let i = 0; i < len; i++) { a += (R() - 0.5) * 0.7; x += Math.cos(a) * 9; y += Math.sin(a) * 9; g.lineTo(x, y); if (d < 3 && R() < 0.05) { g.stroke(); branch(x, y, a + (R() < .5 ? 1 : -1) * (0.6 + R() * 0.6), len * 0.5, w * 0.6, d + 1); g.beginPath(); g.moveTo(x, y); g.lineWidth = w; } }
    g.stroke();
  }
  for (let k = 0; k < 7; k++) branch(R() * 1024, R() * 1024, R() * 6.28, 70 + R() * 60, 7, 0);
  return tex(c);
}

export function glowTexture(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,0.25)') {
  const c = canvas(256, 256), g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, inner); gr.addColorStop(0.25, mid); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function puffTexture() {
  const c = canvas(128, 128), g = c.getContext('2d'), R = rng(21);
  for (let i = 0; i < 14; i++) {
    const x = 34 + R() * 60, y = 34 + R() * 60, r = 16 + R() * 26;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// Moon equirect albedo. Local -z (front, facing viewer) maps to u = 0.25.
export function moonTexture() {
  const W = 2048, H = 1024, c = canvas(W, H), g = c.getContext('2d'), R = rng(42);
  const id = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H;
    const n = fbmWrap(u * 16, v * 16, 16, 5, 3);
    const m = fbmWrap(u * 4, v * 4, 4, 5, 9);
    let du = Math.abs(u - 0.25); du = Math.min(du, 1 - du);
    const front = clamp(1 - du * 2.6) * clamp(1 - Math.abs(v - 0.55) * 2.2);
    const mare = clamp((m - 0.56 + front * 0.16) * 7) ;
    let val = 190 + (n - 0.5) * 40 - mare * 85 + (fbmWrap(u * 60, v * 60, 60, 2, 4) - 0.5) * 14;
    val = clamp(val, 40, 235);
    const i = (y * W + x) * 4;
    id.data[i] = val; id.data[i + 1] = val * 0.985; id.data[i + 2] = val * 0.955; id.data[i + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  for (let k = 0; k < 900; k++) {
    const x = R() * W, y = 60 + R() * (H - 120), r = 1.5 + Math.pow(R(), 4) * 30;
    const gr = g.createRadialGradient(x - r * 0.25, y - r * 0.25, 0, x, y, r);
    gr.addColorStop(0, 'rgba(40,38,36,0.22)'); gr.addColorStop(0.75, 'rgba(60,58,55,0.10)'); gr.addColorStop(0.9, 'rgba(255,255,250,0.22)'); gr.addColorStop(1, 'rgba(255,255,250,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r, 0, 0, 7); g.fill();
  }
  for (let k = 0; k < 4; k++) {
    const x = (0.1 + R() * 0.35) * W, y = (0.25 + R() * 0.5) * H;
    g.strokeStyle = 'rgba(255,255,250,0.07)'; g.lineWidth = 3;
    for (let a = 0; a < 30; a++) { const ang = R() * 6.28, L = 60 + R() * 220; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(ang) * L, y + Math.sin(ang) * L * 0.8); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill();
  }
  return tex(c);
}

// Earth day texture (equirect)
export function earthTextures() {
  const W = 2048, H = 1024;
  const c = canvas(W, H), g = c.getContext('2d'), id = g.createImageData(W, H);
  const cc = canvas(W, H), gc = cc.getContext('2d'), idc = gc.createImageData(W, H);
  const lc = canvas(W, H), gl = lc.getContext('2d'), idl = gl.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const lat = (0.5 - y / H) * Math.PI, alat = Math.abs(lat);
    for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H, i = (y * W + x) * 4;
      const h = fbmWrap(u * 5, v * 5, 5, 6, 1) + 0.12 * Math.sin(u * 6.28 * 2 + 1) - 0.05;
      const land = h > 0.52;
      let r, gg, b;
      if (land) {
        const dry = fbmWrap(u * 9, v * 9, 9, 4, 5);
        const desert = clamp((dry - 0.45) * 3) * clamp(1 - Math.abs(alat - 0.4) * 3);
        const elev = clamp((h - 0.52) * 4);
        r = lerp(lerp(58, 196, desert), 120, elev * 0.4); gg = lerp(lerp(96, 168, desert), 110, elev * 0.4); b = lerp(lerp(52, 110, desert), 95, elev * 0.4);
      } else {
        const d = clamp((0.52 - h) * 4);
        r = lerp(28, 8, d); gg = lerp(92, 34, d); b = lerp(140, 86, d);
      }
      if (alat > 1.22 + fbmWrap(u * 12, v * 12, 12, 3, 8) * 0.12) { r = 235; gg = 240; b = 245; }
      id.data[i] = r; id.data[i + 1] = gg; id.data[i + 2] = b; id.data[i + 3] = 255;
      // clouds
      const cl = fbmWrap(u * 7 + 3, v * 9, 7, 6, 13);
      const ca = clamp((cl - 0.57) * 3.0) * 255;
      idc.data[i] = idc.data[i + 1] = idc.data[i + 2] = 255; idc.data[i + 3] = ca;
      // lava / molten
      const lv = fbmWrap(u * 10, v * 10, 10, 6, 21);
      const crack = Math.pow(1 - Math.abs(lv - 0.5) * 2, 7);
      const hot = clamp(crack * 1.4 + (1 - fbmWrap(u * 4, v * 4, 4, 3, 30)) * 0.35);
      idl.data[i] = lerp(40, 255, hot); idl.data[i + 1] = lerp(14, 170, hot * hot); idl.data[i + 2] = lerp(8, 60, hot * hot * hot); idl.data[i + 3] = 255;
    }
  }
  g.putImageData(id, 0, 0); gc.putImageData(idc, 0, 0); gl.putImageData(idl, 0, 0);
  return { day: tex(c), clouds: tex(cc), lava: tex(lc) };
}
