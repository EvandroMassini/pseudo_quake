// Efeitos: partículas (aditivas e normais), luzes dinâmicas, raios
class Particles {
  constructor(max, additive, tex) {
    this.n = max; this.head = 0;
    const f = k => new Float32Array(max * k);
    this.pos = f(3); this.vel = f(3); this.col = f(4); this.size = f(1); this.life = f(1); this.maxl = f(1);
    this.s0 = f(1); this.s1 = f(1); this.c0 = f(4); this.c1 = f(4); this.grav = f(1); this.drag = f(1);
    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos); geo.setAttribute('col', this.aCol); geo.setAttribute('size', this.aSize);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, uK: { value: 600 } },
      vertexShader: 'attribute float size; attribute vec4 col; varying vec4 vC; uniform float uK; void main(){ vC=col; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*uK/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'uniform sampler2D map; varying vec4 vC; void main(){ vec4 t=texture2D(map,gl_PointCoord); float a=vC.a*t.a; if(a<0.004) discard; gl_FragColor=vec4(vC.rgb*' + (additive ? 'a' : '1.0') + ',a); }',
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Points(geo, this.mat); this.mesh.frustumCulled = false;
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, c0, c1, grav, drag) {
    const i = this.head; this.head = (this.head + 1) % this.n;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.maxl[i] = life; this.s0[i] = s0; this.s1[i] = s1;
    for (let k = 0; k < 4; k++) { this.c0[i * 4 + k] = c0[k]; this.c1[i * 4 + k] = c1[k]; }
    this.grav[i] = grav || 0; this.drag[i] = drag || 0;
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.size[i] = 0; continue; }
      this.life[i] -= dt;
      const t = 1 - Math.max(0, this.life[i]) / this.maxl[i], i3 = i * 3, dr = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i3] *= dr; this.vel[i3 + 1] = this.vel[i3 + 1] * dr - this.grav[i] * dt; this.vel[i3 + 2] *= dr;
      this.pos[i3] += this.vel[i3] * dt; this.pos[i3 + 1] += this.vel[i3 + 1] * dt; this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.grav[i] > 0 && this.pos[i3 + 1] < 0.04) { this.pos[i3 + 1] = 0.04; this.vel[i3] *= 0.3; this.vel[i3 + 1] = 0; this.vel[i3 + 2] *= 0.3; }
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      for (let k = 0; k < 4; k++) this.col[i * 4 + k] = this.c0[i * 4 + k] + (this.c1[i * 4 + k] - this.c0[i * 4 + k]) * t;
    }
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = true;
  }
}
let PA, PN, FL = [], BEAMS = [];
function fxInit(scene) {
  const tex = radialTex([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']], 64);
  PA = new Particles(1800, true, tex); PN = new Particles(1800, false, tex);
  scene.add(PN.mesh, PA.mesh);
  for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffffff, 0, 24, 2); l.userData = { life: 0, dur: 1, int: 0 }; scene.add(l); FL.push(l); }
}
function flashLight(x, y, z, color, int, dur) {
  let best = FL[0];
  for (const l of FL) if (l.userData.life < best.userData.life) best = l;
  best.position.set(x, y, z); best.color.setHex(color); best.userData = { life: dur, dur, int };
}
function fxBlood(x, y, z, n, power, dx, dy, dz) {
  for (let i = 0; i < n; i++) {
    const s = power * rr(0.3, 1);
    PN.emit(x, y, z, (dx || 0) * 2 + rr(-1, 1) * s, (dy || 0) * 2 + rr(-0.2, 1) * s * 1.2, (dz || 0) * 2 + rr(-1, 1) * s,
      rr(0.5, 1.2), rr(0.1, 0.25), 0.05, [0.55, 0.02, 0.02, 0.95], [0.25, 0, 0, 0], 18, 0.5);
  }
}
function fxGibs(x, y, z, n) {
  for (let i = 0; i < n; i++) PN.emit(x + rr(-.3, .3), y + rr(-.3, .3), z + rr(-.3, .3), rr(-5, 5), rr(2, 9), rr(-5, 5), rr(1.5, 3), rr(0.25, 0.5), 0.2, [0.5, 0.05, 0.04, 1], [0.2, 0.02, 0.02, 0.3], 22, 0.3);
  fxBlood(x, y, z, 30, 7);
}
function fxSpark(x, y, z, nx, ny, nz, n) {
  for (let i = 0; i < (n || 6); i++) PA.emit(x, y, z, nx * 3 + rr(-3, 3), ny * 3 + rr(-1, 4), nz * 3 + rr(-3, 3), rr(0.15, 0.4), 0.14, 0.02, [1, 0.8, 0.4, 1], [1, 0.3, 0.05, 0], 14, 0.5);
  PN.emit(x, y, z, nx * .5, ny * .5 + .4, nz * .5, 0.7, 0.2, 0.7, [0.35, 0.33, 0.3, 0.35], [0.3, 0.3, 0.3, 0], -0.5, 1.2);
}
function fxSmoke(x, y, z, s, a) {
  PN.emit(x + rr(-.05, .05), y, z + rr(-.05, .05), rr(-.2, .2), rr(.2, .6), rr(-.2, .2), rr(0.8, 1.4), s || 0.25, (s || 0.25) * 4, [0.45, 0.43, 0.4, a || 0.4], [0.2, 0.2, 0.2, 0], -0.2, 1);
}
function fxExplosion(x, y, z, sc) {
  sc = sc || 1;
  for (let i = 0; i < 26; i++) {
    const a = rr(0, PI2), e = rr(-1, 1), sp = rr(2, 9) * sc;
    PA.emit(x, y, z, Math.cos(a) * sp * (1 - Math.abs(e) * .3), e * sp, Math.sin(a) * sp * (1 - Math.abs(e) * .3), rr(0.35, 0.8), rr(1.0, 2.0) * sc, 0.3 * sc, [1, 0.75, 0.3, 1], [0.9, 0.12, 0.02, 0], 0, 3);
  }
  for (let i = 0; i < 14; i++) PA.emit(x, y, z, rr(-6, 6) * sc, rr(0, 9) * sc, rr(-6, 6) * sc, rr(0.5, 1.2), 0.15, 0.03, [1, 0.9, 0.5, 1], [1, 0.3, 0.05, 0], 16, 0.4);
  for (let i = 0; i < 16; i++) PN.emit(x + rr(-.5, .5), y + rr(-.3, .5), z + rr(-.5, .5), rr(-2, 2) * sc, rr(0.5, 3) * sc, rr(-2, 2) * sc, rr(1.4, 2.6), rr(.8, 1.4) * sc, rr(2.5, 4) * sc, [0.22, 0.2, 0.18, 0.7], [0.08, 0.08, 0.08, 0], -0.4, 1.4);
  flashLight(x, y + 0.5, z, 0xff9a40, 380 * sc, 0.55);
}
function fxBeam(x0, y0, z0, x1, y1, z1, dur, color) {
  const n = 14, pts = []; for (let i = 0; i < n; i++) pts.push(new THREE.Vector3());
  const lines = [];
  for (let k = 0; k < 3; k++) {
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: color || 0xaad0ff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    l.frustumCulled = false; BEAM_GROUP.add(l); lines.push(l);
  }
  BEAMS.push({ a: [x0, y0, z0], b: [x1, y1, z1], life: dur, dur, lines, n });
}
let BEAM_GROUP;
function fxUpdate(dt, camera) {
  PA.update(dt); PN.update(dt);
  const k = innerHeight / (2 * Math.tan(camera.fov * Math.PI / 360));
  PA.mat.uniforms.uK.value = PN.mat.uniforms.uK.value = k;
  for (const l of FL) { const u = l.userData; if (u.life > 0) { u.life -= dt; l.intensity = u.int * Math.max(0, u.life / u.dur); } else l.intensity = 0; }
  for (let i = BEAMS.length - 1; i >= 0; i--) {
    const b = BEAMS[i]; b.life -= dt;
    if (b.life <= 0) { b.lines.forEach(l => { BEAM_GROUP.remove(l); l.geometry.dispose(); l.material.dispose(); }); BEAMS.splice(i, 1); continue; }
    for (const l of b.lines) {
      const p = l.geometry.attributes.position, amp = 0.35 * b.life / b.dur + 0.1;
      for (let j = 0; j < b.n; j++) {
        const t = j / (b.n - 1), e = (j === 0 || j === b.n - 1) ? 0 : amp;
        p.setXYZ(j, lerp(b.a[0], b.b[0], t) + rr(-e, e), lerp(b.a[1], b.b[1], t) + rr(-e, e), lerp(b.a[2], b.b[2], t) + rr(-e, e));
      }
      p.needsUpdate = true; l.material.opacity = 0.5 + 0.5 * b.life / b.dur;
    }
    if (Math.random() < 0.5) PA.emit(lerp(b.a[0], b.b[0], Math.random()), lerp(b.a[1], b.b[1], Math.random()), lerp(b.a[2], b.b[2], Math.random()), rr(-1, 1), rr(-1, 1), rr(-1, 1), 0.2, 0.2, 0.05, [0.6, 0.8, 1, 1], [0.3, 0.5, 1, 0], 0, 1);
  }
}
