'use strict';
/* =====================================================================
   האפליקציה: מסכים, מצב התלמיד, שמירה, מצב כיתה וייצוא.
   ===================================================================== */
const APP_ID = 'bein-hashurot';
const STORE_KEY = 'bein-hashurot-v1';
const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const hx = esc;
let S = null, storageOK = true, saveTimer = 0;

function uid() { return 'n' + Math.random().toString(36).slice(2, 8) + (Date.now() % 100000).toString(36); }
function newSentence() { return { id: uid(), text: '', dir: null }; }
function defaultWS() {
  return { step: 0, charId: 'noa', name: 'נועה', gender: 'f', place: 'room', prop: 'envelope', situation: '', sentences: [newSentence(), newSentence(), newSentence()],
    checks: {}, challenge: false, showPrompts: false, editing: null,
    secret: { emo: [], other: '', why: '', a: '', b: '', causeA: '', causeB: '', hidden: '' } };
}
function defaultState() {
  return { v: 1, screen: 'home', settings: { muted: false, steps: false }, learn: { cur: 0, sc: {} }, ws: defaultWS(),
    versions: { first: null, after: null }, product: { title: '', author: '', images: [], noImages: false }, present: { guesses: [], showText: true } };
}
const g = (m, f) => (S && S.ws.gender === 'm') ? m : f;

/* ---------------- אימות ותיקון מבנה נתונים ---------------- */
const str = (v, max) => typeof v === 'string' ? v.slice(0, max || 2000) : '';
const oneOf = (v, arr, d) => arr.includes(v) ? v : d;
function cleanDir(d) {
  if (!d || typeof d !== 'object') return null;
  const ids = Object.values(ACTIONS).flatMap(gr => gr.items.map(i => i.id));
  const out = emptyDir();
  out.actions = Array.isArray(d.actions) ? d.actions.filter(a => a && ids.includes(a.id)).slice(0, 2).map(a => ({ id: a.id, dir: oneOf(a.dir, Object.keys(DIRS), 'toProp') })) : [];
  out.eyes = oneOf(d.eyes, FACE.eyes.items.map(i => i.id), 'keep'); out.brows = oneOf(d.brows, FACE.brows.items.map(i => i.id), 'keep'); out.mouth = oneOf(d.mouth, FACE.mouth.items.map(i => i.id), 'keep');
  out.posture = oneOf(d.posture, POSTURES.map(i => i.id), 'keep'); out.pace = oneOf(d.pace, PACES.map(i => i.id), 'normal'); out.pause = oneOf(d.pause, PAUSES.map(i => i.id), 'none');
  out.speech = d.speech && typeof d.speech.text === 'string' && d.speech.text ? { text: str(d.speech.text, 600), volume: oneOf(d.speech.volume, VOLUMES.map(i => i.id), 'normal') } : null;
  out.speechWhen = oneOf(d.speechWhen, SPEECH_WHEN.map(i => i.id), 'after');
  out.note = str(d.note, 400); out.narration = !!d.narration; out.confirmed = !!d.confirmed; out.confirmedText = str(d.confirmedText, 1000);
  return out;
}
function cleanSentences(arr) {
  if (!Array.isArray(arr) || arr.length < 1 || arr.length > 5) throw new Error('sentences');
  const seen = new Set();
  return arr.map(s => { if (!s || typeof s !== 'object' || typeof s.text !== 'string') throw new Error('sentence'); let id = str(s.id, 40) || uid(); if (seen.has(id)) id = uid(); seen.add(id); return { id, text: str(s.text, 1000), dir: cleanDir(s.dir) }; });
}
function cleanSnapshot(v) { if (!v || typeof v !== 'object') return null; try { return { at: str(v.at, 40), charId: oneOf(v.charId, CHAR_ORDER, 'noa'), place: oneOf(v.place, PLACE_ORDER, 'room'), prop: oneOf(v.prop, PROP_ORDER, 'envelope'), name: str(v.name, 40), sentences: cleanSentences(v.sentences) }; } catch (e) { return null; } }
function cleanState(o) {
  if (!o || typeof o !== 'object' || !o.ws || typeof o.ws !== 'object') throw new Error('structure');
  const d = defaultState(), w = o.ws, ws = d.ws;
  ws.sentences = cleanSentences(w.sentences);
  ws.step = Math.min(3, Math.max(0, w.step | 0)); ws.charId = oneOf(w.charId, CHAR_ORDER, 'noa'); ws.name = str(w.name, 40) || CHARS[ws.charId].name; ws.gender = oneOf(w.gender, ['m', 'f'], 'f');
  ws.place = oneOf(w.place, PLACE_ORDER, 'room'); ws.prop = oneOf(w.prop, PROP_ORDER, 'envelope'); ws.situation = str(w.situation, 300); ws.challenge = !!w.challenge;
  ws.checks = {}; if (w.checks && typeof w.checks === 'object') for (const k of [...CHECKLIST.map(c => c.id), CHECK_ADV.id]) ws.checks[k] = !!w.checks[k];
  const sc = w.secret || {}; ws.secret = { emo: Array.isArray(sc.emo) ? sc.emo.filter(e => typeof e === 'string').slice(0, 6).map(e => e.slice(0, 40)) : [], other: str(sc.other, 200), why: str(sc.why, 600), a: str(sc.a, 60), b: str(sc.b, 60), causeA: str(sc.causeA, 300), causeB: str(sc.causeB, 300), hidden: str(sc.hidden, 60) };
  if (o.settings) { d.settings.muted = !!o.settings.muted; d.settings.steps = !!o.settings.steps; }
  if (o.learn && typeof o.learn === 'object') {
    d.learn.cur = Math.min(4, Math.max(0, o.learn.cur | 0));
    for (const scn of SCENES) { const x = o.learn.sc && o.learn.sc[scn.id]; if (x && typeof x === 'object') d.learn.sc[scn.id] = { answer: str(x.answer), clue: str(x.clue), moments: Array.isArray(x.moments) ? x.moments.filter(n => Number.isInteger(n) && n >= 0 && n < 10).slice(0, 2) : [], hint: Math.min(3, x.hint | 0), watched: !!x.watched, revealed: !!x.revealed, r: Math.min(3, x.r | 0), keep: oneOf(x.keep, ['', 'keep', 'change'], ''), answer2: str(x.answer2), varNote: str(x.varNote), ver: oneOf(x.ver, ['A', 'B', 'VA', 'VB'], 'A') }; }
  }
  if (o.versions) { d.versions.first = cleanSnapshot(o.versions.first); d.versions.after = cleanSnapshot(o.versions.after); }
  if (o.product) { d.product.title = str(o.product.title, 120); d.product.author = str(o.product.author, 60); d.product.noImages = !!o.product.noImages; d.product.images = Array.isArray(o.product.images) ? o.product.images.filter(i => i && typeof i.sid === 'string' && ['end', 'speech'].includes(i.kind)).slice(0, 3).map(i => ({ sid: i.sid, kind: i.kind })) : []; }
  if (o.present) { d.present.showText = o.present.showText !== false; d.present.guesses = Array.isArray(o.present.guesses) ? o.present.guesses.slice(0, 3).map(x => ({ feel: str(x && x.feel, 200), detail: str(x && x.detail, 300) })) : []; }
  d.screen = oneOf(o.screen, ['home', 'learn', 'create', 'present', 'product'], 'home');
  if (d.screen === 'present') d.screen = 'create';
  return d;
}

/* ---------------- שמירה ---------------- */
function loadState() {
  let raw = null;
  try { raw = window.localStorage.getItem(STORE_KEY); const k = '__t'; window.localStorage.setItem(k, '1'); window.localStorage.removeItem(k); }
  catch (e) { storageOK = false; }
  if (raw) { try { return cleanState(JSON.parse(raw)); } catch (e) { /* טיוטה פגומה: מתחילים מחדש, בלי למחוק */ } }
  return defaultState();
}
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 350); setSaveStatus('שומרים…'); }
function saveNow() {
  clearTimeout(saveTimer);
  if (!storageOK) { setSaveStatus('לא נשמר במחשב'); return; }
  try { window.localStorage.setItem(STORE_KEY, JSON.stringify(S)); setSaveStatus('נשמר'); }
  catch (e) { storageOK = false; showStorageBanner(); setSaveStatus('לא נשמר במחשב'); }
}
function setSaveStatus(t) { const el = $('#saveStatus'); if (el) el.textContent = t; }
function showStorageBanner() {
  const b = $('#banner'); if (!b) return;
  b.hidden = false;
  b.innerHTML = `<span>הדפדפן לא מאפשר שמירה אוטומטית במחשב הזה. אפשר להמשיך לעבוד — ולפני סגירה כדאי להוריד קובץ גיבוי.</span> <button class="btn small" data-gact="backup">הורדת גיבוי</button>`;
}
function exportProject() {
  const data = { app: APP_ID, format: 1, exportedAt: new Date().toISOString(), state: S };
  downloadBlob(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }), 'הסיפור_שלי_גיבוי.json');
  announce('קובץ הגיבוי ירד.');
}
function downloadBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
function announce(t) { const el = $('#live'); if (!el) return; el.textContent = ''; setTimeout(() => { el.textContent = t; }, 30); toast(t); }
let toastT = 0;
function toast(t) { const el = $('#toast'); if (!el) return; el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2600); }

/* חלון אישור נגיש */
function askConfirm(text, ok, cancel) {
  return new Promise(res => {
    const m = $('#modal'); const prev = document.activeElement;
    m.innerHTML = `<div class="modal-back"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="mdT"><p id="mdT">${hx(text)}</p><div class="row"><button class="btn primary" data-m="ok">${hx(ok || 'כן')}</button><button class="btn" data-m="no">${hx(cancel || 'ביטול')}</button></div></div></div>`;
    m.hidden = false; const done = v => { m.hidden = true; m.innerHTML = ''; if (prev && prev.focus) prev.focus(); res(v); };
    m.querySelector('[data-m="ok"]').onclick = () => done(true); m.querySelector('[data-m="no"]').onclick = () => done(false);
    m.onkeydown = e => { if (e.key === 'Escape') done(false); if (e.key === 'Tab') { const b = $$('button', m); const i = b.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); b[b.length - 1].focus(); } else if (!e.shiftKey && i === b.length - 1) { e.preventDefault(); b[0].focus(); } } };
    m.querySelector('[data-m="ok"]').focus();
  });
}

/* ---------------- רכיב במה עם פקדים ---------------- */
class StageUI {
  constructor(host, o) {
    o = o || {};
    host.innerHTML = `<div class="stage-frame"><div class="stage" tabindex="0"></div></div>
      <div class="controls" role="group" aria-label="פקדי הסרט">
        <button class="btn primary pp" type="button"></button>
        <button class="btn restart" type="button">⟲ מההתחלה</button>
        <button class="btn prev" type="button" aria-label="רגע קודם">→ רגע קודם</button>
        <button class="btn next" type="button" aria-label="רגע הבא">רגע הבא ←</button>
        <input class="scrub" type="range" min="0" max="1000" value="0" aria-label="מיקום בסרט">
        <span class="steplabel" aria-live="off"></span>
      </div>`;
    this.host = host; this.o = o;
    this.p = new Player($('.stage', host), { label: o.label || 'במה' });
    this.btn = { pp: $('.pp', host), restart: $('.restart', host), prev: $('.prev', host), next: $('.next', host) };
    this.scrub = $('.scrub', host); this.lab = $('.steplabel', host);
    this.btn.pp.onclick = () => { this.p.r1 > 0 && (this.clipEnd = null); if (Engine.stepMode) this.p.step(1); else this.p.toggle(); this.sync(); if (o.onUser) o.onUser('play'); };
    this.btn.restart.onclick = () => { if (Engine.stepMode) { this.p.pause(); this.p.seek(this.p.r0); this.sync(); } else this.p.restart(); if (o.onUser) o.onUser('restart'); };
    this.btn.prev.onclick = () => { this.p.step(-1); this.sync(); };
    this.btn.next.onclick = () => { this.p.step(1); this.sync(); if (o.onUser) o.onUser('next'); };
    this.scrub.oninput = () => { this.p.pause(); const r = this.p.r1 - this.p.r0; this.p.seek(this.p.r0 + r * this.scrub.value / 1000); this.sync(); };
    $('.stage', host).addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.btn.pp.click(); } if (e.key === 'ArrowLeft') { e.preventDefault(); this.btn.next.click(); } if (e.key === 'ArrowRight') { e.preventDefault(); this.btn.prev.click(); } });
    this.p.onState = () => this.sync();
    this.p.onTick = t => { const r = this.p.r1 - this.p.r0; this.scrub.value = r > 0 ? Math.round((t - this.p.r0) / r * 1000) : 0; if (o.onTick) o.onTick(t); };
    this.p.onEnd = () => { if (this.full) { const t = this.p.t; this.p.range(0, this.p.tl.dur); this.p.t = t; this.full = false; } this.sync(); if (o.onEnd) o.onEnd(); };
    this.sync();
  }
  load(tl, setup, t) { this.full = false; this.p.load(tl, setup, t); this.sync(); }
  clip(a, b, freezeOnly) {
    this.p.pause(); Sound.ensure();
    if (Engine.stepMode || freezeOnly) { this.p.range(0, this.p.tl.dur); this.p.seek(b); this.sync(); return; }
    this.p.range(a, b); this.full = true; this.p.seek(a); this.p.play(); this.sync();
  }
  playAll() { this.p.pause(); this.p.range(0, this.p.tl.dur); this.full = false; this.p.seek(0); this.p.play(); this.sync(); }
  sync() {
    const p = this.p, sm = Engine.stepMode;
    this.btn.pp.textContent = sm ? '▶ הצעד הבא' : (p.playing ? '⏸ עצירה' : '▶ הפעלה');
    this.btn.pp.setAttribute('aria-pressed', p.playing ? 'true' : 'false');
    this.btn.prev.textContent = sm ? '→ צעד קודם' : '→ רגע קודם'; this.btn.next.textContent = sm ? 'צעד הבא ←' : 'רגע הבא ←';
    this.btn.prev.setAttribute('aria-label', sm ? 'צעד קודם' : 'רגע קודם'); this.btn.next.setAttribute('aria-label', sm ? 'צעד הבא' : 'רגע הבא');
    if (p.tl && sm) { const si = p.stepIndex(); this.lab.textContent = `צעד ${Math.max(0, si.i + 1)} מתוך ${si.n}`; } else this.lab.textContent = '';
    this.host.classList.toggle('playing', p.playing);
  }
  destroy() { this.p.destroy(); }
}

/* ---------------- מסגרת ומסכים ---------------- */
let current = null; // בקר המסך הנוכחי
const SCREENS = {};
function go(screen, opt) {
  Engine.stopAll();
  if (current && current.unmount) current.unmount();
  S.screen = screen; save();
  $$('.tabs [data-go]').forEach(b => { if (b.dataset.go === screen) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  document.body.dataset.screen = screen;
  current = SCREENS[screen];
  const app = $('#app');
  app.innerHTML = current.html(opt || {});
  if (current.mount) current.mount(opt || {});
  app.focus({ preventScroll: true }); window.scrollTo(0, 0);
}
function chip(label, act, data, pressed, extra) {
  const dd = Object.entries(data || {}).map(([k, v]) => `data-${k}="${hx(v)}"`).join(' ');
  return `<button type="button" class="chip${pressed ? ' on' : ''}" data-act="${act}" ${dd} aria-pressed="${pressed ? 'true' : 'false'}" ${extra || ''}>${hx(label)}</button>`;
}
function charThumb(id, w) { const A = CHARS[id]; const s = charBase(0); s['c.smile'] = .2; return `<svg viewBox="-62 130 124 278" width="${w || 70}" height="${Math.round((w || 70) * 278 / 124)}" aria-hidden="true">${drawChar(s, A)}</svg>`; }

/* ======================= מסך פתיחה ======================= */
SCREENS.home = {
  html() {
    const started = Object.keys(S.learn.sc).length > 0;
    const doneN = SCENES.filter(s => (S.learn.sc[s.id] || {}).revealed).length;
    return `<section class="home">
      <div class="hero">
        <div class="hero-text">
          <h1>מה מסתתר בין השורות?</h1>
          <p class="sub">רואים רמזים. מגלים רגשות. כותבים סיפור שאפשר להרגיש.</p>
          <p class="lead">לפעמים הסופר כותב: 'נועה פחדה'. לפעמים הוא נותן לנו לראות אותה נעצרת ליד הדלת, אוחזת בשרוול ולוחשת: 'אתה נכנס איתי?' במשחק נגלה איך הפרטים מספרים את הרגש.</p>
          <p class="note">גם לומר מה הדמות מרגישה יכול להתאים לסיפור. כאן נתאמן בדרך שמאפשרת לקורא לגלות בעצמו.</p>
          <div class="row">
            <button class="btn primary big" data-act="start">${started ? 'ממשיכים לגלות' : 'מתחילים לגלות'}</button>
            <button class="btn big" data-act="toCreate">ישר לסדנת היצירה</button>
          </div>
          ${started ? `<p class="small">גיליתם ${doneN} מתוך 5 סצנות. העבודה שלכם שמורה במחשב הזה.</p>` : ''}
        </div>
        <div class="hero-art" id="heroArt"></div>
      </div>
      <ol class="road">
        <li><b>מגלים</b> — צופים בחמש סצנות קצרות ומחפשים רמזים.</li>
        <li><b>יוצרים</b> — כותבים סיפור קצר ומביימים אותו על הבמה.</li>
        <li><b>מציגים</b> — הכיתה מנחשת, ורק אז חושפים.</li>
        <li><b>התוצר שלי</b> — מסמך Word לכיתה עם הסיפור ותמונות.</li>
      </ol>
    </section>`;
  },
  mount() {
    const t = new TL(Object.assign(charBase(470), { 'c.turn': .5, 'c.lx': .9, 'c.wide': .3, 'c.aAf': 1, 'c.aAsl': .9 }));
    t.initArm('A', 476, 300); t.initArm('B', 486, 262); t.base['c.aBf'] = .6;
    const setup = setupS2(); setup.charId = 'noa';
    const tb = new TL(t.base); tb.segs = t.segs; tb.say(0, 'אתה נכנס איתי?', { style: 'quiet', cps: 99, hold: 99 });
    $('#heroArt').innerHTML = stageSVG(tb, setup, .5, null, null, 'class="hero-svg" role="img" aria-label="נועה ליד דלת סגורה"');
  },
  acts: { start: () => go('learn'), toCreate: () => go('create') }
};

/* ======================= מגלים ======================= */
SCREENS.learn = {
  ui: null, tlCache: {}, ver: 'A',
  sc() { return SCENES[S.learn.cur]; },
  st() { const id = this.sc().id; if (!S.learn.sc[id]) S.learn.sc[id] = { answer: '', clue: '', moments: [], hint: 0, watched: false, revealed: false, r: 0, keep: '', answer2: '', varNote: '', ver: 'A' }; return S.learn.sc[id]; },
  tl(v) { const id = this.sc().id, k = id + v; if (!this.tlCache[k]) this.tlCache[k] = SCENE_STAGE[id][v](); return this.tlCache[k]; },
  verKeys() { return this.sc().secret.variation.kind === 'two' ? ['VA', 'VB'] : ['A', 'B']; },
  html() {
    const sc = this.sc(), i = S.learn.cur;
    const dots = SCENES.map((s, j) => `<button class="dot${j === i ? ' cur' : ''}${(S.learn.sc[s.id] || {}).revealed ? ' done' : ''}" data-act="goScene" data-i="${j}" aria-label="סצנה ${j + 1}${(S.learn.sc[s.id] || {}).revealed ? ', נחשפה' : ''}" ${j === i ? 'aria-current="step"' : ''}>${j + 1}</button>`).join('');
    const cards = SCENES.map(s => { const got = (S.learn.sc[s.id] || {}).revealed; return `<li class="mcard${got ? ' got' : ''}"><span class="mc-name">${got ? hx(s.card.name) : '?'}</span>${got ? `<span class="mc-q">${hx(s.card.q)}</span>` : '<span class="mc-q">כרטיס שעוד לא נאסף</span>'}</li>`; }).join('');
    return `<section class="learn">
      <div class="learn-top"><div class="progress"><span class="plabel">סצנה ${i + 1} מתוך 5</span><span class="dots">${dots}</span></div>
      <div class="cardsbox"><span class="small">כרטיסי התבוננות:</span><ul class="mcards">${cards}</ul></div></div>
      <div class="work"><div class="stage-col" id="stageHost"></div><div class="panel" id="panel"></div></div>
    </section>`;
  },
  mount() {
    this.ui = new StageUI($('#stageHost'), { label: 'במה: סצנה ' + (S.learn.cur + 1), onUser: () => this.onUser() });
    const st = this.st();
    this.ver = st.revealed && st.r === 3 ? st.ver : 'A';
    if (this.ver === 'VA' || this.ver === 'VB' || this.ver === 'B') { /* נשאר */ } else this.ver = 'A';
    this.ui.load(this.tl(this.ver), SCENE_STAGE[this.sc().id].setup(), 0);
    this.renderPanel();
  },
  unmount() { if (this.ui) this.ui.destroy(); this.ui = null; },
  onUser() { const st = this.st(); if (!st.watched) { st.watched = true; save(); this.renderPanel(); } },
  thumbs(sel, act) {
    const sc = this.sc(), tl = this.tl('A'), setup = SCENE_STAGE[sc.id].setup();
    return `<div class="moments">${sc.moments.map((t, j) => `<button type="button" class="moment${sel.includes(j) ? ' on' : ''}" data-act="${act}" data-j="${j}" aria-pressed="${sel.includes(j)}">${stageSVG(tl, setup, t, 160, 90, 'aria-hidden="true"')}<span>רגע ${j + 1}</span></button>`).join('')}</div>`;
  },
  canReveal() { const st = this.st(); return st.answer.trim() && st.clue.trim(); },
  renderPanel() {
    const sc = this.sc(), st = this.st(), P = $('#panel'); if (!P) return;
    let o = `<h2>${hx(sc.title)}</h2><p class="context">${hx(sc.context)}</p>`;
    if (!st.watched) {
      o += `<p class="muted">צפו בסצנה. אפשר לעצור, לחזור ולעבור בין רגעים קפואים.</p><button class="btn primary big" data-act="watch">▶ צפו בסצנה</button>`;
    } else if (!st.revealed) {
      o += `<label class="q" for="ans">מה לדעתך הדמות מרגישה? אפשר יותר מרגש אחד.</label>
        <textarea id="ans" data-in="answer" rows="2">${hx(st.answer)}</textarea>
        <label class="q" for="clue">איזה פרט גרם לך לחשוב כך?</label>
        <p class="small">אפשר לבחור עד שתי תמונות רגע מהסרט ולהוסיף הסבר קצר.</p>
        ${this.thumbs(st.moments, 'pickMoment')}
        <textarea id="clue" data-in="clue" rows="2" placeholder="${st.moments.length ? 'מה ראיתם ברגע שבחרתם?' : 'למשל: מה הידיים עשו, מה נאמר…'}">${hx(st.clue)}</textarea>
        <div class="hintbox">${st.hint < sc.hints.length ? `<button class="btn small" data-act="hint">צריכים רמז?</button>` : ''}${sc.hints.slice(0, st.hint).map(hn => `<p class="hint">💡 ${hx(hn)}</p>`).join('')}</div>
        <div class="mainact"><button class="btn primary big" id="revealBtn" data-act="reveal" ${this.canReveal() ? '' : 'disabled'}>מה התכוון המחבר?</button>
        <p class="small" id="revealWhy">${this.canReveal() ? '' : 'כתבו מה הדמות מרגישה ואיזה פרט גרם לכם לחשוב כך.'}</p></div>`;
    } else {
      const tabs = ['משווים', 'הרמזים בקטע', 'קריאה אחרת', 'משנים פרט'];
      o += `<div class="rtabs" role="tablist">${tabs.map((t, j) => `<button role="tab" class="rtab${st.r === j ? ' on' : ''}" aria-selected="${st.r === j}" data-act="rtab" data-r="${j}">${j + 1}. ${t}</button>`).join('')}</div>`;
      o += `<div class="rbody">${this.revealBody()}</div>`;
    }
    P.innerHTML = o;
  },
  revealBody() {
    const sc = this.sc(), st = this.st(), sec = sc.secret;
    if (st.r === 0) {
      const mine = st.moments.map(j => `<span class="mini">${stageSVG(this.tl('A'), SCENE_STAGE[sc.id].setup(), sc.moments[j], 120, 68, 'aria-hidden="true"')}<span>רגע ${j + 1}</span></span>`).join('');
      return `<div class="compare"><div class="card mine"><h3>מה כתבתם</h3><p class="ans">${hx(st.answer)}</p><h4>הפרט שבחרתם</h4><p>${hx(st.clue)}</p>${mine ? `<div class="minis">${mine}</div>` : ''}${st.answer2 ? `<h4>הפרשנות השנייה שלכם</h4><p>${hx(st.answer2)}</p>` : ''}</div>
        <div class="card author"><h3>כוונת המחבר בסצנה הזאת</h3><p class="ans">${hx(sec.intent)}</p></div></div>
        <div class="tellshow"><p>אפשר לומר: <b>${hx(sec.tell)}</b></p><p>כאן המחבר הראה זאת כך: <b>${hx(sec.show)}</b></p></div>
        <p class="small">ההשוואה היא כדי להתבונן — לא כדי לקבל ציון.</p>
        <div class="mainact"><button class="btn primary big" data-act="rtab" data-r="1">לקטע ולרמזים</button></div>`;
    }
    if (st.r === 1) {
      let para = hx(sec.paragraph);
      sec.clues.forEach((c, j) => { para = para.replace(hx(c.phrase), `<button type="button" class="clue" data-act="clue" data-j="${j}">${hx(c.phrase)}</button>`); });
      return `<p class="small">לחצו על רמז מודגש — הסרט יראה את הרגע שלו.</p><blockquote class="para">${para}</blockquote>
        <div class="explain" id="explain" aria-live="polite"><p class="muted">ההסבר יופיע כאן.</p></div>
        <div class="mainact"><button class="btn primary big" data-act="rtab" data-r="2">המשך</button></div>`;
    }
    if (st.r === 2) {
      return `<p class="big-note">אפשר להבין גם אחרת, אם מצביעים על רמז מתאים.</p><p>${hx(sec.alt)}</p>
        <p class="q">האם תשאירו את הפרשנות שלכם או תשנו אותה?</p>
        <div class="row">${chip('משאירים את הפרשנות', 'keep', { v: 'keep' }, st.keep === 'keep')}${chip('כותבים פרשנות נוספת', 'keep', { v: 'change' }, st.keep === 'change')}</div>
        ${st.keep === 'change' ? `<label class="q" for="ans2">הפרשנות הנוספת שלכם (הראשונה נשמרת):</label><textarea id="ans2" data-in="answer2" rows="2">${hx(st.answer2)}</textarea>` : ''}
        <div class="saved-both"><p class="small">הפרשנות הראשונה: <b>${hx(st.answer)}</b></p><p class="small" id="ans2show" ${st.answer2 ? '' : 'hidden'}>הפרשנות הנוספת: <b>${hx(st.answer2)}</b></p></div>
        <div class="mainact"><button class="btn primary big" data-act="rtab" data-r="3">משנים פרט אחד</button></div>`;
    }
    const v = sec.variation, [ka, kb] = this.verKeys();
    const curPara = this.ver === kb ? v.paraB : (v.kind === 'two' && this.ver === ka ? v.paraA : sec.paragraph);
    const isLast = S.learn.cur === SCENES.length - 1;
    return `<p><b>הפרט שמשתנה:</b> ${hx(v.change)}</p>
      <div class="row">${v.kind === 'two' ? '' : chip('▶ ' + v.labelA, 'ver', { v: 'A' }, this.ver === 'A')}${v.kind === 'two' ? chip('▶ ' + v.labelA, 'ver', { v: ka }, this.ver === ka) : ''}${chip('▶ ' + v.labelB, 'ver', { v: kb }, this.ver === kb)}</div>
      <blockquote class="para small-para" id="verPara">${hx(curPara)}</blockquote>
      <label class="q" for="varNote">${hx(v.question)}</label><textarea id="varNote" data-in="varNote" rows="2">${hx(st.varNote)}</textarea>
      <p class="cardgot">🃏 אספתם את כרטיס <b>${hx(sc.card.name)}</b>: ${hx(sc.card.q)}</p>
      ${isLast ? `<p class="small">בסדנה תוכלו גם לנסות את <b>האתגר: שתי תחושות</b> — ההמשכים השונים של נועם הם הגשר אליו.</p>` : ''}
      <div class="mainact"><button class="btn primary big" data-act="${isLast ? 'toCreate' : 'nextScene'}">${isLast ? 'לסדנת היצירה' : 'לסצנה הבאה'}</button></div>`;
  },
  inputs: {
    answer(el) { this.st().answer = el.value; save(); this.updReveal(); },
    clue(el) { this.st().clue = el.value; save(); this.updReveal(); },
    answer2(el) { this.st().answer2 = el.value; save(); const p = $('#ans2show'); if (p) { p.hidden = !el.value.trim(); $('b', p).textContent = el.value; } },
    varNote(el) { this.st().varNote = el.value; save(); }
  },
  updReveal() { const b = $('#revealBtn'), w = $('#revealWhy'), ok = !!this.canReveal(); if (b) b.disabled = !ok; if (w) w.textContent = ok ? '' : 'כתבו מה הדמות מרגישה ואיזה פרט גרם לכם לחשוב כך.'; },
  acts: {
    watch() { const st = this.st(); st.watched = true; save(); this.renderPanel(); this.ui.playAll(); },
    goScene(el) { S.learn.cur = +el.dataset.i; save(); go('learn'); },
    hint() { const st = this.st(); st.hint = Math.min(this.sc().hints.length, st.hint + 1); save(); this.renderPanel(); const h = $$('.hint'); if (h.length) announce(h[h.length - 1].textContent); },
    pickMoment(el) {
      const st = this.st(), j = +el.dataset.j, i = st.moments.indexOf(j);
      if (i >= 0) st.moments.splice(i, 1); else { if (st.moments.length >= 2) st.moments.shift(); st.moments.push(j); }
      save(); this.ui.clip(0, this.sc().moments[j], true);
      $$('.moment').forEach(b => { const on = st.moments.includes(+b.dataset.j); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      const c = $('#clue'); if (c) c.placeholder = st.moments.length ? 'מה ראיתם ברגע שבחרתם?' : 'למשל: מה הידיים עשו, מה נאמר…';
    },
    reveal() { if (!this.canReveal()) return; const st = this.st(); st.revealed = true; st.r = 0; save(); this.renderPanel(); this.refreshTop(); announce('נחשפה כוונת המחבר. התשובה שלכם נשמרה לידה.'); const h = $('#panel h3'); if (h) h.focus && h.setAttribute('tabindex', '-1'); },
    rtab(el) { const st = this.st(); st.r = +el.dataset.r; save(); if (st.r !== 3 && this.ver !== 'A') { this.ver = 'A'; this.ui.load(this.tl('A'), SCENE_STAGE[this.sc().id].setup(), 0); } this.renderPanel(); const f = $('.rtab.on'); if (f) f.focus(); },
    clue(el) {
      const c = this.sc().secret.clues[+el.dataset.j];
      if (this.ver !== 'A') { this.ver = 'A'; this.ui.load(this.tl('A'), SCENE_STAGE[this.sc().id].setup(), 0); }
      this.ui.clip(c.from, c.t);
      $$('.clue').forEach(b => b.classList.toggle('on', b === el));
      $('#explain').innerHTML = `<p><b>${hx(c.phrase)}</b></p><p>${hx(c.expl)}</p>`;
    },
    keep(el) { this.st().keep = el.dataset.v; save(); this.renderPanel(); const t = $('#ans2'); if (t) t.focus(); },
    ver(el) {
      this.ver = el.dataset.v; this.st().ver = this.ver; save();
      this.ui.load(this.tl(this.ver), SCENE_STAGE[this.sc().id].setup(), 0); this.ui.playAll();
      const v = this.sc().secret.variation, [ka, kb] = this.verKeys();
      $('#verPara').textContent = this.ver === kb ? v.paraB : (v.kind === 'two' && this.ver === ka ? v.paraA : this.sc().secret.paragraph);
      $$('[data-act="ver"]').forEach(b => { const on = b.dataset.v === this.ver; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    },
    nextScene() { S.learn.cur = Math.min(SCENES.length - 1, S.learn.cur + 1); save(); go('learn'); },
    toCreate() { go('create'); }
  },
  refreshTop() {
    const sc = SCENES; $$('.mcard').forEach((li, j) => { const got = (S.learn.sc[sc[j].id] || {}).revealed; li.classList.toggle('got', !!got); li.innerHTML = got ? `<span class="mc-name">${hx(sc[j].card.name)}</span><span class="mc-q">${hx(sc[j].card.q)}</span>` : '<span class="mc-name">?</span><span class="mc-q">כרטיס שעוד לא נאסף</span>'; });
    $$('.dot').forEach((d, j) => d.classList.toggle('done', !!(S.learn.sc[sc[j].id] || {}).revealed));
  }
};

/* ======================= יוצרים ======================= */
function publicModel(ws) { // מודל ללא שדות סודיים — לבמה בכיתה ולייצוא
  ws = ws || S.ws;
  return { charId: ws.charId, place: ws.place, prop: ws.prop,
    sentences: ws.sentences.map(s => ({ id: s.id, text: s.text, dir: s.dir ? Object.assign({}, s.dir, { note: '', confirmedText: '' }) : null })) };
}
function storyParagraph(sentences) { return sentences.map(s => s.text.trim()).filter(Boolean).join(' '); }
function senStatus(s) {
  const d = s.dir;
  if (d && d.narration) return { k: 'narr', t: 'קריינות בלבד' };
  if (!dirHasStage(d)) return { k: 'none', t: 'למשפט הזה עוד לא בחרת המחשה' };
  if (d.speech && d.speech.text && !s.text.includes(d.speech.text)) return { k: 'recheck', t: 'בדקו שוב התאמה' };
  if (!d.confirmed) return { k: 'draft', t: 'עוד לא אישרתם התאמה' };
  if (d.confirmedText !== s.text) return { k: 'recheck', t: 'בדקו שוב התאמה' };
  return { k: 'ok', t: 'ההמחשה אושרה' };
}
let compileCache = { key: '', res: null };
function compiled(model) {
  const m = model || publicModel(), key = JSON.stringify(m);
  if (compileCache.key !== key) compileCache = { key, res: compileStory(m) };
  return compileCache.res;
}
SCREENS.create = {
  ui: null, loadedKey: '', exampleOn: false, verPlay: null,
  html() {
    const ws = S.ws, steps = ['דמות ומקום', 'כותבים', 'מהמשפט לבמה', 'בודקים ומשכתבים'];
    return `<section class="create">
      <div class="create-head"><h2>סדנת היצירה</h2><p class="lead2">בחרו דמות. כתבו רגע קטן שבו היא מרגישה משהו, ותנו לקוראים לגלות מהו דרך הפרטים.</p>
      <button class="btn challenge${ws.challenge ? ' on' : ''}" data-act="challenge" aria-pressed="${ws.challenge}">⚡ אתגר: שתי תחושות</button></div>
      <div class="steps" role="tablist">${steps.map((t, j) => `<button role="tab" class="stepb${ws.step === j ? ' on' : ''}" aria-selected="${ws.step === j}" data-act="step" data-s="${j}">${j + 1}. ${t}</button>`).join('')}</div>
      <div class="work"><div class="stage-col"><div id="stageHost"></div><div class="row stage-extra"><button class="btn" data-act="playStory">▶ הסיפור כולו</button><button class="btn primary" data-act="toPresent">הציגו לכיתה</button></div><div id="stageNote" class="small"></div></div><div class="panel" id="panel"></div></div>
    </section>`;
  },
  mount() {
    this.ui = new StageUI($('#stageHost'), { label: 'במה: הסיפור שלי', onTick: t => this.onTick(t) });
    this.reload(true); this.renderPanel();
  },
  unmount() { if (this.ui) this.ui.destroy(); this.ui = null; this.loadedKey = ''; this.exampleOn = false; this.verPlay = null; },
  reload(force) {
    const r = compiled(); const key = compileCache.key;
    if (force || key !== this.loadedKey || this.exampleOn || this.verPlay) { this.ui.load(r.tl, r.setup, 0); this.loadedKey = key; this.exampleOn = false; this.verPlay = null; $('#stageNote').textContent = ''; }
    return r;
  },
  onTick(t) {
    if (this.exampleOn || this.verPlay) return;
    const r = compileCache.res; if (!r) return;
    const sp = r.spans.find(s => t >= s.start && t < s.end) || null;
    $$('[data-sid]').forEach(el => el.classList.toggle('active', !!sp && el.dataset.sid === sp.id && this.ui.p.playing));
  },
  renderPanel() {
    const P = $('#panel'); if (!P) return;
    const ws = S.ws;
    let o = '';
    if (ws.step === 0) o = this.p0(); else if (ws.step === 1) o = this.p1(); else if (ws.step === 2) o = ws.editing ? this.pEdit() : this.p2(); else o = this.p3();
    P.innerHTML = o;
  },
  /* --- שלב א --- */
  p0() {
    const ws = S.ws, sc = ws.secret;
    let o = `<h3>בחרו דמות</h3><div class="chars">${CHAR_ORDER.map(id => `<button type="button" class="charcard${ws.charId === id ? ' on' : ''}" data-act="char" data-id="${id}" aria-pressed="${ws.charId === id}">${charThumb(id, 64)}<span>${hx(CHARS[id].name)}</span></button>`).join('')}</div>
      <div class="grid2"><div><label class="q" for="cname">שם הדמות</label><input id="cname" data-in="name" value="${hx(ws.name)}" maxlength="40"></div>
      <div><span class="q">לשון בהודעות המשחק</span><div class="row">${chip('זכר', 'gender', { v: 'm' }, ws.gender === 'm')}${chip('נקבה', 'gender', { v: 'f' }, ws.gender === 'f')}</div><p class="small">משפיע רק על הודעות המשחק, לא על מה שכתבתם.</p></div></div>
      <h3>איפה זה קורה?</h3><div class="row">${PLACE_ORDER.map(p => chip(PLACES[p].name, 'place', { v: p }, ws.place === p)).join('')}</div>
      <h3>איזה חפץ יש על הבמה?</h3><div class="row">${PROP_ORDER.map(p => chip(PROP_NAMES[p], 'prop', { v: p }, ws.prop === p)).join('')}</div>
      <h3>מצב פתיחה</h3><div class="row">${SITUATIONS.map(s => chip(s, 'sit', { v: s }, ws.situation === s)).join('')}</div>
      <label class="q" for="sit">או כתבו מצב משלכם:</label><input id="sit" data-in="situation" value="${hx(ws.situation)}" maxlength="300">`;
    o += `<details class="private" ${sc.emo.length || sc.other || sc.why || sc.a ? '' : 'open'}><summary>🔒 הכוונה שלי — רק לכותב</summary>`;
    if (!ws.challenge) {
      o += `<p class="q">מה רצית ש${hx(ws.name || 'הדמות')} ${g('ירגיש', 'תרגיש')}?</p><div class="row">${EMOTIONS.map(e => chip(e, 'emo', { v: e }, sc.emo.includes(e))).join('')}</div>
        <label class="q" for="emoOther">רגש אחר:</label><input id="emoOther" data-in="emoOther" value="${hx(sc.other)}" maxlength="200">
        <label class="q" for="why">מה גרם לרגש הזה? (לעצמכם)</label><textarea id="why" data-in="why" rows="2">${hx(sc.why)}</textarea>`;
    } else o += this.challengeFields();
    o += `<p class="small">הכוונה לא מפעילה תנועה ולא מופיעה בכיתה. היא תיחשף רק כשתלחצו על "חשיפת כוונת הכותב".</p></details>`;
    if (ws.challenge) o += this.examples();
    o += `<div class="mainact"><button class="btn primary big" data-act="step" data-s="1">לכתיבה</button></div>`;
    return o;
  },
  challengeFields() {
    const sc = S.ws.secret;
    return `<p class="q">בחרו שתי תחושות (או כתבו צירוף אחר). חלק מהאפשרויות משלבות תחושה ורצון.</p>
      <div class="row">${COMBOS.map((c, j) => chip(c.a + ' + ' + c.b, 'combo', { j }, sc.a === c.a && sc.b === c.b)).join('')}</div>
      <div class="grid2"><div><label class="q" for="ca">תחושה 1</label><input id="ca" data-in="ca" value="${hx(sc.a)}" maxlength="60"><label class="q" for="cca">מה גרם לה?</label><textarea id="cca" data-in="causeA" rows="2">${hx(sc.causeA)}</textarea></div>
      <div><label class="q" for="cb">תחושה 2</label><input id="cb" data-in="cb" value="${hx(sc.b)}" maxlength="60"><label class="q" for="ccb">מה גרם לה?</label><textarea id="ccb" data-in="causeB" rows="2">${hx(sc.causeB)}</textarea></div></div>
      <label class="q" for="hid">רגש שהדמות מנסה להסתיר (לא חובה):</label><input id="hid" data-in="hidden" value="${hx(sc.hidden)}" maxlength="60">
      <p class="small">המשימה: לפחות שני פרטים בסצנה תומכים בשתי התחושות. לא חייבים משפט נפרד לכל תחושה — אפשר שהפנים והידיים יגלו דברים שונים, או שיהיה פער בין הדיבור לגוף.</p>`;
  },
  examples() {
    return `<div class="examples"><h3>שתי דוגמאות קצרות (לצפייה בלבד)</h3>${EXAMPLES.map(e => `<div class="ex"><p class="extext">${hx(e.text)}</p><p class="small">${hx(e.note)}</p><button class="btn small" data-act="example" data-id="${e.id}">▶ ${hx(e.label)}</button></div>`).join('')}
      <p class="small">הדוגמאות לא נכנסות לסיפור שלכם. אפשר לשלב, למשל, חיוך קטן עם אחיזה חזקה בשרוול באותו רגע — ולתת לכיתה לפרש.</p></div>`;
  },
  /* --- שלב ב --- */
  p1() {
    const ws = S.ws, n = ws.sentences.length;
    let o = `<p class="lead2">כתבו סיפור קצר של 3–5 משפטים. אפשר לערוך כל משפט בכל זמן.</p>
      <button class="btn small" data-act="prompts" aria-expanded="${ws.showPrompts}">${ws.showPrompts ? 'הסתרת הכיוונים' : 'רוצים כיוון?'}</button>
      ${ws.showPrompts ? `<ul class="prompts">${WRITE_PROMPTS.map(p => `<li>${hx(p)}</li>`).join('')}</ul><p class="small">אלה הצעות בלבד — לא חובה ולא תבנית.</p>` : ''}
      <ol class="sents">`;
    ws.sentences.forEach((s, i) => {
      const emo = findEmotionWords(s.text);
      o += `<li class="sent" data-sid="${s.id}"><label for="t_${s.id}">משפט ${i + 1}</label>
        <textarea id="t_${s.id}" data-in="sentText" data-id="${s.id}" rows="2">${hx(s.text)}</textarea>
        <div class="sent-tools"><button class="btn tiny" data-act="up" data-id="${s.id}" ${i === 0 ? 'disabled' : ''} aria-label="הזזת משפט ${i + 1} למעלה">▲ למעלה</button><button class="btn tiny" data-act="down" data-id="${s.id}" ${i === n - 1 ? 'disabled' : ''} aria-label="הזזת משפט ${i + 1} למטה">▼ למטה</button>${n > 3 ? `<button class="btn tiny" data-act="del" data-id="${s.id}" aria-label="מחיקת משפט ${i + 1}">✕ מחיקה</button>` : ''}<span class="st st-${senStatus(s).k}">${hx(senStatus(s).t)}</span></div>
        <p class="emo-note" id="emo_${s.id}" ${emo.length ? '' : 'hidden'}>האם תרצו להחליף את שם הרגש בפרט שהקורא יוכל לראות? <span class="small">(בדיקת מילים חלקית: ${hx(emo.join(', '))})</span></p></li>`;
    });
    o += `</ol>${n < 5 ? `<button class="btn" data-act="addSent">+ הוספת משפט (${n}/5)</button>` : ''}
      <h3>הפסקה כפי שכתבתם</h3><p class="para-preview" id="paraPrev">${hx(storyParagraph(ws.sentences)) || '<span class="muted">הפסקה תופיע כאן.</span>'}</p>
      <div class="mainact"><button class="btn primary big" data-act="step" data-s="2">מהמשפט לבמה</button></div>`;
    return o;
  },
  /* --- שלב ג --- */
  p2() {
    const ws = S.ws;
    let o = `<p class="lead2">כתבתם את הסיפור. עכשיו בחרו איך הדמות תראה אותו על הבמה.</p><ol class="sents">`;
    ws.sentences.forEach((s, i) => {
      const stt = senStatus(s);
      o += `<li class="sent row-sent" data-sid="${s.id}"><div class="stext"><b>משפט ${i + 1}:</b> ${s.text.trim() ? hx(s.text) : '<span class="muted">(ריק)</span>'}</div>
        <div class="sent-tools"><button class="btn small primary" data-act="edit" data-id="${s.id}">איך נראה את זה?</button><button class="btn small" data-act="playOne" data-id="${s.id}" aria-label="הפעלת משפט ${i + 1}">▶ משפט ${i + 1}</button>
        <button class="btn tiny" data-act="up" data-id="${s.id}" ${i === 0 ? 'disabled' : ''} aria-label="הזזת משפט ${i + 1} למעלה">▲</button><button class="btn tiny" data-act="down" data-id="${s.id}" ${i === ws.sentences.length - 1 ? 'disabled' : ''} aria-label="הזזת משפט ${i + 1} למטה">▼</button>
        <span class="st st-${stt.k}">${hx(stt.t)}</span></div>${s.dir && dirHasStage(s.dir) ? `<p class="small desc">${hx(describeDir(s.dir))}</p>` : ''}</li>`;
    });
    o += `</ol><p class="small">משפט בלי המחשה נשאר בסיפור כקריינות. הבמה לא ממציאה לו תנועה.</p>
      <div class="mainact"><button class="btn primary big" data-act="step" data-s="3">בודקים ומשכתבים</button></div>`;
    return o;
  },
  pEdit() {
    const ws = S.ws, s = ws.sentences.find(x => x.id === ws.editing);
    if (!s) { ws.editing = null; return this.p2(); }
    if (!s.dir) s.dir = emptyDir();
    const d = s.dir, story = publicModel(), idx = ws.sentences.indexOf(s) + 1;
    const r = compiled(), sp = r.spans.find(x => x.id === s.id);
    const actChip = it => { const ok = actionAvailable(it.id, story); const on = d.actions.some(a => a.id === it.id); const why = it.needs ? 'צריך על הבמה: ' + PROP_NAMES[it.needs] : it.needsPlace ? 'רק במסדרון עם דלת' : ''; return `<button type="button" class="chip${on ? ' on' : ''}" data-act="dAct" data-v="${it.id}" aria-pressed="${on}" ${ok ? '' : `disabled title="${hx(why)}"`}>${hx(it.label)}${ok ? '' : ` <span class="small">(${hx(why)})</span>`}</button>`; };
    const quotes = [...String(s.text).matchAll(/['"״“”„]([^'"״“”„]{1,300})['"״“”„]/g)].map(m => m[1].trim()).filter(Boolean);
    let o = `<button class="btn small" data-act="closeEdit">→ חזרה לרשימת המשפטים</button>
      <div class="side-by-side"><div><h4>המשפט ${idx}</h4><p class="stext big-s">${s.text.trim() ? hx(s.text) : '<span class="muted">(המשפט עוד ריק — אפשר להתחיל מההמחשה ולכתוב אחר כך)</span>'}</p><button class="btn tiny" data-act="editText">עריכת המשפט</button></div>
      <div><h4>ההמחשה</h4><p class="stext">${hx(describeDir(d)) || '<span class="muted">עוד לא נבחר דבר</span>'}</p></div></div>
      <h4>מה הדמות עושה? <span class="small">(עד שתי פעולות, לפי הסדר)</span></h4>`;
    if (d.actions.length) o += `<ol class="chosen">${d.actions.map((a, j) => { const it = Object.values(ACTIONS).flatMap(gr => gr.items).find(i => i.id === a.id) || {}; return `<li><b>${hx(it.label || a.id)}</b>${it.dir ? `<span class="row dirs">${Object.entries(DIRS).filter(([k]) => k !== 'toDoor' || ws.place === 'corridor').map(([k, l]) => chip(l, 'dDir', { j, v: k }, a.dir === k)).join('')}</span>` : ''}<button class="btn tiny" data-act="dActUp" data-j="${j}" ${j === 0 ? 'disabled' : ''} aria-label="הקדמת הפעולה">▲</button><button class="btn tiny" data-act="dActRm" data-j="${j}" aria-label="הסרת הפעולה">✕</button></li>`; }).join('')}</ol>`;
    for (const k of ['move', 'body', 'obj']) o += `<div class="grp"><span class="glab">${ACTIONS[k].title}</span><div class="row">${ACTIONS[k].items.map(actChip).join('')}</div></div>`;
    o += `<h4>מראה</h4>`;
    for (const k of ['eyes', 'brows', 'mouth']) o += `<div class="grp"><span class="glab">${FACE[k].title}</span><div class="row">${FACE[k].items.map(it => chip(it.label, 'dFace', { k, v: it.id }, d[k] === it.id)).join('')}</div></div>`;
    o += `<h4>תנוחת גוף</h4><div class="row">${POSTURES.map(it => chip(it.label, 'dPost', { v: it.id }, d.posture === it.id)).join('')}</div>
      <h4>קצב ושתיקה</h4><div class="grp"><span class="glab">קצב</span><div class="row">${PACES.map(it => chip(it.label, 'dPace', { v: it.id }, d.pace === it.id)).join('')}</div></div>
      <div class="grp"><span class="glab">השתהות</span><div class="row">${PAUSES.map(it => chip(it.label, 'dPause', { v: it.id }, d.pause === it.id)).join('')}</div></div>
      <h4>דיבור <span class="small">(המילים המדויקות מתוך המשפט)</span></h4>
      ${s.text.trim() ? `<label class="small" for="spsrc">סמנו מילים במשפט ולחצו "השתמשו במילים שסימנתם":</label><textarea id="spsrc" readonly rows="2">${hx(s.text)}</textarea>
      <div class="row"><button class="btn small" data-act="spSel">השתמשו במילים שסימנתם</button>${quotes.map((q, j) => chip('"' + q + '"', 'spQuote', { j }, d.speech && d.speech.text === q)).join('')}<button class="btn small" data-act="spAll">כל המשפט</button>${d.speech ? '<button class="btn small" data-act="spNone">בלי דיבור</button>' : ''}</div>` : '<p class="small muted">כתבו משפט כדי לבחור ממנו דיבור.</p>'}
      ${d.speech ? `<p class="speech-pick">בבועה: <b>${hx(d.speech.text)}</b>${String(s.text).includes(d.speech.text) ? '' : ' <span class="warn">— המילים האלה כבר לא במשפט. בחרו מחדש.</span>'}</p>
      <div class="grp"><span class="glab">קול</span><div class="row">${VOLUMES.map(it => chip(it.label, 'spVol', { v: it.id }, d.speech.volume === it.id)).join('')}</div></div>
      <div class="grp"><span class="glab">מתי?</span><div class="row">${SPEECH_WHEN.map(it => chip(it.label, 'spWhen', { v: it.id }, (d.speechWhen || 'after') === it.id)).join('')}</div></div>` : ''}
      <details class="unsupported" ${d.note || d.narration ? 'open' : ''}><summary>הרעיון שלי לא ברשימה</summary>
        <p class="small">אפשר לבחור ייצוג מקורב ולכתוב מה הוא מייצג, או להשאיר את המשפט כקריינות בלבד. אתם מחליטים.</p>
        <label class="q" for="dnote">מה ההמחשה מייצגת? (רק לכותב)</label><input id="dnote" data-in="dNote" value="${hx(d.note)}" maxlength="400">
        <label class="checkline"><input type="checkbox" data-in="dNarr" ${d.narration ? 'checked' : ''}> להשאיר את המשפט כקריינות בלבד, בלי תנועה</label></details>
      ${sp && sp.notes.length ? `<ul class="notes">${sp.notes.map(n => `<li>${hx(n)}</li>`).join('')}</ul>` : ''}
      <div class="mainact"><button class="btn big" data-act="preview">▶ תצוגה מקדימה</button>
      <button class="btn primary big" data-act="confirm" ${dirHasStage(d) || d.narration ? '' : 'disabled'}>✓ זה מתאים למה שכתבתי</button></div>
      <p class="small">אחרי שינוי בחירה — בדקו שוב בתצוגה המקדימה ואשרו.</p>`;
    return o;
  },
  /* --- שלב ד --- */
  p3() {
    const ws = S.ws, ch = channelsUsed(ws.sentences), V = S.versions;
    const items = [...CHECKLIST, ...(ws.challenge ? [CHECK_ADV] : [])];
    let o = `<h3>רשימת בדיקה — אתם מסמנים</h3><ul class="checks">${items.map(c => `<li><label class="checkline"><input type="checkbox" data-in="check" data-id="${c.id}" ${ws.checks[c.id] ? 'checked' : ''}> ${hx(c.text)}</label></li>`).join('')}</ul>
      <p class="small">ערוצי המחשה שבחרתם: <b>${ch.length ? hx(ch.join(' · ')) : 'עוד לא נבחרו'}</b>. זה דיווח על הבחירות — לא ציון ולא בדיקה של איכות הכתיבה.</p>
      <h3>גרסאות</h3><p class="small">שמרו את מה שכתבתם עכשיו, שנו פרט אחד, ושמרו שוב. ההשוואה היא בין שתי יצירות שלכם.</p>
      <div class="row"><button class="btn" data-act="saveVer" data-v="first">שמירה כ"גרסה ראשונה"</button><button class="btn" data-act="saveVer" data-v="after" ${V.first ? '' : 'disabled'}>שמירה כ"אחרי שינוי"</button></div>`;
    if (V.first || V.after) {
      o += `<div class="versions">${['first', 'after'].map(k => { const v = V[k]; if (!v) return `<div class="card"><h4>${k === 'first' ? 'גרסה ראשונה' : 'אחרי שינוי'}</h4><p class="muted">עוד לא נשמרה.</p></div>`; return `<div class="card"><h4>${k === 'first' ? 'גרסה ראשונה' : 'אחרי שינוי'}</h4><p>${hx(storyParagraph(v.sentences))}</p><ul class="small">${v.sentences.map((s, i) => `<li>משפט ${i + 1}: ${hx(describeDir(s.dir) || 'בלי המחשה')}</li>`).join('')}</ul><button class="btn small" data-act="playVer" data-v="${k}">▶ הפעלת הגרסה</button></div>`; }).join('')}</div>
      <button class="btn small" data-act="backToCurrent">חזרה לבמה של הסיפור הנוכחי</button>`;
    }
    o += `<h3>איזה פרט תרצו לדייק?</h3><p class="small">אפשר לשנות משפט אחד או הוראת במה אחת ולהפעיל שוב.</p>
      <div class="row"><button class="btn" data-act="step" data-s="1">עריכת משפט</button><button class="btn" data-act="step" data-s="2">שינוי המחשה</button></div>
      <div class="mainact"><button class="btn primary big" data-act="toPresent">הציגו לכיתה</button><button class="btn big" data-act="toProduct">להורדת הסיפור</button></div>`;
    return o;
  },
  inputs: {
    name(el) { S.ws.name = el.value; save(); },
    situation(el) { S.ws.situation = el.value; save(); $$('[data-act="sit"]').forEach(b => { const on = b.dataset.v === el.value; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); },
    emoOther(el) { S.ws.secret.other = el.value; save(); }, why(el) { S.ws.secret.why = el.value; save(); },
    ca(el) { S.ws.secret.a = el.value; save(); }, cb(el) { S.ws.secret.b = el.value; save(); },
    causeA(el) { S.ws.secret.causeA = el.value; save(); }, causeB(el) { S.ws.secret.causeB = el.value; save(); }, hidden(el) { S.ws.secret.hidden = el.value; save(); },
    sentText(el) {
      const s = S.ws.sentences.find(x => x.id === el.dataset.id); if (!s) return; s.text = el.value; save();
      const pp = $('#paraPrev'); if (pp) { const t = storyParagraph(S.ws.sentences); pp.textContent = t; if (!t) pp.innerHTML = '<span class="muted">הפסקה תופיע כאן.</span>'; }
      const emo = findEmotionWords(s.text), n = $('#emo_' + s.id); if (n) { n.hidden = !emo.length; if (emo.length) n.innerHTML = `האם תרצו להחליף את שם הרגש בפרט שהקורא יוכל לראות? <span class="small">(בדיקת מילים חלקית: ${hx(emo.join(', '))})</span>`; }
      const li = el.closest('.sent'), stEl = li && $('.st', li); if (stEl) { const stt = senStatus(s); stEl.className = 'st st-' + stt.k; stEl.textContent = stt.t; }
    },
    dNote(el) { const s = this.editingSent(); if (s) { s.dir.note = el.value; save(); } },
    dNarr(el) { const s = this.editingSent(); if (s) { s.dir.narration = el.checked; s.dir.confirmed = false; save(); this.renderPanel(); } },
    check(el) { S.ws.checks[el.dataset.id] = el.checked; save(); }
  },
  editingSent() { return S.ws.sentences.find(x => x.id === S.ws.editing); },
  dirChanged() { const s = this.editingSent(); if (s && s.dir) s.dir.confirmed = false; save(); const y = $('#panel').scrollTop; this.renderPanel(); $('#panel').scrollTop = y; },
  move(id, dlt) { const a = S.ws.sentences, i = a.findIndex(x => x.id === id), j = i + dlt; if (i < 0 || j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; save(); this.renderPanel(); const b = $(`[data-act="${dlt < 0 ? 'up' : 'down'}"][data-id="${id}"]`) || $(`[data-id="${id}"]`); if (b && !b.disabled) b.focus(); announce('הסדר השתנה. ההמחשות נשארו צמודות למשפטים שלהן.'); },
  acts: {
    step(el) { S.ws.step = +el.dataset.s; S.ws.editing = null; save(); go('create'); },
    challenge() { S.ws.challenge = !S.ws.challenge; if (S.ws.challenge) S.ws.step = 0; save(); go('create'); },
    char(el) { const id = el.dataset.id, ws = S.ws; const oldDefault = CHARS[ws.charId].name; ws.charId = id; if (!ws.name || ws.name === oldDefault) ws.name = CHARS[id].name; ws.gender = CHARS[id].g; save(); this.renderPanel(); this.reload(); },
    gender(el) { S.ws.gender = el.dataset.v; save(); this.renderPanel(); },
    place(el) { S.ws.place = el.dataset.v; save(); this.renderPanel(); this.reload(); },
    prop(el) { S.ws.prop = el.dataset.v; save(); this.renderPanel(); this.reload(); },
    sit(el) { S.ws.situation = el.dataset.v; save(); this.renderPanel(); },
    emo(el) { const a = S.ws.secret.emo, v = el.dataset.v, i = a.indexOf(v); if (i >= 0) a.splice(i, 1); else if (a.length < 6) a.push(v); save(); el.classList.toggle('on', i < 0); el.setAttribute('aria-pressed', i < 0); },
    combo(el) { const c = COMBOS[+el.dataset.j]; S.ws.secret.a = c.a; S.ws.secret.b = c.b; save(); this.renderPanel(); },
    example(el) { const id = el.dataset.id; const tl = SCENE_STAGE[id].A(); this.ui.load(tl, SCENE_STAGE[id].setup(), 0); this.exampleOn = true; $('#stageNote').textContent = 'מוצגת דוגמה מההדרכה — היא לא חלק מהסיפור שלכם.'; this.ui.playAll(); },
    prompts() { S.ws.showPrompts = !S.ws.showPrompts; save(); this.renderPanel(); },
    addSent() { if (S.ws.sentences.length >= 5) return; const s = newSentence(); S.ws.sentences.push(s); save(); this.renderPanel(); const t = $('#t_' + s.id); if (t) t.focus(); },
    async del(el) { const s = S.ws.sentences.find(x => x.id === el.dataset.id); if (!s || S.ws.sentences.length <= 3) return; if (s.text.trim() && !(await askConfirm('למחוק את המשפט? הטקסט שלו יימחק.', 'מחיקה', 'ביטול'))) return; S.ws.sentences = S.ws.sentences.filter(x => x !== s); save(); this.renderPanel(); },
    up(el) { this.move(el.dataset.id, -1); }, down(el) { this.move(el.dataset.id, 1); },
    edit(el) { S.ws.editing = el.dataset.id; save(); this.renderPanel(); $('#panel').scrollTop = 0; },
    closeEdit() { S.ws.editing = null; save(); this.renderPanel(); },
    editText() { S.ws.step = 1; S.ws.editing = null; save(); go('create'); },
    playOne(el) { const r = this.reload(); const sp = r.spans.find(x => x.id === el.dataset.id); if (sp) this.ui.clip(sp.start, sp.end); },
    playStory() { this.reload(); this.ui.playAll(); },
    preview() { const s = this.editingSent(); const r = this.reload(); const sp = r.spans.find(x => x.id === s.id); if (sp) this.ui.clip(sp.start, sp.end); this.renderPanel(); },
    confirm() { const s = this.editingSent(); if (!s) return; s.dir.confirmed = true; s.dir.confirmedText = s.text; save(); announce('ההמחשה אושרה.'); S.ws.editing = null; this.renderPanel(); },
    dAct(el) { const d = this.editingSent().dir, v = el.dataset.v, i = d.actions.findIndex(a => a.id === v); if (i >= 0) d.actions.splice(i, 1); else { if (d.actions.length >= 2) { announce('אפשר לבחור עד שתי פעולות. הסירו אחת קודם.'); return; } d.actions.push({ id: v, dir: 'toProp' }); } this.dirChanged(); },
    dDir(el) { const d = this.editingSent().dir; d.actions[+el.dataset.j].dir = el.dataset.v; this.dirChanged(); },
    dActUp(el) { const d = this.editingSent().dir, j = +el.dataset.j; if (j > 0) [d.actions[j - 1], d.actions[j]] = [d.actions[j], d.actions[j - 1]]; this.dirChanged(); },
    dActRm(el) { const d = this.editingSent().dir; d.actions.splice(+el.dataset.j, 1); this.dirChanged(); },
    dFace(el) { this.editingSent().dir[el.dataset.k] = el.dataset.v; this.dirChanged(); },
    dPost(el) { this.editingSent().dir.posture = el.dataset.v; this.dirChanged(); },
    dPace(el) { this.editingSent().dir.pace = el.dataset.v; this.dirChanged(); },
    dPause(el) { this.editingSent().dir.pause = el.dataset.v; this.dirChanged(); },
    spSel() { const ta = $('#spsrc'), s = this.editingSent(); const a = ta.selectionStart, b = ta.selectionEnd; const txt = ta.value.slice(a, b).trim(); if (!txt) { announce('סמנו קודם מילים במשפט.'); ta.focus(); return; } s.dir.speech = { text: txt, volume: (s.dir.speech && s.dir.speech.volume) || 'normal' }; this.dirChanged(); },
    spQuote(el) { const s = this.editingSent(); const qs = [...String(s.text).matchAll(/['"״“”„]([^'"״“”„]{1,300})['"״“”„]/g)].map(m => m[1].trim()).filter(Boolean); const q = qs[+el.dataset.j]; if (q) { s.dir.speech = { text: q, volume: (s.dir.speech && s.dir.speech.volume) || 'normal' }; this.dirChanged(); } },
    spAll() { const s = this.editingSent(); s.dir.speech = { text: s.text.trim(), volume: (s.dir.speech && s.dir.speech.volume) || 'normal' }; this.dirChanged(); },
    spNone() { this.editingSent().dir.speech = null; this.dirChanged(); },
    spVol(el) { this.editingSent().dir.speech.volume = el.dataset.v; this.dirChanged(); },
    spWhen(el) { this.editingSent().dir.speechWhen = el.dataset.v; this.dirChanged(); },
    async saveVer(el) {
      const k = el.dataset.v, V = S.versions;
      if (V[k] && !(await askConfirm('כבר שמורה גרסה כזאת. להחליף אותה בסיפור הנוכחי?', 'החלפה', 'ביטול'))) return;
      V[k] = { at: new Date().toISOString(), charId: S.ws.charId, place: S.ws.place, prop: S.ws.prop, name: S.ws.name, sentences: JSON.parse(JSON.stringify(S.ws.sentences)) };
      save(); this.renderPanel(); announce(k === 'first' ? 'הגרסה הראשונה נשמרה.' : 'הגרסה אחרי השינוי נשמרה.');
    },
    playVer(el) { const v = S.versions[el.dataset.v]; if (!v) return; const r = compileStory(publicModel(v)); this.ui.load(r.tl, r.setup, 0); this.verPlay = el.dataset.v; $('#stageNote').textContent = el.dataset.v === 'first' ? 'מוצגת: גרסה ראשונה' : 'מוצגת: אחרי שינוי'; this.ui.playAll(); },
    backToCurrent() { this.reload(true); },
    toPresent() { go('present'); },
    toProduct() { go('product'); }
  }
};

/* ======================= מציגים (מצב כיתה) ======================= */
SCREENS.present = {
  ui: null, revealed: false, model: null,
  html() {
    const pm = publicModel(), title = S.product.title.trim() || 'הסיפור שלי', P = S.present;
    this.model = pm; this.revealed = false;
    const sents = pm.sentences.filter(s => s.text.trim());
    return `<section class="present">
      <div class="present-head"><h2>${hx(title)}</h2>
      <div class="row"><button class="btn small" data-act="toggleText" aria-pressed="${P.showText}">${P.showText ? 'הסתרת הפסקה' : 'הצגת הפסקה'}</button><button class="btn small" data-act="fs">מסך מלא</button><button class="btn small" data-act="back">חזרה לעריכה</button></div></div>
      <div class="present-stage" id="stageHost"></div>
      <div class="row center"><button class="btn primary big" data-act="playAll">▶ הפעלת הסיפור</button>${pm.sentences.map((s, i) => s.text.trim() ? `<button class="btn" data-act="one" data-id="${s.id}">משפט ${i + 1}</button>` : '').join('')}</div>
      <p class="story-text" id="storyText" ${P.showText ? '' : 'hidden'}>${sents.map(s => `<span data-sid="${s.id}">${hx(s.text.trim())}</span>`).join(' ')}</p>
      <div class="present-cols">
        <div class="card"><h3>פרשנויות מהכיתה</h3><p class="small">אפשר לנחש בעל פה, או לרשום כאן עד שלוש פרשנויות קצרות.</p>
          <ol id="guesses">${P.guesses.map((gg, i) => `<li><b>${hx(gg.feel)}</b>${gg.detail ? ` — ${hx(gg.detail)}` : ''} <button class="btn tiny" data-act="rmGuess" data-i="${i}" aria-label="מחיקת פרשנות ${i + 1}">✕</button></li>`).join('')}</ol>
          ${P.guesses.length < 3 ? `<label class="q" for="gfeel">מה הרגשתם שהדמות מרגישה?</label><input id="gfeel" maxlength="200"><label class="q" for="gdet">על איזה פרט הסתמכתם?</label><input id="gdet" maxlength="300"><button class="btn" data-act="addGuess">הוספה</button>` : '<p class="small">נרשמו שלוש פרשנויות.</p>'}
        </div>
        <div class="card" id="revealBox"><h3>הכוונה של הכותב</h3><p class="small">מוסתרת עד שתלחצו.</p><button class="btn primary big" data-act="reveal">חשיפת כוונת הכותב</button></div>
      </div></section>`;
  },
  mount() {
    this.ui = new StageUI($('#stageHost'), { label: 'במה', onTick: t => this.onTick(t) });
    const r = compileStory(this.model); this.r = r; this.ui.load(r.tl, r.setup, 0);
  },
  unmount() { if (this.ui) this.ui.destroy(); this.ui = null; this.revealed = false; if (document.fullscreenElement) document.exitFullscreen().catch(() => { }); },
  onTick(t) { const sp = this.r && this.r.spans.find(s => t >= s.start && t < s.end); $$('#storyText [data-sid]').forEach(el => el.classList.toggle('active', !!sp && el.dataset.sid === sp.id && this.ui.p.playing)); },
  acts: {
    playAll() { this.ui.playAll(); },
    one(el) { const sp = this.r.spans.find(x => x.id === el.dataset.id); if (sp) this.ui.clip(sp.start, sp.end); },
    toggleText(el) { S.present.showText = !S.present.showText; save(); $('#storyText').hidden = !S.present.showText; el.textContent = S.present.showText ? 'הסתרת הפסקה' : 'הצגת הפסקה'; el.setAttribute('aria-pressed', S.present.showText); },
    fs() { const el = $('.present'); if (document.fullscreenElement) document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen().catch(() => { }); },
    back() { go('create'); },
    addGuess() { const f = $('#gfeel').value.trim(), dd = $('#gdet').value.trim(); if (!f) { $('#gfeel').focus(); return; } if (S.present.guesses.length >= 3) return; S.present.guesses.push({ feel: f, detail: dd }); save(); this.rerenderGuesses(); },
    rmGuess(el) { S.present.guesses.splice(+el.dataset.i, 1); save(); this.rerenderGuesses(); },
    reveal() {
      const sc = S.ws.secret, ws = S.ws; this.revealed = true;
      const feel = ws.challenge ? [sc.a, sc.b].filter(Boolean).join(' + ') : [...sc.emo, sc.other].filter(Boolean).join(', ');
      let o = `<h3>הכוונה של הכותב</h3><p class="reveal-feel">${hx(feel || 'הכותב לא רשם כוונה.')}</p>`;
      if (!ws.challenge && sc.why) o += `<p><b>ההסבר:</b> ${hx(sc.why)}</p>`;
      if (ws.challenge) { if (sc.causeA) o += `<p><b>${hx(sc.a || 'תחושה 1')}:</b> ${hx(sc.causeA)}</p>`; if (sc.causeB) o += `<p><b>${hx(sc.b || 'תחושה 2')}:</b> ${hx(sc.causeB)}</p>`; if (sc.hidden) o += `<p><b>רגש שהדמות מנסה להסתיר:</b> ${hx(sc.hidden)}</p>`; }
      o += `<p class="big-note">זו הכוונה של הכותב. אפשר להציע קריאה אחרת ולהסביר אותה.</p>
        <p class="q">איזה פרט תרצו לדייק?</p><div class="row"><button class="btn" data-act="fixVer">שמירת גרסה ראשונה וחזרה לעריכה</button><button class="btn" data-act="back">חזרה לעריכה</button></div>`;
      $('#revealBox').innerHTML = o;
    },
    async fixVer() { if (!S.versions.first || await askConfirm('כבר שמורה גרסה ראשונה. להחליף אותה?', 'החלפה', 'להשאיר את הקיימת')) { S.versions.first = { at: new Date().toISOString(), charId: S.ws.charId, place: S.ws.place, prop: S.ws.prop, name: S.ws.name, sentences: JSON.parse(JSON.stringify(S.ws.sentences)) }; } S.ws.step = 1; S.ws.editing = null; save(); go('create'); }
  },
  rerenderGuesses() { const keep = this.revealed ? $('#revealBox').innerHTML : null; const app = $('#app'); const y = window.scrollY; const t = this.ui.p.t; this.unmountSoft(); app.innerHTML = this.html(); this.mount(); this.ui.p.seek(t); if (keep) { this.revealed = true; $('#revealBox').innerHTML = keep; } window.scrollTo(0, y); const f = $('#gfeel'); if (f) f.focus(); },
  unmountSoft() { if (this.ui) this.ui.destroy(); this.ui = null; }
};

/* ======================= התוצר שלי ======================= */
function imageCandidates() {
  const r = compiled(), out = [];
  r.spans.forEach(sp => {
    if (sp.kind !== 'stage') return; const i = S.ws.sentences.findIndex(s => s.id === sp.id) + 1;
    out.push({ sid: sp.id, kind: 'end', t: Math.max(sp.start, sp.end - .35), label: `סוף משפט ${i}` });
    if (sp.speechT) out.push({ sid: sp.id, kind: 'speech', t: sp.speechT, label: `הדיבור במשפט ${i}` });
  });
  return { r, out };
}
SCREENS.product = {
  html() {
    const P = S.product, { r, out } = imageCandidates(), para = storyParagraph(S.ws.sentences);
    const sel = P.images.filter(im => out.some(c => c.sid === im.sid && c.kind === im.kind));
    const titleEmo = findEmotionWords(P.title);
    const noDir = S.ws.sentences.filter(s => s.text.trim() && !dirHasStage(s.dir)).length;
    return `<section class="product"><h2>התוצר שלי</h2>
      <div class="grid2">
        <div class="card">
          <label class="q" for="ptitle">כותרת לסיפור <span class="small">(ניטרלית — בלי לגלות את הרגש)</span></label><input id="ptitle" data-in="title" value="${hx(P.title)}" maxlength="120" placeholder="הסיפור שלי">
          <p class="emo-note" id="titleEmo" ${titleEmo.length ? '' : 'hidden'}>הכותרת אולי מגלה את הרגש (${hx(titleEmo.join(', '))}). אפשר לבחור כותרת שלא מסגירה.</p>
          <label class="q" for="pauthor">כינוי כותב <span class="small">(לא חובה)</span></label><input id="pauthor" data-in="author" value="${hx(P.author)}" maxlength="60">
          <h3>הסיפור</h3><p class="para-preview">${hx(para) || '<span class="muted">עוד אין משפטים. כתבו בסדנה.</span>'}</p>
          ${noDir ? `<p class="small">יש ${noDir === 1 ? 'משפט אחד' : noDir + ' משפטים'} בלי המחשה — ${noDir === 1 ? 'הוא יופיע' : 'הם יופיעו'} בוורד כרגיל.</p>` : ''}
        </div>
        <div class="card">
          <h3>תמונות לוורד <span class="small">(בחרו עד 3, לפי הסדר)</span></h3>
          ${out.length ? `<div class="moments">${out.map(c => { const k = sel.findIndex(im => im.sid === c.sid && im.kind === c.kind); return `<button type="button" class="moment${k >= 0 ? ' on' : ''}" data-act="img" data-sid="${c.sid}" data-kind="${c.kind}" aria-pressed="${k >= 0}">${stageSVG(r.tl, r.setup, c.t, 160, 90, 'aria-hidden="true"')}<span>${k >= 0 ? `(${k + 1}) ` : ''}${hx(c.label)}</span></button>`; }).join('')}</div>` : '<p class="muted">עוד אין משפטים עם המחשה, אז אין תמונות לבחור. אפשר להוריד טקסט בלבד.</p>'}
          <label class="checkline"><input type="checkbox" data-in="noImages" ${P.noImages ? 'checked' : ''}> להוריד טקסט בלבד, בלי תמונות</label>
        </div>
      </div>
      <div class="card download">
        <button class="btn primary big" data-act="docClass">⬇ הורדת הסיפור לכיתה — Word</button>
        <p>בוורד יופיעו הסיפור ותמונות מהרגעים שבחרתם. את האנימציה מציגים כאן במשחק.</p>
        <p class="small">הקובץ לכיתה לא כולל את הרגש שתכננתם, את ההסברים שלכם או את ניחושי הכיתה.</p>
        <button class="btn" data-act="docWriter">⬇ עותק לכותב ולמורה (כולל הכוונה)</button>
        <p class="small">העותק לכותב כולל עמוד נוסף עם הרגשות שתכננתם וההסבר. לא לחלק לכיתה.</p>
      </div>
      <div class="card"><h3>שמירה והעברה למחשב אחר</h3>
        <p class="small">${storageOK ? 'העבודה נשמרת אוטומטית בדפדפן הזה, במחשב הזה.' : 'הדפדפן הזה לא שומר אוטומטית — הורידו גיבוי.'} כדי להמשיך במחשב אחר: הורידו קובץ פרויקט, ופתחו אותו שם בכפתור "טעינת קובץ פרויקט".</p>
        <div class="row"><button class="btn" data-act="backup">⬇ הורדת קובץ פרויקט (גיבוי)</button><label class="btn filebtn">⬆ טעינת קובץ פרויקט<input type="file" id="loadFile" accept=".json,application/json" data-in="loadFile"></label></div>
        <p class="small">קובץ הפרויקט מיועד לכותב: יש בו גם את הכוונה הסודית. לכיתה — רק קובץ הוורד.</p>
        <p id="loadMsg" class="small" role="status"></p>
      </div></section>`;
  },
  inputs: {
    title(el) { S.product.title = el.value; save(); const e = findEmotionWords(el.value), n = $('#titleEmo'); n.hidden = !e.length; if (e.length) n.textContent = `הכותרת אולי מגלה את הרגש (${e.join(', ')}). אפשר לבחור כותרת שלא מסגירה.`; },
    author(el) { S.product.author = el.value; save(); },
    noImages(el) { S.product.noImages = el.checked; save(); },
    loadFile(el) { const f = el.files && el.files[0]; if (f) loadProjectFile(f); el.value = ''; }
  },
  acts: {
    img(el) { const P = S.product, sid = el.dataset.sid, kind = el.dataset.kind; const i = P.images.findIndex(im => im.sid === sid && im.kind === kind); if (i >= 0) P.images.splice(i, 1); else { if (P.images.length >= 3) { announce('אפשר לבחור עד שלוש תמונות.'); return; } P.images.push({ sid, kind }); } save(); go('product'); const b = $(`[data-act="img"][data-sid="${sid}"][data-kind="${kind}"]`); if (b) b.focus(); },
    docClass() { makeDoc('class'); }, docWriter() { makeDoc('writer'); },
    backup() { exportProject(); }
  }
};
async function makeDoc(kind) {
  try {
    const pm = publicModel(), P = S.product, imgs = [];
    if (!P.noImages) {
      const { r, out } = imageCandidates();
      for (const im of P.images) { const c = out.find(x => x.sid === im.sid && x.kind === im.kind); if (c) imgs.push(await svgToPngBytes(stageSVG(r.tl, r.setup, c.t, W, H), 2)); }
    }
    const model = { title: P.title.trim() || 'הסיפור שלי', author: P.author.trim(), paragraphs: [storyParagraph(pm.sentences)].filter(Boolean), images: imgs, readerSpace: true, writerPage: null };
    if (!model.paragraphs.length) model.paragraphs = [''];
    if (kind === 'writer') {
      const sc = S.ws.secret, ws = S.ws;
      const rows = [];
      if (ws.challenge) { rows.push(['שתי התחושות שתכננתי', [sc.a, sc.b].filter(Boolean).join(' + ')]); rows.push(['מה גרם לתחושה הראשונה', sc.causeA]); rows.push(['מה גרם לתחושה השנייה', sc.causeB]); if (sc.hidden) rows.push(['רגש שהדמות מנסה להסתיר', sc.hidden]); }
      else { rows.push(['הרגש שתכננתי', [...sc.emo, sc.other].filter(Boolean).join(', ')]); rows.push(['ההסבר של הכותב', sc.why]); }
      if (ws.situation) rows.push(['מצב הפתיחה', ws.situation]);
      ws.sentences.forEach((s, i) => { if (s.text.trim()) rows.push([`משפט ${i + 1} — ההמחשה`, (describeDir(s.dir) || 'בלי המחשה (קריינות)') + (s.dir && s.dir.note ? ' | הערת הכותב: ' + s.dir.note : '')]); });
      if (S.present.guesses.length) rows.push(['פרשנויות שנאספו בכיתה', S.present.guesses.map((x, i) => `${i + 1}. ${x.feel}${x.detail ? ' — ' + x.detail : ''}`).join('\n')]);
      const ck = [...CHECKLIST, ...(ws.challenge ? [CHECK_ADV] : [])].map(c => (ws.checks[c.id] ? '✓ ' : '○ ') + c.text).join('\n');
      rows.push(['רשימת הבדיקה של הכותב', ck]);
      model.writerPage = { rows };
    }
    const blob = buildDocx(model);
    downloadBlob(blob, kind === 'writer' ? 'הסיפור_שלי_עותק_לכותב.docx' : 'הסיפור_שלי_לכיתה.docx');
    announce(kind === 'writer' ? 'העותק לכותב ולמורה ירד.' : 'קובץ הוורד לכיתה ירד.');
  } catch (e) { announce('לא הצלחנו ליצור את הקובץ. נסו שוב, או הורידו טקסט בלבד.'); console.error(e); }
}
function loadProjectFile(file) {
  const msg = t => { const m = $('#loadMsg'); if (m) m.textContent = t; announce(t); };
  if (file.size > 3e6) { msg('הקובץ גדול מדי ואינו קובץ פרויקט של המשחק. הטיוטה שלכם לא השתנתה.'); return; }
  const fr = new FileReader();
  fr.onload = async () => {
    let ns;
    try { const o = JSON.parse(fr.result); if (!o || o.app !== APP_ID || !o.state) throw new Error('app'); ns = cleanState(o.state); }
    catch (e) { msg('זה לא קובץ פרויקט מתאים. הטיוטה שלכם לא השתנתה.'); return; }
    if (!(await askConfirm('לטעון את הפרויקט מהקובץ? הוא יחליף את הטיוטה שפתוחה עכשיו. (כדאי להוריד גיבוי קודם.)', 'טעינה', 'ביטול'))) { msg('הטעינה בוטלה. הטיוטה לא השתנתה.'); return; }
    ns.settings = S.settings; S = ns; S.screen = 'product'; compileCache = { key: '', res: null };
    saveNow(); go('product'); msg('הפרויקט נטען: הטקסט וההמחשות שוחזרו.');
  };
  fr.onerror = () => msg('לא הצלחנו לקרוא את הקובץ. הטיוטה לא השתנתה.');
  fr.readAsText(file);
}

/* ---------------- אתחול ---------------- */
function applySettings() {
  Sound.muted = S.settings.muted; Engine.stepMode = S.settings.steps;
  const m = $('#muteBtn'), st = $('#stepsBtn');
  m.setAttribute('aria-pressed', S.settings.muted); m.textContent = S.settings.muted ? '🔇 צליל כבוי' : '🔊 צליל פועל';
  st.setAttribute('aria-pressed', S.settings.steps); st.textContent = S.settings.steps ? '🖼 תמונות לפי צעדים: פועל' : '🖼 תמונות לפי צעדים';
  for (const p of Players) p._notify && p._notify();
}
function init() {
  S = loadState();
  if (!storageOK) showStorageBanner();
  applySettings();
  document.addEventListener('click', async e => {
    const nav = e.target.closest('[data-go]'); if (nav) { go(nav.dataset.go); return; }
    const ga = e.target.closest('[data-gact]');
    if (ga) { if (ga.dataset.gact === 'backup') exportProject(); return; }
    const el = e.target.closest('[data-act]'); if (!el || !current || !current.acts) return;
    if (el.disabled) return;
    const f = current.acts[el.dataset.act]; if (f) { e.preventDefault(); await f.call(current, el, e); }
  });
  const onIn = e => { const el = e.target.closest('[data-in]'); if (!el || !current || !current.inputs) return; const f = current.inputs[el.dataset.in]; if (f) f.call(current, el, e); };
  document.addEventListener('input', e => { const el = e.target; if (el && (el.type === 'checkbox' || el.type === 'file')) return; onIn(e); });
  document.addEventListener('change', e => { const el = e.target.closest('[data-in]'); if (el && (el.type === 'checkbox' || el.type === 'file')) onIn(e); });
  $('#muteBtn').onclick = () => { S.settings.muted = !S.settings.muted; if (S.settings.muted) Sound.stopAll(); save(); applySettings(); };
  $('#stepsBtn').onclick = () => { S.settings.steps = !S.settings.steps; Engine.stopAll(); save(); applySettings(); announce(S.settings.steps ? 'מצב תמונות לפי צעדים פועל: הסרטים מוצגים כצעדים קבועים.' : 'מצב תמונות לפי צעדים כבוי.'); };
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { saveNow(); Engine.stopAll(); } });
  go(S.screen || 'home');
}
document.addEventListener('DOMContentLoaded', init);
