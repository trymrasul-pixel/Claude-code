// First-person rig: head bob / breathing sway and low-poly arms (phone, running, shielding eyes).
import * as THREE from 'three';
import { clamp, lerp, sstep } from './util.js';

const TAU = Math.PI * 2;

// Gait parameters: steps per second, vertical bob, lateral sway, roll
const GAITS = { walk: [1.85, 0.035, 0.022, 0.006], run: [2.7, 0.085, 0.045, 0.02], wade: [0.85, 0.05, 0.06, 0.02] };

// Returns camera-local offsets {x, y, z, pitch, yaw, roll} for a first-person head.
export function headMotion(fp, lt) {
  const o = { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 };
  if (!fp) return o;
  // breathing + micro head drift (always on)
  const br = fp.breath ?? 1;
  o.y += Math.sin(lt * TAU * 0.24) * 0.008 * br;
  o.pitch += (Math.sin(lt * 0.83 + 1.3) * 0.004 + Math.sin(lt * 1.71) * 0.002) * br;
  o.yaw += (Math.sin(lt * 0.61 + 0.4) * 0.005 + Math.sin(lt * 1.37 + 2) * 0.0025) * br;
  o.roll += Math.sin(lt * 0.47 + 0.9) * 0.003 * br;
  if (fp.panic) { o.pitch += Math.sin(lt * TAU * 0.55) * 0.006 * fp.panic; o.y += Math.sin(lt * TAU * 0.55) * 0.012 * fp.panic; }
  for (const k of ['walk', 'run', 'wade']) {
    const a = fp[k] || 0; if (a <= 0) continue;
    const [sps, A, B, R] = GAITS[k];
    const s = lt * sps * Math.PI;
    o.y += a * A * (Math.abs(Math.sin(s)) - 0.6);
    o.x += a * B * Math.sin(s);
    o.roll += a * R * Math.sin(s);
    o.pitch += a * (k === 'run' ? -0.035 : 0) + a * A * 0.25 * Math.cos(2 * s);
  }
  return o;
}
function phoneTexture() {
  const c = document.createElement('canvas'); c.width = 360; c.height = 740; const g = c.getContext('2d');
  g.fillStyle = '#0d0f14'; g.fillRect(0, 0, 360, 740);
  g.fillStyle = '#fff'; g.font = '600 20px Inter'; g.fillText('16:31', 24, 38); g.fillText('▮▮▮  87%', 236, 38);
  g.fillStyle = '#d4202a'; g.fillRect(0, 70, 360, 54);
  g.fillStyle = '#fff'; g.font = '600 26px Inter'; g.fillText('BREAKING NEWS', 22, 107);
  g.fillStyle = '#1b1f2a'; g.fillRect(18, 146, 324, 230);
  const gr = g.createRadialGradient(180, 255, 10, 180, 255, 80); gr.addColorStop(0, '#f2efe6'); gr.addColorStop(1, '#8d8a82');
  g.fillStyle = gr; g.beginPath(); g.arc(180, 255, 62, 0, 7); g.fill();
  g.fillStyle = 'rgba(80,78,74,0.55)'; g.beginPath(); g.arc(160, 238, 16, 0, 7); g.fill(); g.beginPath(); g.arc(200, 275, 11, 0, 7); g.fill();
  g.strokeStyle = '#ffcc33'; g.lineWidth = 5; g.beginPath(); g.moveTo(180, 330); g.lineTo(180, 368); g.stroke();
  g.beginPath(); g.moveTo(166, 354); g.lineTo(180, 370); g.lineTo(194, 354); g.stroke();
  g.fillStyle = '#d4202a'; g.fillRect(28, 158, 62, 28); g.fillStyle = '#fff'; g.font = '600 18px Inter'; g.fillText('LIVE', 38, 179);
  g.fillStyle = '#fff'; g.font = '600 38px Inter';
  ['The Moon has', 'stopped in', 'its orbit'].forEach((l, i) => g.fillText(l, 22, 432 + i * 46));
  g.fillStyle = '#aab3c5'; g.font = '500 22px Inter';
  ['Observatories confirm it is now', 'falling toward Earth. Experts urge', 'calm as governments meet.'].forEach((l, i) => g.fillText(l, 22, 590 + i * 32));
  g.fillStyle = '#2a3142'; g.fillRect(22, 690, 316, 3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Arms {
  constructor() {
    this.scene = new THREE.Scene();
    this.cam = new THREE.PerspectiveCamera(55, 16 / 9, 0.01, 10);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x333333, 1); this.scene.add(this.hemi);
    this.dir = new THREE.DirectionalLight(0xffffff, 1); this.scene.add(this.dir); this.scene.add(this.dir.target);
    this.skin = new THREE.MeshLambertMaterial({ color: 0xd9a27c, flatShading: true });
    this.sleeve = new THREE.MeshLambertMaterial({ color: 0x34445e, flatShading: true });
    const mkArm = () => {
      const g = new THREE.Group();
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.052, 1, 7), this.sleeve); // length scaled later
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.05, 7), this.skin);
      const hand = new THREE.Group();
      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.026, 0.092), this.skin); hand.add(palm);
      const fingers = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.022, 0.07), this.skin); fingers.position.set(0, 0.004, -0.075); hand.add(fingers);
      const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.06), this.skin); thumb.position.set(-0.05, 0.006, -0.02); thumb.rotation.y = 0.5; hand.add(thumb);
      g.add(fore); g.add(cuff); g.add(hand);
      g.userData = { fore, cuff, hand, fingers, thumb };
      this.scene.add(g); return g;
    };
    this.R = mkArm(); this.L = mkArm();
    this.L.userData.thumb.position.x = 0.05; this.L.userData.thumb.rotation.y = -0.5;
    // phone (held by right hand)
    this.phone = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.152, 0.009), new THREE.MeshLambertMaterial({ color: 0x15161a }));
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.068, 0.14), new THREE.MeshBasicMaterial({ map: phoneTexture() }));
    scr.position.z = 0.0051; this.phone.add(body); this.phone.add(scr);
    this.scene.add(this.phone);
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); this._up = new THREE.Vector3(0, 1, 0);
  }
  // place one arm: shoulder S -> wrist H (camera space), hand orientation euler
  placeArm(arm, S, H, handEuler, fist = 0) {
    const u = arm.userData; const a = this._a.set(...S), b = this._b.set(...H);
    const d = b.clone().sub(a); const len = d.length();
    u.fore.scale.set(1, len, 1); u.fore.position.copy(a).addScaledVector(d, 0.5);
    u.fore.quaternion.setFromUnitVectors(this._up, d.clone().normalize());
    u.cuff.position.copy(b).addScaledVector(d.clone().normalize(), -0.01); u.cuff.quaternion.copy(u.fore.quaternion);
    u.hand.position.copy(b); u.hand.rotation.set(...handEuler);
    u.fingers.rotation.x = fist * 1.3; u.fingers.position.set(0, 0.004 + fist * 0.03, -0.075 + fist * 0.04);
    arm.visible = true;
  }
  // pose: {pose: 'phone'|'run'|'shield', amt, sleeve}
  update(arms, mainCam, city, lt) {
    this.cam.fov = mainCam.fov; this.cam.aspect = mainCam.aspect; this.cam.updateProjectionMatrix();
    const vis = !!arms && (arms.amt ?? 1) > 0.001;
    this.R.visible = this.L.visible = this.phone.visible = false;
    if (!vis) return false;
    if (arms.sleeve) this.sleeve.color.set(arms.sleeve);
    // lighting copied from the city
    this.hemi.color.copy(city.hemi.color); this.hemi.groundColor.copy(city.hemi.groundColor); this.hemi.intensity = city.hemi.intensity;
    const L = city.moonL.intensity > city.sunL.intensity ? city.moonL : city.sunL;
    const wdir = L.position.clone().sub(L.target.position).normalize();
    const inv = mainCam.quaternion.clone().invert();
    this.dir.position.copy(wdir.applyQuaternion(inv)); this.dir.target.position.set(0, 0, 0);
    this.dir.color.copy(L.color); this.dir.intensity = L.intensity * 0.9 + (arms.glow || 0);
    if (arms.glowColor) this.dir.color.set(arms.glowColor);
    const down = (1 - (arms.amt ?? 1)) * 0.45;
    if (arms.pose === 'phone') {
      const bob = Math.sin(lt * 1.3) * 0.004;
      const H = [0.135, -0.15 - down + bob, -0.3];
      this.placeArm(this.R, [0.32, -0.6 - down, -0.08], H, [-1.0, 0.15, 0.05], 0.35);
      this.phone.visible = true;
      this.phone.position.set(0.128, -0.07 - down + bob, -0.325); this.phone.rotation.set(-0.3, 0.22, 0.03);
    } else if (arms.pose === 'run') {
      const s = lt * 2.7 * Math.PI;
      for (const [arm, side, ph] of [[this.R, 1, 0], [this.L, -1, Math.PI]]) {
        const sw = Math.sin(s + ph);
        const H = [side * (0.19 - 0.03 * sw), -0.2 - down + 0.06 * Math.max(0, sw), -0.37 - 0.08 * sw];
        this.placeArm(arm, [side * 0.3, -0.6 - down, -0.05], H, [-0.4 - 0.3 * sw, -side * 0.3, side * 0.5], 1);
      }
    } else if (arms.pose === 'shield') {
      const tr = Math.sin(lt * 23) * 0.003 + Math.sin(lt * 31) * 0.002;
      this.placeArm(this.R, [0.22, -0.52 - down, -0.12], [0.06 + tr, -0.02 - down, -0.38], [Math.PI / 2 - 0.1, 0.25, 0.1], 0);
    }
    return true;
  }
}
