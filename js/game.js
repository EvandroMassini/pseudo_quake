// Loop principal, jogador, HUD, menus, fases
const DIFFS = [
  { name: 'Fácil', dmg: 0.6, hp: 0.8, count: 0.7, spd: 0.9, cd: 0.8 },
  { name: 'Normal', dmg: 1, hp: 1, count: 1, spd: 1, cd: 1 },
  { name: 'Difícil', dmg: 1.3, hp: 1.2, count: 1.4, spd: 1.1, cd: 1.2 },
  { name: 'Pesadelo', dmg: 1.7, hp: 1.5, count: 1.8, spd: 1.3, cd: 1.6 },
];
const LEVELS = [
  { name: 'O Complexo Slipgate', sub: 'Os portões do inferno se abriram...', seed: 1337, size: 34, rooms: 8, loops: 2, doorChance: 0.6, lava: 0.1, secrets: 2, theme: 0, density: 28,
    mons: { grunt: 6, dog: 3, knight: 1 }, corMons: 2, weapons: [2, 3], ammo: ['shells', 'shells', 'nails'], armors: ['armG'], armorChance: 0.12, key: 'silver', life: true },
  { name: 'Castelo dos Condenados', sub: 'Muralhas banhadas em sangue antigo.', seed: 4242, size: 38, rooms: 10, loops: 3, doorChance: 0.6, lava: 0.25, secrets: 3, theme: 1, density: 22,
    mons: { grunt: 3, dog: 3, knight: 4, enforcer: 2, ogre: 1 }, corMons: 3, weapons: [4], ammo: ['shells', 'nails', 'rockets'], armors: ['armG', 'armY'], armorChance: 0.18, key: 'gold', quad: true, life: true },
  { name: 'A Necrópole', sub: 'Aqui, os mortos não descansam.', seed: 777, size: 42, rooms: 12, loops: 3, doorChance: 0.55, lava: 0.2, secrets: 3, theme: 2, density: 17,
    mons: { grunt: 2, dog: 2, knight: 3, enforcer: 4, ogre: 3, shambler: 0.6 }, corMons: 5, weapons: [5], ammo: ['shells', 'nails', 'rockets', 'rockets'], armors: ['armY', 'armR'], armorChance: 0.22, key: 'silver', quad: true, life: true },
  { name: 'Covil de Chthon', sub: 'O fim de tudo. Mate o mestre das trevas.', seed: 666, size: 46, rooms: 14, loops: 4, doorChance: 0.5, lava: 0.5, secrets: 4, theme: 3, density: 14,
    mons: { grunt: 1, dog: 2, knight: 3, enforcer: 4, ogre: 4, shambler: 1.5 }, corMons: 6, weapons: [], ammo: ['shells', 'nails', 'rockets', 'rockets', 'rockets'], armors: ['armY', 'armR'], armorChance: 0.3, key: 'gold', pent: true, life: true, boss: true },
];

const G = { state: 'menu', diff: DIFFS[1], levelIdx: 0, lives: 3, kills: 0, totalKills: 0, secrets: 0, noiseT: 0, shake: 0, time: 0, sens: 1, fov: 78, mouseDown: false, flashA: 0, flashC: '#fff', hurtT: 0, snap: null, invert: false, deadShown: false };
let LV = null, P = null, MG, PRG, PKG, scene, camera, renderer;
const monsters = [], projs = [], pickups = [], keys = {};
const $ = id => document.getElementById(id);

function newPlayer() {
  return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, hp: 100, armor: 0, absorb: 0, ammo: { shells: 25, nails: 0, rockets: 0 }, weapons: [true, true, false, false, false, false],
    keys: { gold: false, silver: false }, quad: 0, pent: 0, dead: false, onGround: true, kickP: 0, roll: 0, stepT: 0, deadT: 0, lavaT: 0, bobT: 0, cur: 1 };
}

// ---------- mensagens / efeitos de tela ----------
function say(msg) {
  const d = document.createElement('div'); d.textContent = msg; $('msg').appendChild(d);
  while ($('msg').children.length > 5) $('msg').removeChild($('msg').firstChild);
  setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 700); }, 4200);
}
function flashScreen(c, a) { if (a >= G.flashA * 0.6 || G.flashC !== c) { G.flashC = c; } G.flashA = Math.max(G.flashA, a); }
function banner(t, s) { const b = $('banner'); b.innerHTML = '<h2>' + t + '</h2><p>' + (s || '') + '</p>'; b.style.opacity = 1; setTimeout(() => b.style.opacity = 0, 4200); }

// ---------- dano ao jogador ----------
function damagePlayer(a, sx, sz) {
  if (P.dead || P.pent > 0 || G.state !== 'play') return;
  a = Math.max(1, a);
  let save = Math.ceil(P.absorb * a);
  if (save >= P.armor) { save = P.armor; P.armor = 0; P.absorb = 0; } else P.armor -= save;
  const take = Math.ceil(a - save); P.hp -= take;
  flashScreen('#b00000', clamp(take / 45 + 0.15, 0.15, 0.7)); G.hurtT = 0.8;
  const side = angDiff(P.yaw, Math.atan2(-(sx - P.x), -(sz - P.z))); P.roll = clamp(side * 0.04, -0.08, 0.08); G.shake = Math.max(G.shake, Math.min(0.4, take / 60));
  if (P.hp <= 0) killPlayer(); else if (take > 2 && (!G.painCd || G.painCd < G.time)) { SND.pain(P.hp); G.painCd = G.time + 0.4; }
}
function killPlayer() {
  P.dead = true; P.hp = 0; P.deadT = 0; G.deadShown = false; SND.death(); G.mouseDown = false; W.root.visible = false;
  AU.combatT = 0; fxBlood(P.x, P.y + 1, P.z, 25, 5);
  const msgLives = G.lives > 0;
  setTimeout(() => {
    if (G.state !== 'play' && G.state !== 'dead') return;
    G.state = 'dead'; G.deadShown = true; document.exitPointerLock();
    $('deadTxt').textContent = msgLives ? 'Vidas restantes: ' + G.lives : 'Você não tem mais vidas.';
    $('deadBtn').textContent = msgLives ? 'RENASCER' : 'FIM DE JOGO — VOLTAR AO MENU';
    $('death').style.display = 'flex';
  }, 2200);
}

// ---------- movimento ----------
function accel(wx, wz, wish, cap, ac, dt) {
  const wishspd = Math.min(wish, cap), cur = P.vx * wx + P.vz * wz, add = wishspd - cur; if (add <= 0) return;
  const as = Math.min(add, ac * wish * dt); P.vx += as * wx; P.vz += as * wz;
}
function blockedP(x, z) {
  const r = 0.4;
  for (const [ox, oz] of [[r, r], [-r, r], [r, -r], [-r, -r]]) {
    if (LV.solidW(x + ox, z + oz)) return true;
    if (LV.floorAt(x + ox, z + oz) - P.y > 0.9) return true;
  }
  return false;
}
function updatePlayer(dt) {
  if (P.dead) { P.deadT += dt; P.vx *= 0.9; P.vz *= 0.9; return; }
  const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  const sn = Math.sin(P.yaw), cs = Math.cos(P.yaw);
  let wx = -sn * f + cs * s, wz = -cs * f - sn * s; const len = Math.hypot(wx, wz); if (len > 0) { wx /= len; wz /= len; }
  const ws = len > 0 ? (keys.ShiftLeft ? 5 : 10) : 0;
  if (P.onGround) {
    const sp = Math.hypot(P.vx, P.vz);
    if (sp > 0.01) { const ns = Math.max(0, sp - Math.max(sp, 3) * 6 * dt) / sp; P.vx *= ns; P.vz *= ns; }
    accel(wx, wz, ws, ws, 10, dt);
    if (keys.Space) { P.vy = 8.7; P.onGround = false; SND.jump(); }
  } else accel(wx, wz, ws, 0.95, 10, dt);
  // horizontal
  const nx = P.x + P.vx * dt; if (blockedP(nx, P.z)) P.vx *= -0.05; else P.x = nx;
  const nz = P.z + P.vz * dt; if (blockedP(P.x, nz)) P.vz *= -0.05; else P.z = nz;
  // vertical
  P.vy -= 25 * dt; const pvy = P.vy; P.y += P.vy * dt;
  const fl = LV.floorAt(P.x, P.z);
  if (P.y <= fl) { if (pvy < -9 && !P.onGround) SND.land(); P.y = fl; P.vy = 0; P.onGround = true; } else if (P.y > fl + 0.03) P.onGround = false;
  const cl = LV.ceilAt(P.x, P.z); if (P.y + 1.85 > cl) { P.y = cl - 1.85; if (P.vy > 0) P.vy = 0; }
  const speed = Math.hypot(P.vx, P.vz);
  if (P.onGround && speed > 3) { P.stepT += speed * dt; if (P.stepT > 3.3) { P.stepT = 0; SND.step(); } }
  P.bobT += dt * speed * (P.onGround ? 1 : 0.2);
  // lava
  if (LV.lavaW(P.x, P.z) && P.y < -0.2) { P.lavaT -= dt; if (P.lavaT <= 0) { P.lavaT = 0.25; if (P.pent <= 0) { SND.lava(); fxSpark(P.x, P.y + 0.3, P.z, 0, 1, 0, 6); flashScreen('#ff6000', 0.35); } damagePlayer(9 * G.diff.dmg, P.x, P.z); } }
  // temporizadores
  if (P.quad > 0) { P.quad -= dt; if (P.quad <= 0) say('O dano quádruplo acabou.'); }
  if (P.pent > 0) { P.pent -= dt; if (P.pent <= 0) say('A proteção acabou.'); }
  P.kickP *= Math.max(0, 1 - dt * 9); P.roll *= Math.max(0, 1 - dt * 6);
  // saída
  const ex = LV.exit; if (Math.hypot(P.x - ex.x, P.z - ex.z) < ex.r + 0.3 && portalActive()) levelComplete();
}
const portalActive = () => !(LV.def.boss && LV.bossAlive);
function useKey() {
  if (P.dead) return;
  const d = aimDir(); let used = false;
  for (const s of LV.doors) {
    if (s.type !== T_SECRET || s.opened) continue;
    const dx = s.x - P.x, dz = s.z - P.z, dist = Math.hypot(dx, dz);
    if (dist < 4.2 && (dx * d.x + dz * d.z) / dist > 0.6) { s.opened = true; G.secrets++; say('Você encontrou um segredo!'); SND.secret(); used = true; }
  }
  if (!used) say('Nada para usar aqui.');
}

// ---------- fases ----------
function clearLevel() {
  if (LV) { scene.remove(LV.group); LV.dispose(); LV = null; }
  [MG, PRG, PKG].forEach(g => { while (g.children.length) g.remove(g.children[0]); });
  monsters.length = projs.length = pickups.length = 0;
}
function startLevel(idx, respawn) {
  G.state = 'loading'; ['menu', 'pause', 'death', 'inter', 'victory'].forEach(i => $(i).style.display = 'none');
  $('loading').style.display = 'flex'; $('loadTxt').textContent = LEVELS[idx].name;
  setTimeout(() => { try { loadLevel(idx, respawn); } catch (e) { console.error(e); $('loadTxt').textContent = 'Erro: ' + e.message; } }, 60);
}
function loadLevel(idx, respawn) {
  clearLevel(); G.levelIdx = idx;
  const def = LEVELS[idx];
  if (respawn && G.snap) { P = JSON.parse(JSON.stringify(G.snap)); }
  else if (!P || idx === 0 && !G.carry) { P = newPlayer(); }
  P.dead = false; P.keys = { gold: false, silver: false }; P.quad = 0; P.pent = 0; P.vx = P.vy = P.vz = 0; P.hp = Math.max(P.hp, 1); P.kickP = 0; P.roll = 0;
  G.carry = false;
  LV = buildLevel(def, G.diff.count); LV.say = say; scene.add(LV.group);
  scene.fog = new THREE.FogExp2(new THREE.Color(...LV.th.fog), LV.th.fd); scene.background = new THREE.Color(...LV.th.fog);
  P.x = LV.start.x; P.z = LV.start.z; P.y = 0; P.yaw = LV.start.yaw; P.pitch = 0;
  W.root.visible = true; P.cur = P.cur || 1; W.cur = P.cur; W.pending = null; W.sw = 0; W.models.forEach((m, i) => m.visible = i === W.cur);
  if (!P.weapons[W.cur]) W.cur = 1;
  for (const s of LV.spawns) monsters.push(new Monster(s.type, s.x, s.z));
  for (const it of LV.items) spawnPickup(it.type, it.x, it.z);
  G.kills = 0; G.totalKills = monsters.length; G.secrets = 0; G.time = 0; G.noiseT = 0; G.deadShown = false;
  G.snap = JSON.parse(JSON.stringify(Object.assign({}, P, { cur: W.cur })));
  LV.computeFlow(P.x, P.z); G.lastCell = LV.cell(P.x, P.z);
  $('loading').style.display = 'none';
  G.state = 'play'; lockPointer();
  setTimeout(() => { if (document.pointerLockElement !== $('gl') && G.state === 'play') { G.state = 'pause'; $('pause').style.display = 'flex'; } }, 400);
  banner('Fase ' + (idx + 1) + ': ' + def.name, def.sub);
  if (idx === 0 && !respawn) say('WASD mover · Mouse mirar · Clique atirar · Espaço pular · E usar · 1-6 armas');
  if (def.boss) say('Elimine Chthon para abrir o portal.'); else say('Encontre a chave para abrir a câmara do portal.');
  SND.teleport();
}
function levelComplete() {
  if (G.state !== 'play') return; G.state = 'inter'; SND.teleport(); document.exitPointerLock(); G.mouseDown = false;
  AU.combatT = 0;
  P.cur = W.cur; const last = G.levelIdx >= LEVELS.length - 1;
  const t = Math.floor(G.time), mm = Math.floor(t / 60), ss = String(t % 60).padStart(2, '0');
  $('interTitle').textContent = last ? 'VITÓRIA!' : 'Fase concluída: ' + LEVELS[G.levelIdx].name;
  $('interStats').innerHTML = 'Monstros: <b>' + G.kills + ' / ' + G.totalKills + '</b><br>Segredos: <b>' + G.secrets + ' / ' + LV.totalSecrets + '</b><br>Tempo: <b>' + mm + ':' + ss + '</b>';
  $('interBtn').textContent = last ? 'FINALIZAR' : 'PRÓXIMA FASE';
  $('inter').style.display = 'flex';
  flashScreen('#aaccff', 0.9);
}
function lockPointer() { const c = $('gl'); try { const p = c.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { } }

// ---------- HUD ----------
const faceCtx = () => $('face').getContext('2d');
function drawFace() {
  const x = faceCtx(), lvl = P.hp > 80 ? 0 : P.hp > 60 ? 1 : P.hp > 40 ? 2 : P.hp > 20 ? 3 : 4, hurt = G.hurtT > 0.4, dead = P.dead;
  x.fillStyle = '#2b1d12'; x.fillRect(0, 0, 48, 48);
  const sk = [[212, 160, 120], [204, 152, 114], [190, 138, 104], [170, 124, 96], [140, 112, 96]][lvl];
  x.fillStyle = `rgb(${sk})`; x.fillRect(9, 7, 30, 35); x.fillStyle = `rgb(${sk.map(v => v * 0.8)})`; x.fillRect(9, 36, 30, 6);
  x.fillStyle = '#2a1c10'; x.fillRect(8, 5, 32, 8); x.fillRect(8, 5, 4, 16); x.fillRect(36, 5, 4, 16);
  x.fillStyle = '#e8e2d4'; if (dead) { x.fillStyle = '#111'; x.fillRect(14, 20, 8, 2); x.fillRect(26, 20, 8, 2); }
  else { x.fillRect(14, 20, 8, 5); x.fillRect(26, 20, 8, 5); const gx = Math.round(Math.sin(G.time * 0.9) * 1.5); x.fillStyle = '#18202a'; x.fillRect(17 + gx, 21, 3, 4); x.fillRect(29 + gx, 21, 3, 4); }
  x.fillStyle = '#20140c'; if (hurt) { x.fillRect(13, 15, 10, 3); x.fillRect(25, 15, 10, 3); } else { x.fillRect(13, 16, 10, 2); x.fillRect(25, 16, 10, 2); }
  x.fillStyle = `rgb(${sk.map(v => v * 0.75)})`; x.fillRect(22, 26, 4, 6);
  x.fillStyle = '#3a0c0c'; if (hurt || dead || lvl > 2) x.fillRect(17, 35, 14, 5); else x.fillRect(17, 36, 14, 2);
  x.fillStyle = '#9a1010';
  if (lvl >= 1) { x.fillRect(12, 28, 2, 8); }
  if (lvl >= 2) { x.fillRect(32, 14, 3, 12); x.fillRect(24, 38, 6, 2); }
  if (lvl >= 3) { x.fillRect(10, 22, 6, 3); x.fillRect(30, 30, 6, 8); x.fillRect(20, 8, 2, 8); }
  if (lvl >= 4 || dead) { x.fillRect(14, 20, 8, 5); x.fillStyle = '#2a0808'; x.fillRect(12, 18, 12, 8); }
  if (P.pent > 0) { x.fillStyle = 'rgba(255,0,0,0.35)'; x.fillRect(0, 0, 48, 48); } else if (P.quad > 0) { x.fillStyle = 'rgba(40,80,255,0.35)'; x.fillRect(0, 0, 48, 48); }
}
let hudT = 0;
function updateHud(dt) {
  hudT -= dt;
  $('hHp').textContent = Math.max(0, Math.ceil(P.hp)); $('hHp').className = P.hp <= 25 ? 'low' : '';
  $('hArm').textContent = Math.ceil(P.armor);
  const w = WEAP[W.cur]; $('hAmmo').textContent = w.ammo ? P.ammo[w.ammo] : '—'; $('hAmmoN').textContent = w.name.toUpperCase();
  $('aS').textContent = P.ammo.shells; $('aN').textContent = P.ammo.nails; $('aR').textContent = P.ammo.rockets;
  const ws = $('weps').children; for (let i = 0; i < 6; i++) ws[i].className = 'w' + (P.weapons[i] ? ' own' : '') + (i === (W.pending !== null ? W.pending : W.cur) ? ' cur' : '');
  $('keyG').style.display = P.keys.gold ? 'inline-block' : 'none'; $('keyS').style.display = P.keys.silver ? 'inline-block' : 'none';
  $('lives').textContent = '♥ x' + G.lives;
  const pw = []; if (P.quad > 0) pw.push('<span style="color:#6a8cff">QUAD ' + Math.ceil(P.quad) + '</span>'); if (P.pent > 0) pw.push('<span style="color:#ff5050">PENT ' + Math.ceil(P.pent) + '</span>'); $('pows').innerHTML = pw.join(' ');
  $('stats').textContent = 'Monstros ' + G.kills + '/' + G.totalKills + '  ·  Segredos ' + G.secrets + '/' + LV.totalSecrets;
  if (hudT <= 0) { hudT = 0.1; drawFace(); }
  G.hurtT = Math.max(0, G.hurtT - dt);
  G.flashA = Math.max(0, G.flashA - dt * 1.6);
  const fl = $('flash'); fl.style.background = G.flashC; fl.style.opacity = G.flashA;
  const tint = $('tint'); tint.style.background = P.pent > 0 ? 'rgba(255,0,0,0.18)' : P.quad > 0 ? 'rgba(40,70,255,0.2)' : (LV.lavaW(P.x, P.z) && P.y < -0.2 ? 'rgba(255,90,0,0.35)' : 'transparent');
}

// ---------- atualização ----------
function update(dt) {
  G.time += dt; G.noiseT -= dt; G.shake = Math.max(0, G.shake - dt * 1.8);
  updatePlayer(dt);
  const c = LV.cell(P.x, P.z); if (c !== G.lastCell) { G.lastCell = c; LV.computeFlow(P.x, P.z); }
  if (G.mouseDown && !P.dead) tryFire();
  const awake = []; let near = 0;
  for (const m of monsters) {
    m.update(dt);
    if (!m.dead && m.state !== 'idle') { awake.push(m); if ((m.x - P.x) ** 2 + (m.z - P.z) ** 2 < 900) near++; }
  }
  AU.combatT = near > 0 && !P.dead ? Math.min(1, 0.45 + near * 0.18) : 0;
  LV.updateDoors(dt, awake, P);
  updateProjs(dt); updatePickups(dt, G.time);
  LV.update(G.time, portalActive());
  weaponsUpdate(dt, G.time, Math.hypot(P.vx, P.vz), P.onGround);
  fxUpdate(dt, camera);
}
function placeCamera() {
  const sp = Math.hypot(P.vx, P.vz); let ey = P.y + 1.6, sh = G.shake;
  if (P.dead) { const k = Math.min(1, P.deadT * 2); ey = P.y + 1.6 - k * 1.2; }
  else ey += Math.sin(P.bobT * 1.15) * 0.045 * Math.min(1, sp / 8) * (P.onGround ? 1 : 0);
  camera.position.set(P.x + rr(-sh, sh) * 0.15, ey + rr(-sh, sh) * 0.15, P.z + rr(-sh, sh) * 0.15);
  camera.rotation.set(P.pitch + P.kickP + (P.dead ? 0.3 : 0), P.yaw, P.roll + (P.dead ? Math.min(0.9, P.deadT) * 0.9 : 0) + rr(-sh, sh) * 0.03, 'YXZ');
  const f = aimDir(); auListener(camera.position, { x: -Math.sin(P.yaw), y: 0, z: -Math.cos(P.yaw) });
  gunCam.fov = camera.fov; gunCam.updateProjectionMatrix();
}

// ---------- inicialização ----------
function init() {
  const cv = $('gl');
  renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75)); renderer.autoClear = false;
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x050505);
  camera = new THREE.PerspectiveCamera(G.fov, 1, 0.05, 140);
  scene.add(new THREE.AmbientLight(0xffffff, Math.PI));
  MG = new THREE.Group(); PRG = new THREE.Group(); PKG = new THREE.Group(); BEAM_GROUP = new THREE.Group(); scene.add(MG, PRG, PKG, BEAM_GROUP);
  SKIN = genSurface('skin', {}, 99, 128);
  fxInit(scene); weaponsInit(); scene.environment = gunScene.environment; W.root.visible = false; P = newPlayer();
  const resize = () => { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = gunCam.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); gunCam.updateProjectionMatrix(); };
  addEventListener('resize', resize); resize();
  // UI
  const ws = $('weps'); WEAP.forEach((w, i) => { const d = document.createElement('div'); d.className = 'w'; d.innerHTML = '<b>' + (i + 1) + '</b>' + ['MACH', 'ESC', 'ESC2', 'NAIL', 'GRAN', 'FOGU'][i]; ws.appendChild(d); });
  const dl = $('diffs'); DIFFS.forEach((d, i) => { const b = document.createElement('button'); b.textContent = d.name; b.onclick = () => { auInit(); G.diff = d; G.lives = 3; G.carry = false; P = newPlayer(); startLevel(0, false); }; if (i === 1) b.className = 'sel'; dl.appendChild(b); });
  $('resume').onclick = () => { auInit(); G.state = 'play'; $('pause').style.display = 'none'; lockPointer(); };
  $('deadBtn').onclick = () => { $('death').style.display = 'none'; if (G.lives > 0) { G.lives--; startLevel(G.levelIdx, true); } else { G.state = 'menu'; $('menu').style.display = 'flex'; } };
  $('interBtn').onclick = () => {
    $('inter').style.display = 'none';
    if (G.levelIdx >= LEVELS.length - 1) { G.state = 'menu'; $('victory').style.display = 'flex'; clearLevel(); }
    else { G.carry = true; startLevel(G.levelIdx + 1, false); }
  };
  $('victoryBtn').onclick = () => { $('victory').style.display = 'none'; $('menu').style.display = 'flex'; };
  const sset = (id, fn) => { const e = $(id); e.oninput = () => fn(+e.value); try { const v = localStorage.getItem('qc_' + id); if (v !== null) { e.value = v; fn(+v); } } catch (x) { } e.addEventListener('change', () => { try { localStorage.setItem('qc_' + id, e.value); } catch (x) { } }); };
  sset('sSens', v => G.sens = v); sset('sVol', v => auSetVol(v)); sset('sMus', v => auSetMusic(v)); sset('sFov', v => { G.fov = v; camera.fov = v; camera.updateProjectionMatrix(); });
  $('sInv').onchange = e => G.invert = e.target.checked;
  // entrada
  addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Tab') e.preventDefault();
    keys[e.code] = true;
    if (G.state !== 'play') return;
    if (e.code.startsWith('Digit')) { const n = +e.code.slice(5) - 1; if (n >= 0 && n < 6 && P.weapons[n]) switchWeapon(n); }
    else if (e.code === 'KeyE') useKey();
    else if (e.code === 'KeyQ') cycleWeapon(1);
  });
  addEventListener('keyup', e => keys[e.code] = false);
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; G.mouseDown = false; });
  cv.addEventListener('mousedown', e => { if (e.button === 0) { if (document.pointerLockElement !== cv && G.state === 'play') lockPointer(); G.mouseDown = true; } });
  addEventListener('mouseup', e => { if (e.button === 0) G.mouseDown = false; });
  addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('mousemove', e => {
    if (document.pointerLockElement !== cv || G.state !== 'play' || P.dead) return;
    const k = 0.0022 * G.sens; P.yaw -= e.movementX * k; P.pitch = clamp(P.pitch - e.movementY * k * (G.invert ? -1 : 1), -1.5, 1.5);
  });
  addEventListener('wheel', e => { if (G.state === 'play') cycleWeapon(e.deltaY > 0 ? 1 : -1); }, { passive: true });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== cv && G.state === 'play' && !P.dead) { G.state = 'pause'; G.mouseDown = false; $('pause').style.display = 'flex'; }
  });
  $('menu').style.display = 'flex';
  requestAnimationFrame(frame);
}
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if ((G.state === 'play' || G.state === 'dead') && LV) {
    if (G.state === 'dead') { G.time += dt; updatePlayer(dt); for (const m of monsters) m.update(dt); updateProjs(dt); fxUpdate(dt, camera); LV.update(G.time, portalActive()); }
    else update(dt);
    placeCamera(); updateHud(dt);
  } else if (LV && (G.state === 'pause' || G.state === 'inter')) { placeCamera(); }
  renderer.clear(); renderer.render(scene, camera);
  if (LV && G.state !== 'menu') { renderer.clearDepth(); gunCam.rotation.set(0, 0, 0); renderer.render(gunScene, gunCam); }
}
window.addEventListener('load', init);
