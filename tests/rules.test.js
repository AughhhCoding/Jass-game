'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/rules.js');
const AI = require('../js/ai.js');

const c = id => ({ suit: id[0], rank: id.slice(1), id });
const hand = ids => ids.map(c);
const trick = (...plays) => plays.map(([player, id]) => ({ player, card: c(id) }));
const ids = cards => cards.map(x => x.id).sort();

const TRUMP_H = { type: 'trump', suit: 'H' };
const OBE = { type: 'obe' };
const UNDE = { type: 'unde' };

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('Kartenspiel hat 36 Karten und 152 Kartenpunkte in jedem Modus', () => {
  const deck = R.createDeck();
  assert.equal(deck.length, 36);
  assert.equal(new Set(deck.map(x => x.id)).size, 36);
  for (const mode of R.ALL_MODES) {
    assert.equal(deck.reduce((s, x) => s + R.cardPoints(x, mode), 0), 152, R.modeLabel(mode));
  }
});

test('Stichgewinner: Bauer schlägt Nell, Trumpf schlägt Farbe', () => {
  assert.equal(R.trickWinner(trick([0, 'HA'], [1, 'H9'], [2, 'HJ'], [3, 'HK']), TRUMP_H).player, 2);
  assert.equal(R.trickWinner(trick([0, 'SA'], [1, 'H6'], [2, 'SK'], [3, 'S10']), TRUMP_H).player, 1);
  assert.equal(R.trickWinner(trick([0, 'S7'], [1, 'DA'], [2, 'S9'], [3, 'S8']), TRUMP_H).player, 2);
  assert.equal(R.trickWinner(trick([0, 'S7'], [1, 'S6'], [2, 'SA'], [3, 'D6']), UNDE).player, 1);
  assert.equal(R.trickWinner(trick([0, 'S7'], [1, 'S6'], [2, 'SA'], [3, 'D6']), OBE).player, 2);
});

test('Farbe angeben, stechen ist erlaubt', () => {
  const h = hand(['S6', 'SK', 'H7', 'D8']);
  assert.deepEqual(ids(R.legalCards(h, trick([1, 'SA']), TRUMP_H)), ['H7', 'S6', 'SK']);
  assert.deepEqual(ids(R.legalCards(h, trick([1, 'CA']), TRUMP_H)), ids(h));
  assert.deepEqual(ids(R.legalCards(h, trick([1, 'SA']), OBE)), ['S6', 'SK']);
});

test('Untertrumpfen ist verboten, ausser man hat nur Trümpfe', () => {
  const h = hand(['H6', 'HQ', 'C8']);
  const t = trick([1, 'CA'], [2, 'HK']);
  assert.deepEqual(ids(R.legalCards(h, t, TRUMP_H)), ['C8']);
  const onlyTrumps = hand(['H6', 'H7']);
  assert.deepEqual(ids(R.legalCards(onlyTrumps, trick([1, 'SA'], [2, 'HK']), TRUMP_H)), ['H6', 'H7']);
  assert.deepEqual(ids(R.legalCards(hand(['H6', 'HJ', 'D7']), t, TRUMP_H)), ['D7', 'HJ']);
});

test('Trumpf-Bauer muss nicht angegeben werden', () => {
  const h = hand(['HJ', 'S6', 'D7']);
  assert.deepEqual(ids(R.legalCards(h, trick([1, 'HA']), TRUMP_H)), ids(h));
  const h2 = hand(['HJ', 'H6', 'D7']);
  assert.deepEqual(ids(R.legalCards(h2, trick([1, 'HA']), TRUMP_H)), ['H6', 'HJ']);
});

test('Weis: Folgen und Vierlinge', () => {
  const w = R.findWeis(hand(['S6', 'S7', 'S8', 'S9', 'HJ', 'SJ', 'DJ', 'CJ', 'C10']));
  const seq = w.find(x => x.type === 'seq');
  assert.equal(seq.length, 4);
  assert.equal(seq.points, 50);
  assert.equal(w.find(x => x.type === 'quad').points, 200);
  assert.equal(R.findWeis(hand(['S6', 'S7', 'S9', 'H10', 'HJ', 'CK'])).length, 0);
});

test('Weis-Vergleich: nur das beste Team zählt, Gleichstand an die Vorhand', () => {
  const byPlayer = [
    R.findWeis(hand(['S6', 'S7', 'S8'])),
    R.findWeis(hand(['D6', 'D7', 'D8', 'D9'])),
    R.findWeis(hand(['C10', 'CJ', 'CQ'])),
    [],
  ];
  const res = R.resolveWeis(byPlayer, 0, TRUMP_H);
  assert.equal(res.team, 1);
  assert.equal(res.points, 50);

  const tie = [R.findWeis(hand(['S6', 'S7', 'S8'])), R.findWeis(hand(['D6', 'D7', 'D8'])), [], []];
  assert.equal(R.resolveWeis(tie, 1, TRUMP_H).team, 1);
  assert.equal(R.resolveWeis(tie, 0, { type: 'trump', suit: 'D' }).team, 1);
});

test('Abrechnung: Match und Multiplikator', () => {
  const match = R.scoreRound({ cardPoints: [152, 0], tricks: [9, 0], lastTrickTeam: 0, weis: null, stoeckTeam: -1, multiplier: 1 });
  assert.deepEqual(match.total, [257, 0]);
  const r = R.scoreRound({ cardPoints: [100, 52], tricks: [6, 3], lastTrickTeam: 1, weis: { team: 0, points: 20 }, stoeckTeam: 1, multiplier: 2 });
  assert.deepEqual(r.total, [240, 154]);
});

test('Computer spielt viele Runden nur regelkonforme Karten', () => {
  const random = rng(42);
  let slalomRounds = 0;
  for (let round = 0; round < 1000; round++) {
    const hands = R.deal(random);
    const starter = round % 4;
    let mode = AI.chooseMode(hands[starter], true);
    let declarer = starter;
    if (mode.push) {
      declarer = R.partnerOf(starter);
      mode = AI.chooseMode(hands[declarer], false);
    }
    assert.ok(!mode.push);

    const played = [];
    const points = [0, 0];
    let leader = starter;
    let lastTeam = 0;
    for (let t = 0; t < 9; t++) {
      const tm = R.trickMode(mode, t);
      const tr = [];
      for (let i = 0; i < 4; i++) {
        const p = (leader + i) % 4;
        const legal = R.legalCards(hands[p], tr, tm);
        const card = AI.chooseCard({ hand: hands[p], legal, trick: tr, mode: tm, player: p, declarer, played });
        assert.ok(legal.some(x => x.id === card.id), `illegale Karte ${card.id}`);
        hands[p] = hands[p].filter(x => x.id !== card.id);
        tr.push({ player: p, card });
        played.push(card);
      }
      const win = R.trickWinner(tr, tm);
      points[R.teamOf(win.player)] += R.trickPoints(tr, tm);
      leader = win.player;
      lastTeam = R.teamOf(win.player);
    }
    points[lastTeam] += R.LAST_TRICK_BONUS;
    if (mode.type === 'slalom') slalomRounds++;
    else assert.equal(points[0] + points[1], 157);
  }
  assert.ok(slalomRounds > 0, 'Computer wählt nie Slalom');
});

test('Slalom wechselt Obenabe und Undenufe ab', () => {
  const oben = { type: 'slalom', start: 'obe' };
  const unten = { type: 'slalom', start: 'unde' };
  assert.deepEqual([0, 1, 2, 3].map(t => R.trickMode(oben, t).type), ['obe', 'unde', 'obe', 'unde']);
  assert.deepEqual([0, 1, 2].map(t => R.trickMode(unten, t).type), ['unde', 'obe', 'unde']);
  assert.equal(R.trickMode(TRUMP_H, 5), TRUMP_H);
  const tr = trick([0, 'S7'], [1, 'S6'], [2, 'SA'], [3, 'D6']);
  assert.equal(R.trickWinner(tr, R.trickMode(oben, 0)).player, 2);
  assert.equal(R.trickWinner(tr, R.trickMode(oben, 1)).player, 1);
  assert.equal(R.modeMultiplier(oben), 3);
  assert.equal(R.modeLabel(unten), 'Slalom unten');
});

test('Deutschschweizer Blatt: Namen für Farben, Karten und Weis', () => {
  try {
    R.setDeckStyle('de');
    assert.equal(R.modeLabel({ type: 'trump', suit: 'H' }), 'Rosen');
    assert.equal(R.suitName('D'), 'Schellen');
    assert.equal(R.rankName('10'), 'Banner');
    assert.equal(R.rankLabel('J'), 'U');
    assert.equal(R.weisLabel(R.findWeis(hand(['C8', 'C9', 'C10']))[0]), 'Dreiblatt Eicheln bis B');
    assert.equal(R.weisLabel(R.findWeis(hand(['SJ', 'HJ', 'DJ', 'CJ']))[0]), 'Vier Under');
  } finally {
    R.setDeckStyle('fr');
  }
  assert.equal(R.modeLabel({ type: 'trump', suit: 'H' }), '♥ Herz');
});

test('Wer die Ecken-10 hat, beginnt die Runde', () => {
  const random = rng(7);
  for (let i = 0; i < 50; i++) {
    const hands = R.deal(random);
    const p = R.starterOf(hands);
    assert.ok(hands[p].some(x => x.id === 'D10'));
  }
});
