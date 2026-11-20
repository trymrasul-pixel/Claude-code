// Shot list, captions and chapter cards for "What If the Moon Fell to Earth?"
import { clamp, lerp, sstep, easeIO, distKm, sizeX, T_IMPACT_H } from './util.js';

const dirEl = (azDeg, elDeg) => { const a = azDeg * Math.PI / 180, e = elDeg * Math.PI / 180; return [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)]; };
const AX = [Math.cos(1.768), 0, Math.sin(1.768)];           // fall axis in space scenes
const MP = d => AX.map(v => v * d / 1000);                    // moon position (space units) at distance d km
const bright = T => sizeX(T) ** 2;

export const SHOTS = [];
const shot = (name, t0, t1, scene, o = {}) => SHOTS.push({ name, t0, t1, scene, ...o });

// ───────────── COLD OPEN ─────────────
shot('open', 0, 46, 'city', {
  T: [0, 46 / 3600], fadeIn: 2.5, sub: 'orbit', sfx: 'night',
  cam: [
    { u: 0, p: [-9.3, 3.65, 84], l: [-3, 4.5, -300], fov: 58 },
    { u: 0.3, p: [-9.3, 3.65, 63], l: [-6, 4.0, -300], fov: 58 },
    { u: 0.57, p: [-9.3, 3.65, 44], l: [0, 6, -300], fov: 58 },
    { u: 0.7, p: [-9.2, 3.65, 43.4], l: [0, 400, -120], fov: 54 },
    { u: 1, p: [-9.2, 3.65, 43.1], l: [0, 420, -112], fov: 46 },
  ],
  st: (u, lt) => ({ tod: 0.0, moonDir: dirEl(0, 74), crowd: { mode: 'walk', density: 0.45 }, traffic: 0.8, water: { level: 0, amp: 0.35 },
    orbitSpeed: lerp(1.02, 0, sstep(29.5, 32, lt)), clock2: lt > 31 ? 'T + 0 MIN' : null, moonBright: 1,
    fp: { walk: 1 - sstep(24, 27, lt) } }),
});
shot('title', 46, 54, 'space', {
  hud: false, fadeIn: 1.0, fadeOut: 0.6, sfx: 'title',
  title: { text: 'What If the Moon Fell to Earth?', sub: 'A SIMULATION IN SIX CHAPTERS', in: 0.6 },
  cam: [{ u: 0, p: MP(384400).map((v, i) => v + [6.5, 1.2, 4.5][i]), l: MP(384400), fov: 34 }, { u: 1, p: MP(384400).map((v, i) => v + [5.6, 1.0, 3.6][i]), l: MP(384400), fov: 34 }],
  st: () => ({ T: 0, distKm: 384400, moonAxis: AX }),
});

// ───────────── CHAPTER 1 · THE FALL BEGINS ─────────────
shot('scale', 54, 100, 'space', {
  sfx: 'space', fadeIn: 1.0, sub: st => st.subMode,
  cam: [
    { u: 0, p: [-10, 700, 520], l: [-14, 0, 215], fov: 40 },
    { u: 0.55, p: [-14, 660, 490], l: [-16, 0, 215], fov: 40 },
    { u: 0.72, p: [19.6, 3.5, -36.8], l: MP(380000), fov: 30 },
    { u: 1, p: [17.5, 3, -32], l: MP(380000), fov: 28 },
  ],
  st: (u, lt) => {
    const stopU = 0.47;
    const a = 1.768 - 0.32 * (1 - Math.min(u, stopU) / stopU);
    const T = sstep(stopU, 1, u) * 1.0;
    const near = u > 0.62;
    return { T, distKm: distKm(T), moonAxis: AX, moonOrbitAngle: u < stopU ? a : undefined, subMode: u < stopU ? 'orbit' : 'speed',
      orbitOpacity: (1 - sstep(0.47, 0.6, u)) * 0.45 * sstep(0, 0.05, u), earthRot: 1.2 + lt * 0.01,
      anno: near ? { labels: sstep(0.8, 0.86, u) * 0.9, path: sstep(0.8, 0.92, u), earthLabelDx: -170 } :
        { labels: sstep(0.02, 0.08, u) * (1 - sstep(0.57, 0.6, u)), earths: sstep(0.2, 0.3, u) * (1 - sstep(0.36, 0.4, u)), dist: sstep(0.1, 0.14, u) * (1 - sstep(0.36, 0.4, u)), path: sstep(0.48, 0.55, u) * (1 - sstep(0.57, 0.6, u)) },
      clock2: u > stopU ? `T + ${Math.floor(T * 60)} MIN` : null, clock: u > stopU ? undefined : 'MONDAY · 00:00' };
  },
});
shot('graph', 100, 140, 'graph', {
  hud: false, sfx: 'graph', fadeIn: 0.6, fadeOut: 0.8,
  st: (u, lt) => ({ graphP: sstep(5, 16, lt), hl: { half: sstep(18, 19, lt) * (1 - sstep(23, 24, lt)), last: sstep(23.5, 24.5, lt) * (1 - sstep(36, 37, lt)) } }),
});

// ───────────── CHAPTER 2 · NOBODY NOTICES ─────────────
shot('day1a', 140, 160, 'city', {
  T: [10.0, 10.2], fadeIn: 1.0, sfx: 'day',
  cam: [{ u: 0, p: [-9.3, 3.65, 152], l: [-2, 4, -200], fov: 58 }, { u: 0.55, p: [-9.3, 3.65, 136], l: [6, 7, 60], fov: 58 }, { u: 1, p: [-9.3, 3.65, 124], l: [0, 4.5, -200], fov: 58 }],
  st: (u, lt) => ({ moonVisible: false, crowd: { mode: 'walk', density: 1 }, traffic: 1, water: { level: 0.2, amp: 0.3 }, fp: { walk: 1 } }),
});
shot('day1b', 160, 178, 'city', {
  T: [16.5, 16.8], sfx: 'beach', fadeOut: 0.8,
  cam: [{ u: 0, p: [-52, 3.65, -38.6], l: [-30, -14, -120], fov: 56 }, { u: 0.55, p: [-52, 3.65, -38.8], l: [-28, -13, -120], fov: 56 }, { u: 0.78, p: [-52, 3.65, -39], l: [20, 3, -260], fov: 56 }, { u: 1, p: [-52, 3.65, -39.1], l: [30, 3.5, -260], fov: 56 }],
  st: (u, lt) => ({ moonVisible: false, crowd: { mode: 'walk', density: 1 }, traffic: 1, water: { level: 0.3, amp: 0.35 }, fp: { walk: 0 },
    arms: { pose: 'phone', amt: 1 - sstep(0.58, 0.72, u), sleeve: '#a33b2f' } }),
});
shot('night2', 178, 196, 'city', {
  T: [44.0, 44.25], fadeIn: 1.0, sfx: 'nightcrowd',
  cam: [{ u: 0, p: [-13, 3.65, -35.8], l: [-40, 3, -200], fov: 54 }, { u: 0.3, p: [-12.5, 3.65, -36], l: [4, 110, -500], fov: 50 }, { u: 1, p: [-11.5, 3.65, -36.2], l: [4, 122, -500], fov: 46 }],
  st: (u, lt, b) => ({ moonDir: dirEl(4, 18), moonBright: bright(b.T), moonK: 3.4, crowd: { mode: 'watch', density: 1 }, traffic: 0.6, water: { level: 0.6, amp: 0.45 }, fp: { walk: 0 } }),
});
shot('night2b', 196, 215, 'city', {
  T: [46.0, 46.3], sfx: 'nightcrowd', fadeOut: 1.0,
  cam: [{ u: 0, p: [-60, 46, 60], l: [10, 60, -900], fov: 44 }, { u: 1, p: [-52, 44, 40], l: [10, 70, -900], fov: 42 }],
  st: (u, lt, b) => ({ moonDir: dirEl(3, 24), moonBright: bright(b.T), crowd: { mode: 'watch', density: 1 }, traffic: 0.6, water: { level: 0.5, amp: 0.45 } }),
});

// ───────────── CHAPTER 3 · THE TIDES ─────────────
const tideLevel = u => { const up = sstep(0.4, 0.72, u), down = sstep(0.8, 0.98, u); return lerp(lerp(0.4, 4.6, up), -5.2, down); };
shot('tide', 215, 262, 'city', {
  T: [84.0, 90.0], sub: 'tide', fadeIn: 1.0, sfx: 'tide',
  cam: [{ u: 0, p: [-30, 24, -6], l: [55, -2, -170], fov: 50 }, { u: 1, p: [-18, 22, -14], l: [70, -4, -170], fov: 50 }],
  st: (u, lt, b) => ({ tod: 12 + u * 6, moonVisible: false, water: { level: tideLevel(u), amp: 0.6 }, muddy: sstep(0.5, 0.75, u) * 0.4,
    crowd: { mode: u < 0.45 ? 'walk' : 'run', density: lerp(0.7, 0.4, u), t0: 215 + 0.45 * 47, speed: 0.7 }, traffic: u < 0.5 ? 1 : 0, sweep: sstep(0.6, 0.75, u), wind: 0.2 }),
});
shot('flood', 262, 320, 'city', {
  T: [100.0, 104.0], sub: 'tide', sfx: 'flood', fadeOut: 0.0,
  cam: [{ u: 0, p: [-3, 0, -26], l: [0, 30, 400], fov: 56 }, { u: 0.6, p: [-2, 0, -8], l: [-10, 36, 400], fov: 56 }, { u: 0.8, p: [-1.8, 0, -4], l: [60, 14, 120], fov: 58 }, { u: 1, p: [-1.5, 0, 0], l: [0, 30, 400], fov: 58 }],
  st: (u, lt, b) => ({ tod: 4 + u * 4, moonDir: dirEl(178, lerp(14, 4, u)), moonBright: bright(b.T), moonK: 3.2,
    water: { level: lerp(3.4, 5.4, u), amp: 0.7 }, muddy: 0.55, crowd: { mode: 'none' }, traffic: 0, sweep: u * 0.5,
    power: lt < 44 ? 1 : 0, flicker: lt > 40 && lt < 46, shake: sstep(44, 48, lt) * 0.9 * (1 - sstep(54, 58, lt) * 0.5), quake: sstep(44, 48, lt), wind: 0.3, dust: sstep(46, 52, lt) * 0.25,
    eyeMin: lerp(3.4, 5.4, u) + 1.25, fp: { wade: 1 - sstep(0.62, 0.7, u) * 0.85, panic: sstep(44, 48, lt) } }),
});

// ───────────── CHAPTER 4 · BREAKING POINT ─────────────
shot('quake', 320, 365, 'city', {
  T: [108.6, 109.4], sfx: 'quake', fadeIn: 0.6,
  cam: [{ u: 0, p: [-4, 3.65, 176], l: [0, 10, -200], fov: 60 }, { u: 0.2, p: [-4, 3.65, 176.5], l: [40, 26, 200], fov: 60 }, { u: 0.32, p: [-4, 3.65, 179], l: [-2, 7, 700], fov: 62 }, { u: 1, p: [-3, 3.65, 300], l: [0, 6, 800], fov: 64 }],
  st: (u, lt) => ({ tod: 12.6 + u * 0.8, moonVisible: false, chaos: 0.35, water: { level: -2.5, amp: 0.8 }, crowd: { mode: 'run', density: 0.5, t0: 300, speed: 1 }, traffic: 0,
    shake: 0.7 + 0.6 * Math.max(0, Math.sin(lt * 0.5)), quake: 1, cracks: sstep(2, 12, lt), collapse: sstep(8, 44, lt) * 0.75, dust: 0.25 + sstep(10, 30, lt) * 0.5, debris: sstep(14, 30, lt) * 0.25, wind: 0.4, power: 0,
    fp: { run: sstep(0.28, 0.36, u), panic: 1 }, arms: { pose: 'run', amt: sstep(0.3, 0.38, u), sleeve: '#3a4a3a' } }),
});
shot('moonrise', 365, 430, 'city', {
  T: [113.9, 114.4], sfx: 'moonrise',
  cam: [{ u: 0, p: [-46, 44, 70], l: [6, 40, -900], fov: 42 }, { u: 0.6, p: [-40, 42, 40], l: [6, 60, -900], fov: 42 }, { u: 1, p: [-36, 41, 24], l: [4, 90, -900], fov: 46 }],
  st: (u, lt, b) => ({ tod: 17.9 + u * 0.5, moonDir: dirEl(2, lerp(1.0, 9, u)), moonBright: bright(b.T), moonK: 3.0, chaos: 0.25, haloMul: 1.4,
    water: { level: lerp(2.5, 9.0, u), amp: lerp(1.0, 2.2, u), wall: { H: lerp(10, 70, u), front: lerp(-3200, -900, u), w: 260 } }, muddy: 0.4,
    crowd: { mode: 'none' }, traffic: 0, sweep: 1, collapse: 0.75, dust: 0.25, wind: lerp(0.4, 0.9, u), debris: lerp(0.15, 0.6, u), shake: 0.25, quake: 0.4, power: 0 }),
});

// ───────────── CHAPTER 5 · THE ROCHE LIMIT ─────────────
shot('roche', 430, 468, 'city', {
  T: [115.21, 115.40], sfx: 'roche', fadeIn: 0.8,
  cam: [{ u: 0, p: [-2, 3.65, 40], l: [0, 120, -400], fov: 62 }, { u: 0.5, p: [-1.6, 3.65, 36], l: [8, 135, -400], fov: 63 }, { u: 1, p: [-1.2, 3.65, 33], l: [0, 150, -400], fov: 64 }],
  st: (u, lt, b) => ({ tod: 19.25 + u * 0.15, moonDir: dirEl(0, lerp(16, 20, u)), moonBright: bright(b.T), moonK: 1.9, chaos: 0.2,
    moonHeat: sstep(0.25, 0.7, u), moonSep: sstep(0.35, 1, u) * 0.06, haloMul: 0.8,
    water: { level: 1.2, amp: 2.0 }, muddy: 0.5, crowd: { mode: 'none' }, traffic: 0, sweep: 1, collapse: 0.8, dust: 0.3, wind: 0.85, debris: 0.6, shake: 0.5, quake: 0.6, power: 0,
    fp: { walk: (u < 0.5 ? 0.35 : 0.2), panic: 1, breath: 1.6 } }),
});
shot('roche-space', 468, 505, 'space', {
  T: [115.40, 115.53], sfx: 'space-break', fadeIn: 0.6,
  cam: [{ u: 0, p: [26, 7, 2], l: MP(9000), fov: 40 }, { u: 1, p: [22, 5, 0], l: MP(8000), fov: 42 }],
  st: (u, lt, b) => ({ moonAxis: AX, moonHeat: 1, moonSep: lerp(0.08, 0.9, sstep(0, 1, u)), moonGlow: sstep(0.5, 1, u) * 0.4, bulge: lerp(0.25, 0.7, u), earthRot: 2.2 + lt * 0.004 }),
});

// ───────────── CHAPTER 6 · IMPACT ─────────────
shot('impact', 505, 541, 'city', {
  T: [115.54, T_IMPACT_H - 0.0008], sfx: 'impact', fadeIn: 0.5,
  cam: [{ u: 0, p: [-1.2, 3.65, 33], l: [0, 160, -400], fov: 66 }, { u: 1, p: [-1, 3.65, 31], l: [0, 230, -400], fov: 72 }],
  st: (u, lt, b) => ({ tod: 19.55, moonDir: dirEl(0, 24), moonBright: 30, moonK: 1.0, moonScale: lerp(1.25, 1.9, u), chaos: 0.55, skyFire: sstep(0.05, 0.7, u) * 0.85,
    moonHeat: 1, moonSep: lerp(1.0, 2.2, u), moonGlow: lerp(0.7, 1.5, u), moonDisk: 0.55, haloMul: 0.6,
    meteors: sstep(0.0, 0.5, u), horizonFlashes: sstep(0.15, 0.7, u), horizonY: 590, heatHaze: sstep(0.5, 1, u) * 0.6,
    water: { level: 1.2, amp: 2.4 }, muddy: 0.5, crowd: { mode: 'none' }, traffic: 0, sweep: 1, collapse: 0.85, dust: 0.35, dustColor: '#7a4a30', wind: 1, debris: 0.8,
    fp: { panic: 1.4, breath: 2 }, arms: { pose: 'shield', amt: sstep(0.62, 0.78, u), sleeve: '#3a3530', glow: lerp(0.3, 1.1, u), glowColor: '#ff9a50' },
    shake: lerp(0.5, 1.6, u), quake: 1, power: 0, flash: sstep(0.94, 1, u) * 0.7, white: sstep(0.95, 1, u) }),
});
shot('white', 541, 549, 'black', {
  hud: false, sfx: 'whiteout', bg: '#000',
  st: (u, lt) => ({ white: 1 - sstep(1.2, 7.5, lt) }),
});
shot('aftermath', 549, 587, 'space', {
  hud: false, sfx: 'aftermath', fadeIn: 2.0,
  cam: [{ u: 0, p: [4, 5, 26], l: [0, 0, 0], fov: 36 }, { u: 1, p: [14, 6, 22], l: [0, 0, 0], fov: 36 }],
  st: (u, lt) => ({ T: T_IMPACT_H, distKm: 8108, moonAxis: AX, moonVisible: false, lava: sstep(0.0, 0.35, u), earthGlow: 0.8, atmo: 1.4, vapor: sstep(0, 0.4, u) * (1 - sstep(0.85, 1, u) * 0.4), earthRot: 2.4 + lt * 0.01 }),
});
shot('origin', 587, 612, 'space', {
  hud: false, sfx: 'origin', fadeOut: 1.5,
  cam: [{ u: 0, p: [10, 14, 30], l: [0, 0, 0], fov: 38 }, { u: 1, p: [-6, 22, 46], l: [0, 0, 0], fov: 38 }],
  st: (u, lt) => ({ T: T_IMPACT_H, distKm: 8108, moonAxis: AX, moonVisible: false, lava: 1, earthGlow: 0.8, atmo: 1.4, vapor: 1, earthRot: 2.8 + lt * 0.01 }),
});

// ───────────── EPILOGUE ─────────────
shot('calm', 612, 668, 'city', {
  T: [0, 0], sub: 'away', fadeIn: 2.5, fadeOut: 3.0, sfx: 'calm', hudFadeOut: true,
  cam: [{ u: 0, p: [-34, 3.65, -35.8], l: [40, 6, -60], fov: 56 }, { u: 0.4, p: [-16, 3.65, -35.8], l: [10, 40, -500], fov: 54 }, { u: 1, p: [-14.5, 3.65, -36], l: [4, 76, -500], fov: 50 }],
  st: (u, lt) => ({ tod: 21.5, moonDir: dirEl(4, 22), moonBright: 1, moonK: 3.6, crowd: { mode: 'watch', density: 0.6 }, traffic: 0.6, water: { level: 0.4, amp: 0.35 }, clock: 'TONIGHT', hudAlpha: 1 - sstep(24, 26, lt),
    fp: { walk: 1 - sstep(0.36, 0.44, u) } }),
});

export const DURATION = 668;

export const CHAPTERS = [
  { t: 54.5, num: 'CHAPTER ONE', title: 'The Fall Begins' },
  { t: 140.5, num: 'CHAPTER TWO', title: 'Nobody Notices' },
  { t: 215.5, num: 'CHAPTER THREE', title: 'The Tides' },
  { t: 320.5, num: 'CHAPTER FOUR', title: 'Breaking Point' },
  { t: 430.5, num: 'CHAPTER FIVE', title: 'The Roche Limit' },
  { t: 505.5, num: 'CHAPTER SIX', title: 'Impact' },
];

export const CAPTIONS = [
  [3, 7.5, 'It is midnight in a quiet city by the sea.'],
  [8, 12.5, 'Above you, the Moon is 384,400 kilometers away.'],
  [13, 17.5, 'It is racing sideways at one kilometer per second.'],
  [18, 22.5, 'That speed is the only thing keeping it in the sky.'],
  [23, 27.5, 'It is always falling toward us… and always missing.'],
  [28.5, 32.5, 'Now imagine that, tonight, it simply stops.'],
  [33.5, 37.5, 'No sideways motion. Nothing left to miss with.'],
  [38.5, 42, 'There is only one way left for it to go.'],
  [43, 45.8, 'Down.', 'big'],

  [60, 64.5, 'This is the Earth and the Moon, drawn to scale.'],
  [65, 70, 'You could line up thirty Earths in the gap between them.'],
  [70.5, 75, 'Normally, the Moon travels around this circle once a month.'],
  [75.5, 80, 'But if its orbital speed suddenly dropped to zero…'],
  [80.5, 85, '…it would fall straight toward us, along this line.'],
  [86, 91, 'By the end of the first hour, it is moving about as fast as a cyclist.'],
  [91.5, 97.5, 'But gravity never lets go. Every second, it falls a little faster.'],

  [101, 105.5, 'Physics gives us an exact countdown.'],
  [106, 112, 'From a standstill, the Moon would reach Earth in 4 days, 19 hours and 36 minutes.'],
  [112.5, 117, 'But the fall is wildly uneven.'],
  [118, 123, 'It takes almost four days just to cover the first half of the distance.'],
  [123.5, 129, 'The last 100,000 kilometers take less than seven hours.'],
  [129.5, 134.5, 'And the final 20,000? About twenty-six minutes.'],
  [135, 139.3, 'So let’s live through it. Hour by hour.'],

  [145.5, 150, 'Monday morning. The city wakes up like any other day.'],
  [150.5, 155.5, 'The Moon is already almost 2,000 kilometers closer. Nobody can tell.'],
  [156, 161.5, 'But astronomers still bounce lasers off mirrors left on the Moon by Apollo astronauts.'],
  [162, 166.5, 'Within hours, they see the impossible.'],
  [167, 172, 'The Moon has stopped circling us. And it is coming closer.'],
  [172.5, 177, 'By evening, it is the only story on Earth.'],
  [179.5, 184.5, 'Tuesday night. The Moon rises over the sea, a little too big.'],
  [185, 190.5, 'It looks about 10% wider than a normal full moon, and a fifth brighter.'],
  [191, 195.5, 'Crowds gather on the beach just to look at it.'],
  [197, 202, 'It is beautiful. And it is now falling at almost 500 meters every second.'],
  [202.5, 208, 'It weighs 73 quintillion tonnes.'],
  [208.5, 214, 'No rocket, no bomb, nothing humanity has ever built could even nudge it.'],

  [220.5, 225, 'Thursday. The Moon is now 240,000 kilometers away.'],
  [225.5, 231, 'Tides exist because the Moon pulls harder on the near side of Earth than on the far side.'],
  [231.5, 236.5, 'That difference grows with the cube of the distance.'],
  [237, 242, 'Bring the Moon twice as close, and tides become eight times stronger.'],
  [242.5, 247.5, 'Today, the tidal pull is already four times normal.'],
  [248, 253.5, 'At high tide, the sea climbs past the beach, over the promenade, into the streets.'],
  [254, 260.5, 'Six hours later, it drains away again — far beyond the harbor.'],
  [263, 268, 'Friday, 4 a.m. The Moon is 160,000 kilometers away.'],
  [268.5, 273.5, 'Tidal force: thirteen times normal.'],
  [274, 279.5, 'In narrow bays, tides that once rose a few meters now rise tens of meters.'],
  [280, 285, 'Every coastal city on Earth is flooding twice a day.'],
  [285.5, 291, 'Hundreds of millions of people are moving inland, all at once.'],
  [291.5, 296.5, 'But the ocean is not the only thing being pulled.'],
  [297, 302, 'The solid ground beneath you is rising and falling too.'],
  [302.5, 308, 'Rock flexes like water. Old faults begin to slip.'],
  [308.5, 314, 'The first great earthquakes arrive just after sunrise.'],

  [325.5, 330.5, 'Friday, noon. The Moon is 100,000 kilometers away.'],
  [331, 336, 'Right now it is on the other side of the planet, below your feet.'],
  [336.5, 342, 'Even from there, its pull is shaking the ground under you.'],
  [342.5, 348, 'Tidal stress is fifty times normal. The crust is being kneaded like dough.'],
  [348.5, 354, 'Volcanoes that slept for centuries erupt all along the Pacific Ring of Fire.'],
  [354.5, 359.5, 'No building on Earth was designed for this.'],
  [360, 364.5, 'And the Moon is still more than six hours away.'],
  [366.5, 371.5, 'Friday evening. Sunset. And, one last time… moonrise.'],
  [372, 377.5, 'It is 40,000 kilometers away. Nearly ten times wider than it used to be.'],
  [378, 383.5, 'It reflects almost ninety times more sunlight than a normal full moon.'],
  [384, 390, 'Under it, the ocean is being lifted into a mountain of water hundreds of meters high.'],
  [390.5, 396, 'As Earth turns, that mountain sweeps toward every coast in its path.'],
  [396.5, 401.5, 'The Moon is now falling at four kilometers per second.'],
  [402, 407.5, 'The air is pulled too. Winds stronger than any hurricane tear across the land.'],
  [408.5, 414, 'And then, something starts to happen to the Moon itself.'],

  [435.5, 440.5, '19:14. The Moon crosses 18,400 kilometers.'],
  [441, 445, 'This is the Roche limit.'],
  [445.5, 451.5, 'Here, Earth pulls on the Moon’s near side so much harder than on its far side…'],
  [452, 457, '…that the Moon’s own gravity can no longer hold it together.'],
  [457.5, 462.5, 'Its four-billion-year-old crust begins to crack.'],
  [463, 467.5, 'Molten rock glows through the fractures.'],
  [469.5, 474, 'From space, it would look like this.'],
  [474.5, 480, 'The Moon stretches, then shatters into a stream of fragments.'],
  [480.5, 486, 'Some pieces are bigger than countries. All of them are still falling.'],
  [486.5, 492.5, 'With no orbit left, the debris cannot form a ring like Saturn’s.'],
  [493, 498, 'It has nowhere to go but down.'],
  [498.5, 503.5, 'Impact: about twenty minutes from now.'],

  [510.5, 515, 'The smallest fragments reach the atmosphere first.'],
  [515.5, 521, 'They hit the air at almost ten kilometers per second, and the sky catches fire.'],
  [521.5, 526.5, 'The atmosphere itself heats until it glows.'],
  [527, 532.5, 'Above you, the largest pieces now fill half the sky.'],
  [533.5, 538.5, '19:36. Friday.'],

  [553, 558.5, 'The impact releases about 3.6 × 10³⁰ joules of energy.'],
  [559, 564.5, 'Nearly ten million times the asteroid that ended the dinosaurs.'],
  [565, 570, 'The planet survives. Its surface does not.'],
  [570.5, 576, 'Oceans boil away. The crust melts into a global sea of magma.'],
  [576.5, 581.5, 'For thousands of years, Earth glows like a dim star.'],
  [582, 586.5, 'Life, as we know it, is gone.'],
  [588, 593, 'Strangely, this would not be the first time.'],
  [593.5, 599.5, '4.5 billion years ago, a planet the size of Mars slammed into the young Earth.'],
  [600, 605.5, 'The debris from that collision came together… and became our Moon.'],
  [606, 611, 'Born in fire. And in this story, returned in fire.'],

  [615.5, 620, 'But you can relax.'],
  [620.5, 626, 'In reality, nothing can stop the Moon in its orbit.'],
  [626.5, 632, 'In fact, it is slowly drifting away from us — 3.8 centimeters every year.'],
  [632.5, 637, 'About as fast as your fingernails grow.'],
  [639, 645, 'What if… the Moon fell to Earth?', 'big'],
  [647, 664, 'Thanks for watching. Which “what if” should we simulate next?'],
];

// Hidden shots after the end of the video, used only to render the thumbnail plate.
shot('thumb', 700, 710, 'city', {
  T: [115.25, 115.25], hud: false,
  cam: [{ u: 0, p: [-1.5, 5.2, 44], l: [0, 95, -400], fov: 56 }],
  st: () => ({ tod: 19.05, moonDir: dirEl(0, 15), moonBright: 60, moonK: 2.3, chaos: 0.3, moonHeat: 0.9, moonSep: 0.035, haloMul: 1.3,
    water: { level: 3.6, amp: 1.2 }, muddy: 0.4, crowd: { mode: 'none' }, traffic: 0, sweep: 0.3, collapse: 0.3, dust: 0.15, wind: 0.6, debris: 0.25, power: 0,
    meteors: 0.12, horizonFlashes: 0.25, horizonY: 610 }),
});
// Vertical (9:16) cover plate for TikTok/Shorts; render with QS='?w=1080&h=1920'.
shot('thumbv', 720, 730, 'city', {
  T: [115.25, 115.25], hud: false,
  cam: [{ u: 0, p: [-1.2, 3.65, 34], l: [0, 235, -400], fov: 78 }],
  st: () => ({ tod: 19.05, moonDir: dirEl(0, 26), moonBright: 60, moonK: 2.0, chaos: 0.3, moonHeat: 0.55, moonSep: 0, haloMul: 1.3,
    water: { level: 1.2, amp: 1.6 }, muddy: 0.4, crowd: { mode: 'none' }, traffic: 0, sweep: 0.6, collapse: 0.5, dust: 0.15, wind: 0.6, debris: 0.3, power: 0,
    meteors: 0.15 }),
});
shot('thumb2', 710, 720, 'space', {
  T: [115.45, 115.45], hud: false,
  cam: [{ u: 0, p: [24, 6, 1], l: MP(9000), fov: 40 }],
  st: () => ({ moonAxis: AX, moonHeat: 1, moonSep: 0.35, moonGlow: 0.2, bulge: 0.5, earthRot: 2.25 }),
});
