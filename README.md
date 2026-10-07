# Schieber-Jass

Ein Schieber-Jass im Browser: Du spielst zusammen mit deiner Partnerin Vreni gegen die Computer-Gegner Sepp und Fritz.

## Spielen

Öffne einfach `index.html` im Browser. Du brauchst weder Build-Schritt noch Abhängigkeiten.

Für eine eigene Website: `npm run build` erzeugt `dist/jass.html`, das ganze Spiel in einer Datei. Die Datei kannst du auf jeden Webspace hochladen, zum Beispiel GitHub Pages oder Netlify.

Alternativ mit lokalem Webserver:

```bash
npm start
```

## Umfang

- 36 Karten, wahlweise **französisch** (♠ ♥ ♣ ♦) oder **deutschschweizer** (Schellen, Schilten, Rosen, Eicheln)
- 4 Spieler, Gegenuhrzeigersinn. In der ersten Runde beginnt, wer die Ecken-10 (Schellen-Banner) hat, danach geht es im Gegenuhrzeigersinn weiter
- Trumpfwahl mit **Schieben**, dazu **Obenabe**, **Undenufe** und **Slalom** (oben oder unten beginnend: Obenabe und Undenufe wechseln von Stich zu Stich)
- Regeln: Farbe angeben, stechen erlaubt, Untertrumpfen verboten, Bauer/Under muss nicht angegeben werden
- **Weis** (Folgen ab drei Karten, Vierlinge) und **Stöck**
- Letzter Stich +5, **Match** +100
- **Bedanken**: Wer das Ziel erreicht, kann sich mitten in der Runde bedanken und gewinnt sofort. Ein falsches Bedanken verliert das Spiel. Wahlweise bedankst du dich selbst, oder es geschieht automatisch. Die Gegner bedanken sich immer automatisch. Geschrieben wird in der Reihenfolge Stöck, Weis, Stich.
- Optionaler Multiplikator (Ecken/Schellen und Kreuz/Eicheln ×1, Herz/Rosen und Schaufel/Schilten ×2, Obenabe/Undenufe/Slalom ×3), Zielpunkte frei wählbar
- Computer-Spieler mit einfacher Strategie (Trumpf ziehen, schmieren, sichere Stiche)

Zuordnung der Farben: Schaufel ↔ Schilten, Herz ↔ Rosen, Kreuz ↔ Eicheln, Ecken ↔ Schellen.

## Bildkarten

- Französisches Blatt: Bube, Dame und König stammen von [Adrian Kennard](https://www.me.uk/cards/), gemeinfrei (CC0 1.0), übernommen aus dem npm-Paket [@letele/playing-cards](https://github.com/letele/playing-cards). Erzeugt mit `tools/extract-french-faces.mjs` nach `js/faces-fr.js`.
- Deutschschweizer Blatt: Under, Ober und König sind eigene SVG-Zeichnungen (`js/faces-de.js`). Wie auf echten Jasskarten steht das Farbzeichen beim Ober oben und beim Under unten.

## Aufbau

| Datei | Inhalt |
| --- | --- |
| `js/rules.js` | Spielregeln als reine Funktionen (Kartenwerte, erlaubte Karten, Stich, Weis, Abrechnung) |
| `js/ai.js` | Computer-Spieler: Trumpfwahl und Kartenwahl |
| `js/faces-fr.js`, `js/faces-de.js` | Bilder der Bildkarten |
| `js/game.js` | Spielablauf und Darstellung im Browser |
| `css/style.css` | Gestaltung |
| `tests/` | Tests für Regeln und KI (`npm test`, Node ≥ 18) |
