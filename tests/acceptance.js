/* בדיקות קבלה — גרסה 2 (רגש ורצון, איור סטטי בסדנה).
   הרצה: node tests/acceptance.js <תיקיית פלט>   (puppeteer-core דרך NODE_PATH, ו-Chrome מותקן) */
const puppeteer = require('puppeteer-core');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || 'test-out'), DL = path.join(OUT, 'downloads');
fs.mkdirSync(DL, { recursive: true }); for (const f of fs.readdirSync(DL)) fs.unlinkSync(path.join(DL, f));
const URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OLD_BACKUP = path.join(ROOT, 'backup', 'v1-animated-workshop', 'samples', 'הסיפור_שלי_גיבוי.json');
const results = []; let failed = 0;
const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info: info || '' }); if (!cond) failed++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (info ? ' — ' + info : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const FORBID_WS = ['מהמשפט לבמה', 'איך נראה את זה', 'עוד לא בחרת המחשה', 'תמונות לפי צעדים', 'הפעלה', 'רגע הבא', 'צליל'];

async function newPage(browser, errors, remote) {
  const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 950 });
  page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.setRequestInterception(true);
  page.on('request', r => { const u = r.url(); if (/^(file|data|blob):/.test(u)) r.continue(); else { remote.push(u); r.abort(); } });
  return page;
}
(async () => {
  const errors = [], remote = [];
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const page = await newPage(browser, errors, remote);
  const cdp = await page.createCDPSession(); await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL });
  const click = async sel => { await page.waitForSelector(sel, { visible: true, timeout: 5000 }); await page.click(sel); await sleep(120); };
  const text = () => page.evaluate(() => document.body.innerText);
  const shot = n => page.screenshot({ path: path.join(OUT, n + '.png') });
  const waitFile = async name => { const p = path.join(DL, name); for (let i = 0; i < 80; i++) { if (fs.existsSync(p) && fs.statSync(p).size > 0) { await sleep(200); return p; } await sleep(100); } return null; };
  const noPlayback = async () => page.evaluate(F => ({ ctrl: document.querySelectorAll('.controls,.pp,.scrub,#muteBtn,#stepsBtn,[data-act="playOne"],[data-act="preview"],[data-act="edit"]').length, players: Players.size, anim: document.getAnimations().length, animate: document.querySelectorAll('animate,animateTransform,animateMotion').length, words: F.filter(w => document.body.innerText.includes(w)) }), FORBID_WS);
  const illus = () => page.$eval('#illus', e => e.innerHTML);

  await page.goto(URL, { waitUntil: 'load' });
  /* 1 */
  const h = await page.evaluate(() => ({ title: document.title, h1: document.querySelector('h1').innerText, body: document.body.innerText }));
  ok('1a. רגש ורצון בכותרת הדפדפן ובכותרת הראשית', h.title.includes('רגש ורצון') && h.h1.includes('רגש ורצון'), h.title);
  ok('1b. בפתיחה: הסבר והבחנה בין רגש לרצון', h.body.includes('רגש — מה שהדמות מרגישה עכשיו') && h.body.includes('רצון — מה שהדמות מבקשת להשיג') && h.body.includes('אפשר להרגיש דבר אחד ולרצות דבר אחר') && h.body.includes('גם להגיד מה הדמות מרגישה או רוצה'));
  await shot('01-home');

  /* 2: חמש הסצנות */
  const scenes = await page.evaluate(() => SCENES.map(s => ({ id: s.id, sec: s.secret })));
  await click('[data-act="start"]');
  ok('2a. כפתורי צליל ו"תמונות לפי צעדים" נמצאים במגלים', !!(await page.$('#muteBtn')) && !!(await page.$('#stepsBtn')));
  for (let i = 0; i < 5; i++) {
    const sc = scenes[i], sec = sc.sec;
    const before = await text();
    ok(`2.${i + 1}a סצנה ${i + 1}: לפני חשיפה אין רגש, רצון או פסקה`, ![sec.intent, sec.want, sec.paragraph, sec.wantLink].some(w => before.includes(w)) && before.includes(`סצנה ${i + 1} מתוך 5`));
    await click('[data-act="watch"]'); await sleep(600);
    if (i === 0) {
      await click('.controls .pp'); const a = await page.evaluate(() => [...Players][0].t); await sleep(500); const b = await page.evaluate(() => [...Players][0].t);
      ok('2b. עצירה מקפיאה את הסרט', a === b && a > 0);
    }
    const q2h = await page.$eval('#q2', e => e.hidden);
    await page.type('#ans', 'סקרנות'); const q2v = await page.$eval('#q2', e => e.hidden);
    await page.type('#want', 'שמשהו יקרה'); await page.type('#clue', 'מה שאמר "בדיוק"');
    ok(`2.${i + 1}b שלוש שאלות, אחת אחרי השנייה; החשיפה פתוחה רק אחרי שלוש תשובות`, q2h && !q2v && !(await page.$eval('#revealBtn', b => b.disabled)));
    await click('#revealBtn');
    const r0 = await text();
    ok(`2.${i + 1}c אחרי החשיפה: רגש ורצון בנפרד, ותשובת התלמיד נשמרת`, r0.includes('הרגש שאליו התכוון המחבר') && r0.includes('הרצון של הדמות') && r0.includes(sec.intent) && r0.includes(sec.want) && r0.includes('סקרנות') && !/טעות|שגוי/.test(r0));
    await click('[data-act="rtab"][data-r="1"]');
    const tags = await page.$$eval('.clue .ctag', t => t.map(x => x.innerText));
    let cluesOK = tags.length === sec.clues.length;
    for (let j = 0; j < sec.clues.length; j++) { const c = sec.clues[j]; await page.click(`.clue[data-j="${j}"]`); await sleep((c.t - c.from) * 1000 + 500); const t = await page.evaluate(() => [...Players][0].t); const ex = await page.$eval('#explain', e => e.innerText); if (Math.abs(t - c.t) > .05 || !ex.includes(c.expl)) cluesOK = false; }
    ok(`2.${i + 1}d רמזים מסומנים כרגש/רצון, ולחיצה מציגה את הרגע וההסבר`, cluesOK, tags.join(','));
    await click('[data-act="rtab"][data-r="2"]'); await page.type('#actAns', 'הפעולה שלו'); await click('[data-act="showAct"]');
    ok(`2.${i + 1}e "איזו פעולה מראה מה היא מנסה להשיג?" עם הסבר`, (await text()).includes(sec.wantAction));
    await click('[data-act="rtab"][data-r="4"]');
    const vers = await page.$$eval('[data-act="ver"]', b => b.map(x => x.dataset.v)); const vs = [];
    for (const v of vers) { await page.click(`[data-act="ver"][data-v="${v}"]`); await sleep(250); vs.push(await page.evaluate(() => JSON.stringify(computeState([...Players][0].tl, 99)) + document.querySelector('#verPara').innerText)); }
    ok(`2.${i + 1}f שתי חלופות שונות`, vs.length === 2 && vs[0] !== vs[1]);
    if (i === 0) await shot('02-learn-variation');
    if (i < 4) await click('[data-act="nextScene"]');
  }
  // 15c: יציאה מסרט לסדנה בזמן ניגון
  await click('[data-act="ver"]'); await sleep(300);
  await click('[data-go="create"]'); await sleep(300);
  const leave = await page.evaluate(() => ({ players: Players.size, live: Sound.live.size }));
  ok('15c. יציאה ממגלים בזמן ניגון לא משאירה נגן, צליל או בקרות', leave.players === 0 && leave.live === 0 && (await noPlayback()).ctrl === 0);

  /* 3–6: סדנה */
  const st = await page.evaluate(() => [...document.querySelectorAll('.stepb')].map(b => b.innerText));
  const h2 = await page.$eval('.create-head h2', e => e.innerText);
  ok('1c. כותרת הסדנה "כותבים ומראים רגש ורצון"', h2 === 'כותבים ומראים רגש ורצון');
  ok('3. חמשת שלבי הסדנה', JSON.stringify(st) === JSON.stringify(['1. בוחרים איור', '2. כותבים רגש ורצון', '3. בודקים את הרמזים', '4. מתייעצים עם חבר', '5. משכתבים ומציגים']), st.join(' | '));
  ok('2c. המסר על האיור מוצג ליד האיור', (await page.$eval('.illus-note', e => e.innerText)).startsWith('האיור הוא נקודת התחלה לסיפור'));
  // 4: איור משתנה מיד
  let ill = await illus(), changes = 0, charsOK = true;
  for (const id of ['uri', 'maya', 'eitan', 'lia', 'noam', 'noa']) { await page.click(`[data-act="char"][data-id="${id}"]`); await sleep(80); const n = await illus(); if (n !== ill) changes++; ill = n; if (!n.includes(`data-char="${id}"`)) charsOK = false; }
  const propChecks = [];
  for (const place of ['room', 'corridor', 'classroom', 'garden']) {
    await page.click(`[data-act="place"][data-v="${place}"]`); await sleep(80);
    for (const pair of [['envelope', 'tower'], ['ball', 'box'], ['ticket', 'book']]) {
      await page.evaluate(p => { S.ws.props = []; }, pair); // מאפס דרך הממשק:
      for (const pr of pair) await page.click(`[data-act="prop"][data-v="${pr}"]`);
      await sleep(60);
      const r = await page.evaluate(() => { const svg = document.querySelector('#illus svg'), sc = svg.getBoundingClientRect().width / 800; return [...svg.querySelectorAll('[data-prop]')].map(g => { const b = g.getBBox(); return { k: g.dataset.prop, in: b.x >= 0 && b.y >= 0 && b.x + b.width <= 800 && b.y + b.height <= 450 && b.width > 5 }; }); });
      const want = await page.evaluate(() => S.ws.props.slice().sort().join());
      propChecks.push(r.length === 2 && r.every(x => x.in) && r.map(x => x.k).sort().join() === want);
    }
  }
  ok('4a. כל אחת משש הדמויות משנה את האיור מיד', changes >= 5 && charsOK);
  ok('4b. בכל ארבעת המקומות: שני החפצים שנבחרו מצוירים ובתוך התמונה', propChecks.every(Boolean), propChecks.filter(x => !x).length + ' כשלונות מתוך ' + propChecks.length);
  await page.click('[data-act="char"][data-id="maya"]'); await page.click('[data-act="place"][data-v="corridor"]');
  await page.evaluate(() => { S.ws.props = ['ball']; }); await page.click('[data-act="prop"][data-v="envelope"]'); await sleep(100);
  await page.click('[data-act="feel"][data-v="חשש"]'); await page.type('#pwant', 'להיכנס ולקחת את הכדור');
  await page.type('#pwhy', 'סוד־תכנון: נשמע רעש מהמחסן');
  await shot('03-ws-step1');
  const illBefore = await illus();
  await click('[data-act="step"][data-s="1"]');
  const STORY = "מאיה עמדה מול הדלת והחזיקה את המעטפה בשתי ידיים.\nמשהו נגרר מעבר לדלת. היא קירבה את האוזן, ואז צעדה חצי צעד אחורה.\n'אני רק לוקחת את הכדור,' לחשה, וְנָגְעָה בידית.";
  await page.type('#story', STORY);
  await page.waitForFunction(() => true); await sleep(3000);
  const illAfterTyping = await illus();
  const np1 = await noPlayback();
  ok('5a. הקלדת סיפור ושינוי תכנון לא משנים את האיור; אחרי 3 שניות אין תנועה', illAfterTyping === illBefore && np1.anim === 0 && np1.animate === 0);
  ok('6a. אין בקרות ניגון או כלי בימוי בשלב הכתיבה', np1.ctrl === 0 && np1.players === 0 && np1.words.length === 0, np1.words.join(','));
  await shot('04-ws-write');
  /* 7: התבוננות */
  await click('[data-act="toReflect"]');
  const d1 = await page.evaluate(() => S.ws.draft1 && S.ws.draft1.text);
  ok('9a. טיוטה ראשונה נשמרת במעבר להתבוננות', d1 === STORY);
  ok('7a. שאלה אחת בכל פעם', (await page.$eval('.qnum', e => e.innerText)) === 'שאלה 1 מתוך 3' && (await page.$$('.qcard')).length === 1);
  await page.click('details.marker summary'); await sleep(100);
  const sel = async (s) => page.evaluate(s => { const ta = document.querySelector('#storySrc'); const i = ta.value.indexOf(s); ta.focus(); ta.setSelectionRange(i, i + s.length); }, s);
  await sel('צעדה חצי צעד אחורה'); await click('[data-act="mark"][data-t="feel"]');
  await page.click('details.marker summary').catch(() => { }); await sleep(80);
  if (!(await page.$eval('details.marker', d => d.open))) await page.click('details.marker summary');
  await sel('נגעה'); // לא קיים בדיוק (יש ניקוד) — לא אמור להיווצר סימון שגוי
  await sel("'אני רק לוקחת את הכדור,'"); await click('[data-act="mark"][data-t="want"]');
  if (!(await page.$eval('details.marker', d => d.open))) await page.click('details.marker summary');
  await sel("'אני רק לוקחת את הכדור,'"); await click('[data-act="mark"][data-t="feel"]');
  const marks = await page.$$eval('#storyView mark', m => m.map(x => x.innerText));
  ok('7b. סימון "רמז לרגש"/"רמז לרצון" מדגיש טקסט עם תווית (לא צבע בלבד)', marks.some(m => m.includes('רגש')) && marks.some(m => m.includes('רגש + רצון')), marks.join(' | '));
  if (!(await page.$eval('details.marker', d => d.open))) await page.click('details.marker summary');
  await sel("'אני רק לוקחת את הכדור,'"); await click('[data-act="pasteSel"]');
  await page.type('#re', 'היא מסבירה מה היא רוצה לעשות');
  await click('[data-act="qnav"][data-d="1"]');
  await page.type('#rq', 'מילים שלא כתובות בסיפור'); const qw = await page.$eval('#quoteWarn', e => !e.hidden);
  await page.click('[data-in="rnot"]'); await sleep(120);
  await click('[data-act="qnav"][data-d="1"]'); await page.type('#re', 'המעטפה בשתי ידיים');
  const R = await page.evaluate(() => S.ws.reflect);
  ok('7c. תשובות וציטוטים נשמרים; ציטוט שלא בסיפור מסומן לבדיקה; "עוד לא מצאתי" נשמר כיעד', R.answers.q1.quote === "'אני רק לוקחת את הכדור,'" && qw && R.answers.q2.notFound === true && R.answers.q3.expl === 'המעטפה בשתי ידיים' && !S_TEXT_CHANGED(await page.evaluate(() => S.ws.text), STORY));
  await click('[data-act="deep"]'); ok('7d. שאלות העמקה נפתחות לפי בקשה', (await page.$eval('.qnum', e => e.innerText)) === 'שאלה 4 מתוך 5');
  const np2 = await noPlayback(); ok('6b. אין בקרות ניגון בשלב ההתבוננות', np2.ctrl === 0 && np2.words.length === 0, np2.words.join(','));
  ok('5b. מילוי התבוננות לא שינה את האיור', (await illus()) === illBefore);
  await shot('05-ws-reflect');
  /* 8: חבר */
  await click('[data-act="step"][data-s="3"]');
  ok('8a. "עכשיו משתפים בכוונה" לא זמין לפני תגובת החבר', !(await page.$('[data-act="fbReveal"]')));
  await click('[data-act="friendGo"]');
  const fv = await page.evaluate(() => ({ t: document.querySelector('#app').innerText, marks: document.querySelectorAll('#app mark').length }));
  ok('8b. מסך החבר: סיפור ואיור בלבד — בלי תכנון, תשובות או סימוני רמזים', fv.t.includes('מאיה עמדה מול הדלת') && !fv.t.includes('סוד־תכנון') && !fv.t.includes('להיכנס ולקחת את הכדור') && !fv.t.includes('היא מסבירה מה היא רוצה') && fv.marks === 0 && !fv.t.includes('רמז לרגש'));
  const np3 = await noPlayback(); ok('6c. אין בקרות ניגון במסך החבר', np3.ctrl === 0 && np3.words.length === 0);
  await shot('06-friend');
  await page.type('#fwho', 'דנה'); await page.type('#fd_feel', 'נראה לי שהיא מפחדת, בגלל חצי הצעד אחורה'); await page.type('#fd_want', 'רוצה את הכדור'); await page.type('#fd_wish', 'הייתי מפרט מה נגרר');
  await click('[data-act="friendDone"]');
  await click('[data-act="fbReveal"]');
  const rv = await text();
  ok('8c. אחרי התגובה: הכוונה מוצגת לצד פרשנות החבר', rv.includes('מה הכותב תכנן') && rv.includes('להיכנס ולקחת את הכדור') && rv.includes('רוצה את הכדור') && rv.includes('מה בטקסט הוביל להבנה הזאת?'));
  await page.type('#fbWhy', 'חצי הצעד אחורה');
  /* 9: שכתוב */
  await click('[data-act="step"][data-s="4"]');
  await page.focus('#story2'); await page.keyboard.down('Control'); await page.keyboard.press('End'); await page.keyboard.up('Control');
  await page.type('#story2', ' מה שנגרר היה ארגז כבד, והיא נשמה עמוק.');
  await page.type('#chWhat', 'הוספתי מה נגרר'); await page.type('#chWhy', 'למה היא חוששת');
  const fbId = await page.evaluate(() => S.ws.feedback[0].id); await click(`[data-act="chRef"][data-v="${fbId}"]`);
  await click('[data-act="saveRev"]');
  await page.focus('#story2'); await page.keyboard.down('Control'); await page.keyboard.press('End'); await page.keyboard.up('Control');
  await page.type('#story2', ' "יש מישהו?"'); await click('[data-act="saveRev"]');
  const V = await page.evaluate(() => ({ d1: S.ws.draft1.text, revs: S.ws.revisions.map(r => r.text), fb: S.ws.feedback.length, ref: S.ws.revisions[0].ref, what: S.ws.revisions[0].what, diff: document.querySelectorAll('ins').length }));
  ok('9b. טיוטה ראשונה, משוב וגרסאות משופרות נשמרים בנפרד; שינוי נוסף לא מוחק את המקור', V.d1 === STORY && V.revs.length === 2 && V.revs[0] !== V.revs[1] && V.fb === 1 && V.ref === fbId && V.what === 'הוספתי מה נגרר' && V.diff > 0);
  const np4 = await noPlayback(); ok('6d. אין בקרות ניגון בשלב השכתוב', np4.ctrl === 0 && np4.words.length === 0);
  ok('5c. משוב ושכתוב לא שינו את האיור', (await illus()) === illBefore);
  await shot('07-ws-rewrite');
  /* 10: אתגר */
  await click('[data-act="adv"]'); await click('[data-act="step"][data-s="0"]');
  const advIll = await illus();
  await click('[data-act="combo"][data-j="1"]'); await page.type('#advWant', 'להבין מי שם');
  const advT = await text(); const np5 = await noPlayback();
  ok('10. אתגר שתי תחושות ורצון: שדות כתיבה בלבד, בלי כלי אנימציה, האיור זהה', advT.includes('ומה הדמות רוצה שיקרה ברגע הזה?') && np5.ctrl === 0 && np5.words.length === 0 && advIll === illBefore && (await illus()) === illBefore);
  await click('[data-act="step"][data-s="2"]'); await click('[data-act="qnav"][data-d="1"]'); await click('[data-act="qnav"][data-d="1"]');
  const advQ = await page.$eval('.qnum', e => e.innerText);
  await click('[data-act="step"][data-s="1"]'); const advEx = await page.evaluate(() => [...document.querySelectorAll('details.help summary')].map(s => s.innerText));
  ok('10b. באתגר: שאלת התבוננות נוספת ודוגמאות טקסט (בלי סרטון)', /מתוך 6/.test(advQ) && advEx.includes('דוגמאות לאתגר'), advQ);
  await click('[data-act="adv"]');
  /* 11: מצב כיתה */
  await page.evaluate(() => { S.product.title = 'ליד המחסן'; save(); });
  await click('[data-go="present"]'); await sleep(200);
  const pt = await text(), ph = (await page.content()).replace(/<script[\s\S]*?<\/script>/g, '');
  const secrets = ['סוד־תכנון', 'להיכנס ולקחת את הכדור', 'היא מסבירה מה היא רוצה', 'רוצה את הכדור', 'הייתי מפרט מה נגרר', 'חצי הצעד אחורה'];
  const np6 = await noPlayback();
  ok('11a. מצב כיתה: טקסט ואיור סטטי, בלי ניגון', pt.includes('"יש מישהו?"') && !!(await page.$('#pIllus svg')) && np6.ctrl === 0 && np6.players === 0 && np6.words.length === 0);
  ok('11b. מצב כיתה: אין תכנון, תשובות או משוב עד החשיפה', secrets.every(s => !ph.includes(s)) && !pt.includes('חשש'), secrets.filter(s => ph.includes(s)).join(','));
  await page.type('#gfeel', 'פחד'); await page.type('#gwant', 'לקחת משהו'); await click('[data-act="addGuess"]');
  await click('[data-act="reveal"]'); const pr = await text();
  ok('11c. החשיפה רק בכפתור המפורש', pr.includes('להיכנס ולקחת את הכדור') && pr.includes('סוד־תכנון') && pr.includes('זו הכוונה של הכותב'));
  await shot('08-present');
  /* 12: Word */
  await click('[data-go="product"]'); await sleep(200);
  const lbl = await page.$eval('.chosen-label', e => e.innerText);
  await page.type('#pauthor', 'כותבת "סקרנית"');
  await click('[data-act="docClass"]'); const f1 = await waitFile('הסיפור_שלי_לכיתה.docx'); if (f1) fs.renameSync(f1, path.join(OUT, 'class.docx'));
  await click('[data-act="docWriter"]'); const f2 = await waitFile('הסיפור_שלי_עותק_לכותב.docx'); if (f2) fs.renameSync(f2, path.join(OUT, 'writer.docx'));
  await page.click('[data-in="noImage"]'); await sleep(100);
  await click('[data-act="docClass"]'); const f3 = await waitFile('הסיפור_שלי_לכיתה.docx'); if (f3) fs.renameSync(f3, path.join(OUT, 'class-noimage.docx'));
  await page.click('[data-in="noImage"]'); await sleep(100);
  await click('[data-act="choose"][data-v="draft1"]');
  await click('[data-act="docClass"]'); const f4 = await waitFile('הסיפור_שלי_לכיתה.docx'); if (f4) fs.renameSync(f4, path.join(OUT, 'class-draft1.docx'));
  await click('[data-act="choose"][data-v="current"]');
  ok('12a. הגרסה שתרד מסומנת בבירור; ארבעה קבצים נוצרו', lbl.includes('הגרסה האחרונה') && f1 && f2 && f3 && f4, lbl);
  await shot('09-product');
  /* 13: שמירה */
  const snap = () => page.evaluate(() => JSON.stringify([S.ws.text, S.ws.draft1, S.ws.revisions, S.ws.feedback, S.ws.reflect, S.ws.plan, S.ws.props]));
  const s0 = await snap(); await page.reload({ waitUntil: 'load' }); await sleep(200);
  ok('13a. רענון משחזר סיפור, טיוטות, משוב, התבוננות ותכנון', (await snap()) === s0);
  await click('[data-go="product"]'); await click('[data-act="backup"]'); const fj = await waitFile('הסיפור_שלי_גיבוי.json'); if (fj) fs.renameSync(fj, path.join(OUT, 'project.json'));
  const bad = path.join(OUT, 'bad.json'); fs.writeFileSync(bad, '{"app":"bein-hashurot","state":{"ws":{"text":5}}}');
  await (await page.$('#loadFile')).uploadFile(bad); await sleep(400);
  ok('13b. גיבוי שגוי לא דורס עבודה', (await snap()) === s0 && (await page.$eval('#loadMsg', e => e.innerText)).includes('לא קובץ פרויקט'));
  // 13c: הגירה מגרסה ישנה (localStorage)
  const old = JSON.parse(fs.readFileSync(OLD_BACKUP, 'utf8')).state;
  const oldText = old.ws.sentences.map(s => s.text).filter(t => t.trim()).join(' ');
  const b2 = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const errors2 = [], p2 = await newPage(b2, errors2, remote);
  await p2.evaluateOnNewDocument(o => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('bein-hashurot-v1', JSON.stringify(o)); sessionStorage.setItem('seeded', '1'); } }, old);
  await p2.goto(URL, { waitUntil: 'load' }); await sleep(300);
  const mig = await p2.evaluate(() => ({ text: S.ws.text, char: S.ws.charId, place: S.ws.place, props: S.ws.props, feel: S.ws.plan.feel, why: S.ws.plan.why, name: S.ws.name, backup: !!localStorage.getItem('bein-hashurot-v1-backup'), legacyDirs: (S.legacy && S.legacy.sentences || []).filter(s => s.dir).length, banner: document.body.innerText.includes('הסיפור שכתבתם נשמר'), screen: S.screen }));
  console.log('   migration detail', JSON.stringify(Object.assign({}, mig, { text: mig.text.slice(0, 40) })));
  ok('13c. טיוטה ישנה (עם הוראות במה) עוברת למבנה החדש בלי לאבד מילים, דמות, מקום, חפץ וכוונה', mig.text === oldText && mig.char === old.ws.charId && mig.place === old.ws.place && mig.props[0] === old.ws.prop && mig.feel.join() === old.ws.secret.emo.join() && mig.why.includes(old.ws.secret.why) && mig.backup && mig.legacyDirs > 0 && mig.banner, JSON.stringify({ chars: mig.text.length, legacyDirs: mig.legacyDirs }));
  await p2.click('[data-go="create"]'); await sleep(200);
  const migNp = await p2.evaluate(() => document.querySelectorAll('.controls,.pp,[data-act="edit"]').length + document.body.innerText.includes('איך נראה את זה'));
  await p2.reload({ waitUntil: 'load' }); const mig2 = await p2.evaluate(() => S.ws.text);
  ok('13d. אחרי הגירה: הוראות הבמה הישנות לא מפעילות דבר; רענון שומר', migNp === 0 && mig2 === oldText);
  await p2.click('[data-go="product"]'); await sleep(150);
  await (await p2.$('#loadFile')).uploadFile(OLD_BACKUP); await sleep(400); await p2.click('[data-m="ok"]'); await sleep(300);
  ok('13e. יבוא קובץ גיבוי בפורמט הישן עובד', (await p2.evaluate(() => S.ws.text)) === oldText);
  await (await p2.$('#loadFile')).uploadFile(path.join(OUT, 'project.json')); await sleep(400); await p2.click('[data-m="ok"]'); await sleep(300);
  ok('13f. יבוא קובץ פרויקט חדש במחשב אחר משחזר הכול', (await p2.evaluate(() => JSON.stringify([S.ws.text, S.ws.draft1, S.ws.revisions, S.ws.feedback, S.ws.reflect, S.ws.plan, S.ws.props]))) === s0);
  await b2.close();
  // אחסון חסום
  const b3 = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] }); const errors3 = [], p3 = await newPage(b3, errors3, remote);
  await p3.evaluateOnNewDocument(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
  await p3.goto(URL, { waitUntil: 'load' }); await p3.click('[data-act="toCreate"]'); await sleep(150); await p3.click('[data-act="step"][data-s="1"]'); await sleep(150); await p3.type('#story', 'עובדים גם בלי שמירה');
  ok('13g. אחסון חסום: הודעה + הורדת גיבוי, והכתיבה ממשיכה', (await p3.$eval('#banner', b => !b.hidden && b.innerText.includes('גיבוי'))) && (await p3.evaluate(() => S.ws.text)) === 'עובדים גם בלי שמירה' && errors3.length === 0);
  await b3.close();
  // טקסט כטקסט
  await click('[data-go="create"]'); await click('[data-act="step"][data-s="1"]');
  await page.evaluate(() => { const t = document.querySelector('#story'); t.value += '\n<b>מודגש?</b> <img src=x onerror="window.__x=1">'; t.dispatchEvent(new Event('input', { bubbles: true })); });
  await click('[data-act="step"][data-s="2"]');
  ok('13h. טקסט תלמיד עם תגיות מוצג כטקסט בלבד', (await page.$$eval('#storyView b, #storyView img', x => x.length)) === 0 && (await page.$eval('#storyView', e => e.innerText)).includes('<b>מודגש?</b>') && !(await page.evaluate(() => window.__x)));
  /* 15: מקלדת, טאבלט */
  await click('[data-go="learn"]'); await page.focus('.stage'); await page.keyboard.press('Space'); await sleep(300);
  ok('15a. מקלדת: רווח על במת הלמידה מפעיל', await page.evaluate(() => [...Players][0].playing));
  await page.keyboard.press('Space');
  await page.setViewport({ width: 820, height: 1180 });
  const over = [];
  for (const g of ['learn', 'create', 'present', 'product']) { await click(`[data-go="${g}"]`); await sleep(200); if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)) over.push(g); if (g === 'create') await shot('10-tablet-create'); }
  ok('15b. טאבלט: בלי גלילה אופקית בכל המסכים', over.length === 0, over.join(','));
  const small = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 34).map(b => b.innerText.trim()).slice(0, 4));
  ok('15d. כפתורים בגודל נגיעה סביר', small.length === 0, small.join('|'));
  ok('14a. אין בקשות רשת חיצוניות', remote.length === 0, remote.slice(0, 3).join(','));
  ok('14b. אין שגיאות JavaScript', errors.length === 0 && errors2.length === 0, [...errors, ...errors2].slice(0, 3).join(' || '));
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ when: new Date().toISOString(), failed, results }, null, 1));
  console.log(`\n${results.length - failed}/${results.length} passed`);
  await browser.close(); process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
function S_TEXT_CHANGED(a, b) { return a !== b; }
