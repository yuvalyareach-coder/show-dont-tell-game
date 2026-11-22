'use strict';
/* =====================================================================
   חמש סצנות הלמידה: הוראות במה מוגדרות מראש.
   כל סצנה: setup (רקע/חפצים) + בוני ציר זמן לכל גרסה.
   התוכן הטקסטואלי (כוונה, פסקה, רמזים) נמצא ב-data.js.
   ===================================================================== */
const BLOCK_COLORS = ['#e63946', '#f4a261', '#2a9d8f', '#3a86ff', '#ffbe0b'];

function propKeys(k, o) { const r = {}; r[k + '.h'] = 0; r[k + '.side'] = 'B'; r[k + '.ox'] = 0; r[k + '.oy'] = 0; r[k + '.r'] = 0; for (const q in o) r[k + '.' + q] = o[q]; return r; }

/* ---------- סצנה 1: המעטפה ---------- */
function setupS1() {
  return {
    charId: 'uri',
    bgStr: D.wall('#fff1d6', '#fde2b8') + D.window(70, 90, 120, 100) + D.doorway(680, 140, 110) + D.floor('#d9a066', '#c48a52') + D.chairBack(340, 343, '#a0522d'),
    front: s => D.desk(200, 470, 300, '#b5835a') + D.organizer(400, 300, s['dr.open']),
    top: (s, K) => { const e = propPos(s, K, 'env'), l = propPos(s, K, 'let'); return D.envelope(e[0], e[1], s['env.flap'], s['env.r']) + D.letter(l[0], l[1], s['let.fold'], s['let.r'], s['let.vis'], 'אני מגיע בשישי!', s['let.sc']); }
  };
}
function s1Common() {
  const b = Object.assign(charBase(340), { 'c.sit': 1, 'c.ly': .75, 'c.down': .35, 'c.lx': .1, 'dr.open': 0 },
    propKeys('env', { x: 345, y: 282, flap: 0 }), propKeys('let', { x: 345, y: 282, vis: 0, fold: 0, sc: 1 }));
  const t = new TL(b);
  t.initArm('A', 300, 297); t.initArm('B', 385, 297);
  t.armTo(.6, .7, 'A', 340, 284); t.hand(1.1, .2, 'A', .5);
  t.attach(1.35, 'env', 'A');
  t.armTo(1.45, .7, 'A', 332, 262); t.grip(1.45, .7, 'env', 8, -2);
  t.look(1.5, .5, { ly: .35, lx: .2, down: .15 });
  t.armTo(1.7, .6, 'B', 352, 252);
  t.snd(2.35, 'paper'); t.to(2.35, .45, { 'env.flap': 1 });
  const st = t.st(2.9), K = kin(st), ep = propPos(st, K, 'env');
  t.to(2.9, 0, { 'let.x': ep[0], 'let.y': ep[1] - 6, 'let.sc': .4 }); t.to(2.9, .2, { 'let.vis': 1 }); t.to(3.0, .7, { 'let.sc': 1 });
  t.attach(2.95, 'let', 'B');
  t.armTo(3.0, .7, 'B', 408, 262); t.grip(3.0, .7, 'let', 30, 4);
  t.snd(3.0, 'paper', .6);
  t.look(3.0, .6, { lx: .9, ly: .35, turn: .25, down: .1 });
  t.armTo(3.6, .6, 'A', 296, 288); t.detach(4.2, 'env'); t.to(4.25, .2, { 'env.x': 296, 'env.y': 282 });
  t.hand(4.2, .2, 'A', 0); t.armTo(4.3, .4, 'A', 300, 297);
  t.look(4.2, .4, { lx: .5 }); t.look(4.6, .4, { lx: 1 }); t.look(5.0, .3, { lx: .55 });
  t.face(5.5, .3, { wide: 1, bup: .75, open: .28, smile: .35 }, 'out'); t.body(5.5, .3, { sh: 1 }, 'out');
  t.look(5.5, .3, { ly: .2 });
  [.4, 3.9, 5.9].forEach(k => t.key(k));
  return t;
}
function s1A() {
  const t = s1Common();
  t.body(6.15, .4, { sit: 0, sh: .3 }, 'out');
  t.armTo(6.2, .5, 'B', 372, 118, 'out'); t.grip(6.2, .5, 'let', 0, -40);
  t.armRaw(6.2, .4, 'A', 35, 20);
  t.look(6.2, .4, { ly: -.5, lx: .3, down: 0, turn: .1 });
  t.body(6.75, .22, { y: -32 }, 'out'); t.body(6.97, .25, { y: 0 }, 'in');
  t.face(6.8, .3, { open: .4, smile: .7 });
  t.walk(7.5, 1.5, 600, 3); t.look(7.5, .5, { turn: .6, lx: .8, ly: 0 });
  t.snd(7.8, 'step', .5); t.snd(8.3, 'step', .5); t.snd(8.8, 'step', .5);
  t.armTo(7.6, 1.4, 'B', 632, 118); t.armRaw(7.6, .5, 'A', 12, 8);
  t.armTo(9.05, .45, 'B', 655, 268); t.grip(9.05, .45, 'let', 34, 4);
  t.look(9.05, .4, { turn: 1, lx: 1, ly: -.2, tilt: -4 });
  t.say(9.55, 'בשישי! שמעתם? הוא מגיע בשישי!', { style: 'normal', cps: 13, hold: 1.4, dx: -60 });
  t.talk(9.55, 11.9, .42, .15);
  t.look(12.5, .5, { turn: .3, lx: .95, ly: .45, tilt: 3 }); t.face(12.5, .5, { smile: .55, open: 0, wide: .3, bup: .3 });
  t.look(13.2, .4, { lx: .5 }); t.look(13.6, .4, { lx: 1 }); t.look(14.0, .4, { lx: .5 }); t.look(14.4, .4, { lx: 1 });
  t.hold(15.6);
  [7.05, 10.9, 13.9, 15.6].forEach(k => t.key(k));
  return t;
}
function s1B() {
  const t = s1Common();
  t.face(6.1, .6, { open: 0, smile: .2, wide: .3, bup: .2 }); t.body(6.1, .6, { sh: .2 });
  t.armTo(6.2, .6, 'A', 392, 266); t.hand(6.7, .2, 'A', .4);
  t.snd(6.95, 'paper'); t.to(6.9, 1.0, { 'let.fold': 1 }); t.grip(6.9, 1.0, 'let', 14, 4);
  t.armTo(8.0, .5, 'A', 300, 297); t.hand(8.0, .2, 'A', 0);
  t.armTo(8.4, .6, 'B', 432, 282); t.grip(8.4, .6, 'let', 0, -8); t.to(8.4, .6, { 'let.sc': .62 });
  t.look(8.4, .5, { lx: .8, ly: .6, turn: .2 });
  t.snd(9.0, 'click', .6); t.to(9.0, .4, { 'dr.open': 1 }); t.armTo(9.0, .4, 'B', 432, 287);
  t.armTo(9.5, .6, 'B', 432, 276); t.grip(9.5, .6, 'let', 0, -2);
  t.to(10.0, .4, { 'let.vis': 0, 'let.sc': .3 });
  t.snd(10.5, 'click', .8); t.to(10.5, .3, { 'dr.open': 0 }); t.hand(10.5, .2, 'B', 0);
  t.armTo(10.85, .55, 'B', 385, 297);
  t.look(11.0, .5, { lx: 0, ly: .4, turn: 0 });
  t.hold(12.2);
  [7.5, 9.3, 10.2, 12.2].forEach(k => t.key(k));
  return t;
}

/* ---------- סצנה 2: מאחורי הדלת ---------- */
function setupS2() {
  return {
    charId: 'maya',
    bgStr: D.wall('#e3ecfa', '#cfdcf2') + `<rect x="0" y="120" width="${W}" height="10" fill="#b9c8e3"/><circle cx="300" cy="70" r="16" fill="#fff7c2" stroke="#c9b458"/>` + D.door(590, 160, 100, '#9c6644') + D.handle(604, 272) + D.floor('#b8c4d6', '#a3b1c7') + D.plant(60),
    back: null, front: null, top: null
  };
}
function s2Common() {
  const t = new TL(Object.assign(charBase(110), { 'c.turn': .5, 'c.lx': .8 }));
  t.walk(.4, 3.0, 520, 6.25); t.snd(.9, 'step', .4); t.snd(1.7, 'step', .4); t.snd(2.5, 'step', .4);
  t.body(.4, .1, { wamp: 1 });
  t.snd(3.1, 'scrape');
  t.say(3.1, 'חררר...', { who: 'x', style: 'sound', x: 640, y: 150, cps: 6, hold: 1.8 });
  t.body(3.4, .15, { lean: -3 }, 'out'); t.look(3.4, .2, { turn: .7, lx: 1, ly: -.1 }, 'out'); t.face(3.4, .2, { wide: .35 }, 'out');
  // הרגל נשארת באוויר רגע, ואז יורדת
  t.walk(4.4, .3, 520, .25, 'io'); t.body(4.4, .3, { lean: 0 });
  t.armTo(4.75, .6, 'A', 516, 300); t.hand(5.1, .25, 'A', 1); t.body(5.1, .3, { aAsl: .9 });
  t.armTo(6.0, .9, 'B', 589, 266, 'out'); t.hand(6.0, .3, 'B', 0);
  t.armTo(7.6, .8, 'B', 530, 262); t.hand(7.8, .3, 'B', .6);
  t.body(7.6, .6, { sh: .3 });
  [1.5, 3.7, 5.6, 7.1, 8.2].forEach(k => t.key(k));
  return t;
}
function s2A() {
  const t = s2Common();
  t.walk(8.8, .8, 478, -1, 'io'); t.body(8.8, .4, { lean: -4 }); t.body(9.3, .4, { lean: 0 }); t.snd(9.1, 'step', .3);
  t.look(9.9, .5, { turn: -.55, lx: 1, ly: 0, tilt: 5 });
  t.say(10.5, 'אתה בא איתי?', { style: 'quiet', cps: 9, hold: 1.7, dx: -40 });
  t.talk(10.5, 11.9, .14, 0);
  t.hold(14);
  [9.7, 11.9, 14].forEach(k => t.key(k));
  return t;
}
function s2B() {
  const t = s2Common();
  t.walk(8.6, .8, 548, 1, 'io');
  t.body(9.4, .6, { lean: 10 }); t.look(9.4, .6, { turn: .9, tilt: 16, lx: .6, ly: .2 });
  t.say(10.4, 'מי שם?', { style: 'normal', cps: 10, hold: 2 });
  t.talk(10.4, 11.1, .32, 0);
  t.hold(13.4);
  [10.0, 11.2, 13.4].forEach(k => t.key(k));
  return t;
}

/* ---------- סצנה 3: המגדל ---------- */
function setupS3() {
  return {
    charId: 'eitan',
    bgStr: D.wall('#f1f7ee', '#dfeadb') + D.board(70, 60, 270, 140) + D.window(560, 70, 150, 110) + D.floor('#c9b18f', '#b49a76'),
    front: s => D.table(360, 620, 300, '#d4a373'),
    top: (s, K) => {
      let o = '';
      for (let i = 1; i <= 5; i++) { const p = propPos(s, K, 'b' + i); o += D.block(p[0], p[1], s['b' + i + '.r'], BLOCK_COLORS[i - 1]); }
      if (s['hand.x'] < W + 10) o += D.intruderArm(s['hand.x'], s['hand.y']);
      return o;
    }
  };
}
function s3Common() {
  const b = Object.assign(charBase(380), { 'c.lx': .6, 'c.ly': -.4, 'c.turn': .2, 'hand.x': 880, 'hand.y': 272 });
  [286, 258, 230, 202].forEach((y, i) => Object.assign(b, propKeys('b' + (i + 1), { x: 470, y })));
  Object.assign(b, propKeys('b5', { x: 462, y: 160, h: 1, side: 'B', ox: 4, oy: -9 }));
  const t = new TL(b);
  t.initArm('A', 350, 296); t.initArm('B', 452, 170);
  t.armTo(.3, 1.0, 'B', 466, 183); t.hand(.3, .2, 'B', .5);
  t.detach(1.3, 'b5'); t.to(1.32, .15, { 'b5.x': 470, 'b5.y': 174 }); t.snd(1.32, 'click', .5);
  t.armTo(1.5, .6, 'B', 440, 296); t.hand(1.5, .2, 'B', 0);
  t.face(1.5, .5, { smile: .25 });
  t.to(2.2, .8, { 'hand.x': 505, 'hand.y': 268 }, 'out');
  t.to(3.0, .3, { 'hand.x': 487, 'hand.y': 266 }, 'lin');
  t.snd(3.05, 'blocks');
  const fall = [[452, 286, -8], [418, 286, 22], [522, 286, -30], [565, 384, 62], [402, 384, -48]];
  fall.forEach((f, i) => { const k = 'b' + (i + 1); t.to(3.05 + i * .04, .7, { [k + '.x']: f[0], [k + '.r']: f[2] }, 'out'); t.to(3.05 + i * .04, .85, { [k + '.y']: f[1] }, 'bounce'); });
  t.to(3.4, .5, { 'hand.x': 560, 'hand.y': 262 });
  t.face(3.15, .15, { smile: 0 }, 'out');
  t.look(4.0, .6, { down: .5, ly: .9, lx: .3, turn: .1 });
  [1.4, 3.3, 4.8].forEach(k => t.key(k));
  return t;
}
function s3A() {
  const t = s3Common();
  t.look(5.6, .6, { down: 0, ly: -.1, lx: 1, turn: .6 });
  t.face(6.4, .4, { bin: 1, tight: 1, smile: -.15 }, 'out');
  t.armTo(7.3, .6, 'A', 362, 294); t.armTo(7.3, .6, 'B', 432, 294); t.hand(7.3, .5, 'A', 1); t.hand(7.3, .5, 'B', 1);
  t.body(7.3, .6, { sh: .35 });
  t.to(8.2, .3, { 'c.puff': 1 }); t.body(8.2, .5, { sh: .1 }); t.to(8.5, .5, { 'c.puff': 0 });
  t.say(10.6, 'עוד. לא. סיימתי.', { style: 'normal', reveal: 'words', gaps: [0, .9, 1.8], hold: 2.2 });
  [10.6, 11.5, 12.4].forEach(k => { t.to(k, .12, { 'c.open': .3, 'c.tight': .4 }); t.to(k + .3, .12, { 'c.open': 0, 'c.tight': 1 }); });
  t.hold(15);
  [6.9, 8.4, 9.8, 11.6, 12.9, 15].forEach(k => t.key(k));
  return t;
}
function s3B() {
  const t = s3Common();
  t.body(5.8, 1.2, { sh: -1 }); t.look(5.8, 1.2, { down: .8, ly: 1, lx: 0, turn: 0, tilt: 6 });
  t.armRaw(5.9, 1.0, 'A', 6, 4); t.armRaw(5.9, 1.0, 'B', 6, 4);
  t.say(9.5, 'עוד. לא. סיימתי.', { style: 'quiet', reveal: 'words', gaps: [0, 1.6, 3.2], hold: 2 });
  [9.5, 11.1, 12.7].forEach(k => { t.to(k, .2, { 'c.open': .12 }); t.to(k + .45, .2, { 'c.open': 0 }); });
  t.hold(15);
  [7.2, 10.2, 13.2, 15].forEach(k => t.key(k));
  return t;
}

/* ---------- סצנה 4: הכיסא הריק ---------- */
function setupS4() {
  return {
    charId: 'lia',
    bgStr: `<rect x="0" y="0" width="${W}" height="${GROUND}" fill="#d7f0fb"/><circle cx="690" cy="60" r="26" fill="#ffe27a"/>` + D.tree(640) +
      `<rect x="0" y="${GROUND - 4}" width="${W}" height="${H - GROUND + 4}" fill="#8fd18a"/><path d="M520,${H} L${W},${GROUND - 2} L${W},${H} Z" fill="#e9d8a6"/><path d="M560,${H} C640,430 720,410 ${W},${GROUND + 6}" stroke="#d4c08a" stroke-width="3" fill="none"/>` +
      D.sign(120, 220, 'הצגה') + D.chairFull(430, 343, '#6c757d') + D.chairBack(330, 343, '#6c757d'),
    back: s => D.chairSeat(330, 343, '#6c757d'),
    top: (s, K) => { const a = propPos(s, K, 't1'), b = propPos(s, K, 't2'); return D.clock(70, 120, s['clock.m']) + D.ticket(a[0], a[1], 0, s['t1.r'], 1, '#ffbe0b') + D.ticket(b[0], b[1], s['t2.fold'], s['t2.r'], 1, '#ffbe0b'); }
  };
}
function s4Common() {
  const b = Object.assign(charBase(330), { 'c.sit': 1, 'c.turn': .7, 'c.lx': 1, 'c.ly': -.1, 'clock.m': 0 },
    propKeys('t1', { x: 0, y: 0, h: 1, side: 'A', ox: 0, oy: -10 }), propKeys('t2', { x: 0, y: 0, h: 1, side: 'B', ox: 0, oy: -10, fold: 0 }));
  const t = new TL(b);
  t.initArm('A', 312, 328); t.initArm('B', 352, 328);
  t.to(0, 20, { 'clock.m': 42 }, 'lin');
  t.look(2.3, .5, { turn: -.6, lx: -1, ly: -.8, tilt: -6 });
  t.look(4.4, .5, { turn: .7, lx: 1, ly: -.1, tilt: 0 });
  t.body(6.2, 1.4, { sh: -1 }); t.look(6.2, 1.4, { down: .25 });
  [1.0, 3.3, 5.2, 7.4].forEach(k => t.key(k));
  return t;
}
function s4A() {
  const t = s4Common();
  t.armTo(7.8, .5, 'A', 344, 318); t.look(7.8, .5, { turn: .1, lx: .3, ly: .8 });
  t.snd(8.3, 'paper', .6); t.snd(9.0, 'paper', .5); t.to(8.3, 1.3, { 't2.fold': 1 });
  t.armTo(9.7, .4, 'A', 312, 328);
  t.body(10.0, 1.0, { lean: 12 }); t.armTo(10.0, 1.0, 'B', 414, 334); t.look(10.0, .8, { turn: .5, lx: 1, ly: .6 });
  t.detach(11.0, 't2'); t.to(11.05, .2, { 't2.x': 422, 't2.y': 337 });
  t.armTo(11.2, .4, 'B', 414, 326);
  t.armTo(11.6, 1.2, 'B', 436, 328); t.to(11.6, 1.2, { 't2.fold': .25 });
  t.body(12.9, .5, { lean: 0 }); t.armTo(12.9, .5, 'B', 352, 328);
  t.say(13.6, 'שמרתי לך מקום.', { style: 'normal', cps: 10, hold: 1.5 });
  t.talk(13.6, 15.0, .28, 0);
  t.armTo(17.4, .6, 'B', 418, 333); t.body(17.4, .6, { lean: 12 });
  t.attach(18.0, 't2', 'B'); t.grip(18.0, .6, 't2', 0, -10);
  t.armTo(18.1, .7, 'B', 352, 328); t.body(18.1, .7, { lean: 0 });
  t.look(18.9, .6, { turn: -.6, lx: -1, ly: .4, down: .35 });
  t.hold(20);
  [9.3, 11.3, 12.3, 15.0, 16.6, 18.6, 20].forEach(k => t.key(k));
  return t;
}
function s4B() {
  const t = s4Common();
  t.say(7.9, 'ליה!', { who: 'x', style: 'normal', x: 735, y: 190, tx: 800, ty: 230, cps: 8, hold: 2.2 });
  t.body(8.2, .4, { sh: .5 }, 'out'); t.look(8.2, .4, { down: 0, turn: .8, lx: 1, ly: -.3 }, 'out'); t.face(8.2, .4, { smile: .75, wide: .3, bup: .3 });
  t.armTo(8.6, .5, 'B', 384, 150, 'out'); t.grip(8.6, .5, 't2', 0, -14);
  const s0 = t.st(9.1)['c.aBs'];
  [0, 1, 2, 3].forEach(i => { t.to(9.1 + i * .36, .18, { 'c.aBs': s0 + 16 }); t.to(9.28 + i * .36, .18, { 'c.aBs': s0 - 6 }); });
  t.hold(11.5);
  [8.5, 9.4, 11.5].forEach(k => t.key(k));
  return t;
}

/* ---------- סצנה 5: מה יצא מהקופסה? ---------- */
function setupS5(chairDyn) {
  return {
    charId: 'noam',
    bgStr: D.wall('#eaf4f4', '#d6ebea') + D.window(600, 70, 140, 110) + `<rect x="40" y="90" width="130" height="16" fill="#8d6e63"/><rect x="40" y="150" width="130" height="16" fill="#8d6e63"/><rect x="52" y="58" width="16" height="32" fill="#e76f51"/><rect x="70" y="64" width="14" height="26" fill="#2a9d8f"/><rect x="86" y="54" width="18" height="36" fill="#e9c46a"/><rect x="60" y="120" width="20" height="30" fill="#457b9d"/><rect x="82" y="126" width="14" height="24" fill="#f4a261"/>` + D.floor('#cfa77a', '#b98f62'),
    back: s => D.chairFull(s['chair.x'], 343, '#4a6fa5'),
    front: s => D.table(330, 600, 310, '#c08552'),
    top: (s, K) => {
      const l = propPos(s, K, 'lid'), b = propPos(s, K, 'bird');
      return D.box(455, 310) + D.pencils(455, 310, s['pen.vis']) + D.bird(b[0], b[1], s['bird.wing'], s['bird.vis']) + D.lid(l[0], l[1], s['lid.r']);
    }
  };
}
function s5Base() {
  const b = Object.assign(charBase(385), { 'c.lx': .5, 'c.ly': .6, 'c.down': .3, 'c.turn': .2, 'pen.vis': 0, 'bird.wing': 0, 'bird.vis': 0, 'chair.x': 290 },
    propKeys('lid', { x: 455, y: 270 }), propKeys('bird', { x: 438, y: 282 }));
  const t = new TL(b);
  t.initArm('A', 355, 300); t.initArm('B', 425, 304);
  t.armTo(.3, .8, 'B', 457, 270); t.hand(.9, .2, 'B', .5);
  t.attach(1.12, 'lid', 'B');
  t.armTo(1.2, .7, 'B', 486, 222); t.grip(1.2, .7, 'lid', 0, 0); t.to(1.2, .7, { 'lid.r': -55 });
  t.to(1.4, .4, { 'pen.vis': 1 }); t.snd(1.25, 'click', .4);
  t.armTo(1.9, .8, 'B', 503, 240, 'in'); t.to(1.9, .8, { 'lid.r': -62 }, 'in');
  t.to(2.2, .5, { 'bird.vis': 1, 'bird.y': 238 }, 'back'); t.to(2.5, .4, { 'bird.wing': 1 }, 'out');
  t.snd(2.6, 'chirp');
  t.say(2.7, 'שלום!', { who: 'x', style: 'normal', x: 405, y: 205, tx: 430, ty: 224, cps: 10, hold: 1.8 });
  t.face(2.75, .2, { wide: 1, bup: 1, open: .32 }, 'out'); t.look(2.75, .2, { lx: .55, ly: -.3, down: 0 }, 'out');
  t.to(4.4, .12, { 'c.close': 1 }); t.to(4.52, .12, { 'c.close': 0 });
  t.look(5.0, .4, { down: .4, ly: 1, lx: .7 });
  t.look(6.2, .4, { down: 0, ly: -.3, lx: .55 });
  [.9, 1.8, 2.9, 4.0].forEach(k => t.key(k));
  return t;
}
function s5Main(t) {
  t = t || s5Base();
  t.say(7.0, 'רגע... את דיברת?', { style: 'normal', cps: 9, hold: 1.8, dx: -70 });
  t.talk(7.0, 8.7, .3, .28);
  t.hold(12);
  [5.4, 9.0, 12].forEach(k => t.key(k));
  return t;
}
function s5A() {
  const t = s5Main();
  t.walk(11.2, 1.0, 418, 1, 'io'); t.face(11.3, .6, { smile: .6, open: 0, wide: .45, bup: .4 });
  t.armTo(12.3, .8, 'A', 426, 236); t.to(12.6, .4, { 'c.aApt': 1, 'c.aAf': .8 });
  t.look(12.3, .5, { lx: .6, ly: -.4 });
  t.hold(14);
  [12.0, 13.3, 14].forEach(k => t.key(k));
  return t;
}
function s5B() {
  const t = s5Main();
  t.walk(11.2, .8, 343, -1, 'io'); t.body(11.2, .4, { lean: -4 }); t.body(11.7, .4, { lean: 0 });
  t.armTo(12.0, .6, 'B', 361, 262); t.to(12.0, .6, { 'lid.r': 82 }); t.grip(12.0, .6, 'lid', -6, -4);
  t.body(12.0, .5, { sh: .6 }); t.face(12.0, .5, { tight: .4, open: .08, smile: 0 });
  t.hold(14);
  [11.9, 12.8, 14].forEach(k => t.key(k));
  return t;
}
/* דוגמאות האתגר למתקדמים — מוצגות רק לבקשת התלמיד */
function exJoy() {
  const t = s5Base();
  t.face(4.6, .3, { smile: .9, open: .5, wide: .6 }); [0, 1, 2].forEach(i => { t.body(4.6 + i * .24, .12, { sh: .45 }); t.body(4.72 + i * .24, .12, { sh: 0 }); });
  t.face(5.5, .3, { open: 0, smile: .7 });
  t.say(5.6, 'עוד פעם,', { style: 'normal', cps: 10, hold: 2, dx: -70 }); t.talk(5.6, 6.4, .3, 0);
  t.walk(6.6, 1.0, 418, 1, 'io');
  t.hold(9);
  [4.8, 6.2, 9].forEach(k => t.key(k));
  return t;
}
function exFear() {
  const t = s5Base();
  t.armTo(4.4, .5, 'A', 310, 270); t.hand(4.8, .2, 'A', 1);
  t.walk(5.0, .7, 359, -.5, 'io'); t.to(5.0, .7, { 'chair.x': 264 }, 'io');
  t.armTo(5.0, .7, 'B', 375, 262); t.to(5.0, .7, { 'lid.r': 82 }); t.grip(5.0, .7, 'lid', -6, -4);
  t.armTo(5.0, .7, 'A', 284, 270);
  t.body(5.0, .5, { sh: .5 }); t.face(5.2, .4, { open: .1, tight: .3 });
  t.say(6.0, 'את... יודעת גם את השם שלי?', { style: 'normal', cps: 11, hold: 2, dx: -40 }); t.talk(6.0, 8.3, .24, .05);
  t.hold(10.5);
  [4.9, 5.9, 8.6, 10.5].forEach(k => t.key(k));
  return t;
}

const SCENE_STAGE = {
  s1: { setup: setupS1, A: s1A, B: s1B },
  s2: { setup: setupS2, A: s2A, B: s2B },
  s3: { setup: setupS3, A: s3A, B: s3B },
  s4: { setup: setupS4, A: s4A, B: s4B },
  s5: { setup: setupS5, A: s5Main, VA: s5A, VB: s5B },
  exJoy: { setup: setupS5, A: exJoy },
  exFear: { setup: setupS5, A: exFear }
};
