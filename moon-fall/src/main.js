import * as THREE from 'three';
import { clamp, lerp, sstep, easeIO, rng, distKm, speedKms, sizeX, tidalX, T_IMPACT_H } from './util.js';
import { City } from './city.js';
import { Arms, headMotion } from './fps.js';
import { Space } from './space.js';
import { SHOTS, CAPTIONS, CHAPTERS, DURATION } from './timeline.js';

const params = new URLSearchParams(location.search);
const W = +(params.get('w') ?? 1920), H = +(params.get('h') ?? 1080), FPS = 30;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);
const out = document.createElement('canvas'); out.width = W; out.height = H;
const g = out.getContext('2d');
const RS = +(params.get('rs') ?? 0.8333);
const rt = new THREE.WebGLRenderTarget(Math.round(W * RS), Math.round(H * RS), { type: THREE.HalfFloatType, samples: +(params.get('msaa') ?? 0) });
const ovTex = new THREE.CanvasTexture(out); ovTex.colorSpace = THREE.NoColorSpace; ovTex.generateMipmaps = false; ovTex.minFilter = THREE.LinearFilter;
const comp = new THREE.ShaderMaterial({
  uniforms: { scene: { value: rt.texture }, ov: { value: ovTex }, uSeed: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) }, uHaze: { value: 0 }, uExp: { value: 1.05 }, uRes: { value: new THREE.Vector2(W, H) } },
  depthTest: false, depthWrite: false, side: THREE.DoubleSide,
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.x,-position.y,0.,1.); }`,
  fragmentShader: `uniform sampler2D scene, ov; uniform float uSeed, uHaze, uExp; uniform vec3 uTint; uniform vec2 uRes; varying vec2 vUv;
    vec3 RRT(vec3 v){ vec3 a=v*(v+0.0245786)-0.000090537; vec3 b=v*(0.983729*v+0.4329510)+0.238081; return a/b; }
    vec3 aces(vec3 c){ const mat3 I=mat3(vec3(0.59719,0.07600,0.02840),vec3(0.35458,0.90834,0.13383),vec3(0.04823,0.01566,0.83777));
      const mat3 O=mat3(vec3(1.60475,-0.10208,-0.00327),vec3(-0.53108,1.10813,-0.07276),vec3(-0.07367,-0.00605,1.07602));
      c*=uExp/0.6; c=I*c; c=RRT(c); c=O*c; return clamp(c,0.,1.); }
    float s1(float c){ return c<=0.0031308? c*12.92 : 1.055*pow(c,1./2.4)-0.055; }
    float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233))+uSeed*1.618)*43758.5453); }
    void main(){
      vec3 c=aces(texture2D(scene,vUv).rgb); c=vec3(s1(c.r),s1(c.g),s1(c.b));
      c*=uTint;
      if(uHaze>0.){ vec3 h=vec3(1.,0.35,0.08); vec3 o=mix(2.*c*h,1.-2.*(1.-c)*(1.-h),step(0.5,c)); c=mix(c,o,uHaze*0.5); }
      float r=length((vUv-0.5)*uRes); c*=1.-0.62*clamp((r-0.35*uRes.y)/(0.65*uRes.y),0.,1.);
      c+=(hash(floor(vUv*uRes*0.5))-0.5)*0.045;
      vec4 o=texture2D(ov,vUv); c=mix(c,o.rgb,o.a);
      gl_FragColor=vec4(c,1.);
    }`,
});
const compScene = new THREE.Scene(); const compQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), comp); compQuad.frustumCulled = false; compScene.add(compQuad);
const compCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const city = new City();
const space = new Space(city.tex.moon);
const camera = new THREE.PerspectiveCamera(55, W / H, 0.3, 30000);
const arms = new Arms();
const scam = new THREE.PerspectiveCamera(40, W / H, 0.05, 20000);

// ---------- precomputed overlay assets ----------
const vign = document.createElement('canvas'); vign.width = W; vign.height = H;
{ const v = vign.getContext('2d'); const gr = v.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.62)'); v.fillStyle = gr; v.fillRect(0, 0, W, H); }
const grains = [];
for (let k = 0; k < 6; k++) { const c = document.createElement('canvas'); c.width = 640; c.height = 360; const x = c.getContext('2d'); const id = x.createImageData(640, 360); const R = rng(100 + k); for (let i = 0; i < id.data.length; i += 4) { const v = R() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); grains.push(c); }

const fmt = n => Math.round(n).toLocaleString('en-US');
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
function clock(T) { const d = Math.floor(T / 24), hm = T - d * 24; const hh = Math.floor(hm), mm = Math.floor((hm - hh) * 60); return `${DAYS[d]} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; }

function spaced(text, x, y, spacing, align = 'left') {
  // letter-spaced text
  let w = 0; for (const ch of text) w += g.measureText(ch).width + spacing; w -= spacing;
  let cx = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
  const old = g.textAlign; g.textAlign = 'left';
  for (const ch of text) { g.fillText(ch, cx, y); cx += g.measureText(ch).width + spacing; }
  g.textAlign = old; return w;
}
function shadowOn(b = 14, a = 0.75) { g.shadowColor = `rgba(0,0,0,${a})`; g.shadowBlur = b; g.shadowOffsetY = 2; }
function shadowOff() { g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0; }

function drawHUD(h, a) {
  if (!h || a <= 0) return;
  g.save(); g.globalAlpha = a; g.fillStyle = '#fff'; shadowOn(12, 0.6);
  g.font = '600 17px Inter'; spaced(h.label, 96, 92, 3.2);
  g.font = '500 66px "EB Garamond"'; g.fillText(h.value, 92, 156);
  if (h.sub) { g.font = '500 15px Inter'; g.globalAlpha = a * 0.85; spaced(h.sub, 96, 186, 2.6); }
  if (h.clock) { g.globalAlpha = a; g.font = '600 17px Inter'; spaced(h.clock, W - 96, 92, 3.2, 'right'); }
  if (h.clock2) { g.globalAlpha = a * 0.85; g.font = '500 15px Inter'; spaced(h.clock2, W - 96, 122, 2.6, 'right'); }
  shadowOff(); g.restore();
}
function wrap(text, maxW) {
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
function drawCaption(text, a, big) {
  if (a <= 0) return;
  g.save(); g.globalAlpha = a; g.fillStyle = '#fff'; g.textAlign = 'center';
  g.font = big ? 'italic 500 80px "EB Garamond"' : 'italic 400 50px "EB Garamond"';
  const lines = wrap(text, 1500); const lh = big ? 88 : 60;
  const y0 = (big ? H / 2 + 20 : H - 118) - (lines.length - 1) * lh;
  shadowOn(18, 0.85);
  lines.forEach((l, i) => g.fillText(l, W / 2, y0 + i * lh));
  shadowOff(); g.restore();
}
function drawChapter(c, a) {
  if (a <= 0) return;
  g.save(); g.globalAlpha = a; g.fillStyle = '#fff'; g.textAlign = 'center'; shadowOn(20, 0.8);
  g.font = '600 18px Inter'; spaced(c.num, W / 2, H / 2 - 52, 6, 'center');
  g.font = '500 92px "EB Garamond"'; g.fillText(c.title, W / 2, H / 2 + 42);
  g.globalAlpha = a * 0.7; g.fillRect(W / 2 - 40, H / 2 - 30, 80, 1.5);
  shadowOff(); g.restore();
}
function project(v3, cam) { const v = v3.clone().project(cam); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H, v.z]; }

// ---------- graph (distance vs time) ----------
function drawGraph(p, hl) {
  g.save();
  g.fillStyle = '#07090f'; g.fillRect(0, 0, W, H);
  const X0 = 260, X1 = 1680, Y0 = 250, Y1 = 860;
  const Tm = T_IMPACT_H;
  const xOf = T => X0 + (T / Tm) * (X1 - X0), yOf = d => Y1 - (d / 384400) * (Y1 - Y0);
  g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1;
  g.fillStyle = 'rgba(255,255,255,0.6)'; g.font = '500 15px Inter';
  for (let d = 0; d <= 4; d++) { const x = xOf(d * 24); g.beginPath(); g.moveTo(x, Y0); g.lineTo(x, Y1); g.stroke(); g.textAlign = 'center'; spaced(DAYS[d].slice(0, 3), x + (xOf(24) - xOf(0)) / 2, Y1 + 36, 3, 'center'); }
  for (let k = 0; k <= 4; k++) { const d = k * 100000; const y = yOf(d); g.beginPath(); g.moveTo(X0, y); g.lineTo(X1, y); g.stroke(); g.textAlign = 'right'; g.fillText(k === 0 ? '0' : `${k * 100},000 km`, X0 - 18, y + 5); }
  g.fillStyle = '#fff'; g.font = '600 17px Inter'; spaced('MOON DISTANCE FROM EARTH', X0, Y0 - 50, 3.2);
  // curve
  g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.lineJoin = 'round'; g.beginPath();
  const Tend = Tm * p; let first = true, lx = 0, ly = 0;
  for (let i = 0; i <= 600; i++) { const T = Math.min(Tend, Tm * i / 600); const x = xOf(T), y = yOf(distKm(T)); if (first) { g.moveTo(x, y); first = false; } else g.lineTo(x, y); lx = x; ly = y; if (T >= Tend) break; }
  shadowOn(16, 0.5); g.stroke(); shadowOff();
  g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(lx, ly, 9, 0, 7); g.fill();
  // highlights
  const box = (Ta, Tb, label, a) => { if (a <= 0) return; g.globalAlpha = a; g.fillStyle = 'rgba(255,210,122,0.14)'; g.fillRect(xOf(Ta), Y0, xOf(Tb) - xOf(Ta), Y1 - Y0); g.fillStyle = '#ffd27a'; g.font = 'italic 400 34px "EB Garamond"'; g.textAlign = 'center'; g.fillText(label, (xOf(Ta) + xOf(Tb)) / 2 - (Tb - Ta < 10 ? 120 : 0), Y0 - 10 + (Tb - Ta < 10 ? 0 : 0)); g.globalAlpha = 1; };
  box(0, 94.7, 'first half of the distance: 3 days, 23 hours', hl.half || 0);
  box(108.65, Tm, 'last 100,000 km: under 7 hours', hl.last || 0);
  g.restore();
}

// ---------- meteors and flashes (2D) ----------
function drawSkyFX(st, t) {
  const m = st.meteors || 0;
  if (m > 0) {
    g.save(); g.globalCompositeOperation = 'lighter';
    const R = rng(555); const N = Math.floor(260 * m);
    const ox = st.meteorOrigin ? st.meteorOrigin[0] : W * 0.5, oy = st.meteorOrigin ? st.meteorOrigin[1] : -200;
    for (let i = 0; i < 260; i++) {
      const st0 = R() * 6, dur = 0.6 + R() * 1.4, ang = (R() - 0.5) * 1.3 + Math.PI / 2, sx = ox + (R() - 0.5) * W * 1.6, sy = oy + (R() - 0.5) * 300, L = 300 + R() * 900, wdt = 1.5 + R() * 4 * (R() < 0.15 ? 3 : 1);
      if (i >= N) continue;
      const ph = ((t - st0) % 6 + 6) % 6; if (ph > dur) continue;
      const u = ph / dur; const hx = sx + Math.cos(ang) * L * u * 1.6, hy = sy + Math.sin(ang) * L * u * 1.6;
      const tx = hx - Math.cos(ang) * L * 0.6, ty = hy - Math.sin(ang) * L * 0.6;
      const gr = g.createLinearGradient(tx, ty, hx, hy); gr.addColorStop(0, 'rgba(255,120,40,0)'); gr.addColorStop(0.8, 'rgba(255,170,80,0.55)'); gr.addColorStop(1, 'rgba(255,245,220,0.95)');
      g.strokeStyle = gr; g.lineWidth = wdt; g.lineCap = 'round'; g.beginPath(); g.moveTo(tx, ty); g.lineTo(hx, hy); g.stroke();
      const rg = g.createRadialGradient(hx, hy, 0, hx, hy, wdt * 6); rg.addColorStop(0, 'rgba(255,240,200,0.9)'); rg.addColorStop(1, 'rgba(255,140,40,0)'); g.fillStyle = rg; g.fillRect(hx - wdt * 6, hy - wdt * 6, wdt * 12, wdt * 12);
    }
    g.restore();
  }
  const f = st.horizonFlashes || 0;
  if (f > 0) {
    g.save(); g.globalCompositeOperation = 'lighter'; const R = rng(77);
    for (let i = 0; i < 40; i++) {
      const t0 = R() * 5, x = R() * W, y = (st.horizonY ?? 560) + (R() - 0.5) * 30, s = 120 + R() * 380; if (i / 40 > f) continue;
      const ph = ((t - t0) % 5 + 5) % 5; if (ph > 1.6) continue; const a = Math.exp(-ph * 2.5) * (ph < 0.08 ? ph / 0.08 : 1);
      const rg = g.createRadialGradient(x, y, 0, x, y, s); rg.addColorStop(0, `rgba(255,230,180,${0.9 * a})`); rg.addColorStop(0.3, `rgba(255,130,50,${0.45 * a})`); rg.addColorStop(1, 'rgba(255,80,20,0)');
      g.fillStyle = rg; g.fillRect(x - s, y - s, s * 2, s * 2);
    }
    g.restore();
  }

}

// ---------- space annotations ----------
function drawSpaceAnno(st, cam) {
  const A = st.anno; if (!A) return;
  g.save(); g.fillStyle = '#fff'; g.strokeStyle = '#fff';
  const mp = project(space.moon.position, cam), ep = project(new THREE.Vector3(0, 0, 0), cam);
  if (A.labels > 0) {
    g.globalAlpha = A.labels; shadowOn(10, 0.7); g.font = '600 16px Inter';
    g.lineWidth = 1.5; g.beginPath(); g.arc(mp[0], mp[1], 22, 0, 7); g.stroke(); spaced('MOON', mp[0] + 34, mp[1] + 6, 3.2);
    spaced('EARTH', ep[0] + (A.earthLabelDx ?? 60), ep[1] + 6, 3.2);
    shadowOff();
  }
  if (A.path > 0) {
    g.globalAlpha = A.path; g.setLineDash([10, 10]); g.lineWidth = 2; g.strokeStyle = '#ffd27a';
    const ex = lerp(mp[0], ep[0], 1), ey = lerp(mp[1], ep[1], 1);
    g.beginPath(); g.moveTo(mp[0], mp[1]); g.lineTo(lerp(mp[0], ex, A.path), lerp(mp[1], ey, A.path)); g.stroke(); g.setLineDash([]);
  }
  if (A.dist > 0) {
    g.globalAlpha = A.dist; g.font = 'italic 400 36px "EB Garamond"'; g.textAlign = 'center'; shadowOn(10, 0.7);
    g.fillText(A.distText || '384,400 km', (mp[0] + ep[0]) / 2, (mp[1] + ep[1]) / 2 - 24); shadowOff();
  }
  if (A.earths > 0) { // row of 30 Earths
    g.globalAlpha = A.earths; const n = 30;
    const L = Math.hypot(mp[0] - ep[0], mp[1] - ep[1]), r = L / n / 2; g.strokeStyle = 'rgba(120,180,255,0.9)'; g.lineWidth = 1.4;
    const k = Math.floor(n * clamp(A.earths * 1.1));
    for (let i = 0; i < k; i++) { const f = (i + 0.5) / n; g.beginPath(); g.arc(lerp(ep[0], mp[0], f), lerp(ep[1], mp[1], f), r * 0.92, 0, 7); g.stroke(); }
  }
  g.restore();
}

// ---------- camera keyframes ----------
function camAt(keys, u) {
  if (keys.length === 1) return keys[0];
  let i = 0; while (i < keys.length - 2 && u > keys[i + 1].u) i++;
  const a = keys[i], b = keys[i + 1]; const t = easeIO(clamp((u - a.u) / (b.u - a.u)));
  const L = (x, y) => x.map((v, k) => lerp(v, y[k], t));
  return { p: L(a.p, b.p), l: L(a.l, b.l), fov: lerp(a.fov ?? 55, b.fov ?? 55, t), roll: lerp(a.roll ?? 0, b.roll ?? 0, t) };
}

function stateAt(t) {
  const shot = SHOTS.find(s => t >= s.t0 && t < s.t1) || SHOTS[SHOTS.length - 1];
  const u = clamp((t - shot.t0) / (shot.t1 - shot.t0));
  const lt = t - shot.t0;
  const T = shot.T ? (typeof shot.T === 'function' ? shot.T(u) : lerp(shot.T[0], shot.T[1], u)) : 0;
  const base = { T, distKm: distKm(T), tod: (T % 24) };
  const st = Object.assign(base, shot.st ? shot.st(u, lt, base) : {});
  return { shot, u, lt, st };
}

function hudFor(shot, st, t) {
  if (shot.hud === false) return null;
  const d = st.distKm, v = speedKms(st.T);
  let sub;
  const mode = typeof shot.sub === 'function' ? shot.sub(st) : (shot.sub || 'speed');
  if (mode === 'orbit') sub = st.orbitSpeed !== undefined ? `ORBITAL SPEED ${st.orbitSpeed.toFixed(2)} KM/S` : 'ORBITAL SPEED 1.02 KM/S';
  else if (mode === 'speed') sub = `FALLING AT ${v < 1 ? v.toFixed(2) : v.toFixed(1)} KM/S`;
  else if (mode === 'tide') sub = `TIDAL FORCE ×${tidalX(st.T) < 100 ? tidalX(st.T).toFixed(1) : fmt(tidalX(st.T))}`;
  else if (mode === 'away') sub = 'DRIFTING AWAY · 3.8 CM PER YEAR';
  else sub = mode;
  const value = st.hudValue ?? (st.T >= T_IMPACT_H - 1e-6 ? '0 km' : `${fmt(d >= 384399 ? 384400 : d)} km`);
  return { label: st.hudLabel || 'MOON DISTANCE', value, sub, clock: st.clock ?? clock(st.T), clock2: st.clock2 };
}

const PROF = window.PROF = { update: 0, render: 0, blit: 0, fx: 0, grain: 0 };
window.__rf = i => renderFrame(i);
export function renderFrame(i) {
  const t = i / FPS;
  const { shot, u, lt, st } = stateAt(t);
  // ---- 3D ----
  if (shot.scene === 'city') {
    const c = camAt(shot.cam, u);
    const sh = st.shake || 0;
    const R = (k) => Math.sin(t * (13 + k * 7.3) + k) * Math.sin(t * (5.1 + k * 3.1));
    camera.position.set(c.p[0] + R(1) * sh * 0.35, c.p[1] + R(2) * sh * 0.3, c.p[2] + R(3) * sh * 0.2);
    if (st.eyeMin !== undefined) camera.position.y = Math.max(camera.position.y, st.eyeMin);
    camera.lookAt(c.l[0], c.l[1], c.l[2]);
    if (st.fp) { // first-person head motion in camera space
      const hm = headMotion(st.fp, lt);
      camera.translateX(hm.x); camera.translateY(hm.y); camera.translateZ(hm.z);
      camera.rotateX(hm.pitch); camera.rotateY(hm.yaw); camera.rotateZ(hm.roll);
    }
    camera.rotateZ((c.roll || 0) + R(4) * sh * 0.012);
    camera.fov = c.fov; camera.updateProjectionMatrix();
    let q0 = performance.now(); city.update(st, t, camera); PROF.update += performance.now() - q0;
    q0 = performance.now(); renderer.setRenderTarget(rt); renderer.render(city.scene, camera); PROF.render += performance.now() - q0;
    if (arms.update(st.arms, camera, city, lt)) { renderer.autoClear = false; renderer.clearDepth(); renderer.render(arms.scene, arms.cam); renderer.autoClear = true; }
  } else if (shot.scene === 'space') {
    const c = camAt(shot.cam, u);
    const sh = st.shake || 0;
    scam.position.set(c.p[0] + Math.sin(t * 17) * sh, c.p[1] + Math.sin(t * 23) * sh, c.p[2]);
    scam.lookAt(c.l[0], c.l[1], c.l[2]); scam.fov = c.fov; scam.updateProjectionMatrix();
    space.update(st, t, scam);
    renderer.setRenderTarget(rt); renderer.render(space.scene, scam);
  } else { renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 1); renderer.clear(); }
  // ---- 2D ----
  let q1 = performance.now();
  g.clearRect(0, 0, W, H);
  if (shot.scene !== 'city' && shot.scene !== 'space') { g.fillStyle = shot.bg || '#000'; g.fillRect(0, 0, W, H); }
  PROF.blit += performance.now() - q1; q1 = performance.now();
  if (shot.scene === 'graph') drawGraph(st.graphP ?? u, st.hl || {});
  if (shot.scene === 'city') drawSkyFX(st, t);
  if (shot.scene === 'space') drawSpaceAnno(st, scam);
  PROF.fx += performance.now() - q1; q1 = performance.now();

  PROF.grain += performance.now() - q1;
  comp.uniforms.uTint.value.set(st.tint || '#ffffff'); comp.uniforms.uHaze.value = st.heatHaze || 0; comp.uniforms.uSeed.value = i % 97;
  // HUD
  const hudA = (st.hudAlpha ?? 1) * sstep(0, 0.8, lt) * (shot.hudFadeOut ? 1 - sstep(shot.t1 - shot.t0 - 0.8, shot.t1 - shot.t0, lt) : 1);
  drawHUD(hudFor(shot, st, t), hudA);
  // title card
  if (shot.title) {
    const a = sstep(shot.title.in, shot.title.in + 1.2, lt) * (1 - sstep(shot.t1 - shot.t0 - 1.0, shot.t1 - shot.t0 - 0.1, lt));
    g.save(); g.globalAlpha = a; g.fillStyle = '#fff'; g.textAlign = 'center'; shadowOn(24, 0.8);
    g.font = '500 112px "EB Garamond"'; g.fillText(shot.title.text, W / 2, H / 2 + 20);
    if (shot.title.sub) { g.font = '600 18px Inter'; g.globalAlpha = a * 0.85; spaced(shot.title.sub, W / 2, H / 2 + 90, 6, 'center'); }
    shadowOff(); g.restore();
  }
  // chapters
  for (const c of CHAPTERS) { const d = t - c.t; if (d >= 0 && d < 4.6) drawChapter(c, sstep(0, 0.8, d) * (1 - sstep(3.6, 4.6, d))); }
  // captions
  for (const c of CAPTIONS) { if (t >= c[0] - 0.4 && t < c[1] + 0.4) { const a = sstep(c[0] - 0.4, c[0] + 0.2, t) * (1 - sstep(c[1] - 0.1, c[1] + 0.4, t)); drawCaption(c[2], a, c[3] === 'big'); } }
  // fades
  let fade = 0;
  if (shot.fadeIn) fade = Math.max(fade, 1 - sstep(0, shot.fadeIn, lt));
  if (shot.fadeOut) fade = Math.max(fade, sstep(shot.t1 - shot.t0 - shot.fadeOut, shot.t1 - shot.t0, lt));
  if (st.white) { g.fillStyle = `rgba(255,248,235,${clamp(st.white)})`; g.fillRect(0, 0, W, H); }
  if (fade > 0) { g.fillStyle = `rgba(0,0,0,${fade})`; g.fillRect(0, 0, W, H); }
  ovTex.needsUpdate = true;
  renderer.setRenderTarget(null); renderer.render(compScene, compCam);
  return renderer.domElement;
}

window.city = city; window.space = space; window.FPS = FPS; window.DURATION = DURATION; window.W = W; window.H = H;
const pix = new Uint8Array(W * H * 4), img = new ImageData(new Uint8ClampedArray(pix.buffer), W, H);
const fin = document.createElement('canvas'); fin.width = W; fin.height = H; const fg = fin.getContext('2d');
window.renderFrame = (i, q = 0.93) => {
  renderFrame(i);
  const gl = renderer.getContext(); const p0 = performance.now();
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pix); PROF.read = (PROF.read || 0) + performance.now() - p0;
  fg.putImageData(img, 0, 0);
  return fin.toDataURL('image/jpeg', q);
};
window.events = () => ({ shots: SHOTS.map(s => ({ t0: s.t0, t1: s.t1, scene: s.scene, sfx: s.sfx || null, name: s.name })), chapters: CHAPTERS, captions: CAPTIONS });
window.stateAt = t => { const s = stateAt(t); return { shot: s.shot.name, st: s.st }; };
window.READY = true;
