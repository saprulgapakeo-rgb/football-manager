import type { Formation, Player, Pos } from './types';
import { ovrOf, slotRating } from './players';

export interface Slot { role: Pos; x: number; y: number }

// x: 0 = own goal, 100 = opponent goal. y: 0 = left touchline (when attacking right = top)
export const FORMATIONS: Record<Formation, Slot[]> = {
  '4-4-2': [
    { role: 'GK', x: 5, y: 50 },
    { role: 'LB', x: 26, y: 14 }, { role: 'CB', x: 22, y: 38 }, { role: 'CB', x: 22, y: 62 }, { role: 'RB', x: 26, y: 86 },
    { role: 'LM', x: 50, y: 14 }, { role: 'CM', x: 46, y: 38 }, { role: 'CM', x: 46, y: 62 }, { role: 'RM', x: 50, y: 86 },
    { role: 'ST', x: 74, y: 40 }, { role: 'ST', x: 74, y: 60 },
  ],
  '4-3-3': [
    { role: 'GK', x: 5, y: 50 },
    { role: 'LB', x: 26, y: 14 }, { role: 'CB', x: 22, y: 38 }, { role: 'CB', x: 22, y: 62 }, { role: 'RB', x: 26, y: 86 },
    { role: 'CM', x: 47, y: 30 }, { role: 'CDM', x: 40, y: 50 }, { role: 'CM', x: 47, y: 70 },
    { role: 'LW', x: 72, y: 16 }, { role: 'ST', x: 78, y: 50 }, { role: 'RW', x: 72, y: 84 },
  ],
  '3-5-2': [
    { role: 'GK', x: 5, y: 50 },
    { role: 'CB', x: 22, y: 28 }, { role: 'CB', x: 20, y: 50 }, { role: 'CB', x: 22, y: 72 },
    { role: 'LM', x: 50, y: 10 }, { role: 'CM', x: 48, y: 33 }, { role: 'CDM', x: 40, y: 50 }, { role: 'CM', x: 48, y: 67 }, { role: 'RM', x: 50, y: 90 },
    { role: 'ST', x: 75, y: 40 }, { role: 'ST', x: 75, y: 60 },
  ],
  '4-2-3-1': [
    { role: 'GK', x: 5, y: 50 },
    { role: 'LB', x: 26, y: 14 }, { role: 'CB', x: 22, y: 38 }, { role: 'CB', x: 22, y: 62 }, { role: 'RB', x: 26, y: 86 },
    { role: 'CDM', x: 40, y: 38 }, { role: 'CDM', x: 40, y: 62 },
    { role: 'LM', x: 62, y: 16 }, { role: 'CAM', x: 62, y: 50 }, { role: 'RM', x: 62, y: 84 },
    { role: 'ST', x: 80, y: 50 },
  ],
  '5-3-2': [
    { role: 'GK', x: 5, y: 50 },
    { role: 'LB', x: 30, y: 10 }, { role: 'CB', x: 20, y: 30 }, { role: 'CB', x: 18, y: 50 }, { role: 'CB', x: 20, y: 70 }, { role: 'RB', x: 30, y: 90 },
    { role: 'CM', x: 47, y: 30 }, { role: 'CM', x: 44, y: 50 }, { role: 'CM', x: 47, y: 70 },
    { role: 'ST', x: 74, y: 40 }, { role: 'ST', x: 74, y: 60 },
  ],
};

export const FORMATION_LIST = Object.keys(FORMATIONS) as Formation[];

/** Greedy best XI for a formation. Returns {lineup, bench} */
export function autoPick(squad: Player[], formation: Formation): { lineup: string[]; bench: string[] } {
  const slots = FORMATIONS[formation];
  const avail = squad.filter((p) => p.injuredWeeks <= 0);
  const used = new Set<string>();
  const lineup: string[] = new Array(slots.length).fill('');
  // fill exact matches first ordered by rating, then others
  const order = slots.map((s, i) => ({ s, i }));
  for (const pass of [0, 1, 2]) {
    for (const { s, i } of order) {
      if (lineup[i]) continue;
      const cands = avail
        .filter((p) => !used.has(p.id))
        .filter((p) => (pass === 0 ? p.pos === s.role : pass === 1 ? slotRating(p, s.role) >= ovrOf(p) - 3 : true))
        .sort((a, b) => slotRating(b, s.role) * (0.8 + b.fitness / 500) - slotRating(a, s.role) * (0.8 + a.fitness / 500));
      if (cands[0]) { lineup[i] = cands[0].id; used.add(cands[0].id); }
    }
  }
  const rest = avail.filter((p) => !used.has(p.id)).sort((a, b) => ovrOf(b) - ovrOf(a));
  const bench: string[] = [];
  const gk = rest.find((p) => p.pos === 'GK');
  if (gk) bench.push(gk.id);
  for (const p of rest) if (bench.length < 9 && !bench.includes(p.id)) bench.push(p.id);
  return { lineup, bench };
}
