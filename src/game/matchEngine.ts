import type { Attributes, GameState, LeagueClub, Player, Pos, Tactics } from './types';
import { FORMATIONS, autoPick } from './formations';
import { POS_GROUP, clamp, genSquad, ovrOf, pick, rand, slotRating } from './players';
import { FORMATION_LIST } from './formations';

export interface SimPlayer {
  id: string; name: string; num: number; role: Pos; natPos: Pos; ovr: number; eff: number;
  attrs: Attributes; fitness: number; rating: number; goals: number; assists: number;
  x: number; y: number; bx: number; by: number;
  yellow: number; injured: boolean; form: number[]; potential: number; age: number;
  phase: number; shots: number; saves: number;
}

export interface SimTeam {
  isUser: boolean; clubId: string; name: string; short: string;
  kit: string; kitText: string;
  onPitch: SimPlayer[]; bench: SimPlayer[]; subbedOff: SimPlayer[]; subsUsed: number;
  tactics: Tactics; familiarity: number;
}

export type EventType = 'goal' | 'save' | 'miss' | 'sub' | 'card' | 'injury' | 'info' | 'tactic' | 'whistle' | 'chance';
export interface MatchEvent { id: number; minute: number; type: EventType; team?: 0 | 1; text: string }

export interface MatchSim {
  teams: [SimTeam, SimTeam];
  minute: number; stoppage: number; halfDone: boolean; finished: boolean; pauseRequest: boolean;
  score: [number, number];
  possession: 0 | 1; carrier: number; lastPasser: number | null;
  ball: { x: number; y: number; fx: number; fy: number; tx: number; ty: number; t: number; dur: number };
  nextAction: number;
  kickoffFor: 0 | 1 | null;
  events: MatchEvent[];
  stats: { shots: [number, number]; onTarget: [number, number]; poss: [number, number]; passes: [number, number]; fouls: [number, number] };
  homeIsUser: boolean;
  opponentId: string;
  evId: number;
  lastAiCheck: number;
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
  };
}

const lastName = (n: string) => n.split(' ').slice(-1)[0];

export function createSim(state: GameState, opp: LeagueClub, homeIsUser: boolean): MatchSim {
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
  const oppSquad = genSquad(opp.rating);
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
        onPitch: userOn, bench: userBench, subbedOff: [], subsUsed: 0, tactics: { ...state.tactics }, familiarity: state.familiarity },
      { isUser: false, clubId: opp.id, name: opp.name, short: opp.short, kit: oppKit, kitText: textOn(oppKit),
        onPitch: oppOn, bench: oppBench, subbedOff: [], subsUsed: 0,
        tactics: { formation: oppFormation, mentality: oppMent, tempo: pick([2, 3, 3, 4]), pressing: pick([2, 3, 3, 4]) }, familiarity: 60 },
    ],
    minute: 0, stoppage: Math.floor(rand(1, 5)), halfDone: false, finished: false, pauseRequest: false,
    score: [0, 0], possession: homeIsUser ? 0 : 1, carrier: 10, lastPasser: null,
    ball: { x: 50, y: 50, fx: 50, fy: 50, tx: 50, ty: 50, t: 1, dur: 1 },
    nextAction: 0.4, kickoffFor: null, events: [],
    stats: { shots: [0, 0], onTarget: [0, 0], poss: [0, 0], passes: [0, 0], fouls: [0, 0] },
    homeIsUser, opponentId: opp.id, evId: 0, lastAiCheck: 55,
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

function moveBall(sim: MatchSim, tx: number, ty: number, dur: number) {
  sim.ball.fx = sim.ball.x; sim.ball.fy = sim.ball.y; sim.ball.tx = tx; sim.ball.ty = ty; sim.ball.t = 0; sim.ball.dur = Math.max(0.15, dur);
}
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

// ---------- core action ----------
function doAction(sim: MatchSim) {
  const T = sim.possession, O = (1 - T) as 0 | 1;
  const team = sim.teams[T], opp = sim.teams[O];
  const tac = team.tactics, otac = opp.tactics;
  const interval = clamp(0.55 - (tac.tempo - 3) * 0.06 + rand(-0.1, 0.12), 0.3, 0.8);
  sim.nextAction = sim.minute + interval;

  if (sim.kickoffFor !== null) {
    sim.possession = sim.kickoffFor;
    const kt = sim.teams[sim.kickoffFor];
    sim.carrier = kt.onPitch.length - 1;
    sim.ball.x = sim.ball.fx = sim.ball.tx = 50; sim.ball.y = sim.ball.fy = sim.ball.ty = 50; sim.ball.t = 1;
    sim.kickoffFor = null; sim.lastPasser = null;
    sim.nextAction = sim.minute + 0.6;
    return;
  }

  const c = team.onPitch[sim.carrier];
  const pr = prog(sim, T);
  sim.stats.poss[T]++;
  const atk = teamAvg(team, (p) => (POS_GROUP[p.role] === 'ATT' || POS_GROUP[p.role] === 'MID' ? power(p) : power(p) * 0.6));
  const def = teamAvg(opp, (p) => (POS_GROUP[p.role] === 'DEF' || p.role === 'CDM' ? power(p) : power(p) * 0.7));

  // shot
  if (pr > 64 && sim.carrier !== 0) {
    const shotChance = 0.24 + (pr - 64) / 70 + (tac.mentality - 3) * 0.035 + (atk - def) / 200 - (otac.mentality < 3 ? 0.03 : 0);
    if (Math.random() < shotChance) return shoot(sim, T, pr);
  } else if (pr > 55 && sim.carrier !== 0 && Math.random() < 0.05 + (tac.mentality - 3) * 0.01) {
    return shoot(sim, T, pr);
  }

  // foul
  if (Math.random() < 0.018 + (otac.pressing - 3) * 0.005) {
    const fi = nearestTo(opp, c.x, c.y);
    const f = opp.onPitch[fi];
    sim.stats.fouls[O]++;
    if (Math.random() < 0.28) {
      f.yellow++;
      adj(f, -0.3);
      addEv(sim, 'card', `🟨 Kartu kuning untuk ${f.name} (${opp.short}) setelah menjatuhkan ${lastName(c.name)}.`, O);
    }
    sim.nextAction = sim.minute + 0.5;
    return;
  }

  // dribble
  if (sim.carrier !== 0 && Math.random() < 0.12 + (c.attrs.dribbling - 70) / 300) {
    const di = nearestTo(opp, c.x, c.y);
    const d = opp.onPitch[di];
    const win = 0.55 + (c.attrs.dribbling * fitFactor(c) - d.attrs.defending * fitFactor(d)) / 120;
    const dir = T === 0 ? 1 : -1;
    if (Math.random() < win) {
      moveBall(sim, clamp(sim.ball.x + dir * rand(6, 12), 2, 98), clamp(sim.ball.y + rand(-8, 8), 4, 96), interval);
      adj(c, 0.05);
    } else {
      sim.possession = O; sim.carrier = di; sim.lastPasser = null;
      moveBall(sim, d.x, d.y, interval * 0.6);
      adj(c, -0.06); adj(d, 0.08);
    }
    return;
  }

  // pass
  const cProg = ownX(c, T);
  const weights = team.onPitch.map((p, i) => {
    if (i === sim.carrier) return 0;
    if (i === 0 && cProg > 30) return 0;
    const forward = ownX(p, T) - cProg;
    const dist = Math.hypot(p.x - c.x, p.y - c.y);
    let w = Math.max(0.15, 1 + (forward / 25) * (0.6 + 0.2 * (tac.mentality - 3) + 0.15 * (tac.tempo - 3)));
    if (dist > 40) w *= 0.25;
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
    0.83 + (c.attrs.passing * fitFactor(c) - 70) / 250 + (teamPass - def) / 320 - (otac.pressing - 3) * 0.025 - (tac.tempo - 3) * 0.012 - Math.max(0, forward) / 450 + team.familiarity / 2500,
    0.55, 0.95);
  if (Math.random() < success) {
    sim.stats.passes[T]++;
    sim.lastPasser = sim.carrier;
    sim.carrier = ri;
    moveBall(sim, recv.x + (T === 0 ? 2 : -2), recv.y, interval * 0.9);
    adj(c, forward > 8 ? 0.025 : 0.012);
  } else {
    const mx = (c.x + recv.x) / 2, my = (c.y + recv.y) / 2;
    const ii = nearestTo(opp, mx, my, false);
    const it = opp.onPitch[ii];
    sim.possession = O; sim.carrier = ii; sim.lastPasser = null;
    moveBall(sim, it.x, it.y, interval * 0.8);
    adj(c, -0.05); adj(it, 0.07);
  }
}

function shoot(sim: MatchSim, T: 0 | 1, pr: number) {
  const O = (1 - T) as 0 | 1;
  const team = sim.teams[T], opp = sim.teams[O];
  const c = team.onPitch[sim.carrier];
  const gk = opp.onPitch[0];
  const q = clamp((pr - 62) / 36, 0, 1);
  const xg = clamp(0.04 + q * 0.24 + (c.attrs.shooting * fitFactor(c) - gk.attrs.goalkeeping * fitFactor(gk)) / 320 + (team.tactics.mentality - 3) * 0.008, 0.02, 0.42);
  sim.stats.shots[T]++;
  c.shots++;
  const goalX = T === 0 ? 100.6 : -0.6;
  const r = Math.random();
  const t = sim.teams[T].short;
  if (r < xg) {
    sim.score[T]++;
    sim.stats.onTarget[T]++;
    moveBall(sim, goalX, rand(46, 54), 0.35);
    adj(c, 1.0);
    let assistTxt = '';
    if (sim.lastPasser !== null && sim.lastPasser !== sim.carrier) {
      const a = team.onPitch[sim.lastPasser];
      a.assists++; adj(a, 0.6);
      assistTxt = ` Assist dari ${lastName(a.name)}.`;
    }
    c.goals++;
    adj(gk, -0.35);
    opp.onPitch.forEach((p) => POS_GROUP[p.role] === 'DEF' && adj(p, -0.12));
    const lines = [
      `⚽ GOOOL! ${c.name} menaklukkan kiper dengan tembakan keras!`,
      `⚽ GOL! Penyelesaian dingin dari ${c.name} untuk ${team.name}!`,
      `⚽ GOOOL! ${c.name} menyambar bola dan menjebol gawang ${opp.short}!`,
      `⚽ GOL INDAH! ${c.name} melengkungkan bola ke pojok atas!`,
    ];
    addEv(sim, 'goal', `${pick(lines)}${assistTxt} Skor ${sim.homeIsUser ? sim.score[0] : sim.score[1]}-${sim.homeIsUser ? sim.score[1] : sim.score[0]}.`, T);
    sim.kickoffFor = O;
    sim.nextAction = sim.minute + 1.4;
    return;
  }
  if (r < xg + 0.32) {
    sim.stats.onTarget[T]++;
    gk.saves++;
    adj(gk, 0.3); adj(c, 0.1);
    moveBall(sim, gk.x, gk.y, 0.3);
    addEv(sim, 'save', pick([
      `🧤 Peluang! Tembakan ${lastName(c.name)} (${t}) ditepis ${gk.name}.`,
      `🧤 Penyelamatan gemilang ${gk.name} menggagalkan ${lastName(c.name)}!`,
      `🧤 ${lastName(c.name)} mencoba dari jarak dekat, tapi ${lastName(gk.name)} sigap menangkap bola.`,
    ]), T);
  } else if (r < xg + 0.5) {
    const di = nearestTo(opp, c.x, c.y);
    adj(opp.onPitch[di], 0.12);
    moveBall(sim, opp.onPitch[di].x, opp.onPitch[di].y, 0.25);
    if (Math.random() < 0.4) addEv(sim, 'chance', `🛡️ Tembakan ${lastName(c.name)} diblok ${lastName(opp.onPitch[di].name)}.`, T);
    sim.possession = O; sim.carrier = di; sim.lastPasser = null;
    sim.nextAction = sim.minute + 0.5;
    return;
  } else {
    adj(c, -0.06);
    moveBall(sim, goalX, rand(30, 70) < 50 ? rand(32, 42) : rand(58, 68), 0.35);
    addEv(sim, 'miss', pick([
      `💨 ${c.name} melepaskan tembakan, tapi melebar dari gawang.`,
      `💨 Sepakan ${lastName(c.name)} melambung di atas mistar.`,
      `💨 Nyaris! Tembakan ${lastName(c.name)} hanya menyamping tipis.`,
    ]), T);
  }
  sim.possession = O; sim.carrier = 0; sim.lastPasser = null;
  sim.nextAction = sim.minute + 0.9;
}

// ---------- AI ----------
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
  inn.role = out.role; inn.bx = out.bx; inn.by = out.by;
  inn.x = out.x; inn.y = ti === 0 ? 0 : 100;
  inn.eff = inn.natPos === inn.role ? inn.ovr : POS_GROUP[inn.natPos] === POS_GROUP[inn.role] ? inn.ovr - 3 : inn.role === 'GK' || inn.natPos === 'GK' ? inn.ovr - 35 : inn.ovr - 12;
  t.onPitch[outIdx] = inn;
  t.bench.splice(bi, 1);
  t.subbedOff.push(out);
  t.subsUsed++;
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

  // ball tween
  const b = sim.ball;
  if (b.t < b.dur) {
    b.t = Math.min(b.dur, b.t + dtGame);
    const k = b.t / b.dur;
    const e = 1 - (1 - k) * (1 - k);
    b.x = b.fx + (b.tx - b.fx) * e;
    b.y = b.fy + (b.ty - b.fy) * e;
  }

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
  if (sim.minute >= sim.lastAiCheck + 6) { sim.lastAiCheck = sim.minute; aiManage(sim); }
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

/** Movement update — called every frame with real seconds * speed */
export function updatePositions(sim: MatchSim, dt: number) {
  const time = sim.minute;
  sim.teams.forEach((team, tIdx) => {
    const t = tIdx as 0 | 1;
    const hasBall = sim.possession === t;
    const bp = prog(sim, t);
    const bY = t === 0 ? sim.ball.y : 100 - sim.ball.y;
    const presser = !hasBall ? nearestTo(team, sim.ball.x, sim.ball.y) : -1;
    const kickoffPause = sim.kickoffFor !== null || (sim.halfDone && sim.minute <= 45.4);
    team.onPitch.forEach((p, i) => {
      let ox: number, oy: number;
      if (i === 0) {
        ox = clamp(4 + (bp - 50) * 0.07, 2, 15);
        oy = 50 + (bY - 50) * 0.3;
      } else if (kickoffPause) {
        ox = Math.min(p.bx * 0.5 + 2, 48); oy = p.by;
      } else {
        const push = hasBall ? 5 + (team.tactics.mentality - 3) * 4 : -3 + (team.tactics.pressing - 3) * 3;
        ox = p.bx + (bp - 50) * 0.42 + push - 8;
        oy = p.by + (bY - p.by) * 0.18;
        ox += Math.sin(time * 1.3 + p.phase) * 1.6;
        oy += Math.cos(time * 1.1 + p.phase * 2) * 2;
        ox = clamp(ox, 6, 95); oy = clamp(oy, 3, 97);
      }
      let tx = t === 0 ? ox : 100 - ox;
      let ty = t === 0 ? oy : 100 - oy;
      if (!kickoffPause) {
        if (hasBall && i === sim.carrier) { tx = sim.ball.tx; ty = sim.ball.ty; }
        if (i === presser) { tx = sim.ball.x + (t === 0 ? -1.5 : 1.5); ty = sim.ball.y; }
      }
      const spd = 2.4 * (0.6 + p.attrs.pace / 250) * (p.injured ? 0.6 : 1);
      const k = Math.min(1, dt * spd);
      p.x += (tx - p.x) * k;
      p.y += (ty - p.y) * k;
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
