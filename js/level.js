// Gerador de fases: salas, corredores, portas, chave, lava, segredos, tochas, geometria com luz pré-calculada
const CS = 4;                       // tamanho da célula (unidades)
const T_SOLID = 0, T_OPEN = 1, T_DOOR = 2, T_KEY = 3, T_SECRET = 4;

function buildLevel(def, dcount) {
  const th = THEMES[def.theme];
  const L = { def, th, group: new THREE.Group() };
  const rng = mulberry32(def.seed), R = () => rng(), RI = (a, b) => a + Math.floor(R() * (b - a + 1));
  const W = def.size, H = def.size;
  const T = new Uint8Array(W * H), FH = new Float32Array(W * H), CH = new Float32Array(W * H).fill(4.2);
  const ROOM = new Int16Array(W * H).fill(-1), COR = new Uint8Array(W * H), LAVA = new Uint8Array(W * H), PIL = new Uint8Array(W * H);
  Object.assign(L, { W, H, T, FH, CH, LAVA });
  const at = (x, z) => (x < 0 || z < 0 || x >= W || z >= H) ? 0 : T[z * W + x];

  // ---------- salas ----------
  const rooms = [];
  for (let tries = 0; rooms.length < def.rooms && tries < 800; tries++) {
    const w = RI(4, 9), h = RI(4, 9), x = RI(2, W - w - 3), z = RI(2, H - h - 3);
    if (rooms.some(r => x < r.x + r.w + 2 && x + w + 2 > r.x && z < r.z + r.h + 2 && z + h + 2 > r.z)) continue;
    rooms.push({ id: rooms.length, x, z, w, h, cx: x + (w >> 1), cz: z + (h >> 1), ch: 5 + R() * 3.5, conns: [] });
  }
  for (const r of rooms) for (let z = r.z; z < r.z + r.h; z++) for (let x = r.x; x < r.x + r.w; x++) {
    const i = z * W + x; T[i] = T_OPEN; CH[i] = r.ch; ROOM[i] = r.id;
  }
  const carve = (x, z) => { const i = z * W + x; if (T[i] === 0) { T[i] = T_OPEN; CH[i] = 4.2; } COR[i] = 1; };
  const corridor = (ax, az, bx, bz, hf) => {
    let x = ax, z = az; carve(x, z);
    const go = horiz => { if (horiz) { while (x !== bx) { x += Math.sign(bx - x); carve(x, z); } } else { while (z !== bz) { z += Math.sign(bz - z); carve(x, z); } } };
    go(hf); go(!hf);
  };
  const dist = (a, b) => Math.abs(a.cx - b.cx) + Math.abs(a.cz - b.cz);
  const link = (a, b) => { corridor(a.cx, a.cz, b.cx, b.cz, R() < 0.5); a.conns.push(b.id); b.conns.push(a.id); };
  for (let i = 1; i < rooms.length; i++) {
    let best = 0, bd = 1e9;
    for (let j = 0; j < i; j++) { const d = dist(rooms[i], rooms[j]); if (d < bd) { bd = d; best = j; } }
    link(rooms[i], rooms[best]);
  }
  for (let k = 0; k < def.loops; k++) {
    const a = rooms[RI(0, rooms.length - 1)], b = rooms[RI(0, rooms.length - 1)];
    if (a !== b && !a.conns.includes(b.id)) link(a, b);
  }
  // sala mais distante (BFS)
  const depth = new Array(rooms.length).fill(-1); depth[0] = 0;
  const q = [0];
  while (q.length) { const a = q.shift(); for (const b of rooms[a].conns) if (depth[b] < 0) { depth[b] = depth[a] + 1; q.push(b); } }
  let far = rooms[0];
  for (const r of rooms) if (depth[r.id] > depth[far.id]) far = r;

  // ---------- santuário (saída) trancado por porta de chave ----------
  let sanc = null;
  for (let t = 0; t < 800 && !sanc; t++) {
    const sx = RI(3, W - 6), sz = RI(3, H - 6); let ok = true;
    for (let z = sz - 2; z <= sz + 4 && ok; z++) for (let x = sx - 2; x <= sx + 4; x++) if (x < 1 || z < 1 || x >= W - 1 || z >= H - 1 || T[z * W + x] !== 0) { ok = false; break; }
    if (ok) sanc = { sx, sz };
  }
  if (sanc) {
    for (let z = 0; z < 3; z++) for (let x = 0; x < 3; x++) { const i = (sanc.sz + z) * W + sanc.sx + x; T[i] = T_OPEN; CH[i] = 6.5; ROOM[i] = -3; }
    const dx = far.cx - (sanc.sx + 1), dz = far.cz - (sanc.sz + 1);
    let ddx = 0, ddz = 0;
    if (Math.abs(dx) > Math.abs(dz)) ddx = Math.sign(dx) || 1; else ddz = Math.sign(dz) || 1;
    const dcx = sanc.sx + 1 + 2 * ddx, dcz = sanc.sz + 1 + 2 * ddz;
    T[dcz * W + dcx] = T_KEY; CH[dcz * W + dcx] = 4.2; COR[dcz * W + dcx] = 1;
    corridor(dcx + ddx, dcz + ddz, far.cx, far.cz, ddx !== 0);
    L.exit = { x: (sanc.sx + 1.5) * CS, z: (sanc.sz + 1.5) * CS, r: 1.5 };
    L.sanc = sanc;
  } else L.exit = { x: (far.cx + 0.5) * CS, z: (far.cz + 0.5) * CS, r: 1.5 };
  L.far = far;

  // ---------- portas comuns nas bocas dos corredores ----------
  for (let z = 1; z < H - 1; z++) for (let x = 1; x < W - 1; x++) {
    const i = z * W + x;
    if (!(COR[i] && ROOM[i] < 0 && T[i] === T_OPEN)) continue;
    if (R() > def.doorChance) continue;
    const ns = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dz] of ns) {
      const nr = ROOM[(z + dz) * W + x + dx];
      if (nr >= 0 && at(x - dx, z - dz) === T_OPEN && at(x + dz, z + dx) === 0 && at(x - dz, z - dx) === 0) {
        if (ns.some(([a, b]) => at(x + a, z + b) >= 2)) break;
        T[i] = T_DOOR; break;
      }
    }
  }

  // ---------- decoração das salas ----------
  for (const r of rooms) {
    if (r.id === 0) continue;
    if (r.w >= 7 && r.h >= 7 && R() < def.lava) {
      for (let z = r.z + 2; z <= r.z + r.h - 3; z++) for (let x = r.x + 2; x <= r.x + r.w - 3; x++) {
        const i = z * W + x; if (!COR[i]) { LAVA[i] = 1; FH[i] = -0.8; }
      }
      r.lava = true;
    } else if (r.w >= 6 && r.h >= 6 && R() < 0.7) {
      for (const [x, z] of [[r.x + 2, r.z + 2], [r.x + r.w - 3, r.z + 2], [r.x + 2, r.z + r.h - 3], [r.x + r.w - 3, r.z + r.h - 3]]) {
        const i = z * W + x; if (!COR[i]) { T[i] = T_SOLID; PIL[i] = 1; }
      }
    }
  }

  // ---------- segredos (armários atrás de paredes) ----------
  L.doors = []; L.doorMap = new Array(W * H); L.secrets = [];
  for (let k = 0, tries = 0; k < def.secrets && tries < 400; tries++) {
    const r = rooms[RI(1, rooms.length - 1)], side = RI(0, 3);
    let wx, wz, dx = 0, dz = 0;
    if (side === 0) { dx = 1; wx = r.x + r.w; wz = RI(r.z, r.z + r.h - 1); }
    else if (side === 1) { dx = -1; wx = r.x - 1; wz = RI(r.z, r.z + r.h - 1); }
    else if (side === 2) { dz = 1; wz = r.z + r.h; wx = RI(r.x, r.x + r.w - 1); }
    else { dz = -1; wz = r.z - 1; wx = RI(r.x, r.x + r.w - 1); }
    const cx = wx + dx, cz = wz + dz; let ok = true;
    for (let z = cz - 1; z <= cz + 1 && ok; z++) for (let x = cx - 1; x <= cx + 1; x++) if (x < 1 || z < 1 || x >= W - 1 || z >= H - 1 || T[z * W + x] !== 0) { ok = false; break; }
    const inner = (wz - dz) * W + wx - dx;
    if (!ok || T[wz * W + wx] !== 0 || T[inner] !== T_OPEN || LAVA[inner]) continue;
    T[wz * W + wx] = T_SECRET; T[cz * W + cx] = T_OPEN; CH[cz * W + cx] = 4.2; ROOM[cz * W + cx] = -2;
    L.secrets.push({ cx, cz, wx, wz }); k++;
  }

  // ---------- portas (objetos) ----------
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const i = z * W + x, t = T[i];
    if (t < T_DOOR) continue;
    const d = { i, cx: x, cz: z, type: t, open: 0, opened: false, x: (x + 0.5) * CS, z: (z + 0.5) * CS, snd: false, msgT: 0 };
    d.axis = (t === T_SECRET) ? 'full' : (at(x - 1, z) !== 0 && at(x + 1, z) !== 0 ? 'x' : 'z');
    L.doors.push(d); L.doorMap[i] = d;
  }

  // ---------- consultas de colisão ----------
  const idx = (cx, cz) => cz * W + cx;
  L.solid = (cx, cz) => {
    if (cx < 0 || cz < 0 || cx >= W || cz >= H) return true;
    const i = idx(cx, cz), t = T[i];
    if (t === 0) return true;
    if (t >= 2) return L.doorMap[i].open < 0.55;
    return false;
  };
  L.solidW = (x, z) => L.solid(Math.floor(x / CS), Math.floor(z / CS));
  L.cell = (x, z) => { const cx = Math.floor(x / CS), cz = Math.floor(z / CS); return (cx < 0 || cz < 0 || cx >= W || cz >= H) ? -1 : idx(cx, cz); };
  L.floorAt = (x, z) => { const i = L.cell(x, z); return i < 0 ? 0 : FH[i]; };
  L.ceilAt = (x, z) => { const i = L.cell(x, z); return i < 0 ? 4 : CH[i]; };
  L.lavaW = (x, z) => { const i = L.cell(x, z); return i >= 0 && LAVA[i] === 1; };
  L.los = (x0, z0, x1, z1) => {
    const dx = x1 - x0, dz = z1 - z0, d = Math.hypot(dx, dz), n = Math.ceil(d / 0.6);
    for (let s = 1; s < n; s++) { const t = s / n; if (L.solidW(x0 + dx * t, z0 + dz * t)) return false; }
    return true;
  };
  // raio contra o mundo: retorna {d, nx, ny, nz}
  L.rayWall = (ox, oy, oz, dx, dy, dz, max) => {
    const st = 0.15; let px = ox, py = oy, pz = oz;
    for (let d = st; d <= max; d += st) {
      const x = ox + dx * d, y = oy + dy * d, z = oz + dz * d;
      let hit = null;
      const i = L.cell(x, z);
      if (i < 0 || L.solidW(x, z)) {
        const xs = L.solidW(x, pz), zs = L.solidW(px, z);
        hit = { d, nx: xs ? -Math.sign(dx) : 0, ny: 0, nz: (!xs && (zs || true)) ? -Math.sign(dz) : 0 };
        if (xs && zs) { hit.nx = -Math.sign(dx); hit.nz = -Math.sign(dz); }
      } else if (y < FH[i]) hit = { d, nx: 0, ny: 1, nz: 0 };
      else if (y > CH[i]) hit = { d, nx: 0, ny: -1, nz: 0 };
      if (hit) return hit;
      px = x; pz = z;
    }
    return { d: max, nx: 0, ny: 0, nz: 0, none: true };
  };
  // campo de fluxo (BFS a partir do jogador) para navegação dos monstros
  L.flow = new Int16Array(W * H).fill(-1);
  const pass = i => { const t = T[i]; if (t === 0 || LAVA[i]) return false; if (t === 1) return true; return L.doorMap[i].type === T_DOOR || L.doorMap[i].open > 0.5; };
  L.passable = pass;
  L.computeFlow = (x, z) => {
    const f = L.flow; f.fill(-1);
    const s = L.cell(x, z); if (s < 0) return;
    const qu = [s]; f[s] = 0;
    for (let h = 0; h < qu.length; h++) {
      const i = qu[h], cx = i % W, cz = (i / W) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, nz = cz + dz; if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
        const j = idx(nx, nz); if (f[j] >= 0 || !pass(j)) continue;
        f[j] = f[i] + 1; qu.push(j);
      }
    }
  };

  // ---------- tochas e luzes ----------
  const torches = [], lights = [];
  const addTorch = (cx, cz, dx, dz, force) => {
    const i = idx(cx, cz), x = (cx + 0.5) * CS + dx * (CS / 2 - 0.2), z = (cz + 0.5) * CS + dz * (CS / 2 - 0.2);
    const y = Math.min(2.7, CH[i] - 1.3);
    if (!force && torches.some(t => (t.x - x) ** 2 + (t.z - z) ** 2 < 14)) return false;
    torches.push({ x, y, z, dx, dz });
    lights.push({ x: x - dx * 0.3, y, z: z - dz * 0.3, r: th.torch[0], g: th.torch[1], b: th.torch[2], rad: 15, i: 1.4, fl: true });
    return true;
  };
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const i = idx(x, z); if (T[i] !== T_OPEN || LAVA[i]) continue;
    const p = ROOM[i] >= 0 ? 0.10 : 0.045;
    for (const [dx, dz] of DIRS) if (at(x + dx, z + dz) === 0 && R() < p) addTorch(x, z, dx, dz);
  }
  for (const r of rooms) { // garantir ao menos 2 tochas por sala
    const inRoom = () => torches.filter(t => t.x > r.x * CS && t.x < (r.x + r.w) * CS && t.z > r.z * CS && t.z < (r.z + r.h) * CS).length;
    for (let k = 0; k < 12 && inRoom() < 2; k++) {
      const [dx, dz] = DIRS[RI(0, 3)];
      const x = RI(r.x, r.x + r.w - 1), z = RI(r.z, r.z + r.h - 1);
      if (T[idx(x, z)] === T_OPEN && at(x + dx, z + dz) === 0) addTorch(x, z, dx, dz, k > 8);
    }
  }
  if (sanc) { // tochas dentro do santuário
    addTorch(sanc.sx, sanc.sz + 1, -1, 0, true); addTorch(sanc.sx + 2, sanc.sz + 1, 1, 0, true);
    addTorch(sanc.sx + 1, sanc.sz, 0, -1, true); addTorch(sanc.sx + 1, sanc.sz + 2, 0, 1, true);
  }
  for (const s of L.secrets) lights.push({ x: (s.cx + 0.5) * CS, y: 2, z: (s.cz + 0.5) * CS, r: 0.6, g: 0.9, b: 1, rad: 7, i: 1.0 });
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (LAVA[idx(x, z)] && (x + z) % 2 === 0)
    lights.push({ x: (x + 0.5) * CS, y: 0.8, z: (z + 0.5) * CS, r: 1, g: 0.36, b: 0.08, rad: 9, i: 1.3 });
  lights.push({ x: L.exit.x, y: 1.6, z: L.exit.z, r: 0.45, g: 0.55, b: 1.3, rad: 13, i: 1.7 });
  L.lights = lights; L.torches = torches;

  const bakeLos = (x0, z0, x1, z1) => {
    const dx = x1 - x0, dz = z1 - z0, n = Math.ceil(Math.hypot(dx, dz) / 0.5);
    for (let s = 1; s < n; s++) { const t = s / n; if (at(Math.floor((x0 + dx * t) / CS), Math.floor((z0 + dz * t) / CS)) === 0) return false; }
    return true;
  };
  const bake = (x, y, z, nx, ny, nz, kind, noLos) => {
    if (kind === 'lava') return [1, 0.82, 0.62];
    let r = th.amb, g = th.amb, b = th.amb * 1.06;
    for (const l of lights) {
      const dx = l.x - x, dy = l.y - y, dz = l.z - z, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > l.rad * l.rad) continue;
      const d = Math.sqrt(d2) || 0.001, dot = (nx * dx + ny * dy + nz * dz) / d;
      if (dot < -0.05 && d > 0.5) continue;
      if (d > 0.8 && !noLos && !bakeLos(x + nx * 0.2, z + nz * 0.2, l.x, l.z)) continue;
      let a = 1 - d / l.rad; a *= a;
      const k = a * (Math.max(0, dot) * 0.7 + 0.3) * l.i;
      r += l.r * k; g += l.g * k; b += l.b * k;
    }
    let m = 1;
    if (kind === 'ceil') m = 0.62; else if (kind === 'floor') m = 0.88; else m = 0.8 + 0.2 * clamp(y / 3, 0, 1);
    return [Math.min(r * m, 1.6), Math.min(g * m, 1.6), Math.min(b * m, 1.6)];
  };
  L.lightAt = (x, y, z) => {
    let r = th.amb * 1.3, g = r, b = r;
    for (const l of lights) {
      const dx = l.x - x, dz = l.z - z, dy = l.y - y, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > l.rad * l.rad) continue;
      let a = 1 - Math.sqrt(d2) / l.rad; a *= a; a *= l.i * 0.9;
      r += l.r * a; g += l.g * a; b += l.b * a;
    }
    return [clamp(r, 0.4, 1.3), clamp(g, 0.4, 1.3), clamp(b, 0.4, 1.3)];
  };

  // ---------- geometria ----------
  const mk = () => ({ p: [], n: [], u: [], c: [], i: [] });
  const GB = { wall: mk(), floor: mk(), ceil: mk(), lava: mk() };
  const ceilDisp = (px, pz, ch) => {
    const a = px / CS, b = pz / CS;
    for (let cz = Math.floor(b - 1e-4); cz <= Math.floor(b + 1e-4); cz++) for (let cx = Math.floor(a - 1e-4); cx <= Math.floor(a + 1e-4); cx++) {
      if (at(cx, cz) !== T_OPEN || Math.abs(CH[idx(cx, cz)] - ch) > 0.01) return 0;
    }
    return -Math.max(0, n3(px * 0.38, 3.3, pz * 0.38) - 0.3) * 1.3;
  };
  const quad = (kind, ox, oy, oz, ax, ay, az, bx, by, bz, nx, ny, nz) => {
    const g = GB[kind], la = Math.hypot(ax, ay, az), lb = Math.hypot(bx, by, bz);
    const na = Math.max(1, Math.ceil(la - 1e-3)), nb = Math.max(1, Math.ceil(lb - 1e-3));
    const base = g.p.length / 3;
    for (let j = 0; j <= nb; j++) for (let i = 0; i <= na; i++) {
      const px = ox + ax * i / na + bx * j / nb, pz = oz + az * i / na + bz * j / nb;
      let py = oy + ay * i / na + by * j / nb;
      if (kind === 'ceil') py += ceilDisp(px, pz, oy);
      g.p.push(px, py, pz); g.n.push(nx, ny, nz);
      if (ny !== 0) g.u.push(px / 2, pz / 2); else g.u.push((px * Math.abs(nz) + pz * Math.abs(nx)) / 2, py / 2);
      g.c.push(...bake(px, py, pz, nx, ny, nz, kind));
    }
    const cr = (ay * bz - az * by) * nx + (az * bx - ax * bz) * ny + (ax * by - ay * bx) * nz;
    for (let j = 0; j < nb; j++) for (let i = 0; i < na; i++) {
      const a = base + j * (na + 1) + i, b = a + 1, c = a + na + 1, d = c + 1;
      if (cr > 0) g.i.push(a, b, d, a, d, c); else g.i.push(a, d, b, a, c, d);
    }
  };
  const wallFace = (cx, cz, dx, dz, y0, y1) => {
    if (y1 - y0 < 0.01) return;
    const x0 = cx * CS, z0 = cz * CS;
    if (dx !== 0) quad('wall', dx > 0 ? x0 + CS : x0, y0, z0, 0, 0, CS, 0, y1 - y0, 0, -dx, 0, 0);
    else quad('wall', x0, y0, dz > 0 ? z0 + CS : z0, CS, 0, 0, 0, y1 - y0, 0, 0, 0, -dz);
  };
  // rodapé e cornija (molduras) ao longo das paredes
  const strip = (dx, dz, yA, oA, yB, oB, nxn, nyn, nzn, cx, cz) => {
    const x0 = cx * CS, z0 = cz * CS, nx = -dx, nz = -dz;
    if (dx !== 0) quad('wall', (dx > 0 ? x0 + CS : x0) + nx * oA, yA, z0, 0, 0, CS, nx * (oB - oA), yB - yA, 0, nxn, nyn, nzn);
    else quad('wall', x0, yA, (dz > 0 ? z0 + CS : z0) + nz * oA, CS, 0, 0, 0, yB - yA, nz * (oB - oA), nxn, nyn, nzn);
  };
  const trim = (cx, cz, dx, dz, y0, y1) => {
    if (y1 - y0 < 3) return; const nx = -dx, nz = -dz;
    strip(dx, dz, y0, 0.14, y0 + 0.42, 0.14, nx, 0, nz, cx, cz);
    strip(dx, dz, y0 + 0.42, 0.14, y0 + 0.56, 0, nx * 0.7, 0.7, nz * 0.7, cx, cz);
    strip(dx, dz, y1 - 0.6, 0, y1 - 0.44, 0.18, nx * 0.7, -0.7, nz * 0.7, cx, cz);
    strip(dx, dz, y1 - 0.44, 0.18, y1, 0.18, nx, 0, nz, cx, cz);
  };
  for (let cz = 0; cz < H; cz++) for (let cx = 0; cx < W; cx++) {
    const i = idx(cx, cz); if (T[i] === 0 && !PIL[i]) continue;
    const x0 = cx * CS, z0 = cz * CS;
    quad(LAVA[i] ? 'lava' : 'floor', x0, FH[i], z0, CS, 0, 0, 0, 0, CS, 0, 1, 0);
    quad('ceil', x0, CH[i], z0, CS, 0, 0, 0, 0, CS, 0, -1, 0);
    if (PIL[i]) continue;
    for (const [dx, dz] of DIRS) {
      const nt = at(cx + dx, cz + dz);
      if (nt === 0 && PIL[idx(cx + dx, cz + dz)]) continue;
      if (nt === 0) { wallFace(cx, cz, dx, dz, FH[i], CH[i]); if (!LAVA[i]) trim(cx, cz, dx, dz, FH[i], CH[i]); }
      else {
        const j = idx(cx + dx, cz + dz);
        if (FH[j] > FH[i]) wallFace(cx, cz, dx, dz, FH[i], FH[j]);
        if (CH[i] > CH[j]) wallFace(cx, cz, dx, dz, CH[j], CH[i]);
      }
    }
  }

  // ---------- texturas e malhas ----------
  const sd = def.seed;
  L.tex = {
    wall: genSurface(th.wall.kind, th.wall, sd + 1, 512),
    floor: genSurface(th.floor.kind, th.floor, sd + 2, 512),
    ceil: genSurface(th.ceil.kind, th.ceil, sd + 3, 256),
    lava: genSurface('lava', {}, sd + 4, 256),
    door: genSurface('metal', { c1: [96, 90, 80], c2: [50, 48, 44], rust: 0.8 }, sd + 5, 256),
  };
  const mkMesh = (kind) => {
    const g = GB[kind]; if (!g.p.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.n, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.u, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(g.c, 3));
    geo.setIndex(g.i);
    const tx = L.tex[kind];
    const mat = kind === 'lava'
      ? new THREE.MeshBasicMaterial({ map: tx.map, vertexColors: true })
      : new THREE.MeshLambertMaterial({ map: tx.map, bumpMap: tx.bump, bumpScale: 2.5, vertexColors: true });
    const m = new THREE.Mesh(geo, mat); L.group.add(m);
  };
  ['wall', 'floor', 'ceil', 'lava'].forEach(mkMesh);

  // pilares cilíndricos (base, fuste, capitel)
  const pilTex = L.tex.wall.map.clone(); pilTex.needsUpdate = true; pilTex.repeat.set(5, 3); pilTex.wrapS = pilTex.wrapT = THREE.RepeatWrapping;
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) {
    const i = idx(x, z); if (!PIL[i]) continue; const ch = CH[i];
    const pts = [[0, 0], [2.06, 0], [2.06, 0.2], [1.82, 0.34], [1.82, 0.62], [1.62, 0.78], [1.52, 1.0], [1.46, ch * 0.5], [1.52, ch - 1.15], [1.64, ch - 0.95], [1.78, ch - 0.75], [1.8, ch - 0.6], [2.0, ch - 0.5], [2.0, ch - 0.22], [2.1, ch - 0.22], [2.1, ch], [0, ch]];
    const geo = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), 28);
    const pp = geo.attributes.position, nn = geo.attributes.normal, cc = [], cxw = (x + 0.5) * CS, czw = (z + 0.5) * CS;
    for (let k = 0; k < pp.count; k++) { const c = bake(pp.getX(k) + cxw, pp.getY(k), pp.getZ(k) + czw, nn.getX(k), nn.getY(k), nn.getZ(k), 'wall', true); cc.push(c[0], c[1], c[2]); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3)); geo.translate(cxw, FH[i], czw);
    L.group.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: pilTex, vertexColors: true })));
  }
  // portas em arco com moldura de pedra
  const HW = 1.5, HS = 2.5, archShape = (sh) => { sh.moveTo(-HW, 0); sh.lineTo(-HW, HS); sh.absarc(0, HS, HW, Math.PI, 0, true); sh.lineTo(HW, 0); sh.closePath(); return sh; };
  const frameTex = L.tex.wall.map.clone(); frameTex.needsUpdate = true; frameTex.repeat.set(0.5, 0.5); frameTex.wrapS = frameTex.wrapT = THREE.RepeatWrapping;
  const slabTex = L.tex.door.map.clone(); slabTex.needsUpdate = true; slabTex.repeat.set(0.5, 0.5); slabTex.wrapS = slabTex.wrapT = THREE.RepeatWrapping;
  for (const d of L.doors) {
    const ch = CH[d.i], lc = L.lightAt(d.x, 1.5, d.z);
    let col = new THREE.Color(lc[0], lc[1], lc[2]);
    if (d.axis === 'full') {
      const map = L.tex.wall.map.clone(); map.needsUpdate = true; map.repeat.set(2, ch / 2);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(CS, ch, CS), new THREE.MeshLambertMaterial({ map, color: col }));
      d.baseY = FH[d.i] + ch / 2; d.ch = ch; mesh.position.set(d.x, d.baseY, d.z); d.mesh = mesh; L.group.add(mesh); continue;
    }
    // moldura
    const fs = new THREE.Shape(); fs.moveTo(-CS / 2, 0); fs.lineTo(CS / 2, 0); fs.lineTo(CS / 2, ch); fs.lineTo(-CS / 2, ch); fs.closePath(); fs.holes.push(archShape(new THREE.Path()));
    const fg = new THREE.ExtrudeGeometry(fs, { depth: 0.7, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 20 }); fg.translate(0, 0, -0.35);
    const frame = new THREE.Mesh(fg, new THREE.MeshLambertMaterial({ map: frameTex, color: col }));
    frame.position.set(d.x, FH[d.i], d.z); if (d.axis === 'x') frame.rotation.y = Math.PI / 2; L.group.add(frame);
    // folha da porta
    const sg = new THREE.ExtrudeGeometry(archShape(new THREE.Shape()), { depth: 0.28, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 20 }); sg.translate(0, 0, -0.14);
    const dc = col.clone(); if (d.type === T_KEY) dc.multiply(new THREE.Color(def.key === 'gold' ? 0xffc83c : 0x9fb8ff)).multiplyScalar(1.5);
    const holder = new THREE.Group(); const slab = new THREE.Mesh(sg, new THREE.MeshLambertMaterial({ map: slabTex, color: dc }));
    holder.add(slab); if (d.axis === 'x') slab.rotation.y = Math.PI / 2;
    d.baseY = FH[d.i]; d.ch = ch; holder.position.set(d.x, d.baseY, d.z); d.mesh = holder; L.group.add(holder);
  }

  // tochas (visual)
  const flameMat = new THREE.SpriteMaterial({ map: flameTex(), color: new THREE.Color(th.torch[0], th.torch[1], th.torch[2]).lerp(new THREE.Color(1, 1, 1), 0.15), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const haloMat = new THREE.SpriteMaterial({ map: radialTex([[0, 'rgba(255,255,255,0.5)'], [0.4, 'rgba(255,255,255,0.12)'], [1, 'rgba(255,255,255,0)']]), color: new THREE.Color(th.torch[0], th.torch[1], th.torch[2]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const cupPts = [[0, 0], [0.05, 0], [0.06, 0.07], [0.12, 0.2], [0.15, 0.3], [0.12, 0.3], [0.09, 0.18], [0.04, 0.1], [0, 0.1]];
  const brGeo = new THREE.LatheGeometry(cupPts.map(p => new THREE.Vector2(p[0], p[1])), 14), brMat = new THREE.MeshLambertMaterial({ color: 0x3a2a1c });
  const armGeo = new THREE.CylinderGeometry(0.03, 0.045, 0.34, 8);
  L.flames = [];
  for (const t of torches) {
    const b = new THREE.Mesh(brGeo, brMat); b.position.set(t.x - t.dx * 0.17, t.y - 0.1, t.z - t.dz * 0.17); L.group.add(b);
    const ar = new THREE.Mesh(armGeo, brMat); ar.position.set(t.x + t.dx * 0.02, t.y - 0.1, t.z + t.dz * 0.02); ar.rotation.set(t.dz ? Math.PI / 2 : 0, 0, t.dx ? Math.PI / 2 : 0); L.group.add(ar);
    const f = new THREE.Sprite(flameMat); f.position.set(t.x - t.dx * 0.1, t.y + 0.42, t.z - t.dz * 0.1); f.scale.set(0.5, 0.9, 1); L.group.add(f);
    const h = new THREE.Sprite(haloMat); h.position.copy(f.position); h.scale.set(3, 3, 1); L.group.add(h);
    L.flames.push({ f, h, ph: Math.random() * 10 });
  }

  // portal de saída
  const portal = new THREE.Group(); portal.position.set(L.exit.x, 1.2, L.exit.z);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x6f8cff, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.9, depthWrite: false });
  const r1 = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.06, 8, 40), ringMat), r2 = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.04, 8, 40), ringMat);
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex([[0, 'rgba(220,230,255,1)'], [0.35, 'rgba(110,140,255,0.6)'], [1, 'rgba(60,80,255,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  core.scale.set(3.2, 3.2, 1); portal.add(r1, r2, core); L.group.add(portal);
  L.portal = { g: portal, r1, r2, core, mat: ringMat };

  // ---------- spawns (monstros e itens) ----------
  const freeCells = r => { const a = []; for (let z = r.z; z < r.z + r.h; z++) for (let x = r.x; x < r.x + r.w; x++) { const i = idx(x, z); if (T[i] === T_OPEN && !LAVA[i]) a.push([x, z]); } return a; };
  const sp = rooms[0]; L.start = { x: (sp.cx + 0.5) * CS, z: (sp.cz + 0.5) * CS, yaw: 0 };
  if (sp.conns.length) { const o = rooms[sp.conns[0]]; L.start.yaw = Math.atan2(-(o.cx - sp.cx), -(o.cz - sp.cz)); }
  L.spawns = []; L.items = [];
  const wt = Object.entries(def.mons).filter(e => e[1] > 0), wsum = wt.reduce((a, e) => a + e[1], 0);
  const pickType = () => { let r = R() * wsum; for (const [k, w] of wt) { if ((r -= w) <= 0) return k; } return wt[0][0]; };
  const jit = () => (R() - 0.5) * 1.6;
  const farFromStart = (x, z) => Math.hypot(x - L.start.x, z - L.start.z) > 12;
  for (const r of rooms) {
    if (r.id === 0) continue;
    const cells = freeCells(r); if (!cells.length) continue;
    let n = Math.max(1, Math.round(r.w * r.h / def.density * dcount));
    if (r === far) n += 1;
    for (let k = 0; k < n; k++) {
      const [x, z] = cells[RI(0, cells.length - 1)], px = (x + 0.5) * CS + jit(), pz = (z + 0.5) * CS + jit();
      if (farFromStart(px, pz)) L.spawns.push({ type: pickType(), x: px, z: pz });
    }
  }
  // corredores
  for (let k = 0; k < def.corMons; k++) {
    const x = RI(1, W - 2), z = RI(1, H - 2), i = idx(x, z);
    if (T[i] === T_OPEN && COR[i] && ROOM[i] < 0 && farFromStart((x + 0.5) * CS, (z + 0.5) * CS)) L.spawns.push({ type: pickType(), x: (x + 0.5) * CS, z: (z + 0.5) * CS });
  }
  if (def.boss) {
    L.spawns.push({ type: 'chthon', x: (far.cx + 0.5) * CS, z: (far.cz + 0.5) * CS, boss: true });
    L.bossAlive = true;
  }
  const item = (type, x, z) => L.items.push({ type, x, z });
  const cellPos = r => { const c = freeCells(r); if (!c.length) return null; const [x, z] = c[RI(0, c.length - 1)]; return [(x + 0.5) * CS + jit() * 0.6, (z + 0.5) * CS + jit() * 0.6]; };
  { const p = cellPos(sp); if (p) { item('hp25', ...p); } const p2 = cellPos(sp); if (p2) item('shells', ...p2); }
  for (const r of rooms) {
    if (r.id === 0) continue;
    let p;
    if (R() < 0.5 && (p = cellPos(r))) item(R() < 0.7 ? 'hp25' : 'hp10', ...p);
    if (R() < 0.65 && (p = cellPos(r))) item(pick(def.ammo), ...p);
    if (R() < def.armorChance && (p = cellPos(r))) item(def.armors[RI(0, def.armors.length - 1)], ...p);
  }
  const otherRooms = rooms.filter(r => r.id !== 0);
  const shuffled = otherRooms.slice().sort(() => R() - 0.5);
  (def.weapons || []).forEach((w, k) => { const p = cellPos(shuffled[k % shuffled.length]); if (p) item('w' + w, ...p); });
  if (sanc) { const p = cellPos(shuffled[(def.weapons || []).length % shuffled.length]); if (p) item('key' + def.key, ...p); }
  if (def.quad) { const p = cellPos(shuffled[shuffled.length - 1]); if (p) item('quad', ...p); }
  if (def.pent) { const p = cellPos(far); if (p) item('pent', ...p); }
  if (def.life) { const p = cellPos(shuffled[shuffled.length - 2] || shuffled[0]); if (p) item('life', ...p); }
  for (const s of L.secrets) {
    const x = (s.cx + 0.5) * CS, z = (s.cz + 0.5) * CS;
    item(pick(['armY', 'armR', 'hp25', 'quad']) === 'quad' ? 'armY' : pick(['armY', 'armR']), x - 0.7, z); item('hp25', x + 0.7, z); item(pick(def.ammo), x, z + 0.8);
  }
  L.totalSecrets = L.secrets.length;

  // ---------- atualização ----------
  L.say = () => {};
  L.updateDoors = (dt, actors, P) => {
    for (const d of L.doors) {
      let want = false;
      const pd = Math.hypot(P.x - d.x, P.z - d.z);
      if (d.type === T_DOOR) { for (const a of actors) if ((a.x - d.x) ** 2 + (a.z - d.z) ** 2 < 11) { want = true; break; } if (!P.dead && pd < 3.3) want = true; }
      else if (d.type === T_KEY) {
        if (!d.opened && pd < 3.4) {
          if (P.keys[def.key]) { d.opened = true; L.say('Você destrancou a porta.'); }
          else if (d.msgT <= 0) { d.msgT = 2.5; L.say(def.key === 'gold' ? 'Você precisa da chave de ouro.' : 'Você precisa da chave de prata.'); SND.noKey(); }
        }
        d.msgT -= dt; want = d.opened;
      } else want = d.opened;
      const o = d.open;
      d.open = clamp(o + (want ? dt / 0.9 : -dt / 1.3), 0, 1);
      if (want && d.open < 1 && !d.snd) { d.snd = true; SND.door({ x: d.x, y: 1.5, z: d.z }); }
      if (!want && d.open === 0) d.snd = false;
      if (d.axis === 'full') d.mesh.position.y = d.baseY - d.open * (d.ch + 0.1);
      else d.mesh.position.y = d.baseY + d.open * (d.ch + 0.1);
    }
  };
  L.update = (t, active) => {
    L.tex.lava.map.offset.set(t * 0.012, t * 0.008);
    for (const f of L.flames) {
      const k = 0.85 + 0.25 * Math.sin(t * 13 + f.ph) * Math.sin(t * 7.3 + f.ph * 2);
      f.f.scale.set(0.45 * k, 0.9 * k + 0.1, 1); f.h.scale.set(3 * k, 3 * k, 1);
    }
    const p = L.portal; const on = active ? 1 : 0.25;
    p.r1.rotation.y = t * 1.4; p.r1.rotation.x = Math.sin(t) * 0.3; p.r2.rotation.x = t * 1.9; p.r2.rotation.z = t * 0.7;
    p.mat.opacity = 0.9 * on; p.core.material.opacity = (0.75 + 0.25 * Math.sin(t * 5)) * on; p.core.scale.setScalar(3.2 * (0.9 + 0.1 * Math.sin(t * 3)));
    p.g.position.y = 1.2 + Math.sin(t * 2) * 0.1;
  };
  L.dispose = () => { L.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); };
  L.rooms = rooms;
  return L;
}
