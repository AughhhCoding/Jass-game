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

  const settings = { target: 1000, multipliers: true, speed: 1 };
  let game = null;

  // ---------- Hilfsfunktionen ----------

  // Wartet; bricht still ab (löst nie auf), wenn inzwischen ein neues Spiel gestartet wurde.
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

  function cardEl(card, mode) {
    const el = document.createElement('div');
    const red = card.suit === 'H' || card.suit === 'D';
    const label = R.RANK_LABEL[card.rank];
    const sym = R.SUIT_SYMBOL[card.suit];
    el.className = 'card' + (red ? ' red' : '') + (mode && R.isTrump(card, mode) ? ' trump' : '');
    el.setAttribute('aria-label', `${R.SUIT_NAME[card.suit]} ${R.RANK_NAME[card.rank]}`);
    el.innerHTML =
      `<span class="corner tl">${label}<br>${sym}</span>` +
      `<span class="pip">${sym}</span>` +
      `<span class="corner br">${label}<br>${sym}</span>`;
    return el;
  }

  function backEl() {
    const el = document.createElement('div');
    el.className = 'card back';
    return el;
  }

  // ---------- Darstellung ----------

  function render() {
    const g = game;
    $('score-0').textContent = g.scores[0];
    $('score-1').textContent = g.scores[1];
    $('target').textContent = settings.target;

    const modeText = g.mode
      ? `${R.modeLabel(g.mode)}${settings.multipliers ? ` ×${R.modeMultiplier(g.mode)}` : ''}`
      : 'Kein Trumpf';
    $('mode-display').textContent = modeText;
    $('mode-display').classList.toggle('red', !!g.mode && g.mode.type === 'trump' && (g.mode.suit === 'H' || g.mode.suit === 'D'));

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
    const winner = g.trickWinner;
    for (const play of g.trick) {
      const el = cardEl(play.card, g.mode);
      el.classList.add('trick-card', `pos-${play.player}`);
      if (winner !== null && winner === play.player) el.classList.add('winner');
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
        (g.weisResult ? `<br>Weis: ${TEAM_NAMES[g.weisResult.team]} (${g.weisResult.points})` : '')
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

  function showStartDialog() {
    const dlg = openDialog(`
      <h2>Schieber-Jass</h2>
      <p>Du spielst mit Vreni gegen Sepp und Fritz.</p>
      <label class="field">Zielpunkte
        <select id="opt-target">
          ${[1000, 1500, 2500, 3000].map(t => `<option value="${t}"${t === settings.target ? ' selected' : ''}>${t}</option>`).join('')}
        </select>
      </label>
      <label class="field">Tempo
        <select id="opt-speed">
          <option value="0.6"${settings.speed === 0.6 ? ' selected' : ''}>Gemütlich</option>
          <option value="1"${settings.speed === 1 ? ' selected' : ''}>Normal</option>
          <option value="2"${settings.speed === 2 ? ' selected' : ''}>Schnell</option>
        </select>
      </label>
      <label class="field checkbox">
        <input type="checkbox" id="opt-mult"${settings.multipliers ? ' checked' : ''}>
        Multiplikator (♦♣ ×1, ♥♠ ×2, Obenabe/Undenufe ×3)
      </label>
      <div class="actions"><button class="btn" id="btn-start">Spiel starten</button></div>
    `);
    dlg.querySelector('#btn-start').addEventListener('click', () => {
      settings.target = Number(dlg.querySelector('#opt-target').value);
      settings.speed = Number(dlg.querySelector('#opt-speed').value);
      settings.multipliers = dlg.querySelector('#opt-mult').checked;
      closeDialog();
      newGame();
    });
  }

  function askHumanMode(canPush) {
    return new Promise(resolve => {
      const panel = $('center-panel');
      const mult = mode => settings.multipliers ? `<small>×${R.modeMultiplier(mode)}</small>` : '';
      const buttons = R.ALL_MODES.map((mode, i) => {
        const red = mode.type === 'trump' && (mode.suit === 'H' || mode.suit === 'D');
        return `<button class="btn mode-btn${red ? ' red' : ''}" data-mode="${i}">${R.modeLabel(mode)} ${mult(mode)}</button>`;
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
        <h2>Runde ${g.round}: ${R.modeLabel(g.mode)}</h2>
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

  function showGameOver(winner) {
    const g = game;
    const dlg = openDialog(`
      <h2>${winner === 0 ? 'Gewonnen! 🏆' : 'Verloren'}</h2>
      <p>${winner === 0 ? 'Du und Vreni habt' : 'Sepp und Fritz haben'} die ${settings.target} Punkte erreicht.</p>
      <p class="final-score">Wir <b>${g.scores[0]}</b> : <b>${g.scores[1]}</b> Sie</p>
      <div class="actions"><button class="btn" id="btn-again">Nochmals spielen</button></div>
    `);
    dlg.querySelector('#btn-again').addEventListener('click', () => { closeDialog(); showStartDialog(); });
  }

  // ---------- Spielablauf ----------

  function newGame() {
    game = {
      token: Symbol('game'),
      scores: [0, 0],
      round: 0,
      starter: 0,
      hands: [[], [], [], []],
      mode: null,
      chooser: null,
      trick: [],
      trickWinner: null,
      played: [],
      lastTrick: null,
      tricks: [0, 0],
      cardPoints: [0, 0],
      weisResult: null,
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
      if (g !== game) return;
      const [a, b] = g.scores;
      if (a >= settings.target || b >= settings.target) {
        const winner = a === b ? lastTrickTeam : (a > b ? 0 : 1);
        log(`Spielende: ${TEAM_NAMES[winner]} gewinnen ${a} : ${b}.`);
        showGameOver(winner);
        return;
      }
    }
  }

  async function askMode(player, canPush) {
    if (player === HUMAN) return askHumanMode(canPush);
    await delay(900);
    return AI.chooseMode(game.hands[player], canPush);
  }

  function getCard(player) {
    const g = game;
    const legal = R.legalCards(g.hands[player], g.trick, g.mode);
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
      mode: g.mode,
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
    g.mode = null;
    g.chooser = null;
    g.trick = [];
    g.trickWinner = null;
    g.played = [];
    g.lastTrick = null;
    g.tricks = [0, 0];
    g.cardPoints = [0, 0];
    g.weisResult = null;
    // In der ersten Runde beginnt, wer die Ecken-7 hat; danach im Gegenuhrzeigersinn weiter.
    g.starter = g.round === 1 ? g.hands.findIndex(h => h.some(c => c.id === 'D7')) : (g.starter + 1) % 4;
    g.hands[HUMAN] = R.sortHand(g.hands[HUMAN], null);
    log(`Runde ${g.round}: ${who(g.starter, 'bestimmst', 'bestimmt')} den Trumpf.`);
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
    const multiplier = settings.multipliers ? R.modeMultiplier(choice) : 1;
    bubble(chooser, R.modeLabel(choice));
    log(`${who(chooser, 'wählst', 'wählt')} ${R.modeLabel(choice)}${multiplier > 1 ? ` (×${multiplier})` : ''}.`);
    g.hands[HUMAN] = R.sortHand(g.hands[HUMAN], g.mode);
    g.current = null;
    render();
    await delay(1100);

    const weis = g.hands.map(h => R.findWeis(h));
    const stoeckHolder = g.hands.findIndex(h => R.hasStoeck(h, g.mode));
    const isStoeckCard = c => R.isTrump(c, g.mode) && (c.rank === 'K' || c.rank === 'Q');
    let leader = g.starter;
    let lastTrickTeam = 0;

    for (let t = 0; t < 9; t++) {
      g.trick = [];
      g.trickWinner = null;
      for (let i = 0; i < 4; i++) {
        const p = (leader + i) % 4;
        g.current = p;
        render();
        if (p !== HUMAN) await delay(650);
        const card = await getCard(p);
        g.hands[p] = g.hands[p].filter(c => c.id !== card.id);
        g.trick.push({ player: p, card });
        g.played.push(card);
        if (t === 0 && weis[p].length) {
          const sum = weis[p].reduce((s, w) => s + w.points, 0);
          bubble(p, `${sum} weisen`);
          log(`${who(p, 'weist', 'weist')} ${sum}.`);
        }
        if (p === stoeckHolder && isStoeckCard(card) && !g.hands[p].some(isStoeckCard)) {
          bubble(p, 'Stöck!');
          log(`${who(p, 'meldest', 'meldet')} Stöck.`);
        }
        g.current = null;
        render();
      }

      const win = R.trickWinner(g.trick, g.mode);
      const team = R.teamOf(win.player);
      g.trickWinner = win.player;
      render();
      await delay(1300);

      g.cardPoints[team] += R.trickPoints(g.trick, g.mode);
      g.tricks[team]++;
      g.lastTrick = { cards: g.trick, winner: win.player };
      g.trick = [];
      g.trickWinner = null;
      leader = win.player;
      lastTrickTeam = team;

      if (t === 0) {
        g.weisResult = R.resolveWeis(weis, g.starter, g.mode);
        if (g.weisResult) {
          const shown = [0, 1, 2, 3].filter(p => R.teamOf(p) === g.weisResult.team && weis[p].length);
          for (const p of shown) log(`${who(p, 'zeigst', 'zeigt')}: ${weisSummary(weis[p])}.`);
          log(`Weis zählt für ${TEAM_NAMES[g.weisResult.team]}: ${g.weisResult.points} Punkte.`);
        }
      }
      render();
    }

    const result = R.scoreRound({
      cardPoints: g.cardPoints,
      tricks: g.tricks,
      lastTrickTeam,
      weis: g.weisResult,
      stoeckTeam: stoeckHolder >= 0 ? R.teamOf(stoeckHolder) : -1,
      multiplier,
    });
    g.scores = g.scores.map((s, t) => s + result.total[t]);
    log(`Runde ${g.round}: Wir +${result.total[0]}, Sie +${result.total[1]}.`);
    render();
    await showRoundSummary(result);
    return lastTrickTeam;
  }

  // ---------- Start ----------

  $('btn-new').addEventListener('click', () => {
    if (game) game.token = Symbol('aborted');
    $('center-panel').classList.add('hidden');
    showStartDialog();
  });

  game = {
    token: null, scores: [0, 0], round: 0, hands: [[], [], [], []], mode: null, chooser: null,
    trick: [], trickWinner: null, lastTrick: null, tricks: [0, 0], cardPoints: [0, 0],
    weisResult: null, current: null, pendingCard: null, legal: [],
  };
  render();
  showStartDialog();
})();
