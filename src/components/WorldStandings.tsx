import { useState } from 'react';
import { useGame } from '@/game/store';
import { Card, Segmented } from '@/components/ui';
import { LeagueTable } from '@/pages/MatchPage';
import { CLUB_BY_ID, CONTINENTS, LEAGUE_BY_ID, NATION_BY_ID, leaguesOfNation, nationsOfContinent, type Continent } from '@/game/world/db';
import { sortTable } from '@/game/league';
import { ROUND_LABEL } from '@/game/world/competitions';
import { cn } from '@/utils/cn';

/** World → Continent → Country → League standings browser + continental competitions. */
export function WorldStandings() {
  const { state } = useGame();
  const w = state.world;
  const myNation = w?.nationId ? NATION_BY_ID.get(w.nationId) : undefined;
  const [tab, setTab] = useState<'league' | 'cups'>('league');
  const [continent, setContinent] = useState<Continent>(myNation?.continent ?? 'Eropa');
  const [nationId, setNationId] = useState<string>(myNation?.id ?? 'ENG');
  const [leagueId, setLeagueId] = useState<string>(w && w.leagueId !== 'legacy' ? w.leagueId : 'eng1');
  const nations = nationsOfContinent(continent);
  const leagues = leaguesOfNation(nationId);
  const nm = (id: string) => (id === w?.clubId ? state.club.name : CLUB_BY_ID.get(id)?.name ?? id);

  return (
    <div className="space-y-3">
      <Segmented options={['league', 'cups'] as ('league' | 'cups')[]} labels={['🌍 Liga Dunia', '🏆 Kompetisi Antarklub']} value={tab} onChange={setTab} />
      {tab === 'league' && (
        <>
          <div className="flex flex-wrap gap-1">
            {CONTINENTS.map((c) => <button key={c} onClick={() => { setContinent(c); const n = nationsOfContinent(c)[0]; setNationId(n.id); setLeagueId(leaguesOfNation(n.id)[0].id); }} className={cn('rounded px-2 py-1 text-[11px] font-bold', continent === c ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'bg-white/5 text-slate-400 hover:bg-white/10')}>{c}</button>)}
          </div>
          <div className="flex flex-wrap gap-1">
            {nations.map((n) => <button key={n.id} onClick={() => { setNationId(n.id); setLeagueId(leaguesOfNation(n.id)[0].id); }} className={cn('rounded px-2 py-1 text-[11px] font-semibold', nationId === n.id ? 'bg-white/15 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10')}>{n.flag} {n.name}</button>)}
          </div>
          <div className="flex flex-wrap gap-1">
            {leagues.map((l) => <button key={l.id} onClick={() => setLeagueId(l.id)} className={cn('rounded px-2 py-1 text-[11px] font-semibold', leagueId === l.id ? 'bg-white/15 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10')}>{l.name}</button>)}
          </div>
          <LeagueTable leagueId={leagueId} />
          {w && w.leagueId !== 'legacy' && leagueId !== w.leagueId && <p className="text-[11px] text-slate-500">Liga lain disimulasikan setiap pekan secara paralel dengan {w.leagueName}.</p>}
        </>
      )}
      {tab === 'cups' && w && (
        <div className="space-y-3">
          {w.comps.map((comp) => {
            const mine = comp.teams.includes(w.clubId);
            const ko = comp.fixtures.filter((f) => f.round);
            return (
              <Card key={comp.id} title={<span>{comp.name} {mine && <span className="ml-1 rounded bg-[var(--accent)] px-1.5 text-[10px] text-[var(--accent-text)]">KLUBMU</span>}</span>} icon="🏆"
                action={<span className="text-[11px] text-slate-500">{comp.stage === 'done' ? `Juara: ${nm(comp.champion!)}` : comp.stage === 'group' ? `Fase grup · MD ${comp.mdDone}/6` : 'Fase gugur'}</span>}>
                {comp.groups.length > 0 && comp.stage === 'group' && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {comp.groups.map((g, gi) => (
                      <div key={gi} className={cn('rounded-lg bg-black/20 p-2 text-[11px]', g.teams.includes(w.clubId) && 'ring-1 ring-[var(--accent)]')}>
                        <div className="mb-1 font-bold text-slate-400">Grup {String.fromCharCode(65 + gi)}</div>
                        {sortTable(g.table).map((r, i) => (
                          <div key={r.clubId} className={cn('flex justify-between py-0.5', r.clubId === w.clubId && 'font-bold text-white', i < 2 && 'text-emerald-300')}>
                            <span className="truncate">{i + 1}. {nm(r.clubId)}</span><span className="tabular-nums">{r.p} · {r.gf - r.ga > 0 ? '+' : ''}{r.gf - r.ga} · <b>{r.pts}</b></span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                {ko.length > 0 && (
                  <div className="mt-2 space-y-1 text-[11px]">
                    {['R32', 'R16', 'QF', 'SF', 'F'].filter((r) => ko.some((f) => f.round === r)).map((r) => (
                      <div key={r}>
                        <div className="font-bold text-slate-400">{ROUND_LABEL[r]}</div>
                        {ko.filter((f) => f.round === r).map((f, i) => (
                          <div key={i} className={cn('flex justify-between py-0.5', (f.home === w.clubId || f.away === w.clubId) && 'font-bold text-white')}>
                            <span className="truncate">{nm(f.home)} vs {nm(f.away)}</span>
                            <span className="tabular-nums">{f.hg !== undefined ? `${f.hg}-${f.ag}${f.winner ? ` → ${nm(f.winner).split(' ')[0]}` : ''}` : 'vs'}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
          {w.honours.length > 0 && (
            <Card title="Lemari Trofi" icon="🥇">
              {w.honours.map((h, i) => <div key={i} className="text-sm">🏆 {h.title} <span className="text-slate-500">· Musim {h.season}</span></div>)}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export const leagueLabel = (id: string) => LEAGUE_BY_ID.get(id)?.name ?? id;
