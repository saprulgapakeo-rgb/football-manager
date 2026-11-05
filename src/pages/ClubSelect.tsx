import { useMemo, useState } from 'react';
import type { StaffRole } from '@/game/types';
import { fmtMoney, ovrOf, POS_GROUP } from '@/game/players';
import { cn } from '@/utils/cn';
import { CLUBS, CLUB_BY_ID, CONTINENTS, LEAGUES, LEAGUE_BY_ID, NATIONS, NATION_BY_ID, leaguesOfNation, nationsOfContinent, type Continent, type DbClub } from '@/game/world/db';
import { baseSquad, squadStrength } from '@/game/world/squads';
import { Jersey } from '@/components/ClubVisuals';
import { NATION_FLAGS } from '@/game/data';

const ROLES: { id: StaffRole; icon: string; desc: string }[] = [
  { id: 'Manajer', icon: '💼', desc: 'Pimpin klub: taktik, transfer & strategi jangka panjang.' },
  { id: 'Pelatih', icon: '📋', desc: 'Fokus lapangan: latih skuad dan menangkan tiap laga.' },
];

type StrengthF = 'all' | 'elite' | 'strong' | 'mid' | 'low';
const STRENGTH_F: { id: StrengthF; label: string; test: (s: number) => boolean }[] = [
  { id: 'all', label: 'Semua', test: () => true },
  { id: 'elite', label: 'Elit 80+', test: (s) => s >= 80 },
  { id: 'strong', label: 'Kuat 72-79', test: (s) => s >= 72 && s < 80 },
  { id: 'mid', label: 'Menengah 65-71', test: (s) => s >= 65 && s < 72 },
  { id: 'low', label: 'Bawah <65', test: (s) => s < 65 },
];

const tierLabel = (s: number) => (s >= 80 ? 'Elit' : s >= 72 ? 'Atas' : s >= 65 ? 'Menengah' : 'Bawah');
const tierCls = (s: number) => (s >= 80 ? 'bg-amber-500/20 text-amber-300' : s >= 72 ? 'bg-violet-500/20 text-violet-300' : s >= 65 ? 'bg-sky-500/20 text-sky-300' : 'bg-slate-500/20 text-slate-300');
const Stars = ({ n }: { n: number }) => <span className="text-amber-400" title={`Reputasi ${n}/5`}>{'★'.repeat(n)}<span className="text-slate-600">{'★'.repeat(5 - n)}</span></span>;

const CONT_ICON: Record<Continent, string> = { Eropa: '🇪🇺', Asia: '🌏', 'Amerika Selatan': '🌎', 'Amerika Utara': '🗽', Afrika: '🌍' };

export function ClubSelect({ onConfirm, onBack, initialRole = 'Manajer', initialClubId, confirmLabel = 'Mulai Karier ⚽' }: {
  onConfirm: (clubId: string, role: StaffRole) => void;
  onBack?: () => void;
  initialRole?: StaffRole;
  initialClubId?: string;
  confirmLabel?: string;
}) {
  const init = initialClubId ? CLUB_BY_ID.get(initialClubId) : undefined;
  const [role, setRole] = useState<StaffRole>(initialRole);
  const [continent, setContinent] = useState<Continent | null>(init ? NATION_BY_ID.get(init.nationId)!.continent : null);
  const [nationId, setNationId] = useState<string | null>(init?.nationId ?? null);
  const [leagueId, setLeagueId] = useState<string | null>(init?.leagueId ?? null);
  const [clubId, setClubId] = useState<string | null>(init?.id ?? null);
  const [q, setQ] = useState('');
  const [sf, setSf] = useState<StrengthF>('all');
  const [minRep, setMinRep] = useState(1);

  const club = clubId ? CLUB_BY_ID.get(clubId) : undefined;
  const nation = nationId ? NATION_BY_ID.get(nationId) : undefined;
  const league = leagueId ? LEAGUE_BY_ID.get(leagueId) : undefined;

  const searchHits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    return CLUBS.filter((c) => c.name.toLowerCase().includes(t) || c.short.toLowerCase() === t).slice(0, 12);
  }, [q]);

  const leagueClubs = useMemo(() => {
    if (!leagueId) return [];
    return CLUBS.filter((c) => c.leagueId === leagueId && STRENGTH_F.find((f) => f.id === sf)!.test(c.strength) && c.reputation >= minRep)
      .sort((a, b) => b.strength - a.strength);
  }, [leagueId, sf, minRep]);

  const squad = useMemo(() => (club ? baseSquad(club.id) : []), [club]);

  const goClub = (c: DbClub) => { setContinent(NATION_BY_ID.get(c.nationId)!.continent); setNationId(c.nationId); setLeagueId(c.leagueId); setClubId(c.id); setQ(''); };
  const counts = (pred: (c: DbClub) => boolean) => CLUBS.filter(pred).length;

  const crumbs: { label: string; onClick: () => void }[] = [
    { label: '🌍 Dunia', onClick: () => { setContinent(null); setNationId(null); setLeagueId(null); setClubId(null); } },
  ];
  if (continent) crumbs.push({ label: continent, onClick: () => { setNationId(null); setLeagueId(null); setClubId(null); } });
  if (nation) crumbs.push({ label: `${nation.flag} ${nation.name}`, onClick: () => { setLeagueId(null); setClubId(null); } });
  if (league) crumbs.push({ label: league.name, onClick: () => setClubId(null) });
  if (club) crumbs.push({ label: club.name, onClick: () => {} });

  return (
    <div>
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-300">1 · Pilih Peranmu</h2>
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {ROLES.map((r) => (
          <button key={r.id} onClick={() => setRole(r.id)}
            className={cn('flex items-center gap-3 rounded-xl border p-4 text-left transition',
              role === r.id ? 'border-emerald-500 bg-emerald-500/10' : 'border-white/10 bg-black/30 hover:border-white/25')}>
            <span className="text-3xl">{r.icon}</span>
            <span>
              <span className="block font-black text-white">{r.id}</span>
              <span className="block text-xs text-slate-400">{r.desc}</span>
            </span>
            {role === r.id && <span className="ml-auto text-emerald-400">✓</span>}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">2 · Pilih Klub <span className="ml-1 text-slate-500">· {CLUBS.length} klub · {LEAGUES.length} liga · {NATIONS.length} negara</span></h2>
        <div className="relative">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 Cari klub di seluruh dunia…"
            className="w-64 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none focus:border-emerald-500" />
          {searchHits.length > 0 && (
            <div className="absolute right-0 z-20 mt-1 w-80 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-2xl">
              {searchHits.map((c) => {
                const n = NATION_BY_ID.get(c.nationId)!;
                return (
                  <button key={c.id} onClick={() => goClub(c)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5">
                    <span className="h-3 w-3 rounded-full border border-white/30" style={{ background: c.primary }} />
                    <span className="flex-1 truncate font-semibold">{c.name}</span>
                    <span className="text-xs text-slate-500">{n.flag} {LEAGUE_BY_ID.get(c.leagueId)!.name}</span>
                    <span className="text-xs font-bold text-slate-300">{c.strength}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* breadcrumb */}
      <div className="mb-3 flex flex-wrap items-center gap-1 text-xs">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-slate-600">›</span>}
            <button onClick={c.onClick} className={cn('rounded px-1.5 py-0.5 font-semibold', i === crumbs.length - 1 ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:bg-white/5 hover:text-white')}>{c.label}</button>
          </span>
        ))}
      </div>

      {/* WORLD -> continents */}
      {!continent && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CONTINENTS.map((ct) => {
            const nations = nationsOfContinent(ct);
            return (
              <button key={ct} onClick={() => setContinent(ct)} className="rounded-xl border border-white/10 bg-black/30 p-4 text-left transition hover:border-emerald-500/50">
                <div className="text-3xl">{CONT_ICON[ct]}</div>
                <div className="mt-1 font-black text-white">{ct}</div>
                <div className="text-xs text-slate-400">{nations.length} negara · {counts((c) => nations.some((n) => n.id === c.nationId))} klub</div>
                <div className="mt-2 text-lg">{nations.map((n) => n.flag).join(' ')}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* CONTINENT -> nations */}
      {continent && !nation && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {nationsOfContinent(continent).map((n) => {
            const ls = leaguesOfNation(n.id);
            return (
              <button key={n.id} onClick={() => setNationId(n.id)} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-4 text-left transition hover:border-emerald-500/50">
                <span className="text-3xl">{n.flag}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-black text-white">{n.name}</span>
                  <span className="block text-xs text-slate-400">{ls.length} liga · {counts((c) => c.nationId === n.id)} klub · {n.confed}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* NATION -> leagues */}
      {nation && !league && (
        <div className="space-y-2">
          {leaguesOfNation(nation.id).map((l) => {
            const cs = CLUBS.filter((c) => c.leagueId === l.id);
            const top = [...cs].sort((a, b) => b.strength - a.strength).slice(0, 4);
            return (
              <button key={l.id} onClick={() => setLeagueId(l.id)} className="flex w-full items-center gap-4 rounded-xl border border-white/10 bg-black/30 p-4 text-left transition hover:border-emerald-500/50">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5 text-sm font-black text-slate-300">D{l.tier}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-black text-white">{l.name}</span>
                  <span className="block text-xs text-slate-400">{cs.length} klub · {(cs.length - 1) * 2} pekan · {l.rel ? `${l.rel} degradasi` : 'tanpa degradasi'}{l.tier > 1 ? ` · promosi ke ${LEAGUE_BY_ID.get(LEAGUES.find((x) => x.below === l.id)!.id)!.name}` : ''}</span>
                </span>
                <span className="hidden gap-1 sm:flex">{top.map((c) => <span key={c.id} className="h-4 w-4 rounded-full border border-white/30" title={c.name} style={{ background: c.primary }} />)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* LEAGUE -> clubs */}
      {league && !club && (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500">Kekuatan:</span>
            {STRENGTH_F.map((f) => <button key={f.id} onClick={() => setSf(f.id)} className={cn('rounded px-2 py-1 font-semibold', sf === f.id ? 'bg-emerald-500 text-emerald-950' : 'bg-white/5 text-slate-300 hover:bg-white/10')}>{f.label}</button>)}
            <span className="ml-2 text-slate-500">Reputasi:</span>
            {[1, 2, 3, 4, 5].map((r) => <button key={r} onClick={() => setMinRep(r)} className={cn('rounded px-2 py-1 font-semibold', minRep === r ? 'bg-emerald-500 text-emerald-950' : 'bg-white/5 text-slate-300 hover:bg-white/10')}>{r === 1 ? 'Semua' : `${r}★+`}</button>)}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {leagueClubs.map((c) => (
              <button key={c.id} onClick={() => setClubId(c.id)} className="overflow-hidden rounded-xl border border-white/10 bg-black/30 text-left transition hover:border-emerald-500/60">
                <div className="flex items-center gap-2.5 p-3" style={{ background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})` }}>
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/40 text-xs font-black text-white">{c.short}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-white drop-shadow">{c.name}</span>
                    <span className="block text-[11px] text-white/80 drop-shadow">{c.stadium}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 text-[11px]">
                  <span className={cn('rounded px-1.5 py-0.5 font-bold', tierCls(c.strength))}>{tierLabel(c.strength)}</span>
                  <Stars n={c.reputation} />
                  <span className="text-slate-400">💼 {fmtMoney(c.budget)}</span>
                  <span className="ml-auto font-bold text-slate-200">OVR {c.strength}</span>
                </div>
              </button>
            ))}
            {leagueClubs.length === 0 && <p className="col-span-full rounded-xl bg-black/30 p-4 text-sm text-slate-500">Tidak ada klub yang cocok dengan filter.</p>}
          </div>
        </div>
      )}

      {/* CLUB detail + squad */}
      {club && nation && league && (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <div className="flex flex-wrap items-center gap-5 p-5" style={{ background: `linear-gradient(120deg, ${club.primary}, ${club.secondary})` }}>
            <div className="flex gap-1">
              <Jersey primary={club.primary} secondary={club.secondary} pattern="stripes" number={10} size={90} />
              <Jersey primary={club.secondary} secondary={club.primary} pattern="plain" number={7} size={90} />
            </div>
            <div className="min-w-0 flex-1 rounded-xl bg-black/50 p-3 backdrop-blur">
              <div className="text-2xl font-black text-white">{club.name}</div>
              <div className="text-xs text-slate-300">{nation.flag} {nation.name} · {league.name} (Divisi {league.tier}) · {nation.confed}</div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-200 sm:grid-cols-3">
                <span>🏟️ {club.stadium}</span>
                <span>👥 {club.capacity.toLocaleString('id-ID')} kursi</span>
                <span>💼 Budget {fmtMoney(club.budget)}</span>
                <span>💪 Kekuatan <b>{club.strength}</b> · {tierLabel(club.strength)}</span>
                <span>Reputasi <Stars n={club.reputation} /></span>
                <span>🎽 Skuad {squad.length} pemain · XI {squadStrength(squad)}</span>
              </div>
            </div>
          </div>
          <div className="bg-black/30 p-4">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Skuad {club.name} (dihasilkan dari database, unik untuk klub ini)</div>
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              {[...squad].sort((a, b) => ovrOf(b) - ovrOf(a)).map((p) => (
                <div key={p.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1 text-xs">
                  <span className={cn('w-9 rounded text-center font-bold', POS_GROUP[p.pos] === 'GK' ? 'bg-amber-500/20 text-amber-300' : POS_GROUP[p.pos] === 'DEF' ? 'bg-sky-500/20 text-sky-300' : POS_GROUP[p.pos] === 'MID' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300')}>{p.pos}</span>
                  <span className="flex-1 truncate">{NATION_FLAGS[p.nation] ?? ''} {p.name}</span>
                  <span className="text-slate-500">{p.age}</span>
                  <span className="w-7 text-right font-black text-white">{ovrOf(p)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        {onBack && <button onClick={onBack} className="rounded-lg bg-white/5 px-4 py-3 font-bold text-slate-300 hover:bg-white/10 sm:w-40">← Kembali</button>}
        <button disabled={!club} onClick={() => club && onConfirm(club.id, role)}
          className="flex-1 rounded-lg bg-emerald-500 py-3 font-black text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40">
          {club ? `${confirmLabel} — ${club.name} (${role})` : 'Telusuri Dunia › Negara › Liga › Klub untuk memulai'}
        </button>
      </div>
    </div>
  );
}
