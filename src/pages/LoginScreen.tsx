import { useState } from 'react';
import { ACC_KEY, autoKey, loadAuto } from '@/game/store';
import { newGame } from '@/game/initial';

interface Acc { name: string; createdAt: number }

export function readAccounts(): Acc[] {
  try { return JSON.parse(localStorage.getItem(ACC_KEY) || '[]'); } catch { return []; }
}

export function LoginScreen({ onLogin }: { onLogin: (name: string) => void }) {
  const [accounts, setAccounts] = useState<Acc[]>(readAccounts);
  const [name, setName] = useState('');
  const [club, setClub] = useState('Garuda Raya FC');
  const [err, setErr] = useState('');

  const create = () => {
    const n = name.trim();
    if (n.length < 3) return setErr('Nama manajer minimal 3 karakter');
    if (accounts.some((a) => a.name.toLowerCase() === n.toLowerCase())) return setErr('Akun sudah ada, pilih dari daftar');
    const list = [...accounts, { name: n, createdAt: Date.now() }];
    localStorage.setItem(ACC_KEY, JSON.stringify(list));
    localStorage.setItem(autoKey(n), JSON.stringify(newGame(n, club.trim() || 'Garuda Raya FC')));
    setAccounts(list);
    onLogin(n);
  };

  const remove = (n: string) => {
    if (!confirm(`Hapus akun "${n}" beserta seluruh progresnya?`)) return;
    const list = accounts.filter((a) => a.name !== n);
    localStorage.setItem(ACC_KEY, JSON.stringify(list));
    Object.keys(localStorage).filter((k) => k === autoKey(n) || k.startsWith(`fmco:slot:${n}:`)).forEach((k) => localStorage.removeItem(k));
    setAccounts(list);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070b14] p-4 text-slate-200">
      <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]" viewBox="0 0 105 68" preserveAspectRatio="xMidYMid slice">
        <g fill="none" stroke="#10b981" strokeWidth="0.3">
          <rect x="2" y="2" width="101" height="64" /><line x1="52.5" y1="2" x2="52.5" y2="66" /><circle cx="52.5" cy="34" r="9" />
          <rect x="2" y="15" width="16" height="38" /><rect x="87" y="15" width="16" height="38" />
        </g>
      </svg>
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[60rem] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="relative w-full max-w-4xl">
        <div className="mb-8 text-center">
          <div className="text-xs font-black uppercase tracking-[0.5em] text-emerald-400">Football Manager</div>
          <h1 className="mt-2 text-5xl font-black tracking-tight text-white sm:text-6xl">Career <span className="rounded-xl bg-emerald-500 px-3 text-emerald-950">ON</span></h1>
          <p className="mt-3 text-slate-400">Bangun dinasti klubmu. Atur taktik, latih pemain, menangi bursa transfer.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 backdrop-blur">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-300">Lanjutkan Karier</h2>
            {accounts.length === 0 && <p className="rounded-xl bg-black/30 p-4 text-sm text-slate-500">Belum ada akun di perangkat ini. Buat akun manajer baru untuk memulai.</p>}
            <div className="space-y-2">
              {accounts.map((a) => {
                const s = loadAuto(a.name);
                return (
                  <div key={a.name} className="group flex items-center gap-3 rounded-xl border border-white/5 bg-black/30 p-3 transition hover:border-emerald-500/40">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-black text-white" style={{ background: s?.club.primary ?? '#334155' }}>
                      {a.name[0].toUpperCase()}
                    </div>
                    <button onClick={() => onLogin(a.name)} className="min-w-0 flex-1 text-left">
                      <div className="font-bold text-white">{a.name}</div>
                      <div className="truncate text-xs text-slate-500">{s ? `${s.club.name} · Musim ${s.season} Pekan ${s.week + 1}` : 'Karier baru'}</div>
                    </button>
                    <button onClick={() => onLogin(a.name)} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-emerald-950 hover:bg-emerald-400">Main</button>
                    <button onClick={() => remove(a.name)} className="text-slate-600 hover:text-rose-400" title="Hapus akun">✕</button>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 backdrop-blur">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-300">Akun Manajer Baru</h2>
            <label className="mb-1 block text-xs font-semibold text-slate-400">Nama Manajer</label>
            <input value={name} onChange={(e) => { setName(e.target.value); setErr(''); }} placeholder="cth. Coach Andra" maxLength={20}
              className="mb-3 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 outline-none focus:border-emerald-500" />
            <label className="mb-1 block text-xs font-semibold text-slate-400">Nama Klub (bisa diubah nanti)</label>
            <input value={club} onChange={(e) => setClub(e.target.value)} maxLength={28}
              className="mb-3 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 outline-none focus:border-emerald-500" />
            {err && <p className="mb-3 text-sm text-rose-400">{err}</p>}
            <button onClick={create} className="w-full rounded-lg bg-emerald-500 py-3 font-black text-emerald-950 transition hover:bg-emerald-400">Mulai Karier ⚽</button>
            <p className="mt-3 text-xs text-slate-500">Progres tersimpan otomatis di perangkat ini (localStorage) per akun.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
