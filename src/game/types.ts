export type Pos =
  | 'GK' | 'CB' | 'LB' | 'RB' | 'CDM' | 'CM' | 'CAM' | 'LM' | 'RM' | 'LW' | 'RW' | 'ST';

export type AttrKey = 'pace' | 'shooting' | 'passing' | 'dribbling' | 'defending' | 'physical' | 'goalkeeping';

export type Attributes = Record<AttrKey, number>;

export interface Player {
  id: string;
  name: string;
  nation: string;
  pos: Pos;
  age: number;
  num: number;
  attrs: Attributes;
  potential: number;
  fitness: number; // 0-100
  form: number[]; // last 5 match ratings
  xp: number; // 0-100 training progress to next OVR point
  injuredWeeks: number;
  wage: number; // K per week
  apps: number;
  goals: number;
  assists: number;
  ratingSum: number;
  club?: string;
  contractYears?: number; // seasons remaining on contract
}

export type Formation = '4-4-2' | '4-3-3' | '3-5-2' | '4-2-3-1' | '5-3-2';

export interface Tactics {
  formation: Formation;
  mentality: number; // 1-5
  tempo: number; // 1-5
  pressing: number; // 1-5
}

export type LogoShape = 'shield' | 'circle' | 'hexagon' | 'diamond' | 'crest';
export type LogoSymbol = 'star' | 'ball' | 'crown' | 'bolt' | 'eagle' | 'castle' | 'none';
export type JerseyPattern = 'plain' | 'stripes' | 'hoops' | 'sash' | 'halves';

export interface ClubIdentity {
  name: string;
  short: string;
  primary: string;
  secondary: string;
  pattern: JerseyPattern;
  logo: {
    type: 'gen' | 'img';
    shape: LogoShape;
    symbol: LogoSymbol;
    showInitials: boolean;
    img?: string;
  };
}

export interface LeagueClub {
  id: string;
  name: string;
  short: string;
  primary: string;
  secondary: string;
  rating: number;
  isUser?: boolean;
}

export interface TableRow {
  clubId: string;
  p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number;
  form: ('W' | 'D' | 'L')[];
}

export interface Fixture {
  round: number;
  home: string;
  away: string;
  hg?: number;
  ag?: number;
}

export type StaffRole = 'Manajer' | 'Pelatih';

export type NewsType = 'match' | 'transfer' | 'training' | 'club' | 'season';

export interface NewsItem {
  id: string;
  type: NewsType;
  title: string;
  body: string;
  season: number;
  week: number;
  ts: number;
}

export interface MarketPlayer extends Player {
  club: string;
  clubId?: string; // world DB club id (absent on legacy random listings)
  askingPrice: number; // in M
  status: 'available' | 'rejected';
}

// ---------- Global football database (mutable career-side state) ----------
export interface CupFixture {
  md: number; // matchday index (1-based)
  home: string; away: string; // DB club ids
  hg?: number; ag?: number;
  group?: number; // group index for group-stage games
  round?: string; // 'R16' | 'QF' | 'SF' | 'F' for knockout games
  winner?: string;
}

export interface CompetitionState {
  id: string; name: string; short: string; season: number;
  teams: string[];
  groups: { teams: string[]; table: TableRow[] }[];
  fixtures: CupFixture[];
  schedule: number[]; // league-week at which matchday k (index k-1) is played
  mdDone: number;
  stage: 'group' | 'ko' | 'done';
  champion?: string;
}

export interface TransferRecord {
  season: number; week: number; playerId: string; name: string; pos: Pos;
  from: string; to: string; fee: number; ts: number;
}

export interface WorldState {
  leagueId: string; // 'legacy' for pre-database careers
  clubId: string; // DB club id of the user's club ('user' for legacy)
  nationId: string | null;
  leagueName: string;
  leagueMembers: Record<string, string[]>; // leagueId -> club ids (mutable: promotion/relegation)
  tables: Record<string, TableRow[]>; // standings of every league except the user's (kept in GameState.table)
  removed: Record<string, string[]>; // clubId -> player ids that left the generated base squad
  added: Record<string, Player[]>; // clubId -> players that joined (transfers)
  transfers: TransferRecord[];
  comps: CompetitionState[];
  pendingCup: { compId: string; md: number; home: string; away: string } | null;
  honours: { season: number; title: string }[];
}

export interface GameState {
  version: number;
  account: string;
  role?: StaffRole;
  clubPresetId?: string;
  clubTier?: string;
  clubNation?: string;
  club: ClubIdentity;
  squad: Player[];
  lineup: string[]; // 11 ids following formation slots
  bench: string[]; // up to 9
  tactics: Tactics;
  familiarity: number; // 0-100 tactical familiarity
  coins: number;
  transferBudget: number; // M
  season: number;
  week: number; // current round index (0-based)
  trainingLeft: number;
  league: LeagueClub[];
  fixtures: Fixture[];
  table: TableRow[];
  market: MarketPlayer[];
  news: NewsItem[];
  lastLoginDay: string;
  createdAt: number;
  world?: WorldState; // added by the global database upgrade; migrated lazily for old saves
  autoSub?: boolean; // automatic substitutions for the user's team (default true)
  autoSubThreshold?: number; // fitness threshold that triggers an automatic substitution (default 60)
  autoUpgrade?: boolean; // automatic special-training upgrades for prospects (default false)
}
