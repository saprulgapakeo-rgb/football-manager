import { useState } from 'react';
import { autoKey, loadAuto } from '@/game/store';
import { newGameWithClub } from '@/game/initial';
import {
  findAuthAccount, genSalt, hashPassword, readAuthAccounts,
  validatePassword, validateUsername, verifyPassword, writeAuthAccounts,
} from '@/game/auth';
import { ClubSelect } from './ClubSelect';
import type { StaffRole } from '@/game/types';

const inputCls = 'mb-3 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 outline-none focus:border-emerald-500';
const labelCls = 'mb-1 block text-xs font-semibold text-slate-400';

export function LoginScreen({ onLogin }: { onLogin: (name: string) => void }) {
  const [accounts, setAccounts] = useState(readAuthAccounts);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [regUser, setRegUser] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [regErr, setRegErr] = useState('');
  const [pendingUser, setPendingUser] = useState<string | null>(null);

  const refresh = () => setAccounts(readAuthAccounts());

  const enterOrSetup = (name: string) => {
    if (loadAuto(name)) onLogin(name);
    else setPendingUser(name);
  };

  const doLogin = () => {
    const list = readAuthAccounts();
    const acc = findAuthAccount(list, loginUser);
    if (!acc) return setLoginErr('Username tidak ditemukan. Silakan daftar dulu.');
    if (acc.passHash) {
      if (!verifyPassword(acc, loginPass)) return setLoginErr('Password salah.');
    } else {
      // Akun lama (dibuat sebelum ada password): klaim dengan mengatur password.
      const pwErr = validatePassword(loginPass);
      if (pwErr) return setLoginErr(`Akun lama belum punya password. ${pwErr} Masukkan password baru untuk mengamankan akun ini.`);
      acc.salt = genSalt();
      acc.passHash = hashPassword(loginPass, acc.salt);
      writeAuthAccounts(list);
      refresh();
    }
    enterOrSetup(acc.name);
  };

  const doRegister = () => {
    const name = regUser.trim();
    const uErr = validateUsername(name);
    if (uErr) return setRegErr(uErr);
    const pErr = validatePassword(regPass);
    if (pErr) return setRegErr(pErr);
    if (regPass !== regConfirm) return setRegErr('Konfirmasi password tidak cocok.');
    const list = readAuthAccounts();
    if (findAuthAccount(list, name)) return setRegErr('Username sudah dipakai. Pilih username lain.');
    list.push({ name, createdAt: Date.now(), salt: genSalt(), passHash: '' });
    const acc = list[list.length - 1];
    acc.passHash = hashPassword(regPass, acc.salt!);
    writeAuthAccounts(list);
    refresh();
    setPendingUser(name);
  };

  const remove = (n: string) => {
    if (!confirm(`Hapus akun "${n}" beserta seluruh progresnya?`)) return;
    writeAuthAccounts(readAuthAccounts().filter((a) => a.name !== n));
    Object.keys(localStorage).filter((k) => k === autoKey(n) || k.startsWith(`fmco:slot:${n}:`)).forEach((k) => localStorage.removeItem(k));
    refresh();
  };

  const confirmClub = (presetId: string, role: StaffRole) => {
    if (!pendingUser) return;
    localStorage.setItem(autoKey(pendingUser), JSON.stringify(newGameWithClub(pendingUser, presetId, role)));
    onLogin(pendingUser);
  };

  // Langkah 2 setelah daftar/login pertama: pilih peran & klub
  if (pendingUser) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-[#070b14] p-4 text-slate-200">
        <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[60rem] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative w-full max-w-4xl">
          <div className="mb-6 text-center">
            <div className="text-xs font-black uppercase tracking-[0.5em] text-emerald-400">Selamat datang, {pendingUser}</div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Pilih Peran & Klub</h1>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 backdrop-blur">
            <ClubSelect onConfirm={confirmClub} onBack={() => setPendingUser(null)} />
          </div>
        </div>
      </div>
    );
  }

  const legacyHint = (() => {
    const acc = findAuthAccount(accounts, loginUser);
    return !!acc && !acc.passHash;
  })();

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
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-300">Masuk</h2>
            <label className={labelCls}>Username</label>
            <input value={loginUser} onChange={(e) => { setLoginUser(e.target.value); setLoginErr(''); }} placeholder="username_kamu" maxLength={20}
              className={inputCls} onKeyDown={(e) => e.key === 'Enter' && doLogin()} />
            <label className={labelCls}>Password</label>
            <input type="password" value={loginPass} onChange={(e) => { setLoginPass(e.target.value); setLoginErr(''); }} placeholder="••••••"
              className={inputCls} onKeyDown={(e) => e.key === 'Enter' && doLogin()} />
            {legacyHint && <p className="mb-3 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-200">Akun lama belum punya password — password yang kamu masukkan akan menjadi password akun ini.</p>}
            {loginErr && <p className="mb-3 text-sm text-rose-400">{loginErr}</p>}
            <button onClick={doLogin} className="w-full rounded-lg bg-emerald-500 py-3 font-black text-emerald-950 transition hover:bg-emerald-400">Masuk ⚽</button>
            <h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-slate-500">Akun di perangkat ini</h3>
            {accounts.length === 0 && <p className="rounded-xl bg-black/30 p-4 text-sm text-slate-500">Belum ada akun. Daftar akun baru di samping.</p>}
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {accounts.map((a) => {
                const s = loadAuto(a.name);
                return (
                  <div key={a.name} className="group flex items-center gap-3 rounded-xl border border-white/5 bg-black/30 p-3 transition hover:border-emerald-500/40">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-black text-white" style={{ background: s?.club.primary ?? '#334155' }}>
                      {a.name[0].toUpperCase()}
                    </div>
                    <button onClick={() => { setLoginUser(a.name); setLoginErr(''); }} className="min-w-0 flex-1 text-left">
                      <div className="truncate font-bold text-white">{a.name}</div>
                      <div className="truncate text-xs text-slate-500">{s ? `${s.club.name} · Musim ${s.season} Pekan ${s.week + 1}` : 'Belum ada karier'}</div>
                    </button>
                    <button onClick={() => { setLoginUser(a.name); setLoginErr(''); }} className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-white/10">Isi</button>
                    <button onClick={() => remove(a.name)} className="text-slate-600 hover:text-rose-400" title="Hapus akun">✕</button>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 backdrop-blur">
            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-300">Daftar Akun Baru</h2>
            <label className={labelCls}>Username (3–20 karakter: huruf/angka/_)</label>
            <input value={regUser} onChange={(e) => { setRegUser(e.target.value); setRegErr(''); }} placeholder="cth. coach_andra" maxLength={20}
              className={inputCls} />
            <label className={labelCls}>Password (minimal 6 karakter)</label>
            <input type="password" value={regPass} onChange={(e) => { setRegPass(e.target.value); setRegErr(''); }} placeholder="••••••"
              className={inputCls} />
            <label className={labelCls}>Konfirmasi Password</label>
            <input type="password" value={regConfirm} onChange={(e) => { setRegConfirm(e.target.value); setRegErr(''); }} placeholder="••••••"
              className={inputCls} onKeyDown={(e) => e.key === 'Enter' && doRegister()} />
            {regErr && <p className="mb-3 text-sm text-rose-400">{regErr}</p>}
            <button onClick={doRegister} className="w-full rounded-lg bg-emerald-500 py-3 font-black text-emerald-950 transition hover:bg-emerald-400">Daftar & Pilih Klub ⚽</button>
            <p className="mt-3 text-xs text-slate-500">Setelah daftar, kamu akan memilih peran (Manajer/Pelatih) dan klub untuk memulai karier.</p>
          </div>
        </div>
        <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-relaxed text-slate-500">
          🔒 <b className="text-slate-400">Auth lokal:</b> akun & password ter-hash (SHA-256 + salt acak, tanpa plaintext) tersimpan hanya di localStorage perangkat ini, dan tiap akun punya save game terpisah dengan auto-save.
          Butuh sinkron antar perangkat? Gunakan layanan auth cloud seperti <b className="text-slate-400">Firebase Auth / Supabase</b>.
        </p>
      </div>
    </div>
  );
}
