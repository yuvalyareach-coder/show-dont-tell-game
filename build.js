// בניית קובץ יחיד: node build.js  ->  index.html (כל הקוד, הסגנונות וה-SVG מוטמעים)
const fs = require('fs'), path = require('path');
const src = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8').replace(/^﻿/, '');
const js = ['engine.js', 'scenes.js', 'data.js', 'illus.js', 'docx.js', 'app.js'].map(f => `/* ---- ${f} ---- */\n` + src(f)).join('\n');
if (js.includes('</script')) throw new Error('script terminator inside JS');
const out = src('shell.html').replace('/*CSS*/', () => src('styles.css')).replace('/*JS*/', () => js);
fs.writeFileSync(path.join(__dirname, 'index.html'), out, 'utf8');
console.log('index.html', (out.length / 1024).toFixed(1) + ' KB');
