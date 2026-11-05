import { useMemo, useRef, useState } from 'react';
import { useGame } from '@/game/store';
import { Button, Card, Modal, OvrBadge, PosBadge, Segmented, Stat } from '@/components/ui';
import { NegotiationModal } from '@/components/Negotiation';
import { fmtMoney, ovrOf, POS_GROUP } from '@/game/players';
import { NATION_FLAGS } from '@/game/data';
import type { MarketPlayer, NewsType, StaffRole } from '@/game/types';
import { cn } from '@/utils/cn';
import { newGame, newGameWithClub, presetById } from '@/game/initial';
import { WorldStandings } from '@/components/WorldStandings';
import { CLUB_BY_ID } from '@/game/world/db';
import { ClubSelect } from './ClubSelect';

type Tab = 'transfer' | 'news' | 'save';

export function AccountPage() {
  const [tab, setTab] = useState<Tab>('transfer');
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">Akun, Transfer & Berita</h1>
          <p className="text-sm text-slate-400">Kelola dana, rekrut pemain baru, dan pantau kabar klub.</p>
        </div>
        <Segmented className="w-full sm:w-auto" options={['transfer', 'news', 'save'] as Tab[]} labels={['💼 Bursa Transfer', '📰 Berita Klub', '💾 Akun & Save']} value={tab} onChange={setTab} />
      </div>
      <Funds />
      {tab === 'transfer' && <TransferMarket />}
      {tab === 'news' && <NewsFeed />}
      {tab === 'save' && <SaveGame />}
    </div>
  );
}

function Funds() {
  const { state, coinTick } = useGame();
  const wages = state.squad.reduce((a, p) => a + p.wage, 0);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 to-slate-950 p-5">
        <div className="absolute -right-6 -top-6 flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600 text-5xl font-black text-amber-950 opacity-20">C</div>
        <div className="text-xs font-bold uppercase tracking-widest text-amber-300">Coin Pribadi</div>
        <div className="mt-1 text-4xl font-black tabular-nums text-white">{state.coins.toLocaleString('id-ID')}</div>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-amber-100/80">
          <span className="rounded bg-black/30 px-2 py-0.5">+1 setiap 30 detik · berikutnya {coinTick}d</span>
          <span className="rounded bg-black/30 px-2 py-0.5">Menang +120 · Seri +70 · Kalah +40</span>
          <span className="rounded bg-black/30 px-2 py-0.5">Login harian +100</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-400">Digunakan untuk sesi latihan khusus (upgrade pemain individu).</div>
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-slate-950 p-5">
        <div className="absolute -right-4 -top-4 text-8xl opacity-10">💼</div>
        <div className="text-xs font-bold uppercase tracking-widest text-emerald-300">Transfer Budget (Manajemen)</div>
        <div className="mt-1 text-4xl font-black tabular-nums text-white">{fmtMoney(state.transferBudget)}</div>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-emerald-100/80">
          <span className="rounded bg-black/30 px-2 py-0.5">Bonus menang +€0.6M</span>
          <span className="rounded bg-black/30 px-2 py-0.5">Hadiah akhir musim</span>
          <span className="rounded bg-black/30 px-2 py-0.5">Hasil penjualan pemain</span>
        </div>
        <div className="mt-2 text-[11px] text-slate-400">Khusus untuk membeli pemain. Total gaji skuad: €{wages.toLocaleString('id-ID')}K/minggu.</div>
      </div>
    </div>
  );
}

function TransferMarket() {
  const { state } = useGame();
  const [filter, setFilter] = useState<'ALL' | 'GK' | 'DEF' | 'MID' | 'ATT'>('ALL');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'ovr' | 'price' | 'pot' | 'age'>('ovr');
  const [neg, setNeg] = useState<MarketPlayer | null>(null);
  const list = useMemo(() => {
    const l = state.market.filter((m) => (filter === 'ALL' || POS_GROUP[m.pos] === filter) && (m.name + m.club).toLowerCase().includes(q.toLowerCase()));
    const f = { ovr: (a: MarketPlayer, b: MarketPlayer) => ovrOf(b) - ovrOf(a), price: (a: MarketPlayer, b: MarketPlayer) => a.askingPrice - b.askingPrice, pot: (a: MarketPlayer, b: MarketPlayer) => b.potential - a.potential, age: (a: MarketPlayer, b: MarketPlayer) => a.age - b.age };
    return [...l].sort(f[sort]);
  }, [state.market, filter, q, sort]);

  return (
    <Card title="Bursa Transfer" icon="⇄" action={<span className="text-[11px] text-slate-500">Diperbarui tiap 4 pekan</span>}>
      <div className="mb-3 flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari pemain / klub…" className="min-w-[180px] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
        <Segmented className="w-auto" options={['ALL', 'GK', 'DEF', 'MID', 'ATT'] as const as unknown as ('ALL' | 'GK' | 'DEF' | 'MID' | 'ATT')[]} labels={['Semua', 'GK', 'DEF', 'MID', 'ATT']} value={filter} onChange={setFilter} />
        <Segmented className="w-auto" options={['ovr', 'price', 'pot', 'age'] as const as unknown as ('ovr' | 'price' | 'pot' | 'age')[]} labels={['OVR', 'Harga', 'Potensi', 'Usia']} value={sort} onChange={setSort} />
      </div>
      <div className="-mx-4 -mb-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead><tr className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-500">{['Pos', 'Pemain', 'Usia', 'Klub Asal', 'OVR', 'POT', 'Harga Minta', ''].map((h) => <th key={h} className="px-2 py-2 text-left first:pl-4">{h}</th>)}</tr></thead>
          <tbody>
            {list.map((m) => {
              const o = ovrOf(m);
              const rej = m.status === 'rejected';
              return (
                <tr key={m.id} className={cn('border-b border-white/[0.03] hover:bg-white/[0.03]', rej && 'opacity-60')}>
                  <td className="py-2 pl-4 pr-2"><PosBadge pos={m.pos} /></td>
                  <td className="px-2 font-semibold">{NATION_FLAGS[m.nation]} {m.name}</td>
                  <td className="px-2 text-slate-400">{m.age}</td>
                  <td className="px-2 text-xs text-slate-400">{m.club}</td>
                  <td className="px-2"><OvrBadge v={o} size="sm" /></td>
                  <td className={cn('px-2 text-xs font-bold', m.potential - o >= 8 ? 'text-emerald-400' : 'text-slate-400')}>{m.potential}</td>
                  <td className={cn('px-2 font-bold', m.askingPrice > state.transferBudget ? 'text-rose-300' : 'text-white')}>{fmtMoney(m.askingPrice)}</td>
                  <td className="pr-4 text-right">
                    {rej ? <span className="rounded border border-rose-500/50 bg-rose-500/10 px-2 py-0.5 text-[10px] font-black tracking-wider text-rose-400">REJECTED</span>
                      : <Button size="sm" onClick={() => setNeg(m)}>Negosiasi</Button>}
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-slate-500">Tidak ada pemain yang cocok.</td></tr>}
          </tbody>
        </table>
      </div>
      {neg && <NegotiationModal mp={neg} onClose={() => setNeg(null)} />}
      {(state.world?.transfers.length ?? 0) > 0 && (
        <div className="mt-6 border-t border-white/5 pt-3">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Riwayat Transfer Dunia</div>
          <div className="max-h-56 space-y-1 overflow-y-auto text-xs">
            {state.world!.transfers.slice(0, 40).map((t, i) => (
              <div key={i} className={cn('flex items-center gap-2 rounded px-2 py-1', (t.to === state.club.name || t.from === state.club.name) ? 'bg-[var(--accent)]/10 text-white' : 'text-slate-400')}>
                <span className="w-8 font-bold text-slate-500">{t.pos}</span>
                <span className="flex-1 truncate"><b>{t.name}</b> · {t.from} → {t.to}</span>
                <span className="font-bold">{fmtMoney(t.fee)}</span>
                <span className="text-slate-600">M{t.season}·P{t.week}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

const NEWS_STYLE: Record<NewsType, { icon: string; label: string; cls: string }> = {
  match: { icon: '⚽', label: 'Pertandingan', cls: 'bg-sky-500/15 text-sky-300' },
  transfer: { icon: '✍️', label: 'Transfer', cls: 'bg-emerald-500/15 text-emerald-300' },
  training: { icon: '🏋️', label: 'Latihan', cls: 'bg-amber-500/15 text-amber-300' },
  club: { icon: '🏟️', label: 'Klub', cls: 'bg-violet-500/15 text-violet-300' },
  season: { icon: '🏆', label: 'Musim', cls: 'bg-yellow-500/15 text-yellow-300' },
};

function NewsFeed() {
  const { state } = useGame();
  const [f, setF] = useState<'all' | NewsType>('all');
  const items = state.news.filter((n) => f === 'all' || n.type === f);
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_440px]">
      <Card title="Berita Klub" icon="📰" action={<Segmented className="w-auto" options={['all', 'match', 'transfer', 'training', 'club', 'season'] as ('all' | NewsType)[]} labels={['Semua', 'Laga', 'Transfer', 'Latihan', 'Klub', 'Musim']} value={f} onChange={setF} />}>
        <div className="space-y-2">
          {items.length === 0 && <p className="text-sm text-slate-500">Belum ada berita.</p>}
          {items.map((n, i) => {
            const st = NEWS_STYLE[n.type];
            const big = i === 0 && f === 'all';
            return (
              <article key={n.id} className={cn('rounded-xl border border-white/5 bg-black/20 p-3.5 transition hover:border-white/10', big && 'border-[var(--accent)]/30 bg-[var(--accent)]/5 p-5', n.title.startsWith('DONE DEAL') && 'border-emerald-500/40')}>
                <div className="mb-1 flex items-center gap-2 text-[10px]">
                  <span className={cn('rounded px-1.5 py-0.5 font-bold', st.cls)}>{st.icon} {st.label}</span>
                  <span className="text-slate-500">Musim {n.season} · Pekan {n.week}</span>
                  <span className="ml-auto text-slate-600">{new Date(n.ts).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</span>
                </div>
                <h4 className={cn('font-bold text-white', big ? 'text-xl' : 'text-sm')}>{n.title}</h4>
                <p className="mt-0.5 text-sm text-slate-400">{n.body}</p>
              </article>
            );
          })}
        </div>
      </Card>
      <div><WorldStandings /></div>
    </div>
  );
}

function SaveGame() {
  const { state, slots, saveSlot, loadSlot, deleteSlot, lastAutosave, replaceState, toast, logout, matchRef } = useGame();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showClub, setShowClub] = useState(false);
  const exportSave = () => {
    const blob = new Blob([JSON.stringify(state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `career-on-${state.account}-S${state.season}W${state.week + 1}.json`;
    a.click();
    toast('File save diekspor');
  };
  const importSave = (f?: File) => {
    if (!f) return;
    f.text().then((t) => {
      try {
        const s = JSON.parse(t);
        if (!s.squad || !s.club) throw new Error();
        s.account = state.account;
        matchRef.current = null;
        replaceState(s);
        toast('Save berhasil diimpor');
      } catch { toast('File save tidak valid', 'err'); }
    });
  };
  const reset = () => {
    if (!confirm('Mulai karier baru? Progres autosave akan ditimpa (slot manual tetap aman).')) return;
    matchRef.current = null;
    const preset = presetById(state.clubPresetId);
    const restartId = preset?.id ?? (state.clubPresetId && CLUB_BY_ID.has(state.clubPresetId) ? state.clubPresetId : null);
    replaceState(restartId ? newGameWithClub(state.account, restartId, state.role ?? 'Manajer') : newGame(state.account, state.club.name));
    toast('Karier baru dimulai', 'info');
  };
  const changeClub = (presetId: string, role: StaffRole) => {
    if (!confirm('Ganti klub akan memulai karier baru dari awal (slot manual tetap aman). Lanjut?')) return;
    matchRef.current = null;
    replaceState(newGameWithClub(state.account, presetId, role));
    setShowClub(false);
    toast('Selamat datang di klub barumu!', 'info');
  };
  const avgRating = Math.round(state.squad.map(ovrOf).sort((a, b) => b - a).slice(0, 11).reduce((a, b) => a + b, 0) / 11);
  const totalGoals = state.squad.reduce((a, p) => a + p.goals, 0);

  return (
    <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
      <Card title="Profil Akun" icon="👤">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent)] text-2xl font-black text-[var(--accent-text)]">{state.account[0]?.toUpperCase()}</div>
          <div>
            <div className="text-lg font-black text-white">{state.account}</div>
            <div className="text-xs text-slate-400">{state.role ?? 'Manajer'} · {state.club.name}</div>
            {state.clubTier && <div className="text-[11px] text-slate-500">Tier {state.clubTier}{state.clubNation ? ` · ${state.clubNation}` : ''}{state.world ? ` · ${state.world.leagueName}` : ''}</div>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Musim" value={state.season} />
          <Stat label="Pekan" value={state.week + 1} />
          <Stat label="Rating Tim" value={avgRating} />
          <Stat label="Total Gol" value={totalGoals} />
        </div>
        <div className="mt-4 rounded-lg bg-black/30 p-3 text-xs text-slate-400">
          <div className="flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Autosave aktif (localStorage perangkat ini)</div>
          <div className="mt-1">Terakhir: {lastAutosave ? new Date(lastAutosave).toLocaleTimeString('id-ID') : '—'}</div>
          <div className="mt-1">🔒 Auth lokal per akun. Butuh sinkron antar perangkat? Firebase Auth / Supabase.</div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="ghost" size="sm" onClick={logout}>Logout</Button>
          <Button variant="danger" size="sm" onClick={reset}>Karier Baru</Button>
        </div>
        <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => setShowClub(true)}>🔄 Ganti Klub</Button>
      </Card>
      <Modal open={showClub} onClose={() => setShowClub(false)} className="max-w-4xl" title="Ganti Klub & Peran">
        <div className="p-5">
          <ClubSelect onConfirm={changeClub} initialRole={state.role ?? 'Manajer'} initialClubId={state.clubPresetId} confirmLabel="Pindah Klub ⚽" />
        </div>
      </Modal>

      <div className="space-y-5">
        <Card title="Slot Save Manual" icon="💾">
          <div className="grid gap-3 md:grid-cols-3">
            {slots.map((s, i) => (
              <div key={i} className={cn('rounded-xl border p-4', s ? 'border-[var(--accent)]/30 bg-[var(--accent)]/5' : 'border-dashed border-white/10 bg-black/20')}>
                <div className="mb-1 text-xs font-black uppercase tracking-wider text-slate-400">Slot {i + 1}</div>
                {s ? (
                  <>
                    <div className="text-sm font-bold text-white">{s.label}</div>
                    <div className="text-[11px] text-slate-500">{new Date(s.savedAt).toLocaleString('id-ID')}</div>
                  </>
                ) : <div className="text-sm text-slate-500">Kosong</div>}
                <div className="mt-3 flex gap-1.5">
                  <Button size="sm" className="flex-1" onClick={() => (s && !confirm(`Timpa Slot ${i + 1}?`) ? null : saveSlot(i + 1))}>Simpan</Button>
                  <Button size="sm" variant="ghost" className="flex-1" disabled={!s} onClick={() => confirm(`Muat Slot ${i + 1}? Progres saat ini akan diganti.`) && loadSlot(i + 1)}>Muat</Button>
                  <Button size="sm" variant="ghost" disabled={!s} onClick={() => deleteSlot(i + 1)}>🗑</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Backup Perangkat" icon="⇅">
          <p className="mb-3 text-sm text-slate-400">Ekspor progres ke file untuk dipindahkan ke perangkat lain, lalu impor kembali kapan saja.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportSave}>⬇ Ekspor Save (.json)</Button>
            <Button variant="ghost" onClick={() => fileRef.current?.click()}>⬆ Impor Save</Button>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => importSave(e.target.files?.[0])} />
          </div>
        </Card>
      </div>
    </div>
  );
}
