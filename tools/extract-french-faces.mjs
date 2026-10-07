/*
 * Erzeugt js/faces-fr.js aus den CC0-Kartenbildern von Adrian Kennard
 * (npm-Paket @letele/playing-cards). Nur nötig, wenn die Bilder neu erzeugt werden sollen:
 *
 *   npm i --no-save @letele/playing-cards@0.1.0 react@18.3.1 react-dom@18.3.1 @babel/runtime@7.24.7
 *   node tools/extract-french-faces.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as deck from '@letele/playing-cards';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
// Nur der Bildrahmen in der Kartenmitte; Ecken und Rand zeichnet das Spiel selbst.
const FRAME_VIEWBOX = '-82.4 -130.4 164.8 260.8';

const faces = {};
for (const suit of ['S', 'H', 'C', 'D']) {
  for (const [rank, letter] of [['J', 'j'], ['Q', 'q'], ['K', 'k']]) {
    const markup = renderToStaticMarkup(React.createElement(deck[suit + letter]));
    // Nur das äussere <svg> anpassen: Grösse entfernen und auf den Bildrahmen zuschneiden.
    const openTag = markup.slice(0, markup.indexOf('>') + 1);
    const newOpenTag = openTag
      .replace(/ class="[^"]*"/, '')
      .replace(/ (width|height)="[^"]*"/g, '')
      .replace(/ preserveAspectRatio="none"/, '')
      .replace(/ viewBox="[^"]*"/, ` viewBox="${FRAME_VIEWBOX}"`);
    const svg = newOpenTag + markup.slice(openTag.length).replace(/<rect width="239"[^>]*>(<\/rect>)?/, '');
    faces[suit + rank] = svg;
  }
}

const out = `/*
 * Bildkarten (Bube, Dame, König) des französischen Blatts.
 * Quelle: Adrian Kennard, https://www.me.uk/cards/ – gemeinfrei (CC0 1.0),
 * über das npm-Paket @letele/playing-cards. Erzeugt mit tools/extract-french-faces.mjs.
 */
(function (root) {
  'use strict';
  const faces = ${JSON.stringify(faces, null, 1)};
  root.JassFrenchFaces = faces;
})(typeof window !== 'undefined' ? window : globalThis);
`;
fs.writeFileSync(path.join(root, 'js', 'faces-fr.js'), out);
console.log('js/faces-fr.js', Math.round(out.length / 1024), 'KB');
