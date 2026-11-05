// International club competitions: qualification by league rank, group stage,
// single-leg knockout rounds, scheduled against the user's league calendar.

import type { CompetitionState, CupFixture, TableRow } from '../types';
import { makeFixturesFromIds, quickSim, recordResult, sortTable } from '../league';
import { seededShuffle, withSeed, hashStr } from './squads';
import { CLUB_BY_ID, type Confed } from './db';

export interface CompDef {
  id: string; name: string; short: string; confed: Confed | 'DOMESTIC'; size: 8 | 16 | 32;
  format: 'groups' | 'ko';
  slots: { league: string; from: number; to: number }[];
  nationId?: string; // domestic cup: all clubs of this nation qualify by tier/rank
}

const sl = (league: string, from: number, to: number) => ({ league, from, to });

// Qualification follows real-world style: more slots for stronger leagues, champions of smaller leagues.
export const COMP_DEFS: CompDef[] = [
  { id: 'ucl', name: 'UEFA Champions League', short: 'UCL', confed: 'UEFA', size: 32, format: 'groups', slots: [
    sl('eng1', 1, 4), sl('esp1', 1, 4), sl('ger1', 1, 4), sl('ita1', 1, 4), sl('fra1', 1, 3),
    sl('ned1', 1, 2), sl('por1', 1, 2), sl('bel1', 1, 1), sl('sco1', 1, 1), sl('tur1', 1, 1),
    sl('aut1', 1, 1), sl('sui1', 1, 1), sl('gre1', 1, 1), sl('den1', 1, 1), sl('cze1', 1, 1), sl('cro1', 1, 1), sl('ukr1', 1, 1), sl('srb1', 1, 1), sl('nor1', 1, 1) ] },
  { id: 'uel', name: 'UEFA Europa League', short: 'UEL', confed: 'UEFA', size: 32, format: 'groups', slots: [
    sl('eng1', 5, 6), sl('esp1', 5, 6), sl('ger1', 5, 6), sl('ita1', 5, 6), sl('fra1', 4, 5),
    sl('ned1', 3, 4), sl('por1', 3, 4), sl('bel1', 2, 3), sl('sco1', 2, 2), sl('tur1', 2, 3),
    sl('aut1', 2, 2), sl('sui1', 2, 2), sl('gre1', 2, 2), sl('den1', 2, 2), sl('cze1', 2, 2), sl('cro1', 2, 2), sl('ukr1', 2, 2), sl('pol1', 1, 1), sl('swe1', 1, 1), sl('srb1', 2, 2), sl('nor1', 2, 2) ] },
  { id: 'uecl', name: 'UEFA Conference League', short: 'UECL', confed: 'UEFA', size: 32, format: 'groups', slots: [
    sl('eng1', 7, 7), sl('esp1', 7, 7), sl('ger1', 7, 7), sl('ita1', 7, 7), sl('fra1', 6, 6),
    sl('ned1', 5, 5), sl('por1', 5, 5), sl('bel1', 4, 4), sl('sco1', 3, 3), sl('tur1', 4, 4),
    sl('aut1', 3, 3), sl('sui1', 3, 3), sl('gre1', 3, 3), sl('den1', 3, 3), sl('cze1', 3, 3), sl('cro1', 3, 3), sl('ukr1', 3, 3),
    sl('pol1', 2, 3), sl('swe1', 2, 3), sl('srb1', 3, 3), sl('nor1', 3, 3), sl('sco1', 4, 4), sl('bel1', 5, 5), sl('ned1', 6, 6), sl('por1', 6, 6), sl('tur1', 5, 5) ] },
  { id: 'acle', name: 'AFC Champions League Elite', short: 'ACLE', confed: 'AFC', size: 16, format: 'groups', slots: [
    sl('ksa1', 1, 3), sl('jpn1', 1, 3), sl('kor1', 1, 2), sl('chn1', 1, 2), sl('qat1', 1, 1), sl('uae1', 1, 1), sl('aus1', 1, 1), sl('irn1', 1, 1), sl('idn1', 1, 1), sl('tha1', 1, 1) ] },
  { id: 'lib', name: 'Copa Libertadores', short: 'LIB', confed: 'CONMEBOL', size: 32, format: 'groups', slots: [
    sl('bra1', 1, 7), sl('arg1', 1, 6), sl('col1', 1, 4), sl('chi1', 1, 3), sl('ecu1', 1, 3), sl('uru1', 1, 3), sl('par1', 1, 3), sl('per1', 1, 3) ] },
  { id: 'sud', name: 'Copa Sudamericana', short: 'SUD', confed: 'CONMEBOL', size: 16, format: 'groups', slots: [
    sl('bra1', 8, 11), sl('arg1', 7, 9), sl('col1', 5, 6), sl('chi1', 4, 5), sl('ecu1', 4, 4), sl('uru1', 4, 4), sl('par1', 4, 4), sl('per1', 4, 4) ] },
  { id: 'ccc', name: 'CONCACAF Champions Cup', short: 'CCC', confed: 'CONCACAF', size: 16, format: 'ko', slots: [
    sl('usa1', 1, 7), sl('mex1', 1, 6), sl('crc1', 1, 3) ] },
  { id: 'cafcl', name: 'CAF Champions League', short: 'CAFCL', confed: 'CAF', size: 16, format: 'groups', slots: [
    sl('egy1', 1, 3), sl('mar1', 1, 3), sl('rsa1', 1, 2), sl('tun1', 1, 2), sl('alg1', 1, 2), sl('nga1', 1, 2), sl('gha1', 1, 2) ] },
  { id: 'cafcc', name: 'CAF Confederation Cup', short: 'CAFCC', confed: 'CAF', size: 16, format: 'groups', slots: [
    sl('egy1', 4, 6), sl('mar1', 4, 6), sl('rsa1', 3, 4), sl('tun1', 3, 4), sl('alg1', 3, 4), sl('nga1', 3, 4), sl('gha1', 3, 4) ] },
];

/** Domestic knockout cup definition for a nation (size 32 when the nation has enough clubs). */
export function domesticCupDef(nationId: string, name: string, clubCount: number): CompDef {
  return { id: `cup-${nationId.toLowerCase()}`, name, short: 'CUP', confed: 'DOMESTIC', size: clubCount >= 32 ? 32 : 16, format: 'ko', slots: [], nationId };
}

export const KO_NAMES: Record<number, string[]> = { 32: ['R32', 'R16', 'QF', 'SF', 'F'], 16: ['R16', 'QF', 'SF', 'F'], 8: ['QF', 'SF', 'F'], 4: ['SF', 'F'], 2: ['F'] };
export const ROUND_LABEL: Record<string, string> = { R32: 'Babak 32 Besar', R16: 'Babak 16 Besar', QF: 'Perempat Final', SF: 'Semifinal', F: 'FINAL' };

export function totalMatchdays(def: CompDef): number {
  const groups = def.format === 'groups' ? def.size / 4 : 0;
  const ko = groups ? groups * 2 : def.size;
  return (groups ? 6 : 0) + Math.log2(ko);
}

/** Spread n matchdays across a league season of R rounds (played before the league round of that week). */
export function buildSchedule(n: number, R: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    const f = n === 1 ? 0.5 : 0.08 + 0.82 * (k / (n - 1));
    let w = Math.round(f * R);
    w = Math.max(1, Math.min(R - 1, w));
    if (out.length && w <= out[out.length - 1]) w = out[out.length - 1] + 1;
    out.push(Math.min(w, R - 1));
  }
  return out;
}

/** Pick qualifiers: ranking(leagueId) returns club ids in final order. */
export function qualifiers(def: CompDef, ranking: (leagueId: string) => string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of def.slots) {
    const r = ranking(s.league);
    for (let k = s.from; k <= s.to; k++) {
      const id = r[k - 1];
      if (id && !seen.has(id)) { seen.add(id); out.push(id); }
    }
  }
  // Pad from the strongest remaining clubs of the listed leagues when a league is short.
  if (out.length < def.size) {
    const pool = def.slots.flatMap((s) => ranking(s.league)).filter((id) => !seen.has(id))
      .sort((a, b) => (CLUB_BY_ID.get(b)?.strength ?? 0) - (CLUB_BY_ID.get(a)?.strength ?? 0));
    for (const id of pool) { if (out.length >= def.size) break; seen.add(id); out.push(id); }
  }
  return out.slice(0, def.size);
}

function emptyTable(ids: string[]): TableRow[] {
  return ids.map((id) => ({ clubId: id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] }));
}

export function createCompetition(def: CompDef, teams: string[], season: number, R: number): CompetitionState {
  const seed = hashStr(`${def.id}:${season}`);
  const order = seededShuffle(teams, seed);
  const groupsN = def.format === 'groups' ? def.size / 4 : 0;
  const groups: CompetitionState['groups'] = [];
  const fixtures: CupFixture[] = [];
  if (groupsN) {
    // Seeded pots: strongest clubs spread across groups.
    const byStr = [...order].sort((a, b) => (CLUB_BY_ID.get(b)?.strength ?? 0) - (CLUB_BY_ID.get(a)?.strength ?? 0));
    for (let g = 0; g < groupsN; g++) groups.push({ teams: [], table: [] });
    byStr.forEach((id, i) => { const pot = Math.floor(i / groupsN); const g = pot % 2 === 0 ? i % groupsN : groupsN - 1 - (i % groupsN); groups[g].teams.push(id); });
    groups.forEach((g, gi) => {
      g.table = emptyTable(g.teams);
      const fx = withSeed(seed + gi + 1, () => makeFixturesFromIds(g.teams));
      for (const f of fx) fixtures.push({ md: f.round + 1, home: f.home, away: f.away, group: gi });
    });
  } else {
    // Straight knockout: pair by seeding (1v8, 2v7 ...).
    const byStr = [...order].sort((a, b) => (CLUB_BY_ID.get(b)?.strength ?? 0) - (CLUB_BY_ID.get(a)?.strength ?? 0));
    const names = KO_NAMES[def.size];
    for (let i = 0; i < byStr.length / 2; i++) fixtures.push({ md: 1, home: byStr[i], away: byStr[byStr.length - 1 - i], round: names[0] });
  }
  return {
    id: def.id, name: def.name, short: def.short, season, teams: order, groups, fixtures,
    schedule: buildSchedule(totalMatchdays(def), R), mdDone: 0, stage: groupsN ? 'group' : 'ko',
  };
}

export const mdAtWeek = (comp: CompetitionState, week: number): number | null => {
  const i = comp.schedule.indexOf(week);
  return i >= 0 && i === comp.mdDone ? i + 1 : null;
};

export const fixtureOf = (comp: CompetitionState, md: number, clubId: string): CupFixture | undefined =>
  comp.fixtures.find((f) => f.md === md && f.hg === undefined && (f.home === clubId || f.away === clubId));

export function isAlive(comp: CompetitionState, clubId: string): boolean {
  if (comp.stage === 'done') return comp.champion === clubId;
  if (!comp.teams.includes(clubId)) return false;
  if (comp.stage === 'group') return true;
  const ko = comp.fixtures.filter((f) => f.round);
  const last = ko.filter((f) => f.md === Math.max(...ko.map((x) => x.md)));
  return last.some((f) => f.home === clubId || f.away === clubId);
}

function decideWinner(f: CupFixture, strengthOf: (id: string) => number) {
  if (f.hg! > f.ag!) f.winner = f.home;
  else if (f.ag! > f.hg!) f.winner = f.away;
  else {
    const ph = 0.5 + (strengthOf(f.home) - strengthOf(f.away)) / 80;
    f.winner = Math.random() < ph ? f.home : f.away;
  }
}

/**
 * Simulate every unplayed fixture of matchday `md` (a user fixture may already
 * carry its result), then advance the stage when the matchday is complete.
 * Returns texts of notable events for the news feed.
 */
export function playMatchday(comp: CompetitionState, md: number, strengthOf: (id: string) => number): string[] {
  const news: string[] = [];
  const todays = comp.fixtures.filter((f) => f.md === md);
  for (const f of todays) {
    if (f.hg === undefined) { const [h, a] = quickSim(strengthOf(f.home), strengthOf(f.away)); f.hg = h; f.ag = a; }
    if (f.group !== undefined) recordResult(comp.groups[f.group].table, f.home, f.away, f.hg, f.ag!);
    if (f.round && !f.winner) decideWinner(f, strengthOf);
  }
  comp.mdDone = md;
  const groupMds = comp.groups.length ? 6 : 0;
  const nm = (id: string) => CLUB_BY_ID.get(id)?.name ?? id;
  if (comp.groups.length && md === groupMds) {
    // Group stage complete -> build first KO round: 1A v 2B, 1B v 2A, 1C v 2D, ...
    const q: { w: string; r: string }[] = comp.groups.map((g) => { const t = sortTable(g.table); return { w: t[0].clubId, r: t[1].clubId }; });
    const koTeams = q.length * 2;
    const names = KO_NAMES[koTeams];
    for (let i = 0; i < q.length; i += 2) {
      const b = q[i + 1] ?? q[i];
      comp.fixtures.push({ md: md + 1, home: q[i].w, away: b.r, round: names[0] });
      comp.fixtures.push({ md: md + 1, home: b.w, away: q[i].r, round: names[0] });
    }
    comp.stage = 'ko';
    return news;
  }
  if (comp.stage === 'ko') {
    const round = todays.filter((f) => f.round);
    if (round.length === 1 && round[0].round === 'F') {
      comp.stage = 'done';
      comp.champion = round[0].winner;
      news.push(`🏆 ${nm(round[0].winner!)} juara ${comp.name}! Final: ${nm(round[0].home)} ${round[0].hg}-${round[0].ag} ${nm(round[0].away)}.`);
      return news;
    }
    if (round.length > 1) {
      const names = KO_NAMES[round.length * 2];
      const next = names[names.indexOf(round[0].round!) + 1];
      for (let i = 0; i < round.length; i += 2) {
        comp.fixtures.push({ md: md + 1, home: round[i].winner!, away: round[i + 1].winner!, round: next });
      }
    }
  }
  return news;
}
