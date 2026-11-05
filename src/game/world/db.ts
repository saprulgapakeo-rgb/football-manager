// Global football database — static reference data (never mutated at runtime).
// Mutable career state (league membership after promotion/relegation, transfers,
// standings) lives in GameState.world. See engine.ts.

import { CLUB_DATA_EUROPE } from './clubs-europe';
import { CLUB_DATA_WORLD } from './clubs-world';
import { CLUB_DATA_EXTRA } from './clubs-extra';

export type Continent = 'Eropa' | 'Asia' | 'Amerika Selatan' | 'Amerika Utara' | 'Afrika';
export type Confed = 'UEFA' | 'AFC' | 'CONMEBOL' | 'CONCACAF' | 'CAF';

export interface DbNation { id: string; name: string; continent: Continent; confed: Confed; flag: string }
export interface DbLeague { id: string; nationId: string; name: string; tier: number; below: string | null; rel: number }
export interface DbClub {
  id: string; name: string; short: string; nationId: string; leagueId: string;
  primary: string; secondary: string; strength: number; reputation: number;
  budget: number; stadium: string; capacity: number;
}

export const CONTINENTS: Continent[] = ['Eropa', 'Asia', 'Amerika Selatan', 'Amerika Utara', 'Afrika'];

export const NATIONS: DbNation[] = [
  { id: 'ENG', name: 'Inggris', continent: 'Eropa', confed: 'UEFA', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 'ESP', name: 'Spanyol', continent: 'Eropa', confed: 'UEFA', flag: '🇪🇸' },
  { id: 'GER', name: 'Jerman', continent: 'Eropa', confed: 'UEFA', flag: '🇩🇪' },
  { id: 'ITA', name: 'Italia', continent: 'Eropa', confed: 'UEFA', flag: '🇮🇹' },
  { id: 'FRA', name: 'Prancis', continent: 'Eropa', confed: 'UEFA', flag: '🇫🇷' },
  { id: 'NED', name: 'Belanda', continent: 'Eropa', confed: 'UEFA', flag: '🇳🇱' },
  { id: 'POR', name: 'Portugal', continent: 'Eropa', confed: 'UEFA', flag: '🇵🇹' },
  { id: 'BEL', name: 'Belgia', continent: 'Eropa', confed: 'UEFA', flag: '🇧🇪' },
  { id: 'SCO', name: 'Skotlandia', continent: 'Eropa', confed: 'UEFA', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  { id: 'TUR', name: 'Turki', continent: 'Eropa', confed: 'UEFA', flag: '🇹🇷' },
  { id: 'IDN', name: 'Indonesia', continent: 'Asia', confed: 'AFC', flag: '🇮🇩' },
  { id: 'JPN', name: 'Jepang', continent: 'Asia', confed: 'AFC', flag: '🇯🇵' },
  { id: 'KOR', name: 'Korea Selatan', continent: 'Asia', confed: 'AFC', flag: '🇰🇷' },
  { id: 'KSA', name: 'Arab Saudi', continent: 'Asia', confed: 'AFC', flag: '🇸🇦' },
  { id: 'THA', name: 'Thailand', continent: 'Asia', confed: 'AFC', flag: '🇹🇭' },
  { id: 'BRA', name: 'Brasil', continent: 'Amerika Selatan', confed: 'CONMEBOL', flag: '🇧🇷' },
  { id: 'ARG', name: 'Argentina', continent: 'Amerika Selatan', confed: 'CONMEBOL', flag: '🇦🇷' },
  { id: 'URU', name: 'Uruguay', continent: 'Amerika Selatan', confed: 'CONMEBOL', flag: '🇺🇾' },
  { id: 'USA', name: 'Amerika Serikat', continent: 'Amerika Utara', confed: 'CONCACAF', flag: '🇺🇸' },
  { id: 'MEX', name: 'Meksiko', continent: 'Amerika Utara', confed: 'CONCACAF', flag: '🇲🇽' },
  { id: 'NGA', name: 'Nigeria', continent: 'Afrika', confed: 'CAF', flag: '🇳🇬' },
  { id: 'EGY', name: 'Mesir', continent: 'Afrika', confed: 'CAF', flag: '🇪🇬' },
  { id: 'RSA', name: 'Afrika Selatan', continent: 'Afrika', confed: 'CAF', flag: '🇿🇦' },
  { id: 'AUT', name: 'Austria', continent: 'Eropa', confed: 'UEFA', flag: '🇦🇹' },
  { id: 'SUI', name: 'Swiss', continent: 'Eropa', confed: 'UEFA', flag: '🇨🇭' },
  { id: 'GRE', name: 'Yunani', continent: 'Eropa', confed: 'UEFA', flag: '🇬🇷' },
  { id: 'DEN', name: 'Denmark', continent: 'Eropa', confed: 'UEFA', flag: '🇩🇰' },
  { id: 'POL', name: 'Polandia', continent: 'Eropa', confed: 'UEFA', flag: '🇵🇱' },
  { id: 'CRO', name: 'Kroasia', continent: 'Eropa', confed: 'UEFA', flag: '🇭🇷' },
  { id: 'CZE', name: 'Ceko', continent: 'Eropa', confed: 'UEFA', flag: '🇨🇿' },
  { id: 'SRB', name: 'Serbia', continent: 'Eropa', confed: 'UEFA', flag: '🇷🇸' },
  { id: 'NOR', name: 'Norwegia', continent: 'Eropa', confed: 'UEFA', flag: '🇳🇴' },
  { id: 'SWE', name: 'Swedia', continent: 'Eropa', confed: 'UEFA', flag: '🇸🇪' },
  { id: 'UKR', name: 'Ukraina', continent: 'Eropa', confed: 'UEFA', flag: '🇺🇦' },
  { id: 'RUS', name: 'Rusia', continent: 'Eropa', confed: 'UEFA', flag: '🇷🇺' },
  { id: 'CHN', name: 'Tiongkok', continent: 'Asia', confed: 'AFC', flag: '🇨🇳' },
  { id: 'QAT', name: 'Qatar', continent: 'Asia', confed: 'AFC', flag: '🇶🇦' },
  { id: 'UAE', name: 'Uni Emirat Arab', continent: 'Asia', confed: 'AFC', flag: '🇦🇪' },
  { id: 'AUS', name: 'Australia', continent: 'Asia', confed: 'AFC', flag: '🇦🇺' },
  { id: 'IRN', name: 'Iran', continent: 'Asia', confed: 'AFC', flag: '🇮🇷' },
  { id: 'MAS', name: 'Malaysia', continent: 'Asia', confed: 'AFC', flag: '🇲🇾' },
  { id: 'VIE', name: 'Vietnam', continent: 'Asia', confed: 'AFC', flag: '🇻🇳' },
  { id: 'COL', name: 'Kolombia', continent: 'Amerika Selatan', confed: 'CONMEBOL', flag: '🇨🇴' },
  { id: 'CHI', name: 'Chili', continent: 'Amerika Selatan', confed: 'CONMEBOL', flag: '🇨🇱' },
  { id: 'ECU', name: 'Ekuador', continent: 'Amerika Selatan', confed: 'CONMEBOL', flag: '🇪🇨' },
  { id: 'PAR', name: 'Paraguay', continent: 'Amerika Selatan', confed: 'CONMEBOL', flag: '🇵🇾' },
  { id: 'PER', name: 'Peru', continent: 'Amerika Selatan', confed: 'CONMEBOL', flag: '🇵🇪' },
  { id: 'CRC', name: 'Kosta Rika', continent: 'Amerika Utara', confed: 'CONCACAF', flag: '🇨🇷' },
  { id: 'MAR', name: 'Maroko', continent: 'Afrika', confed: 'CAF', flag: '🇲🇦' },
  { id: 'TUN', name: 'Tunisia', continent: 'Afrika', confed: 'CAF', flag: '🇹🇳' },
  { id: 'ALG', name: 'Aljazair', continent: 'Afrika', confed: 'CAF', flag: '🇩🇿' },
  { id: 'GHA', name: 'Ghana', continent: 'Afrika', confed: 'CAF', flag: '🇬🇭' },
];

// rel = clubs relegated to `below` each season (== clubs promoted from `below`).
export const LEAGUES: DbLeague[] = [
  { id: 'eng1', nationId: 'ENG', name: 'Premier League', tier: 1, below: 'eng2', rel: 3 },
  { id: 'eng2', nationId: 'ENG', name: 'Championship', tier: 2, below: 'eng3', rel: 3 },
  { id: 'eng3', nationId: 'ENG', name: 'League One', tier: 3, below: 'eng4', rel: 3 },
  { id: 'eng4', nationId: 'ENG', name: 'League Two', tier: 4, below: null, rel: 0 },
  { id: 'esp1', nationId: 'ESP', name: 'La Liga', tier: 1, below: 'esp2', rel: 3 },
  { id: 'esp2', nationId: 'ESP', name: 'Segunda División', tier: 2, below: null, rel: 0 },
  { id: 'ger1', nationId: 'GER', name: 'Bundesliga', tier: 1, below: 'ger2', rel: 2 },
  { id: 'ger2', nationId: 'GER', name: '2. Bundesliga', tier: 2, below: 'ger3', rel: 2 },
  { id: 'ger3', nationId: 'GER', name: '3. Liga', tier: 3, below: null, rel: 0 },
  { id: 'ita1', nationId: 'ITA', name: 'Serie A', tier: 1, below: 'ita2', rel: 3 },
  { id: 'ita2', nationId: 'ITA', name: 'Serie B', tier: 2, below: 'ita3', rel: 3 },
  { id: 'ita3', nationId: 'ITA', name: 'Serie C', tier: 3, below: null, rel: 0 },
  { id: 'fra1', nationId: 'FRA', name: 'Ligue 1', tier: 1, below: 'fra2', rel: 2 },
  { id: 'fra2', nationId: 'FRA', name: 'Ligue 2', tier: 2, below: null, rel: 0 },
  { id: 'ned1', nationId: 'NED', name: 'Eredivisie', tier: 1, below: 'ned2', rel: 2 },
  { id: 'ned2', nationId: 'NED', name: 'Eerste Divisie', tier: 2, below: null, rel: 0 },
  { id: 'por1', nationId: 'POR', name: 'Primeira Liga', tier: 1, below: 'por2', rel: 2 },
  { id: 'por2', nationId: 'POR', name: 'Liga Portugal 2', tier: 2, below: null, rel: 0 },
  { id: 'bel1', nationId: 'BEL', name: 'Pro League', tier: 1, below: null, rel: 0 },
  { id: 'sco1', nationId: 'SCO', name: 'Scottish Premiership', tier: 1, below: null, rel: 0 },
  { id: 'tur1', nationId: 'TUR', name: 'Süper Lig', tier: 1, below: null, rel: 0 },
  { id: 'idn1', nationId: 'IDN', name: 'Super League', tier: 1, below: 'idn2', rel: 3 },
  { id: 'idn2', nationId: 'IDN', name: 'Championship', tier: 2, below: null, rel: 0 },
  { id: 'jpn1', nationId: 'JPN', name: 'J1 League', tier: 1, below: 'jpn2', rel: 3 },
  { id: 'jpn2', nationId: 'JPN', name: 'J2 League', tier: 2, below: null, rel: 0 },
  { id: 'kor1', nationId: 'KOR', name: 'K League 1', tier: 1, below: null, rel: 0 },
  { id: 'ksa1', nationId: 'KSA', name: 'Saudi Pro League', tier: 1, below: null, rel: 0 },
  { id: 'tha1', nationId: 'THA', name: 'Thai League 1', tier: 1, below: null, rel: 0 },
  { id: 'bra1', nationId: 'BRA', name: 'Série A', tier: 1, below: 'bra2', rel: 4 },
  { id: 'bra2', nationId: 'BRA', name: 'Série B', tier: 2, below: null, rel: 0 },
  { id: 'arg1', nationId: 'ARG', name: 'Primera División', tier: 1, below: null, rel: 0 },
  { id: 'uru1', nationId: 'URU', name: 'Primera División', tier: 1, below: null, rel: 0 },
  { id: 'usa1', nationId: 'USA', name: 'Major League Soccer', tier: 1, below: null, rel: 0 },
  { id: 'mex1', nationId: 'MEX', name: 'Liga MX', tier: 1, below: null, rel: 0 },
  { id: 'nga1', nationId: 'NGA', name: 'Nigeria Premier Football League', tier: 1, below: null, rel: 0 },
  { id: 'egy1', nationId: 'EGY', name: 'Egyptian Premier League', tier: 1, below: null, rel: 0 },
  { id: 'rsa1', nationId: 'RSA', name: 'Premier Soccer League', tier: 1, below: null, rel: 0 },
  { id: 'aut1', nationId: 'AUT', name: 'Austrian Bundesliga', tier: 1, below: null, rel: 0 },
  { id: 'sui1', nationId: 'SUI', name: 'Swiss Super League', tier: 1, below: null, rel: 0 },
  { id: 'gre1', nationId: 'GRE', name: 'Super League Greece', tier: 1, below: null, rel: 0 },
  { id: 'den1', nationId: 'DEN', name: 'Danish Superliga', tier: 1, below: null, rel: 0 },
  { id: 'pol1', nationId: 'POL', name: 'Ekstraklasa', tier: 1, below: null, rel: 0 },
  { id: 'cro1', nationId: 'CRO', name: 'HNL', tier: 1, below: null, rel: 0 },
  { id: 'cze1', nationId: 'CZE', name: 'Chance Liga', tier: 1, below: null, rel: 0 },
  { id: 'srb1', nationId: 'SRB', name: 'Serbian SuperLiga', tier: 1, below: null, rel: 0 },
  { id: 'nor1', nationId: 'NOR', name: 'Eliteserien', tier: 1, below: null, rel: 0 },
  { id: 'swe1', nationId: 'SWE', name: 'Allsvenskan', tier: 1, below: null, rel: 0 },
  { id: 'ukr1', nationId: 'UKR', name: 'Ukrainian Premier League', tier: 1, below: null, rel: 0 },
  { id: 'rus1', nationId: 'RUS', name: 'Russian Premier League', tier: 1, below: null, rel: 0 },
  { id: 'chn1', nationId: 'CHN', name: 'Chinese Super League', tier: 1, below: null, rel: 0 },
  { id: 'qat1', nationId: 'QAT', name: 'Qatar Stars League', tier: 1, below: null, rel: 0 },
  { id: 'uae1', nationId: 'UAE', name: 'UAE Pro League', tier: 1, below: null, rel: 0 },
  { id: 'aus1', nationId: 'AUS', name: 'A-League Men', tier: 1, below: null, rel: 0 },
  { id: 'irn1', nationId: 'IRN', name: 'Persian Gulf Pro League', tier: 1, below: null, rel: 0 },
  { id: 'mas1', nationId: 'MAS', name: 'Malaysia Super League', tier: 1, below: null, rel: 0 },
  { id: 'vie1', nationId: 'VIE', name: 'V.League 1', tier: 1, below: null, rel: 0 },
  { id: 'col1', nationId: 'COL', name: 'Primera A', tier: 1, below: null, rel: 0 },
  { id: 'chi1', nationId: 'CHI', name: 'Primera División', tier: 1, below: null, rel: 0 },
  { id: 'ecu1', nationId: 'ECU', name: 'LigaPro', tier: 1, below: null, rel: 0 },
  { id: 'par1', nationId: 'PAR', name: 'Primera División', tier: 1, below: null, rel: 0 },
  { id: 'per1', nationId: 'PER', name: 'Liga 1', tier: 1, below: null, rel: 0 },
  { id: 'crc1', nationId: 'CRC', name: 'Primera División', tier: 1, below: null, rel: 0 },
  { id: 'mar1', nationId: 'MAR', name: 'Botola Pro', tier: 1, below: null, rel: 0 },
  { id: 'tun1', nationId: 'TUN', name: 'Ligue Professionnelle 1', tier: 1, below: null, rel: 0 },
  { id: 'alg1', nationId: 'ALG', name: 'Ligue Professionnelle 1', tier: 1, below: null, rel: 0 },
  { id: 'gha1', nationId: 'GHA', name: 'Ghana Premier League', tier: 1, below: null, rel: 0 },
];

/** Domestic knockout cup names per nation (used for the user's national cup). */
export const CUP_NAMES: Record<string, string> = {
  ENG: 'FA Cup', ESP: 'Copa del Rey', GER: 'DFB-Pokal', ITA: 'Coppa Italia', FRA: 'Coupe de France', NED: 'KNVB Beker', POR: 'Taça de Portugal',
  BEL: 'Croky Cup', SCO: 'Scottish Cup', TUR: 'Türkiye Kupası', IDN: 'Piala Indonesia', JPN: "Emperor's Cup", KOR: 'Korea Cup', KSA: "King's Cup", THA: 'Thai FA Cup',
  BRA: 'Copa do Brasil', ARG: 'Copa Argentina', URU: 'Copa Uruguay', USA: 'U.S. Open Cup', MEX: 'Copa MX', NGA: 'Federation Cup', EGY: 'Egypt Cup', RSA: 'Nedbank Cup',
  AUT: 'ÖFB-Cup', SUI: 'Schweizer Cup', GRE: 'Greek Cup', DEN: 'DBU Pokalen', POL: 'Puchar Polski', CRO: 'Croatian Cup', CZE: 'MOL Cup', SRB: 'Serbian Cup', NOR: 'NM Cupen',
  SWE: 'Svenska Cupen', UKR: 'Ukrainian Cup', RUS: 'Russian Cup', CHN: 'Chinese FA Cup', QAT: 'Emir Cup', UAE: "President's Cup", AUS: 'Australia Cup', IRN: 'Hazfi Cup',
  MAS: 'Piala Malaysia', VIE: 'Vietnamese Cup', COL: 'Copa Colombia', CHI: 'Copa Chile', ECU: 'Copa Ecuador', PAR: 'Copa Paraguay', PER: 'Copa Bicentenario', CRC: 'Torneo de Copa',
  MAR: 'Coupe du Trône', TUN: 'Coupe de Tunisie', ALG: "Coupe d'Algérie", GHA: 'FA Cup Ghana',
};

export const NATION_BY_ID = new Map(NATIONS.map((n) => [n.id, n]));
export const LEAGUE_BY_ID = new Map(LEAGUES.map((l) => [l.id, l]));

function slug(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Transfer budget (€M) from strength, reputation and division. Data-driven, overridable later. */
export function deriveBudget(strength: number, reputation: number, tier: number): number {
  const base = 1.5 * Math.pow(1.17, strength - 60);
  const tierMul = tier === 1 ? 1 : tier === 2 ? 0.5 : tier === 3 ? 0.3 : 0.2;
  const v = base * tierMul * (0.7 + reputation * 0.15);
  return Math.max(1, Math.round(v * 10) / 10);
}

function parse(src: string): DbClub[] {
  const out: DbClub[] = [];
  const seen = new Set<string>();
  let leagueId = '';
  for (const raw of src.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#')) { leagueId = line.slice(1).trim(); continue; }
    const [name, short, primary, secondary, strength, rep, stadium, capacity] = line.split('|').map((x) => x.trim());
    const league = LEAGUE_BY_ID.get(leagueId);
    if (!league) continue;
    let id = `${league.nationId.toLowerCase()}-${slug(name)}`;
    while (seen.has(id)) id += '-2';
    seen.add(id);
    const str = Number(strength), reputation = Number(rep);
    out.push({
      id, name, short, nationId: league.nationId, leagueId,
      primary, secondary, strength: str, reputation,
      budget: deriveBudget(str, reputation, league.tier),
      stadium: stadium || `Stadion ${short}`,
      capacity: Number(capacity) || 15000,
    });
  }
  return out;
}

export const CLUBS: DbClub[] = [...parse(CLUB_DATA_EUROPE), ...parse(CLUB_DATA_WORLD), ...parse(CLUB_DATA_EXTRA)];
export const CLUB_BY_ID = new Map(CLUBS.map((c) => [c.id, c]));

/** Static (season-1) membership. Runtime membership is GameState.world.leagueMembers. */
export const INITIAL_MEMBERS: Record<string, string[]> = {};
for (const c of CLUBS) (INITIAL_MEMBERS[c.leagueId] ??= []).push(c.id);

export const leaguesOfNation = (nationId: string) => LEAGUES.filter((l) => l.nationId === nationId).sort((a, b) => a.tier - b.tier);
export const nationsOfContinent = (c: Continent) => NATIONS.filter((n) => n.continent === c);
export const confedOfClub = (clubId: string): Confed | null => {
  const c = CLUB_BY_ID.get(clubId);
  return c ? NATION_BY_ID.get(c.nationId)!.confed : null;
};
