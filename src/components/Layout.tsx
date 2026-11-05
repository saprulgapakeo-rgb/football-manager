import type { ReactNode } from 'react';
import { useGame, type Page } from '@/game/store';
import { ClubLogo } from './ClubVisuals';
import { cn } from '@/utils/cn';
import { fmtMoney } from '@/game/players';
import { leagueNameOf } from '@/game/world/engine';
import { sortTable, totalRounds } from '@/game/league';

const NAV: { id: Page; label: string; sub: string; icon: ReactNode }[] = [
  { id: 'squad', label: 'Skuad', sub: 'Taktik & Latihan', icon: <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="7" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" /><circle cx="17.5" cy="8.5" r="2.5" /><path d="M16 13.7c3.2-.4 5.5 2 5.5 5.3" /></svg> },
  { id: 'match', label: 'Match Day', sub: 'Pertandingan', icon: <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M12 4v16" /><circle cx="12" cy="12" r="3" /><path d="M2 9h3v6H2M22 9h-3v6h3" /></svg> },
  { id: 'club', label: 'Klub', sub: 'Kustomisasi', icon: <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" /><path d="M9 11l2 2 4-4" /></svg> },
  { id: 'account', label: 'Akun', sub: 'Save, Transfer & Berita', icon: <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16v13H4z" /><path d="M8 7V4h8v3" /><path d="M4 12h16" /><path d="M10 12v2h4v-2" /></svg> },
];

export function Layout({ children }: { children: ReactNode }) {
  const { state, page, setPage, accent, logout, coinTick, matchRef } = useGame();
  const pos = sortTable(state.table).findIndex((r) => r.clubId === 'user') + 1;
  const live = matchRef.current && !matchRef.current.finished;
  return (
    <div className="min-h-screen bg-[#070b14] text-slate-200">
      <div className="pointer-events-none fixed inset-0 opacity-60" style={{ background: `radial-gradient(900px 500px at 85% -10%, ${accent}22, transparent 60%), radial-gradient(700px 400px at -10% 110%, ${accent}14, transparent 60%)` }} />
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-white/[0.06] bg-slate-950/80 backdrop-blur-xl lg:flex">
        <div className="px-5 pb-4 pt-5">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Football Manager</div>
          <div className="text-lg font-black tracking-tight text-white">Career <span className="rounded bg-[var(--accent)] px-1.5 text-[var(--accent-text)]">ON</span></div>
        </div>
        <div className="mx-4 mb-4 overflow-hidden rounded-2xl border border-white/10 p-4" style={{ background: `linear-gradient(135deg, ${state.club.primary}, ${state.club.secondary})` }}>
          <div className="flex items-center gap-3">
            <ClubLogo club={state.club} size={52} className="drop-shadow-lg" />
            <div className="min-w-0">
              <div className="truncate font-black text-white drop-shadow">{state.club.name}</div>
              <div className="text-[11px] font-semibold text-white/80 drop-shadow">#{pos} {leagueNameOf(state)}</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setPage(n.id)}
              className={cn('group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition',
                page === n.id ? 'bg-[var(--accent)]/15 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200')}>
              {page === n.id && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-[var(--accent)]" />}
              <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', page === n.id ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'bg-white/5')}>{n.icon}</span>
              <span>
                <span className="block text-sm font-bold">{n.label}</span>
                <span className="block text-[11px] text-slate-500">{n.sub}</span>
              </span>
              {n.id === 'match' && live && <span className="ml-auto rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-black text-white animate-pulse">LIVE</span>}
            </button>
          ))}
        </nav>
        <div className="space-y-2 border-t border-white/[0.06] p-4 text-xs">
          <div className="flex items-center justify-between text-slate-400"><span>Manajer</span><span className="font-bold text-slate-200">{state.account}</span></div>
          <button onClick={logout} className="w-full rounded-lg bg-white/5 py-2 font-semibold text-slate-300 hover:bg-white/10">Ganti Akun</button>
        </div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-slate-950/70 backdrop-blur-xl lg:ml-64">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-2 lg:hidden">
            <ClubLogo club={state.club} size={32} />
            <span className="font-black">{state.club.short}</span>
          </div>
          <div className="hidden text-sm text-slate-400 sm:block">
            Musim <b className="text-slate-200">{state.season}</b> · Pekan <b className="text-slate-200">{Math.min(state.week + 1, totalRounds(state.league))}/{totalRounds(state.league)}</b>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5" title={`Coin pribadi · +1 dalam ${coinTick}d (±2/menit) + hadiah laga`}>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600 text-[10px] font-black text-amber-950">C</span>
              <span className="font-black tabular-nums text-amber-200">{state.coins.toLocaleString('id-ID')}</span>
              <span className="hidden text-[10px] text-amber-400/70 sm:inline">+1 · {coinTick}d</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5" title="Transfer Budget dari manajemen">
              <span className="text-sm">💼</span>
              <span className="font-black tabular-nums text-emerald-200">{fmtMoney(state.transferBudget)}</span>
            </div>
          </div>
        </div>
        {/* mobile nav */}
        <nav className="flex border-t border-white/[0.06] lg:hidden">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setPage(n.id)} className={cn('flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold', page === n.id ? 'text-[var(--accent)]' : 'text-slate-500')}>
              {n.icon}{n.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="relative px-4 py-5 lg:ml-64 lg:px-6">{children}</main>
    </div>
  );
}
