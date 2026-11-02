import { useRef } from 'react';
import { useGame } from '@/game/store';
import { Button, Card, Segmented } from '@/components/ui';
import { ClubLogo, Jersey, PitchLines } from '@/components/ClubVisuals';
import type { ClubIdentity, JerseyPattern, LogoShape, LogoSymbol } from '@/game/types';
import { cn } from '@/utils/cn';
import { textOn } from '@/game/matchEngine';
import { LEAGUE_NAME } from '@/game/data';

const PALETTE = ['#10b981', '#22c55e', '#84cc16', '#facc15', '#f59e0b', '#f97316', '#ef4444', '#dc2626', '#be123c', '#ec4899', '#a855f7', '#7c3aed', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#0b1220', '#1e293b', '#64748b', '#ffffff', '#7c2d12'];
const SHAPES: LogoShape[] = ['shield', 'circle', 'hexagon', 'diamond', 'crest'];
const SHAPE_L = ['Perisai', 'Lingkaran', 'Heksagon', 'Berlian', 'Lambang'];
const SYMBOLS: LogoSymbol[] = ['eagle', 'star', 'ball', 'crown', 'bolt', 'castle', 'none'];
const SYMBOL_L = ['Elang', 'Bintang', 'Bola', 'Mahkota', 'Petir', 'Benteng', 'Tanpa'];
const PATTERNS: JerseyPattern[] = ['plain', 'stripes', 'hoops', 'sash', 'halves'];
const PATTERN_L = ['Polos', 'Garis Vertikal', 'Garis Horizontal', 'Selempang', 'Belah Dua'];

export function ClubPage() {
  const { state, mutate, toast } = useGame();
  const c = state.club;
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (fn: (c: ClubIdentity) => void) =>
    mutate((s) => {
      fn(s.club);
      const u = s.league.find((x) => x.isUser);
      if (u) { u.name = s.club.name; u.short = s.club.short; u.primary = s.club.primary; u.secondary = s.club.secondary; }
    });

  const onUpload = (f?: File) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return toast('File harus berupa gambar', 'err');
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas');
        const S = 160;
        cv.width = S; cv.height = S;
        const ctx = cv.getContext('2d')!;
        const r = Math.min(S / img.width, S / img.height);
        const w = img.width * r, h = img.height * r;
        ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
        const data = cv.toDataURL('image/png');
        set((cl) => { cl.logo = { ...cl.logo, type: 'img', img: data }; });
        toast('Logo klub diperbarui');
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(f);
  };

  const randomize = () => {
    const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    let p = pick(PALETTE), s2 = pick(PALETTE);
    while (s2 === p) s2 = pick(PALETTE);
    set((cl) => {
      cl.primary = p; cl.secondary = s2; cl.pattern = pick(PATTERNS);
      cl.logo = { type: 'gen', shape: pick(SHAPES), symbol: pick(SYMBOLS), showInitials: Math.random() > 0.3 };
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">Kustomisasi Klub</h1>
          <p className="text-sm text-slate-400">Identitas klub otomatis diterapkan di sidebar, lapangan, kartu pemain & warna aksen aplikasi.</p>
        </div>
        <Button variant="ghost" onClick={randomize}>🎲 Acak Identitas</Button>
      </div>

      {/* Hero preview */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 p-6 sm:p-8" style={{ background: `linear-gradient(120deg, ${c.primary} 0%, ${c.primary}cc 45%, ${c.secondary} 100%)` }}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.18),transparent_50%)]" />
        <div className="relative flex flex-wrap items-center gap-6">
          <ClubLogo club={c} size={120} className="drop-shadow-2xl" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-black uppercase tracking-[0.3em]" style={{ color: textOn(c.primary), opacity: 0.75 }}>{LEAGUE_NAME}</div>
            <div className="text-3xl font-black sm:text-5xl" style={{ color: textOn(c.primary) }}>{c.name}</div>
            <div className="mt-2 inline-block rounded-md px-2 py-0.5 text-sm font-black" style={{ background: c.secondary, color: textOn(c.secondary) }}>{c.short}</div>
          </div>
          <div className="flex gap-2">
            <Jersey primary={c.primary} secondary={c.secondary} pattern={c.pattern} number={10} name="Kapten" size={140} />
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Nama Klub" icon="✎">
          <label className="mb-1 block text-xs font-semibold text-slate-400">Nama lengkap</label>
          <input value={c.name} maxLength={28} onChange={(e) => set((cl) => { cl.name = e.target.value; })}
            className="mb-3 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 font-semibold outline-none focus:border-[var(--accent)]" />
          <label className="mb-1 block text-xs font-semibold text-slate-400">Singkatan (3 huruf)</label>
          <input value={c.short} maxLength={3} onChange={(e) => set((cl) => { cl.short = e.target.value.toUpperCase(); })}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 font-black uppercase tracking-widest outline-none focus:border-[var(--accent)]" />
          <p className="mt-3 text-[11px] text-slate-500">Perubahan langsung tersimpan & tampil di klasemen, berita, dan scoreboard.</p>
        </Card>

        <Card title="Logo Klub" icon="◈">
          <div className="mb-3 flex items-center gap-4">
            <div className="rounded-xl bg-black/30 p-3"><ClubLogo club={c} size={84} /></div>
            <div className="flex-1 space-y-2">
              <Button size="sm" variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>⬆ Upload Gambar</Button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(e.target.files?.[0])} />
              <Button size="sm" variant={c.logo.type === 'gen' ? 'primary' : 'ghost'} className="w-full" onClick={() => set((cl) => { cl.logo.type = 'gen'; })}>✦ Pakai Generator</Button>
            </div>
          </div>
          <div className={cn('space-y-3', c.logo.type === 'img' && 'pointer-events-none opacity-40')}>
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase text-slate-400">Bentuk</div>
              <div className="grid grid-cols-5 gap-1">
                {SHAPES.map((s, i) => (
                  <button key={s} title={SHAPE_L[i]} onClick={() => set((cl) => { cl.logo.shape = s; })} className={cn('rounded-lg p-1 transition', c.logo.shape === s ? 'bg-[var(--accent)]/25 ring-1 ring-[var(--accent)]' : 'bg-black/30 hover:bg-white/10')}>
                    <ClubLogo club={{ ...c, logo: { ...c.logo, type: 'gen', shape: s, symbol: 'none', showInitials: false } }} size={36} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 text-[11px] font-semibold uppercase text-slate-400">Simbol</div>
              <div className="grid grid-cols-7 gap-1">
                {SYMBOLS.map((s, i) => (
                  <button key={s} title={SYMBOL_L[i]} onClick={() => set((cl) => { cl.logo.symbol = s; })} className={cn('rounded-lg p-0.5 transition', c.logo.symbol === s ? 'bg-[var(--accent)]/25 ring-1 ring-[var(--accent)]' : 'bg-black/30 hover:bg-white/10')}>
                    <ClubLogo club={{ ...c, logo: { ...c.logo, type: 'gen', shape: 'circle', symbol: s, showInitials: false } }} size={30} />
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={c.logo.showInitials} onChange={(e) => set((cl) => { cl.logo.showInitials = e.target.checked; })} className="accent-[var(--accent)]" />
              Tampilkan singkatan klub
            </label>
          </div>
        </Card>

        <Card title="Warna Jersey" icon="◐">
          {(['primary', 'secondary'] as const).map((k) => (
            <div key={k} className="mb-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase text-slate-400">{k === 'primary' ? 'Warna Utama' : 'Warna Kedua'}</span>
                <label className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-slate-400">{c[k]}</span>
                  <input type="color" value={c[k]} onChange={(e) => set((cl) => { cl[k] = e.target.value; })} className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent" />
                </label>
              </div>
              <div className="grid grid-cols-11 gap-1">
                {PALETTE.map((col) => (
                  <button key={col} onClick={() => set((cl) => { cl[k] = col; })} className={cn('aspect-square rounded-md border border-white/20 transition hover:scale-110', c[k] === col && 'ring-2 ring-white ring-offset-1 ring-offset-slate-900')} style={{ background: col }} />
                ))}
              </div>
            </div>
          ))}
          <div className="mb-1.5 text-[11px] font-semibold uppercase text-slate-400">Motif</div>
          <Segmented options={PATTERNS} labels={PATTERN_L} value={c.pattern} onChange={(p) => set((cl) => { cl.pattern = p; })} />
          <button onClick={() => set((cl) => { const t = cl.primary; cl.primary = cl.secondary; cl.secondary = t; })} className="mt-3 w-full rounded-lg bg-white/5 py-2 text-xs font-semibold hover:bg-white/10">⇄ Tukar warna utama & kedua</button>
        </Card>
      </div>

      <Card title="Preview Konsistensi Identitas" icon="◎">
        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase text-slate-500">Jersey Kandang & Tandang</div>
            <div className="flex items-center justify-center gap-2 rounded-xl bg-black/30 p-4">
              <Jersey primary={c.primary} secondary={c.secondary} pattern={c.pattern} number={7} size={110} />
              <Jersey primary={c.secondary} secondary={c.primary} pattern={c.pattern} number={9} size={110} />
            </div>
          </div>
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase text-slate-500">Sidebar</div>
            <div className="rounded-2xl border border-white/10 p-4" style={{ background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})` }}>
              <div className="flex items-center gap-3">
                <ClubLogo club={c} size={52} />
                <div><div className="font-black text-white drop-shadow">{c.name}</div><div className="text-[11px] text-white/80">#1 {LEAGUE_NAME}</div></div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm">Tombol Aksen</Button>
              <Button size="sm" variant="outline">Outline</Button>
            </div>
          </div>
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase text-slate-500">Di Lapangan</div>
            <div className="overflow-hidden rounded-xl border border-white/10">
              <svg viewBox="0 0 105 68" className="block w-full">
                <PitchLines />
                {[[10, 50], [28, 20], [26, 42], [26, 58], [28, 80], [48, 30], [44, 50], [48, 70], [70, 22], [76, 50], [70, 78]].map(([x, y], i) => (
                  <g key={i} transform={`translate(${x * 1.05} ${y * 0.68})`}>
                    <circle r="2.2" fill={c.primary} stroke={c.secondary} strokeWidth="0.45" />
                    <text y="0.7" textAnchor="middle" fontSize="1.9" fontWeight="900" fill={textOn(c.primary)}>{i + 1}</text>
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
