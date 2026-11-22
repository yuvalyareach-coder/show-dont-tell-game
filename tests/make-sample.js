/* תוצר דוגמה דרך מנגנון הייצוא של המשחק: node tests/make-sample.js
   עובר בממשק על חמשת שלבי הסדנה ומוריד את קובצי ה-Word וקובץ הפרויקט אל samples/ */
const puppeteer = require('puppeteer-core');
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), OUT = path.join(ROOT, 'samples');
fs.mkdirSync(OUT, { recursive: true }); for (const f of fs.readdirSync(OUT)) fs.unlinkSync(path.join(OUT, f));
const URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1440, height: 950 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const cdp = await p.createCDPSession(); await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: OUT });
  await p.goto(URL, { waitUntil: 'load' });
  const c = async s => { await p.waitForSelector(s, { visible: true }); await p.click(s); await sleep(140); };
  const end = async s => { await p.focus(s); await p.keyboard.down('Control'); await p.keyboard.press('End'); await p.keyboard.up('Control'); };
  await c('[data-act="toCreate"]');
  await c('[data-act="char"][data-id="eitan"]'); await c('[data-act="place"][data-v="classroom"]');
  await c('[data-act="prop"][data-v="tower"]'); await c('[data-act="prop"][data-v="book"]'); // מעטפה (ברירת מחדל) יוצאת, נשארים מגדל וספר
  await c('[data-act="feel"][data-v="תסכול"]'); await p.type('#pwant', 'שהמגדל יעמוד עד שהמורה תראה אותו');
  await p.type('#pwhy', 'הוא בנה כל ההפסקה, והשולחן רועד.');
  await c('[data-act="step"][data-s="1"]');
  const draft = "איתן הניח את הקובייה האחרונה בראש המגדל והחזיק את נשימתו.\nהשולחן רעד כשמישהו עבר לידו, והמגדל התנדנד.\nאיתן פרש את כפות ידיו משני צידי המגדל, בלי לגעת.\n'רק עד שהמורה תבוא,' לחש.";
  await p.type('#story', draft);
  await c('[data-act="toReflect"]');
  await p.click('details.marker summary'); await sleep(100);
  const sel = s => p.evaluate(s => { const ta = document.querySelector('#storySrc'); const i = ta.value.indexOf(s); ta.focus(); ta.setSelectionRange(i, i + s.length); }, s);
  await sel('פרש את כפות ידיו משני צידי המגדל'); await c('[data-act="mark"][data-t="feel"]');
  if (!(await p.$eval('details.marker', d => d.open))) await p.click('details.marker summary');
  await sel("'רק עד שהמורה תבוא,'"); await c('[data-act="mark"][data-t="want"]');
  if (!(await p.$eval('details.marker', d => d.open))) await p.click('details.marker summary');
  await sel("'רק עד שהמורה תבוא,'"); await c('[data-act="pasteSel"]'); await p.type('#re', 'הוא רוצה שהמגדל יחזיק מעמד עד שמישהו יראה.');
  await c('[data-act="qnav"][data-d="1"]'); await p.type('#rq', 'החזיק את נשימתו'); await p.type('#re', 'הוא מתוח ומפחד שהמגדל ייפול.');
  await c('[data-act="qnav"][data-d="1"]'); await p.click('[data-in="rnot"]'); await sleep(100);
  await c('[data-act="step"][data-s="3"]'); await c('[data-act="friendGo"]');
  await p.type('#fwho', 'נועה'); await p.type('#fd_feel', 'הוא מתוח, בגלל "החזיק את נשימתו"'); await p.type('#fd_want', 'שהמגדל לא ייפול, בגלל הידיים מסביב');
  await p.type('#fd_wish', 'לא הבנתי למה חשוב לו שהמורה תראה.');
  await c('[data-act="friendDone"]'); await c('[data-act="fbReveal"]'); await p.type('#fbWhy', 'הנשימה העצורה והידיים.');
  await c('[data-act="step"][data-s="4"]');
  await p.evaluate(() => { const t = document.querySelector('#story2'); t.value = t.value.replace("'רק עד שהמורה תבוא,' לחש.", "'רק עד שהמורה תבוא,' לחש. 'אני רוצה שהיא תראה כמה הוא גבוה.'"); t.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.type('#chWhat', 'הוספתי מה הוא אומר על המורה'); await p.type('#chWhy', 'למה חשוב לו שהמגדל יעמוד');
  const fid = await p.evaluate(() => S.ws.feedback[0].id); await c(`[data-act="chRef"][data-v="${fid}"]`);
  await c('[data-act="saveRev"]'); await p.type('#reread', 'עכשיו ברור לי שהוא רוצה להראות למורה.');
  await p.screenshot({ path: path.join(OUT, 'מסך_שכתוב.png'), fullPage: false });
  await c('[data-go="product"]'); await p.type('#ptitle', 'עד שהמורה תבוא'); await p.type('#pauthor', 'כותב מכיתה ד׳');
  await c('[data-act="docClass"]'); await sleep(2500); await c('[data-act="docWriter"]'); await sleep(2500); await c('[data-act="backup"]'); await sleep(1200);
  await c('[data-go="present"]'); await sleep(300); await p.screenshot({ path: path.join(OUT, 'מצב_כיתה.png') });
  console.log(fs.readdirSync(OUT).join('\n'), '\nerrors:', errs.length ? errs : 'none'); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
