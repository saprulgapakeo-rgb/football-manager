// Animation architecture for the 2D match engine.
//
// Sprite-sheet ready: register real sprite sheets via registerSpriteSheet() and
// the renderer will use getSpriteFrame(). Until then SPRITES_READY is false and
// the renderer uses clean procedural placeholder drawing (documented as such,
// NOT presented as finished sprite animation).

export type AnimState =
  | 'idle' | 'walk' | 'run' | 'sprint' | 'turn' | 'dribble'
  | 'pass' | 'longpass' | 'shoot' | 'tackle' | 'receive'
  | 'celebrate' | 'injured' | 'diving';

export type MoveState = 'hold' | 'jockey' | 'move' | 'sprint' | 'recover';

export interface AnimData {
  state: AnimState;
  t: number; // time in current state (sim minutes)
  oneShot: AnimState | null; // transient action pose
  oneShotUntil: number; // sim minute when one-shot expires
  seed: number; // per-player variation for procedural motion
}

export function makeAnim(seed = Math.random() * 10): AnimData {
  return { state: 'idle', t: 0, oneShot: null, oneShotUntil: 0, seed };
}

/** Trigger a transient action pose that auto-expires. Durations are in sim-minutes. */
export function triggerOneShot(a: AnimData, minute: number, s: AnimState, durMin: number) {
  a.oneShot = s;
  a.oneShotUntil = minute + durMin;
  a.t = 0;
}

export function oneShotActive(a: AnimData, minute: number): boolean {
  if (!a.oneShot) return false;
  if (minute >= a.oneShotUntil) { a.oneShot = null; return false; }
  return true;
}

/** Derive locomotion state from speed. Called by the movement engine. */
export function deriveLocomotion(
  a: AnimData, minute: number, speed: number, hasBall: boolean,
  turning: boolean, injured: boolean, celebrating: boolean,
): void {
  if (oneShotActive(a, minute)) { a.t += 0; return; }
  let s: AnimState;
  if (injured) s = 'injured';
  else if (celebrating) s = 'celebrate';
  else if (hasBall && speed > 2) s = 'dribble';
  else if (turning && speed > 2) s = 'turn';
  else if (speed > 12.5) s = 'sprint';
  else if (speed > 6.5) s = 'run';
  else if (speed > 1.8) s = 'walk';
  else s = 'idle';
  if (s !== a.state) { a.state = s; a.t = 0; }
}

export function visibleAnim(a: AnimData, minute: number): AnimState {
  return oneShotActive(a, minute) && a.oneShot ? a.oneShot : a.state;
}

// ---------- angle helpers (shortest-path rotation) ----------
export function angDiff(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function lerpAngle(a: number, b: number, t: number): number {
  return a + angDiff(a, b) * Math.min(1, Math.max(0, t));
}

// ---------- sprite-sheet support (future assets) ----------
export interface SpriteFrame {
  sx: number; sy: number; sw: number; sh: number;
}

export interface SpriteSheetDef {
  img: CanvasImageSource | null; // set when art is loaded
  frameW: number;
  frameH: number;
  cols: number;
  anims: Partial<Record<AnimState, { row: number; frames: number; fps: number }>>;
}

const sheets = new Map<string, SpriteSheetDef>();

/** Register art for a key such as 'team0' | 'team1' | 'gk0' | 'gk1'. */
export function registerSpriteSheet(key: string, def: SpriteSheetDef): void {
  sheets.set(key, def);
}

export function hasSpriteSheet(key: string): boolean {
  const s = sheets.get(key);
  return !!s && !!s.img;
}

/** No sprite assets are bundled with the game yet. */
export const SPRITES_READY = false;

/**
 * Returns the sprite frame for a player, or null when no sheet is registered
 * (renderer falls back to procedural placeholder drawing).
 */
export function getSpriteFrame(
  key: string, state: AnimState, facing: number, timeSec: number,
): { img: CanvasImageSource; frame: SpriteFrame; flip: boolean } | null {
  const s = sheets.get(key);
  if (!s || !s.img) return null;
  const anim = s.anims[state] ?? s.anims['run'] ?? { row: 0, frames: 1, fps: 1 };
  const idx = Math.floor(timeSec * anim.fps) % Math.max(1, anim.frames);
  // 4-directional rows offset by facing quadrant when the sheet provides them.
  const quad = Math.floor(((facing % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 2));
  return {
    img: s.img,
    frame: { sx: idx * s.frameW, sy: (anim.row + quad) * s.frameH, sw: s.frameW, sh: s.frameH },
    flip: false,
  };
}
