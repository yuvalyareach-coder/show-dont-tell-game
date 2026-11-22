/* יצירת תוצר דוגמה דרך מנגנון הייצוא של המשחק: node tests/make-sample.js
   בונה סיפור דרך ממשק הסדנה (לחיצות אמיתיות) ומוריד את קובצי ה-Word וקובץ הפרויקט אל samples/ */
const puppeteer = require('puppeteer-core');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'samples');
fs.mkdirSync(OUT, { recursive: true });
for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));
const URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1440, height: 950 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const cdp = await p.createCDPSession(); await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: OUT });
  await p.goto(URL, { waitUntil: 'load' });
  const c = async s => { await p.waitForSelector(s, { visible: true }); await p.click(s); await sleep(140); };
  await c('[data-act="toCreate"]');
  await c('[data-act="char"][data-id="noa"]'); await c('[data-act="place"][data-v="classroom"]'); await c('[data-act="prop"][data-v="box"]');
  await c('[data-act="sit"][data-v="מוצאים משהו בתוך קופסה"]');
  await c('[data-act="emo"][data-v="הפתעה"]'); await c('[data-act="emo"][data-v="סקרנות"]');
  await p.type('#why', 'מישהו השאיר לה קופסה בלי לחתום, והיא לא יודעת מי.');
  await c('[data-act="step"][data-s="1"]');
  await c('[data-act="addSent"]'); await c('[data-act="addSent"]');
  const ids = await p.evaluate(() => S.ws.sentences.map(s => s.id));
  const T = ['נועה נכנסה לכיתה הריקה והתקדמה אל השולחן בצעדים קטנים.', "על השולחן חיכתה קופסה, ועליה פתק: 'לנועה'.", 'היא שלחה יד, עצרה, ואז פתחה את המכסה.', "'מי השאיר את זה?' לחשה, והצמידה את הקופסה אל החזה.", 'אחר כך הביטה לרגע אל הדלת.'];
  for (let i = 0; i < 5; i++) await p.type('#t_' + ids[i], T[i]);
  await c('[data-act="step"][data-s="2"]');
  const dir = async (id, fn) => { await c(`[data-act="edit"][data-id="${id}"]`); await fn(); await c('[data-act="confirm"]'); };
  await dir(ids[0], async () => { await c('[data-act="dAct"][data-v="hesitant"]'); });
  await dir(ids[1], async () => { await c('[data-act="dAct"][data-v="lookProp"]'); await c('[data-act="dFace"][data-k="brows"][data-v="up"]'); await c('[data-act="dPause"][data-v="beforeAction"]'); });
  await dir(ids[2], async () => { await c('[data-act="dAct"][data-v="reachStop"]'); await c('[data-act="dAct"][data-v="openBox"]'); await c('[data-act="dFace"][data-k="eyes"][data-v="wide"]'); });
  await dir(ids[3], async () => { await c('[data-act="spQuote"][data-j="0"]'); await c('[data-act="spVol"][data-v="quiet"]'); await c('[data-act="spWhen"][data-v="before"]'); await c('[data-act="dAct"][data-v="hug"]'); await c('[data-act="dFace"][data-k="mouth"][data-v="smallSmile"]'); });
  // משפט 5 נשאר בלי המחשה — כדי להראות שהוא מופיע בוורד כרגיל
  await c('[data-go="product"]');
  await p.type('#ptitle', 'קופסה על השולחן'); await p.type('#pauthor', 'כותבת מכיתה ד׳');
  const cands = await p.$$eval('[data-act="img"]', bs => bs.map(x => x.dataset.sid + '|' + x.dataset.kind));
  const want = [ids[1] + '|end', ids[2] + '|end', ids[3] + '|speech'];
  for (const w of want) if (cands.includes(w)) { const [sid, kind] = w.split('|'); await c(`[data-act="img"][data-sid="${sid}"][data-kind="${kind}"]`); }
  await p.screenshot({ path: path.join(OUT, 'מסך_התוצר.png') });
  await c('[data-act="docClass"]'); await sleep(2500);
  await c('[data-act="docWriter"]'); await sleep(2500);
  await c('[data-act="backup"]'); await sleep(1200);
  await c('[data-go="present"]'); await sleep(200); await c('[data-act="playAll"]'); await sleep(9000);
  await p.screenshot({ path: path.join(OUT, 'מצב_כיתה.png') });
  console.log(fs.readdirSync(OUT).join('\n'), '\nerrors:', errs.length ? errs : 'none');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
