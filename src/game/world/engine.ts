// Career-side integration of the world database: migration of old saves, weekly
// simulation of every other league, continental cups, promotion/relegation,
// transfer market sourcing and AI transfers.

import type { Fixture, GameState, LeagueClub, MarketPlayer, Player, TableRow, WorldState } from '../types';
import { makeFixturesFromIds, makeFixtures, makeTable, quickSim, recordResult, sortTable, totalRounds, addNews } from '../league';
import { ovrOf, pick, playerValue, rand } from '../players';
import { LEAGUE_NAME } from '../data';
import { CLUBS, CLUB_BY_ID, CUP_NAMES, INITIAL_MEMBERS, LEAGUES, LEAGUE_BY_ID, NATION_BY_ID, confedOfClub, type DbClub } from './db';
import { addToClub, baseSquad, getClubSquad, hashStr, removeFromClub, withSeed } from './squads';
import { COMP_DEFS, ROUND_LABEL, createCompetition, domesticCupDef, fixtureOf, mdAtWeek, playMatchday, qualifiers, type CompDef } from './competitions';
import type { MatchResult } from '../matchEngine';

export const LEGACY = 'legacy';

export const toLeagueClub = (c: DbClub): LeagueClub => ({ id: c.id, name: c.name, short: c.short, primary: c.primary, secondary: c.secondary, rating: c.strength });

export const leagueNameOf = (s: GameState) => s.world?.leagueName ?? LEAGUE_NAME;

export function findClub(s: GameState, id: string): LeagueClub {
  const inLeague = s.league.find((c) => c.id === id);
  if (inLeague) return inLeague;
  const db = CLUB_BY_ID.get(id);
  if (db) return toLeagueClub(db);
  return { id, name: id, short: id.slice(0, 3).toUpperCase(), primary: '#334155', secondary: '#ffffff', rating: 68 };
}

const emptyTable = (ids: string[]): TableRow[] => ids.map((id) => ({ clubId: id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] }));

/** Strength lookup used by all background simulations. */
export function strengthOf(s: GameState): (id: string) => number {
  const w = s.world!;
  const user = s.league.find((c) => c.isUser);
  return (id: string) => {
    if (id === 'user' || id === w.clubId) return user?.rating ?? 70;
    return CLUB_BY_ID.get(id)?.strength ?? s.league.find((c) => c.id === id)?.rating ?? 66;
  };
}

/** Final/current ordering of a league (user league comes from GameState.table). */
export function rankingOf(s: GameState, leagueId: string): string[] {
  const w = s.world!;
  if (leagueId === w.leagueId && leagueId !== LEGACY && s.table.some((r) => r.p > 0)) return sortTable(s.table).map((r) => (r.clubId === 'user' ? w.clubId : r.clubId));
  const t = w.tables[leagueId];
  if (t && t.length && t.some((r) => r.p > 0)) return sortTable(t).map((r) => r.clubId);
  // Nothing played yet (season start): seed by strength + reputation.
  const members = w.leagueMembers[leagueId] ?? [];
  return [...members].sort((a, b) => score(b) - score(a));
}
const score = (id: string) => { const c = CLUB_BY_ID.get(id); return c ? c.strength + c.reputation * 2 : 0; };

// ---------- world creation & migration ----------
function blankWorld(): WorldState {
  return {
    leagueId: LEGACY, clubId: 'user', nationId: null, leagueName: LEAGUE_NAME,
    leagueMembers: structuredClone(INITIAL_MEMBERS), tables: {}, removed: {}, added: {},
    transfers: [], comps: [], pendingCup: null, honours: [],
  };
}

export function buildUserLeague(s: GameState): LeagueClub[] {
  const w = s.world!;
  const me = s.league.find((c) => c.isUser) ?? { id: 'user', name: s.club.name, short: s.club.short, primary: s.club.primary, secondary: s.club.secondary, rating: 70, isUser: true };
  const members = w.leagueMembers[w.leagueId] ?? [];
  return [{ ...me, id: 'user', isUser: true }, ...members.filter((id) => id !== w.clubId).map((id) => toLeagueClub(CLUB_BY_ID.get(id)!))];
}

function resetWorldTables(s: GameState) {
  const w = s.world!;
  w.tables = {};
  for (const l of LEAGUES) if (l.id !== w.leagueId) w.tables[l.id] = emptyTable(w.leagueMembers[l.id] ?? []);
}

/** Continental competitions + the user's national cup. */
function compDefsFor(s: GameState): CompDef[] {
  const w = s.world!;
  const defs = [...COMP_DEFS];
  if (w.nationId) {
    const n = CLUBS.filter((c) => c.nationId === w.nationId).length;
    defs.push(domesticCupDef(w.nationId, CUP_NAMES[w.nationId] ?? `Piala ${NATION_BY_ID.get(w.nationId)?.name ?? w.nationId}`, n));
  }
  return defs;
}

/** Domestic cup entrants: every club of the nation ordered by division then current rank. */
function cupEntrants(def: CompDef, rank: (lid: string) => string[]): string[] {
  const out: string[] = [];
  for (const l of LEAGUES.filter((x) => x.nationId === def.nationId).sort((a, b) => a.tier - b.tier)) out.push(...rank(l.id));
  return out.slice(0, def.size);
}

function makeComp(def: CompDef, rank: (lid: string) => string[], season: number, R: number) {
  const teams = def.nationId ? cupEntrants(def, rank) : qualifiers(def, rank);
  return createCompetition(def, teams, season, R);
}

export function setupCompetitions(s: GameState) {
  const w = s.world!;
  const R = Math.max(10, totalRounds(s.league));
  w.comps = compDefsFor(s).map((def) => makeComp(def, (lid) => rankingOf(s, lid), s.season, R));
  w.pendingCup = null;
  for (const c of w.comps) {
    if (c.teams.includes(w.clubId)) addNews(s, 'season', `${s.club.name} lolos ke ${c.name}!`, `Klub akan bertanding di ${c.name} musim ${s.season}. Jadwal matchday akan muncul di Match Day di sela-sela pekan liga.`);
  }
}

/** Create the world for a brand-new career at a DB club. Mutates the freshly built state. */
export function initWorldForClub(s: GameState, clubId: string) {
  const c = CLUB_BY_ID.get(clubId)!;
  const league = LEAGUE_BY_ID.get(c.leagueId)!;
  s.world = { ...blankWorld(), leagueId: league.id, clubId, nationId: c.nationId, leagueName: league.name };
  s.league = [{ id: 'user', name: c.name, short: c.short, primary: c.primary, secondary: c.secondary, rating: c.strength, isUser: true }];
  s.league = buildUserLeague(s);
  s.fixtures = makeFixtures(s.league);
  s.table = makeTable(s.league);
  resetWorldTables(s);
  setupCompetitions(s);
}

/** Lazy migration for saves created before the world database existed. */
export function ensureWorld(s: GameState) {
  if (s.world && s.world.leagueMembers && s.world.comps) return;
  s.world = blankWorld();
  resetWorldTables(s);
  // Legacy league keeps its own fixtures/table; comps and other leagues run in the background.
  setupCompetitions(s);
}

// ---------- weekly simulation ----------
const fxCache = new Map<string, Fixture[]>();
export function leagueFixtures(leagueId: string, season: number, members: string[]): Fixture[] {
  const key = `${leagueId}:${season}:${members.join(',')}`;
  const hit = fxCache.get(key);
  if (hit) return hit;
  const fx = withSeed(hashStr(key), () => makeFixturesFromIds(members));
  if (fxCache.size > 60) fxCache.delete(fxCache.keys().next().value as string);
  fxCache.set(key, fx);
  return fx;
}

export function simulateWorldRound(s: GameState, round: number) {
  const w = s.world!;
  const str = strengthOf(s);
  for (const l of LEAGUES) {
    if (l.id === w.leagueId) continue;
    const members = w.leagueMembers[l.id] ?? [];
    if (members.length < 2) continue;
    const R = (members.length - 1) * 2;
    if (round >= R) continue;
    const table = w.tables[l.id] ?? (w.tables[l.id] = emptyTable(members));
    for (const f of leagueFixtures(l.id, s.season, members)) {
      if (f.round !== round) continue;
      const [h, a] = quickSim(str(f.home), str(f.away));
      recordResult(table, f.home, f.away, h, a);
    }
  }
}

/** Called right after GameState.week is incremented. Handles cup matchdays. */
export function onWeekAdvanced(s: GameState) {
  const w = s.world!;
  const str = strengthOf(s);
  for (const comp of w.comps) {
    const md = mdAtWeek(comp, s.week);
    if (!md) continue;
    const uf = fixtureOf(comp, md, w.clubId);
    if (uf && w.leagueId !== LEGACY) { w.pendingCup = { compId: comp.id, md, home: uf.home, away: uf.away }; continue; }
    for (const n of playMatchday(comp, md, str)) addNews(s, 'season', n.split('!')[0] + '!', n);
  }
}

export function applyUserCupResult(s: GameState, r: MatchResult): { compName: string; text: string } | null {
  const w = s.world!;
  const pc = w.pendingCup;
  if (!pc) return null;
  const comp = w.comps.find((c) => c.id === pc.compId);
  w.pendingCup = null;
  if (!comp) return null;
  const f = comp.fixtures.find((x) => x.md === pc.md && x.home === pc.home && x.away === pc.away);
  if (!f) return null;
  f.hg = r.homeIsUser ? r.userGoals : r.oppGoals;
  f.ag = r.homeIsUser ? r.oppGoals : r.userGoals;
  const str = strengthOf(s);
  const news = playMatchday(comp, pc.md, str);
  for (const n of news) addNews(s, 'season', n.split('!')[0] + '!', n);
  let text = '';
  if (f.round) {
    const won = f.winner === w.clubId;
    text = won ? (f.round === 'F' ? `🏆 ${s.club.name} JUARA ${comp.name}!` : `${s.club.name} melaju ke babak berikutnya di ${comp.name}.`) : `${s.club.name} tersingkir dari ${comp.name} di ${ROUND_LABEL[f.round]}.`;
    if (won && f.round === 'F') { w.honours.push({ season: s.season, title: comp.name }); s.coins += 1000; s.transferBudget = Math.round((s.transferBudget + 15) * 10) / 10; }
  } else {
    const g = comp.groups[f.group!];
    const pos = sortTable(g.table).findIndex((t) => t.clubId === w.clubId) + 1;
    text = `Grup ${String.fromCharCode(65 + f.group!)} ${comp.short}: ${s.club.name} kini peringkat ${pos} setelah matchday ${f.md}.`;
  }
  return { compName: comp.name, text };
}

// ---------- season rollover ----------
export function processSeasonEnd(s: GameState, prize: number) {
  const w = s.world!;
  const str = strengthOf(s);
  const userR = totalRounds(s.league);
  // 1) finish longer leagues
  for (const l of LEAGUES) {
    if (l.id === w.leagueId) continue;
    const R = ((w.leagueMembers[l.id]?.length ?? 0) - 1) * 2;
    for (let r = userR; r < R; r++) simulateWorldRound(s, r);
  }
  // 2) finish cups (user fixtures left unplayed are simulated)
  for (const comp of w.comps) {
    let guard = 0;
    while (comp.stage !== 'done' && guard++ < 12) {
      for (const n of playMatchday(comp, comp.mdDone + 1, str)) addNews(s, 'season', n.split('!')[0] + '!', n);
    }
    if (comp.champion === w.clubId && !w.honours.some((h) => h.season === s.season && h.title === comp.name)) {
      w.honours.push({ season: s.season, title: comp.name });
      s.coins += 1000; s.transferBudget = Math.round((s.transferBudget + 15) * 10) / 10;
    }
  }
  w.pendingCup = null;
  // 3) final rankings before anything moves
  const finalRank: Record<string, string[]> = {};
  for (const l of LEAGUES) finalRank[l.id] = rankingOf(s, l.id);
  if (w.leagueId !== LEGACY) {
    const champ = finalRank[w.leagueId][0];
    if (champ === w.clubId) w.honours.push({ season: s.season, title: w.leagueName });
    // nation headlines
    const nation = NATION_BY_ID.get(w.nationId ?? '');
    for (const l of LEAGUES.filter((x) => x.nationId === w.nationId && x.id !== w.leagueId)) {
      const c = CLUB_BY_ID.get(finalRank[l.id][0]);
      if (c && nation) addNews(s, 'season', `${c.name} juara ${l.name} (${nation.name})`, `Musim ${s.season} ${l.name} berakhir dengan ${c.name} sebagai kampiun.`);
    }
  }
  // 4) promotion / relegation (top-down per nation)
  for (const l of LEAGUES) {
    if (!l.below || !l.rel) continue;
    const down = finalRank[l.id].slice(-l.rel);
    const up = finalRank[l.below].slice(0, l.rel);
    if (!down.length || !up.length) continue;
    w.leagueMembers[l.id] = (w.leagueMembers[l.id] ?? []).filter((id) => !down.includes(id)).concat(up);
    w.leagueMembers[l.below] = (w.leagueMembers[l.below] ?? []).filter((id) => !up.includes(id)).concat(down);
    if (down.includes(w.clubId)) {
      const nl = LEAGUE_BY_ID.get(l.below)!;
      addNews(s, 'season', `${s.club.name} TERDEGRADASI ke ${nl.name}`, `Finis di zona degradasi ${l.name}. Musim depan klub berlaga di ${nl.name}.`);
      w.leagueId = nl.id; w.leagueName = nl.name;
    } else if (up.includes(w.clubId)) {
      addNews(s, 'season', `${s.club.name} PROMOSI ke ${l.name}!`, `Finis di zona promosi ${LEAGUE_BY_ID.get(l.below)!.name}. Musim depan klub berlaga di ${l.name}. Bonus budget +${prize}M.`);
      w.leagueId = l.id; w.leagueName = l.name;
      s.transferBudget = Math.round((s.transferBudget + prize) * 10) / 10;
    }
  }
  // 5) AI transfers between clubs
  aiTransfers(s, 30);
  // 6) rebuild structures for the new season
  s.season++;
  s.week = 0;
  if (w.leagueId !== LEGACY) {
    s.league = buildUserLeague(s);
    s.fixtures = makeFixtures(s.league);
    s.table = makeTable(s.league);
  } else {
    s.fixtures = makeFixtures(s.league);
    s.table = makeTable(s.league);
  }
  resetWorldTables(s);
  // 7) qualification from final rankings (tables are already reset -> use captured ranks)
  const R = Math.max(10, totalRounds(s.league));
  w.comps = compDefsFor(s).map((def) => makeComp(def, (lid) => finalRank[lid] ?? [], s.season, R));
  for (const c of w.comps) if (c.teams.includes(w.clubId)) addNews(s, 'season', `${s.club.name} lolos ke ${c.name}!`, `Berkat hasil musim lalu, klub akan tampil di ${c.name} musim ${s.season}.`);
  fxCache.clear();
}

// ---------- transfers ----------
export function buildMarket(s: GameState, count = 24): MarketPlayer[] {
  const w = s.world!;
  const myConfed = w.nationId ? NATION_BY_ID.get(w.nationId)?.confed : null;
  const userIds = new Set(s.squad.map((p) => p.id));
  const pool = CLUBS.filter((c) => c.id !== w.clubId);
  const near = myConfed ? pool.filter((c) => NATION_BY_ID.get(c.nationId)!.confed === myConfed) : pool;
  const out: MarketPlayer[] = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 6) {
    const club = Math.random() < 0.6 && near.length ? pick(near) : pick(pool);
    const squad = getClubSquad(s, club.id).filter((p) => !userIds.has(p.id) && (p.pos !== 'GK' || Math.random() < 0.15));
    if (squad.length < 16) continue;
    const p = pick(squad);
    if (out.some((m) => m.id === p.id)) continue;
    const value = playerValue(ovrOf(p), p.age, p.potential);
    out.push({ ...p, club: club.name, clubId: club.id, askingPrice: Math.round(value * rand(1.05, 1.35) * 10) / 10, status: 'available' });
  }
  return out.sort((a, b) => ovrOf(b) - ovrOf(a));
}

export function logTransfer(s: GameState, p: Player, from: string, to: string, fee: number) {
  const w = s.world!;
  w.transfers.unshift({ season: s.season, week: s.week + 1, playerId: p.id, name: p.name, pos: p.pos, from, to, fee, ts: Date.now() });
  if (w.transfers.length > 120) w.transfers.pop();
}

/** Player bought by the user: remove from the selling club so nobody owns him twice. */
export function recordIncoming(s: GameState, mp: MarketPlayer, fee: number) {
  if (mp.clubId && CLUB_BY_ID.has(mp.clubId)) removeFromClub(s, mp.clubId, mp.id);
  logTransfer(s, mp, mp.club, s.club.name, fee);
}

/** Player sold by the user: pick a plausible buyer and add him to that club. */
export function recordOutgoing(s: GameState, p: Player, fee: number): DbClub {
  const w = s.world!;
  const o = ovrOf(p);
  const confed = w.nationId ? NATION_BY_ID.get(w.nationId)?.confed : null;
  let cands = CLUBS.filter((c) => c.id !== w.clubId && Math.abs(c.strength - o) <= 6);
  if (confed) { const same = cands.filter((c) => NATION_BY_ID.get(c.nationId)!.confed === confed); if (same.length >= 4) cands = same; }
  const buyer = cands.length ? pick(cands) : pick(CLUBS);
  addToClub(s, buyer.id, { ...p, apps: 0, goals: 0, assists: 0, ratingSum: 0 });
  logTransfer(s, p, s.club.name, buyer.name, fee);
  return buyer;
}

export function aiTransfers(s: GameState, n: number) {
  const w = s.world!;
  for (let k = 0; k < n; k++) {
    const a = pick(CLUBS);
    if (a.id === w.clubId) continue;
    const squad = getClubSquad(s, a.id);
    if (squad.length <= 21) continue;
    const p = pick(squad);
    const o = ovrOf(p);
    const confed = confedOfClub(a.id);
    const cands = CLUBS.filter((c) => c.id !== a.id && c.id !== w.clubId && confedOfClub(c.id) === confed && Math.abs(c.strength - o) <= 5);
    if (!cands.length) continue;
    const b = pick(cands);
    if (getClubSquad(s, b.id).length >= 28) continue;
    removeFromClub(s, a.id, p.id);
    addToClub(s, b.id, p);
    logTransfer(s, p, a.name, b.name, Math.round(playerValue(o, p.age, p.potential) * rand(0.8, 1.2) * 10) / 10);
  }
}

// ---------- match scheduling ----------
export interface NextMatch {
  kind: 'league' | 'cup';
  title: string; sub: string;
  opp: LeagueClub; homeIsUser: boolean; oppSquad: Player[];
}

export function getNextMatch(s: GameState): NextMatch | null {
  const w = s.world;
  if (w?.pendingCup) {
    const pc = w.pendingCup;
    const comp = w.comps.find((c) => c.id === pc.compId);
    const homeIsUser = pc.home === w.clubId;
    const oppId = homeIsUser ? pc.away : pc.home;
    const f = comp?.fixtures.find((x) => x.md === pc.md && x.home === pc.home && x.away === pc.away);
    const sub = f?.round ? ROUND_LABEL[f.round] : `Grup ${String.fromCharCode(65 + (f?.group ?? 0))} · Matchday ${pc.md}`;
    return { kind: 'cup', title: comp?.name ?? 'Kompetisi', sub, opp: findClub(s, oppId), homeIsUser, oppSquad: getClubSquad(s, oppId) };
  }
  const fx = s.fixtures.find((f) => f.round === s.week && (f.home === 'user' || f.away === 'user'));
  if (!fx) return null;
  const homeIsUser = fx.home === 'user';
  const oppId = homeIsUser ? fx.away : fx.home;
  const opp = findClub(s, oppId);
  return { kind: 'league', title: leagueNameOf(s), sub: `Pekan ${s.week + 1}`, opp, homeIsUser, oppSquad: getClubSquad(s, oppId, opp.rating) };
}

/** User squad for a new DB career = the club's own database squad (so the selected club "has its own squad"). */
export function userSquadFor(clubId: string): Player[] {
  return baseSquad(clubId).map((p) => ({ ...p, attrs: { ...p.attrs }, form: [...p.form] }));
}
