'use strict';
/* =====================================================================
   מנוע במה: ציר זמן דטרמיניסטי -> מצב -> SVG
   כל רגע בסרט הוא פונקציה טהורה של הזמן t, ולכן עצירה, קפיצה לרגע
   והפקת תמונה לוורד משחזרים בדיוק את אותו מצב.
   ===================================================================== */
const W = 800, H = 450, GROUND = 400;
const L1 = 44, L2 = 42;               // אורך זרוע עליונה / אמה
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, k) => a + (b - a) * k;
const f1 = v => Math.round(v * 10) / 10;
const DEG = Math.PI / 180;
const EASE = {
  lin: k => k,
  io: k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2,
  out: k => 1 - Math.pow(1 - k, 3),
  in: k => k * k * k,
  bounce: k => { const n = 7.5625, d = 2.75;
    if (k < 1 / d) return n * k * k;
    if (k < 2 / d) return n * (k -= 1.5 / d) * k + .75;
    if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + .9375;
    return n * (k -= 2.625 / d) * k + .984375; },
  back: k => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); }
};
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* ---------------- דמויות ---------------- */
const CHARS = {
  uri:   { name: 'אורי',  g: 'm', skin: '#f2c48d', hair: '#5b3a1e', style: 'short', shirt: '#3a86ff', pants: '#33415c', shoe: '#2b2b2b', detail: 'pocket' },
  maya:  { name: 'מאיה',  g: 'f', skin: '#dfa86b', hair: '#2b1b12', style: 'pony',  shirt: '#ff7b54', pants: '#2a7f78', shoe: '#5c2a1e', detail: 'collar' },
  eitan: { name: 'איתן',  g: 'm', skin: '#b97a45', hair: '#1d1d1d', style: 'curly', shirt: '#3c9d6e', pants: '#3d405b', shoe: '#222',    detail: 'stripe', glasses: true },
  lia:   { name: 'ליה',   g: 'f', skin: '#ffdcb5', hair: '#b5482a', style: 'long',  shirt: '#8e57d8', pants: '#264653', shoe: '#3a2a4a', detail: 'collar' },
  noam:  { name: 'נועם',  g: 'm', skin: '#8d5a3b', hair: '#1a1110', style: 'buzz',  shirt: '#f4a261', pants: '#2b2d42', shoe: '#1e1e1e', detail: 'stripe' },
  noa:   { name: 'נועה',  g: 'f', skin: '#f6d5b8', hair: '#d9a93a', style: 'bun',   shirt: '#e5486e', pants: '#355070', shoe: '#40263a', detail: 'pocket' }
};
const CHAR_ORDER = ['uri', 'maya', 'eitan', 'lia', 'noam', 'noa'];

function charBase(x) {
  return { 'c.x': x, 'c.y': 0, 'c.sit': 0, 'c.lean': 0, 'c.turn': 0, 'c.sh': 0, 'c.tilt': 0, 'c.down': 0,
    'c.lx': 0, 'c.ly': 0, 'c.wide': 0, 'c.close': 0, 'c.bup': 0, 'c.bin': 0, 'c.smile': 0, 'c.open': 0, 'c.tight': 0,
    'c.aAs': 10, 'c.aAe': 6, 'c.aAf': 0, 'c.aAsl': 0, 'c.aApt': 0, 'c.aBs': 10, 'c.aBe': 6, 'c.aBf': 0, 'c.aBsl': 0, 'c.aBpt': 0,
    'c.walk': 0, 'c.wamp': 1, 'c.puff': 0, 'c.scale': 1 };
}

function rotP(px, py, cx, cy, deg) {
  if (!deg) return [px, py];
  const r = deg * DEG, c = Math.cos(r), s = Math.sin(r), dx = px - cx, dy = py - cy;
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
}
function armPts(sx, sy, s, e, mir) {
  const r = s * DEG, f = (s - e) * DEG;
  const ex = sx + mir * (-Math.sin(r)) * L1, ey = sy + Math.cos(r) * L1;
  const hx = ex + mir * (-Math.sin(f)) * L2, hy = ey + Math.cos(f) * L2;
  return [ex, ey, hx, hy];
}
/* קינמטיקה: מיקומי מפרקים במרחב הדמות ובעולם */
function kin(s) {
  const sit = s['c.sit'], sh = s['c.sh'], lean = s['c.lean'];
  const hipY = -95 + 38 * sit;
  const shY = hipY - 78 - 6 * sh;
  const P = (x, y) => rotP(x, y, 0, hipY, lean);
  const a = armPts(-25, shY, s['c.aAs'], s['c.aAe'], 1);
  const b = armPts(25, shY, s['c.aBs'], s['c.aBe'], -1);
  const headY = hipY - 78 - 37 + (sh < 0 ? -5 * sh : 0) + s['c.down'] * 5;
  const X = s['c.x'], Y = GROUND + s['c.y'], sc = s['c.scale'];
  const Wd = p => [X + p[0] * sc, Y + p[1] * sc];
  const K = { hipY, shY, sA: P(-25, shY), eA: P(a[0], a[1]), hA: P(a[2], a[3]), sB: P(25, shY), eB: P(b[0], b[1]), hB: P(b[2], b[3]), head: P(s['c.turn'] * 4, headY) };
  K.hAW = Wd(K.hA); K.hBW = Wd(K.hB); K.headW = Wd(K.head); K.sAW = Wd(K.sA); K.sBW = Wd(K.sB);
  K.W = Wd;
  return K;
}
/* IK דו־מפרקי. מחזיר זוויות כתף/מרפק לפגיעה ביעד בעולם */
function ikWorld(s, side, wx, wy) {
  const K = kin(s), sc = s['c.scale'];
  let lx = (wx - s['c.x']) / sc, ly = (wy - GROUND - s['c.y']) / sc;
  [lx, ly] = rotP(lx, ly, 0, K.hipY, -s['c.lean']);
  const mir = side === 'A' ? 1 : -1, sx = mir * -25, sy = K.shY;
  const dx = (lx - sx) * mir, dy = ly - sy;
  let d = Math.hypot(dx, dy); d = clamp(d, Math.abs(L1 - L2) + 2, L1 + L2 - 0.5);
  const th = Math.atan2(-dx, dy);
  const al = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const be = Math.acos(clamp((L2 * L2 + d * d - L1 * L1) / (2 * L2 * d), -1, 1));
  let sA = (th + al) / DEG; const fA = (th - be) / DEG;
  let e = sA - fA;
  if (sA < -120) sA += 360;
  if (sA > 260) sA -= 360;
  return { s: sA, e };
}

/* ---------------- ציר זמן ---------------- */
function computeState(tl, t) {
  if (tl._dirty) { tl.segs.sort((a, b) => a.at - b.at); tl._dirty = false; }
  const s = Object.assign({}, tl.base);
  for (const g of tl.segs) {
    if (g.at > t + 1e-9) break;
    const k = g.dur <= 0 ? 1 : clamp((t - g.at) / g.dur, 0, 1);
    const e = (EASE[g.ease] || EASE.io)(k);
    for (const key in g.set) {
      const to = g.set[key];
      if (typeof to === 'number') { const from = s[key] === undefined ? to : s[key]; s[key] = from + (to - from) * e; }
      else if (k >= 1) s[key] = to;
    }
  }
  return s;
}
function propPos(s, K, key) {
  let x = s[key + '.x'], y = s[key + '.y'];
  const h = s[key + '.h'] || 0;
  if (h > 0) {
    const hw = s[key + '.side'] === 'A' ? K.hAW : K.hBW;
    x = lerp(x, hw[0] + (s[key + '.ox'] || 0), h);
    y = lerp(y, hw[1] + (s[key + '.oy'] || 0), h);
  }
  return [x, y];
}
class TL {
  constructor(base) { this.base = Object.assign({}, base); this.segs = []; this.bubbles = []; this.sounds = []; this.keys = []; this.dur = 0; this._dirty = true; }
  to(at, dur, set, ease) { this.segs.push({ at, dur: Math.max(0, dur), set, ease: ease || 'io' }); this._dirty = true; this.dur = Math.max(this.dur, at + Math.max(0, dur)); return this; }
  st(t) { return computeState(this, t); }
  hold(t) { this.dur = Math.max(this.dur, t); return this; }
  key(t) { this.keys.push(t); return this; }
  look(at, dur, o, ease) { const m = { turn: 'c.turn', lx: 'c.lx', ly: 'c.ly', tilt: 'c.tilt', down: 'c.down' }; const set = {}; for (const k in o) set[m[k]] = o[k]; return this.to(at, dur, set, ease); }
  face(at, dur, o, ease) { const set = {}; for (const k in o) set['c.' + k] = o[k]; return this.to(at, dur, set, ease); }
  body(at, dur, o, ease) { const set = {}; for (const k in o) set['c.' + k] = o[k]; return this.to(at, dur, set, ease); }
  armRaw(at, dur, side, s, e, ease, extra) { const set = Object.assign({}, extra || {}); set['c.a' + side + 's'] = s; set['c.a' + side + 'e'] = e; return this.to(at, dur, set, ease); }
  armTo(at, dur, side, wx, wy, ease, extra) {
    const st = computeState(this, at + dur);
    const r = ikWorld(st, side, wx, wy);
    return this.armRaw(at, dur, side, r.s, r.e, ease, extra);
  }
  initArm(side, wx, wy) { const r = ikWorld(computeState(this, 0), side, wx, wy); this.base['c.a' + side + 's'] = r.s; this.base['c.a' + side + 'e'] = r.e; return this; }
  hand(at, dur, side, fist) { return this.to(at, dur, { ['c.a' + side + 'f']: fist }); }
  walk(at, dur, toX, cycles, ease) { const st = computeState(this, at); return this.to(at, dur, { 'c.x': toX, 'c.walk': st['c.walk'] + cycles }, ease || 'lin'); }
  attach(at, key, side, dur) {
    const st = computeState(this, at), K = kin(st), hw = side === 'A' ? K.hAW : K.hBW, p = propPos(st, K, key);
    this.to(at, 0, { [key + '.side']: side, [key + '.ox']: p[0] - hw[0], [key + '.oy']: p[1] - hw[1] });
    return this.to(at, dur || 0.12, { [key + '.h']: 1 });
  }
  detach(at, key, dur) {
    const st = computeState(this, at), K = kin(st), p = propPos(st, K, key);
    this.to(at, 0, { [key + '.x']: p[0], [key + '.y']: p[1] });
    return this.to(at, dur || 0.12, { [key + '.h']: 0 });
  }
  grip(at, dur, key, ox, oy, ease) { return this.to(at, dur, { [key + '.ox']: ox, [key + '.oy']: oy }, ease); }
  say(at, text, o) { const b = Object.assign({ at, text, who: 'c', style: 'normal', cps: 15 }, o || {}); b.full = b.at + revealTime(b); b.until = b.until || (b.full + (b.hold || 2)); this.bubbles.push(b); this.dur = Math.max(this.dur, b.until); return b; }
  snd(at, name, vol) { this.sounds.push({ at, name, vol: vol == null ? 1 : vol }); return this; }
  talk(t0, t1, amp, end) {
    amp = amp == null ? .35 : amp; const step = .13; let on = true;
    for (let t = t0; t < t1 - step; t += step) { this.to(t, step, { 'c.open': on ? amp : amp * .25 }); on = !on; }
    return this.to(Math.max(t0, t1 - step), step, { 'c.open': end || 0 });
  }
}
function revealTime(b) {
  if (b.reveal === 'words') return (b.gaps && b.gaps.length) ? b.gaps[b.gaps.length - 1] + .3 : .3;
  return Math.max(.3, [...String(b.text)].length / (b.cps || 15));
}
function bubbleStates(tl, t) {
  const out = [];
  for (const b of tl.bubbles) {
    if (t < b.at || t >= b.until) continue;
    const chars = [...String(b.text)];
    let n;
    if (b.reveal === 'words') {
      const words = String(b.text).split(' ');
      let k = 0; (b.gaps || []).forEach((g, i) => { if (t - b.at >= g) k = i + 1; });
      n = [...words.slice(0, k).join(' ')].length;
    } else n = Math.floor((t - b.at) * (b.cps || 15)) + 1;
    out.push({ b, n: clamp(n, 0, chars.length) });
  }
  return out;
}

/* ---------------- ציור הדמות ---------------- */
function hairSVG(A, part) {
  const c = A.hair, st = A.style;
  if (part === 'back') {
    if (st === 'long') return `<path d="M-37,-8 C-46,26 -42,50 -33,62 L33,62 C42,50 46,26 37,-8 Z" fill="${c}"/>`;
    if (st === 'pony') return `<ellipse cx="33" cy="10" rx="11" ry="25" transform="rotate(-18 33 10)" fill="${c}"/><rect x="26" y="-14" width="12" height="7" rx="3" fill="#e9c46a"/>`;
    return '';
  }
  if (st === 'short') return `<path d="M-35,-2 C-38,-38 -14,-46 4,-43 C25,-42 39,-28 35,-2 C31,-20 20,-27 6,-24 C-8,-28 -24,-19 -35,-2Z" fill="${c}"/>`;
  if (st === 'buzz') return `<path d="M-33,-9 C-30,-38 30,-38 33,-9 C25,-25 -25,-25 -33,-9Z" fill="${c}" opacity=".92"/>`;
  if (st === 'curly') { let o = ''; for (let i = 0; i <= 8; i++) { const a = (195 + i * 18.75) * DEG; o += `<circle cx="${f1(Math.cos(a) * 31)}" cy="${f1(Math.sin(a) * 31 - 2)}" r="11.5" fill="${c}"/>`; } return o; }
  if (st === 'pony') return `<path d="M-35,-1 C-38,-38 -10,-46 6,-43 C27,-41 39,-26 35,-1 C30,-17 14,-29 -2,-25 C-14,-22 -27,-14 -35,-1Z" fill="${c}"/>`;
  if (st === 'long') return `<path d="M-36,4 C-40,-38 -12,-46 4,-44 C26,-43 40,-30 36,4 C33,-14 24,-24 10,-26 C2,-16 -16,-20 -26,-12 C-30,-6 -33,-2 -36,4Z" fill="${c}"/>`;
  if (st === 'bun') return `<circle cx="0" cy="-41" r="14" fill="${c}"/><path d="M-34,-4 C-37,-38 37,-38 34,-4 C28,-22 -28,-22 -34,-4Z" fill="${c}"/>`;
  return '';
}
function handSVG(x, y, ang, fist, pt, skin) {
  const d = '#00000040';
  let o = `<g transform="translate(${f1(x)},${f1(y)}) rotate(${f1(ang)})">`;
  if (pt > .05) o += `<rect x="-2.6" y="2" width="5.2" height="${f1(6 + 9 * pt)}" rx="2.6" fill="${skin}" stroke="${d}" stroke-width="1"/>`;
  const r = lerp(8.6, 7.2, fist);
  o += `<circle cx="0" cy="0" r="${f1(r)}" fill="${skin}" stroke="${d}" stroke-width="1.2"/>`;
  if (fist > .5) o += `<path d="M-4.5,2.5 Q0,5.5 4.5,2.5" stroke="${d}" stroke-width="1.4" fill="none"/>`;
  else o += `<ellipse cx="-7" cy="-1" rx="3" ry="4.5" fill="${skin}" stroke="${d}" stroke-width="1"/><path d="M-3,6.5 L-3,9.5 M0.5,7 L0.5,10.5 M4,6.5 L4,9.5" stroke="${skin}" stroke-width="2.6" stroke-linecap="round"/>`;
  return o + '</g>';
}
function armSVG(S, E, Hh, A, sleeve, fist, pt) {
  const skin = A.skin;
  let o = `<path d="M${f1(S[0])},${f1(S[1])} L${f1(E[0])},${f1(E[1])}" stroke="${A.shirt}" stroke-width="15" stroke-linecap="round"/>`;
  o += `<path d="M${f1(E[0])},${f1(E[1])} L${f1(Hh[0])},${f1(Hh[1])}" stroke="${skin}" stroke-width="11" stroke-linecap="round"/>`;
  if (sleeve > .02) { const m = [lerp(E[0], Hh[0], .85 * sleeve), lerp(E[1], Hh[1], .85 * sleeve)]; o += `<path d="M${f1(E[0])},${f1(E[1])} L${f1(m[0])},${f1(m[1])}" stroke="${A.shirt}" stroke-width="14" stroke-linecap="round"/>`; }
  const ang = Math.atan2(Hh[1] - E[1], Hh[0] - E[0]) / DEG - 90;
  return o + handSVG(Hh[0], Hh[1], ang, fist, pt, skin);
}
function mouthSVG(s, fx, fy) {
  const sm = s['c.smile'], op = s['c.open'], ti = s['c.tight'];
  const w = 22 * (1 - .42 * ti) * (1 + .12 * Math.max(0, sm));
  const cy = 15 + fy, cl = -sm * 4.5;
  let o = '';
  if (op < .06) {
    o = `<path d="M${f1(fx - w / 2)},${f1(cy + cl)} Q${f1(fx)},${f1(cy + sm * 8 * (1 - ti))} ${f1(fx + w / 2)},${f1(cy + cl)}" stroke="#6b2b2b" stroke-width="${f1(3 + ti)}" fill="none" stroke-linecap="round"/>`;
  } else {
    const ow = w * (1 - .25 * op * (1 - Math.max(0, sm)));
    o = `<path d="M${f1(fx - ow / 2)},${f1(cy + cl)} Q${f1(fx)},${f1(cy + sm * 3 - op * 3)} ${f1(fx + ow / 2)},${f1(cy + cl)} Q${f1(fx)},${f1(cy + sm * 7 + op * 15)} ${f1(fx - ow / 2)},${f1(cy + cl)}Z" fill="#7a2630" stroke="#5a1a20" stroke-width="1.5"/>`;
    if (op > .3) o += `<ellipse cx="${f1(fx)}" cy="${f1(cy + op * 7 + sm * 3)}" rx="${f1(ow * .22)}" ry="${f1(op * 2.6)}" fill="#e07a7a"/>`;
  }
  if (ti > .3) o += `<g stroke="#00000055" stroke-width="1.6" fill="none" opacity="${f1(ti)}"><path d="M${f1(fx - 21)},${f1(cy - 2)} q-3,5 0,9"/><path d="M${f1(fx + 21)},${f1(cy - 2)} q3,5 0,9"/><path d="M${f1(fx - 4)},${f1(cy + 9)} q4,2 8,0"/></g>`;
  return o;
}
function headSVG(s, A, K) {
  const turn = s['c.turn'], fx = turn * 8, fy = s['c.down'] * 3.5;
  const wide = s['c.wide'], close = s['c.close'];
  let o = `<g transform="translate(${f1(K.head[0])},${f1(K.head[1])}) rotate(${f1(s['c.tilt'] + s['c.lean'] * .3)})">`;
  o += `<circle cx="${f1(-31 + Math.max(0, turn) * 5)}" cy="3" r="7" fill="${A.skin}" stroke="#00000030"/><circle cx="${f1(31 + Math.min(0, turn) * 5)}" cy="3" r="7" fill="${A.skin}" stroke="#00000030"/>`;
  o += `<circle cx="0" cy="0" r="33" fill="${A.skin}" stroke="#00000035" stroke-width="1.5"/>`;
  o += hairSVG(A, 'front');
  for (const sg of [-1, 1]) {
    const ex = fx + sg * 12, ey = -1 + fy;
    const rx = 6 * (1 + .3 * wide), ry = 7.2 * (1 + .45 * wide) * (1 - close);
    if (close > .8) o += `<path d="M${f1(ex - 6)},${f1(ey + 1)} Q${f1(ex)},${f1(ey + 4)} ${f1(ex + 6)},${f1(ey + 1)}" stroke="#3b2a20" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    else {
      o += `<ellipse cx="${f1(ex)}" cy="${f1(ey)}" rx="${f1(rx)}" ry="${f1(Math.max(1, ry))}" fill="#fff" stroke="#3b2a20" stroke-width="1.4"/>`;
      const pr = 3.7 - wide * .7, px = ex + s['c.lx'] * (rx - pr - .6), py = ey + s['c.ly'] * Math.max(0, ry - pr - .6);
      o += `<circle cx="${f1(px)}" cy="${f1(py)}" r="${f1(Math.min(pr, Math.max(1, ry)))}" fill="#2b1d16"/><circle cx="${f1(px - 1)}" cy="${f1(py - 1.2)}" r="1" fill="#fff"/>`;
    }
    const bup = s['c.bup'], bin = s['c.bin'];
    const by = -15 + fy - bup * 7 - wide * 2;
    const ix = fx + sg * (5 - bin * 1.5), ox = fx + sg * 19, iy = by + bin * 5 - bup * 1.5, oy = by - bin * 1;
    o += `<path d="M${f1(ox)},${f1(oy)} Q${f1((ix + ox) / 2)},${f1(by - 3 - bup * 2)} ${f1(ix)},${f1(iy)}" stroke="${A.hair === '#d9a93a' ? '#8a6420' : '#2a1a12'}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`;
  }
  if (A.glasses) o += `<g fill="none" stroke="#333" stroke-width="2"><circle cx="${f1(fx - 12)}" cy="${f1(-1 + fy)}" r="10"/><circle cx="${f1(fx + 12)}" cy="${f1(-1 + fy)}" r="10"/><path d="M${f1(fx - 2)},${f1(-2 + fy)} L${f1(fx + 2)},${f1(-2 + fy)}"/></g>`;
  o += `<path d="M${f1(fx - 2)},${f1(5 + fy)} Q${f1(fx + 2)},${f1(9 + fy)} ${f1(fx - 1)},${f1(10 + fy)}" stroke="#00000040" stroke-width="1.6" fill="none"/>`;
  o += mouthSVG(s, fx, fy);
  if (s['c.puff'] > .02) o += `<g stroke="#5a7fa8" stroke-width="2" fill="none" stroke-linecap="round" opacity="${f1(s['c.puff'])}"><path d="M${f1(fx + 16)},20 q8,-2 14,2"/><path d="M${f1(fx + 18)},26 q9,0 15,5"/><path d="M${f1(fx + 15)},31 q7,2 11,8"/></g>`;
  return o + '</g>';
}
function drawChar(s, A) {
  const K = kin(s), X = s['c.x'], Y = GROUND + s['c.y'], sc = s['c.scale'];
  const sit = s['c.sit'], hipY = K.hipY, lean = s['c.lean'];
  let o = `<g transform="translate(${f1(X)},${f1(Y)}) scale(${sc})">`;
  o += `<ellipse cx="0" cy="${f1(-s['c.y'] / sc + 3)}" rx="${f1(40 + s['c.y'] * .3)}" ry="7" fill="#00000022"/>`;
  // רגליים
  const ph = 2 * Math.PI * s['c.walk'], amp = s['c.wamp'];
  const tuck = s['c.y'] < 0 ? -s['c.y'] * .35 : 0;
  const lift = [Math.max(0, Math.sin(ph)) * 16 * amp + tuck, Math.max(0, -Math.sin(ph)) * 16 * amp + tuck];
  [-1, 1].forEach((sg, i) => {
    const hx = sg * 13;
    const fStand = [sg * 15, -lift[i]], kStand = [sg * 15 + sg * lift[i] * .5, (hipY + fStand[1]) / 2 - lift[i] * .25];
    const fSit = [sg * 21, 0], kSit = [sg * 20, hipY + 13];
    const k = [lerp(kStand[0], kSit[0], sit), lerp(kStand[1], kSit[1], sit)], f = [lerp(fStand[0], fSit[0], sit), lerp(fStand[1], fSit[1], sit)];
    o += `<path d="M${hx},${f1(hipY)} L${f1(k[0])},${f1(k[1])} L${f1(f[0])},${f1(f[1] - 4)}" stroke="${A.pants}" stroke-width="17" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    o += `<ellipse cx="${f1(f[0] + sg * 5)}" cy="${f1(f[1] - 3)}" rx="12" ry="6" fill="${A.shoe}"/>`;
  });
  // שיער אחורי + גוף
  o += `<g transform="rotate(${f1(lean)} 0 ${f1(hipY)})">`;
  const hb = rotP(K.head[0], K.head[1], 0, hipY, -lean);
  o += `<g transform="translate(${f1(hb[0])},${f1(hb[1])}) rotate(${f1(s['c.tilt'])})">${hairSVG(A, 'back')}</g>`;
  const sy = K.shY;
  o += `<rect x="-7" y="${f1(sy - 16)}" width="14" height="20" fill="${A.skin}"/>`;
  o += `<path d="M-27,${f1(sy + 5)} Q-29,${f1(sy - 1)} -18,${f1(sy - 3)} L18,${f1(sy - 3)} Q29,${f1(sy - 1)} 27,${f1(sy + 5)} L24,${f1(hipY + 4)} Q0,${f1(hipY + 9)} -24,${f1(hipY + 4)} Z" fill="${A.shirt}" stroke="#00000030" stroke-width="1.5"/>`;
  if (A.detail === 'stripe') o += `<rect x="-26" y="${f1(sy + 30)}" width="52" height="9" fill="#ffffff70"/>`;
  if (A.detail === 'pocket') o += `<rect x="6" y="${f1(sy + 14)}" width="13" height="12" rx="2" fill="none" stroke="#00000035" stroke-width="1.6"/>`;
  if (A.detail === 'collar') o += `<path d="M-10,${f1(sy - 3)} L0,${f1(sy + 8)} L10,${f1(sy - 3)}" fill="#ffffffaa"/>`;
  o += `<rect x="-24.5" y="${f1(hipY - 5)}" width="49" height="12" rx="4" fill="${A.pants}"/>`;
  o += '</g>';
  o += `<g transform="rotate(${f1(lean)} 0 ${f1(hipY)})">`;
  const hd = rotP(K.head[0], K.head[1], 0, hipY, -lean);
  const Kh = Object.assign({}, K, { head: hd });
  o += headSVG(Object.assign({}, s, { 'c.lean': 0 }), A, Kh);
  o += '</g>';
  // זרועות (כבר מסובבות)
  o += armSVG(K.sA, K.eA, K.hA, A, s['c.aAsl'], s['c.aAf'], s['c.aApt']);
  o += armSVG(K.sB, K.eB, K.hB, A, s['c.aBsl'], s['c.aBf'], s['c.aBpt']);
  return o + '</g>';
}

/* ---------------- בועות דיבור ---------------- */
let _mctx = null;
function measureText(txt, font) {
  if (!_mctx) { const c = document.createElement('canvas'); _mctx = c.getContext('2d'); }
  _mctx.font = font; return _mctx.measureText(txt).width;
}
function wrapText(text, font, maxW) {
  const out = [];
  for (const para of String(text).split(/\r?\n/)) {
    const words = para.split(/\s+/).filter(Boolean); let line = '';
    for (let w of words) {
      while (measureText(w, font) > maxW && [...w].length > 1) {
        const ch = [...w]; let k = ch.length - 1; while (k > 1 && measureText(ch.slice(0, k).join(''), font) > maxW) k--;
        if (line) { out.push(line); line = ''; } out.push(ch.slice(0, k).join('')); w = ch.slice(k).join('');
      }
      const tryL = line ? line + ' ' + w : w;
      if (!line || measureText(tryL, font) <= maxW) line = tryL; else { out.push(line); line = w; }
    }
    out.push(line);
  }
  return out;
}
const BSTYLE = {
  normal: { fs: 21, fw: '700', pad: 14, sw: 3, stroke: '#1f2937', fill: '#ffffff', color: '#111827', dash: '' },
  quiet:  { fs: 15, fw: '400', pad: 10, sw: 2, stroke: '#6b7280', fill: '#f3f4f6', color: '#4b5563', dash: '5 4' },
  emph:   { fs: 26, fw: '900', pad: 16, sw: 5, stroke: '#111827', fill: '#fff4c2', color: '#111827', dash: '' },
  sound:  { fs: 19, fw: '700', pad: 10, sw: 2.5, stroke: '#8a6a00', fill: '#fffbea', color: '#6b4f00', dash: '7 4' }
};
function bubbleSVG(bs, K) {
  const b = bs.b, st = BSTYLE[b.style] || BSTYLE.normal;
  const font = `${st.fw} ${st.fs}px Arial, Helvetica, sans-serif`;
  const lines = wrapText(b.text, font, b.maxW || 290);
  const lw = lines.map(l => measureText(l, font));
  const bw = Math.max(...lw, 20) + st.pad * 2 + (b.style === 'sound' ? 24 : 0), lh = st.fs * 1.32, bh = lines.length * lh + st.pad * 1.3;
  let ax, ay, tx, ty;
  if (b.who === 'c' && K) { ax = K.headW[0] + (b.dx || 0); ay = K.headW[1] - 44 + (b.dy || 0); tx = K.headW[0] + (b.dx ? Math.sign(b.dx) * 18 : 0); ty = K.headW[1] - 30; }
  else { ax = b.x; ay = b.y; tx = b.tx; ty = b.ty; }
  const bx = clamp(ax - bw / 2, 8, W - 8 - bw), by = clamp(ay - bh - 16, 6, H - bh - 6);
  let o = `<g class="bubble">`;
  if (tx != null && b.style !== 'sound') {
    const bx0 = clamp(tx - 12, bx + 14, bx + bw - 38);
    const base = ty > by + bh ? by + bh - 2 : by + 2;
    const tipY = ty > by + bh ? Math.min(ty, by + bh + 26) : Math.max(ty, by - 26);
    const tipX = clamp(tx, bx - 30, bx + bw + 30);
    o += `<path d="M${f1(bx0)},${f1(base)} L${f1(tipX)},${f1(tipY)} L${f1(bx0 + 24)},${f1(base)} Z" fill="${st.fill}" stroke="${st.stroke}" stroke-width="${st.sw}" stroke-linejoin="round" ${st.dash ? `stroke-dasharray="${st.dash}"` : ''}/>`;
  }
  o += `<rect x="${f1(bx)}" y="${f1(by)}" width="${f1(bw)}" height="${f1(bh)}" rx="${b.style === 'sound' ? 8 : 18}" fill="${st.fill}" stroke="${st.stroke}" stroke-width="${st.sw}" ${st.dash ? `stroke-dasharray="${st.dash}"` : ''}/>`;
  if (tx != null && b.style !== 'sound') {
    const bx0 = clamp(tx - 12, bx + 14, bx + bw - 38), base = ty > by + bh ? by + bh - 2 : by + 2;
    o += `<path d="M${f1(bx0 + 2)},${f1(base)} L${f1(bx0 + 22)},${f1(base)}" stroke="${st.fill}" stroke-width="${st.sw + 2}"/>`;
  }
  if (b.style === 'sound') { const ix = bx + bw - 18, iy = by + bh / 2; o += `<g fill="none" stroke="${st.color}" stroke-width="2"><path d="M${ix + 6},${iy - 5} l-5,0 l-4,-4 l0,18 l4,-4 l5,0 z" fill="${st.color}"/><path d="M${ix - 4},${iy - 6} q-5,6 0,12"/><path d="M${ix - 8},${iy - 9} q-8,9 0,18"/></g>`; }
  let left = bs.n;
  const cxm = bx + (bw - (b.style === 'sound' ? 24 : 0)) / 2;
  lines.forEach((ln, i) => {
    const chars = [...ln]; const take = clamp(left, 0, chars.length); left -= chars.length + 1;
    if (take <= 0) return;
    const y = by + st.pad * .65 + lh * (i + .78);
    o += `<text x="${f1(cxm + lw[i] / 2)}" y="${f1(y)}" direction="rtl" text-anchor="start" font-family="Arial, Helvetica, sans-serif" font-size="${st.fs}" font-weight="${st.fw}" ${b.style === 'sound' ? 'font-style="italic"' : ''} fill="${st.color}">${esc(chars.slice(0, take).join(''))}</text>`;
  });
  return o + '</g>';
}

/* ---------------- חפצים ורהיטים ---------------- */
const D = {
  wall(c1, c2) { return `<defs><linearGradient id="wallg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect x="0" y="0" width="${W}" height="${GROUND + 6}" fill="url(#wallg)"/>`; },
  floor(c, line) { let o = `<rect x="0" y="${GROUND - 4}" width="${W}" height="${H - GROUND + 4}" fill="${c}"/>`; for (let x = 0; x < W; x += 80) o += `<path d="M${x},${GROUND + 2} L${x - 30},${H}" stroke="${line}" stroke-width="2"/>`; return o + `<rect x="0" y="${GROUND - 6}" width="${W}" height="6" fill="#00000018"/>`; },
  window(x, y, w, h) { return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="#bfe3ff" stroke="#fff" stroke-width="8"/><path d="M${x + w / 2},${y} L${x + w / 2},${y + h} M${x},${y + h / 2} L${x + w},${y + h / 2}" stroke="#fff" stroke-width="6"/><circle cx="${x + w * .75}" cy="${y + h * .3}" r="12" fill="#ffe27a"/>`; },
  doorway(x, y, w) { return `<rect x="${x}" y="${y}" width="${w}" height="${GROUND - y}" fill="#c9b79c"/><rect x="${x + 10}" y="${y + 10}" width="${w - 20}" height="${GROUND - y - 10}" fill="#8f7f6a"/><rect x="${x + 10}" y="${y + 10}" width="${w - 20}" height="${GROUND - y - 10}" fill="url(#wallg)" opacity=".35"/>`; },
  chairBack(x, seatY, c) { return `<rect x="${x - 34}" y="${seatY - 78}" width="68" height="14" rx="6" fill="${c}"/><rect x="${x - 30}" y="${seatY - 70}" width="8" height="70" fill="${c}"/><rect x="${x + 22}" y="${seatY - 70}" width="8" height="70" fill="${c}"/>`; },
  chairSeat(x, seatY, c) { return `<rect x="${x - 38}" y="${seatY}" width="76" height="11" rx="4" fill="${c}"/><rect x="${x - 34}" y="${seatY + 10}" width="7" height="${GROUND - seatY - 10}" fill="${c}"/><rect x="${x + 27}" y="${seatY + 10}" width="7" height="${GROUND - seatY - 10}" fill="${c}"/>`; },
  chairFull(x, seatY, c) { return D.chairBack(x, seatY, c) + D.chairSeat(x, seatY, c); },
  desk(x0, x1, top, c) { return `<rect x="${x0 - 8}" y="${top - 2}" width="${x1 - x0 + 16}" height="14" rx="4" fill="${c}"/><rect x="${x0}" y="${top + 12}" width="${x1 - x0}" height="${GROUND - top - 6}" fill="${c}"/><rect x="${x0 + 10}" y="${top + 24}" width="${x1 - x0 - 20}" height="${GROUND - top - 34}" rx="4" fill="#00000012"/>`; },
  table(x0, x1, top, c) { return `<rect x="${x0 - 8}" y="${top - 2}" width="${x1 - x0 + 16}" height="13" rx="4" fill="${c}"/><rect x="${x0 + 4}" y="${top + 10}" width="10" height="${GROUND - top - 10}" fill="${c}"/><rect x="${x1 - 14}" y="${top + 10}" width="10" height="${GROUND - top - 10}" fill="${c}"/>`; },
  organizer(x, top, open) { const y = top - 46; return `<rect x="${x}" y="${y}" width="64" height="46" rx="4" fill="#d08c60" stroke="#00000030"/>${open > .02 ? `<rect x="${x + 6}" y="${y + 12}" width="52" height="${f1(9 * open)}" fill="#3b2a20"/>` : ''}<rect x="${x + 5}" y="${f1(y + 14 + 9 * open)}" width="54" height="24" rx="3" fill="#e2a476" stroke="#00000035"/><rect x="${x + 25}" y="${f1(y + 23 + 9 * open)}" width="14" height="5" rx="2" fill="#7a4a2a"/>`; },
  door(x, y, w, c) { return `<rect x="${x - 8}" y="${y - 8}" width="${w + 16}" height="${GROUND - y + 8}" fill="#e5ddd0"/><rect x="${x}" y="${y}" width="${w}" height="${GROUND - y}" fill="${c}" stroke="#00000040" stroke-width="2"/><rect x="${x + 12}" y="${y + 18}" width="${w - 24}" height="70" rx="4" fill="#00000014"/><rect x="${x + 12}" y="${y + 110}" width="${w - 24}" height="90" rx="4" fill="#00000014"/><rect x="${x}" y="${GROUND - 5}" width="${w}" height="5" fill="#00000055"/>`; },
  handle(x, y) { return `<rect x="${x - 4}" y="${y - 10}" width="8" height="20" rx="3" fill="#c9a227" stroke="#7a6010"/><rect x="${x - 2}" y="${y - 3}" width="18" height="6" rx="3" fill="#e0b92e" stroke="#7a6010"/>`; },
  bench(x0, x1, seat, c) { return `<rect x="${x0}" y="${seat - 52}" width="${x1 - x0}" height="12" rx="4" fill="${c}"/><rect x="${x0}" y="${seat - 32}" width="${x1 - x0}" height="12" rx="4" fill="${c}"/><rect x="${x0 - 6}" y="${seat}" width="${x1 - x0 + 12}" height="12" rx="4" fill="${c}"/><rect x="${x0 + 8}" y="${seat + 10}" width="9" height="${GROUND - seat - 10}" fill="#555"/><rect x="${x1 - 17}" y="${seat + 10}" width="9" height="${GROUND - seat - 10}" fill="#555"/>`; },
  shelf(x0, x1, top, c) { return `<rect x="${x0}" y="${top}" width="${x1 - x0}" height="${GROUND - top}" fill="${c}" stroke="#00000030"/><rect x="${x0 - 5}" y="${top - 8}" width="${x1 - x0 + 10}" height="10" rx="3" fill="${c}"/><rect x="${x0 + 8}" y="${top + 16}" width="${x1 - x0 - 16}" height="34" rx="3" fill="#00000014"/><rect x="${x0 + 8}" y="${top + 58}" width="${x1 - x0 - 16}" height="30" rx="3" fill="#00000014"/>`; },
  envelope(x, y, flap, r, sc) {
    sc = sc || 1; const w = 62, h = 40;
    const tip = -h / 2 + 22 * (1 - 2 * flap);
    return `<g transform="translate(${f1(x)},${f1(y)}) rotate(${f1(r || 0)}) scale(${sc})"><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="3" fill="#f5e2b8" stroke="#a07c3a" stroke-width="1.6"/><path d="M${-w / 2},${h / 2} L0,4 L${w / 2},${h / 2}" fill="none" stroke="#c9a564" stroke-width="1.2"/><path d="M${-w / 2},${-h / 2} L0,${f1(tip)} L${w / 2},${-h / 2} Z" fill="${flap > .5 ? '#efd59e' : '#f8e8c4'}" stroke="#a07c3a" stroke-width="1.6" stroke-linejoin="round"/><circle cx="18" cy="8" r="5" fill="#d94f4f" opacity="${flap > .5 ? 0 : .9}"/></g>`;
  },
  letter(x, y, fold, r, vis, text, sc) {
    if (vis <= .01) return '';
    sc = sc == null ? 1 : sc; const w0 = 112, h = 76, w = w0 * (1 - .5 * fold);
    let o = `<g transform="translate(${f1(x)},${f1(y)}) rotate(${f1(r || 0)}) scale(${f1(sc)})" opacity="${f1(Math.min(1, vis))}">`;
    o += `<rect x="${f1(-w0 / 2)}" y="${-h / 2}" width="${f1(w)}" height="${h}" rx="3" fill="#ffffff" stroke="#7d8597" stroke-width="1.6"/>`;
    if (fold < .35 && text) o += `<text x="${f1(-w0 / 2 + w / 2)}" y="6" text-anchor="middle" direction="rtl" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" fill="#1d3557">${esc(text)}</text>`;
    else if (fold < .35) o += `<g stroke="#9aa5b8" stroke-width="2.4" stroke-linecap="round"><path d="M${-w0 / 2 + 14},-16 h${f1(w - 28)}"/><path d="M${-w0 / 2 + 14},-4 h${f1(w - 40)}"/><path d="M${-w0 / 2 + 14},8 h${f1(w - 30)}"/><path d="M${-w0 / 2 + 30},20 h${f1(w - 44)}"/></g>`;
    if (fold > .02) { const fw = w0 / 2 * fold; o += `<rect x="${f1(-w0 / 2 + w - fw)}" y="${-h / 2}" width="${f1(fw)}" height="${h}" rx="2" fill="#eef1f6" stroke="#7d8597" stroke-width="1.6"/>`; }
    return o + '</g>';
  },
  box(x, y, lid, sc) { // y = תחתית הקופסה
    sc = sc || 1; let o = `<g transform="translate(${f1(x)},${f1(y)}) scale(${sc})">`;
    o += `<rect x="-46" y="-34" width="92" height="34" rx="4" fill="#4f7cac" stroke="#2c4a6e" stroke-width="2"/><rect x="-46" y="-34" width="92" height="7" fill="#00000020"/>`;
    o += `<g font-family="Arial" font-size="10" fill="#ffffffcc"><rect x="-36" y="-22" width="72" height="12" rx="3" fill="#ffffff30"/></g>`;
    return o + '</g>';
  },
  pencils(x, y, vis) { if (vis <= .01) return ''; const cols = ['#e63946', '#f4a261', '#2a9d8f', '#8338ec', '#ffbe0b', '#3a86ff']; let o = `<g opacity="${f1(vis)}">`; cols.forEach((c, i) => { const px = x - 36 + i * 14; o += `<rect x="${px}" y="${y - 46}" width="9" height="16" fill="${c}"/><path d="M${px},${y - 46} L${px + 4.5},${y - 55} L${px + 9},${y - 46} Z" fill="#f1d6a8"/><path d="M${px + 3},${y - 51} L${px + 4.5},${y - 55} L${px + 6},${y - 51}Z" fill="#333"/>`; }); return o + '</g>'; },
  lid(x, y, r) { return `<g transform="translate(${f1(x)},${f1(y)}) rotate(${f1(r || 0)})"><rect x="-49" y="-6" width="98" height="12" rx="4" fill="#5d8fc4" stroke="#2c4a6e" stroke-width="2"/><rect x="-16" y="-3" width="32" height="5" rx="2" fill="#ffffff55"/></g>`; },
  bird(x, y, wing, vis, sc) {
    if (vis <= .01) return ''; sc = (sc || 1) * (.3 + .7 * Math.min(1, vis));
    const wy = -24 * wing, wx = 30 + 10 * wing;
    return `<g transform="translate(${f1(x)},${f1(y)}) scale(${f1(sc)})"><path d="M-6,-4 L${f1(-wx)},${f1(wy - 4)} L-8,8 Z" fill="#ffd6e0" stroke="#c2185b" stroke-width="1.5" stroke-linejoin="round"/><path d="M6,-4 L${f1(wx)},${f1(wy - 4)} L8,8 Z" fill="#ffd6e0" stroke="#c2185b" stroke-width="1.5" stroke-linejoin="round"/><path d="M-14,10 L0,-12 L16,8 L2,16 Z" fill="#ffb3c6" stroke="#c2185b" stroke-width="1.6" stroke-linejoin="round"/><path d="M0,-12 L-4,-22 L8,-16 Z" fill="#ffb3c6" stroke="#c2185b" stroke-width="1.5"/><path d="M8,-16 L15,-15 L8,-12Z" fill="#f4a261"/><circle cx="2" cy="-15" r="1.8" fill="#222"/></g>`;
  },
  ticket(x, y, fold, r, sc, col) {
    sc = sc || 1; col = col || '#ffbe0b'; const w0 = 50, h = 26, w = w0 * (1 - .5 * fold);
    let o = `<g transform="translate(${f1(x)},${f1(y)}) rotate(${f1(r || 0)}) scale(${sc})">`;
    o += `<rect x="${-w0 / 2}" y="${-h / 2}" width="${f1(w)}" height="${h}" rx="3" fill="${col}" stroke="#8a5a00" stroke-width="1.5"/>`;
    if (fold < .4) o += `<path d="M${-w0 / 2 + 34},${-h / 2 + 2} v${h - 4}" stroke="#8a5a00" stroke-dasharray="2 3"/><path d="M${-w0 / 2 + 14},-1 l3,-6 l3,6 l6,0 l-5,4 l2,6 l-6,-4 l-6,4 l2,-6 l-5,-4z" fill="#fff8" />`;
    if (fold > .02) { const fw = w0 / 2 * fold; o += `<rect x="${f1(-w0 / 2 + w - fw)}" y="${-h / 2}" width="${f1(fw)}" height="${h}" rx="2" fill="${col}" stroke="#8a5a00" stroke-width="1.5"/><rect x="${f1(-w0 / 2 + w - fw)}" y="${-h / 2}" width="${f1(fw)}" height="${h}" rx="2" fill="#00000022"/>`; }
    return o + '</g>';
  },
  ball(x, y) { return `<g transform="translate(${f1(x)},${f1(y)})"><circle r="17" fill="#ef476f" stroke="#9d1d3d" stroke-width="2"/><path d="M-17,0 Q0,-10 17,0 M-12,-12 Q0,0 -12,12 M12,-12 Q0,0 12,12" stroke="#fff" stroke-width="2.4" fill="none"/></g>`; },
  book(x, y, r) { return `<g transform="translate(${f1(x)},${f1(y)}) rotate(${f1(r || 0)})"><rect x="-30" y="-21" width="60" height="42" rx="3" fill="#2a9d8f" stroke="#14544c" stroke-width="2"/><rect x="-30" y="-21" width="8" height="42" fill="#1f7a6f"/><rect x="-14" y="-10" width="34" height="7" rx="2" fill="#ffffffaa"/></g>`; },
  block(x, y, r, c) { return `<g transform="translate(${f1(x)},${f1(y)}) rotate(${f1(r || 0)})"><rect x="-14" y="-14" width="28" height="28" rx="3" fill="${c}" stroke="#00000055" stroke-width="1.6"/><rect x="-9" y="-9" width="18" height="18" rx="2" fill="#ffffff30"/></g>`; },
  clock(x, y, m) { const a = m * DEG; return `<g transform="translate(${x},${y})"><rect x="-4" y="30" width="8" height="${GROUND - y - 30}" fill="#555"/><circle r="32" fill="#fff" stroke="#333" stroke-width="5"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => { const q = i * 30 * DEG; return `<path d="M${f1(Math.sin(q) * 24)},${f1(-Math.cos(q) * 24)} L${f1(Math.sin(q) * 28)},${f1(-Math.cos(q) * 28)}" stroke="#333" stroke-width="2"/>`; }).join('')}<path d="M0,0 L${f1(Math.sin(a / 12 + 2.1) * 14)},${f1(-Math.cos(a / 12 + 2.1) * 14)}" stroke="#333" stroke-width="4" stroke-linecap="round"/><path d="M0,0 L${f1(Math.sin(a) * 22)},${f1(-Math.cos(a) * 22)}" stroke="#d62828" stroke-width="2.6" stroke-linecap="round"/><circle r="3" fill="#333"/></g>`; },
  intruderArm(x, y) { return `<g><path d="M${W + 20},${f1(y - 6)} L${f1(x + 14)},${f1(y)}" stroke="#7b6d8d" stroke-width="22" stroke-linecap="round"/><path d="M${f1(x + 22)},${f1(y)} L${f1(x + 6)},${f1(y)}" stroke="#c68e6a" stroke-width="13" stroke-linecap="round"/><circle cx="${f1(x)}" cy="${f1(y)}" r="10" fill="#c68e6a" stroke="#00000040"/><ellipse cx="${f1(x + 2)}" cy="${f1(y - 9)}" rx="4" ry="3" fill="#c68e6a" stroke="#00000030"/></g>`; },
  plant(x) { return `<g transform="translate(${x},${GROUND})"><rect x="-16" y="-34" width="32" height="34" rx="4" fill="#c46b3c"/><path d="M0,-34 C-30,-70 -10,-90 0,-60 C8,-95 30,-70 0,-34 M0,-40 C20,-60 40,-50 30,-40" fill="#43aa8b"/></g>`; },
  board(x, y, w, h) { return `<rect x="${x - 8}" y="${y - 8}" width="${w + 16}" height="${h + 16}" rx="4" fill="#8d6e63"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#2f5d50"/><path d="M${x + 30},${y + 40} q40,-20 80,0 t80,0" stroke="#ffffff70" stroke-width="3" fill="none"/><rect x="${x + 20}" y="${y + h - 6}" width="30" height="5" fill="#fff"/>`; },
  tree(x) { return `<g><rect x="${x - 9}" y="230" width="18" height="${GROUND - 230}" fill="#8d6e4a"/><circle cx="${x}" cy="210" r="48" fill="#52b788"/><circle cx="${x - 30}" cy="232" r="30" fill="#40916c"/><circle cx="${x + 32}" cy="228" r="32" fill="#40916c"/></g>`; },
  sign(x, y, txt) { return `<g><rect x="${x - 4}" y="${y + 20}" width="8" height="${GROUND - y - 20}" fill="#6d4c41"/><rect x="${x - 58}" y="${y - 16}" width="116" height="40" rx="6" fill="#ffd166" stroke="#8a5a00" stroke-width="2.5"/><text x="${x}" y="${y + 11}" text-anchor="middle" direction="rtl" font-family="Arial" font-size="19" font-weight="700" fill="#5a3b00">${esc(txt)}</text></g>`; }
};

/* ---------------- הרכבת במה ---------------- */
function stageInner(tl, setup, t, opt) {
  const s = computeState(tl, t), K = kin(s);
  let o = setup.bgStr || '';
  if (setup.back) o += setup.back(s, K, t);
  o += drawChar(s, CHARS[setup.charId] || CHARS.uri);
  if (setup.front) o += setup.front(s, K, t);
  if (setup.top) o += setup.top(s, K, t);
  if (!(opt && opt.noBubbles)) for (const bs of bubbleStates(tl, t)) o += bubbleSVG(bs, K);
  return o;
}
function stageSVG(tl, setup, t, w, h, extra) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${w || W}" height="${h || H}" ${extra || ''}>${stageInner(tl, setup, t)}</svg>`;
}

/* ---------------- צלילים ---------------- */
const Sound = {
  ctx: null, muted: false, live: new Set(), noise: null,
  ensure() {
    try { if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) this.ctx = new AC(); } if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); } catch (e) { this.ctx = null; }
  },
  _noise() { if (this.noise) return this.noise; const c = this.ctx, b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return (this.noise = b); },
  _track(n, end) { this.live.add(n); n.onended = () => this.live.delete(n); try { n.stop(end); } catch (e) { } },
  _env(g, t, a, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); },
  noiseHit(t, dur, type, freq, peak, q) {
    const c = this.ctx, src = c.createBufferSource(); src.buffer = this._noise();
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || .8;
    const g = c.createGain(); this._env(g, t, .01, peak, dur);
    src.connect(f); f.connect(g); g.connect(c.destination); src.start(t, Math.random() * .5); this._track(src, t + dur + .05);
  },
  tone(t, dur, f0, f1v, type, peak) {
    const c = this.ctx, o = c.createOscillator(); o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1v, t + dur);
    const g = c.createGain(); this._env(g, t, .008, peak, dur); o.connect(g); g.connect(c.destination); o.start(t); this._track(o, t + dur + .05);
  },
  play(name, vol) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime + .01, v = (vol == null ? 1 : vol) * .5;
    try {
      if (name === 'paper') { for (let i = 0; i < 4; i++) this.noiseHit(t + i * .06, .09, 'bandpass', 2600 + i * 500, .18 * v, .6); }
      else if (name === 'click') { this.noiseHit(t, .04, 'highpass', 2500, .3 * v); this.tone(t, .05, 1200, 600, 'square', .04 * v); }
      else if (name === 'blocks') { for (let i = 0; i < 5; i++) { this.tone(t + i * .09, .1, 260 - i * 20, 90, 'triangle', .32 * v); this.noiseHit(t + i * .09, .06, 'lowpass', 1200, .14 * v); } }
      else if (name === 'chirp') { this.tone(t, .1, 1900, 3300, 'sine', .22 * v); this.tone(t + .14, .12, 2100, 3600, 'sine', .2 * v); }
      else if (name === 'scrape') { for (let i = 0; i < 6; i++) this.noiseHit(t + i * .13, .16, 'lowpass', 500 + (i % 2) * 200, .26 * v, 1.2); }
      else if (name === 'knock') { this.tone(t, .12, 170, 90, 'sine', .45 * v); this.noiseHit(t, .05, 'lowpass', 900, .25 * v); }
      else if (name === 'step') { this.noiseHit(t, .05, 'lowpass', 400, .12 * v); }
      else if (name === 'pop') { this.tone(t, .09, 500, 900, 'sine', .18 * v); }
    } catch (e) { }
  },
  stopAll() { for (const n of [...this.live]) { try { n.stop(); } catch (e) { } } this.live.clear(); }
};

/* ---------------- נגן ---------------- */
const Players = new Set();
const Engine = { stepMode: false, stopAll() { for (const p of Players) p.stop(); } };
class Player {
  constructor(host, o) {
    o = o || {}; this.host = host; this.label = o.label || 'במה';
    host.innerHTML = `<svg class="stage-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(this.label)}" xmlns="http://www.w3.org/2000/svg"><g class="dyn"></g></svg>`;
    this.svg = host.querySelector('svg'); this.dyn = this.svg.querySelector('.dyn');
    this.tl = null; this.setup = null; this.t = 0; this.playing = false; this.raf = 0; this.r0 = 0; this.r1 = 0;
    this.onTick = null; this.onState = null; this.onEnd = null; Players.add(this);
  }
  setLabel(l) { this.svg.setAttribute('aria-label', l); }
  load(tl, setup, t) { this.stop(); this.tl = tl; this.setup = setup; this.r0 = 0; this.r1 = tl.dur; this.seek(t == null ? 0 : t); }
  range(a, b) { this.r0 = a; this.r1 = b; }
  render() { if (!this.tl) return; this.dyn.innerHTML = stageInner(this.tl, this.setup, this.t); if (this.onTick) this.onTick(this.t); }
  seek(t) { if (!this.tl) return; this.t = clamp(t, 0, this.tl.dur); this.render(); }
  steps() {
    const ks = new Set();
    (this.tl.keys || []).forEach(k => { if (k >= this.r0 - 1e-6 && k <= this.r1 + 1e-6) ks.add(Math.round(k * 100) / 100); });
    ks.add(Math.round(this.r1 * 100) / 100);
    return [...ks].sort((a, b) => a - b);
  }
  stepIndex() { const st = this.steps(); let i = -1; st.forEach((k, j) => { if (this.t >= k - .02) i = j; }); return { i, n: st.length, st }; }
  step(dir) {
    if (!this.tl) return; this.pause(); Sound.ensure();
    const { i, st } = this.stepIndex(); let j = clamp(i + dir, 0, st.length - 1);
    if (dir > 0 && i < 0) j = 0;
    const t0 = this.t, t1 = st[j];
    if (t1 > t0) for (const sd of this.tl.sounds) if (sd.at > t0 && sd.at <= t1 + 1e-6) Sound.play(sd.name, sd.vol);
    this.seek(t1); this._notify();
  }
  play() {
    if (!this.tl) return; Sound.ensure();
    for (const p of Players) if (p !== this) p.stop();
    if (Engine.stepMode) { if (this.t >= this.r1 - .02 || this.t < this.r0) this.seek(this.r0); this.step(1); return; }
    if (this.t >= this.r1 - .01 || this.t < this.r0 - .01) this.seek(this.r0);
    this.playing = true; this.last = performance.now(); cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this._frame); this._notify();
  }
  _frame = (now) => {
    if (!this.playing) return;
    const dt = Math.min(.05, Math.max(0, (now - this.last) / 1000)); this.last = now;
    const t0 = this.t, t1 = Math.min(this.r1, t0 + dt);
    for (const sd of this.tl.sounds) if (sd.at > t0 && sd.at <= t1) Sound.play(sd.name, sd.vol);
    this.t = t1; this.render();
    if (t1 >= this.r1 - 1e-6) { this.playing = false; this.raf = 0; this._notify(); if (this.onEnd) this.onEnd(); return; }
    this.raf = requestAnimationFrame(this._frame);
  };
  pause() { const was = this.playing; this.playing = false; cancelAnimationFrame(this.raf); this.raf = 0; Sound.stopAll(); if (was) this._notify(); }
  toggle() { if (this.playing) this.pause(); else this.play(); }
  restart() { this.pause(); this.seek(this.r0); this.play(); }
  stop() { this.playing = false; cancelAnimationFrame(this.raf); this.raf = 0; Sound.stopAll(); this._notify(); }
  _notify() { if (this.onState) this.onState(this); }
  destroy() { this.stop(); Players.delete(this); }
}

/* ---------------- הפקת PNG מהבמה ---------------- */
function svgToPngBytes(svgStr, scale) {
  scale = scale || 2;
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = W * scale; c.height = H * scale;
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => { if (!b) return rej(new Error('toBlob')); b.arrayBuffer().then(ab => res(new Uint8Array(ab))); }, 'image/png');
      } catch (e) { rej(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('svg image')); };
    img.src = url;
  });
}
