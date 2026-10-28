// Monstros, projéteis, itens
let SKIN = null;
const MDEF = {
  grunt:   { n: 'Soldado', hp: 30, spd: 3.5, sc: 1, r: 0.42, atk: 'hit', dmg: 4, pel: 3, rng: 28, cd: 1.5, wind: 0.5, sight: 34, keep: 7, painc: 0.7,
    look: { body: 0x5c6a30, head: 0xb28c6a, arm: 0x4c5a28, leg: 0x3a4424, helm: 0x30381c, wep: 'gun', eye: 0xff5030 } },
  dog:     { n: 'Cão do Inferno', hp: 25, spd: 7.5, sc: 1, r: 0.45, h: 0.95, atk: 'melee', dmg: 8, rng: 1.9, cd: 0.8, wind: 0.2, sight: 36, keep: 0, painc: 0.8, dog: true,
    look: { body: 0x5a4a38, head: 0x4c3c2c, leg: 0x3e3224, eye: 0xffcc20 } },
  knight:  { n: 'Cavaleiro', hp: 75, spd: 4.2, sc: 1.1, r: 0.46, atk: 'melee', dmg: 11, rng: 2.2, cd: 1.0, wind: 0.35, sight: 34, keep: 0, painc: 0.5,
    look: { body: 0x6a6e78, head: 0x8a8a90, arm: 0x585c66, leg: 0x484c56, helm: 0x50545e, wep: 'sword', shoulder: 0x7a7e88, eye: 0xff2010 } },
  enforcer:{ n: 'Enforcer', hp: 80, spd: 3.3, sc: 1.05, r: 0.44, atk: 'laser', dmg: 15, rng: 32, cd: 1.3, wind: 0.5, sight: 36, keep: 9, painc: 0.5,
    look: { body: 0x3a4a60, head: 0xa07a5e, arm: 0x2e3c50, leg: 0x28323e, helm: 0x22282e, wep: 'gun', shoulder: 0x4a5c78, eye: 0x30c0ff } },
  ogre:    { n: 'Ogro', hp: 200, spd: 3.0, sc: 1.3, r: 0.6, atk: 'gren', dmg: 40, rng: 30, cd: 2.3, wind: 0.7, sight: 36, keep: 10, painc: 0.35, melee: { rng: 2.8, dmg: 22 },
    look: { body: 0x6e5236, head: 0x8c6a48, arm: 0x7a5c3c, leg: 0x4e3a28, w: 1.35, wep: 'saw', shoulder: 0x4a4a4a, eye: 0xffa010 } },
  shambler:{ n: 'Shambler', hp: 600, spd: 3.4, sc: 2, r: 0.8, atk: 'light', dmg: 28, rng: 28, cd: 2.4, wind: 0.8, sight: 38, keep: 8, painc: 0.12, melee: { rng: 3.6, dmg: 40 }, hunch: true,
    look: { body: 0xd2ccc0, head: 0xc8c2b6, arm: 0xc6c0b4, leg: 0xb8b2a6, w: 1.5, eye: 0x4080ff } },
  chthon:  { n: 'Chthon', hp: 1500, spd: 3.2, sc: 2.7, r: 1.0, atk: 'light', dmg: 24, rng: 34, cd: 1.5, wind: 0.6, sight: 60, keep: 10, painc: 0.03, melee: { rng: 4.5, dmg: 50 }, hunch: true,
    look: { body: 0x7a1c14, head: 0x5a100c, arm: 0x6e1812, leg: 0x4a0e0a, w: 1.6, eye: 0xffe040 } },
};
for (const k in MDEF) { const d = MDEF[k]; if (!d.h) d.h = 2.0 * d.sc; }

class Monster {
  constructor(type, x, z) {
    this.type = type; const D = this.D = MDEF[type]; this.x = x; this.z = z; this.y = LV.floorAt(x, z);
    this.r = D.r; this.h = D.h; this.hp = D.hp * G.diff.hp; this.maxhp = this.hp;
    this.state = 'idle'; this.yaw = rr(0, PI2); this.cool = rr(0.5, 1.5); this.painT = 0; this.windT = 0; this.mel = false;
    this.dead = false; this.deadT = 0; this.ph = rr(0, 10); this.walkT = 0; this.flash = 0; this.lt = 0; this.strafe = Math.random() < 0.5 ? 1 : -1; this.strT = 0;
    const m = buildMonster(D); this.g = m.g; this.parts = m.parts; this.mats = m.parts.mats;
    this.g.position.set(x, this.y, z); MG.add(this.g);
    this.boss = D.hp > 1000;
  }
  get pos() { return { x: this.x, y: this.y + this.h * 0.6, z: this.z }; }
  wake() { if (this.state !== 'idle') return; this.state = 'chase'; SND.alert(this.type, this.pos); }
  tint(l) { for (const m of this.mats) { m.color.copy(m.userData.base).multiplyScalar(1); m.color.r *= l[0] * 1.6; m.color.g *= l[1] * 1.6; m.color.b *= l[2] * 1.6; } }
  setEm(v) { for (const m of this.mats) { m.emissive.setRGB(v, v * 0.3, v * 0.3); } }
  free(x, z) {
    const r = this.r;
    return !LV.solidW(x + r, z + r) && !LV.solidW(x - r, z + r) && !LV.solidW(x + r, z - r) && !LV.solidW(x - r, z - r) && !LV.lavaW(x, z);
  }
  move(vx, vz, dt) {
    const nx = this.x + vx * dt, nz = this.z + vz * dt;
    if (this.free(nx, this.z)) this.x = nx; if (this.free(this.x, nz)) this.z = nz;
    for (const o of monsters) {
      if (o === this || o.dead) continue;
      const dx = this.x - o.x, dz = this.z - o.z, d = Math.hypot(dx, dz), mn = this.r + o.r;
      if (d < mn && d > 0.001) { const p = (mn - d) * 0.5 * Math.min(1, dt * 10); const px = this.x + dx / d * p, pz = this.z + dz / d * p; if (this.free(px, pz)) { this.x = px; this.z = pz; } }
    }
  }
  nextCell() {
    const W = LV.W, i = LV.cell(this.x, this.z); if (i < 0 || LV.flow[i] < 0) return null;
    let best = null, bv = LV.flow[i]; const cx = i % W, cz = (i / W) | 0;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dz) continue; const nx = cx + dx, nz = cz + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= LV.H) continue;
      const f = LV.flow[nz * W + nx]; if (f < 0 || f >= bv) continue;
      if (dx && dz && !(LV.passable(cz * W + nx) && LV.passable(nz * W + cx))) continue;
      bv = f; best = [nx, nz];
    }
    return best;
  }
  hurt(dmg, dx, dz, hx, hy, hz) {
    if (this.dead) return;
    this.hp -= dmg; this.wake(); if (this.state === 'idle') this.state = 'chase';
    this.flash = 0.12; this.setEm(0.55);
    fxBlood(hx != null ? hx : this.x, hy != null ? hy : this.y + this.h * 0.6, hz != null ? hz : this.z, Math.min(14, 3 + dmg * 0.3), 3, dx || 0, 0, dz || 0);
    const kb = Math.min(3, dmg * 0.04) / (this.D.sc); if (dx || dz) { this.move(dx * kb * 6, dz * kb * 6, 0.1); }
    if (this.hp <= 0) { this.die(dmg); return; }
    if (Math.random() < this.D.painc && this.state !== 'wind') { this.painT = 0.45; SND.mpain(this.type, this.pos); this.state = 'chase'; }
  }
  die(dmg) {
    this.dead = true; this.state = 'dead'; G.kills++; this.setEm(0);
    const gib = this.hp < -(18 + this.D.hp * 0.4);
    const p = this.pos;
    if (gib) { SND.hitflesh(p); SND.explode(p); fxGibs(p.x, p.y, p.z, 14 + this.D.sc * 8); MG.remove(this.g); this.gone = true; }
    else SND.mdeath(this.type, p);
    const dr = this.type === 'grunt' ? 'packS' : this.type === 'enforcer' ? 'packN' : null;
    if (dr) spawnPickup(dr, this.x, this.z);
    if (this.boss) { LV.bossAlive = false; say('Chthon foi destruído! O portal está aberto!'); flashScreen('#ffffff', 0.6); }
  }
  hit(ox, oy, oz, dx, dy, dz, max) { // raio vs cilindro; retorna distância ou -1
    const rx = this.x - ox, rz = this.z - oz, h2 = dx * dx + dz * dz; if (h2 < 1e-6) return -1;
    const t = (rx * dx + rz * dz) / h2; if (t < 0 || t > max) return -1;
    const cx = ox + dx * t - this.x, cz = oz + dz * t - this.z, rad = this.r * 1.1;
    if (cx * cx + cz * cz > rad * rad) return -1;
    const y = oy + dy * t; if (y < this.y || y > this.y + this.h) return -1;
    return t;
  }
  animate(dt, moving) {
    const P_ = this.parts, D = this.D, t = this.ph;
    if (moving) this.walkT += dt * D.spd * (D.dog ? 2.3 : 1.55);
    const w = this.walkT, sw = moving ? Math.sin(w) : 0, cs = moving ? Math.cos(w) : 0;
    const wind = this.state === 'wind', k = wind ? clamp(1 - this.windT / (this.mel ? 0.3 : D.wind), 0, 1) : 0, pain = this.painT > 0;
    if (D.dog) {
      const L = P_.legs, ph = w * 1.2;
      L[0].rotation.x = Math.sin(ph) * 1.0; L[1].rotation.x = Math.sin(ph + 0.5) * 1.0; L[2].rotation.x = Math.sin(ph + Math.PI) * 1.0; L[3].rotation.x = Math.sin(ph + Math.PI + 0.5) * 1.0;
      if (!moving) for (let i = 0; i < 4; i++) L[i].rotation.x = Math.sin(t * 1.5 + i) * 0.04;
      let by = moving ? Math.abs(Math.sin(ph)) * 0.1 : Math.sin(t * 2) * 0.012, pitch = moving ? Math.sin(ph * 2) * 0.08 : 0;
      if (wind) { by = -0.14 * (1 - k) + 0.18 * k; pitch = -0.35 * (1 - k) + 0.3 * k; }
      P_.body.position.y = by; P_.body.rotation.x = pitch;
      P_.head.rotation.x = 0.12 + (moving ? Math.sin(ph * 2) * 0.1 : Math.sin(t * 1.3) * 0.05) + (wind ? -0.5 * k : 0) + (pain ? -0.5 : 0);
      P_.head.rotation.y = moving ? 0 : Math.sin(t * 0.8) * 0.3;
      P_.jaw.rotation.x = wind ? 0.9 * (k > 0.3 ? 1 : 0.4) : (moving ? 0.25 + Math.sin(w * 3) * 0.25 : 0.05 + Math.max(0, Math.sin(t * 5)) * 0.1);
      return;
    }
    const lean = P_.lean, T = P_.torso, big = D.sc > 1.5;
    P_.legs[0].rotation.x = sw * 0.75; P_.legs[1].rotation.x = -sw * 0.75;
    P_.knees[0].rotation.x = Math.max(0, -sw) * 1.1 + 0.05; P_.knees[1].rotation.x = Math.max(0, sw) * 1.1 + 0.05;
    if (!moving) { P_.legs[0].rotation.x = Math.sin(t * 1.1) * 0.03; P_.legs[1].rotation.x = -Math.sin(t * 1.1) * 0.03; }
    // tronco: postura curvada, torção ao andar, respiração, recuo na dor, bote no ataque
    let tx = lean + (moving ? Math.abs(cs) * 0.07 : Math.sin(t * 1.6) * 0.02) - (pain ? 0.5 : 0);
    let ty = moving ? sw * 0.22 : Math.sin(t * 0.7) * 0.06;
    if (wind) { if (this.mel) { tx += -0.4 * (1 - k) * Math.min(1, k * 3) + 0.55 * Math.max(0, k - 0.55) * 2; ty += (k - 0.5) * 0.5; } else tx += -0.15 * k; }
    T.rotation.x = tx; T.rotation.y = ty; T.position.y = 0.9 + (moving ? Math.abs(cs) * 0.05 : Math.sin(t * 1.6) * 0.01);
    P_.head.rotation.x = 0.35 + Math.sin(t * 2.1) * 0.05 + (pain ? -0.6 : 0) + (wind ? -0.35 * k : 0) - (moving ? Math.abs(cs) * 0.1 : 0);
    P_.head.rotation.y = moving ? -ty * 0.8 + Math.sin(t * 3) * 0.1 : Math.sin(t * 0.9) * 0.25; P_.head.rotation.z = Math.sin(t * 1.3) * 0.08 + (moving ? sw * 0.08 : 0);
    P_.jaw.rotation.x = wind ? 0.8 : (moving ? 0.15 + Math.abs(Math.sin(t * 9)) * 0.1 : 0.05 + Math.max(0, Math.sin(t * 2.2)) * 0.12);
    const A = P_.arms, F = P_.fore;
    A[0].rotation.x = -sw * 0.5 - 0.12 + Math.sin(t * 1.9) * 0.03; A[1].rotation.x = sw * 0.5 - 0.12 + Math.sin(t * 1.7) * 0.03;
    A[0].rotation.z = 0.08 + (big ? 0.15 : 0); A[1].rotation.z = -0.08 - (big ? 0.15 : 0);
    F[0].rotation.x = -0.35 - Math.max(0, sw) * 0.4; F[1].rotation.x = -0.35 - Math.max(0, -sw) * 0.4;
    if (wind) {
      if (this.mel) { const up = Math.min(1, k * 1.7), sl = k > 0.6 ? (k - 0.6) / 0.4 : 0; A[1].rotation.x = -2.7 * up + 3.1 * sl; A[1].rotation.z = -0.3; F[1].rotation.x = -0.4 - 0.8 * up * (1 - sl); if (big || D.hp > 150) { A[0].rotation.x = -2.5 * up + 3.0 * sl; F[0].rotation.x = -0.6; } }
      else { const e = Math.min(1, k * 3); A[1].rotation.x = -1.5 * e; F[1].rotation.x = -0.15; A[0].rotation.x = -1.0 * e; F[0].rotation.x = -0.9; if (D.atk === 'light') { A[0].rotation.x = -2.2 * e; A[1].rotation.x = -2.2 * e; A[0].rotation.z = 0.4; A[1].rotation.z = -0.4; } }
    }
  }
  update(dt) {
    const D = this.D, S = G.diff;
    this.ph += dt; this.lt -= dt;
    if (this.lt <= 0) { this.lt = 0.25 + Math.random() * 0.1; this.tint(LV.lightAt(this.x, this.y + 1, this.z)); }
    if (this.flash > 0) { this.flash -= dt; if (this.flash <= 0) this.setEm(0); }
    if (this.dead) {
      if (this.gone) return;
      this.deadT += dt; const k = Math.min(1, this.deadT / 0.6), e = 1 - (1 - k) * (1 - k);
      if (D.dog) this.g.rotation.z = e * 1.5; else this.g.rotation.x = -e * 1.5;
      this.g.position.y = this.y + (D.dog ? 0 : 0.18) * e; return;
    }
    this.cool -= dt; this.painT -= dt; this.talkT = (this.talkT === undefined ? rr(4, 9) : this.talkT) - dt; if (this.talkT <= 0) { this.talkT = rr(6, 14); SND.growl(this.type, this.pos); }
    const dx = P.x - this.x, dz = P.z - this.z, dist = Math.hypot(dx, dz) || 0.001;
    const eyeOK = Math.abs(P.y - this.y) < 7;
    const sees = !P.dead && eyeOK && dist < 70 && LV.los(this.x, this.z, P.x, P.z);
    if (this.state === 'idle') {
      const fdot = (dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw)) / dist;
      let heard = false;
      if (G.noiseT > 0 && dist < 34) { const i = LV.cell(this.x, this.z); heard = i >= 0 && LV.flow[i] >= 0 && LV.flow[i] < 9; }
      if (!P.dead && ((sees && dist < D.sight && (fdot > -0.2 || dist < 9)) || heard)) this.wake();
      this.g.rotation.y = this.yaw; this.animate(dt, false); return;
    }
    if (P.dead) { this.animate(dt, false); return; }
    // virar para o jogador
    const want = Math.atan2(dx, dz); this.yaw += angDiff(this.yaw, want) * Math.min(1, dt * 9);
    this.g.rotation.y = this.yaw; this.g.position.set(this.x, this.y, this.z);
    if (this.painT > 0) { this.animate(dt, false); return; }
    if (this.state === 'wind') {
      this.windT -= dt; this.animate(dt, false);
      if (this.windT <= 0) { this.fire(dx, dz, dist); this.state = 'chase'; this.cool = D.cd * rr(0.8, 1.4) / S.cd; }
      return;
    }
    const mr = D.atk === 'melee' ? D.rng : (D.melee ? D.melee.rng : 0);
    if (sees && this.cool <= 0) {
      if (mr && dist < mr && Math.abs(P.y - this.y) < 2.5) { this.state = 'wind'; this.windT = 0.3; this.mel = true; SND.swing(this.pos); return; }
      if (D.atk !== 'melee' && dist < D.rng && Math.random() < dt * 3) { this.state = 'wind'; this.windT = D.wind; this.mel = false; if (D.atk === 'gren') SND.alert('grunt', this.pos); return; }
    }
    // movimento
    const sp = D.spd * S.spd; let tx = P.x, tz = P.z, moving = true;
    if (sees && D.keep && dist < D.keep) { // manter distância e deslocar-se lateralmente
      this.strT -= dt; if (this.strT <= 0) { this.strT = rr(0.8, 2); this.strafe = Math.random() < 0.5 ? 1 : -1; }
      this.move(dz / dist * this.strafe * sp * 0.7, -dx / dist * this.strafe * sp * 0.7, dt);
    } else if (sees && dist > D.r + 0.9) {
      if (D.keep && dist < D.keep + 4 && this.cool > 0.4) { moving = false; } else this.move(dx / dist * sp, dz / dist * sp, dt);
    } else if (!sees) {
      const nc = this.nextCell();
      if (nc) { tx = (nc[0] + 0.5) * CS; tz = (nc[1] + 0.5) * CS; const ddx = tx - this.x, ddz = tz - this.z, dd = Math.hypot(ddx, ddz) || 1; this.move(ddx / dd * sp, ddz / dd * sp, dt); }
      else moving = false;
    } else moving = false;
    this.y = LV.floorAt(this.x, this.z); this.g.position.set(this.x, this.y, this.z);
    this.animate(dt, moving);
  }
  fire(dx, dz, dist) {
    const D = this.D, S = G.diff, p = this.pos, ox = this.x + Math.sin(this.yaw) * 0.6, oy = this.y + D.h * 0.7, oz = this.z + Math.cos(this.yaw) * 0.6;
    if (this.mel) {
      const m = D.atk === 'melee' ? D : D.melee;
      if (dist < m.rng + 0.8) { damagePlayer(m.dmg * S.dmg * rr(0.75, 1.25), this.x, this.z); if (this.type === 'dog') SND.bite(p); else if (this.type === 'ogre') SND.chain(p); else SND.axehit(p); }
      return;
    }
    const tx = P.x, ty = P.y + 1.2, tz = P.z;
    if (D.atk === 'hit') {
      SND.mshot(p); flashLight(ox, oy, oz, 0xffb060, 60, 0.1);
      for (let i = 0; i < D.pel; i++) if (Math.random() < clamp(0.95 - dist * 0.022, 0.15, 0.85)) damagePlayer(D.dmg * S.dmg, this.x, this.z);
      fxSpark(ox, oy, oz, Math.sin(this.yaw), 0, Math.cos(this.yaw), 4);
    } else if (D.atk === 'laser') {
      SND.laser(p); const d = Math.hypot(tx - ox, ty - oy, tz - oz), v = 26;
      spawnProj({ kind: 'laser', x: ox, y: oy, z: oz, vx: (tx - ox) / d * v, vy: (ty - oy) / d * v, vz: (tz - oz) / d * v, owner: 'm', dmg: D.dmg * S.dmg, life: 4 });
    } else if (D.atk === 'gren') {
      SND.grenade(p); const hs = 14, t = Math.max(0.3, dist / hs), g = 22;
      spawnProj({ kind: 'mgren', x: ox, y: oy, z: oz, vx: dx / dist * hs, vz: dz / dist * hs, vy: (ty - oy + 0.5 * g * t * t) / t, owner: 'm', dmg: D.dmg * S.dmg, rad: 3.6, grav: g, fuse: 2.2, life: 5 });
    } else if (D.atk === 'light') {
      SND.zap(p);
      const d = Math.hypot(tx - ox, ty - oy, tz - oz);
      const w = LV.rayWall(ox, oy, oz, (tx - ox) / d, (ty - oy) / d, (tz - oz) / d, d);
      if (w.none) { fxBeam(ox, oy + 0.3, oz, tx, ty, tz, 0.4); damagePlayer(D.dmg * S.dmg * rr(0.9, 1.3), this.x, this.z); flashScreen('#6080ff', 0.35); }
      else fxBeam(ox, oy + 0.3, oz, ox + (tx - ox) / d * w.d, oy + (ty - oy) / d * w.d, oz + (tz - oz) / d * w.d, 0.4);
      flashLight(ox, oy, oz, 0x80a0ff, 200, 0.4);
    }
  }
}

// ---------- projéteis ----------
const PJ = { rocket: null };
function spawnProj(o) {
  let mesh;
  if (o.kind === 'rocket') {
    mesh = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), new THREE.MeshLambertMaterial({ color: 0x777777 })); b.rotation.x = Math.PI / 2; mesh.add(b);
    const n = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.15, 8), new THREE.MeshLambertMaterial({ color: 0xaa3322 })); n.rotation.x = -Math.PI / 2; n.position.z = 0.32; mesh.add(n);
  } else if (o.kind === 'nail') mesh = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.45), new THREE.MeshBasicMaterial({ color: 0xffdd99 }));
  else if (o.kind === 'laser') mesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.9), new THREE.MeshBasicMaterial({ color: 0xff3030, blending: THREE.AdditiveBlending }));
  else mesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshLambertMaterial({ color: o.kind === 'gren' ? 0x3a5a2a : 0x5a3a2a }));
  mesh.position.set(o.x, o.y, o.z); PRG.add(mesh); o.mesh = mesh; o.age = 0; projs.push(o); return o;
}
function pdm() { return P.quad > 0 ? 4 : 1; }
function explode(x, y, z, dmg, rad, owner) {
  SND.explode({ x, y, z }); fxExplosion(x, y, z, rad > 4 ? 1.1 : 0.85);
  const d0 = Math.hypot(P.x - x, P.y + 0.9 - y, P.z - z);
  if (d0 < 14) G.shake = Math.max(G.shake, (1 - d0 / 14) * 0.7);
  if (owner === 'p' || owner === 'm') {
    if (owner === 'p') for (const m of monsters) {
      if (m.dead) continue; const d = Math.max(0, Math.hypot(m.x - x, m.y + m.h / 2 - y, m.z - z) - m.r);
      if (d < rad) { const a = dmg * (1 - d / rad) * pdm(); const l = Math.hypot(m.x - x, m.z - z) || 1; m.hurt(a, (m.x - x) / l, (m.z - z) / l); }
    }
    const d = Math.max(0, d0 - 0.4);
    if (d < rad) {
      const a = dmg * (1 - d / rad), self = owner === 'p';
      if (self) { damagePlayer(a * 0.5 * G.diff.dmg, x, z, true); } else damagePlayer(a, x, z, true);
      const l = d0 || 1, k = Math.min(15, a * 0.13);
      P.vx += (P.x - x) / l * k; P.vz += (P.z - z) / l * k; P.vy += ((P.y + 0.9 - y) / l * k + (self ? 2 : 0.5)); P.onGround = false;
    }
  }
}
function updateProjs(dt) {
  for (let i = projs.length - 1; i >= 0; i--) {
    const p = projs[i]; p.age += dt; let dead = false;
    const sp = Math.hypot(p.vx, p.vy, p.vz), steps = Math.max(1, Math.ceil(sp * dt / 0.3)), sub = dt / steps;
    for (let s = 0; s < steps && !dead; s++) {
      if (p.grav) p.vy -= p.grav * sub;
      const nx = p.x + p.vx * sub, ny = p.y + p.vy * sub, nz = p.z + p.vz * sub;
      const bounce = p.kind === 'gren' || p.kind === 'mgren';
      const fl = LV.floorAt(nx, nz), cl = LV.ceilAt(nx, nz);
      if (LV.solidW(nx, nz) || ny < fl || ny > cl) {
        if (bounce) {
          let hitv = false;
          if (LV.solidW(nx, p.z)) { p.vx *= -0.5; hitv = true; } else p.x = nx;
          if (LV.solidW(p.x, nz)) { p.vz *= -0.5; hitv = true; } else p.z = nz;
          if (ny < LV.floorAt(p.x, p.z)) { p.y = LV.floorAt(p.x, p.z); p.vy = Math.abs(p.vy) * 0.5; p.vx *= 0.75; p.vz *= 0.75; hitv = true; if (Math.abs(p.vy) < 1) p.vy = 0; } else if (ny > LV.ceilAt(p.x, p.z)) { p.vy = -Math.abs(p.vy) * 0.4; p.y = LV.ceilAt(p.x, p.z) - 0.05; hitv = true; } else p.y = ny;
          if (hitv && Math.hypot(p.vx, p.vy, p.vz) > 2.5 && p.bt === undefined) { SND.bounce({ x: p.x, y: p.y, z: p.z }); p.bt = 0.15; }
          continue;
        }
        const dd = Math.hypot(p.vx, p.vy, p.vz) || 1;
        if (p.kind === 'rocket') explode(p.x, p.y, p.z, p.dmg, 4.6, p.owner);
        else if (p.kind === 'nail') { fxSpark(p.x, p.y, p.z, -p.vx / dd, -p.vy / dd, -p.vz / dd, 5); SND.ricochet({ x: p.x, y: p.y, z: p.z }); }
        else if (p.kind === 'laser') { fxSpark(p.x, p.y, p.z, -p.vx / dd, -p.vy / dd, -p.vz / dd, 8); flashLight(p.x, p.y, p.z, 0xff3030, 80, 0.15); }
        dead = true; break;
      }
      p.x = nx; p.y = ny; p.z = nz;
      if (p.owner === 'p') {
        for (const m of monsters) {
          if (m.dead) continue;
          const dx = p.x - m.x, dz = p.z - m.z;
          if (dx * dx + dz * dz < (m.r + 0.12) ** 2 && p.y > m.y && p.y < m.y + m.h) {
            const l = Math.hypot(p.vx, p.vz) || 1;
            if (p.kind === 'nail') { m.hurt(p.dmg * pdm(), p.vx / l, p.vz / l, p.x, p.y, p.z); SND.hitflesh(m.pos); }
            else { m.hurt((p.dmg) * pdm(), p.vx / l, p.vz / l); explode(p.x, p.y, p.z, p.kind === 'rocket' ? 100 : 120, p.kind === 'rocket' ? 4.6 : 5, 'p'); }
            dead = true; break;
          }
        }
      } else if (!P.dead) {
        const dx = p.x - P.x, dz = p.z - P.z;
        if (dx * dx + dz * dz < 0.5 * 0.5 && p.y > P.y && p.y < P.y + 1.9) {
          if (p.kind === 'laser') damagePlayer(p.dmg, p.x - p.vx, p.z - p.vz);
          else explode(p.x, p.y, p.z, p.dmg, p.rad, 'm');
          dead = true;
        }
      }
    }
    if (p.bt !== undefined) { p.bt -= dt; if (p.bt <= 0) p.bt = undefined; }
    if (!dead && p.fuse !== undefined) { p.fuse -= dt; if (p.fuse <= 0) { explode(p.x, p.y, p.z, p.kind === 'gren' ? 120 : p.dmg, p.kind === 'gren' ? 5 : p.rad, p.owner); dead = true; } }
    if (!dead && p.age > (p.life || 8)) dead = true;
    if (dead) { PRG.remove(p.mesh); p.mesh.traverse(o => { if (o.geometry) o.geometry.dispose(); }); projs.splice(i, 1); continue; }
    p.mesh.position.set(p.x, p.y, p.z);
    if (p.kind === 'gren' || p.kind === 'mgren') p.mesh.rotation.x += dt * 8;
    else p.mesh.lookAt(p.x + p.vx, p.y + p.vy, p.z + p.vz);
    if (p.kind === 'rocket') {
      PA.emit(p.x - p.vx * 0.02, p.y, p.z - p.vz * 0.02, rr(-.3, .3), rr(-.3, .3), rr(-.3, .3), 0.25, 0.35, 0.05, [1, 0.8, 0.3, 1], [1, 0.3, 0.05, 0], 0, 2);
      fxSmoke(p.x, p.y, p.z, 0.22, 0.35); flashLight(p.x, p.y, p.z, 0xffa040, 90, 0.06);
    } else if (p.kind === 'mgren' && Math.random() < 0.3) fxSmoke(p.x, p.y, p.z, 0.15, 0.25);
    else if (p.kind === 'laser') PA.emit(p.x, p.y, p.z, 0, 0, 0, 0.15, 0.25, 0.05, [1, 0.2, 0.2, 1], [1, 0, 0, 0], 0, 0);
  }
}

// ---------- itens ----------
const WEAP_AMMO = [null, ['shells', 5], ['shells', 5], ['nails', 30], ['rockets', 5], ['rockets', 5]];
const AMMO_MAX = { shells: 100, nails: 200, rockets: 100 };
const AMMO_NAME = { shells: 'cartuchos', nails: 'pregos', rockets: 'foguetes' };
const PKD = {
  hp25: { c: 0x66ff66, mk: () => new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.55), new THREE.MeshLambertMaterial({ map: crossTex() })) },
  hp10: { c: 0x66ff66, mk: () => new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.32), new THREE.MeshLambertMaterial({ map: crossTex(), color: 0xaaffaa })) },
  armG: { c: 0x40ff40, mk: () => armorMesh(0x2f9a2f) }, armY: { c: 0xffd040, mk: () => armorMesh(0xb89a20) }, armR: { c: 0xff3030, mk: () => armorMesh(0xa02020) },
  shells: { c: 0xff9040, mk: () => crate(0x8a2a1a, 0xc8a040) }, nails: { c: 0xc0c0a0, mk: () => crate(0x4a5040, 0x9a9a80) }, rockets: { c: 0xffa060, mk: () => crate(0x5a4020, 0xaa3020) },
  packS: { c: 0xff9040, mk: () => crate(0x5a3a22, 0xc8a040, 0.6) }, packN: { c: 0xc0c0a0, mk: () => crate(0x3a4038, 0x9a9a80, 0.6) },
  keygold: { c: 0xffd050, mk: () => keyMesh(0xffc83c) }, keysilver: { c: 0x9fb8ff, mk: () => keyMesh(0xb8c8ff) },
  quad: { c: 0x4070ff, mk: () => glowGem(0x3060ff) }, pent: { c: 0xff3030, mk: () => glowGem(0xff2020) }, life: { c: 0x50ff90, mk: () => glowGem(0x30ff80, true) },
};
function armorMesh(c) { const g = new THREE.Group(); const m = new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.25 }); const b = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.3), m); g.add(b); const s = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.34), m); s.position.y = 0.3; g.add(s); return g; }
function crate(c, c2, k) { k = k || 1; const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(0.6 * k, 0.35 * k, 0.4 * k), new THREE.MeshLambertMaterial({ color: c })); g.add(b); const t = new THREE.Mesh(new THREE.BoxGeometry(0.62 * k, 0.08 * k, 0.42 * k), new THREE.MeshLambertMaterial({ color: c2 })); t.position.y = 0.1 * k; g.add(t); return g; }
function keyMesh(c) { const g = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.5 }); const r = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 8, 20), m); r.position.y = 0.35; g.add(r); const s = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.08), m); g.add(s); const t = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.08), m); t.position.set(0.1, -0.2, 0); g.add(t); const t2 = t.clone(); t2.position.set(0.1, -0.05, 0); g.add(t2); return g; }
function glowGem(c, sph) { const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }); return new THREE.Mesh(sph ? new THREE.SphereGeometry(0.3, 14, 10) : new THREE.OctahedronGeometry(0.4), m); }
let glowTex = null;
function spawnPickup(type, x, z) {
  const d = PKD[type] || (type[0] === 'w' ? { c: 0xffffff } : null); if (!d) return;
  const g = new THREE.Group(); const y0 = LV.floorAt(x, z);
  let mesh;
  if (type[0] === 'w' && type.length === 2) { mesh = makeWeaponModel(+type[1]); mesh.rotation.y = Math.PI / 2; mesh.scale.setScalar(0.95); }
  else mesh = d.mk();
  g.add(mesh);
  if (!glowTex) glowTex = radialTex([[0, 'rgba(255,255,255,0.55)'], [0.5, 'rgba(255,255,255,0.12)'], [1, 'rgba(255,255,255,0)']]);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: d.c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); sp.scale.set(2.2, 2.2, 1); g.add(sp);
  g.position.set(x, y0 + 0.7, z); PKG.add(g);
  pickups.push({ type, x, z, y0, g, mesh, ph: rr(0, 6), life: type.startsWith('pack') ? 40 : null });
}
function addAmmo(t, n) { if (P.ammo[t] >= AMMO_MAX[t]) return false; P.ammo[t] = Math.min(AMMO_MAX[t], P.ammo[t] + n); return true; }
function applyPickup(type) {
  const f = (c, m) => { flashScreen(c, 0.25); say(m); };
  if (type === 'hp25' || type === 'hp10') { if (P.hp >= 100) return false; P.hp = Math.min(100, P.hp + (type === 'hp25' ? 25 : 10)); SND.pickHealth(); f('#ffe080', type === 'hp25' ? 'Você pegou um kit de saúde (+25)' : 'Você pegou saúde (+10)'); return true; }
  if (type.startsWith('arm')) { const A = { armG: [100, 0.3, 'verde'], armY: [150, 0.6, 'amarela'], armR: [200, 0.8, 'vermelha'] }[type]; if (A[0] * A[1] <= P.armor * P.absorb) return false; P.armor = A[0]; P.absorb = A[1]; SND.pickArmor(); f('#ffd070', 'Você pegou a armadura ' + A[2]); return true; }
  if (type === 'shells' || type === 'packS') { if (!addAmmo('shells', type === 'packS' ? 8 : 20)) return false; SND.pickAmmo(); f('#ffe080', 'Você pegou cartuchos'); return true; }
  if (type === 'nails' || type === 'packN') { if (!addAmmo('nails', type === 'packN' ? 15 : 25)) return false; SND.pickAmmo(); f('#ffe080', 'Você pegou pregos'); return true; }
  if (type === 'rockets') { if (!addAmmo('rockets', 5)) return false; SND.pickAmmo(); f('#ffe080', 'Você pegou foguetes'); return true; }
  if (type[0] === 'w') { const id = +type[1]; const had = P.weapons[id]; P.weapons[id] = true; const a = WEAP_AMMO[id]; addAmmo(a[0], a[1]); SND.pickWeapon(); f('#ffe080', 'Você pegou ' + WEAP[id].name); if (!had && id > W.cur) switchWeapon(id); return true; }
  if (type === 'keygold' || type === 'keysilver') { const c = type.slice(3); P.keys[c] = true; SND.pickKey(); f('#ffe080', 'Você pegou a chave de ' + (c === 'gold' ? 'ouro' : 'prata')); return true; }
  if (type === 'quad') { P.quad = 30; SND.powerup(); f('#4060ff', 'DANO QUÁDRUPLO!'); return true; }
  if (type === 'pent') { P.pent = 30; SND.powerup(); f('#ff3030', 'PENTAGRAMA DA PROTEÇÃO!'); return true; }
  if (type === 'life') { G.lives++; SND.powerup(); f('#60ff90', 'Vida extra!'); return true; }
  return false;
}
function updatePickups(dt, t) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const k = pickups[i];
    k.g.position.y = k.y0 + 0.75 + Math.sin(t * 2 + k.ph) * 0.12; k.mesh.rotation.y += dt * 1.6;
    if (k.type === 'quad' || k.type === 'pent' || k.type === 'life') k.mesh.rotation.x += dt * 0.9;
    if (k.life !== null) { k.life -= dt; if (k.life <= 0) { PKG.remove(k.g); pickups.splice(i, 1); continue; } }
    if (P.dead) continue;
    const dx = k.x - P.x, dz = k.z - P.z;
    if (dx * dx + dz * dz < 1.5 * 1.5 && Math.abs(P.y + 0.8 - k.g.position.y) < 2.4) {
      if (applyPickup(k.type)) { PKG.remove(k.g); pickups.splice(i, 1); }
    }
  }
}
