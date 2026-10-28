// Áudio 100% procedural (WebAudio): efeitos sombrios, reverb de caverna, trilha ambiente industrial
const AU = { ctx: null, master: null, sfx: null, music: null, noise: null, brown: null, vol: 0.8, mvol: 0.55, combat: 0, combatT: 0, step: 0, nextT: 0 };

function auInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  const c = AU.ctx = new (window.AudioContext || window.webkitAudioContext)();
  AU.master = c.createGain(); AU.master.gain.value = AU.vol;
  const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
  AU.master.connect(comp); comp.connect(c.destination);
  // reverb (impulso gerado)
  const len = c.sampleRate * 3.2, ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let lp = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; lp += (w - lp) * 0.45; d[i] = lp * Math.pow(1 - i / len, 2.6); } }
  const conv = c.createConvolver(); conv.buffer = ir;
  const wet = c.createGain(); wet.gain.value = 0.42; conv.connect(wet); wet.connect(AU.master);
  AU.rev = conv;
  AU.sfx = c.createGain(); AU.sfx.connect(AU.master);
  const send = c.createGain(); send.gain.value = 0.5; AU.sfx.connect(send); send.connect(conv);
  AU.music = c.createGain(); AU.music.gain.value = AU.mvol; AU.music.connect(AU.master);
  const ms = c.createGain(); ms.gain.value = 0.6; AU.music.connect(ms); ms.connect(conv);
  // buffers de ruído
  AU.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  let d = AU.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  AU.brown = c.createBuffer(1, c.sampleRate * 4, c.sampleRate);
  d = AU.brown.getChannelData(0); let last = 0; for (let i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  auAmbient();
  setInterval(auSeq, 30);
}
function auSetVol(v) { AU.vol = v; if (AU.master) AU.master.gain.value = v; }
function auSetMusic(v) { AU.mvol = v; if (AU.music) AU.music.gain.value = v; }

function auListener(pos, fwd) {
  if (!AU.ctx) return; const l = AU.ctx.listener;
  if (l.positionX) {
    l.positionX.value = pos.x; l.positionY.value = pos.y; l.positionZ.value = pos.z;
    l.forwardX.value = fwd.x; l.forwardY.value = fwd.y; l.forwardZ.value = fwd.z; l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
  } else { l.setPosition(pos.x, pos.y, pos.z); l.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0); }
}
// saída: global ou espacializada
function sOut(pos) {
  if (!pos) return AU.sfx;
  const p = AU.ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse';
  p.refDistance = 3.5; p.rolloffFactor = 1.25; p.maxDistance = 80;
  if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; } else p.setPosition(pos.x, pos.y, pos.z);
  p.connect(AU.sfx); return p;
}
function ev(g, t, a, dec, peak) {
  g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
}
function tone(type, f0, f1, dur, peak, dest, o) {
  o = o || {}; const c = AU.ctx, t = c.currentTime + (o.delay || 0);
  const os = c.createOscillator(), g = c.createGain(); os.type = type;
  os.frequency.setValueAtTime(f0, t); os.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  let n = os;
  if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; n.connect(f); n = f; }
  if (o.bp) { const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = o.bp; f.Q.value = o.q || 2; n.connect(f); n = f; }
  n.connect(g); g.connect(dest); ev(g, t, o.a || 0.004, dur, peak);
  os.start(t); os.stop(t + dur + (o.a || 0.004) + 0.05);
}
function nz(dur, peak, dest, ftype, f0, f1, q, o) {
  o = o || {}; const c = AU.ctx, t = c.currentTime + (o.delay || 0);
  const s = c.createBufferSource(); s.buffer = o.brown ? AU.brown : AU.noise; s.loop = true;
  const f = c.createBiquadFilter(); f.type = ftype; f.Q.value = q || 1;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = c.createGain(); s.connect(f); f.connect(g); g.connect(dest); ev(g, t, o.a || 0.003, dur, peak);
  s.start(t, Math.random()); s.stop(t + dur + (o.a || 0.003) + 0.05);
}
// voz formântica (grunhidos)
function voice(f0, f1, dur, peak, dest, fm1, fm2, o) {
  o = o || {}; const c = AU.ctx, t = c.currentTime + (o.delay || 0);
  const os = c.createOscillator(); os.type = o.type || 'sawtooth';
  os.frequency.setValueAtTime(f0, t); os.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
  if (o.trem) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = o.trem; lg.gain.value = f0 * 0.08; l.connect(lg); lg.connect(os.frequency); l.start(t); l.stop(t + dur + 0.1); }
  const g = c.createGain(); ev(g, t, o.a || 0.02, dur, peak);
  for (const fm of [fm1, fm2]) { const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fm; f.Q.value = o.q || 4; os.connect(f); f.connect(g); }
  g.connect(dest); os.start(t); os.stop(t + dur + 0.1);
}

const SND = {
  shotgun(p) { const o = sOut(p); nz(0.35, 0.9, o, 'bandpass', 2400, 300, 0.7); nz(0.9, 0.35, o, 'lowpass', 900, 80, 0.5, { brown: 1 }); tone('sine', 120, 34, 0.35, 1.0, o); },
  ssg(p) { SND.shotgun(p); setTimeout(() => SND.shotgun(p), 60); },
  nail(p) { const o = sOut(p); nz(0.07, 0.5, o, 'highpass', 3500, 1500, 1); tone('square', 420, 120, 0.06, 0.25, o, { lp: 2500 }); tone('sine', 90, 50, 0.08, 0.4, o); },
  rocket(p) { const o = sOut(p); nz(0.7, 0.7, o, 'bandpass', 300, 1800, 0.8); tone('sawtooth', 70, 160, 0.6, 0.4, o, { lp: 500 }); tone('sine', 90, 40, 0.3, 0.8, o); },
  grenade(p) { const o = sOut(p); nz(0.18, 0.6, o, 'lowpass', 1500, 200, 0.8); tone('sine', 150, 50, 0.25, 0.9, o); tone('square', 600, 200, 0.06, 0.15, o, { lp: 1200 }); },
  explode(p) { const o = sOut(p); nz(1.6, 1.0, o, 'lowpass', 2600, 60, 0.6, { brown: 1 }); nz(0.5, 0.7, o, 'bandpass', 1200, 200, 0.5); tone('sine', 95, 22, 1.4, 1.2, o); tone('sawtooth', 50, 20, 1.0, 0.35, o, { lp: 200 }); },
  bounce(p) { const o = sOut(p); tone('sine', 260, 120, 0.1, 0.5, o); nz(0.05, 0.3, o, 'bandpass', 2000, 800, 1); },
  axe() { const o = sOut(); nz(0.25, 0.5, o, 'bandpass', 500, 2200, 1.2, { a: 0.1 }); },
  axehit(p) { const o = sOut(p); tone('sine', 140, 50, 0.18, 0.9, o); nz(0.14, 0.6, o, 'lowpass', 2500, 300, 0.8); },
  hitflesh(p) { const o = sOut(p); tone('sine', 110, 55, 0.12, 0.6, o); nz(0.1, 0.4, o, 'lowpass', 1800, 250, 0.7); },
  ricochet(p) { const o = sOut(p); tone('sine', 2400, 900, 0.18, 0.18, o); nz(0.05, 0.25, o, 'highpass', 4000, 2000, 1); },
  empty() { const o = sOut(); tone('square', 180, 120, 0.04, 0.2, o, { lp: 900 }); },
  switchw() { const o = sOut(); nz(0.08, 0.3, o, 'bandpass', 1500, 700, 2); tone('square', 220, 110, 0.05, 0.12, o, { lp: 900, delay: 0.1 }); },
  pickHealth() { const o = sOut(); tone('sine', 330, 330, 0.25, 0.4, o); tone('sine', 495, 495, 0.35, 0.3, o, { delay: 0.1 }); },
  pickArmor() { const o = sOut(); nz(0.3, 0.6, o, 'bandpass', 3000, 1400, 6); tone('sine', 140, 90, 0.3, 0.5, o); },
  pickAmmo() { const o = sOut(); nz(0.06, 0.5, o, 'bandpass', 2500, 1800, 3); nz(0.06, 0.5, o, 'bandpass', 1800, 1200, 3, { delay: 0.08 }); },
  pickWeapon() { const o = sOut(); tone('sawtooth', 110, 220, 0.4, 0.4, o, { lp: 900 }); nz(0.15, 0.4, o, 'bandpass', 2400, 900, 4, { delay: 0.1 }); },
  pickKey() { const o = sOut(); [523, 659, 784].forEach((f, i) => tone('sine', f, f, 1.2, 0.35, o, { delay: i * 0.12 })); tone('sine', 1568, 1568, 1.6, 0.12, o, { delay: 0.3 }); },
  powerup() { const o = sOut(); tone('sawtooth', 55, 220, 1.2, 0.5, o, { lp: 700 }); tone('sine', 880, 1760, 1.0, 0.25, o); },
  secret() { const o = sOut(); [392, 494, 587, 784].forEach((f, i) => tone('triangle', f, f, 0.8, 0.3, o, { delay: i * 0.1 })); },
  noKey() { const o = sOut(); tone('square', 100, 80, 0.2, 0.3, o, { lp: 600 }); nz(0.1, 0.4, o, 'lowpass', 500, 200, 1); },
  door(p) { const o = sOut(p); nz(1.1, 0.5, o, 'lowpass', 260, 130, 3, { brown: 1, a: 0.1 }); tone('sawtooth', 48, 38, 1.1, 0.25, o, { lp: 180, a: 0.1 }); nz(0.12, 0.6, o, 'bandpass', 900, 400, 3, { delay: 1.0 }); },
  step(sc) { const o = sOut(); nz(0.1, 0.22 * (sc || 1), o, 'lowpass', 600, 120, 0.8, { brown: 1 }); tone('sine', 85, 40, 0.09, 0.2 * (sc || 1), o); },
  jump() { const o = sOut(); nz(0.15, 0.2, o, 'bandpass', 600, 300, 1); },
  land() { const o = sOut(); tone('sine', 80, 35, 0.15, 0.6, o); nz(0.1, 0.35, o, 'lowpass', 500, 100, 1); },
  pain(hp) { const o = sOut(); const f = hp < 30 ? 120 : 155; voice(f * 1.2, f * 0.7, 0.3, 0.7, o, 650, 1050, { q: 3 }); },
  death() { const o = sOut(); voice(170, 50, 1.4, 0.8, o, 500, 900, { a: 0.05, q: 3 }); nz(0.5, 0.4, o, 'lowpass', 500, 60, 1, { brown: 1, delay: 0.5 }); },
  lava() { const o = sOut(); nz(0.5, 0.6, o, 'bandpass', 3000, 1000, 1); tone('sine', 60, 50, 0.4, 0.5, o); },
  teleport() { const o = sOut(); tone('sawtooth', 60, 800, 1.4, 0.4, o, { lp: 1500, a: 0.5 }); nz(1.4, 0.4, o, 'bandpass', 400, 4000, 2, { a: 0.6 }); tone('sine', 400, 100, 2, 0.4, o, { delay: 1.1 }); },
  // monstros
  alert(type, p) { const o = sOut(p); const T = {
      grunt: () => { voice(130, 100, 0.35, 0.7, o, 600, 1100, { q: 3 }); voice(150, 90, 0.25, 0.6, o, 500, 900, { delay: 0.3, q: 3 }); },
      dog: () => { nz(0.12, 0.8, o, 'bandpass', 1100, 700, 3); voice(500, 260, 0.14, 0.8, o, 900, 1700, { type: 'square' }); nz(0.12, 0.8, o, 'bandpass', 1100, 700, 3, { delay: 0.2 }); voice(480, 250, 0.14, 0.8, o, 900, 1700, { type: 'square', delay: 0.2 }); },
      knight: () => { voice(95, 70, 0.7, 0.8, o, 380, 800, { trem: 9, q: 3 }); },
      enforcer: () => { voice(110, 80, 0.5, 0.7, o, 450, 1000, { type: 'square', q: 3 }); tone('square', 900, 400, 0.15, 0.2, o, { lp: 2000, delay: 0.3 }); },
      ogre: () => { voice(70, 48, 1.0, 0.95, o, 300, 700, { trem: 6, q: 3 }); nz(0.8, 0.5, o, 'lowpass', 500, 120, 1, { brown: 1 }); },
      shambler: () => { voice(52, 30, 1.8, 1.0, o, 200, 520, { trem: 5, q: 2.5 }); nz(1.4, 0.6, o, 'lowpass', 300, 60, 1, { brown: 1 }); },
      chthon: () => { voice(40, 22, 2.4, 1.0, o, 160, 420, { trem: 4, q: 2 }); nz(2, 0.8, o, 'lowpass', 400, 50, 1, { brown: 1 }); tone('sine', 55, 30, 2, 0.9, o); } };
    (T[type] || T.grunt)(); },
  mpain(type, p) { const o = sOut(p); const s = { grunt: 1, dog: 2.6, knight: 0.8, enforcer: 0.9, ogre: 0.55, shambler: 0.35, chthon: 0.28 }[type] || 1;
    if (type === 'dog') { voice(700, 300, 0.2, 0.7, o, 1000, 2000, { type: 'square' }); } else voice(160 * s, 90 * s, 0.3, 0.8, o, 500, 1000, { q: 3 }); },
  mdeath(type, p) { const o = sOut(p); const s = { grunt: 1, dog: 2.4, knight: 0.8, enforcer: 0.9, ogre: 0.55, shambler: 0.35, chthon: 0.28 }[type] || 1;
    voice(150 * s, 40 * s, 1.0 + (s < 0.5 ? 1 : 0), 0.9, o, 450, 800, { a: 0.03, q: 3 }); nz(0.4, 0.5, o, 'lowpass', 600, 80, 1, { brown: 1, delay: 0.4 }); },
  mshot(p) { const o = sOut(p); nz(0.25, 0.7, o, 'bandpass', 1800, 300, 0.8); tone('sine', 110, 40, 0.25, 0.7, o); },
  laser(p) { const o = sOut(p); tone('sawtooth', 1800, 300, 0.25, 0.35, o, { lp: 4000 }); tone('square', 900, 200, 0.2, 0.15, o); },
  zap(p) { const o = sOut(p); nz(0.6, 0.8, o, 'bandpass', 3000, 800, 2); tone('sawtooth', 60, 60, 0.6, 0.6, o, { lp: 800 }); tone('square', 120, 90, 0.5, 0.25, o); },
  bite(p) { const o = sOut(p); nz(0.1, 0.5, o, 'bandpass', 1500, 600, 2); tone('sine', 120, 60, 0.1, 0.5, o); },
  swing(p) { const o = sOut(p); nz(0.3, 0.4, o, 'bandpass', 400, 1600, 1.2, { a: 0.12 }); },
  chain(p) { const o = sOut(p); nz(0.5, 0.5, o, 'bandpass', 1400, 1400, 8); tone('sawtooth', 45, 45, 0.5, 0.3, o, { lp: 400 }); },
};

for (const k of Object.keys(SND)) { const f = SND[k]; SND[k] = function () { if (!AU.ctx) return; try { return f.apply(this, arguments); } catch (e) { console.warn('snd', k, e); } }; }

// ---------- Trilha ambiente: drone sombrio + eventos aleatórios + ritmo industrial no combate ----------
function auAmbient() {
  const c = AU.ctx, out = AU.music;
  const filt = c.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 220; filt.Q.value = 6;
  const dg = c.createGain(); dg.gain.value = 0.28; filt.connect(dg); dg.connect(out);
  const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.045; lg.gain.value = 140; lfo.connect(lg); lg.connect(filt.frequency); lfo.start();
  AU.drone = [];
  [[55, 'sawtooth'], [55.35, 'sawtooth'], [27.5, 'sine'], [82.4, 'sawtooth'], [65.4, 'triangle']].forEach(([f, t], i) => {
    const o = c.createOscillator(); o.type = t; o.frequency.value = f; const g = c.createGain(); g.gain.value = i === 2 ? 0.8 : i > 2 ? 0.15 : 0.35; o.connect(g); g.connect(filt); o.start(); AU.drone.push(o);
  });
  // vento
  const ws = c.createBufferSource(); ws.buffer = AU.brown; ws.loop = true;
  const wf = c.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 420; wf.Q.value = 1.4;
  const wg = c.createGain(); wg.gain.value = 0.2; ws.connect(wf); wf.connect(wg); wg.connect(out); ws.start();
  const wl = c.createOscillator(), wlg = c.createGain(); wl.frequency.value = 0.07; wlg.gain.value = 260; wl.connect(wlg); wlg.connect(wf.frequency); wl.start();
  const wl2 = c.createOscillator(), wlg2 = c.createGain(); wl2.frequency.value = 0.11; wlg2.gain.value = 0.1; wl2.connect(wlg2); wlg2.connect(wg.gain); wl2.start();
  // mudança de acordes
  const chords = [[55, 55.35, 27.5, 82.4, 65.4], [49, 49.3, 24.5, 73.4, 58.3], [46.2, 46.5, 23.1, 69.3, 55], [51.9, 52.2, 25.9, 77.8, 61.7]];
  let ci = 0;
  setInterval(() => { ci = (ci + 1 + Math.floor(Math.random() * 2)) % chords.length; const t = c.currentTime;
    AU.drone.forEach((o, i) => o.frequency.setTargetAtTime(chords[ci][i], t, 3)); }, 14000);
  // eventos
  const ev1 = () => {
    const r = Math.random(), t = c.currentTime;
    if (r < 0.28) { // sino/clang metálico
      const f = 110 * (1 + Math.random() * 1.5); [1, 2.76, 5.4, 8.93].forEach((m, i) => tone('sine', f * m, f * m * 0.995, 5 - i, 0.2 / (i + 1), out));
    } else if (r < 0.52) { // rosnado distante
      voice(48 + Math.random() * 20, 34, 3.5, 0.5, out, 180, 360, { trem: 3.5, a: 1.2, q: 2 });
    } else if (r < 0.74) { // sussurro
      nz(3.5, 0.18, out, 'bandpass', 1800 + Math.random() * 1500, 900, 9, { a: 1.5 });
    } else if (r < 0.9) { // gemido agudo fantasmagórico
      const f = 300 + Math.random() * 200; tone('sine', f, f * 0.55, 4.5, 0.09, out, { a: 1.5 });
      tone('sine', f * 1.5, f * 0.82, 4.5, 0.05, out, { a: 1.5 });
    } else { // batida grave
      tone('sine', 62, 30, 1.6, 0.9, out); tone('sine', 62, 30, 1.6, 0.6, out, { delay: 0.5 });
    }
    setTimeout(ev1, 5000 + Math.random() * 9000);
  };
  setTimeout(ev1, 3000);
}
const BASS = [41.2, 41.2, 49, 41.2, 43.65, 41.2, 55, 49];
function auSeq() {
  if (!AU.ctx) return;
  const c = AU.ctx; AU.combat += (AU.combatT - AU.combat) * 0.02;
  while (AU.nextT < c.currentTime + 0.12) {
    if (AU.nextT < c.currentTime - 0.3) AU.nextT = c.currentTime;
    const t = AU.nextT, st = AU.step % 16, dt = 60 / 104 / 4;
    const lv = AU.combat;
    if (lv > 0.08) {
      const out = AU.music;
      const kick = [0, 3, 8, 10].includes(st);
      if (kick) { const os = c.createOscillator(), g = c.createGain(); os.frequency.setValueAtTime(130, t); os.frequency.exponentialRampToValueAtTime(34, t + 0.16); os.connect(g); g.connect(out); ev(g, t, 0.002, 0.28, 0.9 * lv); os.start(t); os.stop(t + 0.35); }
      if (st % 4 === 2) { const s = c.createBufferSource(); s.buffer = AU.noise; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = c.createGain(); s.connect(f); f.connect(g); g.connect(out); ev(g, t, 0.001, 0.05, 0.22 * lv); s.start(t, Math.random()); s.stop(t + 0.1); }
      if (st === 4 || st === 12) { const s = c.createBufferSource(); s.buffer = AU.noise; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1700; f.Q.value = 1.5; const g = c.createGain(); s.connect(f); f.connect(g); g.connect(out); ev(g, t, 0.001, 0.16, 0.45 * lv); s.start(t, Math.random()); s.stop(t + 0.25); }
      if (st % 2 === 0 && lv > 0.3) { const f0 = BASS[(AU.step >> 1) % BASS.length] * (((AU.step >> 4) % 4 === 3) ? 1.122 : 1);
        const os = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain(); os.type = 'sawtooth'; os.frequency.value = f0; fl.type = 'lowpass'; fl.frequency.setValueAtTime(900 * lv + 100, t); fl.frequency.exponentialRampToValueAtTime(120, t + dt * 1.8); fl.Q.value = 8;
        os.connect(fl); fl.connect(g); g.connect(out); ev(g, t, 0.004, dt * 1.7, 0.3 * lv); os.start(t); os.stop(t + dt * 2); }
    }
    AU.nextT += dt; AU.step++;
  }
}
