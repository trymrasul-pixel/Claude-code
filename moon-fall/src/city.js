import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, clamp, lerp, sstep, fbm } from './util.js';
import * as TX from './textures.js';
import { buildMoon, moonMaterial, setMoonBreak } from './moon.js';

const PALETTE = ['#c9744f', '#d9a441', '#b5523b', '#e3c9a0', '#9fb0b3', '#c98f6b', '#a65a3e', '#d8b26e', '#e0d6c2', '#c46a54'];
const TOWER = ['#7d8b99', '#8d9fae', '#6f7f8f', '#a0aab4', '#5f7286'];
const CELL_W = 3.6, CELL_H = 3.3;

function colorGeo(geo, col) {
  const c = new THREE.Color(col), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
function buildingGeo(w, h, d, col, R) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv, ou = Math.floor(R() * 8), ov = Math.floor(R() * 8);
  const dims = [[d, h], [d, h], null, null, [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    if (!dims[f]) { uv.setXY(i, 0.05, 0.05); continue; }
    const fw = Math.max(1, Math.round(dims[f][0] / CELL_W)), fh = Math.max(1, Math.round(h / CELL_H));
    uv.setXY(i, uv.getX(i) * fw + ou, uv.getY(i) * fh + ov);
  }
  return colorGeo(g, col);
}
function boxAt(w, h, d, x, y, z, col, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y, z); colorGeo(g, col);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.05, 0.05);
  return g;
}

export class City {
  constructor() {
    this.scene = new THREE.Scene();
    const S = this.scene, R = rng(1234);
    this.tex = { win: TX.windowTexture(), lit: TX.litTexture(), road: TX.roadTexture(), cw: TX.crosswalkTexture(), pave: TX.pavingTexture(), pave2: TX.pavingTexture('#b7ab93'), crack: TX.crackTexture(), glow: TX.glowTexture(), puff: TX.puffTexture(), moon: TX.moonTexture() };
    this.tex.lit.repeat.set(1 / 8, 1 / 8);

    // ---------- sky ----------
    this.skyU = { uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uGround: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3() }, uSunCol: { value: new THREE.Color() }, uSunGlow: { value: 0 }, uMoon: { value: new THREE.Vector3() }, uMoonGlow: { value: 0 }, uMoonCol: { value: new THREE.Color(0.75, 0.82, 1) } };
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(15000, 48, 24), new THREE.ShaderMaterial({
      uniforms: this.skyU, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform vec3 uZen,uHor,uGround,uSunCol,uMoonCol; uniform vec3 uSun,uMoon; uniform float uSunGlow,uMoonGlow; varying vec3 vD;
        void main(){ vec3 d=normalize(vD); float h=d.y;
          vec3 c = h>0. ? mix(uHor,uZen,pow(clamp(h,0.,1.),0.55)) : mix(uHor,uGround,clamp(-h*6.,0.,1.));
          float s=max(dot(d,normalize(uSun)),0.); c+=uSunCol*(pow(s,6.)*0.35+pow(s,200.)*1.2)*uSunGlow;
          float m=max(dot(d,normalize(uMoon)),0.); c+=uMoonCol*(pow(m,12.)*0.25+pow(m,80.)*0.4)*uMoonGlow;
          gl_FragColor=vec4(c,1.);
          #include <colorspace_fragment>
        }`,
    }));
    this.sky.renderOrder = -10; S.add(this.sky);
    { // stars
      const n = 2600, p = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const u = R() * 2 - 1, th = R() * 6.283, r = Math.sqrt(1 - u * u); p[i * 3] = r * Math.cos(th) * 14000; p[i * 3 + 1] = Math.abs(u) * 14000; p[i * 3 + 2] = r * Math.sin(th) * 14000; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false }));
      S.add(this.stars);
    }
    // ---------- moon ----------
    this.moonMat = moonMaterial(this.tex.moon);
    this.moon = buildMoon(this.moonMat, 34, 9, 9);
    this.moon.renderOrder = -5;
    S.add(this.moon);
    this.moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.glow, color: 0xbfd2ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    this.moonHalo.renderOrder = -6; S.add(this.moonHalo);

    // ---------- lights ----------
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); S.add(this.hemi);
    this.sunL = new THREE.DirectionalLight(0xffffff, 1); S.add(this.sunL); S.add(this.sunL.target);
    this.moonL = new THREE.DirectionalLight(0xaabbff, 0.3); S.add(this.moonL); S.add(this.moonL.target);
    this.fireL = new THREE.PointLight(0xff6a2a, 0, 0, 0); this.fireL.position.set(0, 400, -2500); S.add(this.fireL);
    S.fog = new THREE.Fog(0x000000, 200, 5000);

    // ---------- ground ----------
    const lam = (opt) => new THREE.MeshLambertMaterial({ flatShading: true, ...opt });
    const ground = new THREE.Mesh(new THREE.BoxGeometry(3200, 4, 2100), lam({ map: this.tex.pave, color: 0x9a9690 }));
    this.tex.pave.repeat.set(3200 / 8, 2100 / 8); ground.position.set(0, 0, -45 + 1050); S.add(ground);
    const roadT = this.tex.road.clone(); roadT.repeat.set(1, 1400 / 24); roadT.needsUpdate = true;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(16, 1400), lam({ map: roadT })); road.rotation.x = -Math.PI / 2; road.position.set(0, 2.03, -24 + 700); S.add(road);
    const croadT = this.tex.road.clone(); croadT.repeat.set(1, 3200 / 24); croadT.needsUpdate = true;
    const croad = new THREE.Mesh(new THREE.PlaneGeometry(12, 3200), lam({ map: croadT })); croad.rotation.x = -Math.PI / 2; croad.rotation.z = Math.PI / 2; croad.position.set(0, 2.025, -30); S.add(croad);
    const cwT = this.tex.cw; cwT.repeat.set(1, 1);
    for (const z of [-21, 33]) { const cw = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), lam({ map: cwT })); cw.rotation.x = -Math.PI / 2; cw.position.set(0, 2.04, z); S.add(cw); }
    const promT = this.tex.pave2; promT.repeat.set(3200 / 6, 10 / 6);
    const prom = new THREE.Mesh(new THREE.PlaneGeometry(3200, 10), lam({ map: promT })); prom.rotation.x = -Math.PI / 2; prom.position.set(0, 2.04, -41); S.add(prom);
    // cross streets (plain asphalt)
    const asph = lam({ color: 0x3d4047 });
    const zStreets = []; for (let z = 30; z < 1300; z += 62) zStreets.push(z);
    for (const z of zStreets) { const m = new THREE.Mesh(new THREE.PlaneGeometry(3200, 12), asph); m.rotation.x = -Math.PI / 2; m.position.set(0, 2.025, z + 7); S.add(m); }
    // ground cracks overlay
    this.crackMat = new THREE.MeshBasicMaterial({ map: this.tex.crack, transparent: true, opacity: 0, depthWrite: false, color: 0x000000, alphaTest: 0.01 });
    this.tex.crack.repeat.set(1, 1);
    const cr = new THREE.Mesh(new THREE.PlaneGeometry(60, 260), this.crackMat); cr.rotation.x = -Math.PI / 2; cr.position.set(0, 2.06, 100); S.add(cr);
    // seawall + beach
    S.add(new THREE.Mesh(new THREE.BoxGeometry(3200, 6, 2), lam({ color: 0x8e8578 })).translateZ(-46).translateY(-1));
    const beachG = new THREE.PlaneGeometry(3200, 460, 64, 46); beachG.rotateX(-Math.PI / 2);
    { const p = beachG.attributes.position, cols = new Float32Array(p.count * 3), sand = new THREE.Color('#cdb98e'), mud = new THREE.Color('#5d5440');
      for (let i = 0; i < p.count; i++) { const z = p.getZ(i) - 277; const y = z > -107 ? lerp(-6, 0.9, (z + 107) / 60) : lerp(-6, -26, (-107 - z) / 340); p.setY(i, y + (fbm(p.getX(i) * 0.05, z * 0.05) - 0.5) * (z > -107 ? 0.6 : 2.5));
        const c = sand.clone().lerp(mud, clamp((-z - 60) / 80)); cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; }
      beachG.setAttribute('color', new THREE.BufferAttribute(cols, 3)); }
    const beach = new THREE.Mesh(beachG, lam({ vertexColors: true })); beach.position.z = -277; S.add(beach);
    // far headlands
    const hillG = new THREE.PlaneGeometry(9000, 5000, 90, 50); hillG.rotateX(-Math.PI / 2);
    { const p = hillG.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const left = sstep(-1200, -2600, x) * sstep(2600, 300, z), right = sstep(1500, 3200, x) * sstep(2600, 900, z); const m = Math.max(left, right); p.setY(i, -30 + m * (40 + fbm(x * 0.002, z * 0.002, 5) * 520)); } }
    const hills = new THREE.Mesh(hillG, lam({ color: 0x55603f })); hills.position.set(0, 0, -2200); S.add(hills);

    // ---------- buildings ----------
    this.bMat = new THREE.MeshLambertMaterial({ map: this.tex.win, emissiveMap: this.tex.lit, emissive: 0xffffff, emissiveIntensity: 0, vertexColors: true, flatShading: true });
    const geos = []; this.dyn = [];
    const xBlocks = []; for (let x = 12; x < 900; x += 72) xBlocks.push(x);
    const zBlocks = [-18]; for (let z = 44; z < 1300; z += 62) zBlocks.push(z);
    for (const side of [-1, 1]) for (const bx of xBlocks) for (const bz of zBlocks) {
      const bw = 56, bd = (bz === -18 ? 48 : 48);
      const dist = Math.hypot(bx + 28, bz + 24);
      const inland = clamp((bz + 18) / 800);
      const nx = bx < 30 ? 2 : 2 + (R() < 0.5 ? 1 : 0), nz = 2;
      for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
        if (dist > 1100 && R() < 0.4) continue;
        const w = bw / nx - 1.5, d = bd / nz - 1.5;
        let floors = 3 + Math.floor(R() * 5 + inland * 8 + (R() < 0.08 + inland * 0.1 ? 10 + R() * 22 : 0));
        if (bz === -18 && bx < 100) floors = Math.min(floors, 9);
        const tower = floors > 14;
        const h = floors * CELL_H + 1.2;
        const col = tower ? TOWER[Math.floor(R() * TOWER.length)] : PALETTE[Math.floor(R() * PALETTE.length)];
        const cx = side * (bx + (i + 0.5) * (bw / nx)), cz = bz + (k + 0.5) * (bd / nz);
        const geo = buildingGeo(w, h, d, col, R);
        const isDyn = bx === 12 && bz < 300;
        if (isDyn) {
          const m = new THREE.Mesh(geo, this.bMat); m.position.set(cx, 2 + h / 2, cz);
          m.userData = { base: m.position.clone(), h, w, d, side, k: R(), fall: R() };
          S.add(m); this.dyn.push(m);
        } else { geo.translate(cx, 2 + h / 2, cz); geos.push(geo); }
        // rooftop details
        if (!tower && R() < 0.5) geos.push(boxAt(2.5, 2, 2.5, cx + (R() - 0.5) * w * 0.5, 2 + h + 1, cz + (R() - 0.5) * d * 0.5, '#8b8682'));
      }
    }
    // shop awnings on boulevard-facing ground floors (static)
    for (const side of [-1, 1]) for (let z = -16; z < 300; z += 9) {
      if ((z > 28 && z < 46) || R() < 0.3) continue;
      geos.push(boxAt(1.6, 0.25, 7, side * 12.4, 5.6, z + 4, ['#2f6b5e', '#a8392f', '#2c4f7a', '#c9a227'][Math.floor(R() * 4)]));
    }
    this.city = new THREE.Mesh(mergeGeometries(geos), this.bMat); S.add(this.city);

    // ---------- palms ----------
    const trunkGeos = [], palmPos = [];
    const addPalm = (x, z, h) => {
      const segs = 6, lean = (R() - 0.5) * 0.25;
      for (let s = 0; s < segs; s++) { const g = new THREE.CylinderGeometry(0.22, 0.28, h / segs, 6); g.translate(x + lean * s * s * 0.3, 2 + (s + 0.5) * h / segs, z); colorGeo(g, s % 2 ? '#7a5a3a' : '#6b4e33'); trunkGeos.push(g); }
      palmPos.push(new THREE.Vector3(x + lean * segs * segs * 0.3, 2 + h, z));
    };
    for (let x = -600; x <= 600; x += 16) if (Math.abs(x) > 14) addPalm(x + (R() - 0.5) * 3, -43 + R() * 1.5, 7 + R() * 4);
    for (const side of [-1, 1]) for (let z = -12; z < 420; z += 18) if (z < 26 || z > 44) addPalm(side * 10.4, z, 6.5 + R() * 3);
    const tm = mergeGeometries(trunkGeos); tm.attributes.uv && tm.deleteAttribute('uv');
    S.add(new THREE.Mesh(tm, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
    const leafGeos = [];
    for (let i = 0; i < 8; i++) { const g = new THREE.ConeGeometry(0.7, 4.2, 4, 1); g.scale(1, 1, 0.18); g.rotateZ(-Math.PI / 2); g.translate(2.0, 0, 0); g.rotateZ(-0.35); g.rotateY(i / 8 * Math.PI * 2 + 0.2); leafGeos.push(g); }
    const crownG = mergeGeometries(leafGeos); crownG.deleteAttribute('uv');
    this.palms = new THREE.InstancedMesh(crownG, new THREE.MeshLambertMaterial({ color: 0x3f7a35, flatShading: true }), palmPos.length);
    this.palmPos = palmPos; S.add(this.palms);

    // ---------- lamps ----------
    const poleGeos = []; this.lampSprites = [];
    const lampMat = new THREE.SpriteMaterial({ map: this.tex.glow, color: 0xffc27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const addLamp = (x, z) => { const g = new THREE.CylinderGeometry(0.08, 0.12, 6, 5); g.translate(x, 5, z); colorGeo(g, '#2b2b2b'); poleGeos.push(g); const s = new THREE.Sprite(lampMat); s.position.set(x, 8.1, z); s.scale.set(3.2, 3.2, 1); S.add(s); this.lampSprites.push(s); };
    for (const side of [-1, 1]) for (let z = -6; z < 500; z += 24) if (z < 26 || z > 44) addLamp(side * 8.6, z);
    for (let x = -400; x <= 400; x += 24) addLamp(x + 8, -36.5);
    const pm = mergeGeometries(poleGeos); pm.deleteAttribute('uv'); S.add(new THREE.Mesh(pm, new THREE.MeshLambertMaterial({ vertexColors: true })));
    this.lampMat = lampMat;

    // ---------- pier, boats, lighthouse ----------
    const pierG = [];
    pierG.push(boxAt(8, 0.6, 130, 64, 2.2, -110, '#7b6a55'));
    for (let z = -50; z > -175; z -= 8) for (const x of [60.5, 67.5]) pierG.push(boxAt(0.5, 10, 0.5, x, -3, z, '#4d4033'));
    // breakwater + lighthouse
    pierG.push(boxAt(14, 8, 260, 200, -1, -250, '#6f6a62', 0.5));
    pierG.push(boxAt(12, 4, 12, 262, 2, -360, '#6f6a62'));
    for (let i = 0; i < 6; i++) { const g = new THREE.CylinderGeometry(2.2 - i * 0.12, 2.3 - i * 0.12, 3, 10); g.translate(262, 4 + 1.5 + i * 3, -360); colorGeo(g, i % 2 ? '#c03a2b' : '#f2efe8'); g.deleteAttribute('uv'); pierG.push(g); }
    { const g = new THREE.CylinderGeometry(1.6, 1.6, 2.4, 8); g.translate(262, 23.7, -360); colorGeo(g, '#2a2a2a'); g.deleteAttribute('uv'); pierG.push(g); }
    pierG.forEach(g => { if (g.attributes.uv) g.deleteAttribute('uv'); });
    S.add(new THREE.Mesh(mergeGeometries(pierG), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
    this.beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.glow, color: 0xfff1c0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.beacon.position.set(262, 24, -360); this.beacon.scale.set(30, 30, 1); S.add(this.beacon);
    this.boats = [];
    const hullCols = ['#f2efe8', '#2c4f7a', '#a8392f', '#e9e2cf', '#2f6b5e'];
    for (let i = 0; i < 14; i++) {
      const parts = [];
      const L = 7 + R() * 6;
      const hull = new THREE.CylinderGeometry(1.4, 0.9, L, 6, 1); hull.rotateX(Math.PI / 2); hull.scale(1.2, 0.8, 1); colorGeo(hull, hullCols[i % 5]); hull.deleteAttribute('uv'); parts.push(hull);
      const cab = new THREE.BoxGeometry(2, 1.4, L * 0.35); cab.translate(0, 1.4, -L * 0.1); colorGeo(cab, '#ece8df'); cab.deleteAttribute('uv'); parts.push(cab);
      if (R() < 0.5) { const mast = new THREE.CylinderGeometry(0.07, 0.07, 9, 4); mast.translate(0, 5, L * 0.1); colorGeo(mast, '#ddd'); mast.deleteAttribute('uv'); parts.push(mast); }
      const b = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
      const x = i < 8 ? (i % 2 ? 73 : 55) : 90 + R() * 120, z = i < 8 ? -60 - Math.floor(i / 2) * 22 : -90 - R() * 140;
      b.userData = { x, z, ry: i < 8 ? 0 : R() * 6, ph: R() * 6 }; this.boats.push(b); S.add(b);
    }

    // ---------- sea ----------
    const N = 150, verts = [], idx = [];
    const coord = i => { const u = i / N * 2 - 1; return Math.sign(u) * Math.pow(Math.abs(u), 2.2) * 7000; };
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) verts.push(coord(i), 0, coord(j) - 800);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); sg.setIndex(idx);
    this.seaBase = Float32Array.from(verts);
    this.seaMat = new THREE.MeshPhongMaterial({ color: 0x15344f, specular: 0x8899aa, shininess: 70, flatShading: true });
    this.sea = new THREE.Mesh(sg, this.seaMat); this.sea.frustumCulled = false; S.add(this.sea);

    // ---------- people ----------
    const pg = [];
    { const a = new THREE.BoxGeometry(0.34, 0.85, 0.22); a.translate(0, 0.43, 0); pg.push(a); const b = new THREE.BoxGeometry(0.46, 0.66, 0.26); b.translate(0, 1.2, 0); pg.push(b); }
    const bodyG = mergeGeometries(pg); bodyG.deleteAttribute('uv');
    const headG = new THREE.IcosahedronGeometry(0.14, 0); headG.translate(0, 1.68, 0); headG.deleteAttribute('uv');
    const NP = 340; this.NP = NP;
    this.people = new THREE.InstancedMesh(bodyG, new THREE.MeshLambertMaterial({ flatShading: true }), NP);
    this.heads = new THREE.InstancedMesh(headG, new THREE.MeshLambertMaterial({ flatShading: true }), NP);
    const clothes = ['#c23b3b', '#2f5d8a', '#e0c341', '#3c8a5a', '#eeeeee', '#222222', '#8a4fa0', '#e07b39', '#5aa0c8', '#b0a080'];
    const skins = ['#f1c7a5', '#c58c5f', '#8d5a3b', '#e8b48f', '#5c3a26'];
    this.pdata = [];
    for (let i = 0; i < NP; i++) {
      this.people.setColorAt(i, new THREE.Color(clothes[Math.floor(R() * clothes.length)]));
      this.heads.setColorAt(i, new THREE.Color(skins[Math.floor(R() * skins.length)]));
      const zone = R();
      let p;
      if (zone < 0.55) { const side = R() < 0.5 ? -1 : 1; p = { kind: 'side', x: side * (9.6 + R() * 1.8), z: -20 + R() * 420, dir: R() < 0.5 ? -1 : 1 }; }
      else if (zone < 0.9) { p = { kind: 'prom', x: -250 + R() * 500, z: -44 + R() * 7, dir: R() < 0.5 ? -1 : 1 }; }
      else { p = { kind: 'beach', x: -200 + R() * 400, z: -48 - R() * 5, dir: 0 }; }
      p.speed = 1.1 + R() * 0.6; p.ph = R() * 10; p.run = 4 + R() * 3; p.k = R();
      this.pdata.push(p);
    }
    S.add(this.people); S.add(this.heads);

    // ---------- cars ----------
    const cg = [];
    { const a = new THREE.BoxGeometry(1.8, 0.75, 4.3); a.translate(0, 0.62, 0); cg.push(a); const b = new THREE.BoxGeometry(1.6, 0.6, 2.2); b.translate(0, 1.27, -0.2); cg.push(b); }
    const carG = mergeGeometries(cg); carG.deleteAttribute('uv');
    const NC = 70; this.NC = NC;
    this.cars = new THREE.InstancedMesh(carG, new THREE.MeshLambertMaterial({ flatShading: true }), NC);
    const lg = []; { const a = new THREE.BoxGeometry(1.5, 0.18, 0.05); a.translate(0, 0.75, 2.17); colorGeo(a, '#fff6d8'); lg.push(a); const b = new THREE.BoxGeometry(1.5, 0.16, 0.05); b.translate(0, 0.8, -2.17); colorGeo(b, '#ff2a1a'); lg.push(b); }
    const lG = mergeGeometries(lg); lG.deleteAttribute('uv'); lG.deleteAttribute('normal');
    this.carLights = new THREE.InstancedMesh(lG, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true }), NC);
    const carCols = ['#f2c230', '#f2c230', '#d8d8d8', '#2b2b2b', '#a32020', '#2f4f8a', '#eeeeee', '#5c6e5a'];
    this.cdata = [];
    for (let i = 0; i < NC; i++) {
      this.cars.setColorAt(i, new THREE.Color(carCols[Math.floor(R() * carCols.length)]));
      const lane = Math.floor(R() * 4);
      if (i < 46) this.cdata.push({ kind: 'blvd', x: [-5.6, -2.2, 2.2, 5.6][lane], dir: lane < 2 ? 1 : -1, off: R() * 640, v: 9 + R() * 4, k: R(), ph: R() * 6 });
      else this.cdata.push({ kind: 'coast', z: lane < 2 ? -33 : -27, dir: lane < 2 ? 1 : -1, off: R() * 1200, v: 10 + R() * 4, k: R(), ph: R() * 6 });
    }
    S.add(this.cars); S.add(this.carLights);

    // ---------- flying debris & dust ----------
    const ND = 260; this.ND = ND;
    const dg = new THREE.BoxGeometry(1, 0.15, 0.7); dg.deleteAttribute('uv');
    this.debris = new THREE.InstancedMesh(dg, new THREE.MeshLambertMaterial({ flatShading: true }), ND);
    const dc = ['#8a6a50', '#5a5048', '#b08a60', '#3a3a3a', '#c9744f', '#d9a441', '#2f6b5e'];
    this.ddata = [];
    for (let i = 0; i < ND; i++) { this.debris.setColorAt(i, new THREE.Color(dc[Math.floor(R() * dc.length)])); this.ddata.push({ x: (R() - 0.5) * 120, y: 2 + R() * 40, z: -60 + R() * 260, s: 0.3 + R() * 2.2, sp: 0.5 + R(), ph: R() * 100, ax: new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).normalize() }); }
    S.add(this.debris);
    const NDu = 450, dp = new Float32Array(NDu * 3); this.dustData = [];
    for (let i = 0; i < NDu; i++) this.dustData.push({ x: (R() - 0.5) * 140, y: R() * 50, z: -40 + R() * 300, ph: R() * 100, sp: 0.5 + R() });
    const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    this.dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ map: this.tex.puff, size: 20, color: 0x9a7f66, transparent: true, opacity: 0, depthWrite: false }));
    this.dust.frustumCulled = false; S.add(this.dust);

    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3(1, 1, 1); this._e = new THREE.Euler();
  }

  // --------------------------------------------------------------------------------
  update(st, time, camera) {
    const S = this.scene;
    // ---- sun & moon directions ----
    const h = (st.tod - 12) / 12 * Math.PI;
    const sun = new THREE.Vector3(0.35, Math.cos(h) * 0.9, Math.sin(h)).normalize();
    let moonDir;
    if (st.moonDir) moonDir = new THREE.Vector3(...st.moonDir).normalize();
    else moonDir = new THREE.Vector3(-0.35, -Math.cos(h) * 0.9, -Math.sin(h)).normalize();
    const sunEl = sun.y;
    // ---- palette ----
    const C = (hex) => new THREE.Color(hex);
    const night = { z: C('#02050d'), h: C('#0b1324') }, twi = { z: C('#101a3e'), h: C('#c06a48') }, day = { z: C('#2c6cd0'), h: C('#a9c9e6') };
    let zen, hor;
    if (sunEl < -0.18) { zen = night.z.clone(); hor = night.h.clone(); }
    else if (sunEl < 0.02) { const t = sstep(-0.18, 0.02, sunEl); zen = night.z.clone().lerp(twi.z, t); hor = night.h.clone().lerp(twi.h, t); }
    else { const t = sstep(0.02, 0.3, sunEl); zen = twi.z.clone().lerp(day.z, t); hor = twi.h.clone().lerp(day.h, t); }
    const nightness = 1 - sstep(-0.15, 0.1, sunEl);
    const mb = st.moonBright ?? 1;
    hor.lerp(C('#3a4a6a'), nightness * clamp((mb - 1) * 0.05, 0, 0.45));
    zen.lerp(C('#1a2848'), nightness * clamp((mb - 1) * 0.04, 0, 0.4));
    const chaos = st.chaos || 0, fire = st.skyFire || 0;
    zen.lerp(C('#2a0d06'), chaos * 0.8); hor.lerp(C('#a8481f'), chaos * 0.75);
    zen.lerp(C('#5a1406'), fire); hor.lerp(C('#ff8a3a'), fire);
    if (st.flash) { zen.lerp(C('#ffffff'), st.flash); hor.lerp(C('#ffffff'), st.flash); }
    this.skyU.uZen.value.copy(zen); this.skyU.uHor.value.copy(hor); this.skyU.uGround.value.copy(hor).multiplyScalar(0.6);
    this.skyU.uSun.value.copy(sun); this.skyU.uSunCol.value.set(sunEl < 0.15 ? '#ff9a50' : '#fff2d0'); this.skyU.uSunGlow.value = sstep(-0.12, 0.02, sunEl) * (1 - chaos * 0.6);
    this.skyU.uMoon.value.copy(moonDir); this.skyU.uMoonGlow.value = nightness * clamp(0.6 + (mb - 1) * 0.06, 0, 2.5) + (st.moonHeat || 0) * 1.5;
    this.skyU.uMoonCol.value.set(st.moonHeat > 0.1 ? '#ffb070' : '#c0d0ff');
    this.sky.position.copy(camera.position);
    this.stars.position.copy(camera.position);
    this.stars.material.opacity = clamp(nightness * (1 - chaos) * (1 - clamp((mb - 1) * 0.02, 0, 0.8)) * (st.starMul ?? 1), 0, 1);
    S.fog.color.copy(hor);
    S.fog.near = st.fogNear ?? 120; S.fog.far = st.fogFar ?? lerp(5200, 1400, chaos);
    // ---- lights ----
    const dayL = sstep(-0.1, 0.25, sunEl);
    this.sunL.position.copy(sun).multiplyScalar(1000).add(camera.position); this.sunL.target.position.copy(camera.position);
    this.sunL.intensity = dayL * 2.4 * (1 - chaos * 0.6); this.sunL.color.set(sunEl < 0.2 ? '#ffb070' : '#fff1dc');
    this.moonL.position.copy(moonDir).multiplyScalar(1000).add(camera.position); this.moonL.target.position.copy(camera.position);
    this.moonL.intensity = nightness * clamp(0.8 + (mb - 1) * 0.05, 0, 2.6) * (moonDir.y > -0.05 ? 1 : 0.2);
    this.moonL.color.set(st.moonHeat > 0.1 ? '#ffb27a' : '#b8c6ff');
    this.hemi.color.copy(zen).lerp(new THREE.Color(nightness > 0.5 ? '#6f86b8' : '#ffffff'), 0.5); this.hemi.groundColor.set('#3a342c');
    this.hemi.intensity = lerp(1.0, 1.4, dayL) + fire * 1.5 + (st.flash || 0) * 6;
    if (fire > 0) this.hemi.color.lerp(new THREE.Color('#ff7a3a'), fire);
    this.fireL.intensity = 0;
    // ---- moon placement ----
    const real = 2 * Math.atan(1737 / st.distKm);
    const sx = 384400 / st.distKm;
    const K = st.moonK !== undefined ? st.moonK : Math.max(1, 3 / (1 + 0.06 * (sx - 1)));
    const vis = real * K * (st.moonScale ?? 1);
    const D = 9000; const rad = D * Math.tan(Math.min(vis, 2.6) / 2);
    this.moon.position.copy(camera.position).addScaledVector(moonDir, D);
    this.moon.scale.setScalar(rad);
    this.moon.lookAt(camera.position); this.moon.rotateY(Math.PI); this.moon.rotateZ(0.25);
    if (st.moonRot) this.moon.rotateY(st.moonRot);
    setMoonBreak(this.moon, st.moonSep || 0, time);
    this.moonMat.uniforms.uLight.value.copy(moonDir).negate().add(new THREE.Vector3(0.3, 0.15, 0)).normalize();
    this.moonMat.uniforms.uAmb.value = 0.05;
    this.moonMat.uniforms.uBright.value = (st.moonDisk ?? 1.7) * lerp(1, 0.8, dayL);
    this.moonMat.uniforms.uHeat.value = st.moonHeat || 0;
    this.moonMat.uniforms.uSurfGlow.value = st.moonGlow || 0;
    this.moonMat.uniforms.uTint.value.set(chaos > 0 ? new THREE.Color('#ffffff').lerp(new THREE.Color('#ffc69a'), chaos).getHex() : 0xffffff);
    this.moon.visible = st.moonVisible !== false;
    this.moonHalo.position.copy(this.moon.position).addScaledVector(moonDir, -50);
    const hs = rad * (4.5 + clamp(sx * 0.15, 0, 3));
    this.moonHalo.scale.set(hs, hs, 1);
    this.moonHalo.material.opacity = (nightness * 0.3 + 0.08) * (st.haloMul ?? 1);
    this.moonHalo.material.color.set(st.moonHeat > 0.1 ? '#ff9a5a' : '#b9ccff');
    this.moonHalo.visible = this.moon.visible;

    // ---- city lights ----
    const power = st.power ?? 1;
    const flick = st.flicker ? (Math.sin(time * 37) * Math.sin(time * 11.3) > 0.2 ? 0.25 : 1) : 1;
    this.bMat.emissiveIntensity = nightness * 1.1 * power * flick;
    this.lampMat.opacity = nightness * power * flick; this.lampSprites.forEach(s => (s.visible = power > 0.01 && nightness > 0.05));
    this.beacon.material.opacity = (0.4 + 0.6 * Math.max(0, Math.sin(time * 1.6))) * nightness * power;
    this.carLights.material.opacity = 0.3 + nightness * 0.7;

    // ---- sea ----
    const W = st.water || { level: 0, amp: 0.4 };
    const lvl = W.level ?? 0, amp = W.amp ?? 0.4;
    const pos = this.sea.geometry.attributes.position, B = this.seaBase;
    const wall = W.wall;
    for (let i = 0, n = pos.count; i < n; i++) {
      const x = B[i * 3], z = B[i * 3 + 2];
      let y = lvl + amp * (Math.sin(x * 0.045 + time * 1.1) * 0.6 + Math.sin(z * 0.06 - time * 1.4 + x * 0.01) * 0.8 + Math.sin((x + z) * 0.11 + time * 2.1) * 0.35);
      if (W.slope) y += W.slope * Math.max(0, -z - 100) ;
      if (wall) { const f = wall.front; const dz = z - f; y += wall.H * (dz < 0 ? 1 - 0.15 * Math.min(1, -dz / 400) : Math.exp(-dz * dz / (wall.w * wall.w))); }
      pos.array[i * 3 + 1] = y;
    }
    pos.needsUpdate = true;
    const seaCol = new THREE.Color('#0f2c44').lerp(hor, 0.25);
    if (st.muddy) seaCol.lerp(new THREE.Color('#4a3a28'), st.muddy);
    this.seaMat.color.copy(seaCol);
    this.seaMat.specular.set(nightness > 0.5 ? '#9fb3d8' : '#bbbbbb');

    // ---- boats ----
    for (const b of this.boats) {
      const u = b.userData;
      const by = Math.max(lvl, -3.2) + Math.sin(time * 1.3 + u.ph) * amp * 0.5;
      b.position.set(u.x + (st.boatDrift || 0) * (u.ph - 3) * 4, by + 0.3, u.z - (st.boatDrift || 0) * 30 * (u.ph / 6));
      b.rotation.set(Math.sin(time * 1.1 + u.ph) * 0.06 * (1 + amp) + (lvl < -2.5 ? 0.25 : 0), u.ry, Math.sin(time * 0.9 + u.ph) * 0.08 * (1 + amp));
    }

    // ---- palms ----
    const wind = st.wind || 0;
    for (let i = 0; i < this.palmPos.length; i++) {
      const p = this.palmPos[i];
      const sw = Math.sin(time * (1.2 + wind * 3) + i) * (0.05 + wind * 0.25) + wind * 0.5;
      this._e.set(sw * 0.6, i * 0.7, sw);
      this._q.setFromEuler(this._e); this._s.set(1, 1, 1);
      this._m.compose(p, this._q, this._s); this.palms.setMatrixAt(i, this._m);
    }
    this.palms.instanceMatrix.needsUpdate = true;

    // ---- people ----
    const crowd = st.crowd || { mode: 'walk', density: 1 };
    const tt = time - (crowd.t0 || 0);
    let k = 0;
    for (let i = 0; i < this.NP; i++) {
      const p = this.pdata[i];
      if (p.k > (crowd.density ?? 1)) { this._m.makeScale(0, 0, 0); this.people.setMatrixAt(i, this._m); this.heads.setMatrixAt(i, this._m); continue; }
      let x = p.x, z = p.z, ry = 0, bob = 0;
      if (crowd.mode === 'walk' || crowd.mode === 'watch') {
        if (p.kind === 'side') { z = -20 + ((p.z + 20 + p.dir * p.speed * time) % 420 + 420) % 420; ry = p.dir > 0 ? 0 : Math.PI; }
        else if (p.kind === 'prom') { x = -250 + ((p.x + 250 + p.dir * p.speed * time) % 500 + 500) % 500; ry = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
        if (crowd.mode === 'watch' && p.kind !== 'side') { x = p.x; ry = Math.PI; bob = 0; }
        else bob = Math.abs(Math.sin(time * 6 * p.speed + p.ph)) * 0.06;
        if (crowd.mode === 'watch' && p.kind === 'prom') z = -44 + (p.k * 7);
      } else if (crowd.mode === 'run') {
        const sp = p.run * (crowd.speed ?? 1);
        if (p.kind === 'side') { x = p.x; z = p.z - 200 + sp * tt; }
        else { x = p.x * 0.3 + Math.sign(p.x) * 0; x = (p.x > 0 ? 1 : -1) * Math.min(Math.abs(p.x), 30) ; z = -44 + sp * tt - p.k * 30; if (Math.abs(p.x) > 30) x = p.x; }
        ry = 0; bob = Math.abs(Math.sin(time * 11 + p.ph)) * 0.12;
      } else if (crowd.mode === 'none') { this._m.makeScale(0, 0, 0); this.people.setMatrixAt(i, this._m); this.heads.setMatrixAt(i, this._m); continue; }
      const gy = p.kind === 'beach' ? lerp(-6, 0.9, (z + 107) / 60) : 2;
      if (lvl > gy + 1.2 && crowd.mode !== 'run') { this._m.makeScale(0, 0, 0); this.people.setMatrixAt(i, this._m); this.heads.setMatrixAt(i, this._m); continue; }
      this._e.set(crowd.mode === 'run' ? 0.18 : 0, ry, 0); this._q.setFromEuler(this._e);
      this._v.set(x, gy + bob, z); this._s.set(1, 1, 1);
      this._m.compose(this._v, this._q, this._s); this.people.setMatrixAt(i, this._m); this.heads.setMatrixAt(i, this._m);
      k++;
    }
    this.people.instanceMatrix.needsUpdate = true; this.heads.instanceMatrix.needsUpdate = true;

    // ---- cars ----
    const traffic = st.traffic ?? 1; // 1 = flowing, 0 = stopped
    for (let i = 0; i < this.NC; i++) {
      const c = this.cdata[i];
      let x, z, ry, y = 2;
      const tpos = st.trafficT ?? time;
      if (c.kind === 'blvd') { z = -14 + ((c.off + c.dir * c.v * tpos * traffic) % 640 + 640) % 640; x = c.x; ry = c.dir > 0 ? 0 : Math.PI; if (traffic < 0.5) z = -14 + ((c.off) % 640); }
      else { x = -600 + ((c.off + c.dir * c.v * tpos * traffic) % 1200 + 1200) % 1200; z = c.z; ry = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
      let rx = 0, rz = 0;
      if (lvl > 2.6) { // floating / swept
        const f = clamp((lvl - 2.6) / 2);
        y = lvl - 0.4; z += (st.sweep || 0) * (0.5 + c.k) * 40; x += Math.sin(c.ph + time * 0.3) * 2 * f; ry += Math.sin(c.ph + time * 0.4) * f * 1.2; rx = Math.sin(time + c.ph) * 0.1 * f; rz = Math.cos(time * 0.8 + c.ph) * 0.12 * f;
      }
      if (st.quake) { y += Math.abs(Math.sin(time * 23 + c.ph)) * 0.08 * st.quake; }
      this._e.set(rx, ry, rz); this._q.setFromEuler(this._e); this._v.set(x, y, z); this._s.set(1, 1, 1);
      this._m.compose(this._v, this._q, this._s); this.cars.setMatrixAt(i, this._m); this.carLights.setMatrixAt(i, this._m);
    }
    this.cars.instanceMatrix.needsUpdate = true; this.carLights.instanceMatrix.needsUpdate = true;

    // ---- dynamic buildings: sway / collapse ----
    const q = st.quake || 0, col = st.collapse || 0;
    for (const m of this.dyn) {
      const u = m.userData;
      const start = u.fall * 0.8; const p = clamp((col - start) / 0.35);
      const pe = p * p;
      m.position.copy(u.base);
      m.position.y -= pe * u.h * 0.85;
      m.position.x += Math.sin(time * 9 + u.k * 10) * 0.08 * q;
      m.rotation.set(Math.sin(time * 7 + u.k * 5) * 0.004 * q + pe * 0.12 * (u.k - 0.5), 0, Math.sin(time * 8 + u.k * 3) * 0.006 * q + pe * 0.18 * u.side * (u.k > 0.5 ? 1 : -1) * -1);
      m.visible = pe < 0.98;
    }
    this.crackMat.opacity = st.cracks || 0;

    // ---- flying debris ----
    const dm = st.debris || 0;
    for (let i = 0; i < this.ND; i++) {
      const d = this.ddata[i];
      if (i / this.ND >= dm) { this._m.makeScale(0, 0, 0); this.debris.setMatrixAt(i, this._m); continue; }
      const w = (st.windDir || 1);
      const span = 160; const t = time * (8 + wind * 25) * d.sp + d.ph * 10;
      const xx = ((d.x + t * w + span / 2) % span + span) % span - span / 2;
      this._v.set(xx + camera.position.x, d.y + Math.sin(t * 0.05 + d.ph) * 6, d.z + Math.sin(t * 0.03 + d.ph) * 10);
      this._q.setFromAxisAngle(d.ax, t * 0.2); this._s.setScalar(d.s);
      this._m.compose(this._v, this._q, this._s); this.debris.setMatrixAt(i, this._m);
    }
    this.debris.instanceMatrix.needsUpdate = true;
    // ---- dust ----
    const du = st.dust || 0;
    this.dust.material.opacity = du * 0.55;
    if (du > 0) {
      const dp = this.dust.geometry.attributes.position;
      for (let i = 0; i < this.dustData.length; i++) { const d = this.dustData[i]; dp.setXYZ(i, d.x + Math.sin(time * 0.2 * d.sp + d.ph) * 8 + time * wind * 6 % 40, d.y + (time * 1.5 * d.sp) % 30, d.z + Math.cos(time * 0.15 + d.ph) * 8); }
      dp.needsUpdate = true;
      this.dust.material.color.set(st.dustColor || '#9a7f66');
    }
  }
}
