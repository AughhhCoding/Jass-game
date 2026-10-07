/*
 * Spielregeln für den Schieber-Jass (französische Karten, 36 Blatt).
 * Reine Funktionen ohne DOM – im Browser als window.JassRules, in Node via require().
 */
(function (root) {
  'use strict';

  const SUITS = ['S', 'H', 'C', 'D'];
  const RANKS = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  // Französisches Blatt und deutschschweizer Blatt. Intern gelten immer die französischen Kürzel:
  // Schaufel ↔ Schilten, Herz ↔ Rosen, Kreuz ↔ Eicheln, Ecken ↔ Schellen.
  const DECKS = {
    fr: {
      name: 'Französisch',
      symbol: { S: '♠', H: '♥', D: '♦', C: '♣' },
      suitName: { S: 'Schaufel', H: 'Herz', D: 'Ecken', C: 'Kreuz' },
      rankLabel: { 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', J: 'B', Q: 'D', K: 'K', A: 'A' },
      rankName: { 6: 'Sechs', 7: 'Sieben', 8: 'Acht', 9: 'Neun', 10: 'Zehn', J: 'Bauer', Q: 'Dame', K: 'König', A: 'Ass' },
      quadName: { J: 'Vier Bauern', 9: 'Vier Neuner', A: 'Vier Asse', K: 'Vier Könige', Q: 'Vier Damen', 10: 'Vier Zehner' },
    },
    de: {
      name: 'Deutschschweizer',
      symbol: { S: '', H: '', D: '', C: '' },
      suitName: { S: 'Schilten', H: 'Rosen', D: 'Schellen', C: 'Eicheln' },
      rankLabel: { 6: '6', 7: '7', 8: '8', 9: '9', 10: 'B', J: 'U', Q: 'O', K: 'K', A: 'A' },
      rankName: { 6: 'Sechs', 7: 'Sieben', 8: 'Acht', 9: 'Neun', 10: 'Banner', J: 'Under', Q: 'Ober', K: 'König', A: 'Ass' },
      quadName: { J: 'Vier Under', 9: 'Vier Neuner', A: 'Vier Asse', K: 'Vier Könige', Q: 'Vier Ober', 10: 'Vier Banner' },
    },
  };
  let deck = DECKS.fr;

  function setDeckStyle(style) { deck = DECKS[style] || DECKS.fr; }
  const suitSymbol = suit => deck.symbol[suit];
  const suitName = suit => deck.suitName[suit];
  const rankLabel = rank => deck.rankLabel[rank];
  const rankName = rank => deck.rankName[rank];
  // Kurzform für Texte: Symbol beim französischen, Name beim deutschschweizer Blatt.
  const suitShort = suit => deck.symbol[suit] || deck.suitName[suit];
  // Reihenfolge der Trumpfkarten von schwach nach stark: Bauer (Buur) und Nell (9) sind die höchsten.
  const TRUMP_ORDER = ['6', '7', '8', '10', 'Q', 'K', 'A', '9', 'J'];
  const TRUMP_POINTS = { J: 20, 9: 14, A: 11, 10: 10, K: 4, Q: 3 };
  const SIDE_POINTS = { A: 11, 10: 10, K: 4, Q: 3, J: 2 };
  const SEQ_POINTS = { 3: 20, 4: 50, 5: 100, 6: 150, 7: 200, 8: 250, 9: 300 };
  const QUAD_POINTS = { J: 200, 9: 150, A: 100, K: 100, Q: 100, 10: 100 };
  const LAST_TRICK_BONUS = 5;
  const MATCH_BONUS = 100;
  const STOECK_POINTS = 20;

  const ALL_MODES = [
    ...SUITS.map(suit => ({ type: 'trump', suit })),
    { type: 'obe' },
    { type: 'unde' },
    { type: 'slalom', start: 'obe' },
    { type: 'slalom', start: 'unde' },
  ];

  // Beim Slalom wechseln Obenabe und Undenufe von Stich zu Stich.
  // Alle Funktionen für einen einzelnen Stich erwarten den so aufgelösten Modus.
  function trickMode(mode, trickIndex) {
    if (mode.type !== 'slalom') return mode;
    const startsObe = mode.start === 'obe';
    return { type: (trickIndex % 2 === 0) === startsObe ? 'obe' : 'unde' };
  }

  function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) deck.push({ suit, rank, id: suit + rank });
    }
    return deck;
  }

  function shuffle(cards, rng = Math.random) {
    const a = cards.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function deal(rng) {
    const deck = shuffle(createDeck(), rng);
    return [0, 1, 2, 3].map(p => deck.slice(p * 9, p * 9 + 9));
  }

  // Die Runde beginnt (und wählt den Trumpf), wer die Ecken-10 bzw. den Schellen-Banner hat.
  const STARTER_CARD = 'D10';
  const starterOf = hands => hands.findIndex(h => h.some(c => c.id === STARTER_CARD));

  const rankIndex = rank => RANKS.indexOf(rank);
  const isTrump = (card, mode) => mode.type === 'trump' && card.suit === mode.suit;
  const partnerOf = player => (player + 2) % 4;
  const teamOf = player => player % 2;

  function cardPoints(card, mode) {
    if (isTrump(card, mode)) return TRUMP_POINTS[card.rank] || 0;
    if (mode.type === 'trump') return SIDE_POINTS[card.rank] || 0;
    // Obenabe / Undenufe: die Acht zählt 8 Punkte, bei Undenufe tauschen Ass und Sechs.
    if (card.rank === '8') return 8;
    if (mode.type === 'unde') {
      if (card.rank === '6') return 11;
      if (card.rank === 'A') return 0;
    }
    return SIDE_POINTS[card.rank] || 0;
  }

  // Rang innerhalb der eigenen Farbe: je höher, desto stärker.
  function suitRank(card, mode) {
    if (isTrump(card, mode)) return TRUMP_ORDER.indexOf(card.rank);
    const i = rankIndex(card.rank);
    return mode.type === 'unde' ? 8 - i : i;
  }

  // Stärke einer Karte im Stich: Trumpf > angespielte Farbe > alles andere (-1).
  function cardStrength(card, mode, ledSuit) {
    if (isTrump(card, mode)) return 100 + suitRank(card, mode);
    if (card.suit === ledSuit) return suitRank(card, mode);
    return -1;
  }

  function trickWinner(trick, mode) {
    const led = trick[0].card.suit;
    let best = trick[0];
    for (const play of trick) {
      if (cardStrength(play.card, mode, led) > cardStrength(best.card, mode, led)) best = play;
    }
    return best;
  }

  function trickPoints(trick, mode) {
    return trick.reduce((sum, play) => sum + cardPoints(play.card, mode), 0);
  }

  function legalCards(hand, trick, mode) {
    if (trick.length === 0) return hand.slice();
    const led = trick[0].card.suit;
    const trump = mode.type === 'trump' ? mode.suit : null;
    const followers = hand.filter(c => c.suit === led);

    if (led === trump) {
      // Trumpf muss angegeben werden – ausser man hat nur noch den Bauer.
      if (followers.some(c => c.rank !== 'J')) return followers;
      return hand.slice();
    }

    // Farbe angeben oder (jederzeit erlaubt) stechen; wer nicht angeben kann, darf alles spielen.
    let candidates = followers.length
      ? hand.filter(c => c.suit === led || c.suit === trump)
      : hand.slice();

    // Untertrumpfen ist verboten, ausser man hat keine andere Wahl.
    if (trump) {
      const trumpsInTrick = trick.filter(p => isTrump(p.card, mode));
      if (trumpsInTrick.length) {
        const highest = Math.max(...trumpsInTrick.map(p => cardStrength(p.card, mode, led)));
        const allowed = candidates.filter(c => !isTrump(c, mode) || cardStrength(c, mode, led) > highest);
        if (allowed.length) candidates = allowed;
      }
    }
    return candidates;
  }

  function findWeis(hand) {
    const weis = [];
    for (const suit of SUITS) {
      const idx = hand
        .filter(c => c.suit === suit)
        .map(c => rankIndex(c.rank))
        .sort((a, b) => a - b);
      let start = 0;
      for (let i = 1; i <= idx.length; i++) {
        if (i === idx.length || idx[i] !== idx[i - 1] + 1) {
          const length = i - start;
          if (length >= 3) {
            weis.push({
              type: 'seq',
              suit,
              length,
              low: idx[start],
              high: idx[i - 1],
              points: SEQ_POINTS[length],
              cards: idx.slice(start, i).map(r => ({ suit, rank: RANKS[r], id: suit + RANKS[r] })),
            });
          }
          start = i;
        }
      }
    }
    for (const rank of Object.keys(QUAD_POINTS)) {
      const cards = hand.filter(c => c.rank === rank);
      if (cards.length === 4) weis.push({ type: 'quad', rank, points: QUAD_POINTS[rank], cards });
    }
    return weis;
  }

  // Vergleichsschlüssel: Punkte, dann höchste Karte (bei Undenufe die tiefste), dann Trumpf-Weis.
  function weisKey(w, mode) {
    const unde = mode.type === 'unde';
    const top = w.type === 'seq'
      ? (unde ? 8 - w.low : w.high)
      : (unde ? 8 - rankIndex(w.rank) : rankIndex(w.rank));
    const trumpBonus = w.type === 'seq' && mode.type === 'trump' && w.suit === mode.suit ? 1 : 0;
    return [w.points, top, trumpBonus];
  }

  function compareWeis(a, b, mode) {
    const ka = weisKey(a, mode);
    const kb = weisKey(b, mode);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
    return 0;
  }

  // Nur das Team mit dem höchsten Weis darf weisen; bei Gleichstand gewinnt, wer in Spielrichtung zuerst kommt.
  function resolveWeis(weisByPlayer, leader, mode) {
    let best = null;
    for (let i = 0; i < 4; i++) {
      const p = (leader + i) % 4;
      for (const w of weisByPlayer[p]) {
        if (!best || compareWeis(w, best.weis, mode) > 0) best = { player: p, weis: w };
      }
    }
    if (!best) return null;
    const team = teamOf(best.player);
    const points = weisByPlayer
      .filter((_, p) => teamOf(p) === team)
      .flat()
      .reduce((sum, w) => sum + w.points, 0);
    return { team, player: best.player, points };
  }

  function hasStoeck(hand, mode) {
    if (mode.type !== 'trump') return false;
    return hand.some(c => c.suit === mode.suit && c.rank === 'K')
      && hand.some(c => c.suit === mode.suit && c.rank === 'Q');
  }

  function modeMultiplier(mode) {
    if (mode.type !== 'trump') return 3;
    return mode.suit === 'H' || mode.suit === 'S' ? 2 : 1;
  }

  function modeLabel(mode) {
    if (mode.type === 'obe') return 'Obenabe';
    if (mode.type === 'unde') return 'Undenufe';
    if (mode.type === 'slalom') return `Slalom ${mode.start === 'obe' ? 'oben' : 'unten'}`;
    return [suitSymbol(mode.suit), suitName(mode.suit)].filter(Boolean).join(' ');
  }

  function weisLabel(w) {
    if (w.type === 'quad') return deck.quadName[w.rank];
    const names = { 3: 'Dreiblatt', 4: 'Vierblatt', 5: 'Fünfblatt', 6: 'Sechsblatt', 7: 'Siebenblatt', 8: 'Achtblatt', 9: 'Neunblatt' };
    return `${names[w.length]} ${suitShort(w.suit)} bis ${rankLabel(RANKS[w.high])}`;
  }

  function sortHand(hand, mode) {
    const order = mode && mode.type === 'trump'
      ? [mode.suit, ...SUITS.filter(s => s !== mode.suit)]
      : SUITS;
    const m = mode || { type: 'obe' };
    return hand.slice().sort((a, b) =>
      order.indexOf(a.suit) - order.indexOf(b.suit) || suitRank(b, m) - suitRank(a, m));
  }

  function scoreRound({ cardPoints: pts, tricks, lastTrickTeam, weis, stoeckTeam, multiplier }) {
    const base = pts.slice();
    base[lastTrickTeam] += LAST_TRICK_BONUS;
    const match = tricks[0] === 9 ? 0 : tricks[1] === 9 ? 1 : -1;
    if (match >= 0) base[match] += MATCH_BONUS;
    const cards = base.map(p => p * multiplier);
    const weisPts = [0, 0];
    if (weis) weisPts[weis.team] = weis.points * multiplier;
    const stoeck = [0, 0];
    if (stoeckTeam >= 0) stoeck[stoeckTeam] = STOECK_POINTS * multiplier;
    return {
      base,
      match,
      multiplier,
      cards,
      weis: weisPts,
      stoeck,
      total: [0, 1].map(t => cards[t] + weisPts[t] + stoeck[t]),
    };
  }

  const api = {
    SUITS, RANKS, DECKS, ALL_MODES,
    setDeckStyle, suitSymbol, suitName, suitShort, rankLabel, rankName, trickMode,
    LAST_TRICK_BONUS, MATCH_BONUS, STOECK_POINTS,
    STARTER_CARD, starterOf,
    createDeck, shuffle, deal, isTrump, partnerOf, teamOf,
    cardPoints, suitRank, cardStrength, trickWinner, trickPoints, legalCards,
    findWeis, compareWeis, resolveWeis, hasStoeck, modeMultiplier, modeLabel, weisLabel,
    sortHand, scoreRound,
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JassRules = api;
})(typeof window !== 'undefined' ? window : globalThis);
