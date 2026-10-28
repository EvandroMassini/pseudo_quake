// Áudio v2: vozes por síntese de formantes (rosnados, gritos, gorgolejos) e tiros/explosões em camadas com saturação
const _curves = {};
function dcurve(k) {
  if (_curves[k]) return _curves[k];
  const n = 2048, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
  return _curves[k] = c;
}
// barramento saturado -> destino
function sat(dest, k) { const c = AU.ctx, b = c.createGain(), w = c.createWaveShaper(); w.curve = dcurve(k); w.oversample = '2x'; b.connect(w); w.connect(dest); return b; }

// voz: fonte serrilhada + ruído -> modulação de rosnado -> saturação -> 3 formantes (varrendo) -> envelope
function vox(o) {
  const c = AU.ctx, t = c.currentTime + (o.delay || 0), d = o.dur, pf = o.pitch || 1;
  const os = c.createOscillator(); os.type = o.type || 'sawtooth';
  os.frequency.setValueAtTime(o.f[0][1] * pf, t);
  for (let i = 1; i < o.f.length; i++) os.frequency.linearRampToValueAtTime(o.f[i][1] * pf, t + o.f[i][0] * d);
  const mod = c.createGain(); mod.gain.value = 1; os.connect(mod);
  if (o.gr) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = o.gr * (0.9 + Math.random() * 0.2); lg.gain.value = (o.grd === undefined ? 0.6 : o.grd) * 0.5; mod.gain.value = 1 - lg.gain.value; l.connect(lg); lg.connect(mod.gain); l.start(t); l.stop(t + d + 0.1); }
  if (o.vib) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = o.vib; lg.gain.value = o.f[0][1] * pf * 0.04; l.connect(lg); lg.connect(os.frequency); l.start(t); l.stop(t + d + 0.1); }
  const mix = c.createGain(); mod.connect(mix);
  if (o.rasp) { const ns = c.createBufferSource(); ns.buffer = AU.noise; ns.loop = true; const ng = c.createGain(); ng.gain.value = o.rasp; ns.connect(ng); ng.connect(mix); ns.start(t, Math.random()); ns.stop(t + d + 0.1); }
  const pre = c.createWaveShaper(); pre.curve = dcurve(o.dist || 3); mix.connect(pre);
  const out = c.createGain(), a = o.a || 0.025, pk = (o.gain || 0.8);
  out.gain.setValueAtTime(0.0001, t); out.gain.linearRampToValueAtTime(pk, t + a); out.gain.setValueAtTime(pk, t + d * (o.hold || 0.55)); out.gain.exponentialRampToValueAtTime(0.0001, t + d);
  for (const fm of o.form) {
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = o.q || 5;
    f.frequency.setValueAtTime(fm[0] * pf, t); f.frequency.linearRampToValueAtTime(fm[1] * pf, t + d);
    const fg = c.createGain(); fg.gain.value = fm[2] === undefined ? 1 : fm[2]; pre.connect(f); f.connect(fg); fg.connect(out);
  }
  out.connect(o.dest); os.start(t); os.stop(t + d + 0.1);
}
const FM = { // formantes: vogais sombrias
  uh: [[550, 450, 1], [1100, 900, 0.8], [2400, 2200, 0.4]],
  ah: [[800, 650, 1], [1250, 1100, 0.8], [2600, 2400, 0.4]],
  ow: [[400, 330, 1], [800, 650, 0.8], [2300, 2100, 0.3]],
  ee: [[300, 400, 1], [2200, 1900, 0.7], [3000, 2800, 0.4]],
  deep: [[250, 200, 1], [600, 480, 0.9], [1300, 1100, 0.5]],
  huge: [[160, 130, 1], [420, 320, 1], [900, 700, 0.5]],
};
const VOICES = {
  grunt: {
    alert: o => [{ dur: 0.55, f: [[0, 120], [0.3, 175], [1, 105]], form: FM.ah, rasp: 0.4, gr: 45, grd: 0.5, dist: 5, q: 4 }, { delay: 0.45, dur: 0.4, f: [[0, 150], [1, 90]], form: FM.uh, rasp: 0.5, gr: 30, dist: 5 }],
    pain: o => [{ dur: 0.32, f: [[0, 230], [0.3, 280], [1, 130]], form: FM.ee, rasp: 0.3, dist: 5, q: 4 }],
    death: o => [{ dur: 1.4, f: [[0, 190], [0.3, 140], [1, 45]], form: [[700, 300, 1], [1300, 600, 0.8], [2500, 1500, 0.4]], rasp: 0.5, gr: 22, grd: 0.7, dist: 6 }, { delay: 0.5, dur: 0.8, f: [[0, 60], [1, 40]], form: FM.deep, rasp: 0.8, gr: 18, dist: 4 }],
  },
  dog: {
    alert: o => [{ dur: 0.9, f: [[0, 70], [0.4, 92], [1, 66]], form: FM.deep, rasp: 0.55, gr: 26, grd: 0.85, dist: 6, q: 4 }, { delay: 0.7, dur: 0.17, f: [[0, 400], [0.25, 560], [1, 250]], form: [[800, 1000, 1], [1700, 1500, 0.8], [3000, 2800, 0.4]], rasp: 0.7, dist: 8, q: 4 }, { delay: 0.95, dur: 0.17, f: [[0, 380], [0.25, 540], [1, 240]], form: [[800, 1000, 1], [1700, 1500, 0.8], [3000, 2800, 0.4]], rasp: 0.7, dist: 8 }],
    pain: o => [{ dur: 0.28, f: [[0, 800], [0.3, 1350], [1, 520]], form: [[1100, 1500, 1], [2400, 2000, 0.6], [3400, 3200, 0.3]], rasp: 0.2, dist: 3, q: 6 }],
    death: o => [{ dur: 1.0, f: [[0, 1100], [0.4, 700], [1, 240]], form: [[1000, 600, 1], [2200, 1400, 0.6]], rasp: 0.3, vib: 14, dist: 3 }, { delay: 0.3, dur: 0.8, f: [[0, 60], [1, 38]], form: FM.deep, rasp: 0.8, gr: 20 }],
  },
  knight: {
    alert: o => [{ dur: 1.0, f: [[0, 85], [0.4, 100], [1, 62]], form: FM.ow, rasp: 0.6, gr: 14, grd: 0.8, dist: 6, q: 4 }],
    pain: o => [{ dur: 0.35, f: [[0, 140], [1, 90]], form: FM.ah, rasp: 0.5, dist: 6 }],
    death: o => [{ dur: 1.6, f: [[0, 130], [0.3, 100], [1, 40]], form: FM.ow, rasp: 0.6, gr: 12, dist: 6 }],
  },
  enforcer: {
    alert: o => [{ dur: 0.5, f: [[0, 150], [0.5, 130], [1, 110]], form: [[500, 500, 1], [1500, 1500, 1], [2500, 2500, 0.5]], type: 'square', rasp: 0.1, dist: 8, q: 12 }],
    pain: o => [{ dur: 0.3, f: [[0, 300], [1, 160]], form: FM.ee, type: 'square', rasp: 0.3, dist: 8, q: 8 }],
    death: o => [{ dur: 1.0, f: [[0, 200], [1, 40]], form: FM.ah, type: 'square', rasp: 0.4, dist: 8, q: 8 }],
  },
  ogre: {
    alert: o => [{ dur: 1.2, f: [[0, 58], [0.3, 88], [1, 44]], form: FM.huge, rasp: 0.55, gr: 17, grd: 0.8, dist: 7, q: 3, gain: 1 }, { delay: 0.2, dur: 0.9, f: [[0, 90], [1, 60]], form: FM.deep, rasp: 0.5, gr: 25, dist: 5 }],
    pain: o => [{ dur: 0.5, f: [[0, 120], [0.3, 150], [1, 70]], form: FM.deep, rasp: 0.5, gr: 25, dist: 7 }],
    death: o => [{ dur: 2.0, f: [[0, 100], [0.3, 70], [1, 30]], form: FM.huge, rasp: 0.6, gr: 14, dist: 7 }],
  },
  shambler: {
    alert: o => [{ dur: 1.8, f: [[0, 48], [0.3, 64], [1, 36]], form: FM.huge, rasp: 0.7, gr: 12, grd: 0.9, dist: 8, q: 2.5, gain: 1 }, { delay: 0.1, dur: 1.4, f: [[0, 520], [0.3, 760], [1, 330]], form: FM.ee, rasp: 0.6, dist: 8, gain: 0.35, q: 8 }],
    pain: o => [{ dur: 0.7, f: [[0, 70], [0.3, 100], [1, 40]], form: FM.huge, rasp: 0.6, gr: 14, dist: 8 }],
    death: o => [{ dur: 2.6, f: [[0, 70], [0.2, 90], [1, 22]], form: FM.huge, rasp: 0.7, gr: 10, dist: 8 }],
  },
  chthon: {
    alert: o => [{ dur: 2.6, f: [[0, 36], [0.3, 50], [1, 28]], form: [[120, 100, 1], [300, 240, 1], [700, 500, 0.6]], rasp: 0.8, gr: 9, grd: 0.9, dist: 9, q: 2, gain: 1.2 }, { dur: 2.2, f: [[0, 700], [0.3, 950], [1, 400]], form: FM.ee, rasp: 0.7, dist: 9, gain: 0.3, q: 8 }],
    pain: o => [{ dur: 0.9, f: [[0, 50], [0.3, 80], [1, 30]], form: FM.huge, rasp: 0.7, gr: 10, dist: 9 }],
    death: o => [{ dur: 3.4, f: [[0, 60], [0.2, 80], [1, 16]], form: FM.huge, rasp: 0.8, gr: 8, dist: 9 }],
  },
};
function speak(type, kind, p, vol, pitch) {
  const V = VOICES[type] || VOICES.grunt, o = sOut(p), pf = (pitch || 1) * (0.93 + Math.random() * 0.14);
  const bus = AU.ctx.createGain(); bus.gain.value = vol || 1; bus.connect(o);
  for (const cfg of V[kind]()) vox(Object.assign({ dest: bus, pitch: pf }, cfg));
}
// som de metal/ossos junto com a morte
function clatter(p, n) { const o = sOut(p); for (let i = 0; i < n; i++) nz(0.12, 0.35, o, 'bandpass', 2200 + Math.random() * 2500, 1000, 7, { delay: 0.3 + Math.random() * 0.9 }); }

Object.assign(SND, {
  alert(type, p) { speak(type, 'alert', p, 1); },
  mpain(type, p) { speak(type, 'pain', p, 0.9); },
  mdeath(type, p) { speak(type, 'death', p, 1); if (type === 'knight' || type === 'enforcer') clatter(p, 6); const o = sOut(p); nz(0.5, 0.55, o, 'lowpass', 500, 60, 1, { brown: 1, delay: 0.55 }); },
  growl(type, p) { speak(type, 'alert', p, 0.55, 0.85); },

  shotgun(p) {
    const o = sOut(p), b = sat(o, 9);
    nz(0.05, 1.0, b, 'highpass', 3200, 1500, 0.7); nz(0.2, 1.0, b, 'bandpass', 1600, 220, 0.6); nz(0.55, 0.8, b, 'lowpass', 700, 50, 0.7, { brown: 1 });
    tone('sine', 170, 26, 0.5, 1.4, b); tone('sawtooth', 90, 30, 0.25, 0.4, b, { lp: 400 });
    nz(1.6, 0.3, o, 'lowpass', 2200, 120, 0.5, { delay: 0.04, a: 0.03, brown: 1 });
    nz(0.04, 0.45, o, 'bandpass', 2800, 2000, 7, { delay: 0.5 }); tone('square', 220, 90, 0.04, 0.1, o, { delay: 0.5, lp: 1500 });
    nz(0.05, 0.5, o, 'bandpass', 1800, 900, 6, { delay: 0.68 }); tone('square', 150, 70, 0.05, 0.12, o, { delay: 0.68, lp: 1200 });
  },
  ssg(p) {
    const o = sOut(p), b = sat(o, 11);
    nz(0.06, 1.0, b, 'highpass', 3000, 1200, 0.7); nz(0.25, 1.0, b, 'bandpass', 1300, 160, 0.6); nz(0.8, 1.0, b, 'lowpass', 600, 40, 0.7, { brown: 1 });
    tone('sine', 140, 20, 0.7, 1.8, b); tone('sawtooth', 70, 22, 0.4, 0.5, b, { lp: 300 });
    nz(2.2, 0.35, o, 'lowpass', 2000, 100, 0.5, { delay: 0.05, a: 0.04, brown: 1 });
    nz(0.05, 0.5, o, 'bandpass', 2400, 1400, 6, { delay: 0.62 }); nz(0.05, 0.5, o, 'bandpass', 1500, 800, 6, { delay: 0.8 });
  },
  nail(p) {
    const o = sOut(p), f = 0.85 + Math.random() * 0.3, b = sat(o, 5);
    nz(0.04, 0.8, b, 'bandpass', 3000 * f, 1200, 3); tone('square', 520 * f, 130, 0.05, 0.28, b, { lp: 3200 }); tone('sine', 120, 50, 0.07, 0.6, b);
    tone('triangle', 1900 * f, 800, 0.1, 0.08, o); nz(0.2, 0.12, o, 'bandpass', 900, 400, 2, { delay: 0.02 });
  },
  rocket(p) {
    const o = sOut(p), b = sat(o, 4);
    tone('sine', 110, 32, 0.4, 1.2, b); nz(0.12, 0.8, b, 'bandpass', 700, 200, 0.7); nz(1.0, 0.8, o, 'bandpass', 350, 2600, 0.9, { a: 0.25 }); tone('sawtooth', 60, 170, 0.9, 0.35, o, { lp: 600, a: 0.1 });
  },
  grenade(p) { const o = sOut(p), b = sat(o, 3); tone('sine', 120, 38, 0.3, 1.1, b); nz(0.12, 0.7, b, 'lowpass', 1400, 200, 0.8); tone('square', 480, 160, 0.05, 0.18, o, { lp: 1500 }); nz(0.06, 0.4, o, 'bandpass', 2600, 1800, 5, { delay: 0.08 }); },
  explode(p) {
    const o = sOut(p), b = sat(o, 7);
    nz(0.07, 1.0, b, 'highpass', 3500, 1500, 0.7); nz(0.7, 1.0, b, 'bandpass', 1000, 110, 0.5); nz(2.8, 1.0, b, 'lowpass', 1500, 36, 0.6, { brown: 1 });
    tone('sine', 78, 16, 2.0, 1.8, b); tone('sawtooth', 48, 16, 1.4, 0.5, b, { lp: 200 });
    for (let i = 0; i < 9; i++) nz(0.08, 0.28, o, 'bandpass', 1800 + Math.random() * 3000, 700, 4, { delay: 0.2 + Math.random() * 1.1 });
    nz(3.2, 0.3, o, 'lowpass', 900, 60, 0.5, { delay: 0.1, a: 0.1, brown: 1 });
  },
  bounce(p) { const o = sOut(p); tone('triangle', 700, 340, 0.12, 0.3, o); nz(0.06, 0.4, o, 'bandpass', 2400, 900, 4); tone('sine', 140, 60, 0.1, 0.5, o); },
  mshot(p) { const o = sOut(p), b = sat(o, 7); nz(0.05, 0.9, b, 'highpass', 3000, 1400, 0.7); nz(0.2, 0.8, b, 'bandpass', 1400, 200, 0.6); tone('sine', 140, 30, 0.35, 1.0, b); nz(1.2, 0.22, o, 'lowpass', 1800, 120, 0.5, { delay: 0.03, a: 0.03, brown: 1 }); },
  laser(p) { const o = sOut(p); tone('sawtooth', 2600, 180, 0.28, 0.35, o, { lp: 5000 }); tone('square', 1300, 140, 0.24, 0.18, o); nz(0.2, 0.3, o, 'bandpass', 4500, 600, 3); },
  zap(p) {
    const o = sOut(p), b = sat(o, 6); tone('square', 60, 60, 0.7, 0.5, b, { lp: 600 }); tone('sawtooth', 120, 100, 0.6, 0.25, b, { lp: 900 });
    for (let i = 0; i < 18; i++) nz(0.03 + Math.random() * 0.04, 0.5, b, 'bandpass', 1500 + Math.random() * 4000, 800, 3, { delay: Math.random() * 0.6 });
  },
  axe() { const o = sOut(); nz(0.28, 0.5, o, 'bandpass', 450, 2400, 1.2, { a: 0.1 }); },
  axehit(p) { const o = sOut(p), b = sat(o, 4); tone('sine', 150, 45, 0.22, 1.0, b); nz(0.16, 0.7, b, 'lowpass', 2400, 250, 0.8); nz(0.1, 0.4, o, 'bandpass', 3200, 1500, 3); },
  hitflesh(p) { const o = sOut(p); tone('sine', 100, 40, 0.16, 0.8, o); nz(0.14, 0.6, o, 'lowpass', 1600, 200, 0.7); nz(0.08, 0.35, o, 'bandpass', 700, 300, 3, { delay: 0.04 }); },
  bite(p) { const o = sOut(p); nz(0.1, 0.7, o, 'bandpass', 1800, 500, 2); tone('sine', 110, 55, 0.12, 0.6, o); nz(0.06, 0.4, o, 'highpass', 4000, 2000, 1, { delay: 0.05 }); },
  chain(p) { const o = sOut(p), b = sat(o, 6); nz(0.7, 0.6, b, 'bandpass', 1200, 1300, 6); tone('sawtooth', 40, 44, 0.7, 0.45, b, { lp: 350 }); nz(0.7, 0.35, o, 'highpass', 4000, 3500, 2); },
  swing(p) { const o = sOut(p); nz(0.32, 0.4, o, 'bandpass', 350, 1500, 1.2, { a: 0.14 }); },
});
for (const k of Object.keys(SND)) { const f = SND[k]; if (f.__w) continue; const w = function () { if (!AU.ctx) return; try { return f.apply(this, arguments); } catch (e) { console.warn('snd', k, e); } }; w.__w = 1; SND[k] = w; }
