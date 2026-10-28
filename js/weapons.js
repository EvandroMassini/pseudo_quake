// Armas: modelos em primeira pessoa e disparo
const WEAP = [
  { name: 'Machado', ammo: null, cd: 0.45 },
  { name: 'Escopeta', ammo: 'shells', use: 1, cd: 0.75 },
  { name: 'Escopeta Dupla', ammo: 'shells', use: 2, cd: 0.72 },
  { name: 'Nailgun', ammo: 'nails', use: 1, cd: 0.095 },
  { name: 'Lança-Granadas', ammo: 'rockets', use: 1, cd: 0.8 },
  { name: 'Lança-Foguetes', ammo: 'rockets', use: 1, cd: 0.8 },
];
const WM = {
  steel: new THREE.MeshStandardMaterial({ color: 0x6a6e76, metalness: 0.75, roughness: 0.35 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x24262a, metalness: 0.6, roughness: 0.45 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x6a4224, roughness: 0.7, metalness: 0 }),
  olive: new THREE.MeshStandardMaterial({ color: 0x4a5a3a, metalness: 0.4, roughness: 0.55 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb08a3a, metalness: 0.8, roughness: 0.35 }),
};
const W = { cur: 1, cd: 0, kick: 0, swing: 0, flash: 0, pending: null, sw: 0, bob: 0, models: [], root: null, alt: 1 };
let gunScene, gunCam, gunAmb, gunDir, gunPt, gunFlashTex;

function cyl(r, len, mat, x, y, z) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 14), mat); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); return m; }
function bx(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; }
const WPOS = [[0.3, -0.42, -0.62], [0.24, -0.23, -0.4], [0.24, -0.23, -0.4], [0.24, -0.23, -0.4], [0.26, -0.24, -0.42], [0.26, -0.24, -0.4]];

function weaponsInit() {
  gunScene = new THREE.Scene();
  gunCam = new THREE.PerspectiveCamera(62, 1, 0.02, 10);
  gunAmb = new THREE.AmbientLight(0xffffff, 1.0); gunDir = new THREE.DirectionalLight(0xffffff, 2.2); gunDir.position.set(-1, 2, 1.5);
  gunPt = new THREE.PointLight(0xffaa55, 0, 4, 2); gunPt.position.set(0.2, -0.1, -1);
  gunScene.add(gunAmb, gunDir, gunPt, new THREE.HemisphereLight(0x8890a0, 0x302018, 0.8));
  makeGunEnv(); W.root = new THREE.Group(); gunScene.add(W.root);
  for (let i = 0; i < 6; i++) { W.models[i] = makeWeaponModel(i); W.models[i].visible = false; W.root.add(W.models[i]); }
  W.models[W.cur].visible = true;
}
function bestWeapon() {
  for (const id of [5, 3, 2, 4, 1]) if (P.weapons[id] && P.ammo[WEAP[id].ammo] >= WEAP[id].use) return id;
  return 0;
}
function switchWeapon(id) {
  if (id === W.cur && W.pending === null) return;
  if (!P.weapons[id]) return; W.pending = id; SND.switchw();
}
function cycleWeapon(dir) {
  let id = W.pending !== null ? W.pending : W.cur;
  for (let k = 0; k < 6; k++) { id = (id + dir + 6) % 6; if (P.weapons[id]) { switchWeapon(id); return; } }
}
function aimDir() { const cp = Math.cos(P.pitch); return { x: -Math.sin(P.yaw) * cp, y: Math.sin(P.pitch), z: -Math.cos(P.yaw) * cp }; }
function shootRay(ox, oy, oz, dx, dy, dz, range, dmg, melee) {
  const w = LV.rayWall(ox, oy, oz, dx, dy, dz, range), wd = w.d;
  let bm = null, bt = wd;
  for (const m of monsters) { if (m.dead) continue; const t = m.hit(ox, oy, oz, dx, dy, dz, wd); if (t >= 0 && t < bt) { bt = t; bm = m; } }
  if (bm) {
    const hx = ox + dx * bt, hy = oy + dy * bt, hz = oz + dz * bt;
    bm.hurt(dmg * pdm(), dx, dz, hx, hy, hz); SND.hitflesh({ x: hx, y: hy, z: hz }); return true;
  }
  if (!w.none) {
    const hx = ox + dx * wd, hy = oy + dy * wd, hz = oz + dz * wd;
    fxSpark(hx, hy, hz, w.nx, w.ny, w.nz, melee ? 4 : 6); if (!melee) SND.ricochet({ x: hx, y: hy, z: hz });
    return melee ? 'wall' : false;
  }
  return false;
}
function pellets(n, spread, dmg) {
  const d = aimDir(), ox = P.x, oy = P.y + 1.6, oz = P.z, rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
  for (let i = 0; i < n; i++) {
    const a = rr(-spread, spread), b = rr(-spread, spread);
    let x = d.x + rx * a, y = d.y + b, z = d.z + rz * a; const l = Math.hypot(x, y, z);
    shootRay(ox, oy, oz, x / l, y / l, z / l, 90, dmg);
  }
}
function muzzleFx(color, int) {
  W.flash = 0.07; W.models[W.cur].userData.flash.visible = true; W.models[W.cur].userData.flash.material.rotation = rr(0, 6);
  const d = aimDir(); flashLight(P.x + d.x * 1.2, P.y + 1.6 + d.y * 1.2, P.z + d.z * 1.2, color, int, 0.1);
}
function tryFire() {
  if (W.cd > 0 || W.pending !== null || P.dead) return;
  const id = W.cur, w = WEAP[id], d = aimDir(), ox = P.x, oy = P.y + 1.6, oz = P.z, rx = Math.cos(P.yaw), rz = -Math.sin(P.yaw);
  if (w.ammo && P.ammo[w.ammo] < w.use) { SND.empty(); W.cd = 0.4; const b = bestWeapon(); if (b !== id) switchWeapon(b); return; }
  W.cd = w.cd; G.noiseT = 0.9;
  if (w.ammo) P.ammo[w.ammo] -= w.use;
  if (id === 0) {
    W.swing = 0.32; SND.axe();
    let any = false, wall = false;
    for (const a of [0, -0.22, 0.22, -0.4, 0.4]) { const r = shootRay(ox, oy, oz, d.x + rx * a, d.y, d.z + rz * a, 2.7, rr(18, 24), true); if (r === true) { any = true; break; } if (r === 'wall') wall = true; }
    if (any) SND.axehit(); else if (wall) SND.axehit();
  } else if (id === 1) { SND.shotgun(); pellets(6, 0.045, 4); W.kick = 1; muzzleFx(0xffc080, 130); P.kickP = 0.03; }
  else if (id === 2) { SND.ssg(); pellets(14, 0.075, 4); W.kick = 1.6; muzzleFx(0xffc080, 220); P.kickP = 0.06; }
  else if (id === 3) {
    SND.nail(); W.alt = -W.alt; W.kick = 0.25; muzzleFx(0xffd9a0, 60);
    const sp = 0.012, x = d.x + rr(-sp, sp), y = d.y + rr(-sp, sp), z = d.z + rr(-sp, sp), l = Math.hypot(x, y, z), v = 48;
    spawnProj({ kind: 'nail', x: ox + d.x * 0.8 + rx * 0.12 * W.alt, y: oy - 0.1 + d.y * 0.8, z: oz + d.z * 0.8 + rz * 0.12 * W.alt, vx: x / l * v, vy: y / l * v, vz: z / l * v, owner: 'p', dmg: 9, life: 2 });
  } else if (id === 4) {
    SND.grenade(); W.kick = 1.1; muzzleFx(0xffc080, 100); P.kickP = 0.04;
    spawnProj({ kind: 'gren', x: ox + d.x * 0.8, y: oy - 0.1 + d.y * 0.8, z: oz + d.z * 0.8, vx: d.x * 19 + P.vx * 0.3, vy: d.y * 19 + 3.5, vz: d.z * 19 + P.vz * 0.3, owner: 'p', dmg: 60, grav: 22, fuse: 2.5, life: 6 });
  } else if (id === 5) {
    SND.rocket(); W.kick = 1.4; muzzleFx(0xffb060, 160); P.kickP = 0.05;
    spawnProj({ kind: 'rocket', x: ox + d.x * 0.9 + rx * 0.1, y: oy - 0.1 + d.y * 0.9, z: oz + d.z * 0.9 + rz * 0.1, vx: d.x * 30, vy: d.y * 30, vz: d.z * 30, owner: 'p', dmg: 60, life: 6 });
  }
  if (w.ammo && P.ammo[w.ammo] < w.use && id !== 0) { /* troca automática após o disparo */ setTimeout(() => { if (P.ammo[w.ammo] < w.use && !P.dead) { const b = bestWeapon(); if (b !== W.cur) switchWeapon(b); } }, 350); }
}
function weaponsUpdate(dt, t, speed, onGround) {
  W.cd -= dt; W.kick = Math.max(0, W.kick - dt * 7); W.swing = Math.max(0, W.swing - dt);
  if (W.flash > 0) { W.flash -= dt; if (W.flash <= 0) for (const m of W.models) if (m.userData.flash) m.userData.flash.visible = false; }
  // troca de arma
  if (W.pending !== null) {
    W.sw += dt * 5;
    if (W.sw >= 1) { W.models[W.cur].visible = false; W.cur = W.pending; W.models[W.cur].visible = true; W.pending = null; W.sw = 1; W.cd = Math.max(W.cd, 0.1); }
  } else W.sw = Math.max(0, W.sw - dt * 5);
  const m = W.models[W.cur], bp = WPOS[W.cur];
  W.bob += dt * Math.min(speed, 10) * 0.9 * (onGround ? 1 : 0);
  const bobA = Math.min(speed, 10) / 10;
  m.position.set(bp[0] + Math.sin(W.bob) * 0.012 * bobA, bp[1] + Math.abs(Math.cos(W.bob)) * 0.012 * bobA - Math.sin(Math.min(1, W.sw) * Math.PI / 2) * 0.5, bp[2] + W.kick * 0.09);
  m.rotation.set(W.kick * 0.1, 0, 0);
  if (m.userData.axe) {
    const p = W.swing > 0 ? 1 - W.swing / 0.32 : 0, a = Math.sin(p * Math.PI);
    m.rotation.z = -a * 1.3; m.rotation.x = -a * 0.9; m.position.x -= a * 0.32; m.position.y += a * 0.12; m.position.z -= a * 0.2;
  }
  // iluminação do modelo conforme o ambiente
  const l = LV ? LV.lightAt(P.x, P.y + 1.4, P.z) : [0.5, 0.5, 0.5];
  const k = clamp((l[0] + l[1] + l[2]) / 3, 0.25, 1.1);
  gunAmb.intensity = 0.25 + k * 0.7; gunDir.intensity = 0.6 + k * 2.4; gunDir.color.setRGB(l[0] / Math.max(l[1], 0.1) > 1.3 ? 1 : 0.9, 0.9, l[2] / Math.max(l[0], 0.1) > 1.2 ? 1.05 : 0.85);
  gunPt.intensity = W.flash > 0 ? 25 : 0;
}
