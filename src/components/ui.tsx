import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';
import type { Pos } from '@/game/types';
import { POS_COLOR, POS_GROUP } from '@/game/players';

export function Card({ children, className, title, action, icon }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className={cn('rounded-2xl border border-white/[0.07] bg-gradient-to-b from-slate-900/90 to-slate-950/90 shadow-xl shadow-black/30', className)}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-200">
            {icon && <span className="text-[var(--accent)]">{icon}</span>}
            {title}
          </h3>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

export function Button({ children, onClick, variant = 'primary', className, disabled, size = 'md', title }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'danger' | 'outline' | 'success'; className?: string; disabled?: boolean; size?: 'sm' | 'md' | 'lg'; title?: string;
}) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' && 'px-2.5 py-1 text-xs',
        size === 'md' && 'px-4 py-2 text-sm',
        size === 'lg' && 'px-6 py-3 text-base',
        variant === 'primary' && 'bg-[var(--accent)] text-[var(--accent-text)] shadow-lg shadow-black/30 hover:brightness-110',
        variant === 'ghost' && 'bg-white/5 text-slate-200 hover:bg-white/10',
        variant === 'outline' && 'border border-[var(--accent)]/60 text-[var(--accent)] hover:bg-[var(--accent)]/10',
        variant === 'danger' && 'bg-rose-600 text-white hover:bg-rose-500',
        variant === 'success' && 'bg-emerald-600 text-white hover:bg-emerald-500',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function ovrColor(v: number) {
  if (v >= 80) return 'from-emerald-400 to-emerald-600 text-emerald-950';
  if (v >= 70) return 'from-lime-300 to-lime-500 text-lime-950';
  if (v >= 60) return 'from-amber-300 to-amber-500 text-amber-950';
  return 'from-rose-400 to-rose-600 text-rose-950';
}

export function OvrBadge({ v, size = 'md', className }: { v: number; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span className={cn('inline-flex items-center justify-center rounded-md bg-gradient-to-br font-black tabular-nums shadow', ovrColor(v),
      size === 'sm' && 'h-6 w-7 text-xs', size === 'md' && 'h-8 w-9 text-sm', size === 'lg' && 'h-12 w-14 text-xl', className)}>
      {v}
    </span>
  );
}

export function ratingColor(r: number) {
  if (r >= 8) return 'bg-emerald-500 text-emerald-950';
  if (r >= 7) return 'bg-lime-400 text-lime-950';
  if (r >= 6.3) return 'bg-amber-400 text-amber-950';
  return 'bg-rose-500 text-white';
}

export function RatingBadge({ r, className }: { r: number; className?: string }) {
  if (!r) return <span className={cn('inline-flex h-5 w-8 items-center justify-center rounded bg-slate-700 text-[10px] text-slate-400', className)}>-</span>;
  return <span className={cn('inline-flex h-5 min-w-8 items-center justify-center rounded px-1 text-[11px] font-bold tabular-nums', ratingColor(r), className)}>{r.toFixed(1)}</span>;
}

export function Bar({ value, max = 100, className, color }: { value: number; max?: number; className?: string; color?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const c = color ?? (pct >= 75 ? 'bg-emerald-500' : pct >= 55 ? 'bg-amber-400' : 'bg-rose-500');
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-white/10', className)}>
      <div className={cn('h-full rounded-full transition-all duration-500', c)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function PosBadge({ pos, className }: { pos: Pos; className?: string }) {
  return <span className={cn('inline-flex w-10 items-center justify-center rounded border px-1 py-0.5 text-[10px] font-bold', POS_COLOR[POS_GROUP[pos]], className)}>{pos}</span>;
}

export function Segmented<T extends string | number>({ options, value, onChange, labels, className }: { options: T[]; value: T; onChange: (v: T) => void; labels?: string[]; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-1 rounded-lg bg-black/30 p-1', className)}>
      {options.map((o, i) => (
        <button key={String(o)} onClick={() => onChange(o)}
          className={cn('flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition', o === value ? 'bg-[var(--accent)] text-[var(--accent-text)] shadow' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200')}>
          {labels ? labels[i] : String(o)}
        </button>
      ))}
    </div>
  );
}

export function Scale({ label, value, onChange, labels }: { label: string; value: number; onChange: (v: number) => void; labels: string[] }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        <span className="font-bold text-[var(--accent)]">{labels[value - 1]}</span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((v) => (
          <button key={v} onClick={() => onChange(v)} title={labels[v - 1]}
            className={cn('h-2.5 flex-1 rounded-full transition', v <= value ? 'bg-[var(--accent)]' : 'bg-white/10 hover:bg-white/20')} />
        ))}
      </div>
    </div>
  );
}

export function Modal({ open, onClose, children, className, title }: { open: boolean; onClose?: () => void; children: ReactNode; className?: string; title?: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={cn('max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 shadow-2xl animate-[pop_.2s_ease-out]', className)}>
        {title && (
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
            <div className="font-bold text-slate-100">{title}</div>
            {onClose && <button onClick={onClose} className="text-xl leading-none text-slate-400 hover:text-white">×</button>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-lg font-black text-slate-100">{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

export function FormChips({ form }: { form: number[] }) {
  if (!form.length) return <span className="text-xs text-slate-600">—</span>;
  return (
    <div className="flex gap-0.5">
      {form.slice(-5).map((r, i) => (
        <span key={i} className={cn('h-4 w-1.5 rounded-sm', r >= 7.5 ? 'bg-emerald-400' : r >= 6.8 ? 'bg-lime-400' : r >= 6.2 ? 'bg-amber-400' : 'bg-rose-500')} title={r.toFixed(1)} />
      ))}
    </div>
  );
}
