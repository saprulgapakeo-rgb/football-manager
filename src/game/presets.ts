import type { Tactics } from './types';

export interface TacticPreset {
  id: string;
  name: string;
  icon: string;
  desc: string;
  tactics: Tactics;
}

/** One-click tactical identities. The match engine reacts to mentality/tempo/pressing,
 *  so each preset plays distinctly (short-passing game, direct long ball, counters, etc.). */
export const TACTIC_PRESETS: TacticPreset[] = [
  { id: 'tikitaka', name: 'Tiki-Taka', icon: '🌀', desc: 'Umpan pendek cepat, kuasai bola', tactics: { formation: '4-3-3', mentality: 4, tempo: 5, pressing: 3 } },
  { id: 'longball', name: 'Long Ball', icon: '🎯', desc: 'Langsung ke depan, duel udara', tactics: { formation: '4-4-2', mentality: 3, tempo: 4, pressing: 2 } },
  { id: 'possession', name: 'Possession', icon: '⚽', desc: 'Kontrol tempo, sabar bangun serangan', tactics: { formation: '4-3-3', mentality: 3, tempo: 3, pressing: 3 } },
  { id: 'counter', name: 'Counter Attack', icon: '⚡', desc: 'Bertahan rapat, serang balik cepat', tactics: { formation: '4-2-3-1', mentality: 2, tempo: 5, pressing: 3 } },
  { id: 'alldef', name: 'All Defend', icon: '🛡️', desc: 'Parkir bus total, amankan hasil', tactics: { formation: '5-3-2', mentality: 1, tempo: 1, pressing: 2 } },
  { id: 'allatt', name: 'All Attack', icon: '🔥', desc: 'Serang habis-habisan', tactics: { formation: '4-3-3', mentality: 5, tempo: 5, pressing: 4 } },
];

export const presetMatches = (p: TacticPreset, t: Tactics) =>
  p.tactics.formation === t.formation && p.tactics.mentality === t.mentality && p.tactics.tempo === t.tempo && p.tactics.pressing === t.pressing;
