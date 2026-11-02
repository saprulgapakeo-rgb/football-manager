import type { GameState } from './types';
import { genSquad } from './players';
import { autoPick } from './formations';
import { addNews, genMarket, makeFixtures, makeLeague, makeTable } from './league';
import { LEAGUE_NAME } from './data';

export const SAVE_VERSION = 1;

export function newGame(account: string, clubName = 'Garuda Raya FC'): GameState {
  const short = clubName.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || 'GRF';
  const primary = '#10b981';
  const secondary = '#0b1220';
  const squad = genSquad(72, 'IDN');
  const tactics = { formation: '4-3-3' as const, mentality: 3, tempo: 3, pressing: 3 };
  const { lineup, bench } = autoPick(squad, tactics.formation);
  const league = makeLeague(clubName, short, primary, secondary);
  const s: GameState = {
    version: SAVE_VERSION,
    account,
    club: {
      name: clubName,
      short,
      primary,
      secondary,
      pattern: 'stripes',
      logo: { type: 'gen', shape: 'shield', symbol: 'eagle', showInitials: true },
    },
    squad,
    lineup,
    bench,
    tactics,
    familiarity: 40,
    coins: 300,
    transferBudget: 30,
    season: 1,
    week: 0,
    trainingLeft: 3,
    league,
    fixtures: makeFixtures(league),
    table: makeTable(league),
    market: genMarket(league),
    news: [],
    lastLoginDay: new Date().toDateString(),
    createdAt: Date.now(),
  };
  addNews(s, 'club', `${clubName} menunjuk manajer baru`, `Dewan direksi resmi memperkenalkan ${account} sebagai manajer baru untuk musim ${LEAGUE_NAME}. Manajemen menyediakan transfer budget €30M.`);
  return s;
}
