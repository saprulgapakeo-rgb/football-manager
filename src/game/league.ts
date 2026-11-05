import type { Fixture, GameState, LeagueClub, MarketPlayer, NewsItem, NewsType, TableRow } from './types';
import { AI_CLUBS } from './data';
import { clamp, genPlayer, ovrOf, pick, playerValue, rand, randi, uid } from './players';
import type { Pos } from './types';

export function makeLeague(userName: string, userShort: string, primary: string, secondary: string, userRating = 72): LeagueClub[] {
  return [
    { id: 'user', name: userName, short: userShort, primary, secondary, rating: userRating, isUser: true },
    ...AI_CLUBS.map((c, i) => ({ id: 'c' + i, ...c })),
  ];
}

/** Double round robin via circle method */
export function makeFixtures(clubs: LeagueClub[]): Fixture[] {
  return makeFixturesFromIds(clubs.map((c) => c.id));
}

/** Same scheduler for any list of club ids (used by every league in the world DB). */
export function makeFixturesFromIds(clubIds: string[]): Fixture[] {
  const ids = [...clubIds].sort(() => Math.random() - 0.5);
  if (ids.length % 2) ids.push('BYE');
  const n = ids.length;
  const rounds: Fixture[] = [];
  const arr = [...ids];
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      if (a === 'BYE' || b === 'BYE') continue;
      const flip = (r + i) % 2 === 0;
      rounds.push({ round: r, home: flip ? a : b, away: flip ? b : a });
    }
    arr.splice(1, 0, arr.pop()!);
  }
  const second = rounds.map((f) => ({ round: f.round + (n - 1), home: f.away, away: f.home }));
  return [...rounds, ...second];
}

export const totalRounds = (clubs: LeagueClub[]) => (clubs.length - 1) * 2;

export function makeTable(clubs: LeagueClub[]): TableRow[] {
  return clubs.map((c) => ({ clubId: c.id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] }));
}

export function sortTable(t: TableRow[]) {
  return [...t].sort((a, b) => b.pts - a.pts || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf);
}

export function recordResult(table: TableRow[], home: string, away: string, hg: number, ag: number) {
  const h = table.find((r) => r.clubId === home)!;
  const a = table.find((r) => r.clubId === away)!;
  h.p++; a.p++; h.gf += hg; h.ga += ag; a.gf += ag; a.ga += hg;
  const push = (r: TableRow, x: 'W' | 'D' | 'L') => { r.form = [...r.form, x].slice(-5); };
  if (hg > ag) { h.w++; a.l++; h.pts += 3; push(h, 'W'); push(a, 'L'); }
  else if (hg < ag) { a.w++; h.l++; a.pts += 3; push(a, 'W'); push(h, 'L'); }
  else { h.d++; a.d++; h.pts++; a.pts++; push(h, 'D'); push(a, 'D'); }
}

function poisson(l: number) {
  const L = Math.exp(-l);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

export function quickSim(hr: number, ar: number): [number, number] {
  const diff = (hr + 2 - ar) / 10;
  return [poisson(clamp(1.35 + diff * 0.6, 0.3, 3.5)), poisson(clamp(1.15 - diff * 0.6, 0.25, 3.2))];
}

const MARKET_POS: Pos[] = ['GK', 'CB', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST', 'ST'];

export function genMarket(clubs: LeagueClub[], count = 24): MarketPlayer[] {
  const ai = clubs.filter((c) => !c.isUser);
  const extra = ['Hartwell Albion', 'CD Puerto Alcor', 'SV Rheinmark', 'AC Veltrona', 'Persija Raya Utama', 'Benfeira SC', 'Osaka Blue Kites', 'Lagos Stars FC'];
  return Array.from({ length: count }, () => {
    const fromLeague = Math.random() < 0.6;
    const club = fromLeague ? pick(ai) : null;
    const base = club ? club.rating : randi(62, 80);
    const ovr = Math.round(clamp(base + rand(-8, 7), 58, 89));
    const p = genPlayer(pick(MARKET_POS), ovr, { age: randi(18, 33) });
    const real = ovrOf(p);
    const value = playerValue(real, p.age, p.potential);
    return {
      ...p,
      club: club ? club.name : pick(extra),
      askingPrice: Math.round(value * rand(1.05, 1.35) * 10) / 10,
      status: 'available' as const,
    };
  }).sort((a, b) => ovrOf(b) - ovrOf(a));
}

export function addNews(s: GameState, type: NewsType, title: string, body: string) {
  const item: NewsItem = { id: uid(), type, title, body, season: s.season, week: s.week + 1, ts: Date.now() };
  s.news = [item, ...s.news].slice(0, 80);
}
