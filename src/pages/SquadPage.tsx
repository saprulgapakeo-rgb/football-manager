import { useMemo, useState } from 'react';
import { useGame, TRAINING, upgradeCost, type TrainingFocus } from '@/game/store';
import { TACTIC_PRESETS, presetMatches } from '@/game/presets';
import { Bar, Button, Card, FormChips, Modal, OvrBadge, PosBadge, RatingBadge, Scale, Segmented, Stat } from '@/components/ui';
import { FORMATIONS, FORMATION_LIST, autoPick } from '@/game/formations';
import { ATTR_KEYS, POS_GROUP, avgForm, fmtMoney, ovrOf, playerValue, slotRating } from '@/game/players';
import { ATTR_LABELS, ATTR_SHORT, MENTALITY_LABELS, NATION_FLAGS, PRESSING_LABELS, TEMPO_LABELS } from '@/game/data';
import type { AttrKey, Player, Tactics } from '@/game/types';
import { cn } from '@/utils/cn';
import { PitchLines, Jersey } from '@/components/ClubVisuals';
import { textOn } from '@/game/matchEngine';

type Filter = 'ALL' | 'GK' | 'DEF' | 'MID' | 'ATT';
type Sort = 'pos' | 'ovr' | 'pot' | 'fit' | 'form' | 'age';
const POS_ORDER = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'ST'];

export function SquadPage() {
  const { state, mutate, runTraining, runAutoUpgrade, toast } = useGame();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [sort, setSort] = useState<Sort>('pos');
  const [detail, setDetail] = useState<string | null>(null);
  const [slotPick, setSlotPick] = useState<number | null>(null);
  const [focus, setFocus] = useState<TrainingFocus>('technique');
  const [report, setReport] = useState<{ focus: TrainingFocus; items: { name: string; gained: number }[] } | null>(null);
  const [autoReport, setAutoReport] = useState<{ name: string; gained: number }[] | null>(null);

  const byId = useMemo(() => new Map(state.squad.map((p) => [p.id, p])), [state.squad]);
  const slots = FORMATIONS[state.tactics.formation];
  const xi = state.lineup.map((id) => byId.get(id));
  const xiAvg = Math.round(xi.reduce((a, p, i) => a + (p ? slotRating(p, slots[i].role) : 0), 0) / 11);
  const avgFit = Math.round(state.squad.reduce((a, p) => a + p.fitness, 0) / state.squad.length);

  const list = useMemo(() => {
    let l = state.squad.filter((p) => filter === 'ALL' || POS_GROUP[p.pos] === filter);
    const f: Record<Sort, (a: Player, b: Player) => number> = {
      pos: (a, b) => POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos) || ovrOf(b) - ovrOf(a),
      ovr: (a, b) => ovrOf(b) - ovrOf(a), pot: (a, b) => b.potential - a.potential, fit: (a, b) => b.fitness - a.fitness,
      form: (a, b) => avgForm(b) - avgForm(a), age: (a, b) => a.age - b.age,
    };
    l = [...l].sort(f[sort]);
    return l;
  }, [state.squad, filter, sort]);

  const status = (id: string) => (state.lineup.includes(id) ? 'XI' : state.bench.includes(id) ? 'SUB' : 'RES');

  const assign = (slot: number, pid: string) => {
    mutate((s) => {
      const cur = s.lineup[slot];
      const j = s.lineup.indexOf(pid);
      const b = s.bench.indexOf(pid);
      if (j >= 0) { s.lineup[j] = cur; s.lineup[slot] = pid; }
      else if (b >= 0) { if (cur) s.bench[b] = cur; else s.bench.splice(b, 1); s.lineup[slot] = pid; }
      else { s.lineup[slot] = pid; if (cur && s.bench.length < 9) s.bench.push(cur); }
    });
    setSlotPick(null);
  };

  const toggleBench = (id: string) => {
    const st = status(id);
    if (st === 'XI') return;
    mutate((s) => {
      if (st === 'SUB') s.bench = s.bench.filter((x) => x !== id);
      else if (s.bench.length < 9) s.bench.push(id);
    });
    if (st === 'RES' && state.bench.length >= 9) toast('Bangku cadangan penuh (maks 9)', 'err');
  };

  const doAuto = () => {
    const ap = autoPick(state.squad, state.tactics.formation);
    mutate((s) => { s.lineup = ap.lineup; s.bench = ap.bench; });
    toast('Starting XI terbaik dipilih otomatis');
  };

  const applyPreset = (t: Tactics, name: string) => {
    mutate((s) => {
      const changed = s.tactics.formation !== t.formation;
      s.tactics = { ...t };
      if (changed) s.familiarity = Math.max(0, s.familiarity - 8);
    });
    toast(`Taktik ${name} diterapkan`);
  };

  const train = () => {
    const r = runTraining(focus);
    if (r) {
      setReport({ focus, items: r });
      toast(`Sesi ${TRAINING[focus].label} selesai${r.length ? ` · ${r.length} pemain naik OVR!` : ''}`);
    }
  };

  const detailP = detail ? byId.get(detail) : undefined;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">Skuad, Taktik & Latihan</h1>
          <p className="text-sm text-slate-400">Kelola pemain, susun formasi, dan jalankan program latihan.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Rating XI" value={<span className="text-[var(--accent)]">{xiAvg}</span>} />
          <Stat label="Pemain" value={state.squad.length} sub={`${state.squad.filter((p) => p.injuredWeeks > 0).length} cedera`} />
          <Stat label="Fitness Rata²" value={`${avgFit}%`} />
          <Stat label="Pemahaman Taktik" value={`${state.familiarity}%`} />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        {/* SQUAD LIST */}
        <Card title="Daftar Skuad" icon="●" className="min-w-0"
          action={<Segmented className="w-auto" options={['ALL', 'GK', 'DEF', 'MID', 'ATT'] as Filter[]} labels={['Semua', 'GK', 'DEF', 'MID', 'ATT']} value={filter} onChange={setFilter} />}>
          <div className="-mx-4 -mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-500">
                  {([['#', null], ['Pos', 'pos'], ['Nama', null], ['Usia', 'age'], ['OVR', 'ovr'], ['POT', 'pot'], ['Fitness', 'fit'], ['Form', 'form'], ['Status', null], ['', null]] as [string, Sort | null][]).map(([h, k]) => (
                    <th key={h + k} onClick={() => k && setSort(k)} className={cn('px-2 py-2.5 text-left font-semibold first:pl-4', k && 'cursor-pointer hover:text-slate-300', sort === k && 'text-[var(--accent)]')}>{h}{sort === k && ' ↓'}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const st = status(p.id);
                  const o = ovrOf(p);
                  return (
                    <tr key={p.id} className="border-b border-white/[0.03] transition hover:bg-white/[0.03]">
                      <td className="py-2 pl-4 pr-2 font-mono text-xs text-slate-500">{p.num}</td>
                      <td className="px-2"><PosBadge pos={p.pos} /></td>
                      <td className="px-2">
                        <button onClick={() => setDetail(p.id)} className="flex items-center gap-2 text-left hover:text-[var(--accent)]">
                          <span>{NATION_FLAGS[p.nation]}</span>
                          <span className="font-semibold">{p.name}</span>
                          {p.injuredWeeks > 0 && <span className="rounded bg-rose-500/20 px-1 text-[10px] font-bold text-rose-300">🚑 {p.injuredWeeks}pk</span>}
                        </button>
                      </td>
                      <td className="px-2 text-slate-400">{p.age}</td>
                      <td className="px-2"><OvrBadge v={o} size="sm" /></td>
                      <td className="px-2">
                        <span className={cn('text-xs font-bold', p.potential - o >= 8 ? 'text-emerald-400' : p.potential - o >= 3 ? 'text-lime-300' : 'text-slate-500')}>{p.potential}</span>
                      </td>
                      <td className="w-28 px-2">
                        <div className="flex items-center gap-2"><Bar value={p.fitness} /><span className="w-7 text-right text-[11px] tabular-nums text-slate-400">{Math.round(p.fitness)}</span></div>
                      </td>
                      <td className="px-2"><div className="flex items-center gap-1.5"><FormChips form={p.form} /><RatingBadge r={avgForm(p)} /></div></td>
                      <td className="px-2">
                        <button onClick={() => toggleBench(p.id)} title={st === 'XI' ? 'Ubah dari papan formasi' : 'Klik untuk pindah Cadangan/Reserve'}
                          className={cn('rounded px-1.5 py-0.5 text-[10px] font-black', st === 'XI' ? 'bg-[var(--accent)] text-[var(--accent-text)]' : st === 'SUB' ? 'bg-sky-500/20 text-sky-300 hover:bg-sky-500/30' : 'bg-white/5 text-slate-500 hover:bg-white/10')}>
                          {st === 'XI' ? 'STARTER' : st === 'SUB' ? 'CADANGAN' : 'RESERVE'}
                        </button>
                      </td>
                      <td className="pr-4 text-right">
                        <Button size="sm" variant="outline" onClick={() => setDetail(p.id)}>Upgrade</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-5">
          {/* TACTICS */}
          <Card title="Taktik" icon="◆" action={<Button size="sm" variant="ghost" onClick={doAuto}>⚡ Auto XI</Button>}>
            <div className="space-y-4">
              <div>
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Preset Taktik</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {TACTIC_PRESETS.map((pr) => (
                    <button key={pr.id} title={pr.desc} onClick={() => applyPreset(pr.tactics, pr.name)}
                      className={cn('rounded-lg border px-2 py-2 text-left text-[11px] font-bold transition',
                        presetMatches(pr, state.tactics) ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-white' : 'border-white/10 bg-black/20 text-slate-300 hover:border-white/25')}>
                      {pr.icon} {pr.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Formasi</div>
                <Segmented options={FORMATION_LIST} value={state.tactics.formation} onChange={(f) => f !== state.tactics.formation && mutate((s) => { s.tactics.formation = f; s.familiarity = Math.max(0, s.familiarity - 8); })} />
              </div>
              <div className="relative overflow-hidden rounded-xl border border-white/10">
                <svg viewBox="0 0 68 105" className="block w-full">
                  <g transform="translate(0 105) rotate(-90)">
                    <PitchLines />
                  </g>
                </svg>
                <div className="absolute inset-0">
                  {slots.map((s, i) => {
                    const p = xi[i];
                    const bad = p && (p.injuredWeeks > 0);
                    const r = p ? slotRating(p, s.role) : 0;
                    return (
                      <button key={i} onClick={() => setSlotPick(i)}
                        className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center group"
                        style={{ left: `${s.y}%`, top: `${100 - s.x}%` }}>
                        <span className={cn('flex h-8 w-8 items-center justify-center rounded-full border-2 text-[11px] font-black shadow-lg transition group-hover:scale-110', bad && 'ring-2 ring-rose-500')}
                          style={{ background: state.club.primary, borderColor: state.club.secondary, color: textOn(state.club.primary) }}>
                          {p ? p.num : '+'}
                        </span>
                        <span className="mt-0.5 max-w-[70px] truncate rounded bg-black/70 px-1 text-[9px] font-semibold text-white">{p ? p.name.split(' ').slice(-1)[0] : s.role}</span>
                        <span className={cn('rounded px-1 text-[9px] font-black', p && r < ovrOf(p) ? 'bg-amber-500 text-amber-950' : 'bg-white/90 text-slate-900')}>{s.role} {p ? r : ''}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="text-[11px] text-slate-500">Klik posisi di lapangan untuk mengganti pemain. Badge kuning = pemain bermain di luar posisi aslinya.</p>
              <Scale label="Mentalitas" value={state.tactics.mentality} labels={MENTALITY_LABELS} onChange={(v) => mutate((s) => { s.tactics.mentality = v; })} />
              <Scale label="Tempo Permainan" value={state.tactics.tempo} labels={TEMPO_LABELS} onChange={(v) => mutate((s) => { s.tactics.tempo = v; })} />
              <Scale label="Intensitas Pressing" value={state.tactics.pressing} labels={PRESSING_LABELS} onChange={(v) => mutate((s) => { s.tactics.pressing = v; })} />
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Cadangan ({state.bench.length}/9)</div>
                <div className="flex flex-wrap gap-1">
                  {state.bench.map((id) => byId.get(id)).filter(Boolean).map((p) => (
                    <span key={p!.id} className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-[11px]">
                      <b className="text-slate-400">{p!.pos}</b> {p!.name.split(' ').slice(-1)[0]} <span className="text-slate-500">{ovrOf(p!)}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* TRAINING */}
          <Card title="Latihan Tim" icon="▲" action={<span className="rounded-full bg-black/40 px-2.5 py-1 text-xs font-bold">Sesi tersisa: <span className="text-[var(--accent)]">{state.trainingLeft}/3</span></span>}>
            <div className="grid grid-cols-1 gap-2">
              {(Object.keys(TRAINING) as TrainingFocus[]).map((k) => {
                const t = TRAINING[k];
                return (
                  <button key={k} onClick={() => setFocus(k)}
                    className={cn('flex items-center gap-3 rounded-xl border p-2.5 text-left transition', focus === k ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-white/5 bg-black/20 hover:border-white/15')}>
                    <span className="text-2xl">{t.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-slate-100">{t.label}</span>
                      <span className="block text-[11px] text-slate-500">{t.desc}</span>
                    </span>
                    <span className={cn('text-xs font-bold', t.fitness >= 0 ? 'text-emerald-400' : 'text-rose-400')}>{t.fitness > 0 ? '+' : ''}{t.fitness} FIT</span>
                  </button>
                );
              })}
            </div>
            <Button className="mt-3 w-full" size="lg" disabled={state.trainingLeft <= 0} onClick={train}>▶ Jalankan Sesi Latihan</Button>
            {state.trainingLeft <= 0 && <p className="mt-2 text-center text-xs text-amber-400">Jatah latihan habis — mainkan laga di Match Day untuk pekan baru.</p>}
            {report && (
              <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 text-xs">
                <div className="mb-1 font-bold text-slate-200">Laporan: {TRAINING[report.focus].label}</div>
                {report.items.length ? report.items.map((r) => <div key={r.name} className="text-emerald-300">▲ {r.name} +{r.gained} OVR</div>) : <div className="text-slate-500">Belum ada kenaikan OVR, progres XP tetap bertambah.</div>}
              </div>
            )}
            <div className="mt-4 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-white">⚡ Upgrade Otomatis</div>
                <button onClick={() => mutate((s) => { s.autoUpgrade = !(s.autoUpgrade ?? false); })}
                  className={cn('relative h-6 w-11 rounded-full transition', (state.autoUpgrade ?? false) ? 'bg-[var(--accent)]' : 'bg-white/15')}>
                  <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all', (state.autoUpgrade ?? false) ? 'left-[22px]' : 'left-0.5')} />
                </button>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                Otomatis memberi sesi latihan khusus ke prospek terbaik (usia ≤26, masih jauh dari potensi) memakai Coin, dengan cadangan 150 Coin.
                Pemain muda (≤23 th) juga berkembang sendiri tiap pekan; pemain senior (≥32 th) perlahan menurun.
              </p>
              <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => {
                const r = runAutoUpgrade();
                setAutoReport(r);
                toast(r.length ? `⚡ Upgrade otomatis: ${r.length} pemain dilatih` : 'Tidak ada prospek yang memenuhi syarat / Coin kurang', r.length ? 'ok' : 'info');
              }}>⚡ Jalankan Upgrade Otomatis Sekarang</Button>
              {autoReport && (
                <div className="mt-2 text-xs">
                  {autoReport.length ? autoReport.map((r) => <div key={r.name} className="text-emerald-300">▲ {r.name} +{r.gained} OVR</div>) : <div className="text-slate-500">Tidak ada pemain yang dilatih (syarat: usia ≤26, fitness ≥50, belum maks potensi, Coin &gt; biaya + 150).</div>}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <SlotPicker slot={slotPick} onClose={() => setSlotPick(null)} onPick={assign} />
      {detailP && <PlayerDetail p={detailP} onClose={() => setDetail(null)} />}
    </div>
  );
}

function SlotPicker({ slot, onClose, onPick }: { slot: number | null; onClose: () => void; onPick: (slot: number, id: string) => void }) {
  const { state } = useGame();
  if (slot === null) return null;
  const role = FORMATIONS[state.tactics.formation][slot].role;
  const cands = [...state.squad].sort((a, b) => slotRating(b, role) - slotRating(a, role));
  return (
    <Modal open onClose={onClose} title={`Pilih pemain untuk posisi ${role}`}>
      <div className="max-h-[60vh] divide-y divide-white/5 overflow-y-auto">
        {cands.map((p) => {
          const st = state.lineup.indexOf(p.id) === slot ? 'Di posisi ini' : state.lineup.includes(p.id) ? 'Starter' : state.bench.includes(p.id) ? 'Cadangan' : 'Reserve';
          return (
            <button key={p.id} disabled={p.injuredWeeks > 0} onClick={() => onPick(slot, p.id)}
              className="flex w-full items-center gap-3 px-5 py-2 text-left hover:bg-white/5 disabled:opacity-40">
              <PosBadge pos={p.pos} />
              <span className="flex-1 text-sm font-semibold">{p.name} {p.injuredWeeks > 0 && '🚑'}</span>
              <span className="text-[10px] text-slate-500">{st}</span>
              <div className="w-14"><Bar value={p.fitness} /></div>
              <OvrBadge v={slotRating(p, role)} size="sm" />
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

function PlayerDetail({ p, onClose }: { p: Player; onClose: () => void }) {
  const { state, upgradePlayer, sellPlayer, toast } = useGame();
  const [focus, setFocus] = useState<AttrKey>(() => {
    const keys = ATTR_KEYS.filter((k) => (p.pos === 'GK' ? k === 'goalkeeping' : k !== 'goalkeeping'));
    return keys[0];
  });
  const [flash, setFlash] = useState(false);
  const o = ovrOf(p);
  const cost = upgradeCost(p);
  const maxed = o >= p.potential;
  const keys = ATTR_KEYS.filter((k) => (p.pos === 'GK' ? true : k !== 'goalkeeping'));
  const avg = p.apps ? p.ratingSum / p.apps : 0;

  const up = () => {
    const r = upgradePlayer(p.id, focus);
    if (r) {
      if (r.gained) { toast(`🔥 ${p.name} naik +${r.gained} OVR!`); setFlash(true); setTimeout(() => setFlash(false), 900); }
      else toast(`Sesi khusus selesai · progres XP bertambah`, 'info');
    }
  };

  return (
    <Modal open onClose={onClose} className="max-w-3xl" title="Profil Pemain">
      <div className="grid gap-5 p-5 md:grid-cols-[220px_1fr]">
        {/* FUT style card */}
        <div className={cn('relative mx-auto w-[220px] overflow-hidden rounded-2xl border-2 p-4 text-center shadow-2xl transition', flash && 'scale-105')}
          style={{ borderColor: o >= 80 ? '#facc15' : o >= 70 ? '#cbd5e1' : '#b45309', background: `linear-gradient(160deg, ${o >= 80 ? '#854d0e' : o >= 70 ? '#334155' : '#451a03'}, #0b1220 70%)` }}>
          <div className="flex items-start justify-between">
            <div className="text-left">
              <div className="text-4xl font-black leading-none text-white">{o}</div>
              <div className="text-sm font-bold text-white/80">{p.pos}</div>
              <div className="text-xl">{NATION_FLAGS[p.nation]}</div>
            </div>
            <Jersey primary={state.club.primary} secondary={state.club.secondary} pattern={state.club.pattern} number={p.num} size={96} />
          </div>
          <div className="mt-1 truncate border-b border-white/20 pb-1 text-base font-black uppercase tracking-wide text-white">{p.name}</div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-left text-sm">
            {(['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical'] as AttrKey[]).map((k) => (
              <div key={k} className="flex justify-between"><b className="text-white">{p.pos === 'GK' && k === 'shooting' ? p.attrs.goalkeeping : p.attrs[k]}</b><span className="text-white/60">{p.pos === 'GK' && k === 'shooting' ? 'GK' : ATTR_SHORT[k]}</span></div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            <Stat label="Usia" value={p.age} />
            <Stat label="Potensi" value={<span className="text-emerald-400">{p.potential}</span>} />
            <Stat label="Nilai" value={<span className="text-base">{fmtMoney(playerValue(o, p.age, p.potential))}</span>} />
            <Stat label="Gaji" value={<span className="text-base">€{p.wage}K</span>} sub="/minggu" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <Stat label="Main" value={p.apps} />
            <Stat label="Gol" value={p.goals} />
            <Stat label="Assist" value={p.assists} />
            <Stat label="Avg Rating" value={<RatingBadge r={avg} className="text-sm" />} />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs"><span className="text-slate-400">Fitness</span><b>{Math.round(p.fitness)}%</b></div>
            <Bar value={p.fitness} className="h-2" />
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">Form 5 laga terakhir: {p.form.length ? p.form.map((r, i) => <RatingBadge key={i} r={r} />) : '—'}</div>
          </div>
          <div className="space-y-1.5">
            {keys.map((k) => (
              <div key={k} className="flex items-center gap-3 text-xs">
                <span className="w-20 text-slate-400">{ATTR_LABELS[k]}</span>
                <Bar value={p.attrs[k]} max={99} color={p.attrs[k] >= 80 ? 'bg-emerald-500' : p.attrs[k] >= 65 ? 'bg-lime-400' : p.attrs[k] >= 50 ? 'bg-amber-400' : 'bg-rose-500'} className="h-2" />
                <b className="w-6 text-right tabular-nums">{p.attrs[k]}</b>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/5 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-bold text-white">⚡ Sesi Latihan Khusus</div>
              <div className="text-[11px] text-slate-400">OVR {o} → Potensi {p.potential}</div>
            </div>
            <div className="mb-2">
              <div className="mb-1 flex justify-between text-[11px] text-slate-400"><span>Progres ke OVR berikutnya</span><span>{maxed ? 'MAKS' : `${Math.round(p.xp)}/100 XP`}</span></div>
              <Bar value={maxed ? 100 : p.xp} color="bg-[var(--accent)]" className="h-2" />
              <div className="mt-1.5 flex items-center gap-1">
                <span className="text-[10px] text-slate-500">Pertumbuhan</span>
                <div className="relative h-1.5 flex-1 rounded-full bg-white/10">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-500/70" style={{ width: `${((o - 40) / Math.max(1, p.potential - 40)) * 100}%` }} />
                </div>
              </div>
            </div>
            <div className="mb-2 text-[11px] text-slate-400">Fokus atribut:</div>
            <div className="mb-3 flex flex-wrap gap-1">
              {keys.map((k) => (
                <button key={k} onClick={() => setFocus(k)} className={cn('rounded px-2 py-1 text-[11px] font-semibold', focus === k ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'bg-white/5 text-slate-400 hover:bg-white/10')}>{ATTR_LABELS[k]}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button className="flex-1" disabled={maxed || state.coins < cost || p.injuredWeeks > 0} onClick={up}>
                {maxed ? 'Potensi Maksimal Tercapai' : <>Latih · <span className="font-black">{cost}</span> Coin</>}
              </Button>
              <Button variant="danger" size="md" onClick={() => { if (confirm(`Jual ${p.name}?`)) { sellPlayer(p.id); onClose(); } }}>Jual</Button>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">Setiap sesi: +XP (lebih besar untuk pemain muda), -10 fitness. 100 XP = +1 OVR hingga batas potensi.</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
