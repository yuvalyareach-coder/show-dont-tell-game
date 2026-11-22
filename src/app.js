'use strict';
/* =====================================================================
   האפליקציה: מסכים, מצב התלמיד, שמירה, מצב כיתה וייצוא.
   אנימציה קיימת רק במסך "מגלים". הסדנה, המשוב, ההצגה והתוצר — איור סטטי.
   ===================================================================== */
const APP_ID = 'bein-hashurot';
const STORE_KEY = 'bein-hashurot-v2', OLD_KEY = 'bein-hashurot-v1', OLD_BACKUP_KEY = 'bein-hashurot-v1-backup';
const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const hx = esc;
let S = null, storageOK = true, saveTimer = 0;

function uid() { return 'n' + Math.random().toString(36).slice(2, 8) + (Date.now() % 100000).toString(36); }
function defaultPlan() { return { feel: [], feelOther: '', want: '', why: '', a: '', b: '', advWant: '', conflict: '', hidden: '' }; }
function defaultWS() {
  return { step: 0, charId: 'noa', name: 'נועה', place: 'room', props: ['envelope'], text: '', adv: false, plan: defaultPlan(),
    draft1: null, reflect: { answers: {}, marks: [], versionText: '', qi: 0, deep: false },
    feedback: [], fbPending: false, friendMode: false, friendDraft: {}, revisions: [], change: { what: '', why: '', ref: '' }, chosen: 'current' };
}
function defaultState() {
  return { v: 2, screen: 'home', settings: { muted: false, steps: false }, learn: { cur: 0, sc: {} }, ws: defaultWS(),
    product: { title: '', author: '', noImage: false }, present: { guesses: [], showIllus: true }, legacy: null };
}

/* ---------------- אימות, תיקון והגירה ---------------- */
const str = (v, max) => typeof v === 'string' ? v.slice(0, max || 4000) : '';
const oneOf = (v, arr, d) => arr.includes(v) ? v : d;
/* מעבר מהגרסה הקודמת (כרטיסי משפטים + הוראות במה) למודל החדש — בלי לאבד מילים */
function migrateV1(o) {
  const w = o.ws || {}, sc = w.secret || {};
  const sents = Array.isArray(w.sentences) ? w.sentences.filter(s => s && typeof s.text === 'string') : [];
  const n = { v: 2, screen: o.screen === 'present' ? 'create' : o.screen, settings: o.settings, learn: o.learn, product: o.product, present: { showIllus: true, guesses: [] } };
  n.ws = {
    step: 1, charId: w.charId, name: w.name, place: w.place, props: w.prop ? [w.prop] : [],
    text: sents.map(s => s.text).filter(t => t.trim()).join(' '), adv: !!w.challenge,
    plan: { feel: sc.emo, feelOther: sc.other, want: '', why: [sc.why, sc.causeA && (sc.a || 'תחושה 1') + ': ' + sc.causeA, sc.causeB && (sc.b || 'תחושה 2') + ': ' + sc.causeB].filter(Boolean).join('\n'), a: sc.a, b: sc.b, advWant: '', conflict: '', hidden: sc.hidden }
  };
  if (o.present && Array.isArray(o.present.guesses)) n.present.guesses = o.present.guesses.map(g => ({ feel: g && g.feel, want: '', detail: g && g.detail }));
  n.legacy = { note: 'הוראות במה מהגרסה הקודמת. נשמרות לגיבוי בלבד ואינן מפעילות דבר.', sentences: sents, versions: o.versions || null };
  return n;
}
function cleanState(o) {
  if (!o || typeof o !== 'object' || !o.ws || typeof o.ws !== 'object') throw new Error('structure');
  if (Array.isArray(o.ws.sentences)) o = migrateV1(o);
  const d = defaultState(), w = o.ws, ws = d.ws;
  if (typeof w.text !== 'string') throw new Error('text');
  ws.text = str(w.text, 20000);
  ws.step = Math.min(4, Math.max(0, w.step | 0)); ws.charId = oneOf(w.charId, CHAR_ORDER, 'noa'); ws.name = str(w.name, 40) || CHARS[ws.charId].name;
  ws.place = oneOf(w.place, PLACE_ORDER, 'room');
  ws.props = Array.isArray(w.props) ? [...new Set(w.props.filter(p => PROP_ORDER.includes(p)))].slice(0, 2) : [];
  if (!ws.props.length) ws.props = ['envelope'];
  ws.adv = !!w.adv;
  const p = w.plan || {}; ws.plan = { feel: Array.isArray(p.feel) ? p.feel.filter(x => typeof x === 'string').slice(0, 6).map(x => x.slice(0, 40)) : [], feelOther: str(p.feelOther, 200), want: str(p.want, 300), why: str(p.why, 800), a: str(p.a, 60), b: str(p.b, 60), advWant: str(p.advWant, 300), conflict: str(p.conflict, 200), hidden: str(p.hidden, 60) };
  ws.draft1 = w.draft1 && typeof w.draft1.text === 'string' ? { text: str(w.draft1.text, 20000), at: str(w.draft1.at, 40) } : null;
  const r = w.reflect || {}; ws.reflect = { answers: {}, marks: [], versionText: str(r.versionText, 20000), qi: Math.max(0, r.qi | 0), deep: !!r.deep };
  if (r.answers && typeof r.answers === 'object') for (const q of REFLECT_Q) { const a = r.answers[q.id]; if (a && typeof a === 'object') ws.reflect.answers[q.id] = { quote: str(a.quote, 600), expl: str(a.expl, 1000), notFound: !!a.notFound }; }
  if (Array.isArray(r.marks)) ws.reflect.marks = r.marks.filter(m => m && ['feel', 'want'].includes(m.type) && typeof m.text === 'string' && m.text.trim()).slice(0, 30).map(m => ({ type: m.type, text: str(m.text, 600) }));
  ws.feedback = Array.isArray(w.feedback) ? w.feedback.slice(0, 20).map(f => ({ id: str(f && f.id, 30) || uid(), who: str(f && f.who, 60), feel: str(f && f.feel, 600), want: str(f && f.want, 600), detail: str(f && f.detail, 600), wish: str(f && f.wish, 600), two: str(f && f.two, 600), revealed: !!(f && f.revealed), why: str(f && f.why, 800), versionText: str(f && f.versionText, 20000), at: str(f && f.at, 40) })) : [];
  ws.fbPending = !!w.fbPending; ws.friendMode = false;
  ws.friendDraft = {}; if (w.friendDraft && typeof w.friendDraft === 'object') for (const k of ['who', 'feel', 'want', 'detail', 'wish', 'two']) ws.friendDraft[k] = str(w.friendDraft[k], 600);
  ws.revisions = Array.isArray(w.revisions) ? w.revisions.filter(v => v && typeof v.text === 'string').slice(0, 20).map(v => ({ text: str(v.text, 20000), at: str(v.at, 40), what: str(v.what, 400), why: str(v.why, 400), ref: str(v.ref, 40), reread: str(v.reread, 600) })) : [];
  const c = w.change || {}; ws.change = { what: str(c.what, 400), why: str(c.why, 400), ref: str(c.ref, 40) };
  ws.chosen = typeof w.chosen === 'string' && (w.chosen === 'current' || (w.chosen === 'draft1' && ws.draft1) || (/^rev:\d+$/.test(w.chosen) && +w.chosen.slice(4) < ws.revisions.length)) ? w.chosen : 'current';
  if (o.settings) { d.settings.muted = !!o.settings.muted; d.settings.steps = !!o.settings.steps; }
  if (o.learn && typeof o.learn === 'object') {
    d.learn.cur = Math.min(4, Math.max(0, o.learn.cur | 0));
    for (const scn of SCENES) {
      const x = o.learn.sc && o.learn.sc[scn.id];
      if (x && typeof x === 'object') d.learn.sc[scn.id] = { answer: str(x.answer), want: str(x.want), clue: str(x.clue), moments: Array.isArray(x.moments) ? x.moments.filter(n => Number.isInteger(n) && n >= 0 && n < 10).slice(0, 2) : [], hint: Math.min(3, x.hint | 0), watched: !!x.watched, revealed: !!x.revealed, r: Math.min(4, x.r | 0), keep: oneOf(x.keep, ['', 'keep', 'change'], ''), answer2: str(x.answer2), keepWhy: str(x.keepWhy), actAns: str(x.actAns), actShown: !!x.actShown, varNote: str(x.varNote), ver: oneOf(x.ver, ['A', 'B', 'VA', 'VB'], 'A') };
    }
  }
  if (o.product) { d.product.title = str(o.product.title, 120); d.product.author = str(o.product.author, 60); d.product.noImage = !!o.product.noImage; }
  if (o.present) { d.present.showIllus = o.present.showIllus !== false; d.present.guesses = Array.isArray(o.present.guesses) ? o.present.guesses.slice(0, 3).map(x => ({ feel: str(x && x.feel, 300), want: str(x && x.want, 300), detail: str(x && x.detail, 300) })) : []; }
  if (o.legacy && typeof o.legacy === 'object') d.legacy = JSON.parse(JSON.stringify(o.legacy));
  d.screen = oneOf(o.screen, ['home', 'learn', 'create', 'present', 'product'], 'home');
  if (d.screen === 'present') d.screen = 'create';
  return d;
}

/* ---------------- שמירה ---------------- */
function lsGet(k) { return window.localStorage.getItem(k); }
function loadState() {
  let raw = null, old = null;
  try { raw = lsGet(STORE_KEY); old = lsGet(OLD_KEY); window.localStorage.setItem('__t', '1'); window.localStorage.removeItem('__t'); }
  catch (e) { storageOK = false; }
  if (raw) { try { return cleanState(JSON.parse(raw)); } catch (e) { } }
  if (old) {
    try {
      if (!lsGet(OLD_BACKUP_KEY)) window.localStorage.setItem(OLD_BACKUP_KEY, old); // עותק גיבוי של הנתונים הישנים
      const st = cleanState(JSON.parse(old)); st._migrated = true; return st;
    } catch (e) { }
  }
  return defaultState();
}
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 350); setSaveStatus('שומרים…'); }
function saveNow() {
  clearTimeout(saveTimer);
  if (!storageOK) { setSaveStatus('לא נשמר במחשב'); return; }
  try { const c = Object.assign({}, S); delete c._migrated; window.localStorage.setItem(STORE_KEY, JSON.stringify(c)); setSaveStatus('נשמר'); }
  catch (e) { storageOK = false; showStorageBanner(); setSaveStatus('לא נשמר במחשב'); }
}
function setSaveStatus(t) { const el = $('#saveStatus'); if (el) el.textContent = t; }
function showStorageBanner() {
  const b = $('#banner'); if (!b) return; b.hidden = false;
  b.innerHTML = `<span>הדפדפן לא מאפשר שמירה אוטומטית במחשב הזה. אפשר להמשיך לעבוד — ולפני סגירה כדאי להוריד קובץ גיבוי.</span> <button class="btn small" data-gact="backup">הורדת גיבוי</button>`;
}
function exportProject() {
  const st = Object.assign({}, S); delete st._migrated;
  downloadBlob(new Blob([JSON.stringify({ app: APP_ID, format: 2, exportedAt: new Date().toISOString(), state: st }, null, 1)], { type: 'application/json' }), 'הסיפור_שלי_גיבוי.json');
  announce('קובץ הגיבוי ירד.');
}
function downloadBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
function announce(t) { const el = $('#live'); if (!el) return; el.textContent = ''; setTimeout(() => { el.textContent = t; }, 30); toast(t); }
let toastT = 0;
function toast(t) { const el = $('#toast'); if (!el) return; el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2600); }
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
const nowISO = () => new Date().toISOString();
const fmtTime = iso => { try { const d = new Date(iso); return d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };

/* ---------------- רכיב במה (במסך "מגלים" בלבד) ---------------- */
class StageUI {
  constructor(host, o) {
    o = o || {};
    host.innerHTML = `<div class="stage-frame"><div class="stage" tabindex="0"></div></div>
      <div class="controls" role="group" aria-label="פקדי הסרט">
        <button class="btn primary pp" type="button"></button>
        <button class="btn restart" type="button">⟲ מההתחלה</button>
        <button class="btn prev" type="button">→ רגע קודם</button>
        <button class="btn next" type="button">רגע הבא ←</button>
        <input class="scrub" type="range" min="0" max="1000" value="0" aria-label="מיקום בסרט">
        <span class="steplabel"></span>
      </div>`;
    this.host = host; this.o = o;
    this.p = new Player($('.stage', host), { label: o.label || 'במה' });
    this.btn = { pp: $('.pp', host), restart: $('.restart', host), prev: $('.prev', host), next: $('.next', host) };
    this.scrub = $('.scrub', host); this.lab = $('.steplabel', host);
    this.btn.pp.onclick = () => { if (Engine.stepMode) this.p.step(1); else this.p.toggle(); this.sync(); if (o.onUser) o.onUser(); };
    this.btn.restart.onclick = () => { if (Engine.stepMode) { this.p.pause(); this.p.seek(this.p.r0); this.sync(); } else this.p.restart(); if (o.onUser) o.onUser(); };
    this.btn.prev.onclick = () => { this.p.step(-1); this.sync(); };
    this.btn.next.onclick = () => { this.p.step(1); this.sync(); if (o.onUser) o.onUser(); };
    this.scrub.oninput = () => { this.p.pause(); const r = this.p.r1 - this.p.r0; this.p.seek(this.p.r0 + r * this.scrub.value / 1000); this.sync(); };
    $('.stage', host).addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); this.btn.pp.click(); } if (e.key === 'ArrowLeft') { e.preventDefault(); this.btn.next.click(); } if (e.key === 'ArrowRight') { e.preventDefault(); this.btn.prev.click(); } });
    this.p.onState = () => this.sync();
    this.p.onTick = t => { const r = this.p.r1 - this.p.r0; this.scrub.value = r > 0 ? Math.round((t - this.p.r0) / r * 1000) : 0; };
    this.p.onEnd = () => { if (this.full) { const t = this.p.t; this.p.range(0, this.p.tl.dur); this.p.t = t; this.full = false; } this.sync(); };
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
    if (p.tl && sm) { const si = p.stepIndex(); this.lab.textContent = `צעד ${Math.max(0, si.i + 1)} מתוך ${si.n}`; } else this.lab.textContent = '';
    this.host.classList.toggle('playing', p.playing);
  }
  destroy() { this.p.destroy(); }
}

/* ---------------- מסגרת ומסכים ---------------- */
let current = null;
const SCREENS = {};
function go(screen, opt) {
  Engine.stopAll(); Sound.stopAll();
  if (current && current.unmount) current.unmount();
  for (const p of [...Players]) p.destroy(); // אין נגנים מחוץ ל"מגלים"
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
function charThumb(id, w) { const s = charBase(0); return `<svg viewBox="-62 130 124 278" width="${w || 70}" height="${Math.round((w || 70) * 278 / 124)}" aria-hidden="true">${drawChar(s, CHARS[id])}</svg>`; }
const defsBox = () => `<div class="defs"><p><b>רגש</b> — ${hx(DEF_FEEL.replace(/^רגש הוא /, ''))}</p><p><b>רצון</b> — ${hx(DEF_WANT.replace(/^רצון הוא /, ''))}</p><p class="small">${hx(DEF_BOTH)}</p></div>`;
const illusSel = ws => ({ charId: ws.charId, place: ws.place, props: ws.props.slice() });

/* ======================= מסך פתיחה ======================= */
SCREENS.home = {
  html() {
    const started = Object.keys(S.learn.sc).length > 0, doneN = SCENES.filter(s => (S.learn.sc[s.id] || {}).revealed).length;
    return `<section class="home">
      <div class="hero">
        <div class="hero-text">
          <h1>${hx(TITLE)}</h1>
          <p class="sub">${hx(SUBTITLE)}</p>
          <p class="lead">נלמד לכתוב כך שהקוראים יגלו מה הדמות מרגישה ומה היא רוצה. נצפה בחמש סצנות, נחפש רמזים, ואז נבחר איור ונכתוב עליו סיפור משלנו. בסוף נבדוק את הכתיבה עם חבר ונשפר פרט אחד.</p>
          ${defsBox()}
          <p class="note">גם להגיד מה הדמות מרגישה או רוצה יכול להתאים לסיפור. כאן נתאמן בבחירת פרטים שיאפשרו לקורא לגלות בעצמו.</p>
          <div class="row">
            <button class="btn primary big" data-act="start">${started ? 'ממשיכים לגלות' : 'מתחילים לגלות'}</button>
            <button class="btn big" data-act="toCreate">ישר לסדנת הכתיבה</button>
          </div>
          ${started ? `<p class="small">גיליתם ${doneN} מתוך 5 סצנות. העבודה שלכם שמורה במחשב הזה.</p>` : ''}
        </div>
        <div class="hero-art" id="heroArt"></div>
      </div>
      <ol class="road">
        <li><b>מגלים</b> — צופים בחמש סצנות קצרות ומחפשים רמזים לרגש ולרצון.</li>
        <li><b>יוצרים</b> — בוחרים איור, כותבים, בודקים את הרמזים, מתייעצים עם חבר ומשכתבים.</li>
        <li><b>מציגים</b> — הכיתה קוראת ומנחשת, ורק אז חושפים.</li>
        <li><b>התוצר שלי</b> — מסמך Word לכיתה עם הסיפור והאיור.</li>
      </ol>
    </section>`;
  },
  mount() { $('#heroArt').innerHTML = illusSVG({ charId: 'maya', place: 'corridor', props: ['ball'] }, null, null, 'class="hero-svg" role="img" aria-label="איור: דמות במסדרון ליד דלת"'); },
  acts: { start: () => go('learn'), toCreate: () => go('create') }
};

/* ======================= מגלים ======================= */
SCREENS.learn = {
  ui: null, tlCache: {}, ver: 'A',
  sc() { return SCENES[S.learn.cur]; },
  st() { const id = this.sc().id; if (!S.learn.sc[id]) S.learn.sc[id] = { answer: '', want: '', clue: '', moments: [], hint: 0, watched: false, revealed: false, r: 0, keep: '', answer2: '', keepWhy: '', actAns: '', actShown: false, varNote: '', ver: 'A' }; return S.learn.sc[id]; },
  tl(v) { const id = this.sc().id, k = id + v; if (!this.tlCache[k]) this.tlCache[k] = SCENE_STAGE[id][v](); return this.tlCache[k]; },
  verKeys() { return this.sc().secret.variation.kind === 'two' ? ['VA', 'VB'] : ['A', 'B']; },
  html() {
    const i = S.learn.cur;
    const dots = SCENES.map((s, j) => `<button class="dot${j === i ? ' cur' : ''}${(S.learn.sc[s.id] || {}).revealed ? ' done' : ''}" data-act="goScene" data-i="${j}" aria-label="סצנה ${j + 1}${(S.learn.sc[s.id] || {}).revealed ? ', נחשפה' : ''}" ${j === i ? 'aria-current="step"' : ''}>${j + 1}</button>`).join('');
    return `<section class="learn">
      <h2 class="screen-title">מגלים רגש ורצון</h2>
      <div class="learn-top"><div class="progress"><span class="plabel">סצנה ${i + 1} מתוך 5</span><span class="dots">${dots}</span></div>
        <div class="learn-tools"><button type="button" class="btn small" id="muteBtn" data-act="mute" aria-pressed="${S.settings.muted}">${S.settings.muted ? '🔇 צליל כבוי' : '🔊 צליל פועל'}</button><button type="button" class="btn small" id="stepsBtn" data-act="steps" aria-pressed="${S.settings.steps}">${S.settings.steps ? '🖼 תמונות לפי צעדים: פועל' : '🖼 תמונות לפי צעדים'}</button></div>
      </div>
      <div class="cardsbox"><span class="small">כרטיסי תזכורת:</span><ul class="mcards">${this.cardsHTML()}</ul></div>
      <div class="work"><div class="stage-col" id="stageHost"></div><div class="panel" id="panel"></div></div>
    </section>`;
  },
  cardsHTML() { return SCENES.map(s => { const got = (S.learn.sc[s.id] || {}).revealed; return `<li class="mcard${got ? ' got' : ''}"><span class="mc-name">${got ? hx(s.card.name) : '?'}</span><span class="mc-q">${got ? hx(s.card.q) : 'כרטיס שעוד לא נאסף'}</span></li>`; }).join(''); },
  mount() {
    Sound.muted = S.settings.muted; Engine.stepMode = S.settings.steps;
    this.ui = new StageUI($('#stageHost'), { label: 'במה: סצנה ' + (S.learn.cur + 1), onUser: () => this.onUser() });
    const st = this.st();
    this.ver = st.revealed && st.r === 4 ? st.ver : 'A';
    this.ui.load(this.tl(this.ver), SCENE_STAGE[this.sc().id].setup(), 0);
    this.renderPanel();
  },
  unmount() { if (this.ui) this.ui.destroy(); this.ui = null; Engine.stopAll(); Sound.stopAll(); },
  onUser() { const st = this.st(); if (!st.watched) { st.watched = true; save(); this.renderPanel(); } },
  thumbs(sel, act) {
    const sc = this.sc(), tl = this.tl('A'), setup = SCENE_STAGE[sc.id].setup();
    return `<div class="moments">${sc.moments.map((t, j) => `<button type="button" class="moment${sel.includes(j) ? ' on' : ''}" data-act="${act}" data-j="${j}" aria-pressed="${sel.includes(j)}">${stageSVG(tl, setup, t, 160, 90, 'aria-hidden="true"')}<span>רגע ${j + 1}</span></button>`).join('')}</div>`;
  },
  canReveal() { const st = this.st(); return !!(st.answer.trim() && st.want.trim() && st.clue.trim()); },
  renderPanel() {
    const sc = this.sc(), st = this.st(), P = $('#panel'); if (!P) return;
    let o = `<h2>${hx(sc.title)}</h2><p class="context">${hx(sc.context)}</p>`;
    if (!st.watched) {
      o += `<p class="muted">צפו בסצנה. אפשר לעצור, לחזור ולעבור בין רגעים קפואים.</p><button class="btn primary big" data-act="watch">▶ צפו בסצנה</button>`;
    } else if (!st.revealed) {
      o += `<div class="qseq">
        <div class="qbox"><label class="q" for="ans">1. מה לדעתך הדמות מרגישה?</label><textarea id="ans" data-in="answer" rows="2">${hx(st.answer)}</textarea></div>
        <div class="qbox" id="q2" ${st.answer.trim() ? '' : 'hidden'}><label class="q" for="want">2. מה היא רוצה להשיג או שיקרה?</label><textarea id="want" data-in="want" rows="2">${hx(st.want)}</textarea></div>
        <div class="qbox" id="q3" ${st.answer.trim() && st.want.trim() ? '' : 'hidden'}><label class="q" for="clue">3. איזה מעשה או משפט עזר לך להבין?</label>
          <p class="small">אפשר לבחור עד שתי תמונות רגע מהסרט ולהוסיף הסבר קצר.</p>${this.thumbs(st.moments, 'pickMoment')}
          <textarea id="clue" data-in="clue" rows="2">${hx(st.clue)}</textarea></div>
        <p class="small">אפשר לכתוב תשובות קצרות, ויותר מפירוש אחד.</p></div>
        <div class="hintbox">${st.hint < sc.hints.length ? `<button class="btn small" data-act="hint">צריכים רמז?</button>` : ''}${sc.hints.slice(0, st.hint).map(h => `<p class="hint">💡 ${hx(h)}</p>`).join('')}</div>
        <div class="mainact"><button class="btn primary big" id="revealBtn" data-act="reveal" ${this.canReveal() ? '' : 'disabled'}>מה התכוון המחבר להראות?</button>
        <p class="small" id="revealWhy">${this.canReveal() ? '' : 'ענו על שלוש השאלות כדי להמשיך.'}</p></div>`;
    } else {
      const tabs = ['משווים', 'הרמזים בקטע', 'מה היא מנסה להשיג?', 'קריאה אחרת', 'משנים פרט'];
      o += `<div class="rtabs" role="tablist">${tabs.map((t, j) => `<button role="tab" class="rtab${st.r === j ? ' on' : ''}" aria-selected="${st.r === j}" data-act="rtab" data-r="${j}">${j + 1}. ${t}</button>`).join('')}</div><div class="rbody">${this.revealBody()}</div>`;
    }
    P.innerHTML = o;
  },
  revealBody() {
    const sc = this.sc(), st = this.st(), sec = sc.secret;
    if (st.r === 0) {
      const mine = st.moments.map(j => `<span class="mini">${stageSVG(this.tl('A'), SCENE_STAGE[sc.id].setup(), sc.moments[j], 120, 68, 'aria-hidden="true"')}<span>רגע ${j + 1}</span></span>`).join('');
      return `<div class="compare3"><div class="card mine"><h3>מה כתבתם</h3><h4>רגש</h4><p class="ans">${hx(st.answer)}</p><h4>רצון</h4><p class="ans">${hx(st.want)}</p><h4>מה עזר לכם להבין</h4><p>${hx(st.clue)}</p>${mine ? `<div class="minis">${mine}</div>` : ''}${st.answer2 ? `<h4>הפרשנות המתוקנת שלכם</h4><p>${hx(st.answer2)}</p>` : ''}</div>
        <div class="author-col"><div class="card author"><h3>הרגש שאליו התכוון המחבר</h3><p class="ans">${hx(sec.intent)}</p></div><div class="card author want"><h3>הרצון של הדמות</h3><p class="ans">${hx(sec.want)}</p></div></div></div>
        <div class="tellshow"><p>אפשר לומר: <b>${hx(sec.tell)}</b></p><p>כאן המחבר הראה זאת כך: <b>${hx(sec.show)}</b></p></div>
        <p class="small">ההשוואה היא כדי להתבונן — לא כדי לקבל ציון.</p>
        <div class="mainact"><button class="btn primary big" data-act="rtab" data-r="1">לקטע ולרמזים</button></div>`;
    }
    if (st.r === 1) {
      let para = hx(sec.paragraph);
      sec.clues.forEach((c, j) => { para = para.replace(hx(c.phrase), `<button type="button" class="clue" data-act="clue" data-j="${j}">${hx(c.phrase)}<span class="ctag">${KIND_LABEL[c.kind]}</span></button>`); });
      return `<p class="small">לחצו על רמז מודגש — הסרט יראה את הרגע שלו. ליד כל רמז כתוב אם הוא תומך ברגש, ברצון או בשניהם.</p><blockquote class="para">${para}</blockquote>
        <div class="explain" id="explain" aria-live="polite"><p class="muted">ההסבר יופיע כאן.</p></div>
        <div class="mainact"><button class="btn primary big" data-act="rtab" data-r="2">המשך</button></div>`;
    }
    if (st.r === 2) {
      return `<label class="q" for="actAns">איזו פעולה מראה מה ${sc.id === 's1' || sc.id === 's3' || sc.id === 's5' ? 'הוא מנסה' : 'היא מנסה'} להשיג?</label><textarea id="actAns" data-in="actAns" rows="2">${hx(st.actAns)}</textarea>
        ${st.actShown ? `<div class="explain"><p><b>הסבר:</b> ${hx(sec.wantAction)}</p><p>${hx(sec.wantLink)}</p></div>` : `<button class="btn" data-act="showAct">הצגת ההסבר</button>`}
        <div class="mainact"><button class="btn primary big" data-act="rtab" data-r="3">המשך</button></div>`;
    }
    if (st.r === 3) {
      return `<p class="big-note">אפשר להבין גם אחרת, אם מצביעים על רמז מתאים.</p><p>${hx(sec.alt)}</p>
        <p class="q">האם תשאירו את הפרשנות שלכם או תשנו אותה?</p>
        <div class="row">${chip('משאירים את הפרשנות ומנמקים', 'keep', { v: 'keep' }, st.keep === 'keep')}${chip('שומרים פרשנות מתוקנת', 'keep', { v: 'change' }, st.keep === 'change')}</div>
        ${st.keep === 'keep' ? `<label class="q" for="keepWhy">על איזה רמז אתם מסתמכים?</label><textarea id="keepWhy" data-in="keepWhy" rows="2">${hx(st.keepWhy)}</textarea>` : ''}
        ${st.keep === 'change' ? `<label class="q" for="ans2">הפרשנות המתוקנת (הראשונה נשמרת):</label><textarea id="ans2" data-in="answer2" rows="2">${hx(st.answer2)}</textarea>` : ''}
        <div class="saved-both"><p class="small">הפרשנות הראשונה: <b>${hx(st.answer)} · ${hx(st.want)}</b></p><p class="small" id="ans2show" ${st.answer2 ? '' : 'hidden'}>הפרשנות המתוקנת: <b>${hx(st.answer2)}</b></p></div>
        <div class="mainact"><button class="btn primary big" data-act="rtab" data-r="4">משנים פרט אחד</button></div>`;
    }
    const v = sec.variation, [ka, kb] = this.verKeys();
    const curPara = this.ver === kb ? v.paraB : (v.kind === 'two' && this.ver === ka ? v.paraA : sec.paragraph);
    const isLast = S.learn.cur === SCENES.length - 1;
    return `<p><b>הפרט שמשתנה:</b> ${hx(v.change)}</p>
      <div class="row">${v.kind === 'two' ? chip('▶ ' + v.labelA, 'ver', { v: ka }, this.ver === ka) : chip('▶ ' + v.labelA, 'ver', { v: 'A' }, this.ver === 'A')}${chip('▶ ' + v.labelB, 'ver', { v: kb }, this.ver === kb)}</div>
      <blockquote class="para small-para" id="verPara">${hx(curPara)}</blockquote>
      <label class="q" for="varNote">${hx(v.question)}</label><textarea id="varNote" data-in="varNote" rows="2">${hx(st.varNote)}</textarea>
      <p class="cardgot">🃏 אספתם את כרטיס <b>${hx(sc.card.name)}</b>: ${hx(sc.card.q)}</p>
      ${isLast ? `<p class="small">בסדנה תוכלו לנסות את <b>האתגר: שתי תחושות ורצון</b> — ההמשכים השונים של נועם הם הגשר אליו.</p>` : ''}
      <div class="mainact"><button class="btn primary big" data-act="${isLast ? 'toCreate' : 'nextScene'}">${isLast ? 'לסדנת הכתיבה' : 'לסצנה הבאה'}</button></div>`;
  },
  inputs: {
    answer(el) { this.st().answer = el.value; save(); this.updQ(); },
    want(el) { this.st().want = el.value; save(); this.updQ(); },
    clue(el) { this.st().clue = el.value; save(); this.updQ(); },
    answer2(el) { this.st().answer2 = el.value; save(); const p = $('#ans2show'); if (p) { p.hidden = !el.value.trim(); $('b', p).textContent = el.value; } },
    keepWhy(el) { this.st().keepWhy = el.value; save(); },
    actAns(el) { this.st().actAns = el.value; save(); },
    varNote(el) { this.st().varNote = el.value; save(); }
  },
  updQ() {
    const st = this.st(), q2 = $('#q2'), q3 = $('#q3');
    if (q2) q2.hidden = !st.answer.trim(); if (q3) q3.hidden = !(st.answer.trim() && st.want.trim());
    const b = $('#revealBtn'), w = $('#revealWhy'), ok = this.canReveal(); if (b) b.disabled = !ok; if (w) w.textContent = ok ? '' : 'ענו על שלוש השאלות כדי להמשיך.';
  },
  acts: {
    watch() { const st = this.st(); st.watched = true; save(); this.renderPanel(); this.ui.playAll(); },
    goScene(el) { S.learn.cur = +el.dataset.i; save(); go('learn'); },
    mute() { S.settings.muted = !S.settings.muted; Sound.muted = S.settings.muted; if (S.settings.muted) Sound.stopAll(); save(); const b = $('#muteBtn'); b.setAttribute('aria-pressed', S.settings.muted); b.textContent = S.settings.muted ? '🔇 צליל כבוי' : '🔊 צליל פועל'; },
    steps() { S.settings.steps = !S.settings.steps; Engine.stepMode = S.settings.steps; this.ui.p.pause(); save(); const b = $('#stepsBtn'); b.setAttribute('aria-pressed', S.settings.steps); b.textContent = S.settings.steps ? '🖼 תמונות לפי צעדים: פועל' : '🖼 תמונות לפי צעדים'; this.ui.sync(); announce(S.settings.steps ? 'מצב תמונות לפי צעדים פועל.' : 'מצב תמונות לפי צעדים כבוי.'); },
    hint() { const st = this.st(); st.hint = Math.min(this.sc().hints.length, st.hint + 1); save(); this.renderPanel(); const h = $$('.hint'); if (h.length) announce(h[h.length - 1].textContent); },
    pickMoment(el) {
      const st = this.st(), j = +el.dataset.j, i = st.moments.indexOf(j);
      if (i >= 0) st.moments.splice(i, 1); else { if (st.moments.length >= 2) st.moments.shift(); st.moments.push(j); }
      save(); this.ui.clip(0, this.sc().moments[j], true);
      $$('.moment').forEach(b => { const on = st.moments.includes(+b.dataset.j); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    },
    reveal() { if (!this.canReveal()) return; const st = this.st(); st.revealed = true; st.r = 0; save(); this.renderPanel(); $('.mcards').innerHTML = this.cardsHTML(); $$('.dot').forEach((d, j) => d.classList.toggle('done', !!(S.learn.sc[SCENES[j].id] || {}).revealed)); announce('נחשפה כוונת המחבר. התשובות שלכם נשמרו לידה.'); },
    rtab(el) { const st = this.st(); st.r = +el.dataset.r; save(); if (st.r !== 4 && this.ver !== 'A') { this.ver = 'A'; this.ui.load(this.tl('A'), SCENE_STAGE[this.sc().id].setup(), 0); } this.renderPanel(); const f = $('.rtab.on'); if (f) f.focus(); },
    clue(el) {
      const c = this.sc().secret.clues[+el.dataset.j];
      if (this.ver !== 'A') { this.ver = 'A'; this.ui.load(this.tl('A'), SCENE_STAGE[this.sc().id].setup(), 0); }
      this.ui.clip(c.from, c.t);
      $$('.clue').forEach(b => b.classList.toggle('on', b === el));
      $('#explain').innerHTML = `<p><b>${hx(c.phrase)}</b> <span class="ctag">רמז ל${KIND_LABEL[c.kind]}</span></p><p>${hx(c.expl)}</p>`;
    },
    showAct() { this.st().actShown = true; save(); this.renderPanel(); },
    keep(el) { this.st().keep = el.dataset.v; save(); this.renderPanel(); const t = $('#ans2') || $('#keepWhy'); if (t) t.focus(); },
    ver(el) {
      this.ver = el.dataset.v; this.st().ver = this.ver; save();
      this.ui.load(this.tl(this.ver), SCENE_STAGE[this.sc().id].setup(), 0); this.ui.playAll();
      const v = this.sc().secret.variation, [ka, kb] = this.verKeys();
      $('#verPara').textContent = this.ver === kb ? v.paraB : (v.kind === 'two' && this.ver === ka ? v.paraA : this.sc().secret.paragraph);
      $$('[data-act="ver"]').forEach(b => { const on = b.dataset.v === this.ver; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    },
    nextScene() { S.learn.cur = Math.min(SCENES.length - 1, S.learn.cur + 1); save(); go('learn'); },
    toCreate() { go('create'); }
  }
};

/* ======================= עזרים לטקסט ======================= */
function versionList(ws) {
  const out = [{ id: 'current', label: 'הגרסה האחרונה (מה שכתוב עכשיו)', text: ws.text }];
  if (ws.draft1) out.push({ id: 'draft1', label: 'הטיוטה הראשונה', text: ws.draft1.text });
  ws.revisions.forEach((r, i) => out.push({ id: 'rev:' + i, label: 'אחרי שיפור ' + (i + 1), text: r.text }));
  return out;
}
function chosenVersion(ws) { ws = ws || S.ws; return versionList(ws).find(v => v.id === ws.chosen) || versionList(ws)[0]; }
function markedHTML(text, marks) {
  const n = text.length, fl = new Uint8Array(n);
  for (const m of marks) { const i = m.text ? text.indexOf(m.text) : -1; if (i < 0) continue; for (let k = i; k < i + m.text.length; k++) fl[k] |= m.type === 'feel' ? 1 : 2; }
  let o = '', k = 0;
  while (k < n) { let j = k; while (j < n && fl[j] === fl[k]) j++; const seg = hx(text.slice(k, j)); if (fl[k]) { const l = fl[k] === 3 ? 'רגש + רצון' : fl[k] === 1 ? 'רגש' : 'רצון'; o += `<mark class="mk mk${fl[k]}">${seg}<span class="mtag">${l}</span></mark>`; } else o += seg; k = j; }
  return o;
}
function wordDiff(a, b) {
  const A = a.split(/(\s+)/).filter(x => x !== ''), B = b.split(/(\s+)/).filter(x => x !== '');
  if (A.length * B.length > 400000) return { a: hx(a), b: hx(b) };
  const dp = Array.from({ length: A.length + 1 }, () => new Uint16Array(B.length + 1));
  for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  let i = 0, j = 0, oa = '', ob = '';
  while (i < A.length || j < B.length) {
    if (i < A.length && j < B.length && A[i] === B[j]) { oa += hx(A[i]); ob += hx(B[j]); i++; j++; }
    else if (j < B.length && (i >= A.length || dp[i][j + 1] >= dp[i + 1][j])) { ob += /^\s+$/.test(B[j]) ? hx(B[j]) : `<ins><span class="sr">נוסף: </span>${hx(B[j])}</ins>`; j++; }
    else { oa += /^\s+$/.test(A[i]) ? hx(A[i]) : `<del><span class="sr">נמחק: </span>${hx(A[i])}</del>`; i++; }
  }
  return { a: oa, b: ob };
}
const sentenceCount = t => (t.match(/[^.!?…]+[.!?…]+/g) || []).length + (/[^.!?…\s'"״]\s*$/.test(t.trim()) && t.trim() ? 1 : 0);
function planSummary(ws) {
  const p = ws.plan, rows = [];
  if (ws.adv) { rows.push(['שתי התחושות', [p.a, p.b].filter(Boolean).join(' + ')]); rows.push(['מה הדמות רוצה שיקרה', p.advWant]); if (p.conflict) rows.push(['רצון שמתנגש ברגש', p.conflict]); if (p.hidden) rows.push(['רגש שהדמות מנסה להסתיר', p.hidden]); }
  else { rows.push(['מה הדמות מרגישה', [...p.feel, p.feelOther].filter(Boolean).join(', ')]); rows.push(['מה היא רוצה להשיג או שיקרה', p.want]); }
  if (p.why) rows.push(['הסבר הכותב', p.why]);
  return rows;
}

/* ======================= יוצרים ======================= */
SCREENS.create = {
  html() {
    const ws = S.ws;
    if (ws.friendMode) return this.friendHTML();
    return `<section class="create">
      <div class="create-head"><h2>כותבים ומראים רגש ורצון</h2>
        <details class="defs-d"><summary>מה ההבדל בין רגש לרצון?</summary>${defsBox()}</details>
        <button class="btn challenge${ws.adv ? ' on' : ''}" data-act="adv" aria-pressed="${ws.adv}">⚡ אתגר: שתי תחושות ורצון</button></div>
      <ol class="steps">${WS_STEPS.map((t, j) => `<li><button class="stepb${ws.step === j ? ' on' : ''}" ${ws.step === j ? 'aria-current="step"' : ''} data-act="step" data-s="${j}">${j + 1}. ${t}</button></li>`).join('')}</ol>
      <div class="work ws"><div class="illus-col"><div class="illus-frame" id="illus" role="img" aria-label="איור הפתיחה">${illusSVG(illusSel(ws), null, null, 'aria-hidden="true"')}</div>
        <p class="illus-name">שם הדמות: <b id="illusName">${hx(ws.name || '')}</b></p><p class="small illus-note">${hx(ILLUS_NOTE)}</p></div>
        <div class="panel" id="panel">${this.panel()}</div></div>
    </section>`;
  },
  refreshIllus() { const el = $('#illus'); if (el) el.innerHTML = illusSVG(illusSel(S.ws), null, null, 'aria-hidden="true"'); },
  renderPanel() { const P = $('#panel'); if (P) { const y = P.scrollTop; P.innerHTML = this.panel(); P.scrollTop = y; } },
  panel() { const s = S.ws.step; return s === 0 ? this.p0() : s === 1 ? this.p1() : s === 2 ? this.p2() : s === 3 ? this.p3() : this.p4(); },
  /* --- 1. בוחרים איור --- */
  p0() {
    const ws = S.ws, p = ws.plan;
    let o = `<h3>1. בוחרים איור</h3><p class="lead2">בחרו דמות, מקום וחפץ אחד או שניים. זו נקודת ההתחלה של הסיפור.</p>
      <h4>דמות</h4><div class="chars">${CHAR_ORDER.map(id => `<button type="button" class="charcard${ws.charId === id ? ' on' : ''}" data-act="char" data-id="${id}" aria-pressed="${ws.charId === id}">${charThumb(id, 60)}<span>${hx(CHARS[id].name)}</span></button>`).join('')}</div>
      <label class="q" for="cname">שם הדמות (תווית מתחת לאיור)</label><input id="cname" data-in="name" value="${hx(ws.name)}" maxlength="40">
      <h4>מקום</h4><div class="row">${PLACE_ORDER.map(k => chip(PLACES[k].name, 'place', { v: k }, ws.place === k)).join('')}</div>
      <h4>חפצים <span class="small">(אחד או שניים)</span></h4><div class="row">${PROP_ORDER.map(k => chip(PROP_NAMES[k], 'prop', { v: k }, ws.props.includes(k))).join('')}</div>
      <details class="private" open><summary>🔒 התכנון שלי — רק לכותב</summary>
      <p class="small">המחשבות האלה יעזרו לכם לתכנן. הן לא יופיעו לקורא לפני שינחש, ולא משנות את האיור.</p>`;
    if (!ws.adv) {
      o += `<p class="q">מה הדמות שלך מרגישה?</p><div class="row">${FEELINGS.map(e => chip(e, 'feel', { v: e }, p.feel.includes(e))).join('')}</div>
        <label class="small" for="feelOther">או במילים שלכם:</label><input id="feelOther" data-in="feelOther" value="${hx(p.feelOther)}" maxlength="200">
        <label class="q" for="pwant">מה היא רוצה להשיג או שיקרה?</label><input id="pwant" data-in="pwant" value="${hx(p.want)}" maxlength="300">
        <div class="row">${WANTS.map(x => chip(x, 'wantSug', { v: x }, p.want === x)).join('')}</div>`;
    } else {
      o += `<p class="q">שתי תחושות (בחרו צירוף או כתבו אחר):</p><div class="row">${COMBOS.map((c, j) => chip(c.a + ' + ' + c.b, 'combo', { j }, p.a === c.a && p.b === c.b)).join('')}</div>
        <div class="grid2"><div><label class="q" for="pa">תחושה 1</label><input id="pa" data-in="pa" value="${hx(p.a)}" maxlength="60"></div><div><label class="q" for="pb">תחושה 2</label><input id="pb" data-in="pb" value="${hx(p.b)}" maxlength="60"></div></div>
        <label class="q" for="advWant">ומה הדמות רוצה שיקרה ברגע הזה?</label><input id="advWant" data-in="advWant" value="${hx(p.advWant)}" maxlength="300">
        <p class="q">אתגר נוסף: רצון שמתנגש ברגש <span class="small">(לא חובה)</span></p><div class="row">${CONFLICTS.map(c => chip(c, 'conflict', { v: c }, p.conflict === c)).join('')}</div>
        <input aria-label="רצון שמתנגש ברגש — במילים שלכם" data-in="conflictTxt" value="${hx(p.conflict)}" maxlength="200">
        <label class="q" for="phid">רגש שהדמות מנסה להסתיר <span class="small">(לא חובה)</span></label><input id="phid" data-in="phid" value="${hx(p.hidden)}" maxlength="60">
        <p class="small">רגש הוא מה שהדמות מרגישה; רצון הוא מה שהיא מנסה להשיג. הם לא אותו דבר — ולפעמים הם מושכים לכיוונים שונים.</p>`;
    }
    o += `<label class="q" for="pwhy">מה גרם לזה? <span class="small">(לעצמכם, לא חובה)</span></label><textarea id="pwhy" data-in="pwhy" rows="2">${hx(p.why)}</textarea></details>
      <div class="mainact"><button class="btn primary big" data-act="step" data-s="1">לכתיבה</button></div>`;
    return o;
  },
  /* --- 2. כותבים --- */
  p1() {
    const ws = S.ws;
    return `<h3>2. כותבים רגש ורצון</h3><p class="lead2">${hx(WRITE_TASK)}</p>
      ${ws.adv ? `<p class="advtask">⚡ כתבו רגע אחד שבו אפשר למצוא רמז לכל תחושה וגם למה שהדמות מנסה להשיג. לפעמים הפנים, המעשים והמילים מגלים דברים שונים.</p>` : ''}
      <p class="starter">💭 ${hx(WRITE_STARTER)}</p>
      <label class="q" for="story">הסיפור שלי</label>
      <textarea id="story" class="story-input" data-in="text" rows="10">${hx(ws.text)}</textarea>
      <p class="small">האיור נשאר קבוע. הסיפור שלכם נותן לדמות מעשים, רגשות ורצונות. · <span id="scount">משפטים: ${sentenceCount(ws.text)} (המלצה: 3–5)</span></p>
      <p class="small">אפשר לכתוב גם על דמות אחרת שנכנסת לסיפור, גם אם היא לא מצוירת.</p>
      <details class="help"><summary>רוצים עזרה?</summary><ul>${WRITE_HELP.map(q => `<li>${hx(q)}</li>`).join('')}</ul></details>
      <details class="help"><summary>איך הופכים הסבר לרגע בסיפור?</summary><p><b>הסבר כללי:</b> ${hx(TELL_SHOW_EXAMPLE.tell)}</p><p><b>המחשה במילים:</b> ${hx(TELL_SHOW_EXAMPLE.show)}</p><p class="small">${hx(TELL_SHOW_EXAMPLE.why)}</p><p class="small">מה שונה בין הדוגמה לבין הסיפור שלכם?</p></details>
      ${ws.adv ? `<details class="help"><summary>דוגמאות לאתגר</summary>${EXAMPLES.map(e => `<p><b>${hx(e.label)}:</b> ${hx(e.text)}</p>`).join('')}<p class="small">${hx(EXAMPLES_NOTE)}</p></details>` : ''}
      <div class="mainact"><button class="btn primary big" data-act="toReflect">קוראים שוב ומגלים מה הראינו</button></div>`;
  },
  /* --- 3. בודקים את הרמזים --- */
  qs() { const ws = S.ws; return REFLECT_Q.filter(q => q.core || (ws.reflect.deep && !q.adv) || (q.adv && ws.adv)); },
  p2() {
    const ws = S.ws, R = ws.reflect, qs = this.qs(), qi = Math.min(R.qi, qs.length - 1), q = qs[qi], a = R.answers[q.id] || { quote: '', expl: '', notFound: false };
    const valid = R.marks.filter(m => ws.text.includes(m.text)), broken = R.marks.filter(m => !ws.text.includes(m.text));
    const quoteBad = a.quote.trim() && !ws.text.includes(a.quote.trim());
    return `<h3>3. בודקים איך הראינו רגש ורצון</h3>
      ${!ws.text.trim() ? '<p class="warnbox">עוד אין סיפור. חזרו לשלב 2 וכתבו אותו.</p>' : ''}
      <div class="story-view" id="storyView">${markedHTML(ws.text, valid)}</div>
      <details class="marker"><summary>סימון רמזים בסיפור</summary>
        <label class="small" for="storySrc">סמנו מילים בסיפור, ואז לחצו על סוג הרמז. אותו קטע יכול להיות גם רמז לרגש וגם לרצון.</label>
        <textarea id="storySrc" readonly rows="4">${hx(ws.text)}</textarea>
        <div class="row"><button class="btn small" data-act="mark" data-t="feel">רמז לרגש</button><button class="btn small" data-act="mark" data-t="want">רמז לרצון</button></div>
        ${R.marks.length ? `<ul class="marks">${R.marks.map((m, i) => `<li>${m.type === 'feel' ? 'רגש' : 'רצון'}: "${hx(m.text)}" ${ws.text.includes(m.text) ? '' : '<span class="warn">— הקטע כבר לא נמצא בסיפור. בדקו את הסימון.</span>'} <button class="btn tiny" data-act="unmark" data-i="${i}" aria-label="הסרת סימון ${i + 1}">✕</button></li>`).join('')}</ul>` : ''}
        ${broken.length ? '' : ''}
      </details>
      <div class="qcard">
        <p class="qnum">שאלה ${qi + 1} מתוך ${qs.length}</p>
        <p class="q">${hx(q.text)}</p>
        <label class="small" for="rq">מילים מהסיפור שלי (ציטוט):</label>
        <div class="quote-row"><input id="rq" data-in="rquote" data-q="${q.id}" value="${hx(a.quote)}" maxlength="600"><button class="btn small" data-act="pasteSel" data-q="${q.id}">הדבקת הקטע המסומן</button></div>
        <p class="warn" id="quoteWarn" ${quoteBad ? '' : 'hidden'}>הציטוט לא נמצא בסיפור כפי שהוא כתוב עכשיו. בדקו שהועתק בדיוק.</p>
        <label class="small" for="re">ההסבר שלי:</label><textarea id="re" data-in="rexpl" data-q="${q.id}" rows="3">${hx(a.expl)}</textarea>
        <label class="checkline"><input type="checkbox" data-in="rnot" data-q="${q.id}" ${a.notFound ? 'checked' : ''}> עוד לא מצאתי — אשפר בשכתוב</label>
        <div class="row"><button class="btn small" data-act="qnav" data-d="-1" ${qi === 0 ? 'disabled' : ''}>→ השאלה הקודמת</button><button class="btn small" data-act="qnav" data-d="1" ${qi === qs.length - 1 ? 'disabled' : ''}>השאלה הבאה ←</button>
        ${R.deep ? '' : `<button class="btn small" data-act="deep">שאלות העמקה</button>`}</div>
      </div>
      <p class="small">אין כאן ציון. המשחק לא מנתח את הסיפור — רק אתם מחליטים מה הראיתם. התשובות נשמרות בנפרד מהסיפור ולא יוצגו לחבר.</p>
      <div class="mainact"><button class="btn primary big" data-act="step" data-s="3">למשוב מחבר</button></div>`;
  },
  /* --- 4. מתייעצים עם חבר --- */
  p3() {
    const ws = S.ws, last = ws.feedback[ws.feedback.length - 1];
    let o = `<h3>4. מתייעצים עם חבר</h3><p class="lead2">הראו לחבר או לחברה את הסיפור. אל תגלו עדיין איזה רגש ורצון תכננתם. בקשו מהם לקרוא, לספר מה הבינו ולהציע שינוי אחד.</p>
      <div class="row"><button class="btn primary big" data-act="friendGo">תור החבר לקרוא</button><button class="btn" data-act="fbLater">אשמור את המשוב לפעם הבאה</button></div>
      ${ws.fbPending ? '<p class="pending">⏳ שלב המשוב ממתין — אפשר להמשיך ולחזור אליו בפעם הבאה.</p>' : ''}`;
    if (last) {
      o += `<div class="card fb"><h4>מה החבר${last.who ? ' (' + hx(last.who) + ')' : ''} הבין</h4>${this.fbRows(last)}</div>`;
      if (!last.revealed) o += `<button class="btn primary" data-act="fbReveal">עכשיו משתפים בכוונה</button>`;
      else {
        o += `<div class="compare"><div class="card"><h4>מה החבר הבין</h4>${this.fbRows(last, true)}</div><div class="card author"><h4>מה הכותב תכנן</h4>${planSummary(ws).map(([l, t]) => `<p><b>${hx(l)}:</b> ${hx(t || '—')}</p>`).join('')}</div></div>
          <p class="small">אם החבר הבין אחרת — זה לא אומר שהוא טעה. זה מידע על מה שהטקסט מראה.</p>
          <label class="q" for="fbWhy">מה בטקסט הוביל להבנה הזאת?</label><textarea id="fbWhy" data-in="fbWhy" rows="2">${hx(last.why)}</textarea>`;
      }
      if (ws.feedback.length > 1) o += `<details><summary>משובים קודמים (${ws.feedback.length - 1})</summary>${ws.feedback.slice(0, -1).map(f => `<div class="card fb">${this.fbRows(f)}</div>`).join('')}</details>`;
    }
    o += `<div class="mainact"><button class="btn primary big" data-act="step" data-s="4">לשכתוב</button></div>`;
    return o;
  },
  fbRows(f, short) { return FRIEND_FIELDS.filter(x => f[x.id]).map(x => `<p><span class="small">${hx(x.pre)}</span><br>${hx(f[x.id])}</p>`).join('') || '<p class="muted">אין תגובה כתובה.</p>'; },
  friendHTML() {
    const ws = S.ws, d = ws.friendDraft || {}, txt = ws.text;
    return `<section class="friend"><h2>תור החבר לקרוא</h2><p class="lead2">קראו את הסיפור. ספרו מה הבנתם — ואל תשאלו את הכותב מה התכוון.</p>
      <div class="friend-grid"><div><div class="illus-frame">${illusSVG(illusSel(ws), null, null, 'role="img" aria-label="איור הפתיחה"')}</div><div class="story-read">${hx(txt)}</div></div>
      <div class="panel"><label class="q" for="fwho">השם שלי <span class="small">(לא חובה)</span></label><input id="fwho" data-in="fd" data-k="who" value="${hx(d.who || '')}" maxlength="60">
        ${FRIEND_FIELDS.filter(x => !x.adv || ws.adv).map(x => `<label class="q" for="fd_${x.id}">${hx(x.pre)}</label><textarea id="fd_${x.id}" data-in="fd" data-k="${x.id}" rows="2">${hx(d[x.id] || '')}</textarea>`).join('')}
        <p class="small">אפשר גם לדבר בעל פה ולרשום כאן תקציר.</p>
        <div class="mainact"><button class="btn primary big" data-act="friendDone">סיימתי — שמירת התגובה</button><button class="btn" data-act="friendCancel">חזרה בלי לשמור</button></div></div></div></section>`;
  },
  /* --- 5. משכתבים ומציגים --- */
  p4() {
    const ws = S.ws, R = ws.reflect, lastRev = ws.revisions[ws.revisions.length - 1];
    const goals = REFLECT_Q.filter(q => R.answers[q.id] && R.answers[q.id].notFound);
    const answered = REFLECT_Q.filter(q => R.answers[q.id] && (R.answers[q.id].quote || R.answers[q.id].expl));
    const base = lastRev ? lastRev.text : ws.draft1 ? ws.draft1.text : '';
    let o = `<h3>5. משכתבים ומציגים</h3>
      <div class="grid2"><div class="card"><h4>הטיוטה הראשונה</h4><div class="story-read small-read">${ws.draft1 ? hx(ws.draft1.text) : '<span class="muted">הטיוטה הראשונה נשמרת כשעוברים לשלב 3.</span>'}</div></div>
      <div class="card"><h4>מה גיליתי ומה אמרו לי</h4>
        ${answered.length ? `<ul class="small">${answered.map(q => `<li>${hx(q.text.split('?')[0])}?: ${R.answers[q.id].quote ? '"' + hx(R.answers[q.id].quote) + '" ' : ''}${hx(R.answers[q.id].expl)}</li>`).join('')}</ul>` : '<p class="small muted">עוד אין תשובות התבוננות.</p>'}
        ${goals.length ? `<p class="small"><b>יעדים לשיפור:</b> ${goals.map(q => hx(q.text.split('?')[0]) + '?').join(' · ')}</p>` : ''}
        ${ws.feedback.length ? ws.feedback.map(f => `<div class="fb small">${this.fbRows(f)}</div>`).join('') : `<p class="small muted">${ws.fbPending ? 'המשוב מחבר ממתין.' : 'עוד אין משוב מחבר.'}</p>`}</div></div>
      <p class="q">איזה פרט אחד תשנו כדי שהקורא יבין טוב יותר מה הדמות מרגישה או רוצה?</p>
      <p class="small">אפשר להוסיף פעולה, להחליף ביטוי כללי בפרט, לדייק פועל, לשנות דיאלוג או לסדר מחדש. אין חובה לשנות את הרגש שבחרתם.</p>
      <label class="q" for="story2">הסיפור — עותק לעריכה</label><textarea id="story2" class="story-input" data-in="text" rows="9">${hx(ws.text)}</textarea>
      <div class="change-row"><label for="chWhat">שיניתי</label><input id="chWhat" data-in="chWhat" value="${hx(ws.change.what)}" maxlength="400"><label for="chWhy">כדי שהקורא יוכל להבין</label><input id="chWhy" data-in="chWhy" value="${hx(ws.change.why)}" maxlength="400"></div>
      ${ws.feedback.length || goals.length ? `<p class="small">התגובה שאליה השינוי מתייחס:</p><div class="row">${ws.feedback.map((f, i) => chip('משוב ' + (i + 1) + (f.who ? ' — ' + f.who : ''), 'chRef', { v: f.id }, ws.change.ref === f.id)).join('')}${chip('ההתבוננות שלי', 'chRef', { v: 'self' }, ws.change.ref === 'self')}</div>` : ''}
      <div class="row"><button class="btn primary" data-act="saveRev">שמירת הגרסה אחרי השיפור</button></div>`;
    if (lastRev && base !== undefined) {
      const df = wordDiff(ws.draft1 ? ws.draft1.text : '', lastRev.text);
      o += `<h4>לפני השיפור ואחרי השיפור</h4><div class="grid2 diff"><div class="card"><h4>לפני (הטיוטה הראשונה)</h4><div class="story-read small-read">${df.a}</div></div><div class="card"><h4>אחרי (שיפור ${ws.revisions.length})</h4><div class="story-read small-read">${df.b}</div></div></div>
        <p class="small"><span class="legend-del">קו חוצה = נמחק</span> · <span class="legend-ins">קו תחתון = נוסף</span></p>
        ${lastRev.what || lastRev.why ? `<p>שיניתי <b>${hx(lastRev.what || '___')}</b> כדי שהקורא יוכל להבין <b>${hx(lastRev.why || '___')}</b>.</p>` : ''}
        <label class="q" for="reread">החבר קורא שוב: מה ברור לך יותר עכשיו?</label><textarea id="reread" data-in="reread" rows="2">${hx(lastRev.reread)}</textarea>`;
    }
    o += `<h4>איזו גרסה להציג ולהוריד?</h4><div class="row">${versionList(ws).map(v => chip(v.label, 'choose', { v: v.id }, ws.chosen === v.id)).join('')}</div>
      <div class="mainact"><button class="btn primary big" data-act="toPresent">הציגו לכיתה</button><button class="btn big" data-act="toProduct">להורדת הסיפור</button></div>`;
    return o;
  },
  inputs: {
    name(el) { S.ws.name = el.value; save(); const n = $('#illusName'); if (n) n.textContent = el.value; },
    feelOther(el) { S.ws.plan.feelOther = el.value; save(); },
    pwant(el) { S.ws.plan.want = el.value; save(); $$('[data-act="wantSug"]').forEach(b => { const on = b.dataset.v === el.value; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); },
    pa(el) { S.ws.plan.a = el.value; save(); }, pb(el) { S.ws.plan.b = el.value; save(); },
    advWant(el) { S.ws.plan.advWant = el.value; save(); }, conflictTxt(el) { S.ws.plan.conflict = el.value; save(); }, phid(el) { S.ws.plan.hidden = el.value; save(); },
    pwhy(el) { S.ws.plan.why = el.value; save(); },
    text(el) { S.ws.text = el.value; save(); const c = $('#scount'); if (c) c.textContent = `משפטים: ${sentenceCount(el.value)} (המלצה: 3–5)`; },
    rquote(el) { this.ans(el.dataset.q).quote = el.value; S.ws.reflect.versionText = S.ws.text; save(); const w = $('#quoteWarn'); if (w) w.hidden = !(el.value.trim() && !S.ws.text.includes(el.value.trim())); },
    rexpl(el) { this.ans(el.dataset.q).expl = el.value; S.ws.reflect.versionText = S.ws.text; save(); },
    rnot(el) { this.ans(el.dataset.q).notFound = el.checked; save(); },
    fd(el) { S.ws.friendDraft[el.dataset.k] = el.value; save(); },
    fbWhy(el) { const f = S.ws.feedback[S.ws.feedback.length - 1]; if (f) { f.why = el.value; save(); } },
    chWhat(el) { S.ws.change.what = el.value; save(); }, chWhy(el) { S.ws.change.why = el.value; save(); },
    reread(el) { const r = S.ws.revisions[S.ws.revisions.length - 1]; if (r) { r.reread = el.value; save(); } }
  },
  ans(id) { const A = S.ws.reflect.answers; if (!A[id]) A[id] = { quote: '', expl: '', notFound: false }; return A[id]; },
  ensureDraft1() { const ws = S.ws; if (!ws.draft1 && ws.text.trim()) { ws.draft1 = { text: ws.text, at: nowISO() }; save(); announce('הטיוטה הראשונה נשמרה.'); } },
  acts: {
    step(el) { const s = +el.dataset.s; if (s >= 2) this.ensureDraft1(); S.ws.step = s; save(); go('create'); },
    toReflect() { if (!S.ws.text.trim()) { announce('כתבו קודם את הסיפור.'); $('#story').focus(); return; } this.ensureDraft1(); S.ws.step = 2; S.ws.reflect.versionText = S.ws.text; save(); go('create'); },
    adv() { S.ws.adv = !S.ws.adv; save(); go('create'); },
    char(el) { const ws = S.ws, old = CHARS[ws.charId].name; ws.charId = el.dataset.id; if (!ws.name || ws.name === old) ws.name = CHARS[ws.charId].name; save(); this.refreshIllus(); this.renderPanel(); $('#illusName').textContent = ws.name; },
    place(el) { S.ws.place = el.dataset.v; save(); this.refreshIllus(); this.renderPanel(); },
    prop(el) { const a = S.ws.props, v = el.dataset.v, i = a.indexOf(v); if (i >= 0) { if (a.length === 1) { announce('צריך לפחות חפץ אחד.'); return; } a.splice(i, 1); } else { if (a.length >= 2) a.shift(); a.push(v); } save(); this.refreshIllus(); this.renderPanel(); },
    feel(el) { const a = S.ws.plan.feel, v = el.dataset.v, i = a.indexOf(v); if (i >= 0) a.splice(i, 1); else if (a.length < 6) a.push(v); save(); el.classList.toggle('on', i < 0); el.setAttribute('aria-pressed', i < 0); },
    wantSug(el) { S.ws.plan.want = el.dataset.v; save(); this.renderPanel(); },
    combo(el) { const c = COMBOS[+el.dataset.j]; S.ws.plan.a = c.a; S.ws.plan.b = c.b; save(); this.renderPanel(); },
    conflict(el) { S.ws.plan.conflict = S.ws.plan.conflict === el.dataset.v ? '' : el.dataset.v; save(); this.renderPanel(); },
    mark(el) {
      const ta = $('#storySrc'); const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
      if (!sel.trim()) { announce('סמנו קודם מילים בסיפור.'); ta.focus(); return; }
      S.ws.reflect.marks.push({ type: el.dataset.t, text: sel }); S.ws.reflect.versionText = S.ws.text; save(); this.renderPanel(); announce(el.dataset.t === 'feel' ? 'סומן רמז לרגש.' : 'סומן רמז לרצון.');
    },
    unmark(el) { S.ws.reflect.marks.splice(+el.dataset.i, 1); save(); this.renderPanel(); },
    pasteSel(el) { const ta = $('#storySrc'); const sel = ta ? ta.value.slice(ta.selectionStart, ta.selectionEnd) : ''; if (!sel.trim()) { announce('פתחו "סימון רמזים בסיפור" וסמנו קודם מילים.'); const d = $('details.marker'); if (d) d.open = true; return; } this.ans(el.dataset.q).quote = sel; save(); this.renderPanel(); },
    qnav(el) { const n = this.qs().length; S.ws.reflect.qi = Math.max(0, Math.min(n - 1, Math.min(S.ws.reflect.qi, n - 1) + +el.dataset.d)); save(); this.renderPanel(); const q = $('#rq'); if (q) q.focus(); },
    deep() { S.ws.reflect.deep = true; S.ws.reflect.qi = 3; save(); this.renderPanel(); },
    friendGo() { if (!S.ws.text.trim()) { announce('עוד אין סיפור לקרוא.'); return; } this.ensureDraft1(); S.ws.friendMode = true; S.ws.friendDraft = S.ws.friendDraft || {}; go('create'); },
    friendCancel() { S.ws.friendMode = false; go('create'); },
    friendDone() {
      const d = S.ws.friendDraft || {};
      if (!['feel', 'want', 'detail', 'wish', 'two'].some(k => (d[k] || '').trim())) { announce('כתבו לפחות תגובה אחת לפני השמירה.'); return; }
      S.ws.feedback.push({ id: uid(), who: d.who || '', feel: d.feel || '', want: d.want || '', detail: d.detail || '', wish: d.wish || '', two: d.two || '', revealed: false, why: '', versionText: S.ws.text, at: nowISO() });
      S.ws.friendDraft = {}; S.ws.friendMode = false; S.ws.fbPending = false; save(); go('create'); announce('תגובת החבר נשמרה.');
    },
    fbLater() { S.ws.fbPending = true; save(); this.renderPanel(); announce('שלב המשוב סומן כממתין.'); },
    fbReveal() { const f = S.ws.feedback[S.ws.feedback.length - 1]; if (f) { f.revealed = true; save(); this.renderPanel(); } },
    chRef(el) { S.ws.change.ref = S.ws.change.ref === el.dataset.v ? '' : el.dataset.v; save(); this.renderPanel(); },
    saveRev() {
      const ws = S.ws, prev = ws.revisions.length ? ws.revisions[ws.revisions.length - 1].text : ws.draft1 ? ws.draft1.text : null;
      if (!ws.draft1) this.ensureDraft1();
      if (prev !== null && prev === ws.text) { announce('הטקסט עוד לא השתנה מהגרסה הקודמת.'); return; }
      ws.revisions.push({ text: ws.text, at: nowISO(), what: ws.change.what, why: ws.change.why, ref: ws.change.ref, reread: '' });
      ws.change = { what: '', why: '', ref: '' }; ws.chosen = 'current'; save(); this.renderPanel(); announce('הגרסה אחרי השיפור נשמרה. הטיוטה הראשונה לא נמחקה.');
    },
    choose(el) { S.ws.chosen = el.dataset.v; save(); this.renderPanel(); },
    toPresent() { go('present'); }, toProduct() { go('product'); }
  }
};

/* ======================= מציגים (מצב כיתה) ======================= */
SCREENS.present = {
  revealed: false,
  html() {
    const ws = S.ws, P = S.present, v = chosenVersion(ws), title = S.product.title.trim() || 'הסיפור שלי';
    this.revealed = false;
    return `<section class="present">
      <div class="present-head"><h2>${hx(title)}</h2>
      <div class="row"><button class="btn small" data-act="toggleIllus" aria-pressed="${!P.showIllus}">${P.showIllus ? 'הסתרת האיור' : 'הצגת האיור'}</button><button class="btn small" data-act="fs">מסך מלא</button><button class="btn small" data-act="back">חזרה לסדנה</button></div></div>
      <div class="present-body${P.showIllus ? '' : ' noillus'}"><div class="illus-frame" id="pIllus" ${P.showIllus ? '' : 'hidden'}>${illusSVG(illusSel(ws), null, null, 'role="img" aria-label="איור הפתיחה"')}</div>
      <div class="story-read big-read">${v.text.trim() ? hx(v.text) : '<span class="muted">עוד אין סיפור.</span>'}</div></div>
      <p class="reader-task">מה הדמות מרגישה? מה היא רוצה? מצאו בסיפור פרט שתומך בכל תשובה.</p>
      <div class="present-cols">
        <div class="card"><h3>פרשנויות מהכיתה</h3><p class="small">אפשר לנחש בעל פה, או לרשום כאן עד שלוש פרשנויות קצרות.</p>
          <ol id="guesses">${P.guesses.map((g, i) => `<li>${g.feel ? `<b>מרגישה:</b> ${hx(g.feel)} ` : ''}${g.want ? `<b>רוצה:</b> ${hx(g.want)} ` : ''}${g.detail ? `— ${hx(g.detail)}` : ''} <button class="btn tiny" data-act="rmGuess" data-i="${i}" aria-label="מחיקת פרשנות ${i + 1}">✕</button></li>`).join('')}</ol>
          ${P.guesses.length < 3 ? `<label class="q" for="gfeel">מה הדמות מרגישה?</label><input id="gfeel" maxlength="300"><label class="q" for="gwant">מה היא רוצה?</label><input id="gwant" maxlength="300"><label class="q" for="gdet">על איזה פרט הסתמכתם?</label><input id="gdet" maxlength="300"><button class="btn" data-act="addGuess">הוספה</button>` : '<p class="small">נרשמו שלוש פרשנויות.</p>'}
        </div>
        <div class="card" id="revealBox"><h3>הכוונה של הכותב</h3><p class="small">מוסתרת עד שתלחצו.</p><button class="btn primary big" data-act="reveal">חשיפת כוונת הכותב</button></div>
      </div></section>`;
  },
  unmount() { this.revealed = false; if (document.fullscreenElement) document.exitFullscreen().catch(() => { }); },
  rerender() { const keep = this.revealed ? $('#revealBox').innerHTML : null, y = window.scrollY; $('#app').innerHTML = this.html(); if (keep) { this.revealed = true; $('#revealBox').innerHTML = keep; } window.scrollTo(0, y); },
  acts: {
    toggleIllus(el) { S.present.showIllus = !S.present.showIllus; save(); $('#pIllus').hidden = !S.present.showIllus; $('.present-body').classList.toggle('noillus', !S.present.showIllus); el.textContent = S.present.showIllus ? 'הסתרת האיור' : 'הצגת האיור'; el.setAttribute('aria-pressed', !S.present.showIllus); },
    fs() { const el = $('.present'); if (document.fullscreenElement) document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen().catch(() => { }); },
    back() { go('create'); },
    addGuess() { const f = $('#gfeel').value.trim(), w = $('#gwant').value.trim(), d = $('#gdet').value.trim(); if (!f && !w) { $('#gfeel').focus(); return; } if (S.present.guesses.length >= 3) return; S.present.guesses.push({ feel: f, want: w, detail: d }); save(); this.rerender(); const n = $('#gfeel'); if (n) n.focus(); },
    rmGuess(el) { S.present.guesses.splice(+el.dataset.i, 1); save(); this.rerender(); },
    reveal() {
      this.revealed = true;
      $('#revealBox').innerHTML = `<h3>הכוונה של הכותב</h3>${planSummary(S.ws).map(([l, t]) => `<p><b>${hx(l)}:</b> <span class="reveal-feel">${hx(t || '—')}</span></p>`).join('')}
        <p class="big-note">זו הכוונה של הכותב. אפשר להציע קריאה אחרת ולהסביר אותה.</p>
        <div class="row"><button class="btn" data-act="back">חזרה לסדנה לשכתוב</button></div>`;
    }
  }
};

/* ======================= התוצר שלי ======================= */
SCREENS.product = {
  html() {
    const P = S.product, ws = S.ws, v = chosenVersion(ws);
    return `<section class="product"><h2>התוצר שלי</h2>
      <div class="grid2">
        <div class="card">
          <h3>איזו גרסה תרד?</h3><div class="row">${versionList(ws).map(x => chip(x.label, 'choose', { v: x.id }, ws.chosen === x.id)).join('')}</div>
          <p class="chosen-label">הגרסה שתרד: <b>${hx(v.label)}</b></p>
          <div class="story-read small-read">${v.text.trim() ? hx(v.text) : '<span class="muted">הגרסה הזאת ריקה.</span>'}</div>
          <label class="q" for="ptitle">כותרת לסיפור <span class="small">(ניטרלית — שלא תגלה מה הדמות מרגישה או רוצה)</span></label><input id="ptitle" data-in="title" value="${hx(P.title)}" maxlength="120" placeholder="הסיפור שלי">
          <label class="q" for="pauthor">כינוי כותב <span class="small">(לא חובה)</span></label><input id="pauthor" data-in="author" value="${hx(P.author)}" maxlength="60">
        </div>
        <div class="card"><h3>האיור</h3><div class="illus-frame">${illusSVG(illusSel(ws), null, null, 'role="img" aria-label="איור הפתיחה"')}</div>
          <label class="checkline"><input type="checkbox" data-in="noImage" ${P.noImage ? 'checked' : ''}> להוריד בלי איור (טקסט בלבד)</label></div>
      </div>
      <div class="card download">
        <button class="btn primary big" data-act="docClass">⬇ הורדת הסיפור לכיתה — Word</button>
        <p>הקובץ יכלול את הסיפור ואת האיור שבחרתם. הכיתה תגלה את הרגש והרצון מתוך הכתיבה.</p>
        <p class="small">בקובץ לכיתה אין את התכנון שלכם, את תשובות ההתבוננות, את הסימונים או את משוב החבר.</p>
        <button class="btn" data-act="docWriter">⬇ עותק לכותב ולמורה</button>
        <p class="small">העותק לכותב כולל עמוד נוסף עם הרגש והרצון שתכננתם, תשובות ההתבוננות, משוב החבר וההשוואה בין הגרסאות. לא לחלק לכיתה.</p>
      </div>
      <div class="card"><h3>שמירה והעברה למחשב אחר</h3>
        <p class="small">${storageOK ? 'העבודה נשמרת אוטומטית בדפדפן הזה, במחשב הזה.' : 'הדפדפן הזה לא שומר אוטומטית — הורידו גיבוי.'} כדי להמשיך במחשב אחר: הורידו קובץ פרויקט, ופתחו אותו שם בכפתור "טעינת קובץ פרויקט".</p>
        <div class="row"><button class="btn" data-act="backup">⬇ הורדת קובץ פרויקט (גיבוי)</button><label class="btn filebtn">⬆ טעינת קובץ פרויקט<input type="file" id="loadFile" accept=".json,application/json" data-in="loadFile"></label></div>
        <p class="small">קובץ הפרויקט מיועד לכותב: יש בו גם את התכנון הפרטי. לכיתה — רק קובץ הוורד.</p>
        <p id="loadMsg" class="small" role="status"></p>
      </div></section>`;
  },
  inputs: {
    title(el) { S.product.title = el.value; save(); },
    author(el) { S.product.author = el.value; save(); },
    noImage(el) { S.product.noImage = el.checked; save(); },
    loadFile(el) { const f = el.files && el.files[0]; if (f) loadProjectFile(f); el.value = ''; }
  },
  acts: {
    choose(el) { S.ws.chosen = el.dataset.v; save(); go('product'); },
    docClass() { makeDoc('class'); }, docWriter() { makeDoc('writer'); },
    backup() { exportProject(); }
  }
};
async function makeDoc(kind) {
  try {
    const ws = S.ws, P = S.product, v = chosenVersion(ws), imgs = [];
    if (!P.noImage) imgs.push(await svgToPngBytes(illusSVG(illusSel(ws), W, H), 2));
    const model = { title: P.title.trim() || 'הסיפור שלי', author: P.author.trim(), paragraphs: [v.text.trim()], images: imgs, readerSpace: true, readerQuestions: READER_Q, writerPage: null };
    if (kind === 'writer') {
      const R = ws.reflect, rows = planSummary(ws);
      rows.push(['הגרסה שבקובץ', v.label]);
      REFLECT_Q.forEach(q => { const a = R.answers[q.id]; if (a && (a.quote || a.expl || a.notFound)) rows.push(['התבוננות: ' + q.text, (a.quote ? 'ציטוט: "' + a.quote + '"\n' : '') + (a.expl || '') + (a.notFound ? '\n(עוד לא מצאתי — יעד לשכתוב)' : '')]); });
      if (R.marks.length) rows.push(['רמזים שסימנתי', R.marks.map(m => (m.type === 'feel' ? 'רגש: ' : 'רצון: ') + '"' + m.text + '"').join('\n')]);
      ws.feedback.forEach((f, i) => rows.push(['משוב חבר ' + (i + 1) + (f.who ? ' (' + f.who + ')' : ''), FRIEND_FIELDS.filter(x => f[x.id]).map(x => x.pre + '\n' + f[x.id]).join('\n') + (f.why ? '\nמה בטקסט הוביל להבנה: ' + f.why : '')]));
      if (ws.fbPending) rows.push(['משוב חבר', 'ממתין']);
      if (ws.draft1) rows.push(['הטיוטה הראשונה', ws.draft1.text]);
      ws.revisions.forEach((r, i) => rows.push(['אחרי שיפור ' + (i + 1), r.text + (r.what || r.why ? '\nשיניתי ' + (r.what || '___') + ' כדי שהקורא יוכל להבין ' + (r.why || '___') + '.' : '') + (r.reread ? '\nהחבר קרא שוב: ' + r.reread : '')]));
      if (S.present.guesses.length) rows.push(['פרשנויות שנאספו בכיתה', S.present.guesses.map((g, i) => `${i + 1}. ${g.feel}${g.want ? ' / ' + g.want : ''}${g.detail ? ' — ' + g.detail : ''}`).join('\n')]);
      model.writerPage = { rows };
    }
    downloadBlob(buildDocx(model), kind === 'writer' ? 'הסיפור_שלי_עותק_לכותב.docx' : 'הסיפור_שלי_לכיתה.docx');
    announce(kind === 'writer' ? 'העותק לכותב ולמורה ירד.' : 'קובץ הוורד לכיתה ירד.');
  } catch (e) { announce('לא הצלחנו ליצור את הקובץ. נסו שוב, או הורידו בלי איור.'); console.error(e); }
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
    ns.settings = S.settings; S = ns; S.screen = 'product'; delete S._migrated;
    saveNow(); go('product'); msg('הפרויקט נטען: הסיפור, האיור והתהליך שוחזרו.');
  };
  fr.onerror = () => msg('לא הצלחנו לקרוא את הקובץ. הטיוטה לא השתנתה.');
  fr.readAsText(file);
}

/* ---------------- אתחול ---------------- */
function init() {
  S = loadState();
  if (!storageOK) showStorageBanner();
  Sound.muted = S.settings.muted; Engine.stepMode = S.settings.steps;
  if (S._migrated) {
    saveNow();
    const n = document.createElement('p'); n.className = 'migrated'; n.setAttribute('role', 'status');
    n.innerHTML = 'עדכנו את המשחק לגרסה חדשה: הסדנה עובדת עכשיו עם איור קבוע וכתיבה. הסיפור שכתבתם נשמר, והנתונים הישנים נשמרו כגיבוי. <button class="btn tiny" type="button">הבנתי</button>';
    n.querySelector('button').onclick = () => n.remove();
    $('#app').before(n);
  }
  document.addEventListener('click', async e => {
    const nav = e.target.closest('[data-go]'); if (nav) { go(nav.dataset.go); return; }
    const ga = e.target.closest('[data-gact]'); if (ga) { if (ga.dataset.gact === 'backup') exportProject(); return; }
    const el = e.target.closest('[data-act]'); if (!el || !current || !current.acts || el.disabled) return;
    const f = current.acts[el.dataset.act]; if (f) { e.preventDefault(); await f.call(current, el, e); }
  });
  const onIn = e => { const el = e.target.closest('[data-in]'); if (!el || !current || !current.inputs) return; const f = current.inputs[el.dataset.in]; if (f) f.call(current, el, e); };
  document.addEventListener('input', e => { const t = e.target; if (t && (t.type === 'checkbox' || t.type === 'file')) return; onIn(e); });
  document.addEventListener('change', e => { const t = e.target; if (t && (t.type === 'checkbox' || t.type === 'file')) onIn(e); });
  window.addEventListener('pagehide', saveNow);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { saveNow(); Engine.stopAll(); } });
  go(S.screen || 'home');
}
document.addEventListener('DOMContentLoaded', init);
