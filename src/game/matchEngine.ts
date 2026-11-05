import type { Attributes, GameState, LeagueClub, Player, Pos, Tactics } from './types';
import { FORMATIONS, autoPick } from './formations';
import { POS_GROUP, clamp, genSquad, ovrOf, pick, rand, slotRating } from './players';
import { FORMATION_LIST } from './formations';
import { makeAnim, triggerOneShot, deriveLocomotion, lerpAngle, angDiff, type AnimData, type MoveState } from './animation';

// Time scale: 1 game-minute of sim time == 1 real second at 1x speed.
// Player speeds are in pitch-units per game-minute (~walk 6, run 11, sprint 16).

export interface SimPlayer {
  id: string; name: string; num: number; role: Pos; natPos: Pos; ovr: number; eff: number;
  attrs: Attributes; fitness: number; rating: number; goals: number; assists: number;
  x: number; y: number; bx: number; by: number;
  yellow: number; injured: boolean; form: number[]; potential: number; age: number;
  phase: number; shots: number; saves: number;
  // movement engine (Phase 1)
  vx: number; vy: number; tgtX: number; tgtY: number;
  facing: number; targetFacing: number; speed: number; move: MoveState;
  hasBall: boolean; marking: number; runUntil: number; celebrateUntil: number;
  anim: AnimData; diveDir: number;
  faceLock: number; faceLockAngle: number; // sim-minute until which facing is pinned (kicks/receptions)
}

export interface SimTeam {
  isUser: boolean; clubId: string; name: string; short: string;
  kit: string; kitText: string;
  onPitch: SimPlayer[]; bench: SimPlayer[]; subbedOff: SimPlayer[]; subsUsed: number;
  tactics: Tactics; familiarity: number;
  counterUntil: number; pressers: number[];
}

export type EventType = 'goal' | 'save' | 'miss' | 'sub' | 'card' | 'injury' | 'info' | 'tactic' | 'whistle' | 'chance';
export interface MatchEvent { id: number; minute: number; type: EventType; team?: 0 | 1; text: string }

export type BallKind =
  | 'short' | 'long' | 'through' | 'cross' | 'ground' | 'power' | 'curved' | 'chip' | 'deflect' | 'dribble';

export interface BallFlight {
  kind: BallKind;
  tx: number; ty: number;
  speed: number; hmax: number;
  intended: { team: 0 | 1; idx: number } | null;
  outcome: 'receive' | 'intercept' | 'shot';
  interceptor: { team: 0 | 1; idx: number } | null;
  shot: null | { team: 0 | 1; shooter: number; result: 'goal' | 'save' | 'parry' | 'block' | 'miss' };
  kicker: { team: 0 | 1; idx: number };
}

export interface SimBall {
  x: number; y: number; vx: number; vy: number;
  h: number; vh: number; spin: number; curve: number;
  state: 'owned' | 'flight' | 'loose' | 'dead';
  ownerTeam: 0 | 1; ownerIdx: number;
  flight: BallFlight | null;
  looseTimer: number;
  // legacy tween fields kept for compatibility (tx/ty mirror the flight target)
  fx: number; fy: number; tx: number; ty: number; t: number; dur: number;
}

export interface SubFx {
  team: 0 | 1; outNum: number; outX: number; outY: number;
  inNum: number; inId: string; startMin: number;
}

export interface MatchSim {
  teams: [SimTeam, SimTeam];
  minute: number; stoppage: number; halfDone: boolean; finished: boolean; pauseRequest: boolean;
  score: [number, number];
  possession: 0 | 1; carrier: number; lastPasser: number | null;
  ball: SimBall;
  nextAction: number;
  kickoffFor: 0 | 1 | null;
  events: MatchEvent[];
  stats: { shots: [number, number]; onTarget: [number, number]; poss: [number, number]; passes: [number, number]; fouls: [number, number] };
  homeIsUser: boolean;
  opponentId: string;
  evId: number;
  lastAiCheck: number;
  subFx: SubFx[];
  /** Goal celebration: match clock is frozen while t < dur (dur is in seconds at 1x, max 10). */
  celebration: { t: number; dur: number; team: 0 | 1; scorer: number; cornerY: number; scorerName: string } | null;
  autoSub: boolean; // automatic substitutions for the user's team
  autoSubThreshold: number; // fitness below this triggers an automatic substitution
}

export interface MatchResult {
  opponentId: string; homeIsUser: boolean; userGoals: number; oppGoals: number;
  players: { id: string; rating: number; goals: number; assists: number; fitness: number; injured: boolean }[];
  motm: string;
  scorers: string[];
}

// ---------- helpers ----------
function hexToRgb(h: string) {
  const s = h.replace('#', '');
  const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function luminance(h: string) {
  const [r, g, b] = hexToRgb(h).map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const textOn = (h: string) => (luminance(h) > 0.55 ? '#0b1220' : '#ffffff');
function colorDist(a: string, b: string) {
  const x = hexToRgb(a), y = hexToRgb(b);
  return Math.sqrt((x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2);
}

function toSim(p: Player, role: Pos, bx: number, by: number, team: 0 | 1): SimPlayer {
  const [x, y] = team === 0 ? [bx * 0.5, by] : [100 - bx * 0.5, 100 - by];
  return {
    id: p.id, name: p.name, num: p.num, role, natPos: p.pos, ovr: ovrOf(p), eff: slotRating(p, role),
    attrs: { ...p.attrs }, fitness: p.fitness, rating: 6.0, goals: 0, assists: 0,
    x, y, bx, by, yellow: 0, injured: false, form: [...p.form], potential: p.potential, age: p.age,
    phase: Math.random() * 10, shots: 0, saves: 0,
    vx: 0, vy: 0, tgtX: x, tgtY: y,
    facing: team === 0 ? 0 : Math.PI, targetFacing: team === 0 ? 0 : Math.PI,
    speed: 0, move: 'hold', hasBall: false, marking: -1, runUntil: 0, celebrateUntil: 0,
    anim: makeAnim(), diveDir: 0, faceLock: 0, faceLockAngle: 0,
  };
}

const lastName = (n: string) => n.split(' ').slice(-1)[0];

export function createSim(state: GameState, opp: LeagueClub, homeIsUser: boolean, oppSquadIn?: Player[]): MatchSim {
  const userSlots = FORMATIONS[state.tactics.formation];
  const byId = new Map(state.squad.map((p) => [p.id, p]));
  let lineup = state.lineup.map((id) => byId.get(id));
  if (lineup.some((p) => !p || p.injuredWeeks > 0)) {
    const ap = autoPick(state.squad, state.tactics.formation);
    const used = new Set(lineup.filter((p) => p && p.injuredWeeks <= 0).map((p) => p!.id));
    const spare = [...ap.lineup, ...ap.bench].filter((id) => id && !used.has(id));
    lineup = lineup.map((p) => (p && p.injuredWeeks <= 0 ? p : byId.get(spare.shift()!)));
  }
  const userOn = lineup.map((p, i) => toSim(p!, userSlots[i].role, userSlots[i].x, userSlots[i].y, 0));
  const onIds = new Set(userOn.map((p) => p.id));
  const userBench = state.bench.map((id) => byId.get(id)).filter((p): p is Player => !!p && p.injuredWeeks <= 0 && !onIds.has(p.id))
    .map((p) => toSim(p, p.pos, 50, 50, 0));

  const oppFormation = pick(FORMATION_LIST);
  // Real database squad when provided (world DB); random generated squad otherwise (legacy behaviour).
  const oppSquad = oppSquadIn && oppSquadIn.length >= 11 ? oppSquadIn.map((p) => ({ ...p, attrs: { ...p.attrs }, form: [...p.form] })) : genSquad(opp.rating);
  const ap = autoPick(oppSquad, oppFormation);
  const oSlots = FORMATIONS[oppFormation];
  const oById = new Map(oppSquad.map((p) => [p.id, p]));
  const oppOn = ap.lineup.map((id, i) => toSim(oById.get(id)!, oSlots[i].role, oSlots[i].x, oSlots[i].y, 1));
  oppOn.forEach((p) => (p.fitness = Math.round(rand(88, 100))));
  const oppBench = ap.bench.slice(0, 7).map((id) => toSim(oById.get(id)!, oById.get(id)!.pos, 50, 50, 1));

  const userKit = state.club.primary;
  let oppKit = opp.primary;
  if (colorDist(oppKit, userKit) < 120) oppKit = opp.secondary;
  if (colorDist(oppKit, userKit) < 120) oppKit = luminance(userKit) > 0.5 ? '#111827' : '#f8fafc';
  const userAvg = userOn.reduce((a, p) => a + p.eff, 0) / 11;
  const oppMent = opp.rating > userAvg + 3 ? 4 : opp.rating < userAvg - 3 ? 2 : 3;

  const sim: MatchSim = {
    teams: [
      { isUser: true, clubId: 'user', name: state.club.name, short: state.club.short, kit: userKit, kitText: textOn(userKit),
        onPitch: userOn, bench: userBench, subbedOff: [], subsUsed: 0, tactics: { ...state.tactics }, familiarity: state.familiarity, counterUntil: 0, pressers: [] },
      { isUser: false, clubId: opp.id, name: opp.name, short: opp.short, kit: oppKit, kitText: textOn(oppKit),
        onPitch: oppOn, bench: oppBench, subbedOff: [], subsUsed: 0,
        tactics: { formation: oppFormation, mentality: oppMent, tempo: pick([2, 3, 3, 4]), pressing: pick([2, 3, 3, 4]) }, familiarity: 60, counterUntil: 0, pressers: [] },
    ],
    minute: 0, stoppage: Math.floor(rand(1, 5)), halfDone: false, finished: false, pauseRequest: false,
    score: [0, 0], possession: homeIsUser ? 0 : 1, carrier: 10, lastPasser: null,
    ball: { x: 50, y: 50, vx: 0, vy: 0, h: 0, vh: 0, spin: 0, curve: 0, state: 'owned', ownerTeam: homeIsUser ? 0 : 1, ownerIdx: 10, flight: null, looseTimer: 0, fx: 50, fy: 50, tx: 50, ty: 50, t: 1, dur: 1 },
    nextAction: 0.4, kickoffFor: null, events: [],
    stats: { shots: [0, 0], onTarget: [0, 0], poss: [0, 0], passes: [0, 0], fouls: [0, 0] },
    homeIsUser, opponentId: opp.id, evId: 0, lastAiCheck: 55, subFx: [], celebration: null,
    autoSub: state.autoSub ?? true, autoSubThreshold: state.autoSubThreshold ?? 60,
  };
  const h = homeIsUser ? sim.teams[0] : sim.teams[1];
  const a = homeIsUser ? sim.teams[1] : sim.teams[0];
  addEv(sim, 'info', `Selamat datang di laga ${h.name} vs ${a.name}! ${h.name} memakai formasi ${h.tactics.formation}, ${a.name} dengan ${a.tactics.formation}.`);
  return sim;
}


function addEv(sim: MatchSim, type: EventType, text: string, team?: 0 | 1) {
  sim.events.unshift({ id: ++sim.evId, minute: Math.min(Math.floor(sim.minute), 90 + sim.stoppage), type, team, text });
  if (sim.events.length > 120) sim.events.pop();
}

const fitFactor = (p: SimPlayer) => (p.fitness >= 65 ? 1 : 0.8 + (0.2 * p.fitness) / 65) * (p.injured ? 0.75 : 1);
const power = (p: SimPlayer) => p.eff * fitFactor(p);
const teamAvg = (t: SimTeam, f: (p: SimPlayer) => number) => t.onPitch.reduce((a, p) => a + f(p), 0) / t.onPitch.length;

const prog = (sim: MatchSim, t: 0 | 1) => (t === 0 ? sim.ball.x : 100 - sim.ball.x);
const ownX = (p: SimPlayer, t: 0 | 1) => (t === 0 ? p.x : 100 - p.x);
const ownY = (p: SimPlayer, t: 0 | 1) => (t === 0 ? p.y : 100 - p.y);
const adj = (p: SimPlayer, d: number) => { p.rating = clamp(p.rating + d, 3, 10); };

function nearestTo(team: SimTeam, x: number, y: number, skipGk = true) {
  let best = skipGk ? 1 : 0, bd = 1e9;
  team.onPitch.forEach((p, i) => {
    if (skipGk && i === 0) return;
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

/** Offside-line awareness: own-perspective x of the second-last opponent. */
function defLine(sim: MatchSim, t: 0 | 1): number {
  const opp = sim.teams[(1 - t) as 0 | 1];
  const xs = opp.onPitch.map((p) => (t === 0 ? 100 - p.x : p.x)).sort((a, b) => b - a);
  return xs[1] ?? 50;
}

const BALL_SPEED: Record<BallKind, number> = {
  short: 95, long: 115, through: 105, cross: 100, ground: 150, power: 210, curved: 170, chip: 92, deflect: 46, dribble: 30,
};
const BALL_HMAX: Record<BallKind, number> = {
  short: 0.5, long: 4, through: 0.8, cross: 5, ground: 0.8, power: 1.2, curved: 1.6, chip: 7, deflect: 2, dribble: 0,
};

// ---------- ball physics ----------
function kickBall(
  sim: MatchSim, kicker: { team: 0 | 1; idx: number }, tx: number, ty: number,
  kind: BallKind, flight: Omit<BallFlight, 'kind' | 'tx' | 'ty' | 'speed' | 'hmax' | 'kicker'>,
) {
  const b = sim.ball;
  b.state = 'flight';
  b.vx = 0; b.vy = 0;
  b.h = 0; b.vh = 0; b.spin = kind === 'curved' ? 6 : kind === 'chip' || kind === 'cross' ? 2 : 0;
  b.curve = kind === 'curved' ? (Math.random() < 0.5 ? -1 : 1) * rand(0.5, 1) : 0;
  // Lead the intended receiver: aim where they're running, not where they were.
  let ax = clamp(tx, -3, 103), ay = clamp(ty, 1, 99);
  if (flight.intended && flight.outcome === 'receive') {
    const rp = sim.teams[flight.intended.team].onPitch[flight.intended.idx];
    if (rp) {
      const d = Math.hypot(ax - b.x, ay - b.y);
      const tLead = (d / BALL_SPEED[kind]) * 0.65;
      ax = clamp(ax + rp.vx * tLead, -3, 103);
      ay = clamp(ay + rp.vy * tLead, 1, 99);
    }
  }
  b.flight = { kind, tx: ax, ty: ay, speed: BALL_SPEED[kind], hmax: BALL_HMAX[kind], kicker, ...flight };
  b.tx = b.flight.tx; b.ty = b.flight.ty; b.fx = b.x; b.fy = b.y; b.t = 0; b.dur = 1;
  const kp = sim.teams[kicker.team].onPitch[kicker.idx];
  if (kp) {
    kp.hasBall = false;
    kp.faceLockAngle = Math.atan2(ay - kp.y, ax - kp.x);
    kp.faceLock = sim.minute + 0.35;
  }
  // Intended receiver turns to face the incoming ball.
  if (flight.intended) {
    const rp = sim.teams[flight.intended.team].onPitch[flight.intended.idx];
    if (rp) { rp.faceLockAngle = Math.atan2(b.y - rp.y, b.x - rp.x); rp.faceLock = sim.minute + 0.25; }
  }
}

function setOwned(sim: MatchSim, team: 0 | 1, idx: number) {
  const b = sim.ball;
  b.state = 'owned'; b.flight = null;
  b.ownerTeam = team; b.ownerIdx = idx;
  b.vx = 0; b.vy = 0; b.h = 0; b.vh = 0; b.curve = 0;
  sim.possession = team; sim.carrier = idx;
  sim.teams.forEach((t) => t.onPitch.forEach((p) => (p.hasBall = false)));
  const p = sim.teams[team].onPitch[idx];
  if (p) {
    p.hasBall = true;
    b.x = p.x; b.y = p.y; b.tx = p.x; b.ty = p.y;
    triggerOneShot(p.anim, sim.minute, 'receive', 0.35);
  }
}

function setLoose(sim: MatchSim, x: number, y: number, vx: number, vy: number, hmax = 0) {
  const b = sim.ball;
  b.state = 'loose'; b.flight = null;
  b.x = clamp(x, 1, 99); b.y = clamp(y, 1, 99);
  b.vx = vx; b.vy = vy; b.h = 0; b.vh = hmax > 0 ? hmax * 2 : 0; b.curve = 0;
  b.looseTimer = 0;
  sim.teams.forEach((t) => t.onPitch.forEach((p) => (p.hasBall = false)));
}

function winPossession(sim: MatchSim, team: 0 | 1, idx: number, counter: boolean) {
  setOwned(sim, team, idx);
  sim.lastPasser = null;
  if (counter) {
    const bpx = team === 0 ? sim.ball.x : 100 - sim.ball.x;
    if (bpx < 38) sim.teams[team].counterUntil = sim.minute + 1.6;
  }
}

function distToBall(p: SimPlayer, b: SimBall) {
  return Math.hypot(p.x - b.x, p.y - b.y);
}

function controlRadius(p: SimPlayer, intended: boolean): number {
  let r = intended ? 3.0 : 1.5;
  if (p.role === 'GK') r += 1.1;
  r *= 0.75 + (p.attrs.physical / 400);
  if (p.injured) r *= 0.8;
  return r;
}

/** Physics substep for the ball. Called with small dt (<=0.025 game-min). */
function ballSubstep(sim: MatchSim, dt: number) {
  const b = sim.ball;
  if (b.state === 'owned') {
    const o = sim.teams[b.ownerTeam].onPitch[b.ownerIdx];
    if (!o) { setLoose(sim, b.x, b.y, 0, 0); return; }
    // Dribble: ball rides just ahead of the carrier's facing direction.
    const lead = 1.1 + Math.min(1.6, o.speed * 0.09);
    const gx = o.x + Math.cos(o.facing) * lead;
    const gy = o.y + Math.sin(o.facing) * lead * 0.9;
    b.x += (gx - b.x) * Math.min(1, dt * 30);
    b.y += (gy - b.y) * Math.min(1, dt * 30);
    b.tx = gx; b.ty = gy;
    b.h = 0;
    liveTackle(sim, dt);
    return;
  }
  if (b.state === 'flight' && b.flight) {
    const f = b.flight;
    const dx = f.tx - b.x, dy = f.ty - b.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    // Ease off near the target on non-shot balls so the receiver can meet it.
    let sp = f.speed;
    if (f.outcome !== 'shot' && dist < 5) sp = f.speed * (0.4 + 0.6 * (dist / 5));
    // Steer toward target at kind speed, with curve (magnus) lateral accel.
    let vx = (dx / dist) * sp, vy = (dy / dist) * sp;
    if (b.curve !== 0) {
      const px = -dy / dist, py = dx / dist;
      vx += px * b.curve * 26; vy += py * b.curve * 26;
    }
    const k = Math.min(1, dt * 14);
    b.vx += (vx - b.vx) * k;
    b.vy += (vy - b.vy) * k;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    // Height follows an arc by remaining distance.
    const total = Math.max(6, Math.hypot(f.tx - b.fx, f.ty - b.fy));
    const done = clamp(1 - dist / total, 0, 1);
    b.h = 4 * f.hmax * done * (1 - done);
    b.x = clamp(b.x, -3, 103); b.y = clamp(b.y, 1, 99);
    // Reception / interception checks while in flight.
    if (b.h < 4.5 && checkFlightReception(sim, f)) return;
    if (dist < 1.6) { arriveFlight(sim); return; }
    return;
  }
  if (b.state === 'loose') {
    // Friction + gravity for bounced balls.
    const fr = Math.max(0, 1 - 3.2 * dt);
    b.vx *= fr; b.vy *= fr;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.vh !== 0 || b.h > 0) {
      b.vh -= 26 * dt;
      b.h = Math.max(0, b.h + b.vh * dt);
      if (b.h === 0) b.vh = 0;
    }
    // Soft sideline bounce so play never gets stuck.
    if (b.x < 1) { b.x = 1; b.vx = Math.abs(b.vx) * 0.3; }
    if (b.x > 99) { b.x = 99; b.vx = -Math.abs(b.vx) * 0.3; }
    if (b.y < 1) { b.y = 1; b.vy = Math.abs(b.vy) * 0.3; }
    if (b.y > 99) { b.y = 99; b.vy = -Math.abs(b.vy) * 0.3; }
    b.looseTimer += dt;
    checkLoosePickup(sim);
    return;
  }
  // dead: ball stays where it is (net / out of play) until a restart.
}

/** Live tackle attempts by the closest presser while the ball is owned. */
function liveTackle(sim: MatchSim, dt: number) {
  const b = sim.ball;
  const O = (1 - b.ownerTeam) as 0 | 1;
  const opp = sim.teams[O];
  const owner = sim.teams[b.ownerTeam].onPitch[b.ownerIdx];
  if (!owner || b.ownerIdx === 0) return;
  const di = nearestTo(opp, b.x, b.y);
  const d = opp.onPitch[di];
  if (distToBall(d, b) > 1.9) return;
  const press = opp.tactics.pressing;
  const p = 0.035 * dt * (0.5 + (press - 3) * 0.35 + (d.attrs.defending * fitFactor(d) - owner.attrs.dribbling * fitFactor(owner)) / 160);
  if (Math.random() < Math.max(0.004 * dt * 60 * 0.02, p)) {
    triggerOneShot(d.anim, sim.minute, 'tackle', 0.4);
    if (Math.random() < 0.07) {
      // Failed tackle -> foul.
      sim.stats.fouls[O]++;
      if (Math.random() < 0.25) {
        d.yellow++;
        adj(d, -0.3);
        addEv(sim, 'card', `🟨 Kartu kuning untuk ${d.name} (${opp.short}) setelah tekel keras ke ${lastName(owner.name)}.`, O);
      }
      sim.nextAction = Math.max(sim.nextAction, sim.minute + 0.4);
      return;
    }
    winPossession(sim, O, di, true);
    adj(d, 0.1); adj(owner, -0.06);
    if (Math.random() < 0.3) addEv(sim, 'chance', `🦵 Tekel bersih ${lastName(d.name)} merebut bola dari ${lastName(owner.name)}.`, O);
  }
}

function checkFlightReception(sim: MatchSim, f: BallFlight): boolean {
  const b = sim.ball;
  // Intended receiver controls early when the ball reaches them.
  if (f.intended && f.outcome === 'receive') {
    const p = sim.teams[f.intended.team].onPitch[f.intended.idx];
    if (p && distToBall(p, b) < controlRadius(p, true)) {
      applyReceive(sim, f);
      return true;
    }
  }
  // Predetermined interceptor meets the ball.
  if (f.interceptor && f.outcome === 'intercept') {
    const p = sim.teams[f.interceptor.team].onPitch[f.interceptor.idx];
    if (p && distToBall(p, b) < controlRadius(p, true)) {
      applyIntercept(sim, f);
      return true;
    }
  }
  // Note: mid-flight poaching is intentionally NOT rolled here. The pass outcome
  // was predetermined by the decision engine (same balance as before); the flight
  // phase enacts it while both sides run. Organic turnovers still come from live
  // tackles on the carrier, loose-ball fights and heavy touches.
  // Shots: GK intervention is resolved at arrival (see arriveShot).
  return false;
}

function applyReceive(sim: MatchSim, f: BallFlight) {
  const b = sim.ball;
  if (!f.intended) { setLoose(sim, b.x, b.y, b.vx * 0.15, b.vy * 0.15); return; }
  const recv = sim.teams[f.intended.team].onPitch[f.intended.idx];
  const kick = sim.teams[f.kicker.team].onPitch[f.kicker.idx];
  // Heavy first touch for difficult balls.
  const difficult = b.h > 2.5 || Math.hypot(b.vx, b.vy) > 80;
  if (difficult && recv && Math.random() < 0.12 - recv.attrs.dribbling / 1200) {
    setLoose(sim, b.x, b.y, b.vx * 0.25 + rand(-8, 8), b.vy * 0.25 + rand(-8, 8), 1.5);
    sim.possession = f.intended.team;
    addEv(sim, 'chance', `😬 Kontrol ${lastName(recv.name)} lepas, bola liar!`, f.intended.team);
    return;
  }
  sim.stats.passes[f.kicker.team]++;
  sim.lastPasser = f.kicker.idx;
  setOwned(sim, f.intended.team, f.intended.idx);
  if (kick && recv) {
    const fwd = (f.intended.team === 0 ? recv.x - kick.x : kick.x - recv.x);
    adj(kick, fwd > 8 ? 0.025 : 0.012);
  }
}

function applyIntercept(sim: MatchSim, f: BallFlight) {
  if (!f.interceptor) { const b = sim.ball; setLoose(sim, b.x, b.y, b.vx * 0.2, b.vy * 0.2); return; }
  const it = sim.teams[f.interceptor.team].onPitch[f.interceptor.idx];
  const kick = sim.teams[f.kicker.team].onPitch[f.kicker.idx];
  winPossession(sim, f.interceptor.team, f.interceptor.idx, true);
  if (kick) adj(kick, -0.05);
  if (it) adj(it, 0.07);
  if (Math.random() < 0.3 && it) addEv(sim, 'chance', `✂️ ${lastName(it.name)} memotong umpan ${kick ? lastName(kick.name) : ''}!`, f.interceptor.team);
}

function arriveFlight(sim: MatchSim) {
  const b = sim.ball;
  const f = b.flight;
  if (!f) { b.state = 'loose'; return; }
  if (f.outcome === 'shot' && f.shot) { arriveShot(sim, f); return; }
  if (f.outcome === 'receive' && f.intended) {
    const p = sim.teams[f.intended.team].onPitch[f.intended.idx];
    if (p && distToBall(p, b) < controlRadius(p, true) + 2.0) { applyReceive(sim, f); return; }
  }
  if (f.outcome === 'intercept' && f.interceptor) {
    const p = sim.teams[f.interceptor.team].onPitch[f.interceptor.idx];
    if (p && distToBall(p, b) < controlRadius(p, true) + 2.0) { applyIntercept(sim, f); return; }
  }
  // Nobody cleanly met it -> loose ball / rebound.
  setLoose(sim, f.tx, f.ty, b.vx * 0.12, b.vy * 0.12);
  sim.possession = f.kicker.team;
}

// ---------- core action ----------
function doAction(sim: MatchSim) {
  const T = sim.possession, O = (1 - T) as 0 | 1;
  const team = sim.teams[T], opp = sim.teams[O];
  const tac = team.tactics, otac = opp.tactics;
  const counter = sim.minute < team.counterUntil;
  // Time-wasting when protecting a late lead.
  const leading = sim.score[T] > sim.score[O] && sim.minute > 78;
  let interval = clamp(0.34 - (tac.tempo - 3) * 0.05 + rand(-0.08, 0.1), 0.2, 0.6);
  if (counter) interval *= 0.85;
  if (leading) interval *= 1.25;
  sim.nextAction = sim.minute + interval;

  if (sim.kickoffFor !== null) {
    const kt = sim.kickoffFor;
    sim.lastPasser = null;
    sim.nextAction = sim.minute + 0.6;
    sim.kickoffFor = null;
    const idx = sim.teams[kt].onPitch.length - 1;
    sim.ball.x = 50; sim.ball.y = 50;
    sim.ball.fx = 50; sim.ball.fy = 50; sim.ball.tx = 50; sim.ball.ty = 50;
    setOwned(sim, kt, idx);
    return;
  }

  // Wait for the ball while it's travelling or loose.
  if (sim.ball.state === 'flight' || sim.ball.state === 'dead') return;
  if (sim.ball.state === 'loose') {
    sim.stats.poss[T]++;
    sim.nextAction = sim.minute + 0.25;
    return;
  }

  const c = team.onPitch[sim.carrier];
  const pr = prog(sim, T);
  sim.stats.poss[T]++;
  const atk = teamAvg(team, (p) => (POS_GROUP[p.role] === 'ATT' || POS_GROUP[p.role] === 'MID' ? power(p) : power(p) * 0.6));
  const def = teamAvg(opp, (p) => (POS_GROUP[p.role] === 'DEF' || p.role === 'CDM' ? power(p) : power(p) * 0.7));

  // shot
  if (pr > 62 && sim.carrier !== 0) {
    let shotChance = 0.36 + (pr - 62) / 75 + (tac.mentality - 3) * 0.035 + (atk - def) / 200 - (otac.mentality < 3 ? 0.03 : 0);
    if (counter) shotChance += 0.08; // counter-attacks end in shots more often
    if (leading) shotChance *= 0.7;
    if (Math.random() < shotChance) return shoot(sim, T, pr);
  } else if (pr > 55 && sim.carrier !== 0 && Math.random() < 0.09 + (tac.mentality - 3) * 0.01) {
    return shoot(sim, T, pr);
  }

  // foul
  if (Math.random() < 0.018 + (otac.pressing - 3) * 0.005) {
    const fi = nearestTo(opp, c.x, c.y);
    const f = opp.onPitch[fi];
    sim.stats.fouls[O]++;
    triggerOneShot(f.anim, sim.minute, 'tackle', 0.4);
    if (Math.random() < 0.28) {
      f.yellow++;
      adj(f, -0.3);
      addEv(sim, 'card', `🟨 Kartu kuning untuk ${f.name} (${opp.short}) setelah menjatuhkan ${lastName(c.name)}.`, O);
    }
    sim.nextAction = sim.minute + 0.5;
    return;
  }

  // dribble (counter-attacks and brave carriers drive forward)
  const dribbleP = 0.12 + (c.attrs.dribbling - 70) / 300 + (counter ? 0.15 : 0) + (tac.mentality - 3) * 0.02 + (pr > 58 ? 0.08 : 0);
  if (sim.carrier !== 0 && Math.random() < dribbleP) {
    const di = nearestTo(opp, c.x, c.y);
    const d = opp.onPitch[di];
    const win = 0.55 + (c.attrs.dribbling * fitFactor(c) - d.attrs.defending * fitFactor(d)) / 120;
    triggerOneShot(d.anim, sim.minute, 'tackle', 0.4);
    if (Math.random() < win) {
      // Successful take-on: knock the ball into space and chase it.
      const dir = T === 0 ? 1 : -1;
      const nx = clamp(c.x + dir * rand(5, 9), 2, 98);
      const ny = clamp(c.y + rand(-7, 7), 4, 96);
      kickBall(sim, { team: T, idx: sim.carrier }, nx, ny, 'dribble',
        { intended: { team: T, idx: sim.carrier }, outcome: 'receive', interceptor: null, shot: null });
      triggerOneShot(c.anim, sim.minute, 'dribble', 0.4);
      adj(c, 0.05);
    } else {
      winPossession(sim, O, di, true);
      adj(c, -0.06); adj(d, 0.08);
    }
    return;
  }

  // ---- pass selection ----
  const cProg = ownX(c, T);
  const cWide = Math.abs(ownY(c, T) - 50);
  const pressured = Math.hypot(opp.onPitch[nearestTo(opp, c.x, c.y)].x - c.x, opp.onPitch[nearestTo(opp, c.x, c.y)].y - c.y) < 4;

  // clearance under heavy pressure deep in own half
  if (cProg < 22 && pressured && sim.carrier !== 0 && Math.random() < 0.5) {
    const fw = team.onPitch.map((p, i) => ({ p, i })).filter(({ i }) => i > 0 && i !== sim.carrier)
      .sort((a, b) => ownX(b.p, T) - ownX(a.p, T))[0];
    const ri = fw ? fw.i : sim.carrier;
    const recv = team.onPitch[ri];
    const ok = Math.random() < 0.55;
    triggerOneShot(c.anim, sim.minute, 'longpass', 0.4);
    if (ok) {
      kickBall(sim, { team: T, idx: sim.carrier }, recv.x, recv.y, 'long',
        { intended: { team: T, idx: ri }, outcome: 'receive', interceptor: null, shot: null });
    } else {
      const ii = nearestTo(opp, recv.x, recv.y, false);
      kickBall(sim, { team: T, idx: sim.carrier }, recv.x, recv.y, 'long',
        { intended: null, outcome: 'intercept', interceptor: { team: O, idx: ii }, shot: null });
    }
    return;
  }

  // cross from wide areas
  if (cWide > 24 && pr > 66 && sim.carrier !== 0 && Math.random() < 0.55) {
    return crossBall(sim, T, O, c);
  }

  // through ball to a runner beyond the line
  if (sim.carrier !== 0 && (POS_GROUP[c.role] === 'MID' || c.role === 'CAM') && pr > 45 && pr < 80) {
    const line = defLine(sim, T);
    const runner = team.onPitch.map((p, i) => ({ p, i }))
      .filter(({ p, i }) => i > 0 && POS_GROUP[p.role] === 'ATT' && ownX(p, T) > line - 8)
      .sort((a, b) => ownX(b.p, T) - ownX(a.p, T))[0];
    if (runner && Math.random() < 0.5 + (c.attrs.passing - 70) / 300) {
      return throughBall(sim, T, O, c, runner.i);
    }
  }

  // standard pass
  const weights = team.onPitch.map((p, i) => {
    if (i === sim.carrier) return 0;
    if (i === 0 && cProg > 30) return 0;
    const forward = ownX(p, T) - cProg;
    const dist = Math.hypot(p.x - c.x, p.y - c.y);
    let w = Math.max(0.15, 1 + (forward / 25) * (0.6 + 0.2 * (tac.mentality - 3) + 0.15 * (tac.tempo - 3)));
    const isAtt = POS_GROUP[p.role] === 'ATT';
    if (isAtt && forward > 0) w *= 1.4; // forwards are the intended outlet: play through to them
    if (counter && forward > 0) w *= 1.6;
    if (leading && forward > 10) w *= 0.4;
    if (dist > 40) w *= isAtt ? (tac.tempo >= 4 ? 0.75 : 0.45) : 0.25; // direct teams may go long to forwards
    if (dist < 6) w *= 0.4;
    return w;
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum, ri = 1;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) { ri = i; break; } }
  const recv = team.onPitch[ri];
  const forward = ownX(recv, T) - cProg;
  const teamPass = teamAvg(team, (p) => p.attrs.passing * fitFactor(p));
  const success = clamp(
    0.83 + (c.attrs.passing * fitFactor(c) - 70) / 250 + (teamPass - def) / 320 - (otac.pressing - 3) * 0.025 - (tac.tempo - 3) * 0.012 - Math.max(0, forward) / 450 + team.familiarity / 2500 + (tac.tempo >= 5 ? 0.03 : tac.tempo <= 2 ? -0.02 : 0),
    0.55, 0.95);
  const dist = Math.hypot(recv.x - c.x, recv.y - c.y);
  const longThresh = tac.tempo >= 5 ? 44 : tac.tempo <= 2 ? 24 : 34; // tiki-taka: short; long ball: direct
  const kind: BallKind = dist > longThresh ? 'long' : 'short';
  triggerOneShot(c.anim, sim.minute, kind === 'long' ? 'longpass' : 'pass', 0.35);
  if (Math.random() < success) {
    kickBall(sim, { team: T, idx: sim.carrier }, recv.x, recv.y, kind,
      { intended: { team: T, idx: ri }, outcome: 'receive', interceptor: null, shot: null });
  } else {
    const mx = (c.x + recv.x) / 2, my = (c.y + recv.y) / 2;
    const ii = nearestTo(opp, mx, my, false);
    kickBall(sim, { team: T, idx: sim.carrier }, recv.x, recv.y, kind,
      { intended: null, outcome: 'intercept', interceptor: { team: O, idx: ii }, shot: null });
  }
}

function crossBall(sim: MatchSim, T: 0 | 1, O: 0 | 1, c: SimPlayer) {
  const team = sim.teams[T], opp = sim.teams[O];
  const dir = T === 0 ? 1 : -1;
  const boxX = T === 0 ? rand(82, 90) : rand(10, 18);
  const boxY = rand(38, 62);
  // Best attacker to meet the cross.
  const att = team.onPitch.map((p, i) => ({ p, i }))
    .filter(({ p, i }) => i > 0 && i !== sim.carrier && (POS_GROUP[p.role] === 'ATT' || p.role === 'CAM'))
    .sort((a, b) => Math.hypot(b.p.x - boxX, b.p.y - boxY) - Math.hypot(a.p.x - boxX, a.p.y - boxY))[0];
  const ri = att ? att.i : sim.carrier;
  const atk = teamAvg(team, power);
  const def = teamAvg(opp, power);
  const success = clamp(0.62 + (c.attrs.passing * fitFactor(c) - 70) / 300 + (atk - def) / 400, 0.35, 0.85);
  triggerOneShot(c.anim, sim.minute, 'longpass', 0.4);
  // Aim slightly ahead of the runner.
  const recv = team.onPitch[ri];
  const leadX = clamp(boxX + (recv.x - boxX) * 0.3 + dir * 2, 4, 96);
  if (Math.random() < success) {
    kickBall(sim, { team: T, idx: sim.carrier }, leadX, boxY, 'cross',
      { intended: { team: T, idx: ri }, outcome: 'receive', interceptor: null, shot: null });
    if (Math.random() < 0.5) addEv(sim, 'chance', `⚡ Umpan silang ${lastName(c.name)} mengarah ke kotak penalti!`, T);
  } else {
    const ii = nearestTo(opp, boxX, boxY, false);
    kickBall(sim, { team: T, idx: sim.carrier }, leadX, boxY, 'cross',
      { intended: null, outcome: 'intercept', interceptor: { team: O, idx: ii }, shot: null });
  }
}

function throughBall(sim: MatchSim, T: 0 | 1, O: 0 | 1, c: SimPlayer, runnerIdx: number) {
  const dir = T === 0 ? 1 : -1;
  const runner = sim.teams[T].onPitch[runnerIdx];
  const tx = clamp(runner.x + dir * rand(7, 11), 4, 96);
  const ty = clamp(runner.y + rand(-4, 4), 6, 94);
  runner.runUntil = sim.minute + 1.2;
  const teamPass = teamAvg(sim.teams[T], (p) => p.attrs.passing * fitFactor(p));
  const def = teamAvg(sim.teams[O], power);
  const success = clamp(0.68 + (c.attrs.passing * fitFactor(c) - 70) / 280 + (teamPass - def) / 380, 0.4, 0.9);
  triggerOneShot(c.anim, sim.minute, 'pass', 0.35);
  if (Math.random() < success) {
    kickBall(sim, { team: T, idx: sim.carrier }, tx, ty, 'through',
      { intended: { team: T, idx: runnerIdx }, outcome: 'receive', interceptor: null, shot: null });
    if (Math.random() < 0.45) addEv(sim, 'chance', `🎯 Terobosan ${lastName(c.name)} membelah pertahanan!`, T);
  } else {
    const ii = nearestTo(sim.teams[O], tx, ty, false);
    kickBall(sim, { team: T, idx: sim.carrier }, tx, ty, 'through',
      { intended: null, outcome: 'intercept', interceptor: { team: O, idx: ii }, shot: null });
  }
}

function shoot(sim: MatchSim, T: 0 | 1, pr: number) {
  const O = (1 - T) as 0 | 1;
  const team = sim.teams[T], opp = sim.teams[O];
  const c = team.onPitch[sim.carrier];
  const gk = opp.onPitch[0];
  const q = clamp((pr - 60) / 36, 0, 1);
  const xg = clamp(0.045 + q * 0.22 + (c.attrs.shooting * fitFactor(c) - gk.attrs.goalkeeping * fitFactor(gk)) / 320 + (team.tactics.mentality - 3) * 0.008, 0.02, 0.40);
  sim.stats.shots[T]++;
  c.shots++;
  const r = Math.random();
  const result = r < xg ? 'goal' : r < xg + 0.32 ? (Math.random() < 0.3 ? 'parry' : 'save') : r < xg + 0.5 ? 'block' : 'miss';
  // Shot selection by situation and attributes.
  const distGoal = T === 0 ? 100 - c.x : c.x;
  const wide = Math.abs(c.y - 50);
  const gkOffLine = (O === 0 ? gk.x : 100 - gk.x) > 9;
  let kind: BallKind = 'ground';
  if (distGoal > 26 && c.attrs.shooting > 72 && Math.random() < 0.5) kind = 'power';
  else if (wide > 18 && distGoal < 30 && Math.random() < 0.45) kind = 'curved';
  else if (gkOffLine && distGoal < 32 && Math.random() < 0.4) kind = 'chip';
  else if (distGoal > 22 && Math.random() < 0.35) kind = 'power';
  const goalX = T === 0 ? 100 : 0;
  let tx: number, ty: number;
  if (result === 'goal') { tx = goalX + (T === 0 ? 1.5 : -1.5); ty = Math.random() < 0.5 ? rand(44, 48) : rand(52, 56); }
  else if (result === 'save' || result === 'parry') { tx = goalX + (T === 0 ? -1 : 1); ty = clamp(gk.y + rand(-4, 4), 42, 58); }
  else if (result === 'block') {
    const di = nearestTo(opp, c.x, c.y);
    const blk = opp.onPitch[di];
    tx = (c.x + blk.x) / 2; ty = (c.y + blk.y) / 2;
  } else { tx = goalX + (T === 0 ? 2.5 : -2.5); ty = rand(30, 70) < 50 ? rand(33, 41) : rand(59, 67); }
  triggerOneShot(c.anim, sim.minute, 'shoot', 0.45);
  // Goalkeeper reads the shot: dive toward the shot line.
  gk.diveDir = clamp((ty - gk.y) / 6, -1, 1);
  kickBall(sim, { team: T, idx: sim.carrier }, tx, ty, kind,
    { intended: null, outcome: 'shot', interceptor: null, shot: { team: T, shooter: sim.carrier, result } });
  sim.nextAction = sim.minute + 0.9;
}

function arriveShot(sim: MatchSim, f: BallFlight) {
  const b = sim.ball;
  const s = f.shot!;
  const T = s.team, O = (1 - T) as 0 | 1;
  const team = sim.teams[T], opp = sim.teams[O];
  const c = team.onPitch[s.shooter];
  const gk = opp.onPitch[0];
  const t = team.short;
  triggerOneShot(gk.anim, sim.minute, 'diving', 0.8);
  if (s.result === 'goal') {
    sim.score[T]++;
    sim.stats.onTarget[T]++;
    b.state = 'dead'; b.flight = null; b.vx = 0; b.vy = 0;
    let assistTxt = '';
    if (c) {
      adj(c, 1.0);
      if (sim.lastPasser !== null && sim.lastPasser !== s.shooter) {
        const a = team.onPitch[sim.lastPasser];
        if (a) { a.assists++; adj(a, 0.6); assistTxt = ` Assist dari ${lastName(a.name)}.`; }
      }
      c.goals++;
      // Celebration: clock freezes, scorer runs to the corner flag, teammates mob him (≤10 s at 1x).
      const cornerY = (T === 0 ? c.y : 100 - c.y) < 50 ? 8 : 92;
      sim.celebration = { t: 0, dur: 7, team: T, scorer: s.shooter, cornerY, scorerName: c.name };
      team.onPitch.forEach((p, i) => { if (i !== 0) p.celebrateUntil = sim.minute + 0.5; });
    }
    adj(gk, -0.35);
    opp.onPitch.forEach((p) => POS_GROUP[p.role] === 'DEF' && adj(p, -0.12));
    const lines = [
      `⚽ GOOOL! ${c ? c.name : ''} menaklukkan kiper dengan tembakan keras!`,
      `⚽ GOL! Penyelesaian dingin dari ${c ? c.name : ''} untuk ${team.name}!`,
      `⚽ GOOOL! ${c ? c.name : ''} menyambar bola dan menjebol gawang ${opp.short}!`,
      `⚽ GOL INDAH! ${c ? c.name : ''} melengkungkan bola ke pojok atas!`,
    ];
    addEv(sim, 'goal', `${pick(lines)}${assistTxt} Skor ${sim.homeIsUser ? sim.score[0] : sim.score[1]}-${sim.homeIsUser ? sim.score[1] : sim.score[0]}.`, T);
    sim.kickoffFor = O;
    sim.nextAction = sim.minute + 1.4;
    return;
  }
  if (s.result === 'save' || s.result === 'parry') {
    sim.stats.onTarget[T]++;
    gk.saves++;
    adj(gk, 0.3);
    if (c) adj(c, 0.1);
    addEv(sim, 'save', pick([
      `🧤 Peluang! Tembakan ${c ? lastName(c.name) : ''} (${t}) ditepis ${gk.name}.`,
      `🧤 Penyelamatan gemilang ${gk.name} menggagalkan ${c ? lastName(c.name) : ''}!`,
      `🧤 ${c ? lastName(c.name) : ''} mencoba dari jarak dekat, tapi ${lastName(gk.name)} sigap mengamankan bola.`,
    ]), T);
    if (s.result === 'parry') {
      // Rebound: ball spills into the box, both sides chase it.
      const dir = T === 0 ? -1 : 1;
      setLoose(sim, clamp(b.x + dir * 5, 4, 96), clamp(b.y + rand(-8, 8), 8, 92), dir * rand(10, 20), rand(-14, 14), 2);
      sim.possession = T;
    } else {
      setOwned(sim, O, 0);
      sim.lastPasser = null;
    }
    sim.nextAction = sim.minute + 0.9;
    return;
  }
  if (s.result === 'block') {
    const di = nearestTo(opp, b.x, b.y);
    const blk = opp.onPitch[di];
    adj(blk, 0.12);
    triggerOneShot(blk.anim, sim.minute, 'tackle', 0.4);
    // Deflection falls to the blocker.
    if (Math.random() < 0.4) addEv(sim, 'chance', `🛡️ Tembakan ${c ? lastName(c.name) : ''} diblok ${lastName(blk.name)}.`, T);
    winPossession(sim, O, di, true);
    sim.nextAction = sim.minute + 0.5;
    return;
  }
  // miss: ball sails out, goal kick to the keeper (discrete restart).
  if (c) adj(c, -0.06);
  addEv(sim, 'miss', pick([
    `💨 ${c ? c.name : ''} melepaskan tembakan, tapi melebar dari gawang.`,
    `💨 Sepakan ${c ? lastName(c.name) : ''} melambung di atas mistar.`,
    `💨 Nyaris! Tembakan ${c ? lastName(c.name) : ''} hanya menyamping tipis.`,
  ]), T);
  b.state = 'dead'; b.flight = null; b.vx = 0; b.vy = 0;
  const gx = O === 0 ? 6 : 94;
  b.x = gx; b.y = 50; b.tx = gx; b.ty = 50;
  setOwned(sim, O, 0);
  sim.lastPasser = null;
  sim.nextAction = sim.minute + 0.9;
}

function checkLoosePickup(sim: MatchSim) {
  const b = sim.ball;
  if (b.h > 3) return;
  const spd = Math.hypot(b.vx, b.vy);
  // Whoever gets close enough controls a slow loose ball.
  let bestTeam: 0 | 1 = 0, bestIdx = -1, bestD = 1e9;
  for (let ti = 0; ti < 2; ti++) {
    const t = sim.teams[ti as 0 | 1];
    for (let i = 0; i < t.onPitch.length; i++) {
      const p = t.onPitch[i];
      if (p.injured) continue;
      const d = distToBall(p, b);
      const need = controlRadius(p, false) * (spd > 30 ? 0.7 : 1);
      if (d < need && d < bestD) { bestTeam = ti as 0 | 1; bestIdx = i; bestD = d; }
    }
  }
  const best = bestIdx >= 0 ? { team: bestTeam, idx: bestIdx, d: bestD } : null;
  if (best) {
    const prevOwner = sim.possession;
    setOwned(sim, best.team, best.idx);
    sim.lastPasser = null;
    if (best.team !== prevOwner) {
      const bpx = best.team === 0 ? b.x : 100 - b.x;
      if (bpx < 38) sim.teams[best.team].counterUntil = sim.minute + 1.6;
    }
    return;
  }
  // Failsafe: a completely dead ball is awarded to the nearest player.
  if (b.looseTimer > 2.2 && spd < 4) {
    let bd = 1e9, bt: 0 | 1 = 0, bi = 0;
    sim.teams.forEach((t, ti) => {
      t.onPitch.forEach((p, i) => {
        const d = distToBall(p, b);
        if (d < bd) { bd = d; bt = ti as 0 | 1; bi = i; }
      });
    });
    setOwned(sim, bt, bi);
    sim.lastPasser = null;
  }
}

// ---------- AI ----------
/** Automatic substitutions for the user's team: the most tired (or injured)
 *  outfield player is replaced by the best bench player in a similar position. */
function userAutoSub(sim: MatchSim) {
  if (!sim.autoSub) return;
  const t = sim.teams[0];
  if (t.subsUsed >= 5 || !t.bench.length) return;
  const thr = sim.autoSubThreshold;
  const tired = t.onPitch.map((p, i) => ({ p, i }))
    .filter(({ p, i }) => (i > 0 && (p.injured || p.fitness < thr)) || (i === 0 && p.injured))
    .sort((a, b) => a.p.fitness - b.p.fitness)[0];
  if (!tired) return;
  const grp = POS_GROUP[tired.p.role];
  const sub = t.bench.find((b) => POS_GROUP[b.natPos] === grp) ?? t.bench.find((b) => b.natPos !== 'GK');
  if (sub) substitute(sim, 0, tired.i, sub.id);
}

function aiManage(sim: MatchSim) {
  const t = sim.teams[1];
  const diff = sim.score[1] - sim.score[0];
  if (sim.minute > 65) {
    const m = diff < 0 ? 4 + (sim.minute > 80 ? 1 : 0) : diff > 0 ? 2 : 3;
    if (m !== t.tactics.mentality) {
      t.tactics.mentality = m;
      addEv(sim, 'tactic', `📋 ${t.name} mengubah mentalitas menjadi ${m >= 4 ? 'lebih menyerang' : m <= 2 ? 'lebih bertahan' : 'seimbang'}.`, 1);
    }
  }
  if (t.subsUsed < 5 && t.bench.length) {
    const tired = t.onPitch.map((p, i) => ({ p, i })).filter(({ p, i }) => i > 0 && (p.fitness < 68 || p.injured)).sort((a, b) => a.p.fitness - b.p.fitness)[0];
    if (tired) {
      const grp = POS_GROUP[tired.p.role];
      const sub = t.bench.find((b) => POS_GROUP[b.natPos] === grp) ?? t.bench.find((b) => b.natPos !== 'GK');
      if (sub) substitute(sim, 1, tired.i, sub.id);
    }
  }
}

export function substitute(sim: MatchSim, ti: 0 | 1, outIdx: number, benchId: string) {
  const t = sim.teams[ti];
  if (t.subsUsed >= 5) return false;
  const bi = t.bench.findIndex((b) => b.id === benchId);
  if (bi < 0) return false;
  const out = t.onPitch[outIdx];
  const inn = t.bench[bi];
  // Queue the sideline walk-on/walk-off animation for the renderer.
  sim.subFx.push({ team: ti, outNum: out.num, outX: out.x, outY: out.y, inNum: inn.num, inId: inn.id, startMin: sim.minute });
  if (sim.subFx.length > 4) sim.subFx.shift();
  inn.role = out.role; inn.bx = out.bx; inn.by = out.by;
  inn.x = out.x; inn.y = out.y;
  inn.vx = 0; inn.vy = 0; inn.speed = 0;
  inn.facing = ti === 0 ? 0 : Math.PI; inn.targetFacing = inn.facing;
  inn.eff = inn.natPos === inn.role ? inn.ovr : POS_GROUP[inn.natPos] === POS_GROUP[inn.role] ? inn.ovr - 3 : inn.role === 'GK' || inn.natPos === 'GK' ? inn.ovr - 35 : inn.ovr - 12;
  t.onPitch[outIdx] = inn;
  t.bench.splice(bi, 1);
  t.subbedOff.push(out);
  t.subsUsed++;
  // If the outgoing player held the ball, hand it to the replacement.
  if (sim.ball.state === 'owned' && sim.possession === ti && sim.ball.ownerIdx === outIdx) {
    setOwned(sim, ti, outIdx);
  }
  addEv(sim, 'sub', `🔁 Pergantian ${t.short}: ${inn.name} masuk menggantikan ${out.name}${out.injured ? ' (cedera)' : out.fitness < 55 ? ' (kelelahan)' : ''}.`, ti);
  return true;
}

export function setTactics(sim: MatchSim, tactics: Tactics) {
  const t = sim.teams[0];
  const changed = tactics.formation !== t.tactics.formation;
  t.tactics = { ...tactics };
  if (changed) {
    const slots = FORMATIONS[tactics.formation];
    t.onPitch.forEach((p, i) => {
      p.role = slots[i].role; p.bx = slots[i].x; p.by = slots[i].y;
      p.eff = p.natPos === p.role ? p.ovr : POS_GROUP[p.natPos] === POS_GROUP[p.role] ? p.ovr - 3 : p.ovr - 12;
    });
  }
  addEv(sim, 'tactic', `📋 Instruksi dari pinggir lapangan: ${t.name} kini ${tactics.formation}, mentalitas ${['sangat defensif', 'defensif', 'seimbang', 'ofensif', 'sangat ofensif'][tactics.mentality - 1]}.`, 0);
}

// ---------- step ----------
export function step(sim: MatchSim, dtGame: number) {
  if (sim.finished) return;
  if (sim.celebration) {
    const c = sim.celebration;
    c.t += dtGame; // dtGame == real seconds at 1x -> celebration lasts c.dur seconds (hard cap 10)
    if (c.t >= Math.min(10, c.dur)) {
      sim.teams[c.team].onPitch.forEach((p) => (p.celebrateUntil = 0));
      sim.celebration = null;
      // Beat before kick-off: players jog back into formation first, the ball is
      // only placed at the centre spot once nextAction fires (2.5s at 1x).
      sim.nextAction = sim.minute + 2.5;
    }
    return;
  }
  sim.minute += dtGame;

  // fitness & injuries
  sim.teams.forEach((t, ti) => {
    t.onPitch.forEach((p) => {
      const drain = Math.max(0.12, 0.3 + 0.07 * (t.tactics.pressing - 3) + 0.05 * (t.tactics.tempo - 3) + (70 - p.attrs.physical) / 700);
      p.fitness = Math.max(5, p.fitness - drain * dtGame);
      if (p.fitness < 45) adj(p, -0.004 * dtGame);
      if (!p.injured && Math.random() < 0.00007 * dtGame) {
        p.injured = true;
        adj(p, -0.2);
        addEv(sim, 'injury', `🚑 ${p.name} (${t.short}) tampak memegangi kakinya — sepertinya cedera!${ti === 0 ? ' Pertimbangkan pergantian.' : ''}`, ti as 0 | 1);
      }
    });
  });

  // ball physics in fixed small substeps for stability at any game speed
  const n = Math.max(1, Math.ceil(dtGame / 0.025));
  const h = dtGame / n;
  for (let i = 0; i < n; i++) ballSubstep(sim, h);

  if (!sim.halfDone && sim.minute >= 45) {
    sim.halfDone = true;
    sim.minute = 45;
    sim.pauseRequest = true;
    addEv(sim, 'whistle', `⏱️ Turun minum! Skor babak pertama ${sim.homeIsUser ? sim.score[0] : sim.score[1]}-${sim.homeIsUser ? sim.score[1] : sim.score[0]}.`);
    sim.kickoffFor = sim.homeIsUser ? 1 : 0;
    sim.nextAction = 45.3;
    sim.teams.forEach((t) => t.onPitch.forEach((p) => (p.fitness = Math.min(100, p.fitness + 4))));
    return;
  }
  if (sim.minute >= 90 + sim.stoppage) {
    finish(sim);
    return;
  }
  if (sim.minute >= sim.lastAiCheck + 6) { sim.lastAiCheck = sim.minute; aiManage(sim); userAutoSub(sim); }
  if (sim.minute >= 89.5 && sim.minute - dtGame < 89.5) addEv(sim, 'info', `⏳ Wasit keempat mengangkat papan: tambahan waktu ${sim.stoppage} menit.`);
  let guard = 0;
  while (sim.minute >= sim.nextAction && guard++ < 5) doAction(sim);
}

function finish(sim: MatchSim) {
  sim.finished = true;
  const [u, o] = sim.score;
  sim.teams.forEach((t, ti) => {
    const won = ti === 0 ? u > o : o > u, lost = ti === 0 ? u < o : o < u;
    [...t.onPitch, ...t.subbedOff].forEach((p) => {
      adj(p, won ? 0.3 : lost ? -0.2 : 0.05);
      if (sim.score[(1 - ti) as 0 | 1] === 0 && (POS_GROUP[p.role] === 'DEF' || p.role === 'GK')) adj(p, 0.4);
      p.rating = Math.round(p.rating * 10) / 10;
    });
  });
  const hs = sim.homeIsUser ? u : o, as = sim.homeIsUser ? o : u;
  addEv(sim, 'whistle', `🏁 Peluit panjang! Skor akhir ${sim.homeIsUser ? sim.teams[0].name : sim.teams[1].name} ${hs}-${as} ${sim.homeIsUser ? sim.teams[1].name : sim.teams[0].name}.`);
}

// ---------- movement engine (Phase 1) ----------
function paceSpeed(p: SimPlayer): number {
  const fit = p.fitness >= 65 ? 1 : 0.75 + (0.25 * p.fitness) / 65;
  const base = 9.5 + (p.attrs.pace - 60) * 0.16;
  return clamp(base, 7, 17) * fit * (p.injured ? 0.55 : 1);
}

interface TeamCtx {
  hasBall: boolean;
  attacking: boolean; // positioning phase: owns the ball, or the ball is travelling/loose toward us
  bpx: number; bpy: number; // ball in own perspective
  line: number; // offside line (own perspective)
  counter: boolean;
  kickoff: boolean;
  carrierPos: { x: number; y: number } | null;
}

function teamContext(sim: MatchSim, t: 0 | 1): TeamCtx {
  const hasBall = sim.ball.state === 'owned' && sim.possession === t;
  const bpx = t === 0 ? sim.ball.x : 100 - sim.ball.x;
  const bpy = t === 0 ? sim.ball.y : 100 - sim.ball.y;
  const team = sim.teams[t];
  let carrierPos: { x: number; y: number } | null = null;
  if (hasBall) {
    const c = team.onPitch[sim.carrier];
    if (c) carrierPos = { x: t === 0 ? c.x : 100 - c.x, y: t === 0 ? c.y : 100 - c.y };
  }
  // During ball flight the phase must stay "attacking" for the team that kicked it,
  // otherwise forwards drop back to defensive spots mid-pass and never stay high.
  const attacking = hasBall
    || (sim.ball.state === 'flight' && !!sim.ball.flight && sim.ball.flight.kicker.team === t)
    || (sim.ball.state === 'loose' && bpx > 45);
  return {
    hasBall, attacking, bpx, bpy,
    line: defLine(sim, t),
    counter: sim.minute < team.counterUntil,
    kickoff: sim.kickoffFor !== null || (sim.halfDone && sim.minute <= 45.4),
    carrierPos,
  };
}

/** Role-intelligent target in own-perspective coords. */
function roleTarget(sim: MatchSim, t: 0 | 1, i: number, ctx: TeamCtx, time: number): { x: number; y: number; wantSprint: boolean } {
  const team = sim.teams[t];
  const p = team.onPitch[i];
  const tac = team.tactics;
  const bpx = ctx.bpx, bpy = ctx.bpy;
  let wantSprint = false;

  if (sim.celebration) {
    const c = sim.celebration;
    const phase = c.t / Math.min(10, c.dur);
    if (phase > 0.72) return { x: Math.min(p.bx * 0.5 + 2, 48), y: p.by, wantSprint: false }; // jog back for kick-off
    if (t !== c.team) return { x: Math.min(p.bx * 0.5 + 4, 46), y: p.by, wantSprint: false }; // conceding side trudges back
    if (i === 0) return { x: 6, y: 50, wantSprint: false };
    const sx = 93 - Math.max(0, phase - 0.35) * 14; // scorer reaches the flag then drifts back along the line
    if (i === c.scorer) return { x: sx, y: c.cornerY, wantSprint: phase < 0.4 };
    const ang = (i / 11) * Math.PI * 2;
    const ring = 3.2 + (i % 3) * 0.9;
    return { x: clamp(sx - 3 + Math.cos(ang) * ring, 4, 96), y: clamp(c.cornerY + Math.sin(ang) * ring, 4, 96), wantSprint: phase < 0.5 };
  }

  if (ctx.kickoff) {
    return { x: Math.min(p.bx * 0.5 + 2, 48), y: p.by, wantSprint: false };
  }

  // Ball-chasing overrides ------------------------------------------------
  const isCarrier = ctx.hasBall && i === sim.carrier;
  const f = sim.ball.flight;
  const isIntended = !!f && !!f.intended && f.intended.team === t && f.intended.idx === i && f.outcome === 'receive';
  const isInterceptor = !!f && !!f.interceptor && f.interceptor.team === t && f.interceptor.idx === i && f.outcome === 'intercept';
  if (isIntended && f) {
    return { x: t === 0 ? f.tx : 100 - f.tx, y: t === 0 ? f.ty : 100 - f.ty, wantSprint: true };
  }
  if (isInterceptor && f) {
    const mx = (f.tx + bpx) / 2, my = (f.ty + bpy) / 2;
    return { x: mx, y: my, wantSprint: true };
  }
  if (sim.ball.state === 'loose') {
    // Closest two per team hunt the loose ball.
    const mine = team.onPitch.map((q, j) => ({ j, d: Math.hypot(q.x - sim.ball.x, q.y - sim.ball.y) }))
      .sort((a, b2) => a.d - b2.d);
    const rank = mine.findIndex((m) => m.j === i);
    if (rank >= 0 && rank < 2 && i !== 0) {
      return { x: bpx, y: bpy, wantSprint: true };
    }
  }

  // Goalkeeper -------------------------------------------------------------
  if (i === 0) {
    let ox = clamp(4 + (bpx - 50) * 0.09, 2, 15);
    let oy = 50 + (bpy - 50) * 0.35;
    // Sweep behind a high line when the ball is close and loose/in flight.
    const danger = sim.ball.state !== 'owned' && bpx > 62 && bpx < 96;
    if (danger) {
      ox = clamp(4 + (bpx - 50) * 0.22, 2, 24);
      oy = 50 + (bpy - 50) * 0.5;
    }
    // Shot in flight toward this goal: attack the shot line.
    if (f && f.outcome === 'shot' && f.shot && f.shot.team !== t) {
      const gx = t === 0 ? f.tx : 100 - f.tx;
      const gy = t === 0 ? f.ty : 100 - f.ty;
      ox = clamp(gx * 0.4, 2, 12);
      oy = 50 + (gy - 50) * 0.55;
      wantSprint = true;
    }
    return { x: ox, y: oy, wantSprint };
  }

  // Carrier: dribble into space ------------------------------------------------
  if (isCarrier) {
    const dir = 1; // own perspective always attacks +x
    const O = (1 - t) as 0 | 1;
    const di = nearestTo(sim.teams[O], p.x, p.y);
    const d = sim.teams[O].onPitch[di];
    const ddx = (t === 0 ? d.x - p.x : (100 - d.x) - (100 - p.x));
    const ddy = (t === 0 ? d.y - p.y : (100 - d.y) - (100 - p.y));
    const dd = Math.hypot(ddx, ddy) || 1;
    const px = ownX(p, t), py = ownY(p, t);
    // Drive forward, veer away from the nearest defender, stay off the touchline.
    let vx = dir * 10 - (ddx / dd) * (dd < 6 ? 5 : 1.5);
    let vy = -(ddy / dd) * (dd < 6 ? 6 : 1);
    if (py < 14) vy += 4; else if (py > 86) vy -= 4;
    if (px > 78) { vx = dir * 8; vy += (50 - py) * 0.25; } // head for goal
    if (ctx.counter) { vx = dir * 12; wantSprint = true; }
    return { x: clamp(px + vx, 4, 97), y: clamp(py + vy, 3, 97), wantSprint };
  }

  // Base shift by phase ------------------------------------------------------
  const grp = POS_GROUP[p.role];
  const kShift = grp === 'DEF' ? 0.3 : grp === 'MID' ? 0.45 : 0.55;
  const push = ctx.attacking ? 5 + (tac.mentality - 3) * 4 + (ctx.counter ? 6 : 0) : -3 + (tac.pressing - 3) * 2;
  let ox = p.bx + (bpx - 50) * kShift + push - 4;
  let oy = p.by + (bpy - p.by) * 0.16;

  // Role intelligence ----------------------------------------------------------
  const px = ownX(p, t), py = ownY(p, t);
  switch (p.role) {
    case 'ST': {
      if (ctx.attacking) {
        // Hold a high outlet line during build-up so the team always has a forward option.
        ox = Math.max(ox, p.bx - 10);
        // Make forward runs once the ball reaches midfield (don't wait until the ball
        // is already deep — strikers must be ahead of play). Runs are NOT capped by
        // the offside line: capping them there deadlocks both teams at midfield.
        const run = bpx > 42 || sim.minute < p.runUntil;
        ox = run ? Math.min(ox + 14, 84) : ox + 4;
        if (sim.minute < p.runUntil) { ox = Math.min(ox + 6, 96); wantSprint = true; }
        // Split wide / central by anchor side.
        oy = p.by < 50 ? Math.min(oy, 42) : Math.max(oy, 58);
      } else {
        ox = Math.min(ox, ctx.line - 3); // stay onside-ish, ready to press
      }
      break;
    }
    case 'LW': case 'RW': {
      // Hold width, attack space behind full-backs.
      const side = p.by < 50 ? 1 : -1;
      oy = ctx.attacking ? (side === 1 ? Math.min(oy, 18) : Math.max(oy, 82)) : p.by + (bpy - p.by) * 0.1;
      if (ctx.attacking && bpx > 60) { ox = Math.min(ox + 8, 84); wantSprint = bpx > 70; }
      break;
    }
    case 'LM': case 'RM': {
      // Wide midfielders act as wingers in attack: stay wide, push high.
      const wide = p.by < 50 ? 12 : 88;
      oy = oy * 0.5 + wide * 0.5;
      if (ctx.attacking) {
        ox += bpx > 55 ? 8 : 4;
        if (bpx > 70) wantSprint = true;
      }
      break;
    }
    case 'CAM': {
      // Find pockets between the lines, drifting to the half-space away from the carrier.
      if (ctx.attacking && ctx.carrierPos) {
        ox += 6;
        const away = ctx.carrierPos.y > 50 ? -9 : 9;
        oy = clamp(oy * 0.6 + (oy + away) * 0.4, 30, 70);
      }
      break;
    }
    case 'CM': {
      // Support possession: offer a passing lane at 10-18 units from the carrier.
      if (ctx.attacking && ctx.carrierPos) {
        const dx = px - ctx.carrierPos.x, dy = py - ctx.carrierPos.y;
        const d = Math.hypot(dx, dy) || 1;
        const want = 14;
        ox = ox * 0.55 + (ctx.carrierPos.x + (dx / d) * want) * 0.45;
        oy = oy * 0.55 + (ctx.carrierPos.y + (dy / d) * want) * 0.45;
      } else {
        ox = Math.min(ox, bpx - 6); // goal-side recovery
      }
      break;
    }
    case 'CDM': {
      // Shield the defence: stay between ball and goal.
      ox = Math.min(ox, bpx - 10);
      oy = oy * 0.6 + bpy * 0.4;
      if (!ctx.attacking && bpx > 55) { ox = clamp(bpx - 12, 15, 45); wantSprint = bpx > 70; }
      break;
    }
    case 'CB': {
      ox = clamp(ox, 8, 52);
      // Track the nearest attacker when the ball is close.
      if (!ctx.attacking && bpx > 40) {
        const O = (1 - t) as 0 | 1;
        const ai = nearestTo(sim.teams[O], p.x, p.y);
        const a = sim.teams[O].onPitch[ai];
        if (a && Math.hypot(a.x - p.x, a.y - p.y) < 16) {
          const ax = t === 0 ? a.x : 100 - a.x, ay = t === 0 ? a.y : 100 - a.y;
          ox = ox * 0.45 + (ax - 3) * 0.55;
          oy = oy * 0.45 + ay * 0.55;
          p.marking = ai;
        } else p.marking = -1;
      } else p.marking = -1;
      break;
    }
    case 'LB': case 'RB': {
      if (ctx.attacking) {
        // Overlap: push up the flank.
        ox += 8;
        oy = p.by < 50 ? Math.min(oy, 20) : Math.max(oy, 80);
        if (tac.mentality >= 4) wantSprint = bpx > 55;
      } else {
        ox = Math.min(ox, bpx - 4);
      }
      break;
    }
    default:
      break;
  }

  // Pressing: designated pressers hunt the ball; others stay compact.
  if (!ctx.hasBall && sim.ball.state === 'owned') {
    const rank = team.pressers.indexOf(i);
    if (rank === 0) {
      return { x: bpx, y: bpy, wantSprint: true };
    } else if (rank === 1) {
      // Second man contains: between ball and goal.
      return { x: (bpx + px) / 2 - 4, y: (bpy + py) / 2, wantSprint: false };
    }
  }

  // Idle sway so the pitch feels alive.
  ox += Math.sin(time * 1.3 + p.phase) * 1.2;
  oy += Math.cos(time * 1.1 + p.phase * 2) * 1.4;
  return { x: clamp(ox, 4, 96), y: clamp(oy, 3, 97), wantSprint };
}

/** Pick 1-2 pressers per defending team based on pressing intensity. */
function updatePressers(sim: MatchSim, t: 0 | 1) {
  const team = sim.teams[t];
  team.pressers = [];
  if (sim.ball.state !== 'owned' || sim.possession === t) return;
  const n = team.tactics.pressing >= 5 ? 2 : team.tactics.pressing >= 3 ? 1 : (sim.minute * 7 + t) % 2 < 1 ? 1 : 0;
  if (n === 0) return;
  const order = team.onPitch.map((p, i) => ({ i, d: Math.hypot(p.x - sim.ball.x, p.y - sim.ball.y) }))
    .filter(({ i }) => i > 0)
    .sort((a, b) => a.d - b.d);
  for (let k = 0; k < Math.min(n, order.length); k++) team.pressers.push(order[k].i);
}

/** Movement update with acceleration, deceleration, rotation and separation. */
export function updatePositions(sim: MatchSim, dt: number) {
  const time = sim.minute;
  updatePressers(sim, 0);
  updatePressers(sim, 1);
  // Substep for stability at high game speeds.
  const n = Math.max(1, Math.ceil(dt / 0.05));
  const h = dt / n;
  for (let s = 0; s < n; s++) moveSubstep(sim, h, time);
}

const _sepX = new Float32Array(22);
const _sepY = new Float32Array(22);

function moveSubstep(sim: MatchSim, dt: number, time: number) {
  // Gather all players for separation (fixed 22).
  const all: SimPlayer[] = [];
  sim.teams.forEach((t) => t.onPitch.forEach((p) => all.push(p)));
  for (let k = 0; k < all.length; k++) { _sepX[k] = 0; _sepY[k] = 0; }
  for (let a = 0; a < all.length; a++) {
    for (let b = a + 1; b < all.length; b++) {
      const dx = all[a].x - all[b].x, dy = all[a].y - all[b].y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 9 && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const f = ((3 - d) / 3) * 14;
        const ux = dx / d, uy = dy / d;
        _sepX[a] += ux * f; _sepY[a] += uy * f;
        _sepX[b] -= ux * f; _sepY[b] -= uy * f;
      }
    }
  }

  sim.teams.forEach((team, tIdx) => {
    const t = tIdx as 0 | 1;
    const ctx = teamContext(sim, t);
    team.onPitch.forEach((p, i) => {
      const gi = tIdx * 11 + i;
      const tgt = roleTarget(sim, t, i, ctx, time);
      const tx = t === 0 ? tgt.x : 100 - tgt.x;
      const ty = t === 0 ? tgt.y : 100 - tgt.y;
      p.tgtX = tx; p.tgtY = ty;

      let maxSp = paceSpeed(p) * (tgt.wantSprint ? 1 : 0.72);
      if (sim.celebration && sim.celebration.team !== t) maxSp *= 0.45; // conceding players walk back
      const dx = tx - p.x, dy = ty - p.y;
      const dist = Math.hypot(dx, dy);
      // Arrive behaviour: full speed far away, ease off near the target.
      const want = Math.min(maxSp, dist * 6 + 0.6);
      const ux = dist > 0.001 ? dx / dist : 0;
      const uy = dist > 0.001 ? dy / dist : 0;
      let dvx = ux * want + _sepX[gi];
      let dvy = uy * want + _sepY[gi];
      // Carrier with the ball can't sprint at full pace.
      if (p.hasBall) { dvx *= 0.8; dvy *= 0.8; }
      const accel = 42 + p.attrs.pace * 0.55;
      const step = accel * dt;
      const ddvx = dvx - p.vx, ddvy = dvy - p.vy;
      const dl = Math.hypot(ddvx, ddvy);
      if (dl <= step || dl < 0.001) { p.vx = dvx; p.vy = dvy; }
      else { p.vx += (ddvx / dl) * step; p.vy += (ddvy / dl) * step; }
      p.x = clamp(p.x + p.vx * dt, 1, 99);
      p.y = clamp(p.y + p.vy * dt, 1, 99);
      p.speed = Math.hypot(p.vx, p.vy);
      p.move = p.speed > 12.5 ? 'sprint' : p.speed > 1.8 ? (dist < 3 ? 'jockey' : 'move') : 'hold';

      // Facing (clear intent): pinned during kicks/receptions; movement direction when running;
      // carrier holding the ball faces the attack; teammates face the carrier; defenders face the ball.
      const attackDir = t === 0 ? 0 : Math.PI;
      if (sim.minute < p.faceLock) {
        p.targetFacing = p.faceLockAngle;
      } else if (sim.celebration && sim.celebration.team === t && i !== 0) {
        const sc = team.onPitch[sim.celebration.scorer];
        p.targetFacing = i === sim.celebration.scorer ? (p.speed > 1.6 ? Math.atan2(p.vy, p.vx) : attackDir) : Math.atan2(sc.y - p.y, sc.x - p.x);
      } else if (p.speed > 2.2) {
        p.targetFacing = Math.atan2(p.vy, p.vx);
      } else if (p.hasBall) {
        p.targetFacing = attackDir;
      } else {
        p.targetFacing = Math.atan2(sim.ball.y - p.y, sim.ball.x - p.x);
      }
      if (i === 0 && sim.ball.state === 'flight') {
        p.targetFacing = Math.atan2(sim.ball.y - p.y, sim.ball.x - p.x);
      }
      const before = p.facing;
      p.facing = lerpAngle(p.facing, p.targetFacing, dt * 9);
      const turning = Math.abs(angDiff(before, p.facing)) > 0.02 && p.speed > 2;

      p.anim.t += dt;
      deriveLocomotion(p.anim, sim.minute, p.speed, p.hasBall, turning, p.injured, sim.minute < p.celebrateUntil);
    });
  });
}

export function buildResult(sim: MatchSim): MatchResult {
  const u = sim.teams[0];
  const all = [...u.onPitch, ...u.subbedOff];
  const everyone = [...all, ...sim.teams[1].onPitch, ...sim.teams[1].subbedOff];
  const motm = everyone.reduce((a, b) => (b.rating > a.rating ? b : a));
  const scorers: string[] = [];
  sim.teams.forEach((t) => [...t.onPitch, ...t.subbedOff].forEach((p) => { if (p.goals) scorers.push(`${p.name}${p.goals > 1 ? ` (${p.goals})` : ''} - ${t.short}`); }));
  return {
    opponentId: sim.opponentId, homeIsUser: sim.homeIsUser, userGoals: sim.score[0], oppGoals: sim.score[1],
    players: all.map((p) => ({ id: p.id, rating: p.rating, goals: p.goals, assists: p.assists, fitness: Math.round(p.fitness), injured: p.injured })),
    motm: `${motm.name} (${sim.teams[0].onPitch.includes(motm) || sim.teams[0].subbedOff.includes(motm) ? u.short : sim.teams[1].short})`,
    scorers,
  };
}
