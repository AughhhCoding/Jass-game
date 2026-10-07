/*
 * Spielablauf und Darstellung im Browser.
 * Spieler 0 = Du (unten), 1 = rechts, 2 = Partner (oben), 3 = links – Gegenuhrzeigersinn.
 */
(function () {
  'use strict';

  const R = window.JassRules;
  const AI = window.JassAI;
  const NAMES = ['Du', 'Sepp', 'Vreni', 'Fritz'];
  const TEAM_NAMES = ['Wir', 'Sie'];
  const HUMAN = 0;
  const $ = id => document.getElementById(id);

  const settings = { target: 1000, multipliers: true, speed: 1, deck: 'fr', bedanken: 'manual' };
  let game = null;
  const shownTrickCards = new Set(); // nur neu gespielte Karten im Stich einblenden

  // Farbzeichen des deutschschweizer Blatts als kleine SVG-Grafiken.
  const ROSE_PETALS = [[12, 7], [16.8, 10.5], [14.9, 16.1], [9.1, 16.1], [7.2, 10.5]]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4"/>`).join('');
  const GERMAN_SUIT_SVG = {
    D: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V2.5" stroke="#7a5300" stroke-width="1.8"/>' +
      '<circle cx="12" cy="13" r="8" fill="#e5ab2a" stroke="#7a5300" stroke-width="1.2"/>' +
      '<path d="M4.6 10.5h14.8" stroke="#7a5300" stroke-width="1.2"/>' +
      '<path d="M12 15v6" stroke="#5a3d00" stroke-width="1.2"/><circle cx="12" cy="15.5" r="1.8" fill="#5a3d00"/></svg>',
    H: `<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="#d23a3a" stroke="#8b1a1a" stroke-width=".8">${ROSE_PETALS}</g>` +
      '<circle cx="12" cy="12" r="3.2" fill="#f2c94c" stroke="#8b6b00" stroke-width=".8"/></svg>',
    S: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h16v8c0 5-4 8.5-8 10-4-1.5-8-5-8-10z" fill="#f2c94c"/>' +
      '<path d="M4 3h16v5H4z" fill="#c62828"/><path d="M12 8v13" stroke="#2b2b2b" stroke-width="1.2"/>' +
      '<path d="M4 3h16v8c0 5-4 8.5-8 10-4-1.5-8-5-8-10z" fill="none" stroke="#2b2b2b" stroke-width="1.3"/></svg>',
    C: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6V2" stroke="#4a3210" stroke-width="1.6"/>' +
      '<ellipse cx="12" cy="15" rx="5.2" ry="6.8" fill="#c98a3b" stroke="#6b4210" stroke-width="1"/>' +
      '<path d="M5.8 12.5C6.5 5 17.5 5 18.2 12.5z" fill="#6b8a33" stroke="#33461a" stroke-width="1"/>' +
      '<path d="M8 9.5h8M7 11.3h10" stroke="#33461a" stroke-width=".6"/></svg>',
  };

  // ---------- Hilfsfunktionen ----------

  // Wartet; bricht still ab (löst nie auf), wenn das Spiel inzwischen beendet oder neu gestartet wurde.
  function delay(ms) {
    const token = game.token;
    return new Promise(resolve => setTimeout(() => {
      if (game.token === token) resolve();
    }, ms / settings.speed));
  }

  function log(text) {
    const li = document.createElement('li');
    li.textContent = text;
    $('log').prepend(li);
  }

  function bubble(player, text) {
    const el = $(`bubble-${player}`);
    el.textContent = text;
    el.classList.add('visible');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('visible'), 1800 / settings.speed);
  }

  function who(player, du, er) {
    return player === HUMAN ? `Du ${du}` : `${NAMES[player]} ${er}`;
  }

  const isRedSuit = suit => settings.deck === 'fr' && (suit === 'H' || suit === 'D');

  function suitIcon(suit) {
    if (settings.deck === 'de') return `<span class="suit-svg">${GERMAN_SUIT_SVG[suit]}</span>`;
    return `<span class="suit-sym">${R.suitSymbol(suit)}</span>`;
  }

  function modeHtml(mode) {
    if (mode.type === 'trump') return `${suitIcon(mode.suit)} ${R.suitName(mode.suit)}`;
    return R.modeLabel(mode);
  }

  const arrow = mode => (mode.type === 'obe' ? '↓' : '↑');

  function cardEl(card, mode) {
    const el = document.createElement('div');
    const label = R.rankLabel(card.rank);
    const icon = suitIcon(card.suit);
    el.className = `card deck-${settings.deck} suit-${card.suit}` +
      (isRedSuit(card.suit) ? ' red' : '') +
      (mode && R.isTrump(card, mode) ? ' trump' : '');
    el.setAttribute('aria-label', `${R.suitName(card.suit)} ${R.rankName(card.rank)}`);
    const art = faceArt(card);
    if (art) el.classList.add('face');
    el.innerHTML =
      `<span class="corner tl">${label}<br>${icon}</span>` +
      (art ? `<span class="face-art">${art}</span>` : `<span class="pip">${icon}</span>`) +
      `<span class="corner br">${label}<br>${icon}</span>`;
    return el;
  }

  // Bild für Bube/Dame/König bzw. Under/Ober/König, sonst null.
  function faceArt(card) {
    if (!['J', 'Q', 'K'].includes(card.rank)) return null;
    if (settings.deck === 'de') {
      return window.JassGermanFaces ? window.JassGermanFaces.germanFace(card.suit, card.rank, GERMAN_SUIT_SVG[card.suit]) : null;
    }
    return (window.JassFrenchFaces && window.JassFrenchFaces[card.id]) || null;
  }

  function backEl() {
    const el = document.createElement('div');
    el.className = `card back deck-${settings.deck}`;
    return el;
  }

  // Punkte eines Teams inklusive allem, was in dieser Runde schon geschrieben ist.
  function livePoints(team) {
    const g = game;
    if (!g.mode || g.roundScored) return g.scores[team];
    let points = g.cardPoints[team];
    if (g.tricksPlayed === 9 && g.lastTrickTeam === team) {
      points += R.LAST_TRICK_BONUS;
      if (g.tricks[team] === 9) points += R.MATCH_BONUS;
    }
    if (g.weisResult && g.weisResult.team === team) points += g.weisResult.points;
    if (g.stoeckTeam === team) points += R.STOECK_POINTS;
    return g.scores[team] + points * g.multiplier;
  }

  // ---------- Darstellung ----------

  function render() {
    const g = game;
    $('score-0').textContent = g.scores[0];
    $('score-1').textContent = g.scores[1];
    $('target').textContent = settings.target;

    const modeEl = $('mode-display');
    if (g.mode) {
      let html = modeHtml(g.mode);
      if (settings.multipliers) html += ` ×${R.modeMultiplier(g.mode)}`;
      if (g.mode.type === 'slalom') {
        const now = R.trickMode(g.mode, g.trickIndex);
        html += ` <span class="mode-now">· ${arrow(now)} ${R.modeLabel(now)}</span>`;
      }
      modeEl.innerHTML = html;
    } else {
      modeEl.textContent = 'Kein Trumpf';
    }
    modeEl.classList.toggle('red', !!g.mode && g.mode.type === 'trump' && isRedSuit(g.mode.suit));

    const canBedanken = settings.bedanken === 'manual' && !!g.mode && !g.roundScored && !g.over;
    $('btn-bedanken').classList.toggle('hidden', !canBedanken);

    for (let p = 0; p < 4; p++) {
      const seat = $(`seat-${p}`);
      seat.classList.toggle('active', g.current === p);
      const label = p === g.chooser && g.mode ? ' ★' : '';
      seat.querySelector('.player-name').textContent = `${NAMES[p]}${p === 2 ? ' (Partnerin)' : ''}${label}`;
      const handEl = $(`hand-${p}`);
      handEl.innerHTML = '';
      if (p === HUMAN) {
        for (const card of g.hands[p]) {
          const el = cardEl(card, g.mode);
          if (g.pendingCard) {
            const legal = g.legal.some(c => c.id === card.id);
            el.classList.add(legal ? 'playable' : 'disabled');
            if (legal) {
              el.tabIndex = 0;
              el.addEventListener('click', () => playHumanCard(card));
              el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') playHumanCard(card); });
            }
          }
          handEl.appendChild(el);
        }
      } else {
        for (let i = 0; i < g.hands[p].length; i++) handEl.appendChild(backEl());
      }
    }

    const trickEl = $('trick');
    trickEl.innerHTML = '';
    if (!g.trick.length) shownTrickCards.clear();
    for (const play of g.trick) {
      const el = cardEl(play.card, g.mode);
      el.classList.add('trick-card', `pos-${play.player}`);
      if (!shownTrickCards.has(play.card.id)) {
        el.classList.add('fresh');
        shownTrickCards.add(play.card.id);
      }
      if (g.trickWinner === play.player) el.classList.add('winner');
      trickEl.appendChild(el);
    }

    const lastEl = $('last-trick');
    if (g.lastTrick) {
      lastEl.innerHTML = '';
      for (const play of g.lastTrick.cards) {
        const el = cardEl(play.card, g.mode);
        el.classList.add('mini');
        if (play.player === g.lastTrick.winner) el.classList.add('winner');
        el.title = NAMES[play.player];
        lastEl.appendChild(el);
      }
      const caption = document.createElement('div');
      caption.className = 'muted caption';
      caption.textContent = `Stich an ${NAMES[g.lastTrick.winner]}`;
      lastEl.appendChild(caption);
    } else {
      lastEl.innerHTML = '<span class="muted">Noch kein Stich</span>';
    }

    $('round-info').innerHTML = g.mode
      ? `Runde ${g.round} · Stiche ${g.tricks[0]} : ${g.tricks[1]}<br>` +
        `Stichpunkte <b>${g.cardPoints[0]}</b> : <b>${g.cardPoints[1]}</b>` +
        (g.weisResult ? `<br>Weis: ${TEAM_NAMES[g.weisResult.team]} (${g.weisResult.points})` : '') +
        (g.stoeckTeam >= 0 ? `<br>Stöck: ${TEAM_NAMES[g.stoeckTeam]}` : '')
      : (g.round ? `Runde ${g.round} · Trumpfwahl` : '–');

    $('status').textContent = g.pendingCard ? 'Du bist am Zug – wähle eine Karte.' : '';
  }

  // ---------- Dialoge ----------

  function openDialog(html) {
    $('dialog').innerHTML = html;
    $('overlay').classList.remove('hidden');
    return $('dialog');
  }

  function closeDialog() {
    $('overlay').classList.add('hidden');
    $('dialog').innerHTML = '';
  }

  function multiplierText(deckStyle) {
    const names = R.DECKS[deckStyle].suitName;
    return `${names.D}/${names.C} ×1, ${names.H}/${names.S} ×2, Obenabe/Undenufe/Slalom ×3`;
  }

  function showStartDialog() {
    const option = (value, text, current) =>
      `<option value="${value}"${String(value) === String(current) ? ' selected' : ''}>${text}</option>`;
    const dlg = openDialog(`
      <h2>Schieber-Jass</h2>
      <p>Du spielst mit Vreni gegen Sepp und Fritz.</p>
      <label class="field">Karten
        <select id="opt-deck">
          ${option('fr', 'Französisch (♠ ♥ ♣ ♦)', settings.deck)}
          ${option('de', 'Deutschschweizer (Schellen, Rosen …)', settings.deck)}
        </select>
      </label>
      <label class="field">Zielpunkte
        <select id="opt-target">
          ${[1000, 1500, 2500, 3000].map(t => option(t, t, settings.target)).join('')}
        </select>
      </label>
      <label class="field">Bedanken
        <select id="opt-bedanken">
          ${option('manual', 'Selber bedanken', settings.bedanken)}
          ${option('auto', 'Automatisch', settings.bedanken)}
        </select>
      </label>
      <label class="field">Tempo
        <select id="opt-speed">
          ${option(0.6, 'Gemütlich', settings.speed)}
          ${option(1, 'Normal', settings.speed)}
          ${option(2, 'Schnell', settings.speed)}
        </select>
      </label>
      <label class="field checkbox">
        <input type="checkbox" id="opt-mult"${settings.multipliers ? ' checked' : ''}>
        <span>Multiplikator (<span id="mult-text">${multiplierText(settings.deck)}</span>)</span>
      </label>
      <div class="actions"><button class="btn" id="btn-start">Spiel starten</button></div>
    `);
    dlg.querySelector('#opt-deck').addEventListener('change', e => {
      dlg.querySelector('#mult-text').textContent = multiplierText(e.target.value);
    });
    dlg.querySelector('#btn-start').addEventListener('click', () => {
      settings.deck = dlg.querySelector('#opt-deck').value;
      settings.target = Number(dlg.querySelector('#opt-target').value);
      settings.bedanken = dlg.querySelector('#opt-bedanken').value;
      settings.speed = Number(dlg.querySelector('#opt-speed').value);
      settings.multipliers = dlg.querySelector('#opt-mult').checked;
      closeDialog();
      newGame();
    });
  }

  function askHumanMode(canPush) {
    return new Promise(resolve => {
      const panel = $('center-panel');
      const mult = mode => (settings.multipliers ? `<small>×${R.modeMultiplier(mode)}</small>` : '');
      const buttons = R.ALL_MODES.map((mode, i) => {
        const red = mode.type === 'trump' && isRedSuit(mode.suit);
        const hint = mode.type === 'slalom'
          ? `<small class="hint">${mode.start === 'obe' ? '↓ ↑ ↓ …' : '↑ ↓ ↑ …'}</small>`
          : '';
        return `<button class="btn mode-btn${red ? ' red' : ''}" data-mode="${i}">${modeHtml(mode)} ${mult(mode)}${hint}</button>`;
      }).join('');
      panel.innerHTML = `
        <h3>${canPush ? 'Was spielst du?' : 'Vreni hat geschoben – du musst wählen!'}</h3>
        <div class="mode-grid">${buttons}</div>
        ${canPush ? '<button class="btn btn-ghost push-btn" data-push="1">Schieben ↷</button>' : ''}`;
      panel.classList.remove('hidden');
      panel.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
        panel.classList.add('hidden');
        panel.innerHTML = '';
        resolve(btn.dataset.push ? { push: true } : R.ALL_MODES[Number(btn.dataset.mode)]);
      }));
    });
  }

  function showRoundSummary(result) {
    const g = game;
    const row = (label, values, cls = '') =>
      `<tr class="${cls}"><td>${label}</td><td>${values[0]}</td><td>${values[1]}</td></tr>`;
    const lines = [
      row('Stichpunkte (inkl. letzter Stich)', result.base.map((b, t) => b - (result.match === t ? R.MATCH_BONUS : 0))),
    ];
    if (result.match >= 0) lines.push(row('Match-Bonus', [0, 1].map(t => (t === result.match ? R.MATCH_BONUS : 0))));
    if (result.multiplier > 1) lines.push(row(`× ${result.multiplier}`, result.cards));
    if (result.weis.some(Boolean)) lines.push(row('Weis', result.weis));
    if (result.stoeck.some(Boolean)) lines.push(row('Stöck', result.stoeck));
    lines.push(row('Total Runde', result.total, 'total'));
    lines.push(row('Gesamtstand', g.scores, 'grand'));

    const matchText = result.match >= 0
      ? `<p class="highlight">${result.match === 0 ? 'Match für uns! 🎉' : 'Die Gegner machen einen Match.'}</p>`
      : '';
    return new Promise(resolve => {
      const dlg = openDialog(`
        <h2>Runde ${g.round}: ${modeHtml(g.mode)}</h2>
        ${matchText}
        <table class="summary">
          <thead><tr><th></th><th>Wir</th><th>Sie</th></tr></thead>
          <tbody>${lines.join('')}</tbody>
        </table>
        <div class="actions"><button class="btn" id="btn-next">Weiter</button></div>
      `);
      dlg.querySelector('#btn-next').addEventListener('click', () => { closeDialog(); resolve(); });
      dlg.querySelector('#btn-next').focus();
    });
  }

  // Beendet das Spiel sofort – auch mitten in einer Runde (beim Bedanken).
  function endGame(winner, reason) {
    const g = game;
    if (g.over) return;
    g.over = true;
    g.token = Symbol('ended');
    g.pendingCard = null;
    g.legal = [];
    g.current = null;
    $('center-panel').classList.add('hidden');
    const scores = [livePoints(0), livePoints(1)];
    log(`Spielende: ${TEAM_NAMES[winner]} gewinnen. ${reason}`);
    render();
    setTimeout(() => {
      if (game !== g) return;
      const dlg = openDialog(`
        <h2>${winner === 0 ? 'Gewonnen! 🏆' : 'Verloren'}</h2>
        <p>${reason}</p>
        <p class="final-score">Wir <b>${scores[0]}</b> : <b>${scores[1]}</b> Sie</p>
        <div class="actions"><button class="btn" id="btn-again">Nochmals spielen</button></div>
      `);
      dlg.querySelector('#btn-again').addEventListener('click', () => { closeDialog(); showStartDialog(); });
    }, 900);
  }

  // Nach jedem Punktgewinn: Hat sich ein Computer-Team bedankt?
  function checkBedanken(team) {
    const g = game;
    if (g.over) return;
    if (team === 0 && settings.bedanken !== 'auto') return;
    const points = livePoints(team);
    if (points < settings.target) return;
    const speaker = team === 0 ? 2 : 1;
    bubble(speaker, 'Bedanke mich!');
    log(`${NAMES[speaker]} bedankt sich mit ${points} Punkten.`);
    endGame(team, team === 0
      ? `Vreni hat sich mit ${points} Punkten bedankt.`
      : `${NAMES[speaker]} hat sich mit ${points} Punkten bedankt.`);
  }

  function humanBedanken() {
    const g = game;
    if (!g.mode || g.roundScored || g.over) return;
    const points = livePoints(0);
    bubble(HUMAN, 'Bedanke mich!');
    log(`Du bedankst dich mit ${points} Punkten.`);
    if (points >= settings.target) {
      endGame(0, `Du hast dich mit ${points} Punkten richtig bedankt.`);
    } else {
      endGame(1, `Falsch bedankt: Wir hatten erst ${points} von ${settings.target} Punkten. Das Spiel geht an die Gegner.`);
    }
  }

  // ---------- Spielablauf ----------

  function newGame() {
    R.setDeckStyle(settings.deck);
    game = {
      token: Symbol('game'),
      over: false,
      scores: [0, 0],
      round: 0,
      starter: 0,
      hands: [[], [], [], []],
      mode: null,
      multiplier: 1,
      chooser: null,
      trick: [],
      trickIndex: 0,
      trickWinner: null,
      played: [],
      lastTrick: null,
      tricks: [0, 0],
      tricksPlayed: 0,
      lastTrickTeam: -1,
      cardPoints: [0, 0],
      weisResult: null,
      stoeckTeam: -1,
      current: null,
      pendingCard: null,
      legal: [],
    };
    $('log').innerHTML = '';
    $('center-panel').classList.add('hidden');
    render();
    runGame();
  }

  async function runGame() {
    const g = game;
    for (;;) {
      const lastTrickTeam = await playRound();
      if (g !== game || g.over) return;
      const [a, b] = g.scores;
      if (a >= settings.target || b >= settings.target) {
        const winner = a === b ? lastTrickTeam : (a > b ? 0 : 1);
        endGame(winner, `${winner === 0 ? 'Du und Vreni habt' : 'Sepp und Fritz haben'} die ${settings.target} Punkte erreicht.`);
        return;
      }
    }
  }

  async function askMode(player, canPush) {
    if (player === HUMAN) return askHumanMode(canPush);
    await delay(900);
    return AI.chooseMode(game.hands[player], canPush);
  }

  function getCard(player, mode) {
    const g = game;
    const legal = R.legalCards(g.hands[player], g.trick, mode);
    if (player === HUMAN) {
      g.legal = legal;
      return new Promise(resolve => {
        g.pendingCard = resolve;
        render();
      });
    }
    return Promise.resolve(AI.chooseCard({
      hand: g.hands[player],
      legal,
      trick: g.trick,
      mode,
      player,
      declarer: g.chooser,
      played: g.played,
    }));
  }

  function playHumanCard(card) {
    const g = game;
    if (!g.pendingCard || !g.legal.some(c => c.id === card.id)) return;
    const resolve = g.pendingCard;
    g.pendingCard = null;
    g.legal = [];
    resolve(card);
  }

  function weisSummary(list) {
    return list.map(w => `${R.weisLabel(w)} (${w.points})`).join(', ');
  }

  async function playRound() {
    const g = game;
    g.round++;
    g.hands = R.deal();
    Object.assign(g, {
      mode: null, multiplier: 1, chooser: null, trick: [], trickIndex: 0, trickWinner: null,
      played: [], lastTrick: null, tricks: [0, 0], tricksPlayed: 0, lastTrickTeam: -1,
      cardPoints: [0, 0], weisResult: null, stoeckTeam: -1, roundScored: false,
    });
    // In der ersten Runde beginnt, wer die Ecken-10 (Schellen-Banner) hat; danach im Gegenuhrzeigersinn weiter.
    g.hands[HUMAN] = R.sortHand(g.hands[HUMAN], null);
    if (g.round === 1) {
      g.starter = R.starterOf(g.hands);
      const startCard = `${R.suitName('D')}-${R.rankName('10')}`;
      const article = settings.deck === 'de' ? 'den' : 'die'; // der Banner, die Zehn
      log(`Runde 1: ${who(g.starter, 'hast', 'hat')} ${article} ${startCard} und ${g.starter === HUMAN ? 'bestimmst' : 'bestimmt'} den Trumpf.`);
      bubble(g.starter, `${startCard}!`);
    } else {
      g.starter = (g.starter + 1) % 4;
      log(`Runde ${g.round}: ${who(g.starter, 'bestimmst', 'bestimmt')} den Trumpf.`);
    }
    g.current = g.starter;
    render();

    // Trumpf bestimmen (oder schieben)
    let chooser = g.starter;
    let choice = await askMode(chooser, true);
    if (choice.push) {
      bubble(chooser, 'Schiebe!');
      log(`${who(chooser, 'schiebst', 'schiebt')}.`);
      chooser = R.partnerOf(chooser);
      g.current = chooser;
      render();
      await delay(700);
      choice = await askMode(chooser, false);
    }
    g.mode = choice;
    g.chooser = chooser;
    g.multiplier = settings.multipliers ? R.modeMultiplier(choice) : 1;
    bubble(chooser, R.modeLabel(choice));
    log(`${who(chooser, 'wählst', 'wählt')} ${R.modeLabel(choice)}${g.multiplier > 1 ? ` (×${g.multiplier})` : ''}.`);
    g.hands[HUMAN] = R.sortHand(g.hands[HUMAN], g.mode);
    g.current = null;
    render();
    await delay(1100);

    const weis = g.hands.map(h => R.findWeis(h));
    const stoeckHolder = g.hands.findIndex(h => R.hasStoeck(h, g.mode));
    const isStoeckCard = c => R.isTrump(c, g.mode) && (c.rank === 'K' || c.rank === 'Q');
    let leader = g.starter;

    for (let t = 0; t < 9; t++) {
      const mode = R.trickMode(g.mode, t);
      g.trickIndex = t;
      g.trick = [];
      g.trickWinner = null;
      for (let i = 0; i < 4; i++) {
        const p = (leader + i) % 4;
        g.current = p;
        render();
        if (p !== HUMAN) await delay(650);
        const card = await getCard(p, mode);
        g.hands[p] = g.hands[p].filter(c => c.id !== card.id);
        g.trick.push({ player: p, card });
        g.played.push(card);
        if (t === 0 && weis[p].length) {
          const sum = weis[p].reduce((s, w) => s + w.points, 0);
          bubble(p, `${sum} weisen`);
          log(`${who(p, 'weist', 'weist')} ${sum}.`);
        }
        g.current = null;
        render();
        // Stöck wird beim Ausspielen der zweiten Karte gemeldet und sofort geschrieben.
        if (p === stoeckHolder && isStoeckCard(card) && !g.hands[p].some(isStoeckCard)) {
          bubble(p, 'Stöck!');
          log(`${who(p, 'meldest', 'meldet')} Stöck.`);
          g.stoeckTeam = R.teamOf(p);
          render();
          checkBedanken(g.stoeckTeam);
          if (g.over) return g.stoeckTeam;
        }
      }

      const win = R.trickWinner(g.trick, mode);
      const team = R.teamOf(win.player);
      g.trickWinner = win.player;
      render();
      await delay(1300);

      // Reihenfolge beim Schreiben: Stöck, Weis, Stich.
      if (t === 0) {
        g.weisResult = R.resolveWeis(weis, g.starter, mode);
        if (g.weisResult) {
          const shown = [0, 1, 2, 3].filter(p => R.teamOf(p) === g.weisResult.team && weis[p].length);
          for (const p of shown) log(`${who(p, 'zeigst', 'zeigt')}: ${weisSummary(weis[p])}.`);
          log(`Weis zählt für ${TEAM_NAMES[g.weisResult.team]}: ${g.weisResult.points} Punkte.`);
          checkBedanken(g.weisResult.team);
          if (g.over) return team;
        }
      }

      g.cardPoints[team] += R.trickPoints(g.trick, mode);
      g.tricks[team]++;
      g.tricksPlayed = t + 1;
      g.lastTrickTeam = team;
      g.lastTrick = { cards: g.trick, winner: win.player };
      g.trick = [];
      g.trickWinner = null;
      leader = win.player;
      render();
      checkBedanken(team);
      if (g.over) return team;
    }

    const result = R.scoreRound({
      cardPoints: g.cardPoints,
      tricks: g.tricks,
      lastTrickTeam: g.lastTrickTeam,
      weis: g.weisResult,
      stoeckTeam: stoeckHolder >= 0 ? R.teamOf(stoeckHolder) : -1,
      multiplier: g.multiplier,
    });
    g.scores = g.scores.map((s, t) => s + result.total[t]);
    g.roundScored = true;
    log(`Runde ${g.round}: Wir +${result.total[0]}, Sie +${result.total[1]}.`);
    render();
    await showRoundSummary(result);
    return g.lastTrickTeam;
  }

  // ---------- Start ----------

  $('btn-new').addEventListener('click', () => {
    if (game) game.token = Symbol('aborted');
    $('center-panel').classList.add('hidden');
    showStartDialog();
  });
  $('btn-bedanken').addEventListener('click', humanBedanken);

  game = {
    token: null, over: false, scores: [0, 0], round: 0, hands: [[], [], [], []], mode: null, chooser: null,
    trick: [], trickIndex: 0, trickWinner: null, lastTrick: null, tricks: [0, 0], cardPoints: [0, 0],
    weisResult: null, stoeckTeam: -1, current: null, pendingCard: null, legal: [],
  };
  render();
  showStartDialog();
})();
