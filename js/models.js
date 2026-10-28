// Modelos orgânicos dos monstros: elipsoides, membros afilados, deformação por ruído e fusão de malhas por osso
function n3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), f = t => t * t * (3 - 2 * t);
  const fx = f(x - xi), fy = f(y - yi), fz = f(z - zi);
  const h = (a, b, c) => fract(Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(h(xi, yi, zi), h(xi + 1, yi, zi), fx), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), fx), fy),
    l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), fx), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), fx), fy), fz);
}
const _M4 = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _E = new THREE.Euler(), _V = new THREE.Vector3(), _S = new THREE.Vector3();
function addPart(par, geo, mat, o) {
  o = o || {};
  if (o.amp) { // deformação orgânica ao longo das normais
    const p = geo.attributes.position, n = geo.attributes.normal, ns = o.ns || 3;
    for (let i = 0; i < p.count; i++) {
      const d = (n3(p.getX(i) * ns + 7, p.getY(i) * ns, p.getZ(i) * ns) - 0.5) * o.amp;
      p.setXYZ(i, p.getX(i) + n.getX(i) * d, p.getY(i) + n.getY(i) * d, p.getZ(i) + n.getZ(i) * d);
    }
    geo.computeVertexNormals();
  }
  _E.set(o.rx || 0, o.ry || 0, o.rz || 0); _Q.setFromEuler(_E);
  _M4.compose(_V.set(o.x || 0, o.y || 0, o.z || 0), _Q, _S.set(o.sx || 1, o.sy || 1, o.sz || 1));
  geo.applyMatrix4(_M4);
  // sombreamento por vértice: face para baixo mais escura + variação de ruído
  const p = geo.attributes.position, n = geo.attributes.normal, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const k = (0.58 + 0.42 * (n.getY(i) * 0.5 + 0.5)) * (0.86 + 0.28 * n3(p.getX(i) * 6, p.getY(i) * 6, p.getZ(i) * 6)) * (o.tone || 1);
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  (par.userData.list = par.userData.list || []).push({ geo, mat });
}
const ell = (par, mat, rx, ry, rz, o) => { o = o || {}; o.sx = rx; o.sy = ry; o.sz = rz; if (o.amp === undefined) o.amp = 0.14; addPart(par, new THREE.SphereGeometry(1, o.seg || 8, o.seg2 || 6), mat, o); };
const plate = (par, mat, w, h, d, o) => { o = o || {}; o.sx = w; o.sy = h; o.sz = d; addPart(par, new THREE.BoxGeometry(1, 1, 1), mat, o); };
function limbGeo(r0, r1, len, bulge) {
  const pts = [], B = bulge || 0;
  for (let a = 2; a >= 0; a--) { const t = a / 2 * Math.PI / 2; pts.push(new THREE.Vector2(r1 * Math.cos(t), -len - r1 * Math.sin(t))); }
  for (let k = 1; k < 3; k++) { const t = k / 3; pts.push(new THREE.Vector2((r1 + (r0 - r1) * t) * (1 + B * Math.sin(Math.PI * t)), -len + len * t)); }
  for (let a = 0; a <= 2; a++) { const t = a / 2 * Math.PI / 2; pts.push(new THREE.Vector2(r0 * Math.cos(t), r0 * Math.sin(t))); }
  return new THREE.LatheGeometry(pts, 6);
}
const limb = (par, mat, r0, r1, len, o) => { o = o || {}; addPart(par, limbGeo(r0, r1, len, o.bulge), mat, o); };
const cone = (par, mat, r, h, o) => addPart(par, new THREE.ConeGeometry(r, h, (o && o.seg) || 5), mat, o);
const lathe = (par, mat, pts, o) => addPart(par, new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), (o && o.seg) || 7), mat, o);

function mergeGeos(gs) {
  let pc = 0, ic = 0;
  for (const g of gs) { pc += g.attributes.position.count; ic += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(pc * 3), nor = new Float32Array(pc * 3), uv = new Float32Array(pc * 2), col = new Float32Array(pc * 3), idx = new Uint32Array(ic);
  let po = 0, io = 0;
  for (const g of gs) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, po * 3); nor.set(g.attributes.normal.array, po * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, po * 2); col.set(g.attributes.color.array, po * 3);
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + po; else for (let i = 0; i < c; i++) idx[io + i] = po + i;
    io += g.index ? g.index.count : c; po += c; g.dispose();
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  m.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); m.setAttribute('color', new THREE.BufferAttribute(col, 3)); m.setIndex(new THREE.BufferAttribute(idx, 1));
  return m;
}
function finalize(root) {
  const gs = []; root.traverse(o => { if (o.userData.list) gs.push(o); });
  for (const o of gs) {
    const by = new Map();
    for (const p of o.userData.list) { if (!by.has(p.mat)) by.set(p.mat, []); by.get(p.mat).push(p.geo); }
    for (const [mat, list] of by) o.add(new THREE.Mesh(mergeGeos(list), mat));
    o.userData.list = null;
  }
}

function buildMonster(D) {
  const Lk = D.look, g = new THREE.Group(), mats = [];
  const mat = c => { const m = new THREE.MeshLambertMaterial({ color: c, map: SKIN.map, vertexColors: true, flatShading: true }); m.userData.base = new THREE.Color(c); mats.push(m); return m; };
  const eyeM = new THREE.MeshBasicMaterial({ color: Lk.eye });
  const body = new THREE.Group(); g.add(body);
  const grp = (par, x, y, z) => { const t = new THREE.Group(); t.position.set(x || 0, y || 0, z || 0); par.add(t); return t; };
  const parts = { legs: [], knees: [], arms: [], fore: [], mats, lean: 0.2 };
  const dark = mat(0x16130f), steel = mat(0x9aa0aa), dsteel = mat(0x4a4f58), bone = mat(0xcfc5a4), blood = mat(0x5a0a0a), tongue = mat(0x7a1818);
  const teeth = (par, m, y, z, hw, n, len, up) => { for (let i = 0; i < n; i++) { const x = -hw + 2 * hw * i / (n - 1), e = Math.abs(x) > hw * 0.6; cone(par, m, 0.011, len * (e ? 0.7 : 1) * (0.8 + 0.4 * ((i * 7) % 3) / 2), { x, y, z: z - (e ? 0.03 : 0), rx: up ? 0 : Math.PI, seg: 4 }); } };

  // ================= CÃO INFERNAL =================
  if (D.dog) {
    const bm = mat(Lk.body), hm = mat(Lk.head), lm = mat(Lk.leg);
    body.scale.setScalar(D.sc * 1.05);
    const bg = parts.body = grp(body, 0, 0, 0);
    ell(bg, bm, 0.25, 0.3, 0.44, { y: 0.74, z: 0.14, amp: 0.2 });          // caixa torácica
    ell(bg, bm, 0.26, 0.22, 0.24, { y: 0.9, z: 0.36, amp: 0.2 });          // corcova dos ombros
    ell(bg, bm, 0.17, 0.2, 0.28, { y: 0.62, z: -0.12, amp: 0.15 });        // cintura magra
    ell(bg, bm, 0.24, 0.27, 0.26, { y: 0.7, z: -0.4, amp: 0.2 });          // quadril
    for (let i = 0; i < 9; i++) { const z = 0.5 - i * 0.14, y = 1.0 - Math.abs(i - 3) * 0.02 - i * 0.012; cone(bg, bone, 0.034, 0.17 - i * 0.008, { y: y + 0.06, z, rx: -0.15 }); }
    for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) ell(bg, bone, 0.016, 0.15, 0.035, { x: sx * 0.235, y: 0.7, z: 0.34 - i * 0.1, rz: sx * 0.18, seg: 5, seg2: 4, amp: 0.05 });
    for (let i = 0; i < 6; i++) cone(bg, bone, 0.028, 0.2 - i * 0.025, { y: 0.74 - i * 0.012, z: -0.5 - i * 0.12, rx: -1.45 - i * 0.12 }); // rabo de espinhos
    ell(bg, hm, 0.14, 0.17, 0.26, { y: 0.84, z: 0.66, rx: 1.05 });         // pescoço
    const head = parts.head = grp(body, 0, 0.8, 0.98); head.rotation.x = 0.12;
    ell(head, hm, 0.16, 0.14, 0.2, { amp: 0.12 }); ell(head, hm, 0.1, 0.07, 0.22, { y: -0.03, z: 0.22, amp: 0.1 });
    ell(head, dark, 0.05, 0.035, 0.04, { y: 0.0, z: 0.43 }); ell(head, dark, 0.14, 0.03, 0.14, { y: 0.1, z: 0.05, tone: 0.55 });
    for (const sx of [-1, 1]) {
      cone(head, hm, 0.075, 0.26, { x: sx * 0.12, y: 0.18, z: -0.06, rz: -sx * 0.5, rx: -0.9 });
      ell(head, dark, 0.05, 0.04, 0.04, { x: sx * 0.085, y: 0.07, z: 0.14 }); ell(head, eyeM, 0.03, 0.02, 0.02, { x: sx * 0.085, y: 0.07, z: 0.165 });
      ell(head, dark, 0.012, 0.012, 0.012, { x: sx * 0.04, y: 0.01, z: 0.42 });
    }
    teeth(head, bone, -0.07, 0.3, 0.08, 6, 0.1, false);
    const jaw = parts.jaw = grp(head, 0, -0.06, 0.08);
    ell(jaw, hm, 0.075, 0.03, 0.2, { y: -0.03, z: 0.15, amp: 0.08 }); ell(jaw, tongue, 0.04, 0.012, 0.15, { y: 0.0, z: 0.15, tone: 1.2 });
    teeth(jaw, bone, 0.0, 0.26, 0.06, 5, 0.08, true);
    for (const [x, z, front] of [[-0.18, 0.4, 1], [0.18, 0.4, 1], [-0.18, -0.4, 0], [0.18, -0.4, 0]]) {
      const leg = grp(body, x, 0.72, z); parts.legs.push(leg);
      const inn = grp(leg, 0, 0, 0); inn.rotation.x = front ? 0.25 : -0.5;
      limb(inn, lm, 0.09, 0.055, 0.3, { bulge: 0.25 });
      const kn = grp(inn, 0, -0.3, 0); kn.rotation.x = front ? -0.35 : 1.05;
      limb(kn, lm, 0.05, 0.035, 0.3, {}); const ft = grp(kn, 0, -0.32, 0); ft.rotation.x = front ? 0.1 : -0.7;
      ell(ft, lm, 0.05, 0.035, 0.11, { y: -0.01, z: 0.05 }); for (let i = -1; i <= 1; i++) cone(ft, bone, 0.01, 0.07, { x: i * 0.03, y: -0.02, z: 0.14, rx: Math.PI / 2 + 0.2, seg: 4 });
    }
    finalize(g); return { g, parts };
  }

  // ================= HUMANOIDES =================
  const t = D.n, w = Lk.w || 1, ogre = t === 'Ogro', big = D.hp > 500, chthon = D.hp > 1000, fur = big;
  const LEAN = { Soldado: 0.24, Cavaleiro: 0.12, Enforcer: 0.2, Ogro: 0.34, Shambler: 0.5, Chthon: 0.44 }[t] || 0.2; parts.lean = LEAN;
  body.scale.setScalar(0.88 * D.sc);
  const bm = mat(Lk.body), hm = mat(Lk.head), am = mat(Lk.arm || Lk.body), lm = mat(Lk.leg), hel = Lk.helm ? mat(Lk.helm) : null, sh = Lk.shoulder ? mat(Lk.shoulder) : null;
  const AL = big ? 1.5 : ogre ? 1.15 : 1.12, aw = big ? 1.8 : ogre ? 1.5 : 1, thick = big || ogre ? 1.35 : 1;
  ell(body, lm, 0.24 * w, 0.14, 0.17, { y: 0.92 });
  for (const sx of [-1, 1]) {
    const leg = grp(body, sx * 0.14 * w, 0.9, 0); parts.legs.push(leg);
    limb(leg, lm, 0.1 * thick, 0.07, 0.44, { bulge: 0.12, amp: fur ? 0.05 : 0.02 });
    const kn = grp(leg, 0, -0.44, 0); parts.knees.push(kn);
    limb(kn, lm, 0.07 * thick, 0.045, 0.42, { amp: 0.02 });
    ell(kn, dark, 0.075, 0.045, 0.17, { y: -0.46, z: 0.07 }); for (let i = -1; i <= 1; i++) cone(kn, bone, 0.012, 0.08, { x: i * 0.04, y: -0.46, z: 0.2, rx: Math.PI / 2, seg: 4 });
    if (sh && !big) { ell(leg, dsteel, 0.085, 0.06, 0.09, { y: -0.44, z: 0.06 }); cone(leg, dsteel, 0.03, 0.12, { y: -0.44, z: 0.14, rx: Math.PI / 2 }); }
  }
  const torso = parts.torso = grp(body, 0, 0.9, 0); torso.rotation.x = LEAN;
  ell(torso, bm, 0.3 * w, 0.31, 0.19 * (thick > 1 ? 1.25 : 1), { y: 0.42, amp: fur ? 0.28 : 0.12 });
  ell(torso, bm, 0.2 * w, 0.2, 0.15, { y: 0.1, amp: fur ? 0.2 : 0.1 });
  ell(torso, bm, 0.34 * w, 0.09, 0.12, { y: 0.7, amp: 0.1 });
  if (ogre) ell(torso, bm, 0.42 * w, 0.32, 0.38, { y: 0.12, z: 0.1, amp: 0.2 });
  for (let i = 0; i < 6; i++) cone(torso, bone, 0.03, 0.1 + (i % 2) * 0.03, { y: 0.66 - i * 0.1, z: -0.17 * (thick > 1 ? 1.3 : 1) - 0.01, rx: -1.7, seg: 4 }); // coluna exposta
  if (t === 'Soldado' || t === 'Enforcer') for (let i = 0; i < 3; i++) for (const sx of [-1, 1]) ell(torso, bone, 0.015, 0.1, 0.03, { x: sx * 0.28, y: 0.45 - i * 0.07, z: 0.08, rz: sx * 0.6, seg: 4, seg2: 3, amp: 0.02 }); // costelas
  const hz = 0.1;
  ell(torso, hm, 0.08, 0.13, 0.08, { y: 0.82, z: 0.05, rx: 0.6 });
  const head = parts.head = grp(torso, 0, 0.97, hz + 0.04);
  const hs = ogre ? 0.82 : big ? 0.78 : 1;
  ell(head, hm, 0.15 * hs, 0.19 * hs, 0.17 * hs, { y: 0.1, amp: 0.1 });
  ell(head, hm, 0.15 * hs, 0.04 * hs, 0.1 * hs, { y: 0.17 * hs, z: 0.11 * hs, tone: 0.8 });        // arcada
  ell(head, dark, 0.12 * hs, 0.045, 0.07 * hs, { y: 0.0, z: 0.1 * hs, tone: 0.6 });                  // bochechas fundas
  ell(head, dark, 0.07 * hs, 0.035, 0.1, { y: -0.02, z: 0.1 * hs });                                  // boca
  for (const sx of [-1, 1]) {
    ell(head, dark, 0.06 * hs, 0.045 * hs, 0.05, { x: sx * 0.065 * hs, y: 0.13, z: 0.12 * hs });
    ell(head, eyeM, 0.032 * hs, 0.022 * hs, 0.02, { x: sx * 0.065 * hs, y: 0.13, z: 0.145 * hs });
    ell(head, dark, 0.012, 0.025, 0.012, { x: sx * 0.025, y: 0.04, z: 0.17 * hs });
  }
  teeth(head, bone, -0.04, 0.12 * hs, 0.065 * hs, 7, 0.08, false);
  const jaw = parts.jaw = grp(head, 0, -0.03, 0.03);
  ell(jaw, hm, 0.1 * hs, 0.04 * hs, 0.12 * hs, { y: -0.05, z: 0.07 * hs, amp: 0.1 }); ell(jaw, tongue, 0.04, 0.012, 0.08, { y: -0.015, z: 0.08 * hs });
  teeth(jaw, bone, -0.015, 0.14 * hs, 0.06 * hs, 6, 0.07, true);

  // ===== peças específicas =====
  if (t === 'Soldado') {
    addPart(head, new THREE.SphereGeometry(1, 8, 5, 0, PI2, 0, Math.PI * 0.55), hel, { y: 0.17, sx: 0.2, sy: 0.19, sz: 0.215, amp: 0.1 });
    plate(head, hel, 0.44, 0.035, 0.3, { y: 0.11, z: 0.03 }); cone(head, hel, 0.035, 0.12, { y: 0.34, z: 0.0 });
    for (let i = 0; i < 3; i++) plate(torso, hel, 0.5 * w - i * 0.02, 0.1, 0.22, { y: 0.56 - i * 0.12, z: 0.05, rx: -0.12 + i * 0.05 }); // placas sobrepostas
    plate(torso, dark, 0.44, 0.06, 0.26, { y: 0.18 });
    for (const sx of [-1, 1]) { plate(torso, hel, 0.2, 0.05, 0.22, { x: sx * 0.39 * w, y: 0.76, rz: sx * -0.3 }); cone(torso, hel, 0.04, 0.2, { x: sx * 0.4 * w, y: 0.88, rz: sx * -0.3 }); }
    for (let i = 0; i < 3; i++) plate(body, mat(0x3a3020), 0.07, 0.38, 0.015, { x: -0.16 + i * 0.16, y: 0.65, z: 0.18 + (i % 2) * 0.03, rx: 0.1 }); // trapos
  } else if (t === 'Enforcer') {
    addPart(head, new THREE.SphereGeometry(1, 8, 5, 0, PI2, 0, Math.PI * 0.62), hel, { y: 0.12, sx: 0.19, sy: 0.23, sz: 0.2, amp: 0.06 });
    ell(head, eyeM, 0.14, 0.035, 0.04, { y: 0.14, z: 0.17 }); plate(head, dsteel, 0.04, 0.2, 0.28, { y: 0.28, z: -0.02 });
    plate(torso, hel, 0.5, 0.36, 0.26, { y: 0.42, z: 0.04, rx: -0.08 }); ell(torso, eyeM, 0.05, 0.05, 0.03, { y: 0.45, z: 0.18, seg: 6, amp: 0 });
    for (const sx of [-1, 1]) { plate(torso, sh, 0.28, 0.1, 0.3, { x: sx * 0.4 * w, y: 0.76, rz: sx * -0.35 }); cone(torso, sh, 0.045, 0.24, { x: sx * 0.46 * w, y: 0.9, rz: sx * -0.5 }); }
    for (const sx of [-1, 1]) limb(torso, dsteel, 0.025, 0.02, 0.5, { x: sx * 0.08, y: 0.95, z: -0.2, rx: 0.9, seg: 4 });
  } else if (t === 'Cavaleiro') {
    ell(head, hel, 0.19, 0.25, 0.21, { y: 0.12, amp: 0.05 }); plate(head, dark, 0.2, 0.025, 0.04, { y: 0.14, z: 0.2 }); plate(head, dark, 0.02, 0.14, 0.04, { y: 0.07, z: 0.205 });
    ell(head, eyeM, 0.07, 0.014, 0.01, { y: 0.14, z: 0.214, seg: 5 });
    for (const sx of [-1, 1]) { cone(head, sh, 0.045, 0.42, { x: sx * 0.2, y: 0.32, z: 0.0, rz: -sx * 0.9, rx: 0.1 }); cone(head, sh, 0.03, 0.22, { x: sx * 0.4, y: 0.52, z: 0.0, rz: sx * 0.2 }); }
    cone(head, sh, 0.025, 0.2, { y: 0.45, z: -0.05, rx: -0.3 });
    plate(torso, hel, 0.5, 0.4, 0.3, { y: 0.42, rx: -0.05 }); plate(torso, sh, 0.05, 0.4, 0.06, { y: 0.44, z: 0.16 }); plate(torso, hel, 0.34, 0.12, 0.26, { y: 0.08 });
    for (const sx of [-1, 1]) { plate(torso, sh, 0.3, 0.14, 0.3, { x: sx * 0.42 * w, y: 0.74, rz: sx * -0.4 }); for (let i = 0; i < 3; i++) cone(torso, sh, 0.045, 0.2, { x: sx * (0.42 + i * 0.07) * w, y: 0.92 - i * 0.05, rz: sx * -(0.5 + i * 0.35) }); }
    for (let i = 0; i < 4; i++) plate(torso, mat(0x2a0e0e), 0.14, 0.9 - (i % 2) * 0.18, 0.02, { x: -0.21 + i * 0.14, y: 0.15, z: -0.22, rx: 0.12 + (i % 2) * 0.05, rz: (i - 1.5) * 0.04 }); // capa esfarrapada
  } else if (ogre) {
    for (const sx of [-1, 1]) { cone(head, bone, 0.04, 0.2, { x: sx * 0.07, y: 0.02, z: 0.2 * hs, rx: -0.2 }); ell(torso, bm, 0.28, 0.16, 0.26, { x: sx * 0.52 * w, y: 0.76, amp: 0.25 }); }
    for (let i = 0; i < 7; i++) plate(torso, dark, 0.02, 0.2, 0.012, { x: -0.3 + i * 0.1, y: 0.1, z: 0.5, rx: -0.15 }); // costuras na barriga
    plate(torso, dark, 0.5, 0.06, 0.4, { y: 0.1, z: 0.1 }); for (let i = 0; i < 5; i++) cone(torso, bone, 0.03, 0.16, { x: -0.25 + i * 0.12, y: 0.78, z: -0.2, rx: -1.0 });
  } else if (big) {
    for (const sx of [-1, 1]) { cone(head, bone, 0.05 * (chthon ? 2 : 1), 0.36 * (chthon ? 1.7 : 1), { x: sx * 0.12, y: 0.3, z: 0, rz: -sx * 0.7, rx: 0.2 }); }
    for (let i = 0; i < (chthon ? 10 : 6); i++) cone(torso, chthon ? mat(0x3a0a06) : bone, 0.06, 0.34, { x: (i % 2 ? 1 : -1) * 0.12 * (i > 2), y: 0.78 - i * 0.07, z: -0.26, rx: -2.1 });
    if (chthon) for (let i = 0; i < 5; i++) plate(torso, eyeM, 0.01, 0.25, 0.01, { x: (i - 2) * 0.08, y: 0.42, z: 0.2, rz: (i - 2) * 0.3 });
  }
  // ===== braços e mãos com garras =====
  for (const sx of [-1, 1]) {
    ell(torso, am, 0.1 * aw, 0.1 * aw, 0.1 * aw, { x: sx * 0.38 * w, y: 0.66, amp: 0.2 });
    const arm = grp(torso, sx * 0.38 * w, 0.66, 0); parts.arms.push(arm);
    limb(arm, am, 0.07 * aw, 0.055 * aw, 0.36 * AL, { bulge: 0.3, amp: fur ? 0.1 : 0.04 });
    const fo = grp(arm, 0, -0.36 * AL, 0); fo.rotation.x = -0.35; parts.fore.push(fo);
    cone(fo, bone, 0.03 * aw, 0.12, { y: 0.0, z: -0.05, rx: -1.5, seg: 4 });
    limb(fo, am, 0.055 * aw, 0.04 * aw, 0.34 * AL, { bulge: 0.15, amp: fur ? 0.08 : 0.03 });
    const hy = -0.36 * AL, S = aw * (big ? 1.2 : 1);
    ell(fo, hm, 0.05 * S, 0.065 * S, 0.03 * S, { y: hy, seg: 6, seg2: 4 });
    for (let i = -1; i <= 2; i++) cone(fo, bone, 0.012 * S, (big ? 0.2 : 0.13) * S, { x: (i - 0.5) * 0.026 * S, y: hy - 0.1 * S, z: 0.02, rx: Math.PI + 0.2, seg: 4 });
    cone(fo, bone, 0.013 * S, 0.1 * S, { x: sx * 0.05 * S, y: hy - 0.02, z: 0.03, rz: sx * 0.9, rx: Math.PI, seg: 4 });
    if (t === 'Cavaleiro') { plate(fo, dsteel, 0.1, 0.3, 0.1, { y: -0.18 }); cone(fo, dsteel, 0.035, 0.14, { y: -0.05, z: 0.07, rx: Math.PI / 2 }); }
  }
  parts.hand = parts.fore[1];
  const hand = parts.hand, hy = -0.36 * AL - 0.04;
  if (t === 'Soldado') {
    lathe(hand, dsteel, [[0, -0.2], [0.03, -0.2], [0.03, 0.55], [0.038, 0.57], [0.038, 0.64], [0, 0.64]], { y: hy, z: 0.1, rx: Math.PI / 2, seg: 6 });
    lathe(hand, dark, [[0, 0], [0.024, 0], [0.024, 0.38], [0, 0.38]], { y: hy - 0.05, z: 0.15, rx: Math.PI / 2, seg: 6 });
    plate(hand, mat(0x4a2e1a), 0.07, 0.1, 0.34, { y: hy - 0.02, z: -0.18, rx: 0.15 }); plate(hand, dark, 0.08, 0.08, 0.2, { y: hy, z: 0.08 });
  } else if (t === 'Enforcer') {
    lathe(hand, dark, [[0, -0.1], [0.07, -0.1], [0.07, 0.35], [0.045, 0.4], [0.045, 0.75], [0.06, 0.78], [0, 0.78]], { y: hy, z: 0.12, rx: Math.PI / 2, seg: 7 });
    ell(hand, eyeM, 0.02, 0.02, 0.02, { y: hy + 0.06, z: 0.8, seg: 5 });
    for (let i = 0; i < 3; i++) plate(hand, dsteel, 0.1, 0.02, 0.05, { y: hy + 0.05, z: 0.15 + i * 0.1 });
  } else if (t === 'Cavaleiro') {
    cone(hand, steel, 0.075, 1.7, { y: hy, z: 1.0, rx: Math.PI / 2, sx: 1, sz: 0.2, seg: 4, ry: Math.PI / 4 });
    for (let i = 0; i < 6; i++) for (const sd of [-1, 1]) cone(hand, steel, 0.02, 0.1, { x: sd * 0.06, y: hy, z: 0.45 + i * 0.22, rz: -sd * 1.4 }); // serrilha
    plate(hand, dsteel, 0.34, 0.04, 0.05, { y: hy, z: 0.2, rz: 0.1 }); cone(hand, dsteel, 0.03, 0.18, { x: -0.18, y: hy, z: 0.2, rz: 1.6 }); cone(hand, dsteel, 0.03, 0.18, { x: 0.18, y: hy, z: 0.2, rz: -1.6 });
    lathe(hand, mat(0x2a1a10), [[0, -0.14], [0.03, -0.14], [0.03, 0.14], [0, 0.14]], { y: hy, z: 0.05, rx: Math.PI / 2, seg: 6 }); ell(hand, dsteel, 0.05, 0.05, 0.05, { y: hy, z: -0.1, seg: 6 });
  } else if (ogre) {
    ell(hand, dark, 0.14, 0.15, 0.3, { y: hy - 0.02, z: 0.15, amp: 0.08 });
    plate(hand, steel, 0.05, 0.1, 0.62, { y: hy - 0.02, z: 0.78 });
    for (let i = 0; i < 12; i++) { cone(hand, steel, 0.02, 0.08, { y: hy + 0.08, z: 0.5 + i * 0.075 }); cone(hand, steel, 0.02, 0.08, { y: hy - 0.12, z: 0.5 + i * 0.075, rx: Math.PI }); }
    const l = parts.fore[0]; lathe(l, mat(0x4a5238), [[0, -0.2], [0.075, -0.2], [0.075, 0.5], [0.1, 0.52], [0.1, 0.58], [0, 0.58]], { y: hy, z: 0.1, rx: Math.PI / 2, seg: 7 });
  }
  finalize(g); return { g, parts };
}
