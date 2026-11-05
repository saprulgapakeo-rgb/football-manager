import { useEffect, useRef, useState } from 'react';
import { useGame } from '@/game/store';
import { Bar, Button, Card, FormChips, Modal, OvrBadge, PosBadge, RatingBadge, Scale, Segmented } from '@/components/ui';
import { ClubLogo, PitchLines } from '@/components/ClubVisuals';
import { buildResult, createSim, setTactics, step, substitute, updatePositions, type MatchSim, type SimPlayer } from '@/game/matchEngine';
import { MatchCanvas, type MatchQuality } from '@/components/MatchCanvas';
import { TACTIC_PRESETS, presetMatches } from '@/game/presets';
import { sortTable } from '@/game/league';
import { FORMATIONS, FORMATION_LIST } from '@/game/formations';
import { MENTALITY_LABELS, PRESSING_LABELS, TEMPO_LABELS } from '@/game/data';
import { findClub, getNextMatch, leagueNameOf, type NextMatch } from '@/game/world/engine';
import { CLUB_BY_ID, LEAGUE_BY_ID } from '@/game/world/db';
import { slotRating, POS_GROUP } from '@/game/players';
import type { LeagueClub, Player, Tactics } from '@/game/types';
import { cn } from '@/utils/cn';

function TeamBadge({ club, size = 56 }: { club: LeagueClub; size?: number }) {
  const { state } = useGame();
  if (club.isUser) return <ClubLogo club={state.club} size={size} />;
  return <ClubLogo club={{ logo: { type: 'gen', shape: 'circle', symbol: 'none', showInitials: true }, primary: club.primary, secondary: club.secondary, short: club.short }} size={size} />;
}

export function MatchPage() {
  const { state, matchRef, applyMatch, mutate } = useGame();
  const [, setTick] = useState(0);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [quality, setQuality] = useState<MatchQuality>(() => (localStorage.getItem('fmco:match-quality') as MatchQuality) || 'medium');
  const [selected, setSelected] = useState<{ team: 0 | 1; id: string } | null>(null);
  const [goalFlash, setGoalFlash] = useState<string | null>(null);
  const [tab, setTab] = useState<'feed' | 'ratings' | 'stats'>('feed');
  const runRef = useRef(running); runRef.current = running;
  const speedRef = useRef(speed); speedRef.current = speed;
  const goalsRef = useRef(matchRef.current ? matchRef.current.score[0] + matchRef.current.score[1] : 0);
  const drawHandle = useRef<(() => void) | null>(null);
  const dirtyRef = useRef(true);

  useEffect(() => { localStorage.setItem('fmco:match-quality', quality); }, [quality]);
  useEffect(() => { dirtyRef.current = true; drawHandle.current?.(); }, [selected, quality]);

  useEffect(() => {
    let raf = 0, last = performance.now();
    let syncEv = -1, syncS0 = -1, syncS1 = -1, syncMin = -1, syncSubs = '', syncClock = 0;
    let animActive = false; // true while a substitution walk-on is playing on the canvas
    const loop = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000); last = t;
      const sim = matchRef.current;
      if (sim && runRef.current && !sim.finished) {
        const g = dt * speedRef.current;
        step(sim, g);
        updatePositions(sim, g);
        if (sim.pauseRequest) { sim.pauseRequest = false; setRunning(false); }
        if (sim.finished) setRunning(false);
        const goals = sim.score[0] + sim.score[1];
        if (goals > goalsRef.current) {
          goalsRef.current = goals;
          const ev = sim.events.find((e) => e.type === 'goal');
          const teamName = ev?.team === 0 ? sim.teams[0].name : sim.teams[1].name;
          setGoalFlash(sim.celebration ? `${sim.celebration.scorerName} · ${teamName}` : teamName);
          setTimeout(() => setGoalFlash(null), 2200);
        }
      }
      if (sim) {
        // Canvas renders every frame while running (no React re-render); UI syncs only on change.
        // It also keeps rendering while a substitution walk-on plays, even when paused.
        if (runRef.current || dirtyRef.current || animActive) { animActive = drawHandle.current?.() ?? false; dirtyRef.current = false; }
        const min = Math.floor(sim.minute);
        const subs = sim.teams[0].subsUsed + ':' + sim.teams[1].subsUsed;
        const beat = runRef.current && t - syncClock > 600;
        if (sim.evId !== syncEv || sim.score[0] !== syncS0 || sim.score[1] !== syncS1 || min !== syncMin || subs !== syncSubs || beat) {
          syncEv = sim.evId; syncS0 = sim.score[0]; syncS1 = sim.score[1]; syncMin = min; syncSubs = subs; syncClock = t;
          setTick((x) => (x + 1) % 1e6);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [matchRef]);

  const sim = matchRef.current;
  const next = getNextMatch(state);

  if (!sim) {
    if (!next) return <Card>Tidak ada jadwal pertandingan.</Card>;
    return <PreMatch next={next} onKickoff={(opp, home, oppSquad) => {
      matchRef.current = createSim(state, opp, home, oppSquad);
      goalsRef.current = 0;
      setSelected(null);
      setRunning(true);
    }} />;
  }

  const [u, o] = sim.teams;
  const home = sim.homeIsUser ? u : o, away = sim.homeIsUser ? o : u;
  const hs = sim.homeIsUser ? sim.score[0] : sim.score[1];
  const as = sim.homeIsUser ? sim.score[1] : sim.score[0];
  const minute = Math.min(Math.floor(sim.minute), 90 + sim.stoppage);
  const possT = sim.stats.poss[0] + sim.stats.poss[1] || 1;
  const uPoss = Math.round((sim.stats.poss[0] / possT) * 100);
  const oppClub = findClub(state, sim.opponentId);
  const userClub = state.league.find((c) => c.isUser)!;

  const selPlayer = selected ? sim.teams[selected.team].onPitch.find((p) => p.id === selected.id) : undefined;

  const finishMatch = () => {
    const r = buildResult(sim);
    applyMatch(r);
    matchRef.current = null;
    setSelected(null);
    mutate(() => {});
  };

  return (
    <div className="space-y-4">
      {/* Scoreboard */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80">
        <div className="absolute inset-0 opacity-30" style={{ background: `linear-gradient(90deg, ${home.kit}55, transparent 40%, transparent 60%, ${away.kit}55)` }} />
        <div className="relative flex items-center justify-between gap-2 px-4 py-3 sm:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <TeamBadge club={sim.homeIsUser ? userClub : oppClub} size={48} />
            <div className="min-w-0">
              <div className="truncate text-sm font-black text-white sm:text-lg">{home.name}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Kandang · {home.tactics.formation}</div>
            </div>
          </div>
          <div className="text-center">
            <div className="flex items-center gap-3 rounded-xl bg-black/60 px-4 py-1.5 font-black tabular-nums text-white">
              <span className="text-3xl sm:text-4xl">{hs}</span><span className="text-slate-500">-</span><span className="text-3xl sm:text-4xl">{as}</span>
            </div>
            <div className={cn('mt-1 inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-black', sim.finished ? 'bg-slate-700 text-slate-200' : 'bg-rose-600 text-white')}>
              {!sim.finished && running && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
              {sim.finished ? 'FT' : minute >= 90 ? `90+${minute - 90}'` : `${minute}'`}
              {!sim.finished && sim.halfDone && minute === 45 && !running && ' · HT'}
            </div>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3 text-right">
            <div className="min-w-0">
              <div className="truncate text-sm font-black text-white sm:text-lg">{away.name}</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Tandang · {away.tactics.formation}</div>
            </div>
            <TeamBadge club={sim.homeIsUser ? oppClub : userClub} size={48} />
          </div>
        </div>
        <div className="relative h-1 bg-white/5"><div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${Math.min(100, (sim.minute / (90 + sim.stoppage)) * 100)}%` }} /></div>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[1fr_380px] xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          {/* Pitch */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0f3d22] shadow-2xl">
            <div className="flex items-center justify-between bg-black/40 px-3 py-1.5 text-[11px] font-bold">
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border" style={{ background: u.kit }} />{u.short} → menyerang</span>
              <span className="text-slate-400">Klik pemain untuk melihat kondisi</span>
              <span className="flex items-center gap-1.5">menyerang ← {o.short}<span className="h-3 w-3 rounded-full border" style={{ background: o.kit }} /></span>
            </div>
            <MatchCanvas
              getSim={() => matchRef.current}
              selectedId={selected?.id ?? null}
              onSelect={(team, id) => setSelected({ team, id })}
              quality={quality}
              userSecondary={state.club.secondary}
              drawHandle={drawHandle}
            />
            {goalFlash && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="animate-[pop_.4s_ease-out] text-center">
                  <div className="text-6xl font-black italic tracking-tighter text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.8)] sm:text-8xl">GOOOL!</div>
                  <div className="mt-1 rounded bg-[var(--accent)] px-3 py-1 text-sm font-black text-[var(--accent-text)]">{goalFlash}</div>
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {!sim.finished ? (
              <Button size="lg" onClick={() => setRunning((r) => !r)} className="min-w-[150px]">
                {running ? '⏸ Jeda' : sim.minute < 0.5 ? '▶ Kick-off' : sim.halfDone && minute === 45 ? '▶ Babak Kedua' : '▶ Lanjutkan'}
              </Button>
            ) : (
              <Button size="lg" variant="success" onClick={finishMatch}>✔ Simpan Hasil & Lanjut</Button>
            )}
            <div className="flex items-center gap-1 rounded-lg bg-black/30 p-1">
              {[1, 2, 4].map((s) => (
                <button key={s} onClick={() => setSpeed(s)} className={cn('rounded-md px-3 py-1.5 text-xs font-bold', speed === s ? 'bg-white/15 text-white' : 'text-slate-500 hover:text-slate-300')}>{s}x</button>
              ))}
            </div>
            <div className="flex items-center gap-1 rounded-lg bg-black/30 p-1" title="Kualitas grafis pertandingan">
              <span className="pl-2 text-xs">🎨</span>
              {([['low', 'R', 'Rendah'], ['medium', 'S', 'Sedang'], ['high', 'T', 'Tinggi']] as [MatchQuality, string, string][]).map(([q, short, label]) => (
                <button key={q} title={label} onClick={() => setQuality(q)} className={cn('rounded-md px-2.5 py-1.5 text-xs font-bold', quality === q ? 'bg-white/15 text-white' : 'text-slate-500 hover:text-slate-300')}>{short}</button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-3 rounded-lg bg-black/30 px-3 py-2 text-xs">
              <span className="text-slate-400">Penguasaan</span>
              <span className="font-bold">{uPoss}%</span>
              <div className="flex h-2 w-32 overflow-hidden rounded-full">
                <div style={{ width: `${uPoss}%`, background: u.kit }} />
                <div style={{ width: `${100 - uPoss}%`, background: o.kit }} />
              </div>
              <span className="font-bold">{100 - uPoss}%</span>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <LiveTactics sim={sim} />
            <SubPanel sim={sim} sel={selPlayer} selTeam={selected?.team ?? 0} onSelect={(id) => setSelected({ team: 0, id })} />
          </div>
        </div>

        {/* Right column */}
        <Card className="flex max-h-[calc(100vh-150px)] flex-col xl:sticky xl:top-24" title={
          <Segmented className="w-full" options={['feed', 'ratings', 'stats'] as const as unknown as ('feed' | 'ratings' | 'stats')[]} labels={['Live Feed', 'Rating', 'Statistik']} value={tab} onChange={setTab} />
        }>
          {tab === 'feed' && (
            <div className="-mx-4 -my-4 max-h-[70vh] space-y-1 overflow-y-auto p-3">
              {sim.events.map((e) => (
                <div key={e.id} className={cn('flex gap-2 rounded-lg px-2.5 py-2 text-[13px] leading-snug animate-[slidein_.25s_ease-out]',
                  e.type === 'goal' ? 'border border-[var(--accent)]/40 bg-[var(--accent)]/15 font-semibold text-white' :
                  e.type === 'whistle' ? 'bg-white/10 font-semibold text-white' :
                  e.type === 'injury' ? 'bg-rose-500/10 text-rose-200' :
                  e.type === 'sub' ? 'bg-sky-500/10 text-sky-200' :
                  e.type === 'card' ? 'bg-amber-500/10 text-amber-200' : 'text-slate-300')}>
                  <span className="w-8 shrink-0 font-mono text-[11px] font-bold text-slate-500">{e.minute}'</span>
                  {e.team !== undefined && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: sim.teams[e.team].kit }} />}
                  <span>{e.text}</span>
                </div>
              ))}
            </div>
          )}
          {tab === 'ratings' && (
            <div className="-mx-4 -my-4 max-h-[70vh] overflow-y-auto p-3">
              {sim.teams.map((t, ti) => (
                <div key={ti} className="mb-3">
                  <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase text-slate-400"><span className="h-2.5 w-2.5 rounded-full" style={{ background: t.kit }} />{t.name}</div>
                  {[...t.onPitch, ...t.subbedOff].map((p) => (
                    <div key={p.id} className={cn('flex items-center gap-2 py-0.5 text-xs', t.subbedOff.includes(p) && 'opacity-50')}>
                      <span className="w-8 text-[10px] font-bold text-slate-500">{p.role}</span>
                      <span className="flex-1 truncate">{p.name}{p.goals ? ' ⚽'.repeat(p.goals) : ''}{p.assists ? ' 🅰️' : ''}</span>
                      <div className="w-12"><Bar value={p.fitness} /></div>
                      <RatingBadge r={p.rating} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          {tab === 'stats' && (
            <div className="space-y-3 text-sm">
              {([['Penguasaan', `${uPoss}%`, `${100 - uPoss}%`, uPoss], ['Tembakan', sim.stats.shots[0], sim.stats.shots[1]], ['Tepat Sasaran', sim.stats.onTarget[0], sim.stats.onTarget[1]], ['Umpan Sukses', sim.stats.passes[0], sim.stats.passes[1]], ['Pelanggaran', sim.stats.fouls[0], sim.stats.fouls[1]], ['Pergantian', u.subsUsed, o.subsUsed]] as [string, number | string, number | string, number?][]).map(([l, a, b, pct]) => {
                const na = typeof a === 'number' ? a : 0, nb = typeof b === 'number' ? b : 0;
                const p = pct ?? (na + nb ? (na / (na + nb)) * 100 : 50);
                return (
                  <div key={l}>
                    <div className="mb-1 flex justify-between text-xs"><b>{a}</b><span className="text-slate-400">{l}</span><b>{b}</b></div>
                    <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full"><div style={{ width: `${p}%`, background: u.kit }} /><div className="flex-1" style={{ background: o.kit }} /></div>
                  </div>
                );
              })}
              <p className="pt-2 text-[11px] text-slate-500">Tim kamu selalu menyerang ke kanan pada visual lapangan.</p>
            </div>
          )}
        </Card>
      </div>

      {sim.finished && <PostMatch sim={sim} onDone={finishMatch} />}
    </div>
  );
}

function PreMatch({ next, onKickoff }: { next: NextMatch; onKickoff: (opp: LeagueClub, home: boolean, oppSquad: Player[]) => void }) {
  const { state, setPage } = useGame();
  const { homeIsUser, opp } = next;
  const isCup = next.kind === 'cup';
  const user = state.league.find((c) => c.isUser)!;
  const table = sortTable(state.table);
  const rowOf = (id: string) => table.find((r) => r.clubId === id) ?? { pts: 0, form: [] as ('W' | 'D' | 'L')[] };
  const posOf = (id: string) => table.findIndex((r) => r.clubId === id) + 1;
  const dbOpp = CLUB_BY_ID.get(opp.id);
  const oppLeague = dbOpp ? LEAGUE_BY_ID.get(dbOpp.leagueId)?.name : undefined;
  const byId = new Map(state.squad.map((p) => [p.id, p]));
  const slots = FORMATIONS[state.tactics.formation];
  const xi = state.lineup.map((id) => byId.get(id));
  const xiRating = Math.round(xi.reduce((a, p, i) => a + (p ? slotRating(p, slots[i].role) : 0), 0) / 11);
  const warnings: string[] = [];
  xi.forEach((p) => { if (!p) warnings.push('Ada posisi kosong di starting XI'); else if (p.injuredWeeks > 0) warnings.push(`${p.name} cedera (akan diganti otomatis)`); else if (p.fitness < 60) warnings.push(`${p.name} fitness rendah (${Math.round(p.fitness)}%)`); });
  const H = homeIsUser ? user : opp, A = homeIsUser ? opp : user;
  const recent = state.fixtures.filter((f) => f.hg !== undefined && (f.home === 'user' || f.away === 'user')).slice(-5).reverse();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-white">Match Day</h1>
        <p className="text-sm text-slate-400">{isCup ? '🏆 ' : ''}{next.title} · {next.sub}</p>
      </div>
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-950">
        <svg viewBox="0 0 105 68" className="absolute inset-0 h-full w-full opacity-25" preserveAspectRatio="xMidYMid slice"><PitchLines /></svg>
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/40" />
        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-6 py-10 sm:px-12">
          {[H, A].map((c, i) => (
            <div key={c.id} className={cn('flex flex-col items-center gap-3 text-center', i === 1 && 'order-3')}>
              <TeamBadge club={c} size={96} />
              <div>
                <div className="text-lg font-black text-white sm:text-2xl">{c.isUser ? state.club.name : c.name}</div>
                <div className="text-xs text-slate-400">{isCup && !c.isUser ? `${oppLeague ?? 'Tamu'} · ` : `#${posOf(c.id)} · ${rowOf(c.id).pts} poin · `}Rating {c.isUser ? xiRating : c.rating}</div>
                <div className="mt-1 flex justify-center gap-1">
                  {rowOf(c.id).form.map((f, j) => <span key={j} className={cn('flex h-5 w-5 items-center justify-center rounded text-[10px] font-black', f === 'W' ? 'bg-emerald-500 text-emerald-950' : f === 'D' ? 'bg-slate-500 text-white' : 'bg-rose-500 text-white')}>{f === 'W' ? 'M' : f === 'D' ? 'S' : 'K'}</span>)}
                </div>
              </div>
            </div>
          ))}
          <div className="order-2 text-center">
            <div className="text-4xl font-black text-slate-500">VS</div>
            <div className="mt-2 text-xs text-slate-500">{homeIsUser ? 'Laga Kandang' : 'Laga Tandang'}{isCup ? ` · ${next.sub}` : ''}</div>
            {dbOpp && <div className="mt-1 text-[10px] text-slate-600">🏟️ {homeIsUser ? '' : dbOpp.stadium}</div>}
          </div>
        </div>
        <div className="relative flex flex-col items-center gap-3 pb-8">
          <Button size="lg" className="px-10 text-lg" onClick={() => onKickoff(opp, homeIsUser, next.oppSquad)}>⚽ KICK-OFF</Button>
          <button onClick={() => setPage('squad')} className="text-xs text-slate-400 underline-offset-2 hover:text-white hover:underline">Ubah susunan pemain & taktik</button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Starting XI" icon="●" className="lg:col-span-2">
          <div className="grid gap-1.5 sm:grid-cols-2">
            {xi.map((p, i) => p && (
              <div key={i} className="flex items-center gap-2 rounded-lg bg-black/20 px-2 py-1.5">
                <PosBadge pos={slots[i].role} />
                <span className="flex-1 truncate text-sm font-semibold">{p.name}</span>
                <FormChips form={p.form} />
                <div className="w-12"><Bar value={p.fitness} /></div>
                <OvrBadge v={slotRating(p, slots[i].role)} size="sm" />
              </div>
            ))}
          </div>
          {warnings.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              {warnings.slice(0, 5).map((w, i) => <div key={i}>⚠ {w}</div>)}
            </div>
          )}
        </Card>
        <div className="space-y-5">
          <Card title="Taktik" icon="◆">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">Formasi</span><b>{state.tactics.formation}</b></div>
              <div className="flex justify-between"><span className="text-slate-400">Mentalitas</span><b>{MENTALITY_LABELS[state.tactics.mentality - 1]}</b></div>
              <div className="flex justify-between"><span className="text-slate-400">Tempo</span><b>{TEMPO_LABELS[state.tactics.tempo - 1]}</b></div>
              <div className="flex justify-between"><span className="text-slate-400">Pressing</span><b>{PRESSING_LABELS[state.tactics.pressing - 1]}</b></div>
            </div>
          </Card>
          <Card title="Hasil Terakhir" icon="▲">
            {recent.length === 0 && <p className="text-sm text-slate-500">Belum ada pertandingan musim ini.</p>}
            {recent.map((f, i) => {
              const h = state.league.find((c) => c.id === f.home)!, a = state.league.find((c) => c.id === f.away)!;
              const ug = f.home === 'user' ? f.hg! : f.ag!, og = f.home === 'user' ? f.ag! : f.hg!;
              return (
                <div key={i} className="flex items-center gap-2 py-1 text-xs">
                  <span className={cn('flex h-5 w-5 items-center justify-center rounded font-black', ug > og ? 'bg-emerald-500 text-emerald-950' : ug === og ? 'bg-slate-500' : 'bg-rose-500')}>{ug > og ? 'M' : ug === og ? 'S' : 'K'}</span>
                  <span className="flex-1 truncate">{h.short} {f.hg}-{f.ag} {a.short}</span>
                </div>
              );
            })}
          </Card>
        </div>
      </div>
      <LeagueTable />
    </div>
  );
}

export function LeagueTable({ leagueId }: { leagueId?: string } = {}) {
  const { state } = useGame();
  const w = state.world;
  const foreign = !!leagueId && !!w && leagueId !== w.leagueId;
  const table = sortTable(foreign ? (w!.tables[leagueId!] ?? []) : state.table);
  const title = foreign ? (LEAGUE_BY_ID.get(leagueId!)?.name ?? leagueId) : leagueNameOf(state);
  const clubOf = (id: string): LeagueClub => (foreign ? findClub(state, id) : state.league.find((x) => x.id === id) ?? findClub(state, id));
  return (
    <Card title={`Klasemen ${title}`} icon="■">
      <div className="-mx-4 -my-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead><tr className="text-[10px] uppercase tracking-wider text-slate-500">{['#', 'Klub', 'Main', 'M', 'S', 'K', 'GM', 'GK', 'SG', 'Poin'].map((h) => <th key={h} className="px-2 py-2 text-left first:pl-4">{h}</th>)}</tr></thead>
          <tbody>
            {table.map((r, i) => {
              const c = clubOf(r.clubId);
              return (
                <tr key={r.clubId} className={cn('border-t border-white/5', c.isUser && 'bg-[var(--accent)]/10 font-bold')}>
                  <td className="py-1.5 pl-4 pr-2 text-slate-400">{i + 1}</td>
                  <td className="px-2"><span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-white/30" style={{ background: c.isUser ? state.club.primary : c.primary }} />{c.isUser ? state.club.name : c.name}</span></td>
                  <td className="px-2">{r.p}</td><td className="px-2">{r.w}</td><td className="px-2">{r.d}</td><td className="px-2">{r.l}</td>
                  <td className="px-2">{r.gf}</td><td className="px-2">{r.ga}</td><td className="px-2">{r.gf - r.ga}</td>
                  <td className="px-2 font-black text-white">{r.pts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function LiveTactics({ sim }: { sim: MatchSim }) {
  const { toast } = useGame();
  const [draft, setDraft] = useState<Tactics>(sim.teams[0].tactics);
  const apply = (t: Tactics, msg?: string) => {
    setTactics(sim, t);
    setDraft(t);
    toast(msg ?? 'Instruksi taktik diterapkan', 'info');
  };
  const cur = sim.teams[0].tactics;
  const dirty = JSON.stringify(cur) !== JSON.stringify(draft);
  return (
    <Card title="Instruksi Pinggir Lapangan" icon="📋">
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-1.5">
          <button disabled={sim.finished} onClick={() => apply({ ...cur, mentality: 5, tempo: 5, pressing: 4 }, '📣 Serang habis-habisan!')} className="rounded-lg bg-rose-500/15 px-2 py-2 text-[11px] font-bold text-rose-200 hover:bg-rose-500/25">🔥 All-Out Attack</button>
          <button disabled={sim.finished} onClick={() => apply({ ...cur, mentality: 1, tempo: 2, pressing: 2 }, '📣 Parkir bus! Amankan hasil.')} className="rounded-lg bg-sky-500/15 px-2 py-2 text-[11px] font-bold text-sky-200 hover:bg-sky-500/25">🚌 Parkir Bus</button>
          <button disabled={sim.finished} onClick={() => apply({ ...cur, pressing: 5 }, '📣 Tekan tinggi, rebut bola!')} className="rounded-lg bg-amber-500/15 px-2 py-2 text-[11px] font-bold text-amber-200 hover:bg-amber-500/25">⚡ High Press</button>
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Preset Taktik</div>
          <div className="grid grid-cols-2 gap-1.5">
            {TACTIC_PRESETS.map((pr) => (
              <button key={pr.id} disabled={sim.finished} title={pr.desc} onClick={() => apply({ ...pr.tactics }, `${pr.icon} Taktik ${pr.name} diterapkan`)}
                className={cn('rounded-lg border px-2 py-1.5 text-left text-[11px] font-bold transition disabled:opacity-40',
                  presetMatches(pr, cur) ? 'border-[var(--accent)] bg-[var(--accent)]/15 text-white' : 'border-white/10 bg-black/20 text-slate-300 hover:border-white/25')}>
                {pr.icon} {pr.name}
              </button>
            ))}
          </div>
        </div>
        <Segmented options={FORMATION_LIST} value={draft.formation} onChange={(f) => setDraft({ ...draft, formation: f })} />
        <Scale label="Mentalitas" value={draft.mentality} labels={MENTALITY_LABELS} onChange={(v) => setDraft({ ...draft, mentality: v })} />
        <Scale label="Tempo" value={draft.tempo} labels={TEMPO_LABELS} onChange={(v) => setDraft({ ...draft, tempo: v })} />
        <Scale label="Pressing" value={draft.pressing} labels={PRESSING_LABELS} onChange={(v) => setDraft({ ...draft, pressing: v })} />
        <Button className="w-full" disabled={!dirty || sim.finished} onClick={() => apply(draft)}>Terapkan Instruksi</Button>
      </div>
    </Card>
  );
}

function SubPanel({ sim, sel, selTeam, onSelect }: { sim: MatchSim; sel?: SimPlayer; selTeam: 0 | 1; onSelect: (id: string) => void }) {
  const { toast, state, mutate } = useGame();
  const autoSub = state.autoSub ?? true;
  const thr = state.autoSubThreshold ?? 60;
  const t = sim.teams[0];
  const isUser = selTeam === 0;
  const doSub = (benchId: string) => {
    if (!sel) return;
    const idx = t.onPitch.findIndex((p) => p.id === sel.id);
    if (substitute(sim, 0, idx, benchId)) { toast('Pergantian pemain dilakukan 🔁'); onSelect(benchId); }
  };
  const tired = t.onPitch.filter((p) => p.fitness < 60 || p.injured || p.rating < 6);
  return (
    <Card title="Kondisi & Pergantian" icon="🔁" action={<span className="text-xs font-bold text-slate-400">Sisa: <span className="text-[var(--accent)]">{5 - t.subsUsed}/5</span></span>}>
      <div className="mb-3 rounded-xl border border-white/10 bg-black/20 p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white">🔁 Pergantian Otomatis</span>
          <button onClick={() => { const v = !autoSub; sim.autoSub = v; mutate((s) => { s.autoSub = v; }); toast(v ? 'Pergantian otomatis aktif' : 'Pergantian otomatis nonaktif', 'info'); }}
            className={cn('relative h-6 w-11 rounded-full transition', autoSub ? 'bg-[var(--accent)]' : 'bg-white/15')}>
            <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all', autoSub ? 'left-[22px]' : 'left-0.5')} />
          </button>
        </div>
        {autoSub && (
          <div className="mt-2 flex items-center gap-1">
            <span className="text-[10px] text-slate-500">Ganti saat fitness &lt;</span>
            {[50, 60, 70].map((v) => (
              <button key={v} onClick={() => { sim.autoSubThreshold = v; mutate((s) => { s.autoSubThreshold = v; }); }}
                className={cn('rounded px-2 py-0.5 text-[11px] font-bold', thr === v ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'bg-white/5 text-slate-400 hover:bg-white/10')}>{v}</button>
            ))}
          </div>
        )}
      </div>
      {!sel ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-400">Klik pemain di lapangan untuk melihat fitness & performanya.</p>
          {tired.length > 0 && (
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-amber-400">Perlu perhatian</div>
              {tired.slice(0, 5).map((p) => (
                <button key={p.id} onClick={() => onSelect(p.id)} className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-xs hover:bg-white/5">
                  <span className="w-8 font-bold text-slate-500">{p.role}</span>
                  <span className="flex-1 truncate">{p.name} {p.injured && '🚑'}</span>
                  <div className="w-12"><Bar value={p.fitness} /></div>
                  <RatingBadge r={p.rating} />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 text-sm font-black" style={{ background: sim.teams[selTeam].kit, color: sim.teams[selTeam].kitText }}>{sel.num}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold text-white">{sel.name} {sel.injured && <span className="text-rose-400">🚑 Cedera</span>}</div>
              <div className="text-xs text-slate-400">{sim.teams[selTeam].short} · {sel.role} (asli {sel.natPos}) · OVR {sel.ovr}</div>
            </div>
            <div className="text-center"><RatingBadge r={sel.rating} className="h-7 text-sm" /><div className="text-[9px] text-slate-500">rating</div></div>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs"><span className="text-slate-400">Fitness</span><b className={sel.fitness < 55 ? 'text-rose-400' : ''}>{Math.round(sel.fitness)}%</b></div>
            <Bar value={sel.fitness} className="h-2" />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Form sebelum laga</span><FormChips form={sel.form} />
          </div>
          <div className="flex gap-3 text-xs text-slate-400"><span>⚽ {sel.goals}</span><span>🅰️ {sel.assists}</span><span>🎯 {sel.shots} tembakan</span>{sel.role === 'GK' && <span>🧤 {sel.saves}</span>}{sel.yellow > 0 && <span>🟨</span>}</div>
          {isUser && !sim.finished && (
            <div>
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Bangku cadangan</div>
              {t.subsUsed >= 5 && <p className="text-xs text-rose-300">Kuota pergantian habis.</p>}
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {t.bench.length === 0 && <p className="text-xs text-slate-500">Tidak ada pemain cadangan.</p>}
                {[...t.bench].sort((a, b) => Number(POS_GROUP[b.natPos] === POS_GROUP[sel.role]) - Number(POS_GROUP[a.natPos] === POS_GROUP[sel.role])).map((b) => (
                  <div key={b.id} className="flex items-center gap-2 rounded-lg bg-black/20 px-2 py-1">
                    <PosBadge pos={b.natPos} />
                    <span className="flex-1 truncate text-xs font-semibold">{b.name}</span>
                    <div className="w-10"><Bar value={b.fitness} /></div>
                    <OvrBadge v={b.ovr} size="sm" />
                    <Button size="sm" disabled={t.subsUsed >= 5} onClick={() => doSub(b.id)}>Masuk</Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!isUser && <p className="text-xs text-slate-500">Pemain lawan — hanya info.</p>}
        </div>
      )}
    </Card>
  );
}

function PostMatch({ sim, onDone }: { sim: MatchSim; onDone: () => void }) {
  const [open, setOpen] = useState(true);
  const u = sim.teams[0];
  const win = sim.score[0] > sim.score[1], draw = sim.score[0] === sim.score[1];
  const players = [...u.onPitch, ...u.subbedOff].sort((a, b) => b.rating - a.rating);
  const all = [...players, ...sim.teams[1].onPitch, ...sim.teams[1].subbedOff];
  const motm = all.reduce((a, b) => (b.rating > a.rating ? b : a));
  const coins = (win ? 120 : draw ? 70 : 40) + sim.score[0] * 5;
  return (
    <Modal open={open} onClose={() => setOpen(false)} className="max-w-xl">
      <div className={cn('p-6 text-center', win ? 'bg-gradient-to-b from-emerald-600/30' : draw ? 'bg-gradient-to-b from-slate-600/30' : 'bg-gradient-to-b from-rose-600/30')}>
        <div className="text-xs font-black uppercase tracking-[0.3em] text-slate-300">Full Time</div>
        <div className="mt-1 text-4xl font-black text-white">{win ? 'KEMENANGAN!' : draw ? 'IMBANG' : 'KEKALAHAN'}</div>
        <div className="mt-2 text-lg font-bold text-slate-200">{u.name} {sim.score[0]} - {sim.score[1]} {sim.teams[1].name}</div>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-black/40 px-3 py-1 text-xs">⭐ Man of the Match: <b className="text-white">{motm.name}</b> <RatingBadge r={motm.rating} /></div>
        <div className="mt-2 text-xs text-amber-300">Hadiah: +{coins} Coin{win ? ' · bonus budget +€0.6M' : draw ? ' · bonus budget +€250K' : ''}</div>
      </div>
      <div className="max-h-[40vh] overflow-y-auto px-5 py-3">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Rating Pemain (skala 1-10)</div>
        {players.map((p) => (
          <div key={p.id} className="flex items-center gap-2 border-b border-white/5 py-1.5 text-sm">
            <span className="w-9 text-[10px] font-bold text-slate-500">{p.role}</span>
            <span className="flex-1 truncate">{p.name} {p.goals > 0 && '⚽'.repeat(p.goals)} {p.assists > 0 && '🅰️'.repeat(p.assists)} {p.injured && '🚑'}</span>
            <span className="text-[10px] text-slate-500">FIT {Math.round(p.fitness)}</span>
            <RatingBadge r={p.rating} />
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-t border-white/10 p-4">
        <Button variant="ghost" className="flex-1" onClick={() => setOpen(false)}>Lihat Lapangan</Button>
        <Button className="flex-1" onClick={onDone}>Simpan Hasil & Lanjut</Button>
      </div>
    </Modal>
  );
}

