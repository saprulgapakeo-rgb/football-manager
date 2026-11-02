import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AttrKey, GameState, MarketPlayer, Player } from './types';
import { newGame, SAVE_VERSION } from './initial';
import { addNews, genMarket, makeFixtures, makeTable, quickSim, recordResult, sortTable, totalRounds } from './league';
import { ageXpFactor, applyXp, clamp, ovrOf, playerValue, randi, rand, fmtMoney } from './players';
import { autoPick } from './formations';
import type { MatchResult, MatchSim } from './matchEngine';
import { luminance, textOn } from './matchEngine';
import { LEAGUE_NAME } from './data';

export type Page = 'squad' | 'match' | 'club' | 'account';

export const ACC_KEY = 'fmco:accounts';
export const SESSION_KEY = 'fmco:session';
export const autoKey = (a: string) => `fmco:auto:${a}`;
export const slotKey = (a: string, n: number) => `fmco:slot:${a}:${n}`;

export interface SlotInfo { n: number; savedAt: number; label: string }

export type TrainingFocus = 'physical' | 'technique' | 'finishing' | 'tactical' | 'recovery';
export const TRAINING: Record<TrainingFocus, { label: string; desc: string; icon: string; fitness: number; attrs: AttrKey[]; xp: [number, number] }> = {
  physical: { label: 'Fisik / Stamina', desc: 'Tingkatkan kecepatan & fisik. Menguras fitness cukup besar.', icon: '🏋️', fitness: -9, attrs: ['physical', 'pace'], xp: [10, 18] },
  technique: { label: 'Teknik / Passing', desc: 'Asah passing & dribbling seluruh skuad.', icon: '🎯', fitness: -5, attrs: ['passing', 'dribbling'], xp: [9, 16] },
  finishing: { label: 'Finishing', desc: 'Latihan penyelesaian akhir, efektif untuk penyerang.', icon: '🥅', fitness: -5, attrs: ['shooting'], xp: [8, 15] },
  tactical: { label: 'Taktikal', desc: 'Naikkan pemahaman taktik (bonus passing di laga).', icon: '🧠', fitness: -3, attrs: ['defending', 'passing'], xp: [4, 8] },
  recovery: { label: 'Pemulihan Cedera', desc: 'Pulihkan fitness & percepat penyembuhan cedera.', icon: '🩹', fitness: 18, attrs: [], xp: [0, 0] },
};

export const upgradeCost = (p: Player) => Math.round(120 + Math.max(0, ovrOf(p) - 55) * 6);

interface Toast { id: number; text: string; kind: 'ok' | 'err' | 'info' }

interface Ctx {
  state: GameState;
  mutate: (fn: (s: GameState) => void) => void;
  replaceState: (s: GameState) => void;
  page: Page;
  setPage: (p: Page) => void;
  accent: string;
  accentText: string;
  logout: () => void;
  toast: (t: string, kind?: Toast['kind']) => void;
  saveSlot: (n: number) => void;
  loadSlot: (n: number) => void;
  deleteSlot: (n: number) => void;
  slots: (SlotInfo | null)[];
  lastAutosave: number;
  runTraining: (f: TrainingFocus) => { name: string; gained: number }[] | null;
  upgradePlayer: (id: string, focus: AttrKey) => { gained: number } | null;
  applyMatch: (r: MatchResult) => void;
  completeTransfer: (mp: MarketPlayer, fee: number, wage: number, years: number) => void;
  rejectTransfer: (id: string, by: 'club' | 'player') => void;
  sellPlayer: (id: string) => void;
  matchRef: React.MutableRefObject<MatchSim | null>;
  coinTick: number;
}

const GameCtx = createContext<Ctx | null>(null);
export const useGame = () => useContext(GameCtx)!;

export function loadAuto(account: string): GameState | null {
  try {
    const raw = localStorage.getItem(autoKey(account));
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    if (s.version !== SAVE_VERSION) return null;
    return s;
  } catch { return null; }
}

function readSlots(account: string): (SlotInfo | null)[] {
  return [1, 2, 3].map((n) => {
    try {
      const raw = localStorage.getItem(slotKey(account, n));
      if (!raw) return null;
      const d = JSON.parse(raw);
      return { n, savedAt: d.savedAt, label: d.label };
    } catch { return null; }
  });
}

export function GameProvider({ account, children, onLogout }: { account: string; children: ReactNode; onLogout: () => void }) {
  const [state, setState] = useState<GameState>(() => loadAuto(account) ?? newGame(account));
  const [page, setPage] = useState<Page>('squad');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [slots, setSlots] = useState(() => readSlots(account));
  const [lastAutosave, setLastAutosave] = useState(0);
  const [coinTick, setCoinTick] = useState(30);
  const matchRef = useRef<MatchSim | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const toast = useCallback((text: string, kind: Toast['kind'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const mutate = useCallback((fn: (s: GameState) => void) => {
    const next = structuredClone(stateRef.current);
    fn(next);
    stateRef.current = next;
    setState(next);
  }, []);
  const replaceState = useCallback((s: GameState) => { stateRef.current = s; setState(s); }, []);

  // autosave
  useEffect(() => {
    const h = setTimeout(() => {
      try {
        localStorage.setItem(autoKey(account), JSON.stringify(state));
        setLastAutosave(Date.now());
      } catch { /* quota */ }
    }, 600);
    return () => clearTimeout(h);
  }, [state, account]);

  // daily bonus
  useEffect(() => {
    const today = new Date().toDateString();
    if (state.lastLoginDay !== today) {
      mutate((s) => {
        s.lastLoginDay = today;
        s.coins += 100;
        addNews(s, 'club', 'Bonus login harian', 'Manajemen memberi apresiasi kehadiranmu: +100 Coin.');
      });
      toast('Bonus login harian +100 Coin 🎁');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // passive coin income: +1 coin every 30s (≈ 2/menit)
  useEffect(() => {
    let t = 30;
    const h = setInterval(() => {
      t--;
      if (t <= 0) { t = 30; mutate((s) => { s.coins += 1; }); }
      setCoinTick(t);
    }, 1000);
    return () => clearInterval(h);
  }, [mutate]);

  const accent = useMemo(() => {
    const { primary, secondary } = state.club;
    if (luminance(primary) > 0.08 && luminance(primary) < 0.92) return primary;
    if (luminance(secondary) > 0.08 && luminance(secondary) < 0.92) return secondary;
    return luminance(primary) >= 0.92 ? '#e2e8f0' : '#10b981';
  }, [state.club]);

  const saveSlot = (n: number) => {
    const s = stateRef.current;
    const label = `${s.club.name} • Musim ${s.season} • Pekan ${s.week + 1}`;
    localStorage.setItem(slotKey(account, n), JSON.stringify({ savedAt: Date.now(), label, state: s }));
    setSlots(readSlots(account));
    toast(`Game tersimpan di Slot ${n}`);
  };
  const loadSlot = (n: number) => {
    const raw = localStorage.getItem(slotKey(account, n));
    if (!raw) return;
    const d = JSON.parse(raw);
    matchRef.current = null;
    replaceState(d.state);
    toast(`Slot ${n} dimuat`, 'info');
  };
  const deleteSlot = (n: number) => {
    localStorage.removeItem(slotKey(account, n));
    setSlots(readSlots(account));
    toast(`Slot ${n} dihapus`, 'info');
  };

  const runTraining = (f: TrainingFocus) => {
    const s0 = stateRef.current;
    if (s0.trainingLeft <= 0) { toast('Jatah sesi latihan pekan ini habis. Mainkan laga berikutnya.', 'err'); return null; }
    const cfg = TRAINING[f];
    const report: { name: string; gained: number }[] = [];
    mutate((s) => {
      s.trainingLeft--;
      for (const p of s.squad) {
        if (f === 'recovery') {
          p.fitness = clamp(p.fitness + cfg.fitness + randi(-2, 4), 0, 100);
          if (p.injuredWeeks > 0) p.injuredWeeks = Math.max(0, p.injuredWeeks - 1);
          continue;
        }
        if (p.injuredWeeks > 0) continue;
        p.fitness = clamp(p.fitness + cfg.fitness + randi(-2, 2), 15, 100);
        let xp = randi(cfg.xp[0], cfg.xp[1]) * ageXpFactor(p.age);
        if (f === 'finishing' && ['ST', 'LW', 'RW', 'CAM'].includes(p.pos)) xp *= 1.5;
        if (f === 'physical' && p.pos !== 'GK') xp *= 1.1;
        if (p.fitness < 40) xp *= 0.5;
        const g = applyXp(p, Math.round(xp), cfg.attrs);
        if (g > 0) report.push({ name: p.name, gained: g });
      }
      if (f === 'tactical') s.familiarity = clamp(s.familiarity + 12, 0, 100);
      addNews(s, 'training', `Sesi latihan: ${cfg.label}`, report.length ? `${report.length} pemain mengalami peningkatan OVR: ${report.map((r) => r.name).join(', ')}.` : `Skuad menyelesaikan sesi ${cfg.label.toLowerCase()} dengan baik.`);
    });
    return report;
  };

  const upgradePlayer = (id: string, focus: AttrKey) => {
    const s0 = stateRef.current;
    const p0 = s0.squad.find((p) => p.id === id);
    if (!p0) return null;
    const cost = upgradeCost(p0);
    if (s0.coins < cost) { toast('Coin tidak cukup', 'err'); return null; }
    if (ovrOf(p0) >= p0.potential) { toast('Pemain sudah mencapai potensi maksimal', 'err'); return null; }
    if (p0.fitness < 35) { toast('Pemain terlalu lelah untuk sesi khusus', 'err'); return null; }
    if (p0.injuredWeeks > 0) { toast('Pemain sedang cedera', 'err'); return null; }
    // compute deterministically on a clone so we can report
    const clone = structuredClone(p0);
    const xp = Math.round(randi(30, 45) * ageXpFactor(clone.age));
    const gained = applyXp(clone, xp, [focus]);
    clone.fitness = Math.max(0, clone.fitness - 10);
    mutate((s) => {
      s.coins -= cost;
      const i = s.squad.findIndex((p) => p.id === id);
      s.squad[i] = clone;
      if (gained) addNews(s, 'training', `${clone.name} naik level!`, `Sesi latihan khusus membuahkan hasil, OVR ${clone.name} kini ${ovrOf(clone)}.`);
    });
    return { gained };
  };

  const applyMatch = (r: MatchResult) => {
    mutate((s) => {
      const round = s.week;
      const fx = s.fixtures.find((f) => f.round === round && (f.home === 'user' || f.away === 'user'))!;
      const hg = r.homeIsUser ? r.userGoals : r.oppGoals;
      const ag = r.homeIsUser ? r.oppGoals : r.userGoals;
      fx.hg = hg; fx.ag = ag;
      recordResult(s.table, fx.home, fx.away, hg, ag);
      // user rating update
      const top = [...s.squad].map(ovrOf).sort((a, b) => b - a).slice(0, 11);
      const userClub = s.league.find((c) => c.isUser)!;
      userClub.rating = Math.round(top.reduce((a, b) => a + b, 0) / 11);
      userClub.name = s.club.name; userClub.short = s.club.short; userClub.primary = s.club.primary; userClub.secondary = s.club.secondary;
      for (const f of s.fixtures.filter((f) => f.round === round && f !== fx)) {
        const h = s.league.find((c) => c.id === f.home)!, a = s.league.find((c) => c.id === f.away)!;
        const [x, y] = quickSim(h.rating, a.rating);
        f.hg = x; f.ag = y;
        recordResult(s.table, f.home, f.away, x, y);
      }
      // players
      const played = new Map(r.players.map((p) => [p.id, p]));
      for (const p of s.squad) {
        if (p.injuredWeeks > 0) p.injuredWeeks--;
        const m = played.get(p.id);
        if (m) {
          p.fitness = m.fitness;
          p.form = [...p.form, m.rating].slice(-5);
          p.apps++; p.goals += m.goals; p.assists += m.assists; p.ratingSum += m.rating;
          if (m.injured) p.injuredWeeks = randi(1, 3);
          applyXp(p, Math.round(randi(3, 7) * ageXpFactor(p.age) * (m.rating >= 7 ? 1.4 : 1)));
        }
        p.fitness = clamp(p.fitness + 22, 0, 100);
      }
      s.squad.forEach((p) => { if (p.injuredWeeks > 0) p.fitness = Math.min(p.fitness, 60); });
      const opp = s.league.find((c) => c.id === r.opponentId)!;
      const win = r.userGoals > r.oppGoals, draw = r.userGoals === r.oppGoals;
      const coins = (win ? 120 : draw ? 70 : 40) + r.userGoals * 5;
      const bonus = win ? 0.6 : draw ? 0.25 : 0;
      s.coins += coins;
      s.transferBudget = Math.round((s.transferBudget + bonus) * 10) / 10;
      const hn = r.homeIsUser ? s.club.name : opp.name, an = r.homeIsUser ? opp.name : s.club.name;
      addNews(s, 'match', `${win ? 'MENANG' : draw ? 'IMBANG' : 'KALAH'}: ${hn} ${hg}-${ag} ${an}`,
        `${r.scorers.length ? 'Pencetak gol: ' + r.scorers.join(', ') + '. ' : 'Tanpa gol tercipta. '}Man of the Match: ${r.motm}. Hadiah: +${coins} Coin${bonus ? `, bonus budget +${fmtMoney(bonus)}` : ''}.`);
      // advance
      s.week++;
      s.trainingLeft = 3;
      // re-validate lineup (injuries)
      if (s.lineup.some((id) => s.squad.find((p) => p.id === id)?.injuredWeeks)) {
        const ap = autoPick(s.squad, s.tactics.formation);
        s.lineup = ap.lineup; s.bench = ap.bench;
        addNews(s, 'club', 'Cedera memaksa perubahan susunan pemain', 'Staf pelatih menyesuaikan starting XI karena ada pemain yang cedera.');
      }
      if (s.week % 4 === 0) {
        const keep = s.market.filter((m) => m.status === 'available').slice(0, 12);
        s.market = [...keep, ...genMarket(s.league, 24 - keep.length)].sort((a, b) => ovrOf(b) - ovrOf(a));
        addNews(s, 'transfer', 'Bursa transfer diperbarui', 'Agen-agen menawarkan daftar pemain baru. Pemain yang sebelumnya menolak kini sudah pindah ke tempat lain.');
      }
      if (s.week >= totalRounds(s.league)) {
        const sorted = sortTable(s.table);
        const champ = s.league.find((c) => c.id === sorted[0].clubId)!;
        const pos = sorted.findIndex((t) => t.clubId === 'user') + 1;
        const prize = Math.max(5, (11 - pos) * 3);
        addNews(s, 'season', `${champ.name} juara ${LEAGUE_NAME} musim ${s.season}!`, `${s.club.name} finis di posisi #${pos}. Manajemen memberikan transfer budget musim baru +${fmtMoney(prize)} dan 500 Coin.`);
        s.transferBudget += prize;
        s.coins += 500;
        s.season++;
        s.week = 0;
        s.fixtures = makeFixtures(s.league);
        s.table = makeTable(s.league);
        s.squad.forEach((p) => { p.age++; p.fitness = 100; });
      }
    });
  };

  const completeTransfer = (mp: MarketPlayer, fee: number, wage: number, years: number) => {
    mutate((s) => {
      s.transferBudget = Math.round((s.transferBudget - fee) * 10) / 10;
      const used = new Set(s.squad.map((p) => p.num));
      let num = mp.num;
      while (used.has(num)) num = randi(2, 45);
      const p: Player = {
        id: mp.id, name: mp.name, nation: mp.nation, pos: mp.pos, age: mp.age, num, attrs: mp.attrs, potential: mp.potential,
        fitness: mp.fitness, form: mp.form, xp: mp.xp, injuredWeeks: 0, wage, apps: 0, goals: 0, assists: 0, ratingSum: 0,
      };
      s.squad.push(p);
      if (s.bench.length < 9) s.bench.push(p.id);
      s.market = s.market.filter((m) => m.id !== mp.id);
      addNews(s, 'transfer', `DONE DEAL ✍️ ${mp.name} resmi bergabung dengan ${s.club.name}`,
        `${s.club.name} mendatangkan ${mp.name} (${mp.pos}, ${ovrOf(mp)} OVR) dari ${mp.club} dengan biaya ${fmtMoney(fee)}. Kontrak ${years} tahun dengan gaji €${wage}K/minggu.`);
    });
  };

  const rejectTransfer = (id: string, by: 'club' | 'player') => {
    mutate((s) => {
      const m = s.market.find((x) => x.id === id);
      if (!m) return;
      m.status = 'rejected';
      addNews(s, 'transfer', `Transfer ${m.name} batal`, by === 'club'
        ? `${m.club} menolak tawaran ${s.club.name} untuk ${m.name}. Negosiasi dihentikan sepenuhnya.`
        : `${m.name} menolak tawaran kontrak pribadi dari ${s.club.name}. Sang pemain tetap bertahan di ${m.club}.`);
    });
  };

  const sellPlayer = (id: string) => {
    const s0 = stateRef.current;
    if (s0.squad.length <= 18) { toast('Skuad minimal 18 pemain', 'err'); return; }
    const p = s0.squad.find((x) => x.id === id)!;
    const fee = Math.round(playerValue(ovrOf(p), p.age, p.potential) * rand(0.8, 1.0) * 10) / 10;
    const buyer = s0.league.filter((c) => !c.isUser)[randi(0, s0.league.length - 2)];
    mutate((s) => {
      s.squad = s.squad.filter((x) => x.id !== id);
      s.bench = s.bench.filter((x) => x !== id);
      if (s.lineup.includes(id)) {
        const ap = autoPick(s.squad, s.tactics.formation);
        const idx = s.lineup.indexOf(id);
        const repl = ap.bench.find((b) => !s.lineup.includes(b)) ?? ap.lineup.find((b) => !s.lineup.includes(b));
        s.lineup[idx] = repl ?? '';
        s.bench = s.bench.filter((b) => b !== repl);
      }
      s.transferBudget = Math.round((s.transferBudget + fee) * 10) / 10;
      addNews(s, 'transfer', `${p.name} dijual ke ${buyer.name}`, `${s.club.name} melepas ${p.name} dengan biaya ${fmtMoney(fee)}. Dana masuk ke transfer budget.`);
    });
    toast(`${p.name} terjual ${fmtMoney(fee)}`);
  };

  const value: Ctx = {
    state, mutate, replaceState, page, setPage, accent, accentText: textOn(accent), logout: onLogout, toast,
    saveSlot, loadSlot, deleteSlot, slots, lastAutosave, runTraining, upgradePlayer, applyMatch, completeTransfer,
    rejectTransfer, sellPlayer, matchRef, coinTick,
  };

  return (
    <GameCtx.Provider value={value}>
      <div style={{ ['--accent' as string]: accent, ['--accent-text' as string]: textOn(accent) }}>
        {children}
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
          {toasts.map((t) => (
            <div key={t.id} className={`rounded-lg border px-4 py-2.5 text-sm font-medium shadow-2xl backdrop-blur animate-[slidein_.25s_ease-out] ${t.kind === 'err' ? 'border-rose-500/40 bg-rose-950/90 text-rose-200' : t.kind === 'info' ? 'border-sky-500/40 bg-sky-950/90 text-sky-200' : 'border-emerald-500/40 bg-emerald-950/90 text-emerald-200'}`}>
              {t.text}
            </div>
          ))}
        </div>
      </div>
    </GameCtx.Provider>
  );
}
