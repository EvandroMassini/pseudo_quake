// Modelos de armas: peças torneadas (lathe), formas arredondadas, madeira texturizada, metal com reflexo
function woodTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 128, 0); g.addColorStop(0, '#4a2a14'); g.addColorStop(0.5, '#7a4a26'); g.addColorStop(1, '#4e2c16');
  x.fillStyle = g; x.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 90; i++) { x.strokeStyle = 'rgba(' + (20 + Math.random() * 30) + ',' + (10 + Math.random() * 15) + ',5,' + (0.1 + Math.random() * 0.25) + ')'; x.lineWidth = 0.5 + Math.random() * 2; const px = Math.random() * 128; x.beginPath(); x.moveTo(px, 0); x.bezierCurveTo(px + rr(-12, 12), 80, px + rr(-12, 12), 170, px + rr(-6, 6), 256); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
let GM = null;
function gunMats() {
  if (GM) return GM;
  const wt = woodTexture();
  GM = {
    steel: new THREE.MeshStandardMaterial({ color: 0x9a9ea8, metalness: 1, roughness: 0.26 }),
    blued: new THREE.MeshStandardMaterial({ color: 0x3a3d46, metalness: 0.95, roughness: 0.32 }),
    black: new THREE.MeshStandardMaterial({ color: 0x15161a, metalness: 0.7, roughness: 0.45 }),
    wood: new THREE.MeshStandardMaterial({ map: wt, color: 0xffffff, roughness: 0.5, metalness: 0 }),
    olive: new THREE.MeshStandardMaterial({ color: 0x4e5f3a, metalness: 0.55, roughness: 0.48 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc89a3c, metalness: 1, roughness: 0.3 }),
    leather: new THREE.MeshStandardMaterial({ color: 0x3a2214, metalness: 0, roughness: 0.8 }),
    red: new THREE.MeshStandardMaterial({ color: 0x8a2a1c, metalness: 0.4, roughness: 0.5 }),
  };
  return GM;
}
// peça torneada com eixo apontando para a frente (-z); pts = [raio, avanço]
function lat(par, mat, pts, x, y, z, seg) {
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg || 24), mat);
  m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); par.add(m); return m;
}
function sph(par, mat, rx, ry, rz, x, y, z, rot) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), mat); m.scale.set(rx, ry, rz); m.position.set(x, y, z); if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0); par.add(m); return m;
}
function tor(par, mat, R, r, x, y, z, rot, arc) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(R, r, 8, 24, arc || PI2), mat); m.position.set(x, y, z); if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0); par.add(m); return m;
}
function ring(par, mat, r, w, x, y, z) { return lat(par, mat, [[r - 0.004, 0], [r, 0.0], [r, w], [r - 0.004, w]], x, y, z); }

function makeWeaponModel(id) {
  const M = gunMats(), g = new THREE.Group(); let muz = [0, 0.03, -0.75];
  if (id === 0) { // ===== MACHADO =====
    const h = new THREE.Group();
    lat(h, M.wood, [[0, -0.46], [0.03, -0.46], [0.036, -0.4], [0.026, -0.2], [0.026, 0.2], [0.03, 0.4], [0.022, 0.46], [0, 0.46]], 0, 0, 0, 16).rotation.x = 0;
    for (let i = 0; i < 6; i++) tor(h, M.leather, 0.034, 0.008, 0, -0.38 + i * 0.045, 0, [Math.PI / 2, 0, 0]);
    sph(h, M.steel, 0.045, 0.03, 0.045, 0, -0.47, 0);
    const s = new THREE.Shape(); s.moveTo(0, -0.12); s.lineTo(0.06, -0.1); s.bezierCurveTo(0.26, -0.2, 0.42, -0.02, 0.38, 0.18); s.bezierCurveTo(0.34, 0.38, 0.2, 0.44, 0.06, 0.36); s.lineTo(0.0, 0.34);
    s.lineTo(-0.16, 0.2); s.lineTo(-0.14, 0.14); s.lineTo(0, 0.08); s.closePath();
    const hg = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 14 });
    const head = new THREE.Mesh(hg, M.steel); head.position.set(0.0, 0.34, -0.02); h.add(head);
    const col = sph(h, M.blued, 0.05, 0.1, 0.05, 0, 0.42, 0);
    h.rotation.set(-0.1, 0, -0.25); g.add(h);
    g.rotation.set(0.2, -0.3, 0); const w = new THREE.Group(); w.add(g); w.userData = { muz: [0, 0, 0], axe: true }; return w;
  }
  if (id === 1) { // ===== ESCOPETA (pump) =====
    lat(g, M.blued, [[0, 0], [0.034, 0], [0.034, 0.62], [0.026, 0.63], [0.026, 0.68], [0.034, 0.69], [0.034, 0.72], [0, 0.72]], 0, 0.03, -0.02);
    lat(g, M.blued, [[0, 0], [0.021, 0], [0.021, 0.5], [0.0, 0.5]], 0, -0.03, -0.05);
    for (const z of [-0.1, -0.2, -0.3]) ring(g, M.steel, 0.026, 0.01, 0, -0.03, z - 0.05).scale.set(1, 1, 1);
    lat(g, M.wood, [[0, 0], [0.04, 0], [0.047, 0.015], [0.047, 0.22], [0.04, 0.235], [0, 0.235]], 0, -0.03, -0.22);
    for (let i = 0; i < 5; i++) ring(g, M.black, 0.049, 0.008, 0, -0.03, -0.24 - i * 0.04);
    sph(g, M.steel, 0.052, 0.065, 0.2, 0, 0.0, 0.1); sph(g, M.black, 0.03, 0.022, 0.07, 0.042, 0.02, 0.06);
    sph(g, M.wood, 0.042, 0.082, 0.3, 0, -0.07, 0.4, [-0.22, 0, 0]); sph(g, M.wood, 0.036, 0.1, 0.05, 0, -0.1, 0.17, [0.4, 0, 0]);
    tor(g, M.steel, 0.045, 0.007, 0, -0.07, 0.14, [0, Math.PI / 2, 0], Math.PI); sph(g, M.black, 0.008, 0.03, 0.01, 0, -0.06, 0.12);
    lat(g, M.steel, [[0, 0], [0.006, 0], [0.006, 0.02], [0, 0.03]], 0, 0.068, -0.72).scale.set(1, 1, 1);
    sph(g, M.brass, 0.012, 0.012, 0.012, 0, 0.066, -0.7); muz = [0, 0.03, -0.76];
  } else if (id === 2) { // ===== ESCOPETA DUPLA =====
    for (const sx of [-1, 1]) { lat(g, M.blued, [[0, 0], [0.03, 0], [0.03, 0.66], [0.036, 0.675], [0.036, 0.7], [0, 0.7]], sx * 0.033, 0.03, -0.02); tor(g, M.steel, 0.036, 0.005, sx * 0.033, 0.03, -0.72, [0, 0, 0]); }
    sph(g, M.steel, 0.014, 0.012, 0.36, 0, 0.068, -0.35); sph(g, M.steel, 0.014, 0.012, 0.36, 0, -0.005, -0.35);
    sph(g, M.wood, 0.075, 0.05, 0.19, 0, -0.04, -0.28); sph(g, M.steel, 0.075, 0.07, 0.17, 0, 0.0, 0.1);
    for (const sx of [-1, 1]) sph(g, M.black, 0.02, 0.02, 0.025, sx * 0.045, 0.07, 0.15);
    sph(g, M.wood, 0.044, 0.085, 0.3, 0, -0.07, 0.42, [-0.22, 0, 0]); sph(g, M.wood, 0.04, 0.1, 0.05, 0, -0.1, 0.16, [0.4, 0, 0]);
    tor(g, M.steel, 0.045, 0.007, 0, -0.07, 0.13, [0, Math.PI / 2, 0], Math.PI);
    sph(g, M.brass, 0.012, 0.012, 0.012, 0, 0.09, -0.68); muz = [0, 0.03, -0.77];
  } else if (id === 3) { // ===== NAILGUN =====
    sph(g, M.olive, 0.06, 0.065, 0.3, 0, 0, -0.05); sph(g, M.blued, 0.07, 0.04, 0.14, 0, 0.065, -0.12);
    for (const sx of [-1, 1]) { lat(g, M.steel, [[0, 0], [0.017, 0], [0.017, 0.58], [0.022, 0.6], [0.022, 0.64], [0, 0.64]], sx * 0.03, 0.04, -0.22); lat(g, M.black, [[0, 0], [0.012, 0], [0.012, 0.3], [0, 0.3]], sx * 0.03, 0.04, -0.12); }
    lat(g, M.black, [[0, 0], [0.055, 0], [0.055, 0.1], [0, 0.1]], 0, 0.045, -0.5);
    sph(g, M.red, 0.09, 0.07, 0.07, 0, -0.07, -0.22); sph(g, M.brass, 0.07, 0.06, 0.05, 0, -0.07, -0.22);
    sph(g, M.black, 0.035, 0.1, 0.045, 0, -0.1, 0.1, [0.35, 0, 0]); sph(g, M.black, 0.04, 0.05, 0.22, 0, 0.0, 0.38, [-0.1, 0, 0]);
    tor(g, M.steel, 0.04, 0.006, 0, -0.07, 0.04, [0, Math.PI / 2, 0], Math.PI);
    for (let i = 0; i < 4; i++) sph(g, M.black, 0.062, 0.006, 0.03, 0, 0.0, -0.2 + i * 0.07);
    muz = [0, 0.04, -0.88];
  } else if (id === 4) { // ===== LANÇA-GRANADAS =====
    lat(g, M.olive, [[0, 0], [0.058, 0], [0.058, 0.72], [0.07, 0.74], [0.07, 0.8], [0.056, 0.82], [0, 0.82]], 0, 0, -0.1);
    const dr = new THREE.Group(); dr.position.set(0, 0, 0.02); g.add(dr);
    lat(dr, M.steel, [[0, -0.08], [0.095, -0.08], [0.1, -0.06], [0.1, 0.06], [0.095, 0.08], [0, 0.08]], 0, 0, 0);
    for (let i = 0; i < 6; i++) { const a = i / 6 * PI2; lat(dr, M.black, [[0, -0.09], [0.026, -0.09], [0.026, 0.09], [0, 0.09]], Math.cos(a) * 0.06, Math.sin(a) * 0.06, 0); }
    sph(g, M.blued, 0.075, 0.08, 0.12, 0, 0, 0.17); sph(g, M.black, 0.04, 0.11, 0.05, 0, -0.1, 0.16, [0.35, 0, 0]);
    sph(g, M.wood, 0.045, 0.08, 0.26, 0, -0.05, 0.4, [-0.15, 0, 0]);
    tor(g, M.steel, 0.045, 0.007, 0, -0.08, 0.1, [0, Math.PI / 2, 0], Math.PI);
    sph(g, M.steel, 0.012, 0.03, 0.012, 0, 0.09, -0.6); sph(g, M.steel, 0.025, 0.012, 0.03, 0, 0.065, 0.2);
    for (let i = 0; i < 4; i++) ring(g, M.steel, 0.062, 0.012, 0, 0, -0.3 - i * 0.1).scale.set(1, 1, 1);
    muz = [0, 0, -0.95];
  } else { // ===== LANÇA-FOGUETES =====
    lat(g, M.olive, [[0, 0], [0.066, 0], [0.066, 1.0], [0.092, 1.05], [0.092, 1.1], [0.07, 1.12], [0, 1.12]], 0, 0.02, -0.18);
    lat(g, M.blued, [[0.04, 0], [0.09, 0], [0.09, 0.05], [0.04, 0.2]], 0, 0.02, 0.2);
    lat(g, M.black, [[0.0, 0], [0.058, 0], [0.058, 0.02], [0.0, 0.02]], 0, 0.02, -1.3);
    for (const z of [0.0, -0.3, -0.6]) { ring(g, M.steel, 0.068, 0.025, 0, 0.02, z - 0.1).scale.set(1, 1, 1); }
    sph(g, M.blued, 0.08, 0.1, 0.16, 0, 0.0, 0.0); sph(g, M.black, 0.04, 0.12, 0.05, 0, -0.14, 0.03, [0.3, 0, 0]); sph(g, M.black, 0.04, 0.11, 0.05, 0, -0.14, -0.38, [0.1, 0, 0]);
    lat(g, M.steel, [[0, 0], [0.02, 0], [0.02, 0.2], [0, 0.2]], 0, 0.12, -0.4);
    sph(g, M.black, 0.03, 0.03, 0.07, 0, 0.14, -0.5); sph(g, M.wood, 0.045, 0.08, 0.25, 0, -0.03, 0.44, [-0.12, 0, 0]);
    tor(g, M.steel, 0.045, 0.007, 0, -0.07, 0.01, [0, Math.PI / 2, 0], Math.PI);
    muz = [0, 0.02, -1.25];
  }
  g.userData = { muz };
  if (!gunFlashTex) gunFlashTex = radialTex([[0, 'rgba(255,255,230,1)'], [0.25, 'rgba(255,200,90,0.9)'], [0.6, 'rgba(255,110,20,0.4)'], [1, 'rgba(255,60,0,0)']]);
  const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: gunFlashTex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }));
  f.position.set(...muz); f.scale.set(0.65, 0.65, 1); f.visible = false; f.renderOrder = 10; g.add(f); g.userData.flash = f;
  return g;
}
// mapa de ambiente simples (câmara escura com tochas) para o metal refletir
function makeGunEnv() {
  const pm = new THREE.PMREMGenerator(renderer), s = new THREE.Scene();
  const geo = new THREE.SphereGeometry(10, 32, 20), col = [], p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 10; const t = (y + 1) / 2; const lum = t < 0.35 ? 0.04 : t < 0.7 ? 0.18 + 0.1 * Math.sin(p.getX(i) * 0.8) : 0.06; col.push(lum * 1.3, lum * 0.8, lum * 0.5); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  s.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const L = (x, y, z, w, h, c) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); };
  L(-6, 3, -4, 3, 6, new THREE.Color(6, 3.2, 1.2)); L(6, 2, -5, 2, 5, new THREE.Color(4, 2, 0.8)); L(0, 8, 0, 6, 1.5, new THREE.Color(2.2, 2.2, 2.4)); L(2, 1, 8, 4, 1, new THREE.Color(1.6, 1.0, 0.6));
  const rt = pm.fromScene(s, 0.02); gunScene.environment = rt.texture; pm.dispose();
}
