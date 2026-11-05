// Deterministic squads for every club in the world database.
//
// Squads are NOT stored in the save. They are regenerated from a per-club seed
// (same players every time) and the save only keeps *deltas* (players who left
// via transfer, players who joined). This keeps 600+ squads (~15k players)
// out of localStorage and out of memory until a club is actually needed.

import type { GameState, Player } from '../types';
import { genSquad, randi, ovrOf } from '../players';
import { CLUB_BY_ID } from './db';

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Run fn with a seeded Math.random so existing generators become deterministic. */
export function withSeed<T>(seed: number, fn: () => T): T {
  const orig = Math.random;
  Math.random = mulberry32(seed);
  try { return fn(); } finally { Math.random = orig; }
}

/** Seeded shuffle (does not touch Math.random). */
export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const r = mulberry32(seed);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const cache = new Map<string, Player[]>();
const CACHE_MAX = 160;

/** Base (season-1) squad of a DB club or a legacy AI club id. */
export function baseSquad(clubId: string, fallbackRating = 68): Player[] {
  const hit = cache.get(clubId);
  if (hit) return hit;
  const c = CLUB_BY_ID.get(clubId);
  const squad = withSeed(hashStr('squad:' + clubId), () => {
    const sq = genSquad(c ? c.strength : fallbackRating, c?.nationId);
    sq.forEach((p, i) => {
      p.id = `${clubId}#${i}`;
      p.club = c?.name;
      p.contractYears = randi(1, 4);
    });
    return sq;
  });
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(clubId, squad);
  return squad;
}

/** Current squad of a non-user club: base minus departures plus arrivals, aged by season. */
export function getClubSquad(s: GameState, clubId: string, fallbackRating = 68): Player[] {
  const w = s.world;
  const removed = new Set(w?.removed[clubId] ?? []);
  const base = baseSquad(clubId, fallbackRating).filter((p) => !removed.has(p.id));
  const added = w?.added[clubId] ?? [];
  const ageOff = Math.max(0, (s.season ?? 1) - 1);
  const list = [...base.map((p) => (ageOff ? { ...p, age: p.age + ageOff } : p)), ...added];
  return list;
}

export function squadStrength(squad: Player[]): number {
  const top = squad.map(ovrOf).sort((a, b) => b - a).slice(0, 11);
  return top.length ? Math.round(top.reduce((a, b) => a + b, 0) / top.length) : 0;
}

/** Remove a player from a club's live squad (base -> removed list, added -> spliced). */
export function removeFromClub(s: GameState, clubId: string, playerId: string) {
  const w = s.world!;
  const added = w.added[clubId];
  if (added) {
    const i = added.findIndex((p) => p.id === playerId);
    if (i >= 0) { added.splice(i, 1); if (!added.length) delete w.added[clubId]; return; }
  }
  (w.removed[clubId] ??= []).push(playerId);
}

export function addToClub(s: GameState, clubId: string, p: Player) {
  const w = s.world!;
  const c = CLUB_BY_ID.get(clubId);
  const copy: Player = { ...p, club: c?.name ?? p.club };
  (w.added[clubId] ??= []).push(copy);
}
