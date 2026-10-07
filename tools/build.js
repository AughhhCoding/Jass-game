/*
 * Baut das Spiel zu einer einzigen HTML-Datei (CSS und JS eingebettet).
 *   node tools/build.js              → dist/jass.html (vollständiges Dokument)
 *   node tools/build.js --fragment F → nur <title>, <style> und Inhalt, ohne <html>/<head>/<body>
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const args = process.argv.slice(2);
const fragment = args[0] === '--fragment';
const outFile = fragment ? args[1] : path.join(root, 'dist', 'jass.html');

const html = read('index.html');
const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
const body = html.match(/<body>([\s\S]*)<\/body>/)[1]
  .replace(/\s*<script src="[^"]+"><\/script>/g, '')
  .trim();
const css = read('css/style.css') + '\n:root { color-scheme: dark; }\n';
const scripts = ['js/rules.js', 'js/ai.js', 'js/game.js']
  .map(file => `<script>\n${read(file)}</script>`)
  .join('\n');

const content = `${title}\n<style>\n${css}</style>\n${body}\n${scripts}\n`;
const output = fragment
  ? content
  : `<!DOCTYPE html>\n<html lang="de-CH">\n<head>\n<meta charset="utf-8">\n` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">\n${title}\n` +
    `<style>\n${css}</style>\n</head>\n<body>\n${body}\n${scripts}\n</body>\n</html>\n`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, output);
console.log(`${outFile} (${Math.round(output.length / 1024)} KB)`);
