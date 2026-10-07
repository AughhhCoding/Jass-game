# Schieber-Jass

Ein Schieber-Jass im Browser: Du spielst zusammen mit deiner Partnerin Vreni gegen die Computer-Gegner Sepp und Fritz.

## Spielen

Öffne einfach `index.html` im Browser. Du brauchst weder Build-Schritt noch Abhängigkeiten.

Alternativ mit lokalem Webserver:

```bash
npm start
```

## Umfang

- 36 Karten (französische Farben ♠ ♥ ♣ ♦), 4 Spieler, Gegenuhrzeigersinn
- Trumpfwahl mit **Schieben**, dazu **Obenabe** und **Undenufe**
- Regeln: Farbe angeben, stechen erlaubt, Untertrumpfen verboten, Bauer muss nicht angegeben werden
- **Weis** (Folgen ab drei Karten, Vierlinge) und **Stöck**
- Letzter Stich +5, **Match** +100
- Optionaler Multiplikator (♦♣ ×1, ♥♠ ×2, Obenabe/Undenufe ×3), Zielpunkte frei wählbar
- Computer-Spieler mit einfacher Strategie (Trumpf ziehen, schmieren, sichere Stiche)

## Aufbau

| Datei | Inhalt |
| --- | --- |
| `js/rules.js` | Spielregeln als reine Funktionen (Kartenwerte, erlaubte Karten, Stich, Weis, Abrechnung) |
| `js/ai.js` | Computer-Spieler: Trumpfwahl und Kartenwahl |
| `js/game.js` | Spielablauf und Darstellung im Browser |
| `css/style.css` | Gestaltung |
| `tests/` | Tests für Regeln und KI (`npm test`, Node ≥ 18) |
