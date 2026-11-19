import * as THREE from 'three';
import { rng, fbm } from './util.js';

// Breakable Moon: a unit sphere partitioned into Voronoi wedges ("chunks").
export function moonMaterial(map) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map }, uLight: { value: new THREE.Vector3(0, 0, 1) }, uAmb: { value: 0.06 },
      uBright: { value: 1.0 }, uHeat: { value: 0.0 }, uTint: { value: new THREE.Color(1, 1, 1) },
      uSurfGlow: { value: 0.0 }, uLimb: { value: 1.0 },
    },
    vertexShader: `
      attribute float aInterior; varying vec2 vUv; varying vec3 vN; varying float vI; varying vec3 vWP; varying vec3 vLP;
      void main(){ vUv=uv; vI=aInterior; vLP=position; vN=normalize(mat3(modelMatrix)*normal); vec4 wp=modelMatrix*vec4(position,1.); vWP=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `
      uniform sampler2D map; uniform vec3 uLight; uniform float uAmb,uBright,uHeat,uSurfGlow,uLimb; uniform vec3 uTint;
      varying vec2 vUv; varying vec3 vN; varying float vI; varying vec3 vWP; varying vec3 vLP;
      void main(){
        vec3 n=normalize(vN); float d=max(dot(n,normalize(uLight)),0.);
        vec3 base=texture2D(map,vUv).rgb;
        float mu=max(dot(n,normalize(cameraPosition-vWP)),0.);
        vec3 surf=base*(uAmb+d*(1.-uAmb))*uBright*uTint*mix(1.0,0.6+0.4*pow(mu,0.45),uLimb);
        surf+=vec3(1.0,0.35,0.08)*uSurfGlow*(0.4+0.6*(1.-mu));
        float r=length(vLP);
        float deep=smoothstep(0.8,0.25,r);
        float speck=fract(sin(dot(floor(vLP*40.),vec3(12.9898,78.233,37.719)))*43758.5453);
        vec3 rock=vec3(0.07,0.055,0.045)*(0.4+d*0.9)*(0.8+0.4*speck);
        vec3 hot=mix(vec3(0.85,0.18,0.02),vec3(1.0,0.72,0.32),deep*deep);
        vec3 inside=rock+hot*uHeat*(0.05+1.4*pow(deep,1.6))*(0.85+0.3*speck);
        gl_FragColor=vec4(mix(surf,inside,vI),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

export function buildMoon(material, nChunks = 34, seed = 9, detail = 9) {
  const R = rng(seed);
  let ico = new THREE.IcosahedronGeometry(1, detail); if (ico.index) ico = ico.toNonIndexed();
  const P = ico.attributes.position;
  const seeds = [];
  for (let i = 0; i < nChunks; i++) {
    const y = 1 - (i + 0.5) / nChunks * 2, r = Math.sqrt(1 - y * y), th = i * 2.39996 + R() * 0.6;
    seeds.push(new THREE.Vector3(Math.cos(th) * r, y + (R() - 0.5) * 0.15, Math.sin(th) * r).normalize());
  }
  const disp = v => { const k = 1 + (fbm(v.x * 3 + 10, v.y * 3 + v.z * 2.1, 4, 2) - 0.5) * 0.05; return v.clone().multiplyScalar(k); };
  const nf = P.count / 3, cluster = new Int32Array(nf), faces = [];
  const key = v => `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;
  const edgeOwner = new Map();
  for (let f = 0; f < nf; f++) {
    const a = new THREE.Vector3().fromBufferAttribute(P, f * 3), b = new THREE.Vector3().fromBufferAttribute(P, f * 3 + 1), c = new THREE.Vector3().fromBufferAttribute(P, f * 3 + 2);
    const cen = a.clone().add(b).add(c).normalize();
    // jitter the voronoi boundary with noise for irregular cracks
    let best = 0, bd = -9;
    for (let s = 0; s < nChunks; s++) { const d = cen.dot(seeds[s]) + (fbm(cen.x * 6 + s, cen.y * 6 + cen.z * 5, 3, 7) - 0.5) * 0.08; if (d > bd) { bd = d; best = s; } }
    cluster[f] = best; faces.push([a, b, c]);
    [[a, b], [b, c], [c, a]].forEach(([p, q]) => { const k = [key(p), key(q)].sort().join('|'); if (!edgeOwner.has(k)) edgeOwner.set(k, []); edgeOwner.get(k).push(f); });
  }
  const uvOf = v => { const u = 0.5 + Math.atan2(v.z, -v.x) / (2 * Math.PI); return [u, 0.5 + Math.asin(Math.max(-1, Math.min(1, v.y))) / Math.PI]; };
  const group = new THREE.Group(); const chunks = [];
  for (let s = 0; s < nChunks; s++) {
    const pos = [], uv = [], inter = [];
    const O = seeds[s].clone().multiplyScalar(0.3);
    for (let f = 0; f < nf; f++) {
      if (cluster[f] !== s) continue;
      const [a, b, c] = faces[f];
      const A = disp(a), B = disp(b), C = disp(c);
      let ua = uvOf(a), ub = uvOf(b), uc = uvOf(c);
      const us = [ua[0], ub[0], uc[0]];
      if (Math.max(...us) - Math.min(...us) > 0.5) { [ua, ub, uc].forEach(t => { if (t[0] < 0.5) t[0] += 1; }); }
      pos.push(A.x, A.y, A.z, B.x, B.y, B.z, C.x, C.y, C.z); uv.push(...ua, ...ub, ...uc); inter.push(0, 0, 0);
      [[a, b, A, B], [b, c, B, C], [c, a, C, A]].forEach(([p, q, Pp, Qq]) => {
        const k = [key(p), key(q)].sort().join('|'); const own = edgeOwner.get(k);
        const other = own.find(x => x !== f);
        if (other === undefined || cluster[other] !== s) {
          pos.push(Qq.x, Qq.y, Qq.z, Pp.x, Pp.y, Pp.z, O.x, O.y, O.z); uv.push(0, 0, 0, 0, 0, 0); inter.push(1, 1, 1);
        }
      });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aInterior', new THREE.Float32BufferAttribute(inter, 1));
    g.computeVertexNormals();
    { const N = g.attributes.normal; for (let i = 0; i < inter.length; i++) if (!inter[i]) { const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], l = Math.hypot(x, y, z); N.setXYZ(i, x / l, y / l, z / l); } }
    const m = new THREE.Mesh(g, material); m.frustumCulled = false;
    m.userData = { dir: seeds[s].clone(), spin: new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).normalize(), sp: 0.4 + R() * 1.2, k: R() };
    group.add(m); chunks.push(m);
  }
  group.userData.chunks = chunks;
  return group;
}

// sep: 0 = intact. Larger = chunks drift outward. 'towardEarth' (unit vector in moon-local space) stretches the field.
export function setMoonBreak(group, sep, t = 0, towardLocal = null) {
  for (const m of group.userData.chunks) {
    const u = m.userData;
    const s = sep * (0.6 + u.sp * 0.6);
    m.position.copy(u.dir).multiplyScalar(s);
    if (towardLocal) { const along = u.dir.dot(towardLocal); m.position.addScaledVector(towardLocal, along * sep * 1.6); }
    const ang = sep * u.sp * 0.5 + (sep > 0 ? t * 0.02 * u.sp : 0);
    m.quaternion.setFromAxisAngle(u.spin, ang);
  }
}
