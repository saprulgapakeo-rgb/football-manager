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
  askingPrice: number; // in M
  status: 'available' | 'rejected';
}

export interface GameState {
  version: number;
  account: string;
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
}
