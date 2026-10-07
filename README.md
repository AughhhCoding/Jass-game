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
- 4 Spieler, Gegenuhrzeigersinn. Wer die Ecken-10 (Schellen-Banner) hat, beginnt die Runde und wählt den Trumpf
- Trumpfwahl mit **Schieben**, dazu **Obenabe**, **Undenufe** und **Slalom** (oben oder unten beginnend: Obenabe und Undenufe wechseln von Stich zu Stich)
- Regeln: Farbe angeben, stechen erlaubt, Untertrumpfen verboten, Bauer/Under muss nicht angegeben werden
- **Weis** (Folgen ab drei Karten, Vierlinge) und **Stöck**
- Letzter Stich +5, **Match** +100
- **Bedanken**: Wer das Ziel erreicht, kann sich mitten in der Runde bedanken und gewinnt sofort. Ein falsches Bedanken verliert das Spiel. Wahlweise bedankst du dich selbst, oder es geschieht automatisch. Die Gegner bedanken sich immer automatisch. Geschrieben wird in der Reihenfolge Stöck, Weis, Stich.
- Optionaler Multiplikator (Ecken/Schellen und Kreuz/Eicheln ×1, Herz/Rosen und Schaufel/Schilten ×2, Obenabe/Undenufe/Slalom ×3), Zielpunkte frei wählbar
- Computer-Spieler mit einfacher Strategie (Trumpf ziehen, schmieren, sichere Stiche)

Zuordnung der Farben: Schaufel ↔ Schilten, Herz ↔ Rosen, Kreuz ↔ Eicheln, Ecken ↔ Schellen.

## Aufbau

| Datei | Inhalt |
| --- | --- |
| `js/rules.js` | Spielregeln als reine Funktionen (Kartenwerte, erlaubte Karten, Stich, Weis, Abrechnung) |
| `js/ai.js` | Computer-Spieler: Trumpfwahl und Kartenwahl |
| `js/game.js` | Spielablauf und Darstellung im Browser |
| `css/style.css` | Gestaltung |
| `tests/` | Tests für Regeln und KI (`npm test`, Node ≥ 18) |
