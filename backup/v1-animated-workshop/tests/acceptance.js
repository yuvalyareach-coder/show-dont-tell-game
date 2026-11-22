/* בדיקות קבלה אוטומטיות בדפדפן אמיתי (Chrome headless + puppeteer-core).
   הרצה: node tests/acceptance.js <תיקיית פלט>
   דורש puppeteer-core מותקן (NODE_PATH) ו-Chrome במחשב. */
const puppeteer = require('puppeteer-core');
const fs = require('fs'), path = require('path');
const OUT = path.resolve(process.argv[2] || 'test-out');
const DL = path.join(OUT, 'downloads');
fs.mkdirSync(DL, { recursive: true });
for (const f of fs.readdirSync(DL)) fs.unlinkSync(path.join(DL, f));
const URL = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
const results = []; let failed = 0;
const ok = (name, cond, info) => { results.push({ name, pass: !!cond, info: info || '' }); if (!cond) failed++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (info ? ' — ' + info : '')); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const userDir = path.join(OUT, 'profile'); fs.rmSync(userDir, { recursive: true, force: true });
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', userDataDir: userDir, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 950 });
  const errors = [], remote = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.setRequestInterception(true);
  page.on('request', r => { const u = r.url(); if (u.startsWith('file:') || u.startsWith('data:') || u.startsWith('blob:')) r.continue(); else { remote.push(u); r.abort(); } });
  const cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL, eventsEnabled: true });
  const click = async sel => { await page.waitForSelector(sel, { visible: true, timeout: 5000 }); await page.click(sel); await sleep(120); };
  const text = () => page.evaluate(() => document.body.innerText);
  const shot = n => page.screenshot({ path: path.join(OUT, n + '.png') });
  const waitFile = async (name, ms) => { const p = path.join(DL, name); for (let i = 0; i < (ms || 8000) / 100; i++) { if (fs.existsSync(p) && fs.statSync(p).size > 0 && !fs.existsSync(p + '.crdownload')) { await sleep(150); return p; } await sleep(100); } return null; };

  await page.goto(URL, { waitUntil: 'load' });
  await shot('01-home');

  /* ---------- 1,2,3: חמש סצנות ---------- */
  const scenes = await page.evaluate(() => SCENES.map(s => ({ id: s.id, intent: s.secret.intent, tell: s.secret.tell, para: s.secret.paragraph, clues: s.secret.clues, title: s.title, context: s.context })));
  // כל הסצנות קיימות, נבדלות, ונגמרות במצב יציב
  const sceneInfo = await page.evaluate(() => {
    const out = [];
    for (const id of ['s1', 's2', 's3', 's4', 's5']) {
      const S = SCENE_STAGE[id], tl = (S.A)(); const a = computeState(tl, tl.dur), b = computeState(tl, tl.dur + 5);
      const stable = Object.keys(a).every(k => typeof a[k] !== 'number' || Math.abs(a[k] - b[k]) < 1e-6);
      out.push({ id, dur: tl.dur, stable, sig: JSON.stringify(Object.keys(a).filter(k => !k.startsWith('c.')).sort()) + S.setup().charId });
    }
    return out;
  });
  ok('1a. חמש סצנות קיימות', sceneInfo.length === 5, sceneInfo.map(s => s.id + ':' + s.dur.toFixed(1) + 's').join(' '));
  ok('1b. כל סצנה 12–20 שניות בערך', sceneInfo.every(s => s.dur >= 10.5 && s.dur <= 20.5));
  ok('1c. הסצנות נבדלות (דמות/חפצים שונים)', new Set(sceneInfo.map(s => s.sig)).size === 5);
  ok('1d. כל סצנה נגמרת במצב יציב', sceneInfo.every(s => s.stable));

  await click('[data-act="start"]');
  for (let i = 0; i < 5; i++) {
    const sc = scenes[i];
    const before = await text();
    const leakWords = [sc.intent, sc.tell, sc.para, ...sc.clues.map(c => c.expl)];
    ok(`2.${i + 1} סצנה ${i + 1}: לפני חשיפה אין כוונה/פסקה/הסבר רמזים`, leakWords.every(w => !before.includes(w)) && before.includes(`סצנה ${i + 1} מתוך 5`));
    const aria = await page.evaluate(() => [...document.querySelectorAll('[aria-label]')].map(e => e.getAttribute('aria-label')).join(' | '));
    ok(`2.${i + 1}b סצנה ${i + 1}: אין רגש בתוויות נגישות`, !/שמח|פחד|כעס|אכזב|הפתע|התרגש/.test(aria + await page.title()));
    await click('[data-act="watch"]');
    await sleep(700);
    if (i === 0) {
      // 6: עצירה מקפיאה את הזמן; לחיצות מהירות לא יוצרות כפילות
      const t1 = await page.evaluate(() => [...Players][0].t);
      await click('.controls .pp'); // עצירה
      const tp = await page.evaluate(() => [...Players][0].t); await sleep(600);
      const tp2 = await page.evaluate(() => [...Players][0].t);
      ok('6a. עצירה מקפיאה את התנועה', tp === tp2 && t1 > 0, `t=${tp.toFixed(2)}`);
      const bubBefore = await page.evaluate(() => document.querySelectorAll('.stage .bubble').length);
      for (let k = 0; k < 15; k++) await page.click('.controls .pp');
      const playing = await page.evaluate(() => [...Players][0].playing); // 15 לחיצות -> מנגן
      const a0 = await page.evaluate(() => [...Players][0].t); await sleep(1000); const a1 = await page.evaluate(() => [...Players][0].t);
      ok('6b. לחיצות מהירות: קצב רגיל, בלי הפעלה כפולה', playing && (a1 - a0) > .6 && (a1 - a0) < 1.35, `התקדמות ${(a1 - a0).toFixed(2)}s בשנייה`);
      await click('.controls .restart'); const r0 = await page.evaluate(() => [...Players][0].t);
      ok('6c. הפעלה מחדש חוזרת להתחלה', r0 < .2);
      void bubBefore;
    }
    // 3: תשובה חלופית
    const alt = i === 0 ? 'סקרנות, ואולי קצת בלבול' : 'משהו אחר לגמרי';
    await page.type('#ans', alt); await page.type('#clue', 'הידיים שלו והמילים שאמר "בדיוק כך"');
    if (i === 1) { await click('.moment[data-j="1"]'); await click('.moment[data-j="3"]'); }
    const dis = await page.$eval('#revealBtn', b => b.disabled);
    ok(`3.${i + 1}a כפתור החשיפה פעיל אחרי מילוי`, !dis);
    await click('#revealBtn');
    const after = await text();
    ok(`3.${i + 1}b תשובה חלופית נשמרת ומוצגת ליד כוונת המחבר, בלי "טעות"`, after.includes(alt) && after.includes(sc.intent) && !/טעות|שגוי|לא נכון/.test(after));
    if (i === 0) await shot('02-learn-reveal');
    // 4: כל רמז מציג את הרגע שלו
    await click('[data-act="rtab"][data-r="1"]');
    const paraTxt = await page.$eval('blockquote.para', b => b.innerText);
    ok(`2.${i + 1}c הפסקה המלאה מוצגת אחרי החשיפה`, paraTxt.replace(/\s+/g, ' ').trim() === sc.para.replace(/\s+/g, ' ').trim());
    const nClue = await page.$$eval('.clue', b => b.length);
    let allClues = nClue === sc.clues.length && nClue >= 3;
    for (let j = 0; j < nClue; j++) {
      await page.click(`.clue[data-j="${j}"]`);
      const c = sc.clues[j]; await sleep((c.t - c.from) * 1000 + 600);
      const t = await page.evaluate(() => [...Players][0].t);
      const ex = await page.$eval('#explain', e => e.innerText);
      if (Math.abs(t - c.t) > .05 || !ex.includes(c.expl)) { allClues = false; console.log('   clue', j, t, c.t); }
    }
    ok(`4.${i + 1} סצנה ${i + 1}: ${nClue} רמזים — כל לחיצה עוצרת ברגע שלה ומציגה הסבר`, allClues);
    if (i === 0) await shot('03-learn-clue');
    await click('[data-act="rtab"][data-r="2"]');
    await click('[data-act="keep"][data-v="change"]'); await page.type('#ans2', 'גרסה שנייה שלי');
    const both = await text(); const st2 = await page.evaluate(id => S.learn.sc[id], sc.id);
    ok(`3.${i + 1}c שתי הפרשנויות נשמרות ומוצגות`, both.includes(alt) && both.includes('הפרשנות הנוספת: גרסה שנייה שלי') && st2.answer === alt && st2.answer2 === 'גרסה שנייה שלי');
    await click('[data-act="rtab"][data-r="3"]');
    // 5: שתי חלופות עובדות ומשנות פעולה וטקסט
    const vers = await page.$$eval('[data-act="ver"]', b => b.map(x => x.dataset.v));
    const res5 = [];
    for (const v of vers) {
      await page.click(`[data-act="ver"][data-v="${v}"]`); await sleep(300);
      const info = await page.evaluate(() => { const p = [...Players][0]; return { dur: p.tl.dur, end: JSON.stringify(computeState(p.tl, p.tl.dur)), para: document.querySelector('#verPara').innerText }; });
      res5.push(info);
    }
    ok(`5.${i + 1} סצנה ${i + 1}: שתי החלופות פועלות ומשנות גם תנועה וגם טקסט`, res5.length === 2 && res5[0].end !== res5[1].end && res5[0].para !== res5[1].para, vers.join('/'));
    if (i === 3) await shot('04-learn-variation');
    if (i < 4) await click('[data-act="nextScene"]');
  }
  const cards = await page.$$eval('.mcard.got', x => x.length);
  ok('3x. נאספו 5 כרטיסי התבוננות', cards === 5);

  /* ---------- 6d: מעבר מסך מבטל תזמונים ---------- */
  await click('[data-act="ver"]'); await sleep(300);
  await click('[data-go="create"]'); await sleep(400);
  const stale = await page.evaluate(() => [...Players].filter(p => p.playing).length + '/' + Players.size);
  ok('6d. מעבר מסך עוצר את הנגן הקודם (אין נגנים מנגנים, נגן אחד קיים)', stale === '0/1', stale);

  /* ---------- 7: סדנה ---------- */
  const charIds = await page.$$eval('[data-act="char"]', b => b.map(x => x.dataset.id));
  let charOK = charIds.length === 6;
  for (const id of charIds) { await page.click(`[data-act="char"][data-id="${id}"]`); await sleep(120); const s = await page.evaluate(() => S.ws.charId); if (s !== id) charOK = false; }
  ok('7a. אפשר לבחור כל אחת משש הדמויות', charOK, charIds.join(','));
  await page.click('[data-act="char"][data-id="maya"]'); await sleep(100);
  await page.click('[data-act="place"][data-v="corridor"]'); await sleep(100);
  await page.click('[data-act="prop"][data-v="box"]'); await sleep(100);
  await page.click('[data-act="emo"][data-v="סקרנות"]'); await page.click('[data-act="emo"][data-v="חשש"]');
  await page.type('#why', 'סוד־הכותב: היא שמעה רעש ולא יודעת מה בקופסה');
  await shot('05-create-setup');
  await click('[data-act="step"][data-s="1"]');
  const sids = await page.evaluate(() => S.ws.sentences.map(s => s.id));
  const T = [
    'מאיה הלכה לאט אל המדף ועצרה מול הקופסה.',
    "היא הרימה אותה והקשיבה. 'יש פה מישהו?' לחשה, וְהַקּוֹל שלה כמעט נעלם.",
    'העיניים שלה נפתחו לרווחה, ואז חיוך קטן הופיע.\nהיא צעדה צעד לאחור.',
  ];
  for (let j = 0; j < 3; j++) await page.type('#t_' + sids[j], T[j]);
  await click('[data-act="addSent"]');
  const sids4 = await page.evaluate(() => S.ws.sentences.map(s => s.id));
  await page.type('#t_' + sids4[3], 'היא שמחה מאוד.');
  const emoNote = await page.$eval('#emo_' + sids4[3], e => !e.hidden);
  ok('7b. 4 משפטים מקוריים; שם רגש מפעיל הצעה עדינה בלבד', (await page.evaluate(() => S.ws.sentences.length)) === 4 && emoNote);
  await shot('06-create-write');
  await click('[data-act="step"][data-s="2"]');
  // משפט 1: הליכה הססנית אל החפץ + מבט לרצפה
  const dirFor = async (sid, fn) => { await click(`[data-act="edit"][data-id="${sid}"]`); await fn(); await click('[data-act="confirm"]'); };
  await dirFor(sids4[0], async () => { await click('[data-act="dAct"][data-v="hesitant"]'); await click('[data-act="dAct"][data-v="lookProp"]'); await click('[data-act="dPace"][data-v="slow"]'); });
  await dirFor(sids4[1], async () => { await click('[data-act="dAct"][data-v="pickup"]'); await click('[data-act="spQuote"][data-j="0"]'); await click('[data-act="spVol"][data-v="quiet"]'); await click('[data-act="dPost"][data-v="sleeveGrip"]'); });
  await click(`[data-act="edit"][data-id="${sids4[2]}"]`);
  await click('[data-act="dFace"][data-k="eyes"][data-v="wide"]'); await click('[data-act="dFace"][data-k="mouth"][data-v="smallSmile"]'); await click('[data-act="dAct"][data-v="stepBack"]');
  await click('[data-act="preview"]'); await sleep(500); await shot('07-create-directive');
  await click('[data-act="confirm"]');
  const st1 = await page.evaluate(() => S.ws.sentences.map(s => senStatus(s).k));
  ok('7c. שלוש המחשות אושרו, משפט 4 בלי המחשה', st1.join(',') === 'ok,ok,ok,none', st1.join(','));
  const mapBefore = await page.evaluate(() => JSON.stringify(S.ws.sentences.map(s => [s.id, s.dir && describeDir(s.dir)])));
  await click(`[data-act="up"][data-id="${sids4[2]}"]`);
  const after7 = await page.evaluate(() => ({ order: S.ws.sentences.map(s => s.id), map: JSON.stringify([...S.ws.sentences].sort((a, b) => 0).map(s => [s.id, s.dir && describeDir(s.dir)])) }));
  const mapA = JSON.parse(mapBefore), mapB = JSON.parse(after7.map);
  const sameLinks = mapA.every(([id, d]) => mapB.some(([id2, d2]) => id2 === id && d2 === d));
  ok('7d. שינוי סדר שומר את הקשר משפט↔המחשה', after7.order[1] === sids4[2] && sameLinks);
  const spanOrder = await page.evaluate(() => compileStory(publicModel()).spans.map(s => s.id));
  ok('7e. סדר הביצוע עוקב אחרי סדר המשפטים', JSON.stringify(spanOrder) === JSON.stringify(after7.order));
  await click(`[data-act="down"][data-id="${sids4[2]}"]`);

  /* ---------- 8: שינוי טקסט לא יוצר המחשה; שינוי הוראה משנה במה ---------- */
  const t8 = await page.evaluate(() => {
    const m = publicModel(); const a = compileStory(m);
    const m2 = JSON.parse(JSON.stringify(m)); m2.sentences[0].text = 'טקסט אחר לגמרי שמזכיר קפיצה, ריצה, צחוק ודלת';
    const b = compileStory(m2);
    const m3 = JSON.parse(JSON.stringify(m)); m3.sentences[0].dir.actions = [{ id: 'run', dir: 'toProp' }];
    const c = compileStory(m3);
    const segs = r => JSON.stringify(r.tl.segs);
    const m4 = JSON.parse(JSON.stringify(m)); m4.sentences[3].text = 'הוא קפץ ורץ אל הדלת וצחק';
    const d = compileStory(m4);
    const span4 = d.spans[3];
    const seg4 = d.tl.segs.filter(g => g.at >= span4.start - 1e-6 && g.at < span4.end && g.dur > 0).length;
    return { sameText: segs(a) === segs(b), diffDir: segs(a) !== segs(c), seg4, kind4: span4.kind };
  });
  ok('8a. שינוי טקסט בלבד לא משנה את התנועה', t8.sameText);
  ok('8b. שינוי פעולת במה משנה תנועה', t8.diffDir);
  ok('9a. משפט בלי המחשה לא מקבל אנימציה (גם עם מילות פעולה)', t8.seg4 === 0 && t8.kind4 === 'none', 'segs=' + t8.seg4);
  // עריכת טקסט אחרי אישור
  await click('[data-act="step"][data-s="1"]');
  await page.focus('#t_' + sids4[0]); await page.keyboard.down('Control'); await page.keyboard.press('End'); await page.keyboard.up('Control');
  await page.type('#t_' + sids4[0], ' בשקט');
  const rech = await page.evaluate(id => senStatus(S.ws.sentences.find(s => s.id === id)).k, sids4[0]);
  const stillDir = await page.evaluate(id => !!S.ws.sentences.find(s => s.id === id).dir.actions.length, sids4[0]);
  ok('7f. עריכת טקסט אחרי אישור מסמנת "בדקו שוב התאמה" ולא מוחקת', rech === 'recheck' && stillDir);

  /* ---------- 10: עיניים רחבות+חיוך מול עיניים רחבות+נסיגה ---------- */
  const t10 = await page.evaluate(() => {
    const mk = acts => ({ charId: 'noam', place: 'room', prop: 'box', sentences: [{ id: 'x', text: 'משפט', dir: Object.assign(emptyDir(), { eyes: 'wide', mouth: acts ? 'keep' : 'smallSmile', actions: acts || [] }) }] });
    const a = compileStory(mk(null)), b = compileStory(mk([{ id: 'stepBack' }]));
    const ea = computeState(a.tl, a.spans[0].end), eb = computeState(b.tl, b.spans[0].end);
    return { aw: ea['c.wide'], bw: eb['c.wide'], asmile: ea['c.smile'], bsmile: eb['c.smile'], ax: ea['c.x'], bx: eb['c.x'] };
  });
  ok('10. עיניים רחבות+חיוך ≠ עיניים רחבות+צעד לאחור', t10.aw === 1 && t10.bw === 1 && t10.asmile > .5 && t10.bsmile === 0 && t10.bx < t10.ax, JSON.stringify(t10));

  /* ---------- 11: מצב כיתה ---------- */
  await page.evaluate(() => { S.product.title = 'רגע ליד המדף'; save(); });
  await click('[data-go="present"]'); await sleep(300);
  const pres = await text(); const presHTML = await page.content();
  const secrets = ['סקרנות', 'חשש', 'סוד־הכותב'];
  ok('11a. מצב כיתה: אין רגש מטרה, הסבר או שמות המחשה לפני חשיפה', secrets.every(w => !pres.includes(w)) && !pres.includes('הליכה') && !pres.includes('צעדים קטנים'), '');
  const presLeakHTML = secrets.filter(w => presHTML.replace(/<script[\s\S]*?<\/script>/g, '').includes(w));
  ok('11b. מצב כיתה: גם ב-HTML (תוויות/כותרות) אין דליפה', presLeakHTML.length === 0, presLeakHTML.join(','));
  await click('[data-act="playAll"]'); await sleep(2500);
  await shot('08-present');
  const pres2 = await text(); ok('11c. בסיום/במהלך ההצגה אין חשיפה אוטומטית', secrets.every(w => !pres2.includes(w)));
  await page.type('#gfeel', 'נדמה לי שהיא סקרנית'); await page.type('#gdet', 'היא הקשיבה לקופסה'); await click('[data-act="addGuess"]');
  await click('[data-act="reveal"]'); const pres3 = await text();
  ok('11d. החשיפה רק בלחיצה המפורשת', pres3.includes('סקרנות') && pres3.includes('סוד־הכותב') && pres3.includes('זו הכוונה של הכותב'));
  await shot('09-present-reveal');

  /* ---------- 12: DOCX ---------- */
  await click('[data-go="product"]'); await sleep(300);
  const imgBtns = await page.$$('[data-act="img"]');
  for (let k = 0; k < Math.min(3, imgBtns.length); k++) { const b = (await page.$$('[data-act="img"]'))[k]; await b.click(); await sleep(250); }
  const nSel = await page.evaluate(() => S.product.images.length);
  await page.type('#pauthor', 'כותבת "מחוננת"');
  await shot('10-product');
  await click('[data-act="docClass"]');
  const fClass = await waitFile('הסיפור_שלי_לכיתה.docx');
  ok('12a. נוצר קובץ Word לכיתה', !!fClass, nSel + ' תמונות נבחרו');
  if (fClass) fs.copyFileSync(fClass, path.join(OUT, 'class.docx'));
  if (fClass) fs.unlinkSync(fClass);
  await click('[data-act="docWriter"]');
  const fW = await waitFile('הסיפור_שלי_עותק_לכותב.docx');
  ok('12b. נוצר עותק לכותב', !!fW); if (fW) fs.renameSync(fW, path.join(OUT, 'writer.docx'));
  await page.click('[data-in="noImages"]'); await sleep(150);
  await click('[data-act="docClass"]');
  const fT = await waitFile('הסיפור_שלי_לכיתה.docx');
  ok('12c. ייצוא טקסט בלבד', !!fT); if (fT) fs.renameSync(fT, path.join(OUT, 'class-noimages.docx'));
  await page.click('[data-in="noImages"]'); await sleep(150);

  /* ---------- 13: שמירה, גיבוי, טעינה ---------- */
  const textsBefore = await page.evaluate(() => JSON.stringify(S.ws.sentences.map(s => [s.text, s.dir && describeDir(s.dir)])));
  await page.reload({ waitUntil: 'load' }); await sleep(300);
  const textsAfter = await page.evaluate(() => JSON.stringify(S.ws.sentences.map(s => [s.text, s.dir && describeDir(s.dir)])));
  ok('13a. רענון משחזר טיוטה והמחשות', textsBefore === textsAfter);
  await click('[data-go="product"]');
  await click('[data-act="backup"]');
  const fJ = await waitFile('הסיפור_שלי_גיבוי.json');
  ok('13b. הורדת קובץ פרויקט', !!fJ); if (fJ) fs.renameSync(fJ, path.join(OUT, 'project.json'));
  const bad = path.join(OUT, 'bad.json'); fs.writeFileSync(bad, JSON.stringify({ hello: 'world' }));
  const inp = await page.$('#loadFile'); await inp.uploadFile(bad); await sleep(500);
  const afterBad = await page.evaluate(() => JSON.stringify(S.ws.sentences.map(s => [s.text, s.dir && describeDir(s.dir)])));
  const loadMsg = await page.$eval('#loadMsg', e => e.innerText);
  ok('13c. קובץ לא מתאים לא דורס את הטיוטה', afterBad === textsBefore && loadMsg.includes('לא קובץ פרויקט'), loadMsg);
  // מחשב "אחר": פרופיל חדש
  const page2 = await (await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] })).newPage();
  const errors2 = []; page2.on('pageerror', e => errors2.push(e.message));
  await page2.goto(URL, { waitUntil: 'load' });
  const emptyBefore = await page2.evaluate(() => S.ws.sentences.every(s => !s.text));
  await page2.click('[data-go="product"]'); await sleep(200);
  const inp2 = await page2.$('#loadFile'); await inp2.uploadFile(path.join(OUT, 'project.json')); await sleep(400);
  await page2.click('[data-m="ok"]'); await sleep(400);
  const restored = await page2.evaluate(() => JSON.stringify(S.ws.sentences.map(s => [s.text, s.dir && describeDir(s.dir)])));
  ok('13d. קובץ פרויקט משחזר טקסט והמחשות במחשב חדש', emptyBefore && restored === textsBefore);
  await page2.browser().close();

  /* ---------- 15: מקלדת, השתקה, צעדים, טאבלט ---------- */
  await click('[data-go="learn"]'); await sleep(200);
  await page.focus('.stage'); await page.keyboard.press('Space'); await sleep(400);
  const kbPlay = await page.evaluate(() => [...Players][0].playing);
  await page.keyboard.press('Space');
  ok('15a. מקלדת: רווח על הבמה מפעיל/עוצר', kbPlay);
  await page.click('#muteBtn'); const muted = await page.evaluate(() => Sound.muted); await page.click('#muteBtn');
  ok('15b. כפתור השתקה פועל', muted === true);
  await page.click('#stepsBtn'); await sleep(200);
  await click('.controls .pp'); await click('.controls .pp');
  const stepInfo = await page.evaluate(() => { const p = [...Players][0]; return { playing: p.playing, label: document.querySelector('.steplabel').innerText, t: p.t }; });
  ok('15c. מצב תמונות לפי צעדים: אין תנועה רציפה, מעבר בין צעדים', !stepInfo.playing && /צעד 2 מתוך/.test(stepInfo.label), stepInfo.label);
  await shot('11-steps-mode');
  await page.click('#stepsBtn');
  await page.setViewport({ width: 820, height: 1180 }); await sleep(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  await shot('12-tablet-learn');
  await click('[data-go="create"]'); await sleep(300); await shot('13-tablet-create');
  ok('15d. טאבלט: בלי גלילה אופקית', !overflow);
  const smallTargets = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.offsetParent && b.getBoundingClientRect().height < 34).map(b => b.innerText.trim()).slice(0, 5));
  ok('15e. כפתורים בגודל נגיעה סביר (≥34px)', smallTargets.length === 0, smallTargets.join(' | '));

  /* ---------- טקסט תלמיד מוצג כטקסט בלבד ---------- */
  await page.setViewport({ width: 1440, height: 950 });
  await click('[data-act="step"][data-s="1"]');
  const sidX = await page.evaluate(() => S.ws.sentences[3].id);
  await page.click('#t_' + sidX, { clickCount: 3 }); await page.keyboard.press('Backspace');
  await page.type('#t_' + sidX, '<b>מודגש?</b> <img src=x onerror=alert(1)> "גרשיים" ו־׳גרש׳');
  const htmlSafe = await page.evaluate(() => { const p = document.querySelector('#paraPrev'); return { txt: p.innerText, tags: p.querySelectorAll('b,img').length }; });
  ok('13e. טקסט תלמיד עם תגיות מוצג כטקסט בלבד', htmlSafe.tags === 0 && htmlSafe.txt.includes('<b>מודגש?</b>'));

  /* ---------- אחסון חסום ---------- */
  const b3 = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
  const p3 = await b3.newPage(); const errors3 = []; p3.on('pageerror', e => errors3.push(e.message));
  await p3.evaluateOnNewDocument(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
  await p3.goto(URL, { waitUntil: 'load' });
  const ban = await p3.$eval('#banner', b => !b.hidden && b.innerText);
  await p3.click('[data-act="toCreate"]'); await sleep(200); await p3.click('[data-act="step"][data-s="1"]'); await sleep(200);
  await p3.type('textarea[data-in="sentText"]', 'אפשר לכתוב גם בלי שמירה');
  const kept = await p3.evaluate(() => S.ws.sentences[0].text);
  ok('13f. אחסון חסום: מוצגת הודעה עם הורדת גיבוי, והעבודה ממשיכה', !!ban && ban.includes('גיבוי') && kept === 'אפשר לכתוב גם בלי שמירה' && errors3.length === 0, errors3.join(';'));
  await b3.close();

  /* ---------- 14, 15: רשת ושגיאות ---------- */
  ok('14. אין בקשות לרשת חיצונית', remote.length === 0, remote.slice(0, 3).join(','));
  ok('15f. אין שגיאות JavaScript', errors.length === 0 && errors2.length === 0, [...errors, ...errors2].slice(0, 3).join(' || '));

  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify({ when: new Date().toISOString(), failed, results }, null, 1));
  console.log(`\n${results.length - failed}/${results.length} passed`);
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
