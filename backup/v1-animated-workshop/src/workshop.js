'use strict';
/* =====================================================================
   סדנה: מקומות, חפצים, ומהדר שממיר הוראות במה מפורשות לציר זמן.
   כלל: שום תנועה לא נגזרת מטקסט המשפט או מהרגש הפרטי — רק מ-dir.
   ===================================================================== */
const PLACES = {
  room: {
    name: 'חדר', start: 190, rest: [560, 300], door: null,
    bg: () => D.wall('#fff1d6', '#fde2b8') + D.window(60, 80, 120, 100) + D.floor('#d9a066', '#c48a52') + D.plant(745) + D.table(470, 650, 300, '#b5835a'),
  },
  corridor: {
    name: 'מסדרון עם דלת', start: 140, rest: [375, 300], door: { x: 604, y: 272 },
    bg: () => D.wall('#e3ecfa', '#cfdcf2') + `<rect x="0" y="120" width="${W}" height="10" fill="#b9c8e3"/>` + D.door(590, 160, 100, '#9c6644') + D.handle(604, 272) + D.floor('#b8c4d6', '#a3b1c7') + D.shelf(330, 420, 300, '#c8a27a'),
  },
  classroom: {
    name: 'כיתה עם שולחן', start: 190, rest: [540, 300], door: null,
    bg: () => D.wall('#f1f7ee', '#dfeadb') + D.board(60, 60, 250, 130) + D.window(600, 70, 140, 100) + D.floor('#c9b18f', '#b49a76') + D.table(440, 640, 300, '#d4a373'),
  },
  garden: {
    name: 'גינה עם ספסל', start: 180, rest: [530, 320], door: null,
    bg: () => `<rect x="0" y="0" width="${W}" height="${GROUND}" fill="#d7f0fb"/><circle cx="90" cy="60" r="26" fill="#ffe27a"/>` + D.tree(720) + `<rect x="0" y="${GROUND - 4}" width="${W}" height="${H - GROUND + 4}" fill="#8fd18a"/>` + D.bench(420, 640, 322, '#b07d4f'),
  }
};
const PROP_HALF = { envelope: 20, book: 21, box: 0, ticket: 13, ball: 17, tower: 14 };

function drawWProp(kind, s, K, P) {
  const p = propPos(s, K, 'p'); const r = s['p.r'] || 0;
  let o = '';
  if (kind === 'tower') { const [rx, ry] = P.rest; [0, 1, 2].forEach(i => { o += D.block(rx, ry - 14 - i * 28, 0, BLOCK_COLORS[i]); }); return o + D.block(p[0], p[1], r, BLOCK_COLORS[3]); }
  if (kind === 'envelope') {
    if (s['p.lout'] > .01) { const lv = s['p.lout']; o += D.letter(p[0] + 34 * lv, p[1] - 6 - 34 * lv, 0, 8 * lv, Math.min(1, lv * 1.6), '', .4 + .4 * lv); }
    return D.envelope(p[0], p[1], s['p.flap'], r) + o;
  }
  if (kind === 'book') return D.book(p[0], p[1], r);
  if (kind === 'ticket') return D.ticket(p[0], p[1], s['p.fold'], r, 1.15, '#ffbe0b');
  if (kind === 'ball') return D.ball(p[0], p[1]);
  if (kind === 'box') {
    const lid = s['p.lid'];
    o = `<g transform="translate(${f1(p[0])},${f1(p[1])}) rotate(${f1(r)})">`;
    if (lid > .02) o += `<path d="M-46,-33 L46,-33 L38,${f1(-34 - 36 * lid)} L-38,${f1(-34 - 36 * lid)} Z" fill="#9cc0e6" stroke="#2c4a6e" stroke-width="2" stroke-linejoin="round"/><path d="M-30,${f1(-38 - 26 * lid)} L30,${f1(-38 - 26 * lid)}" stroke="#ffffffaa" stroke-width="3" stroke-linecap="round"/>`;
    o += `<rect x="-46" y="-34" width="92" height="34" rx="4" fill="#4f7cac" stroke="#2c4a6e" stroke-width="2"/>`;
    if (lid > .02) o += `<rect x="-42" y="-34" width="84" height="${f1(10 * lid)}" fill="#1d2b3a"/>`;
    if (lid < .98) o += `<rect x="-49" y="${f1(-40 - 26 * lid)}" width="98" height="12" rx="4" fill="#5d8fc4" stroke="#2c4a6e" stroke-width="2" opacity="${f1(1 - lid)}"/>`;
    return o + '</g>';
  }
  return '';
}
function makeSetup(story) {
  const P = PLACES[story.place] || PLACES.room;
  const bgStr = P.bg();
  return { charId: story.charId, bgStr, top: (s, K) => drawWProp(story.prop, s, K, P) };
}
function restCenter(kind, P) { const [x, y] = P.rest; return [x, kind === 'box' ? y : y - PROP_HALF[kind] - (kind === 'tower' ? 84 : 0)]; }

/* פעולות שדורשות חפץ/מקום */
function actionAvailable(id, story) {
  for (const g of Object.values(ACTIONS)) for (const it of g.items) if (it.id === id) {
    if (it.needs && it.needs !== story.prop) return false;
    if (it.needsPlace && it.needsPlace !== story.place) return false;
    return true;
  }
  return false;
}
function emptyDir() { return { actions: [], eyes: 'keep', brows: 'keep', mouth: 'keep', posture: 'keep', pace: 'normal', pause: 'none', speech: null, note: '', narration: false, confirmed: false, confirmedText: '' }; }
function dirHasStage(d) { return !!d && !d.narration && ((d.actions && d.actions.length) || d.eyes !== 'keep' || d.brows !== 'keep' || d.mouth !== 'keep' || d.posture !== 'keep' || (d.speech && d.speech.text)); }
function speechValid(d, text) { return !!(d && d.speech && d.speech.text && String(text || '').includes(d.speech.text)); }

/* ---------------- המהדר ---------------- */
function compileStory(story, override) {
  const P = PLACES[story.place] || PLACES.room, kind = story.prop;
  const rc = restCenter(kind, P);
  const base = Object.assign(charBase(P.start), { 'c.turn': .15 }, propKeys('p', { x: rc[0], y: rc[1], fold: 0, flap: 0, lout: 0, lid: 0 }));
  const tl = new TL(base);
  const nearX = P.rest[0] - 74, doorX = P.door ? P.door.x - 86 : null;
  const L = { x: P.start, held: false, raised: false, chest: false, posture: 'normal', midStep: false, lid: 0, lout: 0, fold: 0, open: 0, look: { turn: .15, lx: 0, ly: 0, down: 0, tilt: 0 }, armB: 'rest', armA: 'rest' };
  const spans = [], frames = [];
  let t = .5;
  const sents = story.sentences || [];
  const st = () => tl.st(t);
  const shY = () => { const K = kin(st()); return K.sAW[1]; };
  const holdPt = () => [L.x + 42, shY() + 40];
  const restArm = (side, dur) => tl.armRaw(t, dur, side, 10, 6, 'io', { ['c.a' + side + 'f']: 0, ['c.a' + side + 'pt']: 0, ['c.a' + side + 'sl']: 0 });
  const footDown = () => { if (L.midStep) { const w = st()['c.walk']; tl.to(t, .3, { 'c.walk': Math.ceil(w * 2) / 2 }); t += .3; L.midStep = false; } };

  function walkTo(x, kindW, Pf) {
    x = clamp(x, 70, 730);
    const dist = Math.abs(x - L.x), sg = Math.sign(x - L.x) || 1;
    footDown();
    const turn0 = L.look.turn;
    tl.look(t, .25, { turn: sg * .5 });
    if (kindW === 'hesitant') {
      const n = 3, part = dist / n; let cx = L.x;
      for (let i = 0; i < n; i++) {
        cx += sg * part; const cyc = Math.max(.5, Math.round(part / 25 * 2) / 2);
        tl.to(t, 0, { 'c.wamp': .45 }); tl.walk(t, Math.max(.5, part / 55) * Pf, cx, sg * cyc > 0 ? cyc : cyc); t += Math.max(.5, part / 55) * Pf; tl.snd(t - .1, 'step', .25); t += .35 * Pf;
      }
    } else if (kindW === 'run') {
      const dur = Math.max(.5, dist / 280) * Pf, cyc = Math.max(1, Math.round(dist / 70 * 2) / 2);
      tl.to(t, 0, { 'c.wamp': 1.4 }); tl.body(t, .2, { lean: sg * 8 }); tl.walk(t, dur, x, cyc); t += dur; tl.body(t, .25, { lean: 0 });
      tl.snd(t - .05, 'step', .6); t += .25;
    } else {
      if (dist < 15) { tl.to(t, 0, { 'c.wamp': 1 }); tl.to(t, .8 * Pf, { 'c.walk': st()['c.walk'] + 1 }, 'lin'); t += .8 * Pf; }
      else { const dur = Math.max(.5, dist / 120) * Pf, cyc = Math.max(1, Math.round(dist / 55 * 2) / 2); tl.to(t, 0, { 'c.wamp': 1 }); tl.walk(t, dur, x, cyc); t += dur; tl.snd(t - .05, 'step', .35); }
    }
    L.x = x;
    tl.look(t, .25, { turn: turn0 }); t += .1;
  }
  function ensureNear(notes) {
    if (L.held) return;
    if (Math.abs(L.x - nearX) > 18) { notes.push('כדי להגיע אל החפץ, הדמות הולכת אליו קודם.'); walkTo(nearX, 'walk', 1); }
  }
  function releaseCross(notes) {
    if (L.posture === 'armsCrossed' || L.posture === 'sleeveGrip') { notes.push('הידיים משתחררות מהתנוחה כדי לבצע את הפעולה.'); restArm('A', .35); tl.body(t, .3, { aAsl: 0 }); if (!L.held) restArm('B', .35); t += .4; L.posture = 'normal'; }
  }
  function pickup(Pf, notes) {
    ensureNear(notes); releaseCross(notes);
    const s0 = st(), K = kin(s0), pp = propPos(s0, K, 'p');
    const grab = [pp[0], pp[1] - (kind === 'box' ? 20 : 2)];
    tl.armTo(t, .6 * Pf, 'B', grab[0], grab[1]); t += .6 * Pf; tl.hand(t - .15, .15, 'B', .55);
    tl.attach(t, 'p', 'B'); t += .12;
    const hp = holdPt(); tl.armTo(t, .55 * Pf, 'B', hp[0], hp[1]); tl.grip(t, .55 * Pf, 'p', kind === 'box' ? 0 : 2, kind === 'box' ? 18 : -2);
    t += .55 * Pf; L.held = true; L.raised = false; L.chest = false;
  }

  sents.forEach((sen, idx) => {
    const d = (override && override.id === sen.id) ? override.dir : sen.dir;
    const text = String(sen.text || '');
    const start = t, notes = [];
    const span = { id: sen.id, start, end: start, kind: 'none', notes, speechT: null };
    if (!dirHasStage(d)) {
      span.kind = d && d.narration ? 'narration' : 'none';
      t += clamp(1.4 + text.trim().length * .045, 2.2, 5.5);
      span.end = t; spans.push(span); tl.key(t - .05); return;
    }
    span.kind = 'stage';
    const Pf = d.pace === 'fast' ? .6 : d.pace === 'slow' ? 1.7 : 1;
    footDown();
    // הבעה ותנוחה בתחילת המשפט
    const fset = {};
    if (d.eyes === 'normal') fset['c.wide'] = 0; if (d.eyes === 'wide') fset['c.wide'] = 1;
    if (d.brows === 'neutral') { fset['c.bup'] = 0; fset['c.bin'] = 0; } if (d.brows === 'up') { fset['c.bup'] = 1; fset['c.bin'] = 0; } if (d.brows === 'together') { fset['c.bin'] = 1; fset['c.bup'] = 0; }
    if (d.mouth === 'neutral') { fset['c.smile'] = 0; L.open = 0; } if (d.mouth === 'smallSmile') { fset['c.smile'] = .6; L.open = 0; } if (d.mouth === 'open') { fset['c.smile'] = 0; L.open = .32; }
    if (d.mouth !== 'keep') fset['c.open'] = L.open;
    if (Object.keys(fset).length) tl.to(t, .3 * Math.min(Pf, 1.2), fset, 'out');
    if (d.posture && d.posture !== 'keep') {
      const pd = .45 * Pf, ps = d.posture;
      if (L.posture === 'sleeveGrip' || L.posture === 'armsCrossed') { tl.body(t, pd, { aAsl: 0, aAf: 0 }); if (!L.held || L.posture === 'armsCrossed') { restArm('A', pd); } }
      if (ps === 'normal') { tl.body(t, pd, { sh: 0, lean: 0 }); if (!L.held) restArm('B', pd); restArm('A', pd); }
      if (ps === 'upright') { tl.body(t, pd, { sh: .55, lean: -2 }); tl.look(t, pd, { down: 0 }); L.look.down = 0; }
      if (ps === 'shouldersDown') { tl.body(t, pd, { sh: -1, lean: 0 }); }
      if (ps === 'armsCrossed') { tl.armRaw(t, pd, 'A', 12, 102, 'io', { 'c.aAf': .6 }); if (!L.held) tl.armRaw(t, pd, 'B', 16, 100, 'io', { 'c.aBf': .6 }); else notes.push('החפץ ביד, לכן רק יד אחת משתלבת.'); }
      if (ps === 'sleeveGrip') { const s0 = st(), K = kin(s0); tl.armTo(t, pd, 'A', L.x + 4, K.sAW[1] + 62, 'io', { 'c.aAf': 1 }); tl.body(t + pd * .6, pd * .5, { aAsl: .9 }); }
      L.posture = ps; t += pd;
    }
    tl.key(t);
    const speech = d.speech && d.speech.text ? d.speech : null;
    const spOK = speech && speechValid(d, text);
    if (speech && !spOK) notes.push('המילים שנבחרו לדיבור כבר לא מופיעות במשפט, לכן הבועה לא תוצג. בחרו אותן מחדש.');
    const vol = spOK ? speech.volume || 'normal' : null;
    const doSpeech = () => {
      const st0 = { quiet: { style: 'quiet', cps: 9, amp: .12 }, normal: { style: 'normal', cps: 14, amp: .3 }, emph: { style: 'emph', cps: 18, amp: .45 } }[vol] || { style: 'normal', cps: 14, amp: .3 };
      const b = tl.say(t, speech.text, { style: st0.style, cps: st0.cps / Math.max(.8, Math.min(Pf, 1.3)), hold: 1.8, dx: L.raised ? -110 : 0 });
      tl.talk(t, b.full, st0.amp, L.open);
      span.speechT = b.full + .15; tl.key(b.full + .1);
      return b;
    };
    let bubble = null;
    if (spOK && d.speechWhen === 'before') { if (d.pause === 'beforeSpeech') t += 1.2 * Pf; bubble = doSpeech(); t = bubble.full + .3; }
    if (d.pause === 'beforeAction' && (d.actions || []).length) t += 1.2 * Pf;
    (d.actions || []).forEach((a, ai) => {
      if (spOK && d.speechWhen === 'with' && ai === 0) { if (d.pause === 'beforeSpeech') t += 1.2 * Pf; const t0 = t; bubble = doSpeech(); t = t0; }
      const id = a.id;
      if (!actionAvailable(id, story)) { notes.push('הפעולה "' + (ACTION_LABEL[id] || id) + '" לא מתאימה לחפץ או למקום שבחרתם, לכן היא לא מוצגת.'); return; }
      const dirTarget = a.dir === 'toDoor' && doorX != null ? doorX : a.dir === 'away' ? P.start : nearX;
      if (id === 'walk' || id === 'hesitant' || id === 'run') walkTo(dirTarget, id, Pf);
      else if (id === 'stopMid') {
        const sg = Math.sign(dirTarget - L.x) || 1, x = clamp(L.x + sg * Math.min(70, Math.max(30, Math.abs(dirTarget - L.x))), 70, 730);
        tl.to(t, 0, { 'c.wamp': 1 }); const w0 = st()['c.walk']; tl.to(t, .8 * Pf, { 'c.x': x, 'c.walk': Math.round(w0) + 1.25 }, 'lin'); t += .8 * Pf; L.x = x; L.midStep = true; t += .6 * Pf;
      }
      else if (id === 'stepBack') {
        const sg = Math.sign(P.rest[0] - L.x) || 1, x = clamp(L.x - sg * 45, 70, 730);
        footDown(); tl.to(t, 0, { 'c.wamp': 1 }); tl.body(t, .3, { lean: -sg * 4 }); tl.walk(t, .7 * Pf, x, -1, 'io'); t += .7 * Pf; tl.body(t, .3, { lean: 0 }); tl.snd(t - .1, 'step', .3); L.x = x; t += .2;
      }
      else if (id === 'jump') { footDown(); tl.body(t, .25 * Pf, { y: -34 }, 'out'); tl.body(t + .25 * Pf, .3 * Pf, { y: 0 }, 'in'); t += .6 * Pf; tl.snd(t - .05, 'step', .5); }
      else if (id === 'reachStop') {
        releaseCross(notes);
        const side = L.held ? 'A' : 'B'; const s0 = st(), K = kin(s0);
        let tgt;
        if (P.door && Math.abs(L.x - doorX) < 40) tgt = [P.door.x - 14, P.door.y - 4];
        else if (!L.held) { const pp = propPos(s0, K, 'p'); tgt = [pp[0], pp[1] - 4]; }
        else tgt = [L.x - 80, K.sAW[1] + 20];
        const sw = side === 'B' ? K.sBW : K.sAW, dx = tgt[0] - sw[0], dy = tgt[1] - sw[1], dd = Math.hypot(dx, dy), reach = Math.min(dd - 14, 80);
        tl.armTo(t, .7 * Pf, side, sw[0] + dx / dd * reach, sw[1] + dy / dd * reach, 'out', { ['c.a' + side + 'f']: 0 }); t += .7 * Pf + .6 * Pf;
        L['arm' + side] = 'reach';
      }
      else if (id === 'handChest') {
        const side = L.held ? 'A' : 'B'; if (side === 'A' && L.posture === 'sleeveGrip') { tl.body(t, .3, { aAsl: 0 }); L.posture = 'normal'; }
        if (L.posture === 'armsCrossed') { restArm(side === 'A' ? 'B' : 'A', .4); L.posture = 'normal'; }
        const K = kin(st()); tl.armTo(t, .6 * Pf, side, L.x + (side === 'B' ? 6 : -6), K.sAW[1] + 30, 'io', { ['c.a' + side + 'f']: .5 }); t += .6 * Pf + .2;
      }
      else if (id === 'headAside') { const o = { turn: -.75, lx: -1, ly: 0, down: 0, tilt: 0 }; tl.look(t, .45 * Pf, o); Object.assign(L.look, o); t += .5 * Pf; }
      else if (id === 'lookDown') { const o = { down: .55, ly: 1, lx: 0, turn: 0, tilt: 4 }; tl.look(t, .5 * Pf, o); Object.assign(L.look, o); t += .55 * Pf; }
      else if (id === 'lookProp') { const s0 = st(), K = kin(s0), pp = propPos(s0, K, 'p'); const sg = Math.sign(pp[0] - L.x) || 1, below = pp[1] > K.headW[1] + 20; const o = { turn: sg * .5, lx: sg * .9, ly: below ? .6 : -.3, down: below ? .25 : 0, tilt: 0 }; tl.look(t, .45 * Pf, o); Object.assign(L.look, o); t += .5 * Pf; }
      else if (id === 'pickup') {
        if (!L.held) pickup(Pf, notes);
        else { releaseCross(notes); const K = kin(st()); tl.armTo(t, .6 * Pf, 'B', L.x + 30, K.headW[1] - 48, 'out'); tl.grip(t, .6 * Pf, 'p', 0, kind === 'box' ? -2 : -12); if (L.chest) restArm('A', .5); t += .6 * Pf + .3; L.raised = true; L.chest = false; }
      }
      else if (id === 'putdown') {
        if (!L.held) { notes.push('החפץ כבר מונח, לכן אין מה להניח.'); return; }
        if (Math.abs(L.x - nearX) > 18) { notes.push('כדי להניח את החפץ במקומו, הדמות הולכת אל המשטח.'); walkTo(nearX, 'walk', 1); }
        if (L.chest) { restArm('A', .4); }
        const tgt = restCenter(kind, P); tl.armTo(t, .6 * Pf, 'B', tgt[0], tgt[1] - (kind === 'box' ? 18 : 0)); tl.grip(t, .6 * Pf, 'p', 0, kind === 'box' ? 18 : 0); t += .6 * Pf;
        tl.detach(t, 'p'); tl.to(t + .05, .2, { 'p.x': tgt[0], 'p.y': tgt[1], 'p.r': 0 }); t += .25; tl.hand(t, .15, 'B', 0);
        restArm('B', .45 * Pf); t += .45 * Pf; L.held = false; L.raised = false; L.chest = false;
      }
      else if (id === 'hug') {
        if (!L.held) { notes.push('כדי להצמיד את החפץ, הדמות מרימה אותו קודם.'); pickup(Pf, notes); }
        const K = kin(st()); tl.armTo(t, .6 * Pf, 'B', L.x + 6, K.sAW[1] + 42); tl.armTo(t, .6 * Pf, 'A', L.x - 4, K.sAW[1] + 50, 'io', { 'c.aAf': .4 }); tl.grip(t, .6 * Pf, 'p', -6, kind === 'box' ? 14 : -6); t += .6 * Pf + .3;
        L.chest = true; L.raised = false;
      }
      else if (id === 'openBox') {
        if (L.lid > .5) { notes.push('הקופסה כבר פתוחה.'); return; }
        if (L.held) { const s0 = st(), K = kin(s0), pp = propPos(s0, K, 'p'); tl.armTo(t, .5 * Pf, 'A', pp[0] - 10, pp[1] - 40); t += .5 * Pf; tl.snd(t, 'click', .5); tl.to(t, .5 * Pf, { 'p.lid': 1 }); tl.armTo(t, .5 * Pf, 'A', pp[0] - 14, pp[1] - 72); t += .5 * Pf; restArm('A', .4); t += .4; }
        else { ensureNear(notes); releaseCross(notes); const s0 = st(), K = kin(s0), pp = propPos(s0, K, 'p'); tl.armTo(t, .6 * Pf, 'B', pp[0] - 6, pp[1] - 42); t += .6 * Pf; tl.snd(t, 'click', .5); tl.to(t, .5 * Pf, { 'p.lid': 1 }); tl.armTo(t, .5 * Pf, 'B', pp[0] - 10, pp[1] - 70); t += .5 * Pf; restArm('B', .45); t += .45; }
        L.lid = 1;
      }
      else if (id === 'readLetter') {
        if (!L.held) { notes.push('כדי לקרוא, הדמות מרימה את המעטפה קודם.'); pickup(Pf, notes); }
        const K = kin(st()); tl.armTo(t, .5 * Pf, 'B', L.x + 58, K.sAW[1] + 50); tl.grip(t, .5 * Pf, 'p', 4, 0); t += .5 * Pf;
        if (L.lout < .5) { tl.snd(t, 'paper'); tl.to(t, .4 * Pf, { 'p.flap': 1 }); t += .4 * Pf; tl.snd(t, 'paper', .6); tl.to(t, .6 * Pf, { 'p.lout': 1 }); t += .6 * Pf; L.lout = 1; }
        const keepLook = Object.assign({}, L.look);
        tl.look(t, .3, { turn: .3, lx: .5, ly: -.3, down: 0 }); t += .3;
        [1, .3, 1, .3].forEach(v => { tl.look(t, .35 * Pf, { lx: v }); t += .35 * Pf; });
        Object.assign(L.look, { turn: .3, lx: .3, ly: -.3, down: 0 }); void keepLook;
      }
      else if (id === 'foldTicket') {
        if (L.fold > .5) { notes.push('הכרטיס כבר מקופל.'); return; }
        if (!L.held) { notes.push('כדי לקפל, הדמות מרימה את הכרטיס קודם.'); pickup(Pf, notes); }
        const s0 = st(), K = kin(s0), pp = propPos(s0, K, 'p');
        tl.armTo(t, .5 * Pf, 'A', pp[0] - 14, pp[1]); t += .5 * Pf; tl.snd(t, 'paper', .7); tl.to(t, .9 * Pf, { 'p.fold': 1 }); t += .9 * Pf; restArm('A', .4); t += .4; L.fold = 1;
      }
      else if (id === 'knockSoft' || id === 'knockHard') {
        if (Math.abs(L.x - doorX) > 18) { notes.push('כדי לנקוש, הדמות הולכת אל הדלת קודם.'); walkTo(doorX, 'walk', 1); }
        releaseCross(notes);
        const side = L.held ? 'A' : 'B', hard = id === 'knockHard', n = hard ? 3 : 2, amp = hard ? 22 : 8;
        const kx = P.door.x + 14, ky = P.door.y - 56;
        if (side === 'A') notes.push('החפץ ביד אחת, לכן הנקישה ביד השנייה.');
        tl.armTo(t, .45 * Pf, side, kx - amp, ky, 'io', { ['c.a' + side + 'f']: 1 }); t += .45 * Pf;
        tl.say(t, hard ? 'טוק! טוק! טוק!' : 'טוק טוק', { who: 'x', style: 'sound', x: P.door.x + 50, y: P.door.y - 92, cps: hard ? 30 : 12, hold: 1.4 });
        for (let i = 0; i < n; i++) { tl.armTo(t, .12, side, kx, ky); t += .12; tl.snd(t, 'knock', hard ? 1 : .35); tl.armTo(t, .16, side, kx - amp, ky); t += hard ? .2 : .28; }
        t += .3; if (side === 'B') restArm('B', .45); else restArm('A', .45); t += .45;
      }
      tl.key(t);
      span['a' + ai] = t;
    });
    if (spOK && (!d.speechWhen || d.speechWhen === 'after')) { if (d.pause === 'beforeSpeech') t += 1.2 * Pf; bubble = doSpeech(); t = bubble.full; }
    if (bubble) t = Math.max(t, bubble.until - .2);
    t += .5; span.end = t; tl.key(t - .05); spans.push(span);
  });
  tl.hold(t + .2);
  return { tl, spans, setup: makeSetup(story) };
}

/* תיאור קצר של ההמחשה (לכותב בלבד) */
function describeDir(d, story) {
  if (!d) return '';
  if (d.narration) return 'קריינות בלבד';
  const parts = [];
  (d.actions || []).forEach(a => parts.push((ACTION_LABEL[a.id] || a.id) + (a.dir && DIRS[a.dir] && ['walk', 'hesitant', 'run', 'stopMid'].includes(a.id) ? ' ' + DIRS[a.dir] : '')));
  const lab = (grp, id) => { const it = FACE[grp].items.find(x => x.id === id); return it ? it.label : ''; };
  if (d.eyes !== 'keep') parts.push(lab('eyes', d.eyes)); if (d.brows !== 'keep') parts.push(lab('brows', d.brows)); if (d.mouth !== 'keep') parts.push(lab('mouth', d.mouth));
  if (d.posture !== 'keep') { const p = POSTURES.find(x => x.id === d.posture); if (p) parts.push(p.label); }
  if (d.pace !== 'normal') parts.push('קצב ' + (PACES.find(x => x.id === d.pace) || {}).label);
  if (d.pause !== 'none') parts.push((PAUSES.find(x => x.id === d.pause) || {}).label);
  if (d.speech && d.speech.text) parts.push('דיבור (' + (VOLUMES.find(x => x.id === d.speech.volume) || VOLUMES[1]).label + ')');
  return parts.join(' · ');
}
function channelsUsed(sentences) {
  const ch = new Set();
  for (const s of sentences) { const d = s.dir; if (!d || d.narration) continue;
    (d.actions || []).forEach(a => { if (ACTIONS.move.items.some(i => i.id === a.id)) ch.add('תנועה'); if (ACTIONS.body.items.some(i => i.id === a.id)) ch.add('גוף ומבט'); if (ACTIONS.obj.items.some(i => i.id === a.id)) ch.add('חפץ'); });
    if (d.eyes !== 'keep' || d.brows !== 'keep' || d.mouth !== 'keep') ch.add('מראה הפנים');
    if (d.posture !== 'keep') ch.add('תנוחת גוף');
    if (d.pace !== 'normal' || d.pause !== 'none') ch.add('קצב ושתיקה');
    if (d.speech && d.speech.text) ch.add('דיבור'); }
  return [...ch];
}
