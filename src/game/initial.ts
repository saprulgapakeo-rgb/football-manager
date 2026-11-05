import type { GameState, StaffRole } from './types';
import { fmtMoney, genSquad } from './players';
import { autoPick } from './formations';
import { addNews, makeFixtures, makeLeague, makeTable } from './league';
import { LEAGUE_NAME, PLAYABLE_CLUBS, type ClubPreset } from './data';
import { CLUB_BY_ID, LEAGUE_BY_ID, NATION_BY_ID } from './world/db';
import { buildMarket, ensureWorld, initWorldForClub, userSquadFor } from './world/engine';

export const SAVE_VERSION = 1;

export function presetById(id?: string): ClubPreset | undefined {
  return PLAYABLE_CLUBS.find((p) => p.id === id);
}

/** Legacy / fictional-club career (kept for old saves and the original presets). */
export function newGame(account: string, clubName = 'Garuda Raya FC', opts: { role?: StaffRole; preset?: ClubPreset } = {}): GameState {
  const preset = opts.preset;
  const role: StaffRole = opts.role ?? 'Manajer';
  const name = preset ? preset.name : clubName;
  const short = preset
    ? preset.short
    : clubName.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || 'GRF';
  const primary = preset ? preset.primary : '#10b981';
  const secondary = preset ? preset.secondary : '#0b1220';
  const budget = preset ? preset.budget : 30;
  const squadOvr = preset ? preset.squad : 72;
  const squad = genSquad(squadOvr, preset ? preset.nationCode : 'IDN');
  const tactics = { formation: '4-3-3' as const, mentality: 3, tempo: 3, pressing: 3 };
  const { lineup, bench } = autoPick(squad, tactics.formation);
  const league = makeLeague(name, short, primary, secondary, squadOvr);
  const s: GameState = {
    version: SAVE_VERSION,
    account,
    role,
    clubPresetId: preset?.id,
    clubTier: preset?.tier,
    clubNation: preset?.nation,
    club: { name, short, primary, secondary, pattern: 'stripes', logo: { type: 'gen', shape: 'shield', symbol: 'eagle', showInitials: true } },
    squad, lineup, bench, tactics,
    familiarity: 40,
    coins: 300,
    transferBudget: budget,
    season: 1, week: 0, trainingLeft: 3,
    league,
    fixtures: makeFixtures(league),
    table: makeTable(league),
    market: [],
    news: [],
    lastLoginDay: new Date().toDateString(),
    createdAt: Date.now(),
  };
  ensureWorld(s);
  s.market = buildMarket(s);
  addNews(s, 'club', `${name} menunjuk ${role.toLowerCase()} baru`, `Dewan direksi resmi memperkenalkan ${account} sebagai ${role.toLowerCase()} baru untuk musim ${LEAGUE_NAME}. Manajemen menyediakan transfer budget ${fmtMoney(budget)}.`);
  return s;
}

/** Career at a club from the global database (any of the 600+ clubs). */
export function newGameAtDbClub(account: string, clubId: string, role: StaffRole): GameState {
  const c = CLUB_BY_ID.get(clubId)!;
  const league = LEAGUE_BY_ID.get(c.leagueId)!;
  const nation = NATION_BY_ID.get(c.nationId)!;
  const squad = userSquadFor(clubId);
  const tactics = { formation: '4-3-3' as const, mentality: 3, tempo: 3, pressing: 3 };
  const { lineup, bench } = autoPick(squad, tactics.formation);
  const tierLabel = c.strength >= 80 ? 'Elit' : c.strength >= 72 ? 'Atas' : c.strength >= 65 ? 'Menengah' : 'Bawah';
  const s: GameState = {
    version: SAVE_VERSION,
    account,
    role,
    clubPresetId: clubId,
    clubTier: tierLabel,
    clubNation: nation.name,
    club: { name: c.name, short: c.short, primary: c.primary, secondary: c.secondary, pattern: 'stripes', logo: { type: 'gen', shape: 'shield', symbol: 'star', showInitials: true } },
    squad, lineup, bench, tactics,
    familiarity: 45,
    coins: 300,
    transferBudget: c.budget,
    season: 1, week: 0, trainingLeft: 3,
    league: [], fixtures: [], table: [],
    market: [],
    news: [],
    lastLoginDay: new Date().toDateString(),
    createdAt: Date.now(),
  };
  initWorldForClub(s, clubId);
  s.market = buildMarket(s);
  addNews(s, 'club', `${c.name} menunjuk ${role.toLowerCase()} baru`, `Dewan direksi ${c.name} resmi memperkenalkan ${account} sebagai ${role.toLowerCase()} baru untuk musim ${league.name} (${nation.name}). Kandang: ${c.stadium} (${c.capacity.toLocaleString('id-ID')} kursi). Transfer budget ${fmtMoney(c.budget)}.`);
  return s;
}

/** Entry point used by club selection: DB club id or legacy preset id. */
export function newGameWithClub(account: string, clubId: string, role: StaffRole): GameState {
  if (CLUB_BY_ID.has(clubId)) return newGameAtDbClub(account, clubId, role);
  const preset = presetById(clubId) ?? PLAYABLE_CLUBS[0];
  return newGame(account, preset.name, { role, preset });
}
