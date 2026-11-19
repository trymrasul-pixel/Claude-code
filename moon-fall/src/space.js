import * as THREE from 'three';
import { rng, clamp, lerp } from './util.js';
import * as TX from './textures.js';
import { buildMoon, moonMaterial, setMoonBreak } from './moon.js';

// 1 unit = 1000 km
export class Space {
  constructor(moonTex) {
    const S = this.scene = new THREE.Scene(), R = rng(77);
    S.background = new THREE.Color('#010205');
    // stars
    for (const [n, size, op] of [[6000, 1.4, 0.8], [900, 2.6, 1.0]]) {
      const p = new Float32Array(n * 3), c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        let u = R() * 2 - 1, th = R() * 6.283;
        if (R() < 0.35) u = (R() - 0.5) * 0.25; // milky-way band
        const r = Math.sqrt(1 - u * u), x = r * Math.cos(th), y = u, z = r * Math.sin(th);
        // tilt band
        p[i * 3] = x * 9000; p[i * 3 + 1] = (y * 0.94 + x * 0.34) * 9000; p[i * 3 + 2] = z * 9000;
        const t = R(); c[i * 3] = lerp(0.7, 1, t); c[i * 3 + 1] = lerp(0.8, 0.95, R()); c[i * 3 + 2] = lerp(1, 0.75, t);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: op, depthWrite: false }));
      pts.frustumCulled = false; S.add(pts);
    }
    this.sunDir = new THREE.Vector3(1, 0.15, 0.35).normalize();
    const E = TX.earthTextures();
    this.earthU = { day: { value: E.day }, clouds: { value: E.clouds }, lava: { value: E.lava }, uSun: { value: this.sunDir }, uLava: { value: 0 }, uCloudRot: { value: 0 }, uBulge: { value: 0 }, uBulgeDir: { value: new THREE.Vector3(0, 0, 1) }, uGlow: { value: 0 } };
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(6.371, 128, 64), new THREE.ShaderMaterial({
      uniforms: this.earthU,
      vertexShader: `uniform float uBulge; uniform vec3 uBulgeDir; varying vec2 vUv; varying vec3 vN; varying vec3 vW;
        void main(){ vUv=uv; vec3 p=position; vec3 n=normalize(position); vec3 wn=normalize(mat3(modelMatrix)*n);
          float c=dot(wn,uBulgeDir); p+=n*uBulge*(1.5*c*c-0.5)*0.9;
          vN=wn; vec4 w=modelMatrix*vec4(p,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform sampler2D day,clouds,lava; uniform vec3 uSun; uniform float uLava,uCloudRot,uGlow; varying vec2 vUv; varying vec3 vN; varying vec3 vW;
        void main(){ vec3 n=normalize(vN); float d=dot(n,normalize(uSun)); float lit=smoothstep(-0.08,0.25,d);
          vec3 base=texture2D(day,vUv).rgb; float cl=texture2D(clouds,vUv+vec2(uCloudRot,0.)).a;
          vec3 surf=mix(base,vec3(1.),cl*0.85*(1.-uLava));
          vec3 dayc=surf*(0.03+lit*1.05);
          float spec=pow(max(dot(reflect(-normalize(uSun),n),normalize(cameraPosition-vW)),0.),40.)*0.35*(1.-cl)*step(base.b,base.r*0.0+0.6)*lit;
          dayc+=vec3(spec)*(1.-uLava);
          vec3 lv=texture2D(lava,vUv).rgb; vec3 lavaC=lv*1.6*(0.6+0.4*(1.-lit))+lv*lit*0.3;
          vec3 col=mix(dayc,lavaC,uLava);
          float rim=pow(1.-max(dot(n,normalize(cameraPosition-vW)),0.),3.);
          col+=vec3(1.0,0.4,0.1)*uGlow*rim;
          gl_FragColor=vec4(col,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    S.add(this.earth);
    this.atmoU = { uSun: { value: this.sunDir }, uCol: { value: new THREE.Color('#5aa0ff') }, uStr: { value: 1 } };
    this.atmo = new THREE.Mesh(new THREE.SphereGeometry(6.371 * 1.06, 96, 48), new THREE.ShaderMaterial({
      uniforms: this.atmoU, side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      vertexShader: `varying vec3 vN; varying vec3 vW; void main(){ vN=normalize(mat3(modelMatrix)*normal); vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform vec3 uSun,uCol; uniform float uStr; varying vec3 vN; varying vec3 vW;
        void main(){ vec3 v=normalize(cameraPosition-vW); float f=pow(max(0.,dot(-vN,v))*1.0,0.0); float rim=1.-abs(dot(normalize(vN),v)); rim=pow(rim,0.5);
          float i=pow(max(dot(normalize(vN),v)*-1.,0.),2.5); float l=smoothstep(-0.3,0.4,dot(-vN,normalize(uSun)));
          gl_FragColor=vec4(uCol*i*1.4*uStr*(0.25+l),1.);
          #include <colorspace_fragment>
        }`,
    }));
    S.add(this.atmo);
    // moon
    this.moonMat = moonMaterial(moonTex);
    this.moonMat.uniforms.uLimb.value = 0.3;
    this.moonMat.uniforms.uAmb.value = 0.015;
    this.moon = buildMoon(this.moonMat, 34, 9, 9);
    this.moonR = 1.737;
    S.add(this.moon);
    // orbit ring
    const pts = []; for (let i = 0; i <= 256; i++) { const a = i / 256 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * 384.4, 0, Math.sin(a) * 384.4)); }
    this.orbit = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x88aadd, transparent: true, opacity: 0.4 }));
    S.add(this.orbit);
    // fragments glow sprites (for impact)
    this.glowTex = TX.glowTexture();
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0xffd9a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    S.add(this.flash);
    // debris ring / vapor cloud (impact aftermath)
    const n = 4000, p = new Float32Array(n * 3); this.vap = [];
    for (let i = 0; i < n; i++) this.vap.push({ a: R() * 6.283, r: 6.6 + Math.pow(R(), 2) * 14, y: (R() - 0.5) * 1.2, s: 0.5 + R() });
    const vg = new THREE.BufferGeometry(); vg.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.vapor = new THREE.Points(vg, new THREE.PointsMaterial({ map: TX.glowTexture(), color: 0xffa060, size: 0.6, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.vapor.frustumCulled = false; S.add(this.vapor);
    this.amb = new THREE.AmbientLight(0xffffff, 0.0); S.add(this.amb);
  }
  update(st, time, camera) {
    // moon position along the fall line (fixed direction from Earth)
    const dir = new THREE.Vector3(...(st.moonAxis || [-0.2, 0, 1])).normalize();
    const d = st.distKm / 1000;
    const scale = st.moonScaleMul ?? 1;
    this.moon.position.copy(dir).multiplyScalar(d);
    if (st.moonOrbitAngle !== undefined) { const a = st.moonOrbitAngle; this.moon.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); }
    this.moon.scale.setScalar(this.moonR * scale);
    this.moon.lookAt(0, 0, 0); this.moon.rotateY(Math.PI);
    const toward = new THREE.Vector3(0, 0, 1); // local +z points at Earth after lookAt+rotate? use world->local
    const local = this.moon.worldToLocal(new THREE.Vector3(0, 0, 0)).normalize();
    setMoonBreak(this.moon, st.moonSep || 0, time, st.moonSep ? local : null);
    this.moon.visible = st.moonVisible !== false;
    this.moonMat.uniforms.uLight.value.copy(this.sunDir);
    this.moonMat.uniforms.uHeat.value = st.moonHeat || 0;
    this.moonMat.uniforms.uSurfGlow.value = st.moonGlow || 0;
    this.moonMat.uniforms.uBright.value = 1.25;
    this.earth.rotation.y = st.earthRot ?? time * 0.02;
    this.earthU.uCloudRot.value = time * 0.002;
    this.earthU.uLava.value = st.lava || 0;
    this.earthU.uGlow.value = st.earthGlow || 0;
    this.earthU.uBulge.value = st.bulge || 0;
    this.earthU.uBulgeDir.value.copy(dir);
    this.atmoU.uStr.value = st.atmo ?? 1;
    this.atmoU.uCol.value.set(st.lava > 0.3 ? '#ff7a30' : '#5aa0ff');
    this.orbit.material.opacity = st.orbitOpacity ?? 0;
    this.orbit.visible = (st.orbitOpacity ?? 0) > 0.001;
    const fl = st.impactFlash || 0;
    this.flash.visible = fl > 0.001;
    if (this.flash.visible) { this.flash.position.copy(dir).multiplyScalar(6.6); this.flash.scale.setScalar(6 + fl * 40); this.flash.material.opacity = Math.min(1, fl * 1.2); }
    const vp = st.vapor || 0;
    this.vapor.material.opacity = vp * 0.6;
    if (vp > 0) {
      const a = this.vapor.geometry.attributes.position;
      for (let i = 0; i < this.vap.length; i++) { const v = this.vap[i]; const ang = v.a + time * 0.05 / v.r * 6; const rr = 6.5 + (v.r - 6.5) * Math.min(1, vp * 1.2); a.setXYZ(i, Math.cos(ang) * rr, v.y * rr * 0.15, Math.sin(ang) * rr); }
      a.needsUpdate = true;
    }
  }
}
