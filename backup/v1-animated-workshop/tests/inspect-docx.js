/* בדיקת מבנה DOCX: node tests/inspect-docx.js file.docx [מילים-אסורות...] */
const fs = require('fs'), zlib = require('zlib');
const [file, ...banned] = process.argv.slice(2);
const buf = fs.readFileSync(file);
const files = {}; let p = 0;
while (buf.readUInt32LE(p) === 0x04034b50) {
  const method = buf.readUInt16LE(p + 8), csize = buf.readUInt32LE(p + 18), nlen = buf.readUInt16LE(p + 26), xlen = buf.readUInt16LE(p + 28);
  const name = buf.slice(p + 30, p + 30 + nlen).toString('utf8'); const data = buf.slice(p + 30 + nlen + xlen, p + 30 + nlen + xlen + csize);
  files[name] = method === 0 ? data : zlib.inflateRawSync(data); p += 30 + nlen + xlen + csize;
}
const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
const names = Object.keys(files);
const need = ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/_rels/document.xml.rels', 'word/styles.xml', 'docProps/core.xml'];
const doc = files['word/document.xml'].toString('utf8');
const allText = names.filter(n => !n.endsWith('.png')).map(n => files[n].toString('utf8')).join('\n');
const pngs = names.filter(n => n.endsWith('.png'));
const pngInfo = pngs.map(n => { const b = files[n]; return n + ' ' + b.readUInt32BE(16) + 'x' + b.readUInt32BE(20) + ' ' + (b.length / 1024).toFixed(0) + 'KB sig=' + (b.slice(1, 4).toString() === 'PNG'); });
const texts = [...doc.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(m => m[1]).join('|');
const out = {
  file, entries: names.length, hasEOCD: eocd > 0, required: need.every(n => names.includes(n)),
  rtlParas: (doc.match(/<w:bidi\/>/g) || []).length, paras: (doc.match(/<w:p>/g) || []).length, rtlRuns: (doc.match(/<w:rtl\/>/g) || []).length,
  a4: /w:w="11906" w:h="16838"/.test(doc), arial: /w:cs="Arial"/.test(doc), images: pngInfo, drawingRefs: (doc.match(/r:embed=/g) || []).length,
  banned: banned.filter(b => allText.includes(b)), text: texts.slice(0, 600)
};
console.log(JSON.stringify(out, null, 1));
