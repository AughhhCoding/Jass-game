/*
 * Einfache Computer-Gegner: heuristische Trumpfwahl und Kartenwahl.
 */
(function (root) {
  'use strict';

  const R = typeof module === 'object' && module.exports ? require('./rules.js') : root.JassRules;

  const PUSH_THRESHOLD = 68;

  const maxBy = (arr, f) => arr.reduce((best, x) => (f(x) > f(best) ? x : best));
  const minBy = (arr, f) => arr.reduce((best, x) => (f(x) < f(best) ? x : best));

  function evaluateMode(hand, mode) {
    if (mode.type === 'trump') {
      const trumps = hand.filter(c => c.suit === mode.suit);
      const has = rank => trumps.some(c => c.rank === rank);
      let score = trumps.length * 10;
      if (has('J')) score += 25;
      if (has('9')) score += has('J') ? 20 : 12;
      if (has('A')) score += 8;
      for (const suit of R.SUITS) {
        if (suit === mode.suit) continue;
        const cards = hand.filter(c => c.suit === suit);
        if (cards.length === 0 && trumps.length >= 3) score += 6;
        if (cards.some(c => c.rank === 'A')) {
          score += 12;
          if (cards.some(c => c.rank === 'K')) score += 5;
        }
      }
      return score;
    }
    // Obenabe / Undenufe: sichere Stiche von der Spitze jeder Farbe zählen.
    let score = 0;
    for (const suit of R.SUITS) {
      const ranks = hand
        .filter(c => c.suit === suit)
        .map(c => R.suitRank(c, mode))
        .sort((a, b) => b - a);
      let expected = 8;
      let sure = 0;
      for (const r of ranks) {
        if (r !== expected) break;
        sure++;
        expected--;
      }
      score += sure * 16;
      if (sure > 0) score += (ranks.length - sure) * 4;
      else if (ranks[0] === 7 && ranks.length >= 2) score += 6;
    }
    return score;
  }

  function chooseMode(hand, canPush) {
    const scored = R.ALL_MODES.map(mode => ({ mode, score: evaluateMode(hand, mode) }));
    const best = maxBy(scored, s => s.score);
    if (canPush && best.score < PUSH_THRESHOLD) return { push: true };
    return best.mode;
  }

  function unseenCards(ctx) {
    const known = new Set([
      ...ctx.played.map(c => c.id),
      ...ctx.hand.map(c => c.id),
      ...ctx.trick.map(p => p.card.id),
    ]);
    return R.createDeck().filter(c => !known.has(c.id));
  }

  // Ist die Karte die höchste noch nicht gesehene ihrer Farbe?
  function isTopCard(card, mode, unseen) {
    const rank = R.suitRank(card, mode);
    return !unseen.some(c => c.suit === card.suit && R.suitRank(c, mode) > rank);
  }

  function discard(cards, mode) {
    return minBy(cards, c =>
      R.cardPoints(c, mode) * 3 + (R.isTrump(c, mode) ? 40 : 0) + R.suitRank(c, mode));
  }

  // Dem Partner Punkte zuspielen ("schmieren").
  function smear(cards, mode) {
    const side = cards.filter(c => !R.isTrump(c, mode));
    if (!side.length) return discard(cards, mode);
    return maxBy(side, c => R.cardPoints(c, mode) * 10 - R.suitRank(c, mode));
  }

  function lead(ctx) {
    const { legal, mode, hand } = ctx;
    const unseen = unseenCards(ctx);
    const ourGame = R.teamOf(ctx.player) === R.teamOf(ctx.declarer);

    if (mode.type === 'trump') {
      const myTrumps = legal.filter(c => R.isTrump(c, mode));
      const trumpsOut = unseen.filter(c => R.isTrump(c, mode)).length;
      if (myTrumps.length && trumpsOut > 0) {
        const top = myTrumps.find(c => isTopCard(c, mode, unseen));
        if (top && (ourGame || myTrumps.length >= 2)) return top;
        if (ourGame && myTrumps.length >= 3) return minBy(myTrumps, c => R.suitRank(c, mode));
      }
    }

    const side = legal.filter(c => !R.isTrump(c, mode));
    const winners = side.filter(c => isTopCard(c, mode, unseen));
    if (winners.length) return maxBy(winners, c => R.cardPoints(c, mode) * 10 + R.suitRank(c, mode));

    const pool = side.length ? side : legal;
    const length = suit => hand.filter(c => c.suit === suit).length;
    return minBy(pool, c => R.cardPoints(c, mode) * 4 + R.suitRank(c, mode) - length(c.suit) * 2);
  }

  function follow(ctx) {
    const { legal, trick, mode, player } = ctx;
    const led = trick[0].card.suit;
    const unseen = unseenCards(ctx);
    const winner = R.trickWinner(trick, mode);
    const bestStrength = R.cardStrength(winner.card, mode, led);
    const last = trick.length === 3;
    const points = R.trickPoints(trick, mode);
    const strength = c => R.cardStrength(c, mode, led);

    if (winner.player === R.partnerOf(player)) {
      const safe = last || (isTopCard(winner.card, mode, unseen)
        && (R.isTrump(winner.card, mode) || mode.type !== 'trump'));
      return safe ? smear(legal, mode) : discard(legal, mode);
    }

    const beats = legal.filter(c => strength(c) > bestStrength);
    if (!beats.length) return discard(legal, mode);

    const sideBeats = beats.filter(c => !R.isTrump(c, mode));
    const trumpBeats = beats.filter(c => R.isTrump(c, mode));

    if (last) {
      if (sideBeats.length) return maxBy(sideBeats, c => R.cardPoints(c, mode) * 10 - strength(c));
      if (points >= 4 || trumpBeats.length > 2) return minBy(trumpBeats, strength);
      return discard(legal, mode);
    }

    const sure = sideBeats.filter(c => isTopCard(c, mode, unseen));
    if (sure.length) return minBy(sure, strength);
    if (trumpBeats.length && points >= 10) {
      const sureTrump = trumpBeats.filter(c => isTopCard(c, mode, unseen));
      return sureTrump.length ? minBy(sureTrump, strength) : minBy(trumpBeats, strength);
    }
    if (sideBeats.length && points >= 10) return maxBy(sideBeats, strength);
    return discard(legal, mode);
  }

  /*
   * ctx: { hand, legal, trick, mode, player, declarer, played }
   */
  function chooseCard(ctx) {
    if (ctx.legal.length === 1) return ctx.legal[0];
    return ctx.trick.length === 0 ? lead(ctx) : follow(ctx);
  }

  const api = { evaluateMode, chooseMode, chooseCard, PUSH_THRESHOLD };

  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JassAI = api;
})(typeof window !== 'undefined' ? window : globalThis);
