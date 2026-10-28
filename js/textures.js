// Texturas procedurais (tileáveis) — cada textura cobre 2x2 unidades de mundo
const THEMES = [
  { name: 'tech', fog: [0.035, 0.045, 0.045], fd: 0.040, amb: 0.17, torch: [1, 0.74, 0.42], sky: 0x080a0a,
    wall: { kind: 'metal', c1: [128, 118, 102], c2: [84, 80, 72], rust: 0.5 },
    floor: { kind: 'tile', c1: [104, 98, 88], c2: [70, 66, 60], mortar: [30, 30, 28], rows: 2, cols: 2 },
    ceil: { kind: 'rough', c1: [78, 74, 68], c2: [46, 44, 42] } },
  { name: 'castle', fog: [0.055, 0.04, 0.028], fd: 0.040, amb: 0.15, torch: [1, 0.6, 0.26], sky: 0x0a0604,
    wall: { kind: 'brick', c1: [150, 108, 70], c2: [96, 66, 42], mortar: [58, 48, 38], rows: 4, cols: 2 },
    floor: { kind: 'tile', c1: [112, 98, 80], c2: [72, 62, 50], mortar: [30, 26, 22], rows: 2, cols: 2 },
    ceil: { kind: 'rough', c1: [76, 58, 44], c2: [44, 34, 26] } },
  { name: 'necro', fog: [0.025, 0.04, 0.055], fd: 0.042, amb: 0.16, torch: [0.5, 0.9, 1], sky: 0x04070a,
    wall: { kind: 'brick', c1: [108, 118, 134], c2: [64, 72, 86], mortar: [34, 40, 48], rows: 4, cols: 2 },
    floor: { kind: 'tile', c1: [90, 98, 108], c2: [54, 60, 68], mortar: [22, 26, 30], rows: 2, cols: 2 },
    ceil: { kind: 'rough', c1: [58, 64, 74], c2: [34, 38, 46] } },
  { name: 'hell', fog: [0.075, 0.015, 0.01], fd: 0.044, amb: 0.17, torch: [1, 0.34, 0.14], sky: 0x120302,
    wall: { kind: 'flesh', c1: [140, 46, 38], c2: [70, 20, 18], mortar: [30, 8, 8], rows: 4, cols: 2 },
    floor: { kind: 'tile', c1: [100, 42, 34], c2: [52, 18, 16], mortar: [20, 6, 6], rows: 2, cols: 2 },
    ceil: { kind: 'rough', c1: [70, 24, 20], c2: [36, 10, 9] } },
];

function genSurface(kind, P, seed, S) {
  S = S || 512;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const bcv = document.createElement('canvas'); bcv.width = bcv.height = S;
  const img = cv.getContext('2d').createImageData(S, S), d = img.data;
  const bimg = bcv.getContext('2d').createImageData(S, S), bd = bimg.data, HH = new Float32Array(S * S);
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const u = px / S, v = py / S;
    const n1 = fbm(seed, u, v, 5, 4), n2 = fbm(seed + 13, u, v, 3, 32);
    let h = 0.5, r = 128, g = 128, b = 128;
    const col = (c, k) => { r = c[0] * k; g = c[1] * k; b = c[2] * k; };
    if (kind === 'brick' || kind === 'tile' || kind === 'flesh') {
      const rows = P.rows || 4, cols = P.cols || 2, off = kind === 'tile' ? 0 : 0.5;
      const rv = v * rows, row = Math.floor(rv), fv = rv - row;
      const cu = u * cols + (row % 2) * off, c = Math.floor(cu), fu = cu - c;
      const du = Math.min(fu, 1 - fu) / cols, dv = Math.min(fv, 1 - fv) / rows;
      const dd = Math.min(du, dv);
      const m = kind === 'tile' ? 0.010 : 0.013;
      const bev = sstep(m * 0.6, m * 2.6, dd);
      const id = hash2(c + row * 7.1, seed);
      h = lerp(0.1 + 0.05 * n2, 0.55 + 0.35 * n1 + 0.1 * (id - 0.5), bev);
      if (bev < 0.12) col(P.mortar, 0.7 + 0.6 * n2);
      else {
        const t = clamp(0.2 + id * 0.6 + (n1 - 0.5) * 0.9, 0, 1);
        r = lerp(P.c1[0], P.c2[0], t); g = lerp(P.c1[1], P.c2[1], t); b = lerp(P.c1[2], P.c2[2], t);
        const k = (0.62 + 0.75 * n2) * (0.68 + 0.32 * bev) * (0.8 + 0.4 * n1);
        r *= k; g *= k; b *= k;
      }
      if (kind === 'flesh') {
        const ridge = Math.abs(fbm(seed + 5, u, v, 4, 6) - 0.5);
        if (ridge < 0.03) { const w = 1 - ridge / 0.03; r += 140 * w; g += 30 * w; b += 10 * w; h += 0.15 * w; }
      }
      if (kind === 'tile') {
        const cr = Math.abs(fbm(seed + 9, u, v, 3, 3) - 0.5);
        if (cr < 0.012) { r *= 0.35; g *= 0.35; b *= 0.35; h -= 0.2; }
      }
    } else if (kind === 'metal') {
      const cols = 2, rows = 2;
      const fu = fract(u * cols), fv = fract(v * rows);
      const dd = Math.min(fu, 1 - fu, fv, 1 - fv) / cols;
      const bev = sstep(0.004, 0.02, dd);
      h = 0.3 + 0.5 * bev + 0.04 * n2;
      const grain = 0.93 + 0.07 * hash2(0, py);
      let k = (0.75 + 0.5 * n1) * grain * (0.6 + 0.4 * bev);
      col(P.c1, k);
      if (dd < 0.006) col(P.c2, 0.4);
      // rebites
      const rx = Math.min(fu, 1 - fu) / cols, ry = Math.min(fv, 1 - fv) / rows;
      const rd = Math.hypot(rx - 0.035, ry - 0.035);
      if (rd < 0.011) { r *= 1.4; g *= 1.4; b *= 1.4; h += 0.2; } else if (rd < 0.015) { r *= 0.5; g *= 0.5; b *= 0.5; }
      const rust = fbm(seed + 21, u, v, 4, 4);
      if (rust > 0.66) { const w = sstep(0.66, 0.82, rust) * 0.55; r = lerp(r, 100 * (0.6 + n2), w); g = lerp(g, 66 * (0.6 + n2), w); b = lerp(b, 40, w); }
    } else if (kind === 'rough') {
      h = n1;
      const t = clamp(n1 * 1.2, 0, 1);
      col([lerp(P.c1[0], P.c2[0], t), lerp(P.c1[1], P.c2[1], t), lerp(P.c1[2], P.c2[2], t)], 0.55 + 0.9 * n2);
      const cr = Math.abs(fbm(seed + 3, u, v, 3, 4) - 0.5);
      if (cr < 0.012) { r *= 0.4; g *= 0.4; b *= 0.4; }
    } else if (kind === 'lava') {
      const w = fbm(seed, u, v, 4, 3);
      const t = fbm(seed + 7, (u + w * 0.35) % 1, (v + w * 0.35) % 1, 5, 4);
      const glow = 1 - sstep(0, 0.1, Math.abs(t - 0.5));
      if (t > 0.5) { const q = (t - 0.5) * 3; r = 255; g = 90 + 150 * q + 40 * n2; b = 10 + 30 * q; }
      else { r = 50 + 20 * n2; g = 14 + 8 * n2; b = 8; }
      r = lerp(r, 255, glow); g = lerp(g, 170, glow); b = lerp(b, 40, glow);
      h = t;
    } else if (kind === 'skin') {
      h = n1;
      const k = 0.7 + 0.6 * n2 * n1 + 0.2 * hash2(px, py) * 0.3;
      col([200, 200, 200], k);
    }
    const i = (py * S + px) * 4;
    d[i] = clamp(r, 0, 255); d[i + 1] = clamp(g, 0, 255); d[i + 2] = clamp(b, 0, 255); d[i + 3] = 255;
    HH[py * S + px] = h; const hv = clamp(h, 0, 1) * 255;
    bd[i] = bd[i + 1] = bd[i + 2] = hv; bd[i + 3] = 255;
  }
  if (kind !== 'lava' && kind !== 'skin') { // relevo falso: luz vinda do canto superior esquerdo
    const k = kind === 'rough' ? 1.6 : 2.6;
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const xl = (px + S - 1) % S, xr = (px + 1) % S, yu = (py + S - 1) % S, yd = (py + 1) % S;
      const gx = HH[py * S + xl] - HH[py * S + xr], gy = HH[yu * S + px] - HH[yd * S + px];
      const l = clamp(1 + (gx + gy) * k, 0.45, 1.6), i = (py * S + px) * 4;
      d[i] = clamp(d[i] * l, 0, 255); d[i + 1] = clamp(d[i + 1] * l, 0, 255); d[i + 2] = clamp(d[i + 2] * l, 0, 255);
    }
  }
  cv.getContext('2d').putImageData(img, 0, 0);
  bcv.getContext('2d').putImageData(bimg, 0, 0);
  const wrap = t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
  const map = wrap(new THREE.CanvasTexture(cv)); map.colorSpace = THREE.SRGBColorSpace;
  const bump = wrap(new THREE.CanvasTexture(bcv));
  return { map, bump };
}

function radialTex(stops, size) {
  size = size || 64;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(s => g.addColorStop(s[0], s[1]));
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function flameTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 84, 2, 32, 84, 40);
  g.addColorStop(0, 'rgba(255,250,200,1)'); g.addColorStop(0.25, 'rgba(255,200,80,0.95)');
  g.addColorStop(0.6, 'rgba(255,100,20,0.5)'); g.addColorStop(1, 'rgba(255,40,0,0)');
  x.fillStyle = g;
  x.beginPath(); x.moveTo(32, 4); x.bezierCurveTo(54, 50, 62, 80, 32, 126); x.bezierCurveTo(2, 80, 10, 50, 32, 4); x.fill();
  x.globalCompositeOperation = 'source-in'; x.fillRect(0, 0, 64, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function crossTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#d8d4c8'; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#a02018'; x.fillRect(24, 10, 16, 44); x.fillRect(10, 24, 44, 16);
  x.strokeStyle = '#555'; x.lineWidth = 4; x.strokeRect(2, 2, 60, 60);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
