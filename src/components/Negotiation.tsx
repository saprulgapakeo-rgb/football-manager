import { useState } from 'react';
import { useGame } from '@/game/store';
import type { MarketPlayer } from '@/game/types';
import { Button, Modal, OvrBadge, PosBadge } from './ui';
import { Jersey, ClubLogo } from './ClubVisuals';
import { fmtMoney, ovrOf, pick, POS_GROUP, rand } from '@/game/players';
import { NATION_FLAGS } from '@/game/data';
import { cn } from '@/utils/cn';

type Step = 'offer' | 'club-thinking' | 'club-ok' | 'wage' | 'player-thinking' | 'done' | 'rejected' | 'press';

export function NegotiationModal({ mp, onClose }: { mp: MarketPlayer; onClose: () => void }) {
  const { state, completeTransfer, rejectTransfer } = useGame();
  const [step, setStep] = useState<Step>('offer');
  const [fee, setFee] = useState(() => Math.round(mp.askingPrice * 0.95 * 10) / 10);
  const [demand] = useState(() => Math.max(mp.wage + 2, Math.round(mp.wage * rand(1.15, 1.4))));
  const [wage, setWage] = useState(() => Math.round(demand * 0.9));
  const [years, setYears] = useState(3);
  const [rejBy, setRejBy] = useState<'club' | 'player'>('club');
  const [reply, setReply] = useState('');
  const o = ovrOf(mp);

  const ratio = fee / mp.askingPrice;
  const clubHint = ratio >= 1 ? ['Sangat mungkin diterima', 'text-emerald-400'] : ratio >= 0.9 ? ['Peluang cukup baik', 'text-lime-300'] : ratio >= 0.85 ? ['Berisiko ditolak', 'text-amber-400'] : ['Hampir pasti ditolak', 'text-rose-400'];
  const wr = wage / demand;
  const wageHint = wr >= 1 ? ['Agen tampak puas', 'text-emerald-400'] : wr >= 0.92 ? ['Masih bisa diterima', 'text-lime-300'] : wr >= 0.85 ? ['Agen ragu-ragu', 'text-amber-400'] : ['Terlalu rendah', 'text-rose-400'];

  const submitOffer = () => {
    setStep('club-thinking');
    setTimeout(() => {
      let p = ratio >= 1 ? 0.95 : ratio >= 0.9 ? 0.6 : ratio >= 0.85 ? 0.3 : 0.03;
      if (ratio >= 1.15) p = 1;
      if (Math.random() < p) {
        setReply(pick([`${mp.club} menerima tawaran ${fmtMoney(fee)}. Silakan lanjut bicara dengan pemain.`, `"Kesepakatan antar klub tercapai." — Direktur ${mp.club}`, `${mp.club} setuju melepas ${mp.name} dengan harga tersebut.`]));
        setStep('club-ok');
      } else {
        setReply(pick([`${mp.club}: "Tawaran ini tidak mencerminkan nilai pemain kami."`, `${mp.club} menolak mentah-mentah tawaran ${fmtMoney(fee)}.`, `"${mp.name} tidak untuk dijual dengan harga itu." — Presiden ${mp.club}`]));
        setRejBy('club');
        rejectTransfer(mp.id, 'club');
        setStep('rejected');
      }
    }, 1500);
  };

  const submitWage = () => {
    setStep('player-thinking');
    setTimeout(() => {
      let p = wr >= 1 ? 0.92 : wr >= 0.92 ? 0.55 : wr >= 0.85 ? 0.25 : 0.03;
      if (mp.age >= 30) p += years >= 3 ? 0.08 : -0.15;
      else if (mp.age <= 22 && years >= 4) p += 0.05;
      if (wr >= 1.15) p = 1;
      if (Math.random() < p) {
        completeTransfer(mp, fee, wage, years);
        setStep('done');
      } else {
        setReply(pick([`Agen ${mp.name}: "Klien saya merasa tidak dihargai. Kami pergi."`, `${mp.name} memutuskan bertahan di ${mp.club}.`, `"Ini bukan proyek yang tepat untuk saya saat ini." — ${mp.name}`]));
        setRejBy('player');
        rejectTransfer(mp.id, 'player');
        setStep('rejected');
      }
    }, 1600);
  };

  const steps = ['Tawaran Klub', 'Kontrak Pemain', 'Done Deal'];
  const stepIdx = step === 'offer' || step === 'club-thinking' ? 0 : step === 'club-ok' || step === 'wage' || step === 'player-thinking' ? 1 : 2;
  const canClose = !['club-thinking', 'player-thinking'].includes(step);

  if (step === 'press') return <PressConference mp={mp} fee={fee} onClose={onClose} />;

  return (
    <Modal open onClose={canClose ? onClose : undefined} className="max-w-xl" title="Negosiasi Transfer">
      <div className="p-5">
        {/* stepper */}
        <div className="mb-5 flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex flex-1 items-center gap-2">
              <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black',
                step === 'rejected' && i === stepIdx ? 'bg-rose-600 text-white' : i < stepIdx || step === 'done' ? 'bg-emerald-500 text-emerald-950' : i === stepIdx ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'bg-white/10 text-slate-500')}>
                {step === 'rejected' && i === stepIdx ? '✕' : i < stepIdx || step === 'done' ? '✓' : i + 1}
              </span>
              <span className={cn('text-[11px] font-bold', i === stepIdx ? 'text-white' : 'text-slate-500')}>{s}</span>
              {i < 2 && <span className="h-px flex-1 bg-white/10" />}
            </div>
          ))}
        </div>

        {/* player header */}
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-black/30 p-3">
          <OvrBadge v={o} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 font-black text-white">{NATION_FLAGS[mp.nation]} {mp.name}</div>
            <div className="flex items-center gap-2 text-xs text-slate-400"><PosBadge pos={mp.pos} /> {mp.age} th · POT {mp.potential} · {mp.club}</div>
          </div>
          <div className="text-right text-xs">
            <div className="text-slate-500">Harga minta</div>
            <div className="text-lg font-black text-white">{fmtMoney(mp.askingPrice)}</div>
          </div>
        </div>

        {step === 'offer' && (
          <div className="space-y-4">
            <div className="text-sm text-slate-300">Langkah 1 — Ajukan tawaran resmi ke <b>{mp.club}</b>.</div>
            <div>
              <div className="mb-1 flex items-end justify-between">
                <span className="text-xs text-slate-400">Nilai tawaran</span>
                <span className="text-2xl font-black text-[var(--accent)]">{fmtMoney(fee)}</span>
              </div>
              <input type="range" min={Math.max(0.1, mp.askingPrice * 0.5)} max={mp.askingPrice * 1.4} step={0.1} value={fee} onChange={(e) => setFee(Math.round(+e.target.value * 10) / 10)} className="w-full accent-[var(--accent)]" />
              <div className="flex justify-between text-[11px]">
                <span className={clubHint[1]}>● {clubHint[0]} ({Math.round(ratio * 100)}% harga minta)</span>
                <span className={fee > state.transferBudget ? 'text-rose-400' : 'text-slate-500'}>Budget: {fmtMoney(state.transferBudget)}</span>
              </div>
            </div>
            {fee > state.transferBudget && <p className="rounded-lg bg-rose-500/10 p-2 text-xs text-rose-300">Transfer budget tidak mencukupi untuk tawaran ini.</p>}
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={onClose}>Batal</Button>
              <Button className="flex-1" disabled={fee > state.transferBudget} onClick={submitOffer}>Kirim Tawaran</Button>
            </div>
            <p className="text-[11px] text-slate-500">⚠ Jika tawaran ditolak, transfer batal sepenuhnya dan pemain tidak bisa didekati lagi sampai bursa diperbarui.</p>
          </div>
        )}

        {(step === 'club-thinking' || step === 'player-thinking') && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-[var(--accent)]" />
            <div className="text-sm text-slate-300">{step === 'club-thinking' ? `${mp.club} sedang mempertimbangkan tawaran…` : `${mp.name} dan agennya sedang berdiskusi…`}</div>
          </div>
        )}

        {step === 'club-ok' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-center">
              <div className="text-xs font-black uppercase tracking-widest text-emerald-400">Tawaran Diterima</div>
              <div className="mt-1 text-sm text-emerald-100">{reply}</div>
            </div>
            <Button className="w-full" onClick={() => setStep('wage')}>Lanjut Negosiasi Gaji →</Button>
          </div>
        )}

        {step === 'wage' && (
          <div className="space-y-4">
            <div className="text-sm text-slate-300">Langkah 2 — Negosiasi kontrak pribadi dengan <b>{mp.name}</b>.</div>
            <div className="rounded-lg bg-black/30 p-3 text-xs text-slate-300">💬 Agen: <i>"Klien saya saat ini digaji €{mp.wage}K/minggu. Kami mengharapkan sekitar <b className="text-white">€{demand}K/minggu</b>."</i></div>
            <div>
              <div className="mb-1 flex items-end justify-between"><span className="text-xs text-slate-400">Gaji per minggu</span><span className="text-2xl font-black text-[var(--accent)]">€{wage}K</span></div>
              <input type="range" min={Math.round(demand * 0.6)} max={Math.round(demand * 1.5)} value={wage} onChange={(e) => setWage(+e.target.value)} className="w-full accent-[var(--accent)]" />
              <div className={cn('text-[11px]', wageHint[1])}>● {wageHint[0]} ({Math.round(wr * 100)}% permintaan)</div>
            </div>
            <div>
              <div className="mb-1 text-xs text-slate-400">Durasi kontrak</div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((y) => <button key={y} onClick={() => setYears(y)} className={cn('flex-1 rounded-lg py-2 text-sm font-bold', years === y ? 'bg-[var(--accent)] text-[var(--accent-text)]' : 'bg-white/5 text-slate-400 hover:bg-white/10')}>{y} th</button>)}
              </div>
              {mp.age >= 30 && <div className="mt-1 text-[11px] text-slate-500">Pemain senior biasanya menginginkan kontrak lebih panjang.</div>}
            </div>
            <Button className="w-full" onClick={submitWage}>Ajukan Kontrak</Button>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4 text-center">
            <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-400 bg-gradient-to-br from-emerald-600/40 to-slate-900 p-6">
              <div className="text-5xl font-black italic tracking-tight text-white animate-[pop_.4s_ease-out]">DONE DEAL ✍️</div>
              <div className="mt-2 text-sm text-emerald-100">{mp.name} resmi menjadi pemain {state.club.name}!</div>
              <div className="mt-1 text-xs text-emerald-200/80">{fmtMoney(fee)} · €{wage}K/minggu · {years} tahun</div>
            </div>
            <p className="text-xs text-slate-400">📰 Berita transfer telah menyebar ke news feed.</p>
            <Button className="w-full" size="lg" onClick={() => setStep('press')}>🎤 Mulai Konferensi Pers</Button>
          </div>
        )}

        {step === 'rejected' && (
          <div className="space-y-4 text-center">
            <div className="relative rounded-2xl border-2 border-rose-500 bg-rose-950/50 p-6">
              <div className="inline-block -rotate-6 rounded-lg border-4 border-rose-500 px-4 py-1 text-4xl font-black tracking-widest text-rose-500">REJECTED</div>
              <div className="mt-3 text-sm text-rose-100">{reply}</div>
              <div className="mt-1 text-xs text-rose-300/80">{rejBy === 'club' ? 'Klub pemilik menolak tawaran.' : 'Pemain menolak kontrak pribadi.'} Transfer dibatalkan sepenuhnya.</div>
            </div>
            <Button variant="ghost" className="w-full" onClick={onClose}>Tutup</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function PressConference({ mp, fee, onClose }: { mp: MarketPlayer; fee: number; onClose: () => void }) {
  const { state } = useGame();
  const [qa] = useState(() => {
    const g = POS_GROUP[mp.pos];
    const role = g === 'ATT' ? 'mencetak banyak gol' : g === 'MID' ? 'mengontrol lini tengah dan memberi assist' : g === 'DEF' ? 'menjaga gawang tetap bersih' : 'menjadi tembok terakhir tim';
    const line = g === 'ATT' ? 'serangan' : g === 'MID' ? 'tengah' : g === 'DEF' ? 'belakang' : 'pertahanan';
    return [
      { q: `${mp.name}, selamat datang di ${state.club.name}! Mengapa memilih klub ini?`, who: mp.name, a: pick([`Begitu saya mendengar ketertarikan ${state.club.name}, keputusan saya langsung bulat. Proyek klub ini sangat ambisius.`, `Saya sudah lama mengagumi gaya bermain ${state.club.name}. Ini mimpi yang jadi nyata.`, `Manajer menjelaskan rencananya untuk saya, dan saya langsung yakin ini tempat yang tepat.`]) },
      { q: 'Apa target pribadimu musim ini?', who: mp.name, a: `Target saya jelas: ${role}. Saya ingin membalas kepercayaan suporter secepatnya.` },
      { q: `Coach ${state.account}, biaya ${fmtMoney(fee)} — apakah sepadan?`, who: `Coach ${state.account}`, a: pick([`Tentu. ${mp.name.split(' ')[0]} adalah pemain yang kami butuhkan untuk memperkuat lini ${line}. Kualitasnya tak perlu diragukan.`, `Kami tidak membeli nama, kami membeli karakter. ${mp.name.split(' ').slice(-1)[0]} akan langsung bersaing di starting XI.`]) },
    ];
  });
  const [shown, setShown] = useState(1);
  return (
    <Modal open onClose={onClose} className="max-w-2xl">
      <div className="relative overflow-hidden p-6" style={{ background: `linear-gradient(135deg, ${state.club.primary}, #0b1220 70%)` }}>
        <div className="pointer-events-none absolute inset-0">
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className="absolute h-2 w-2 rounded-full bg-white" style={{ left: `${10 + i * 11}%`, top: `${15 + (i % 3) * 25}%`, animation: `flash 1.6s ${i * 0.23}s infinite` }} />
          ))}
        </div>
        <div className="relative flex items-center gap-5">
          <Jersey primary={state.club.primary} secondary={state.club.secondary} pattern={state.club.pattern} number={state.squad.find((p) => p.id === mp.id)?.num ?? mp.num} name={mp.name.split(' ').slice(-1)[0]} size={130} />
          <div>
            <div className="text-xs font-black uppercase tracking-[0.3em] text-white/70">Konferensi Pers</div>
            <div className="text-3xl font-black text-white">{mp.name}</div>
            <div className="mt-1 flex items-center gap-2 text-sm text-white/80"><ClubLogo club={state.club} size={24} /> Rekrutan baru {state.club.name}</div>
          </div>
        </div>
      </div>
      <div className="space-y-3 p-5">
        {qa.slice(0, shown).map((x, i) => (
          <div key={i} className="animate-[slidein_.3s_ease-out] space-y-1.5">
            <div className="flex gap-2 text-sm"><span className="shrink-0 rounded bg-white/10 px-1.5 text-[10px] font-black leading-5 text-slate-300">WARTAWAN</span><span className="text-slate-300">{x.q}</span></div>
            <div className="ml-6 rounded-xl rounded-tl-none border border-[var(--accent)]/30 bg-[var(--accent)]/10 p-3 text-sm text-white">
              <div className="mb-0.5 text-[10px] font-black uppercase text-[var(--accent)]">{x.who}</div>
              "{x.a}"
            </div>
          </div>
        ))}
        {shown < qa.length ? (
          <Button className="w-full" variant="outline" onClick={() => setShown((s) => s + 1)}>Pertanyaan berikutnya →</Button>
        ) : (
          <Button className="w-full" onClick={onClose}>Akhiri Konferensi Pers</Button>
        )}
      </div>
    </Modal>
  );
}
