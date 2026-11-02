import type { AttrKey, Attributes, Player, Pos } from './types';
import { FIRST_NAMES, LAST_NAMES } from './data';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const randi = (a: number, b: number) => Math.floor(rand(a, b + 1));
export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export const ATTR_KEYS: AttrKey[] = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical', 'goalkeeping'];

export const POS_WEIGHTS: Record<Pos, Partial<Record<AttrKey, number>>> = {
  GK: { goalkeeping: 0.85, passing: 0.05, physical: 0.1 },
  CB: { defending: 0.5, physical: 0.25, pace: 0.1, passing: 0.1, dribbling: 0.05 },
  LB: { defending: 0.35, pace: 0.25, passing: 0.15, physical: 0.15, dribbling: 0.1 },
  RB: { defending: 0.35, pace: 0.25, passing: 0.15, physical: 0.15, dribbling: 0.1 },
  CDM: { defending: 0.35, passing: 0.3, physical: 0.2, dribbling: 0.1, pace: 0.05 },
  CM: { passing: 0.4, dribbling: 0.2, defending: 0.15, shooting: 0.1, physical: 0.1, pace: 0.05 },
  CAM: { passing: 0.35, dribbling: 0.3, shooting: 0.25, pace: 0.1 },
  LM: { pace: 0.3, passing: 0.3, dribbling: 0.25, shooting: 0.1, physical: 0.05 },
  RM: { pace: 0.3, passing: 0.3, dribbling: 0.25, shooting: 0.1, physical: 0.05 },
  LW: { pace: 0.3, dribbling: 0.35, shooting: 0.2, passing: 0.15 },
  RW: { pace: 0.3, dribbling: 0.35, shooting: 0.2, passing: 0.15 },
  ST: { shooting: 0.5, pace: 0.2, dribbling: 0.15, physical: 0.15 },
};

export const POS_GROUP: Record<Pos, 'GK' | 'DEF' | 'MID' | 'ATT'> = {
  GK: 'GK', CB: 'DEF', LB: 'DEF', RB: 'DEF', CDM: 'MID', CM: 'MID', CAM: 'MID', LM: 'MID', RM: 'MID',
  LW: 'ATT', RW: 'ATT', ST: 'ATT',
};

export const POS_COLOR: Record<'GK' | 'DEF' | 'MID' | 'ATT', string> = {
  GK: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  DEF: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  MID: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  ATT: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
};

export function calcOvr(attrs: Attributes, pos: Pos): number {
  const w = POS_WEIGHTS[pos];
  let s = 0;
  for (const k in w) s += attrs[k as AttrKey] * (w[k as AttrKey] as number);
  return Math.round(s);
}

export const ovrOf = (p: Player) => calcOvr(p.attrs, p.pos);

/** Effective rating of a player when placed in a slot role */
export function slotRating(p: Player, role: Pos): number {
  const base = ovrOf(p);
  if (p.pos === role) return base;
  const g1 = POS_GROUP[p.pos], g2 = POS_GROUP[role];
  if (g1 === 'GK' || g2 === 'GK') return base - 35;
  if (g1 === g2) return base - 3;
  return base - 12;
}

export function genName(nation?: string) {
  const nat = nation ?? pick(Object.keys(FIRST_NAMES));
  return { name: `${pick(FIRST_NAMES[nat])} ${pick(LAST_NAMES[nat])}`, nation: nat };
}

export function genAttrs(pos: Pos, target: number): Attributes {
  const w = POS_WEIGHTS[pos];
  const a = {} as Attributes;
  for (const k of ATTR_KEYS) {
    const weight = w[k] ?? 0;
    if (k === 'goalkeeping') a[k] = pos === 'GK' ? 0 : randi(8, 20);
    else if (weight > 0) a[k] = 0;
    else a[k] = clamp(Math.round(target - rand(12, 30)), 25, 85);
  }
  // fill weighted attributes around target
  for (const k in w) a[k as AttrKey] = clamp(Math.round(target + rand(-6, 6)), 30, 97);
  // adjust to hit target exactly-ish
  for (let i = 0; i < 40; i++) {
    const o = calcOvr(a, pos);
    if (o === target) break;
    const keys = Object.keys(w) as AttrKey[];
    const k = pick(keys);
    a[k] = clamp(a[k] + (o < target ? 1 : -1), 30, 99);
  }
  if (pos === 'GK') {
    a.pace = clamp(Math.round(target - rand(15, 30)), 30, 75);
    a.shooting = randi(15, 35);
    a.dribbling = randi(20, 45);
    a.defending = randi(20, 40);
  }
  return a;
}

export function playerValue(ovr: number, age: number, potential: number): number {
  let v = 0.3 * Math.pow(1.17, ovr - 55);
  v *= 1 + Math.max(0, potential - ovr) * 0.035;
  if (age <= 21) v *= 1.3;
  else if (age >= 33) v *= 0.45;
  else if (age >= 30) v *= 0.7;
  return Math.max(0.1, Math.round(v * 10) / 10);
}

export function playerWage(ovr: number): number {
  return Math.max(2, Math.round(1.5 * Math.pow(1.12, ovr - 50)));
}

export function genPlayer(pos: Pos, ovr: number, opts: { age?: number; nation?: string; num?: number } = {}): Player {
  const { name, nation } = genName(opts.nation);
  const age = opts.age ?? randi(18, 34);
  const attrs = genAttrs(pos, ovr);
  const real = calcOvr(attrs, pos);
  const growth = age <= 20 ? randi(8, 20) : age <= 23 ? randi(4, 13) : age <= 27 ? randi(1, 6) : randi(0, 2);
  const potential = clamp(real + growth, real, 95);
  const formCount = randi(2, 4);
  return {
    id: uid(),
    name,
    nation,
    pos,
    age,
    num: opts.num ?? randi(2, 40),
    attrs,
    potential,
    fitness: randi(82, 100),
    form: Array.from({ length: formCount }, () => Math.round(rand(5.9, 7.8) * 10) / 10),
    xp: randi(0, 40),
    injuredWeeks: 0,
    wage: playerWage(real),
    apps: 0, goals: 0, assists: 0, ratingSum: 0,
  };
}

export const SQUAD_TEMPLATE: Pos[] = [
  'GK', 'GK', 'GK', 'CB', 'CB', 'CB', 'CB', 'LB', 'LB', 'RB', 'RB', 'CDM', 'CDM', 'CM', 'CM', 'CM',
  'CAM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST', 'ST', 'ST',
];

export function genSquad(avg: number, nationBias?: string): Player[] {
  const used = new Set<number>();
  const numFor = (pos: Pos, i: number) => {
    const pref: Record<Pos, number[]> = {
      GK: [1, 13, 31], CB: [4, 5, 15, 6], LB: [3, 22], RB: [2, 24], CDM: [6, 16, 18], CM: [8, 14, 20],
      CAM: [10, 21], LM: [11, 17], RM: [7, 19], LW: [11, 27], RW: [7, 23], ST: [9, 19, 29],
    };
    for (const n of pref[pos]) if (!used.has(n)) { used.add(n); return n; }
    let n = 25 + i;
    while (used.has(n)) n++;
    used.add(n);
    return n;
  };
  return SQUAD_TEMPLATE.map((pos, i) => {
    const starterish = i % 2 === 0 || pos === 'ST';
    const ovr = Math.round(clamp(avg + (starterish ? rand(-3, 5) : rand(-9, 1)), 48, 92));
    const nation = nationBias && Math.random() < 0.45 ? nationBias : undefined;
    const p = genPlayer(pos, ovr, { nation });
    p.num = numFor(pos, i);
    if (i % 5 === 0) p.age = randi(18, 21), (p.potential = clamp(ovrOf(p) + randi(8, 18), ovrOf(p), 94));
    return p;
  });
}

/** Apply XP; returns number of OVR points gained */
export function applyXp(p: Player, xp: number, focus?: AttrKey[]): number {
  const ovrBefore = ovrOf(p);
  if (ovrBefore >= p.potential) {
    p.xp = Math.min(p.xp + xp, 99);
    return 0;
  }
  p.xp += xp;
  let gained = 0;
  while (p.xp >= 100 && ovrOf(p) < p.potential) {
    p.xp -= 100;
    const start = ovrOf(p);
    const w = POS_WEIGHTS[p.pos];
    const keys = (focus && focus.some((k) => (w[k] ?? 0) > 0) ? focus.filter((k) => (w[k] ?? 0) > 0) : Object.keys(w)) as AttrKey[];
    let guard = 0;
    while (ovrOf(p) <= start && guard < 30) {
      // prefer focus attribute, else highest weight
      const k = keys.sort((a, b) => (w[b] ?? 0) - (w[a] ?? 0))[guard % keys.length];
      p.attrs[k] = Math.min(99, p.attrs[k] + 1);
      guard++;
      if (guard > keys.length * 4) {
        const all = Object.keys(w) as AttrKey[];
        const k2 = all[guard % all.length];
        p.attrs[k2] = Math.min(99, p.attrs[k2] + 1);
      }
    }
    gained += ovrOf(p) - start;
  }
  if (ovrOf(p) >= p.potential) p.xp = Math.min(p.xp, 99);
  p.wage = Math.max(p.wage, playerWage(ovrOf(p)));
  return gained;
}

export function ageXpFactor(age: number) {
  if (age <= 20) return 1.5;
  if (age <= 23) return 1.25;
  if (age <= 27) return 1;
  if (age <= 30) return 0.7;
  return 0.45;
}

export const avgForm = (p: Player) => (p.form.length ? p.form.reduce((a, b) => a + b, 0) / p.form.length : 0);
export const fmtMoney = (m: number) => (m >= 1 ? `€${m.toFixed(m >= 10 ? 0 : 1)}M` : `€${Math.round(m * 1000)}K`);
