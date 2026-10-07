/*
 * Bildkarten des deutschschweizer Blatts: Under, Ober und König als einfache SVG-Figuren.
 * Wie auf echten Jasskarten steht das Farbzeichen beim Ober oben und beim Under unten.
 */
(function (root) {
  'use strict';

  const INK = '#2b2420';
  const SKIN = '#f2c9a0';
  const HAIR = '#6b4423';
  const GOLD = '#f2c94c';
  const PALETTE = {
    H: { main: '#c0392b', dark: '#7d1f16', trim: GOLD },      // Rosen
    D: { main: '#e0a526', dark: '#8a5a00', trim: '#3d6fb0' }, // Schellen
    S: { main: '#3d3d3d', dark: '#1d1d1d', trim: '#d13b2f' }, // Schilten
    C: { main: '#5d7a2e', dark: '#33461a', trim: '#c98a3b' }, // Eicheln
  };

  // Farbzeichen (ein <svg viewBox="0 0 24 24">) an Position und Grösse setzen.
  const placeIcon = (svg, x, y, size) => svg.replace('<svg ', `<svg x="${x}" y="${y}" width="${size}" height="${size}" `);

  function head(c, extra) {
    return `<rect x="46" y="60" width="8" height="9" fill="${SKIN}"/>` +
      `<circle cx="50" cy="52" r="11" fill="${SKIN}"/>` +
      `<circle cx="46" cy="51" r="1.1" fill="${INK}" stroke="none"/><circle cx="54" cy="51" r="1.1" fill="${INK}" stroke="none"/>` +
      `<path d="M47.5 58 Q50 59.5 52.5 58" fill="none" stroke-width=".9"/>` + extra;
  }

  function arms(c) {
    return `<path d="M30 73 Q20 82 22 104 L29 104 Q29 88 34 80 Z" fill="${c.main}"/>` +
      `<path d="M70 73 Q80 82 78 104 L71 104 Q71 88 66 80 Z" fill="${c.main}"/>` +
      `<circle cx="25.5" cy="107" r="3.6" fill="${SKIN}"/><circle cx="74.5" cy="107" r="3.6" fill="${SKIN}"/>`;
  }

  function legs(c, spread) {
    const l = 38 - spread;
    const r = 53 + spread;
    return `<path d="M${l} 124 L${l - 1} 146 L${l + 8} 146 L${l + 9} 124 Z" fill="${c.dark}"/>` +
      `<path d="M${r} 124 L${r + 1} 146 L${r + 10} 146 L${r + 9} 124 Z" fill="${c.dark}"/>` +
      `<path d="M${l - 4} 146 h13 v4 h-15 z" fill="${INK}"/>` +
      `<path d="M${r} 146 h13 l2 4 h-15 z" fill="${INK}"/>`;
  }

  function king(c) {
    const ermineDots = [36, 43, 50, 57, 64].map(x => `<circle cx="${x}" cy="${x === 50 ? 76 : 73}" r=".9" fill="${INK}" stroke="none"/>`).join('');
    return `<path d="M28 72 Q50 64 72 72 L80 148 L20 148 Z" fill="${c.main}"/>` +
      `<path d="M50 78 V148" stroke="${c.trim}" stroke-width="4"/>` +
      `<path d="M21 140 H79" stroke="${GOLD}" stroke-width="3"/>` +
      arms(c) +
      `<path d="M30 70 Q50 84 70 70 L68 65 Q50 75 32 65 Z" fill="#fff"/>` + ermineDots +
      head(c,
        `<path d="M39 52 Q39 74 50 74 Q61 74 61 52 Q57 61 50 61 Q43 61 39 52 Z" fill="${HAIR}"/>` +
        `<path d="M37 44 L37 30 L43 37 L50 26 L57 37 L63 30 L63 44 Z" fill="${GOLD}"/>` +
        `<circle cx="50" cy="38" r="2.2" fill="#c62828"/>`) +
      `<path d="M75 104 L80 62" stroke="${INK}" stroke-width="4.5"/>` +
      `<path d="M75 104 L80 62" stroke="${GOLD}" stroke-width="2.5"/>` +
      `<circle cx="80.3" cy="59" r="3.5" fill="${GOLD}"/>` +
      '';
  }

  function ober(c) {
    return legs(c, 0) +
      `<path d="M30 72 Q50 66 70 72 L74 126 L26 126 Z" fill="${c.main}"/>` +
      `<path d="M33 75 L71 119" stroke="${c.trim}" stroke-width="5"/>` +
      `<rect x="27" y="104" width="46" height="5" fill="${c.dark}"/>` +
      `<path d="M75 104 L86 64" stroke="${INK}" stroke-width="3.6"/>` +
      `<path d="M75 104 L86 64" stroke="#d9dde2" stroke-width="2"/>` +
      `<path d="M69 98 L82 102" stroke="${INK}" stroke-width="3"/>` +
      arms(c) +
      head(c,
        `<path d="M45 57.2 Q50 54 55 57.2 Q50 56.2 45 57.2 Z" fill="${HAIR}" stroke="none"/>` +
        `<path d="M58 34 Q73 22 72 10 Q67 23 55 31 Z" fill="${c.trim}"/>` +
        `<path d="M40 43 Q41 31 50 31 Q59 31 60 43 Z" fill="${c.dark}"/>` +
        `<ellipse cx="50" cy="43" rx="18" ry="4" fill="${c.dark}"/>`) +
      '';
  }

  function under(c) {
    return legs(c, 8) +
      `<path d="M30 72 Q50 66 70 72 L73 126 L27 126 Z" fill="${c.main}"/>` +
      `<path d="M31 72 Q50 80 69 72" fill="none" stroke="${c.trim}" stroke-width="3"/>` +
      `<rect x="28" y="106" width="44" height="5" fill="${c.dark}"/>` +
      arms(c) +
      head(c,
        `<path d="M39 50 Q38 40 50 39 Q62 40 61 50 Q60 44 50 44 Q40 44 39 50 Z" fill="${HAIR}"/>` +
        `<path d="M38 44 Q37 33 50 33 Q64 33 64 44 Q50 39 38 44 Z" fill="${c.trim}"/>` +
        `<circle cx="51" cy="32" r="2.4" fill="${c.trim}"/>`) +
      '';
  }

  const FIGURES = { J: under, Q: ober, K: king };
  // Farbzeichen: beim Ober oben, beim Under unten, beim König in der Hand.
  const ICON_PLACE = { J: [38, 131, 24], Q: [20, 0, 24], K: [5, 96, 28] };

  // Liefert das Bild (SVG, Seitenverhältnis wie der Bildrahmen der französischen Karten).
  function germanFace(suit, rank, iconSvg) {
    const c = PALETTE[suit];
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 158" aria-hidden="true">` +
      `<rect x="1" y="1" width="98" height="156" rx="4" fill="#f7f0e1" stroke="${INK}" stroke-width="1"/>` +
      `<g stroke="${INK}" stroke-width="1.2" stroke-linejoin="round" transform="translate(50 88) scale(1.12) translate(-50 -88)">` +
      `${FIGURES[rank](c)}</g>${placeIcon(iconSvg, ...ICON_PLACE[rank])}</svg>`;
  }

  root.JassGermanFaces = { germanFace };
})(typeof window !== 'undefined' ? window : globalThis);
