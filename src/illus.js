'use strict';
/* =====================================================================
   איור סטטי לסדנה. מקבל רק: דמות, מקום, חפצים (1–2).
   לא מחובר למנוע התזמון, לא מקבל טקסט, רגשות, רצון או הוראות במה.
   ===================================================================== */
const PLACES = {
  room: {
    name: 'חדר', surf: { name: 'שולחן', y: 300, slots: [522, 604] }, floor: [384],
    bg: () => D.wall('#fff1d6', '#fde2b8') + D.window(60, 80, 120, 100) + D.floor('#d9a066', '#c48a52') + D.plant(745) + D.table(470, 650, 300, '#b5835a')
  },
  corridor: {
    name: 'מסדרון עם דלת', surf: { name: 'מדף', y: 300, slots: [375] }, floor: [492, 548],
    bg: () => D.wall('#e3ecfa', '#cfdcf2') + `<rect x="0" y="120" width="${W}" height="10" fill="#b9c8e3"/>` + D.door(600, 160, 100, '#9c6644') + D.handle(614, 272) + D.floor('#b8c4d6', '#a3b1c7') + D.shelf(330, 420, 300, '#c8a27a')
  },
  classroom: {
    name: 'כיתה עם שולחן', surf: { name: 'שולחן', y: 300, slots: [496, 590] }, floor: [372],
    bg: () => D.wall('#f1f7ee', '#dfeadb') + D.board(60, 60, 250, 130) + D.window(600, 70, 140, 100) + D.floor('#c9b18f', '#b49a76') + D.table(440, 640, 300, '#d4a373')
  },
  garden: {
    name: 'גינה עם ספסל', surf: { name: 'ספסל', y: 322, slots: [482, 586] }, floor: [372],
    bg: () => `<rect x="0" y="0" width="${W}" height="${GROUND}" fill="#d7f0fb"/><circle cx="90" cy="60" r="26" fill="#ffe27a"/>` + D.tree(720) + `<rect x="0" y="${GROUND - 4}" width="${W}" height="${H - GROUND + 4}" fill="#8fd18a"/>` + D.bench(420, 640, 322, '#b07d4f')
  }
};
const CHAR_X = 250;

/* מיקום החפצים: כדור מעדיף רצפה; שאר החפצים על המשטח, ואם אין מקום — על הרצפה */
function placeProps(placeId, props) {
  const P = PLACES[placeId] || PLACES.room, surf = [...P.surf.slots], floor = [...P.floor], out = [];
  const order = [...props].sort((a, b) => (a === 'ball') - (b === 'ball'));
  for (const k of order) {
    let spot = null;
    if (k === 'ball' && floor.length) spot = { x: floor.shift(), y: GROUND + 4, on: 'floor' };
    else if (surf.length) spot = { x: surf.shift(), y: P.surf.y, on: 'surf' };
    else if (floor.length) spot = { x: floor.shift(), y: GROUND + 4, on: 'floor' };
    if (spot) out.push(Object.assign({ kind: k }, spot));
  }
  return out;
}
function drawPropStatic(kind, x, y) {
  let o = '';
  if (kind === 'envelope') o = D.envelope(x, y - 21, 0, 0, 1.05);
  else if (kind === 'book') o = D.book(x, y - 22, 0);
  else if (kind === 'box') o = D.box(x, y) + D.lid(x, y - 39, 0);
  else if (kind === 'ticket') o = D.ticket(x, y - 16, 0, 0, 1.25, '#ffbe0b');
  else if (kind === 'ball') o = D.ball(x, y - 17);
  else if (kind === 'tower') for (let i = 0; i < 4; i++) o += D.block(x, y - 14 - i * 28, 0, BLOCK_COLORS[i]);
  return `<g data-prop="${kind}">${o}</g>`;
}
function illusInner(sel) {
  const P = PLACES[sel.place] || PLACES.room;
  const s = charBase(CHAR_X); s['c.turn'] = .15;
  let o = P.bg();
  o += `<g data-char="${esc(sel.charId)}">${drawChar(s, CHARS[sel.charId] || CHARS.noa)}</g>`;
  for (const p of placeProps(sel.place, sel.props || [])) o += drawPropStatic(p.kind, p.x, p.y);
  return o;
}
function illusSVG(sel, w, h, extra) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${w || W}" height="${h || H}" ${extra || ''}>${illusInner(sel)}</svg>`;
}
